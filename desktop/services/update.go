package services

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

const (
	updateRepository = "beijiushare/SuperBoard"
	updateReleases   = "https://github.com/beijiushare/SuperBoard/releases/latest"
)

// UpdateService exposes the Wails updater to the settings dialog. The updater
// itself owns download, checksum verification, staging and the binary swap; we
// only decide when to check, where the asset comes from, and how failures are
// surfaced to the UI.
type UpdateService struct {
	version string

	mu      sync.Mutex
	ready   bool
	initErr string
}

func NewUpdateService(version string) *UpdateService {
	return &UpdateService{version: version}
}

func (s *UpdateService) Version() string {
	return s.version
}

func (s *UpdateService) DownloadPage() string {
	return updateReleases
}

// CanAutoUpdate reports whether the directory holding the executable is
// writable. The updater stages `wails-update-*` next to the binary, so a
// portable copy dropped into Program Files cannot replace itself.
func (s *UpdateService) CanAutoUpdate() Result {
	exe, err := os.Executable()
	if err != nil {
		return ok(map[string]any{"writable": false, "reason": err.Error()})
	}
	dir := filepath.Dir(exe)
	file, err := os.CreateTemp(dir, ".superboard-writable-*")
	if err != nil {
		return ok(map[string]any{
			"writable": false,
			"path":     dir,
			"reason":   err.Error(),
		})
	}
	name := file.Name()
	_ = file.Close()
	_ = os.Remove(name)
	return ok(map[string]any{"writable": true, "path": dir})
}

func (s *UpdateService) ensure() error {
	if s.ready {
		return nil
	}
	if s.initErr != "" {
		return errors.New(s.initErr)
	}
	app := application.Get()
	if app == nil {
		return errors.New("update.notReady")
	}
	provider, err := github.New(github.Config{
		Repository:    updateRepository,
		ChecksumAsset: "SHA256SUMS",
	})
	if err != nil {
		s.initErr = "update.initFailed|" + err.Error()
		return errors.New(s.initErr)
	}
	if err := app.Updater.Init(updater.Config{
		CurrentVersion: s.version,
		Providers:      []updater.Provider{provider},
		Window:         updater.WindowNone,
	}); err != nil {
		s.initErr = "update.initFailed|" + err.Error()
		return errors.New(s.initErr)
	}
	s.ready = true
	return nil
}

// Check asks GitHub for the latest release. A nil release means up to date.
func (s *UpdateService) Check() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.ensure(); err != nil {
		return fail(500, err.Error())
	}
	release, err := application.Get().Updater.Check(context.Background())
	if err != nil {
		return fail(502, "update.checkFailed|"+err.Error())
	}
	if release == nil {
		return ok(map[string]any{"update": false, "current": s.version})
	}
	return ok(map[string]any{
		"update":  true,
		"current": s.version,
		"version": release.Version,
		"notes":   release.Notes,
		"size":    release.Artifact.Size,
		"name":    release.Artifact.Filename,
	})
}

// RevealAppFolder opens the folder that holds the executable and selects it.
// Auto-install was removed because downloads kept failing; the settings dialog
// now points the user at the file they need to replace.
func (s *UpdateService) RevealAppFolder() Result {
	exe, err := os.Executable()
	if err != nil {
		return fail(500, err.Error())
	}
	dir := filepath.Dir(exe)
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", "/select,", exe)
	case "darwin":
		cmd = exec.Command("open", "-R", exe)
	default:
		cmd = exec.Command("xdg-open", dir)
	}
	if err := cmd.Start(); err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"ok": true, "path": dir})
}

// OpenDownloadPage opens the GitHub releases page in the system browser.
func (s *UpdateService) OpenDownloadPage() Result {
	app := application.Get()
	if app == nil {
		return fail(500, "update.notReady")
	}
	if err := app.Browser.OpenURL(updateReleases); err != nil {
		return fail(500, "update.pageFailed|"+err.Error())
	}
	return simpleOK()
}
