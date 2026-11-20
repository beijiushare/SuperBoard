package services

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
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
	return "", nil, errors.New("无法生成唯一文件名")
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
			return nil, errors.New("路径不合法")
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
		return "", errors.New("尚未打开工作区")
	}
	if !isScope(scope) {
		return "", errors.New("无效的 scope")
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
		return errors.New("工作区目录不存在")
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

// OpenWorkspace asks the OS for a directory and stores it in the local config.
func (s *WorkspaceService) OpenWorkspace() Result {
	app := application.Get()
	if app == nil {
		return fail(500, "应用尚未就绪")
	}
	dir, err := app.Dialog.OpenFile().
		SetTitle("选择 SuperBoard 工作区").
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
	config.Workspace = dir
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
		return fail(400, "工作区路径为空")
	}
	if _, err := os.Stat(filepath.Join(root, "public")); err != nil {
		if _, err := os.Stat(filepath.Join(root, "private")); err != nil {
			if _, err := os.Stat(filepath.Join(root, "whiteboards")); err != nil {
				return fail(400, "不是 SuperBoard 工作区")
			}
		}
	}
	if err := s.setRoot(root); err != nil {
		return fail(400, err.Error())
	}
	config := loadConfig()
	config.Workspace = root
	if err := saveConfig(config); err != nil {
		return fail(500, err.Error())
	}
	s.versions = map[string]string{}
	return ok(map[string]any{
		"name": filepath.Base(root),
		"path": root,
	})
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
		return nil, nil, errors.New("白板文件不是合法 JSON")
	}
	meta := metaOf(doc)
	if meta == nil {
		return nil, nil, errors.New("白板缺少 x-superboard.meta")
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
		return "", "", errors.New("白板不存在")
	}
	return dir, filepath.Join(dir, slug+".canvas"), nil
}

