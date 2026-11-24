package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/zalando/go-keyring"
)

// AIService keeps provider credentials in the OS credential store and performs
// chat requests on behalf of the frontend. The key never travels back to the
// WebView: callers only ever see whether a key exists and its masked form.
type AIService struct {
	client *http.Client
}

func NewAIService() *AIService {
	return &AIService{client: &http.Client{Timeout: 120 * time.Second}}
}

const aiKeyringService = "SuperBoard"

type aiChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type aiChatRequest struct {
	Provider    string          `json:"provider"`
	BaseURL     string          `json:"baseURL"`
	Model       string          `json:"model"`
	Messages    []aiChatMessage `json:"messages"`
	Temperature *float64        `json:"temperature,omitempty"`
	// Keyless providers (Ollama, LM Studio) run on the local machine.
	Keyless bool `json:"keyless,omitempty"`
}

func maskKey(key string) string {
	trimmed := strings.TrimSpace(key)
	if len(trimmed) <= 8 {
		return "****"
	}
	return fmt.Sprintf("%s...%s", trimmed[:3], trimmed[len(trimmed)-4:])
}

func aiProviderID(provider string) string {
	trimmed := strings.TrimSpace(provider)
	if trimmed == "" {
		return "openai"
	}
	return trimmed
}

// SetAIKey stores a provider key in the OS credential store.
func (s *AIService) SetAIKey(provider string, key string) Result {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return fail(400, "empty key")
	}
	if err := keyring.Set(aiKeyringService, aiProviderID(provider), trimmed); err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"ok": true, "masked": maskKey(trimmed)})
}

// AIKeyStatus reports whether a key is stored, plus a masked preview.
func (s *AIService) AIKeyStatus(provider string) Result {
	key, err := keyring.Get(aiKeyringService, aiProviderID(provider))
	if err != nil {
		return ok(map[string]any{"ok": true, "hasKey": false})
	}
	return ok(map[string]any{
		"ok":     true,
		"hasKey": true,
		"masked": maskKey(key),
	})
}

func (s *AIService) ClearAIKey(provider string) Result {
	if err := keyring.Delete(aiKeyringService, aiProviderID(provider)); err != nil {
		// Deleting a missing entry is not an error for callers.
		if err == keyring.ErrNotFound {
			return ok(map[string]any{"ok": true})
		}
		return fail(500, err.Error())
	}
	return ok(map[string]any{"ok": true})
}

// ClearAllAIKeys removes every SuperBoard credential, for a clean handover.
func (s *AIService) ClearAllAIKeys() Result {
	if err := keyring.DeleteAll(aiKeyringService); err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"ok": true})
}

// chatEndpoint accepts a bare host, a /v1 base URL, or the full endpoint.
func chatEndpoint(baseURL string) string {
	base := strings.TrimSpace(baseURL)
	base = strings.TrimSuffix(base, "/")
	if base == "" {
		return ""
	}
	if strings.HasSuffix(base, "/chat/completions") {
		return base
	}
	return base + "/chat/completions"
}

// AIChat performs one non-streaming completion against an OpenAI compatible
// endpoint and returns the assistant message content.
func (s *AIService) AIChat(requestJSON string) Result {
	var request aiChatRequest
	if err := json.Unmarshal([]byte(requestJSON), &request); err != nil {
		return fail(400, "invalid request")
	}
	if len(request.Messages) == 0 {
		return fail(400, "empty messages")
	}
	endpoint := chatEndpoint(request.BaseURL)
	if endpoint == "" {
		return fail(400, "missing base URL")
	}
	if strings.TrimSpace(request.Model) == "" {
		return fail(400, "missing model")
	}
	key := ""
	if !request.Keyless {
		stored, err := keyring.Get(aiKeyringService, aiProviderID(request.Provider))
		if err != nil {
			return fail(401, "missing key")
		}
		key = stored
	}

	temperature := request.Temperature
	if temperature == nil {
		value := 0.4
		temperature = &value
	}
	payload := map[string]any{
		"model":       request.Model,
		"messages":    request.Messages,
		"temperature": *temperature,
		"stream":      false,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fail(500, err.Error())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fail(400, err.Error())
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	if key != "" {
		httpRequest.Header.Set("Authorization", "Bearer "+key)
	}

	response, err := s.client.Do(httpRequest)
	if err != nil {
		return fail(502, err.Error())
	}
	defer response.Body.Close()
	data, readErr := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if readErr != nil {
		return fail(502, readErr.Error())
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message := strings.TrimSpace(string(data))
		if len(message) > 600 {
			message = message[:600]
		}
		status := 502
		if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
			status = 401
		}
		if response.StatusCode == http.StatusTooManyRequests {
			status = 429
		}
		if message == "" {
			message = response.Status
		}
		return fail(status, message)
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &completion); err != nil {
		return fail(502, "invalid response")
	}
	if len(completion.Choices) == 0 {
		return fail(502, "empty response")
	}
	return ok(map[string]any{
		"ok":      true,
		"content": completion.Choices[0].Message.Content,
	})
}
