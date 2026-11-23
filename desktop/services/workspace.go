package services

import (
	"encoding/json"
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

func parseCanvas(text string) (map[string]any, map[string]any, error) {
	var doc map[string]any
	if err := json.Unmarshal([]byte(text), &doc); err != nil {
		return nil, nil, errors.New("workspace.invalidJson")
	}
	meta := metaOf(doc)
	if meta == nil {
		return nil, nil, errors.New("workspace.missingMeta")
	}
	return doc, meta, nil
}

func metaOf(doc map[string]any) map[string]any {
	extra, ok := doc["x-superboard"].(map[string]any)
	if !ok {
		return nil
	}
	meta, ok := extra["meta"].(map[string]any)
	if !ok {
		return nil
	}
	return meta
}

func (s *WorkspaceService) scanBoards() ([]BoardRow, error) {
	rows := []BoardRow{}
	for _, scope := range []string{"public", "private"} {
		root, err := s.scopeDir(scope, false)
		if err != nil {
			continue
		}
		_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			name := entry.Name()
			if entry.IsDir() {
				if path != root && strings.HasPrefix(name, ".") {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(name, ".canvas") || strings.HasPrefix(name, ".") {
				return nil
			}
			data, readErr := os.ReadFile(path)
			if readErr != nil {
				return nil
			}
			_, meta, parseErr := parseCanvas(string(data))
			if parseErr != nil {
				return nil
			}
			rel, relErr := filepath.Rel(root, filepath.Dir(path))
			if relErr != nil || rel == "." {
				rel = ""
			}
			row := BoardRow{
				Slug:      stringValue(meta["slug"]),
				Title:     stringValue(meta["title"]),
				Summary:   stringValue(meta["summary"]),
				UpdatedAt: stringValue(meta["updatedAt"]),
				Path:      filepath.ToSlash(rel),
				Scope:     scope,
			}
			if order, ok := meta["order"].(float64); ok {
				row.Order = &order
			}
			if row.Slug != "" {
				rows = append(rows, row)
			}
			return nil
		})
	}
	return rows, nil
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func (s *WorkspaceService) ListBoards() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows, err := s.scanBoards()
	if err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"canvases": rows})
}

func (s *WorkspaceService) ListFolders() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := []FolderRow{}
	for _, scope := range []string{"public", "private"} {
		root, err := s.scopeDir(scope, false)
		if err != nil {
			continue
		}
		_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil || !entry.IsDir() {
				return nil
			}
			if path == root {
				return nil
			}
			if strings.HasPrefix(entry.Name(), ".") {
				return filepath.SkipDir
			}
			rel, relErr := filepath.Rel(root, path)
			if relErr != nil {
				return nil
			}
			rows = append(rows, FolderRow{Path: filepath.ToSlash(rel), Scope: scope})
			return nil
		})
	}
	return ok(map[string]any{"folders": rows})
}

func (s *WorkspaceService) boardLocation(scope string, slug string) (string, string, error) {
	root, err := s.scopeDir(scope, false)
	if err != nil {
		return "", "", err
	}
	var dir string
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil || dir != "" {
			return nil
		}
		if entry.IsDir() {
			if path != root && strings.HasPrefix(entry.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Name() == slug+".canvas" {
			dir = filepath.Dir(path)
		}
		return nil
	})
	if dir == "" {
		return "", "", errors.New("workspace.boardMissing")
	}
	return dir, filepath.Join(dir, slug+".canvas"), nil
}

func (s *WorkspaceService) ReadBoard(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) && slug != "" {
		return fail(400, "workspace.badSlug")
	}
	_, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(404, err.Error())
	}
	s.versions[scope+"/"+slug] = string(data)
	return Result{Status: 200, Body: string(data)}
}