func (s *WorkspaceService) ReadBoard(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) && slug != "" {
		return fail(400, "slug 非法")
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
		return errors.New("slug 非法")
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
		return fail(409, "检测到其他标签页已修改该白板，请先确认是否覆盖")
	}
	doc, meta, err := parseCanvas(data)
	if err != nil {
		return fail(400, err.Error())
	}
	if stringValue(meta["slug"]) != slug {
		return fail(409, "slug 不一致")
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
		return fail(400, "参数不正确")
	}
	if _, _, err := s.boardLocation(scope, slug); err == nil {
		return fail(409, "slug 已存在: "+slug)
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
		return fail(400, "slug 非法")
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
				return fail(409, "slug 已存在: "+nextSlug)
			}
		}
		if nextFolder != currentFolder {
			target, targetErr := s.folderDir(scope, nextFolder, false)
			if targetErr == nil {
				if _, statErr := os.Stat(filepath.Join(target, nextSlug+".canvas")); statErr == nil {
					return fail(409, "slug 已存在: "+nextSlug)
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
		return fail(400, "文件夹名不合法")
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
		return fail(400, "参数不完整")
	}
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsAny(name, `/\`) || invalidParts.MatchString(name) {
		return fail(400, "文件夹名不合法")
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
		return fail(400, "不能移动到自身或子目录")
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
		return fail(409, "文件夹已存在: "+name)
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
		return fail(400, "不能删除根目录")
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

// ImportFile stores a version of the browser file input flow. The frontend
// sends base64 so the desktop app reuses the same insertion UI.
func (s *WorkspaceService) ImportFile(name string, dataBase64 string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !isScope(scope) {
		return fail(400, "无效的 scope")
	}
	if comma := strings.Index(dataBase64, ","); comma >= 0 && strings.HasPrefix(dataBase64, "data:") {
		dataBase64 = dataBase64[comma+1:]
	}
	data, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return fail(400, "文件数据不合法")
	}
	safe := sanitizeFileName(name)
	dir, err := s.folderDir(scope, "assets/files", true)
	if err != nil {
		return fail(400, err.Error())
	}
	target, handle, err := createUniqueFile(dir, safe)
	if err != nil {
		return fail(500, err.Error())
	}
	if _, err := handle.Write(data); err != nil {
		handle.Close()
		_ = os.Remove(target)
		return fail(500, err.Error())
	}
	if err := handle.Close(); err != nil {
		_ = os.Remove(target)
		return fail(500, err.Error())
	}
	fileName := filepath.Base(target)
	mimeType := mime.TypeByExtension(filepath.Ext(fileName))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	relative := scope + "/assets/files/" + fileName
	return created(map[string]any{
		"ok":   true,
		"path": relative,
		"name": name,
		"mime": mimeType,
		"size": len(data),
	})
}

// PickFiles copies files chosen through the native dialog into the workspace
// attachment directory. Unlike ImportFile it never carries file bytes over the
// JS bridge, so large videos are safe.
func (s *WorkspaceService) PickFiles(scope string) Result {
	if !isScope(scope) {
		return fail(400, "无效的 scope")
	}
	app := application.Get()
	if app == nil {
		return fail(500, "应用尚未就绪")
	}
	paths, err := app.Dialog.OpenFile().
		SetTitle("选择要插入的文件").
		CanChooseFiles(true).
		CanChooseDirectories(false).
		PromptForMultipleSelection()
	if err != nil {
		if cancelledDialog(err) {
			return ok(map[string]any{"cancelled": true})
		}
		return fail(500, err.Error())
	}
	if len(paths) == 0 {
		return ok(map[string]any{"cancelled": true, "files": []any{}})
	}
	dir, err := s.folderDir(scope, "assets/files", true)
	if err != nil {
		return fail(400, err.Error())
	}
	files := make([]map[string]any, 0, len(paths))
	for _, source := range paths {
		info, statErr := os.Stat(source)
		if statErr != nil || info.IsDir() {
			continue
		}
		name := filepath.Base(source)
		target, handle, err := createUniqueFile(dir, sanitizeFileName(name))
		if err != nil {
			return fail(500, err.Error())
		}
		input, openErr := os.Open(source)
		if openErr != nil {
			handle.Close()
			_ = os.Remove(target)
			continue
		}
		_, copyErr := io.Copy(handle, input)
		input.Close()
		handle.Close()
		if copyErr != nil {
			_ = os.Remove(target)
			return fail(500, copyErr.Error())
		}
		fileName := filepath.Base(target)
		mimeType := mime.TypeByExtension(filepath.Ext(fileName))
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		files = append(files, map[string]any{
			"path": scope + "/assets/files/" + fileName,
			"name": name,
			"mime": mimeType,
			"size": info.Size(),
		})
	}
	return ok(map[string]any{"files": files})
}

// ResolveFile validates that a workspace-relative path stays inside the
// workspace and points to a regular file.
func (s *WorkspaceService) ResolveFile(relative string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	relative = strings.Trim(strings.ReplaceAll(relative, "\\", "/"), "/")
	parts := strings.Split(relative, "/")
	if len(parts) < 2 || !isScope(parts[0]) {
		return "", errors.New("无效的文件路径")
	}
	for _, part := range parts[1:] {
		if part == "" || part == "." || part == ".." || invalidParts.MatchString(part) {
			return "", errors.New("无效的文件路径")
		}
	}
	root, err := s.scopeDir(parts[0], false)
	if err != nil {
		return "", err
	}
	target := filepath.Join(append([]string{root}, parts[1:]...)...)
	info, err := os.Stat(target)
	if err != nil || info.IsDir() {
		return "", errors.New("文件不存在")
	}
	cleanRoot := filepath.Clean(root) + string(os.PathSeparator)
	if !strings.HasPrefix(filepath.Clean(target)+string(os.PathSeparator), cleanRoot) {
		return "", errors.New("无效的文件路径")
	}
	return target, nil
}

func (s *WorkspaceService) FileURL(relative string) (string, error) {
	if _, err := s.ResolveFile(relative); err != nil {
		return "", err
	}
	parts := strings.Split(strings.Trim(relative, "/"), "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}
	return "/__files/" + strings.Join(parts, "/"), nil
}

func (s *WorkspaceService) OpenFile(relative string) error {
	target, err := s.ResolveFile(relative)
	if err != nil {
		return err
	}
	return openPath(target)
}

func (s *WorkspaceService) RevealFile(relative string) error {
	target, err := s.ResolveFile(relative)
	if err != nil {
		return err
	}
	return revealPath(target)
}

func (s *WorkspaceService) DeleteFile(relative string) error {
	target, err := s.ResolveFile(relative)
	if err != nil {
		return err
	}
	return os.Remove(target)
}

func openPath(target string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", target).Start()
	case "darwin":
		return exec.Command("open", target).Start()
	default:
		return exec.Command("xdg-open", target).Start()
	}
}

func revealPath(target string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer", "/select,"+target).Start()
	case "darwin":
		return exec.Command("open", "-R", target).Start()
	default:
		return exec.Command("xdg-open", filepath.Dir(target)).Start()
	}
}

// ServeFile backs /__files/ so images, video and documents inside the
// workspace can be loaded by the frontend without exposing absolute paths.
func (s *WorkspaceService) serveFile(w http.ResponseWriter, r *http.Request) bool {
	relative := strings.TrimPrefix(r.URL.Path, "/__files/")
	target, err := s.ResolveFile(relative)
	if err != nil {
		http.NotFound(w, r)
		return true
	}
	http.ServeFile(w, r, target)
	return true
}
