package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var (
	slugPattern  = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	invalidParts = regexp.MustCompile(`[\\:*?"<>|]`)
)

// sanitizeFileName keeps the user's original name and only replaces
// characters that cannot be used on Windows.
func sanitizeFileName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.Map(func(r rune) rune {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			return '_'
		}
		return r
	}, name)
	name = strings.TrimRight(name, ". ")
	if name == "" || name == "." || name == ".." {
		return "file"
	}
	return name
}

// createUniqueFile creates name inside dir and appends -2, -3, ... when the
// name is already taken.
func createUniqueFile(dir string, name string) (string, *os.File, error) {
	ext := filepath.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for index := 1; index < 10000; index++ {
		candidate := name
		if index > 1 {
			candidate = fmt.Sprintf("%s-%d%s", stem, index, ext)
		}
		path := filepath.Join(dir, candidate)
		file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
		if err == nil {
			return path, file, nil
		}
		if !os.IsExist(err) {
			return "", nil, err
		}
	}
	return "", nil, errors.New("workspace.uniqueNameFailed")
}

// WorkspaceService owns the selected workspace folder and mirrors the browser
// workspace backend over Wails bindings.
type WorkspaceService struct {
	mu       sync.Mutex
	root     string
	versions map[string]string
}

type BoardRow struct {
	Slug      string   `json:"slug"`
	Title     string   `json:"title"`
	Summary   string   `json:"summary,omitempty"`
	Order     *float64 `json:"order,omitempty"`
	UpdatedAt string   `json:"updatedAt,omitempty"`
	Path      string   `json:"path"`
	Scope     string   `json:"scope"`
}

type FolderRow struct {
	Path  string `json:"path"`
	Scope string `json:"scope"`
}

func NewWorkspaceService() *WorkspaceService {
	return &WorkspaceService{versions: map[string]string{}}
}

func isScope(value string) bool {
	return value == "public" || value == "private"
}

func nowISO() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func folderSegments(value string) ([]string, error) {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	value = strings.Trim(value, "/")
	if value == "" {
		return nil, nil
	}
	parts := make([]string, 0, 4)
	for _, part := range strings.Split(value, "/") {
		if part == "" {
			continue
		}
		if part == "." || part == ".." || invalidParts.MatchString(part) {
			return nil, errors.New("workspace.invalidPath")
		}
		parts = append(parts, part)
	}
	return parts, nil
}

func joinedPath(parts []string) string {
	return strings.Join(parts, "/")
}

// scopeDir prefers the legacy whiteboards/<scope> layout when it exists and
// otherwise uses <workspace>/<scope>.
func (s *WorkspaceService) scopeDir(scope string, create bool) (string, error) {
	if s.root == "" {
		return "", errors.New("workspace.noWorkspace")
	}
	if !isScope(scope) {
		return "", errors.New("workspace.invalidScope")
	}
	legacy := filepath.Join(s.root, "whiteboards", scope)
	if info, err := os.Stat(legacy); err == nil && info.IsDir() {
		return legacy, nil
	}
	modern := filepath.Join(s.root, scope)
	if create {
		if err := os.MkdirAll(modern, 0o755); err != nil {
			return "", err
		}
	}
	return modern, nil
}

func (s *WorkspaceService) folderDir(scope string, folder string, create bool) (string, error) {
	parts, err := folderSegments(folder)
	if err != nil {
		return "", err
	}
	dir, err := s.scopeDir(scope, create)
	if err != nil {
		return "", err
	}
	for _, part := range parts {
		dir = filepath.Join(dir, part)
	}
	if create {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", err
		}
	}
	return dir, nil
}

func (s *WorkspaceService) setRoot(root string) error {
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return errors.New("workspace.missingWorkspace")
	}
	s.root = root
	if _, err := s.scopeDir("public", true); err != nil {
		return err
	}
	if _, err := s.scopeDir("private", true); err != nil {
		return err
	}
	return nil
}

func looksLikeWorkspace(root string) bool {
	for _, name := range []string{"public", "private", "whiteboards"} {
		if info, err := os.Stat(filepath.Join(root, name)); err == nil && info.IsDir() {
			return true
		}
	}
	return false
}

// OpenWorkspace asks the OS for a directory and stores it in the local config.
func (s *WorkspaceService) OpenWorkspace() Result {
	app := application.Get()
	if app == nil {
		return fail(500, "app.notReady")
	}
	dir, err := app.Dialog.OpenFile().
		SetTitle(uiText("选择 SuperBoard 工作区", "Select SuperBoard workspace")).
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
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.setRoot(dir); err != nil {
		return fail(400, err.Error())
	}
	config := loadConfig()
	rememberWorkspace(&config, dir)
	if err := saveConfig(config); err != nil {
		return fail(500, err.Error())
	}
	s.versions = map[string]string{}
	return ok(map[string]any{
		"name": filepath.Base(dir),
		"path": dir,
	})
}

// RestoreWorkspace reopens the last workspace if it still exists.
func (s *WorkspaceService) RestoreWorkspace() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	config := loadConfig()
	if config.Workspace == "" {
		return ok(map[string]any{})
	}
	if err := s.setRoot(config.Workspace); err != nil {
		return ok(map[string]any{})
	}
	rememberWorkspace(&config, config.Workspace)
	if err := saveConfig(config); err != nil {
		return ok(map[string]any{})
	}
	s.versions = map[string]string{}
	return ok(map[string]any{
		"name": filepath.Base(config.Workspace),
		"path": config.Workspace,
	})
}

// OpenWorkspaceAt switches to a workspace path chosen by the OS or CLI.
func (s *WorkspaceService) OpenWorkspaceAt(root string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if root == "" {
		return fail(400, "workspace.emptyPath")
	}
	if !looksLikeWorkspace(root) {
		return fail(400, "workspace.notWorkspace")
	}
	if err := s.setRoot(root); err != nil {
		return fail(400, err.Error())
	}
	config := loadConfig()
	rememberWorkspace(&config, root)
	if err := saveConfig(config); err != nil {
		return fail(500, err.Error())
	}
	s.versions = map[string]string{}
	return ok(map[string]any{
		"name": filepath.Base(root),
		"path": root,
	})
}

func (s *WorkspaceService) GetLanguage() Result {
	config := loadConfig()
	return ok(map[string]any{"language": config.Language})
}

func (s *WorkspaceService) SetLanguage(language string) Result {
	if language != "zh-CN" && language != "en-US" {
		return fail(400, "workspace.unsupportedLanguage")
	}
	config := loadConfig()
	config.Language = language
	if err := saveConfig(config); err != nil {
		return fail(500, err.Error())
	}
	return simpleOK()
}

func (s *WorkspaceService) WorkspaceName() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.root == "" {
		return ""
	}
	return filepath.Base(s.root)
}

func (s *WorkspaceService) WorkspacePath() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.root
}

func (s *WorkspaceService) invalidateVersions() {
	for key := range s.versions {
		delete(s.versions, key)
	}
}