func (s *WorkspaceService) writeBoard(scope string, folder string, slug string, text string) error {
	if !slugPattern.MatchString(slug) {
		return errors.New("workspace.badSlug")
	}
	dir, err := s.folderDir(scope, folder, true)
	if err != nil {
		return err
	}
	target := filepath.Join(dir, slug+".canvas")
	var backup []byte
	if current, readErr := os.ReadFile(target); readErr == nil {
		backup = current
		_ = os.WriteFile(target+".bak", current, 0o644)
	}
	temp := filepath.Join(dir, "."+slug+".canvas.tmp")
	if err := os.WriteFile(temp, []byte(text), 0o644); err != nil {
		return err
	}
	if err := os.Rename(temp, target); err != nil {
		_ = os.Remove(temp)
		_ = os.Remove(target)
		if retry := os.WriteFile(target, []byte(text), 0o644); retry != nil {
			if backup != nil {
				_ = os.WriteFile(target, backup, 0o644)
			}
			return retry
		}
	}
	s.versions[scope+"/"+slug] = text
	return nil
}

func (s *WorkspaceService) WriteBoard(slug string, scope string, data string, force bool) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	current, err := os.ReadFile(file)
	if err != nil {
		return fail(404, err.Error())
	}
	text := string(current)
	key := scope + "/" + slug
	baseline, seen := s.versions[key]
	if !force && seen && baseline != text && data != text {
		return fail(409, "workspace.conflictOtherTab")
	}
	doc, meta, err := parseCanvas(data)
	if err != nil {
		return fail(400, err.Error())
	}
	if stringValue(meta["slug"]) != slug {
		return fail(409, "workspace.slugMismatch")
	}
	meta["updatedAt"] = nowISO()
	next, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	folder, relErr := filepath.Rel(mustScopeRoot(s, scope), dir)
	if relErr != nil || folder == "." {
		folder = ""
	}
	folder = filepath.ToSlash(folder)
	if err := s.writeBoard(scope, folder, slug, string(next)); err != nil {
		return fail(500, err.Error())
	}
	return canvasOK(doc, meta, folder, scope)
}

func mustScopeRoot(s *WorkspaceService, scope string) string {
	root, err := s.scopeDir(scope, false)
	if err != nil {
		return s.root
	}
	return root
}

func (s *WorkspaceService) CreateBoard(title string, slug string, folder string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	title = strings.TrimSpace(title)
	if title == "" || !slugPattern.MatchString(slug) {
		return fail(400, "workspace.badParams")
	}
	if _, _, err := s.boardLocation(scope, slug); err == nil {
		return fail(409, "workspace.slugExists|"+slug)
	}
	parts, err := folderSegments(folder)
	if err != nil {
		return fail(400, err.Error())
	}
	doc := map[string]any{
		"nodes": []any{},
		"edges": []any{},
		"x-superboard": map[string]any{
			"version": 1,
			"meta": map[string]any{
				"title":     title,
				"slug":      slug,
				"updatedAt": nowISO(),
			},
		},
	}
	text, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	folderPath := joinedPath(parts)
	if err := s.writeBoard(scope, folderPath, slug, string(text)); err != nil {
		return fail(500, err.Error())
	}
	return created(map[string]any{
		"ok":     true,
		"canvas": doc,
		"path":   folderPath,
		"scope":  scope,
	})
}

func (s *WorkspaceService) UpdateBoard(slug string, scope string, title string, nextSlug string, folder string, summary string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(nextSlug) {
		return fail(400, "workspace.badSlug")
	}
	locationDir, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	current, err := os.ReadFile(file)
	if err != nil {
		return fail(404, err.Error())
	}
	doc, meta, err := parseCanvas(string(current))
	if err != nil {
		return fail(400, err.Error())
	}
	currentFolder, relErr := filepath.Rel(mustScopeRoot(s, scope), locationDir)
	if relErr != nil || currentFolder == "." {
		currentFolder = ""
	}
	currentFolder = filepath.ToSlash(currentFolder)
	parts, err := folderSegments(folder)
	if err != nil {
		return fail(400, err.Error())
	}
	nextFolder := joinedPath(parts)
	if nextSlug != slug || nextFolder != currentFolder {
		if _, _, err := s.boardLocation(scope, nextSlug); err == nil {
			if nextSlug != slug {
				return fail(409, "workspace.slugExists|"+nextSlug)
			}
		}
		if nextFolder != currentFolder {
			target, targetErr := s.folderDir(scope, nextFolder, false)
			if targetErr == nil {
				if _, statErr := os.Stat(filepath.Join(target, nextSlug+".canvas")); statErr == nil {
					return fail(409, "workspace.slugExists|"+nextSlug)
				}
			}
		}
	}
	meta["title"] = chooseString(title, stringValue(meta["title"]))
	meta["slug"] = nextSlug
	if summary != "" {
		meta["summary"] = summary
	}
	meta["updatedAt"] = nowISO()
	next, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	if err := s.writeBoard(scope, nextFolder, nextSlug, string(next)); err != nil {
		return fail(500, err.Error())
	}
	if nextSlug != slug || nextFolder != currentFolder {
		_ = os.Remove(file)
		delete(s.versions, scope+"/"+slug)
	}
	return canvasOK(doc, meta, nextFolder, scope)
}

