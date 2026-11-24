package main

import (
	"embed"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"superboard/desktop/services"
)

// The editor build from the repository root is copied into frontend/dist
// before the Go build runs. Everything in that directory is embedded into
// the desktop binary.
//
//go:embed all:frontend/dist
var assets embed.FS

// resolveCanvasWorkspace derives the workspace root from a .canvas path.
// Recognized layouts:
//
//	<root>/public|private/<...>/<slug>.canvas
//	<root>/whiteboards/public|private/<...>/<slug>.canvas
func resolveCanvasWorkspace(file string) (root string, scope string, slug string, ok bool) {
	abs, err := filepath.Abs(file)
	if err != nil {
		return "", "", "", false
	}
	slug = strings.TrimSuffix(filepath.Base(abs), ".canvas")
	if slug == "" {
		return "", "", "", false
	}
	dir := filepath.Dir(abs)
	for {
		base := filepath.Base(dir)
		parent := filepath.Dir(dir)
		if base == "public" || base == "private" {
			scope = base
			if filepath.Base(parent) == "whiteboards" {
				return filepath.Dir(parent), scope, slug, true
			}
			return parent, scope, slug, true
		}
		if parent == dir {
			return "", "", "", false
		}
		dir = parent
	}
}

func main() {
	var mainWindow *application.WebviewWindow
	var openCanvas func(string)
	workspace := services.NewWorkspaceService()
	exporter := services.NewExportService(workspace)
	updates := services.NewUpdateService(appVersion)
	ai := services.NewAIService()

	// Opt-in WebView2 debugging for local UI verification.
	browserArgs := []string{}
	if os.Getenv("SUPERBOARD_DEBUG") != "" {
		browserArgs = append(browserArgs, "--remote-debugging-port=9222")
	}

	startURL := "/"
	for _, arg := range os.Args[1:] {
		if !strings.HasSuffix(strings.ToLower(arg), ".canvas") {
			continue
		}
		root, scope, slug, ok := resolveCanvasWorkspace(arg)
		if !ok {
			continue
		}
		if result := workspace.OpenWorkspaceAt(root); result.Status != 200 {
			continue
		}
		startURL = "/?board=" + url.QueryEscape(slug)
		if scope == "private" {
			startURL += "&scope=private"
		}
		break
	}

	app := application.New(application.Options{
		Name:             "SuperBoard",
		Description:      "SuperBoard 白板编辑器",
		FileAssociations: []string{".canvas"},
		Services: []application.Service{
			application.NewService(workspace),
			application.NewService(exporter),
			application.NewService(updates),
			application.NewService(ai),
		},
		Assets: application.AssetOptions{
			Handler: services.NewAssetHandler(
				application.AssetFileServerFS(assets),
				workspace,
			),
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.superboard.desktop",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				for _, arg := range data.Args {
					if strings.HasSuffix(strings.ToLower(arg), ".canvas") && openCanvas != nil {
						openCanvas(arg)
						break
					}
				}
				if mainWindow == nil {
					return
				}
				// Restore() also cancels maximisation, which would shrink the
				// default full-work-area window on every second launch. Only a
				// minimised window needs restoring.
				if mainWindow.IsMinimised() {
					mainWindow.UnMinimise()
				}
				mainWindow.Show()
				mainWindow.Focus()
			},
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		Windows: application.WindowsOptions{
			AdditionalBrowserArgs: browserArgs,
		},
	})

	openCanvas = func(file string) {
		root, scope, slug, ok := resolveCanvasWorkspace(file)
		if !ok {
			return
		}
		if result := workspace.OpenWorkspaceAt(root); result.Status != 200 {
			log.Printf("open workspace failed: %s", result.Body)
			return
		}
		app.Event.Emit("superboard:open", map[string]string{
			"scope": scope,
			"slug":  slug,
		})
	}

	app.Event.OnApplicationEvent(events.Common.ApplicationOpenedWithFile, func(event *application.ApplicationEvent) {
		openCanvas(event.Context().Filename())
	})

	// Keep the initial window inside the primary work area. Small displays
	// previously pushed the title bar and its buttons off-screen.
	windowWidth, windowHeight := 1180, 700
	windowX, windowY := 20, 20
	workWidth, workHeight := 0, 0
	if screen := app.Screen.GetPrimary(); screen != nil {
		work := screen.WorkArea
		workWidth, workHeight = work.Width, work.Height
		if work.Width > 0 && work.Height > 0 {
			windowWidth = min(1180, max(960, work.Width-100))
			windowHeight = min(700, max(640, work.Height-100))
			windowX = work.X + (work.Width-windowWidth)/2
			windowY = work.Y + (work.Height-windowHeight)/2
		}
	}
	if os.Getenv("SUPERBOARD_DEBUG") != "" {
		if file, err := os.OpenFile(
			filepath.Join(os.TempDir(), "superboard-window.log"),
			os.O_CREATE|os.O_WRONLY|os.O_TRUNC,
			0o644,
		); err == nil {
			_, _ = fmt.Fprintf(
				file,
				"work=%dx%d window=%dx%d at %d,%d\n",
				workWidth,
				workHeight,
				windowWidth,
				windowHeight,
				windowX,
				windowY,
			)
			_ = file.Close()
		}
	}

	mainWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "SuperBoard",
		Width:            windowWidth,
		Height:           windowHeight,
		X:                windowX,
		Y:                windowY,
		MinWidth:         1024,
		MinHeight:        680,
		Frameless:        true,
		BackgroundColour: application.NewRGB(247, 244, 236),
		URL:              startURL,
	})
	mainWindow.Maximise()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
