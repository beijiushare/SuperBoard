package services

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ExportService writes exported HTML through native dialogs. The frontend
// builds the snapshot HTML and tells this service which attachments to copy.
type ExportService struct {
	workspace *WorkspaceService
}

type exportAttachment struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

func NewExportService(workspace *WorkspaceService) *ExportService {
	return &ExportService{workspace: workspace}
}

func cancelledDialog(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "cancel")
}

func (s *ExportService) ExportHtml(html string, suggestedName string) Result {
	app := application.Get()
	if app == nil {
		return fail(500, "应用尚未就绪")
	}
	if suggestedName == "" {
		suggestedName = "superboard.html"
	}
	target, err := app.Dialog.SaveFile().
		SetMessage("导出 HTML").
		SetFilename(suggestedName).
		AddFilter("HTML", "*.html").
		CanCreateDirectories(true).
		PromptForSingleSelection()
	if err != nil {
		if cancelledDialog(err) {
			return ok(map[string]any{"cancelled": true})
		}
		return fail(500, err.Error())
	}
	if target == "" {
		return ok(map[string]any{"cancelled": true})
	}
	if err := os.WriteFile(target, []byte(html), 0o644); err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"ok": true, "path": target})
}

func (s *ExportService) ExportFolder(html string, attachmentsJSON string) Result {
	app := application.Get()
	if app == nil {
		return fail(500, "应用尚未就绪")
	}
	attachments := []exportAttachment{}
	if strings.TrimSpace(attachmentsJSON) != "" {
		if err := json.Unmarshal([]byte(attachmentsJSON), &attachments); err != nil {
			return fail(400, "附件清单不合法")
		}
	}
	dir, err := app.Dialog.OpenFile().
		SetTitle("选择导出目录").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(true).
		PromptForSingleSelection()
	if err != nil {
		if cancelledDialog(err) {
			return ok(map[string]any{"cancelled": true})
		}
		return fail(500, err.Error())
	}
	if dir == "" {
		return ok(map[string]any{"cancelled": true})
	}
	filesDir := filepath.Join(dir, "files")
	if err := os.MkdirAll(filesDir, 0o755); err != nil {
		return fail(500, err.Error())
	}
	for _, attachment := range attachments {
		source, resolveErr := s.workspace.ResolveFile(attachment.Source)
		if resolveErr != nil {
			continue
		}
		targetName := filepath.Base(attachment.Target)
		if targetName == "" || targetName == "." || targetName == string(filepath.Separator) {
			continue
		}
		if err := copyFile(source, filepath.Join(filesDir, targetName)); err != nil {
			return fail(500, err.Error())
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(html), 0o644); err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"ok": true, "path": dir})
}

func copyFile(source string, target string) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