func chooseString(next string, fallback string) string {
	next = strings.TrimSpace(next)
	if next == "" {
		return fallback
	}
	return next
}

func (s *WorkspaceService) DeleteBoard(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	if err := os.Remove(file); err != nil {
		return fail(500, err.Error())
	}
	delete(s.versions, scope+"/"+slug)
	return simpleOK()
}

func (s *WorkspaceService) CreateFolder(parent string, name string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\`) || invalidParts.MatchString(name) {
		return fail(400, "workspace.badFolderName")
	}
	dir, err := s.folderDir(scope, parent, true)
	if err != nil {
		return fail(400, err.Error())
	}
	if err := os.MkdirAll(filepath.Join(dir, name), 0o755); err != nil {
		return fail(500, err.Error())
	}
	parentParts, _ := folderSegments(parent)
	return created(map[string]any{
		"ok":   true,
		"path": joinedPath(append(parentParts, name)),
	})
}

func (s *WorkspaceService) UpdateFolder(folderPath string, name string, parent string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	sourceParts, err := folderSegments(folderPath)
	if err != nil || len(sourceParts) == 0 {
		return fail(400, "workspace.badParams")
	}
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsAny(name, `/\`) || invalidParts.MatchString(name) {
		return fail(400, "workspace.badFolderName")
	}
	currentParent := joinedPath(sourceParts[:len(sourceParts)-1])
	if strings.TrimSpace(parent) == "" && currentParent != "" {
		parent = currentParent
	}
	parentParts, err := folderSegments(parent)
	if err != nil {
		return fail(400, err.Error())
	}
	sourcePath := joinedPath(sourceParts)
	targetParentPath := joinedPath(parentParts)
	if targetParentPath == sourcePath || strings.HasPrefix(targetParentPath, sourcePath+"/") {
		return fail(400, "workspace.moveIntoSelf")
	}
	if targetParentPath == currentParent && name == sourceParts[len(sourceParts)-1] {
		return simplePath(sourcePath)
	}
	sourceRoot, err := s.folderDir(scope, currentParent, false)
	if err != nil {
		return fail(400, err.Error())
	}
	source := filepath.Join(sourceRoot, sourceParts[len(sourceParts)-1])
	targetRoot, err := s.folderDir(scope, targetParentPath, true)
	if err != nil {
		return fail(400, err.Error())
	}
	target := filepath.Join(targetRoot, name)
	if _, statErr := os.Stat(target); statErr == nil {
		return fail(409, "workspace.folderExists|"+name)
	}
	if err := os.Rename(source, target); err != nil {
		return fail(500, err.Error())
	}
	s.invalidateVersions()
	return simplePath(joinedPath(append(parentParts, name)))
}

func (s *WorkspaceService) DeleteFolder(folderPath string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	parts, err := folderSegments(folderPath)
	if err != nil || len(parts) == 0 {
		return fail(400, "workspace.deleteRoot")
	}
	dir, err := s.folderDir(scope, folderPath, false)
	if err != nil {
		return fail(400, err.Error())
	}
	if err := os.RemoveAll(dir); err != nil {
		return fail(500, err.Error())
	}
	s.invalidateVersions()
	return simpleOK()
}

func (s *WorkspaceService) invalidateVersions() {
	for key := range s.versions {
		delete(s.versions, key)
	}
}
