package services

import (
	"encoding/base64"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ImportFile stores a version of the browser file input flow. The frontend
// sends base64 so the desktop app reuses the same insertion UI.
func (s *WorkspaceService) ImportFile(name string, dataBase64 string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !isScope(scope) {
		return fail(400, "workspace.invalidScope")
	}
	if comma := strings.Index(dataBase64, ","); comma >= 0 && strings.HasPrefix(dataBase64, "data:") {
		dataBase64 = dataBase64[comma+1:]
	}
	data, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return fail(400, "workspace.invalidFileData")
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
	payload := map[string]any{
		"ok":   true,
		"path": relative,
		"name": name,
		"mime": mimeType,
		"size": len(data),
	}
	if width, height := mediaDimensions(target, mimeType); width > 0 && height > 0 {
		payload["width"] = width
		payload["height"] = height
	}
	return created(payload)
}

// PickFiles copies files chosen through the native dialog into the workspace
// attachment directory. Unlike ImportFile it never carries file bytes over the
// JS bridge, so large videos are safe.
func (s *WorkspaceService) PickFiles(scope string) Result {
	if !isScope(scope) {
		return fail(400, "workspace.invalidScope")
	}
	app := application.Get()
	if app == nil {
		return fail(500, "app.notReady")
	}
	paths, err := app.Dialog.OpenFile().
		SetTitle(uiText("选择要插入的文件", "Choose files to insert")).
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
		if width, height := mediaDimensions(source, mimeType); width > 0 && height > 0 {
			files[len(files)-1]["width"] = width
			files[len(files)-1]["height"] = height
		}
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
		return "", errors.New("workspace.invalidFilePath")
	}
	for _, part := range parts[1:] {
		if part == "" || part == "." || part == ".." || invalidParts.MatchString(part) {
			return "", errors.New("workspace.invalidFilePath")
		}
	}
	root, err := s.scopeDir(parts[0], false)
	if err != nil {
		return "", err
	}
	target := filepath.Join(append([]string{root}, parts[1:]...)...)
	info, err := os.Stat(target)
	if err != nil || info.IsDir() {
		return "", errors.New("workspace.fileMissing")
	}
	cleanRoot := filepath.Clean(root) + string(os.PathSeparator)
	if !strings.HasPrefix(filepath.Clean(target)+string(os.PathSeparator), cleanRoot) {
		return "", errors.New("workspace.invalidFilePath")
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

// serveFile backs /__files/ so images, video and documents inside the
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
