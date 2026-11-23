package services

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

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

// Install downloads, verifies and stages the release. The UI calls Restart
// afterwards, once it has received this response and can show a hint.
func (s *UpdateService) Install() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	app := application.Get()
	if app == nil {
		return fail(500, "update.notReady")
	}
	if app.Updater.State() != updater.StateAvailable {
		return fail(400, "update.noRelease")
	}
	if err := app.Updater.DownloadAndInstall(context.Background()); err != nil {
		return fail(500, "update.installFailed|"+err.Error())
	}
	return ok(map[string]any{"ready": true})
}

// Restart applies the staged update and relaunches. The short delay lets this
// binding response reach the webview before the process exits.
func (s *UpdateService) Restart() Result {
	app := application.Get()
	if app == nil {
		return fail(500, "update.notReady")
	}
	if app.Updater.State() != updater.StateReady {
		return fail(400, "update.noStage")
	}
	go func() {
		time.Sleep(150 * time.Millisecond)
		_ = app.Updater.Restart(context.Background())
	}()
	return ok(map[string]any{"restarting": true})
}

// OpenDownloadPage opens the GitHub releases page in the system browser, used
// when the install directory is read-only.
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
