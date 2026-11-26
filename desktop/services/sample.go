package services

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type SampleFile struct {
	Path string `json:"path"`
	Data string `json:"data"`
}

// CopySample writes the read-only sample workspace into a folder the user
// chooses. The frontend fetches the sample from its bundled assets and passes
// base64 payloads, so the Go side never needs to know where the sample lives.
func (s *WorkspaceService) CopySample(payload string) Result {
	var files []SampleFile
	if err := json.Unmarshal([]byte(payload), &files); err != nil {
		return fail(400, "workspace.badParams")
	}
	if len(files) == 0 {
		return fail(400, "workspace.badParams")
	}
	app := application.Get()
	if app == nil {
		return fail(500, "app.notReady")
	}
	dir, err := app.Dialog.OpenFile().
		SetTitle(uiText("sample.copy")).
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(true).
		PromptForSingleSelection()
	if err != nil || dir == "" {
		if err != nil && !strings.Contains(strings.ToLower(err.Error()), "cancel") {
			return fail(500, err.Error())
		}
		return ok(map[string]any{"cancelled": true})
	}
	root, err := filepath.Abs(dir)
	if err != nil {
		return fail(500, err.Error())
	}
	written := 0
	for _, file := range files {
		relative := strings.TrimPrefix(filepath.ToSlash(file.Path), "/")
		if relative == "" || strings.Contains(relative, "..") {
			continue
		}
		target := filepath.Join(root, filepath.FromSlash(relative))
		if !strings.HasPrefix(target, root+string(os.PathSeparator)) {
			continue
		}
		data, decodeErr := base64.StdEncoding.DecodeString(file.Data)
		if decodeErr != nil {
			continue
		}
		if mkErr := os.MkdirAll(filepath.Dir(target), 0o755); mkErr != nil {
			continue
		}
		if writeErr := os.WriteFile(target, data, 0o644); writeErr != nil {
			continue
		}
		written++
	}
	if written == 0 {
		return fail(500, "workspace.copySampleFailed")
	}
	return ok(map[string]any{"ok": true, "path": root})
}
