package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"superboard/desktop/services"
)

// The editor build from the repository root is copied into frontend/dist
// before the Go build runs. Everything in that directory is embedded into
// the desktop binary.
//
//go:embed all:frontend/dist
var assets embed.FS

func main() {
	var mainWindow *application.WebviewWindow
	workspace := services.NewWorkspaceService()
	exporter := services.NewExportService(workspace)

	app := application.New(application.Options{
		Name:        "SuperBoard",
		Description: "SuperBoard 白板编辑器",
		Services: []application.Service{
			application.NewService(workspace),
			application.NewService(exporter),
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
				if mainWindow == nil {
					return
				}
				mainWindow.Restore()
				mainWindow.Show()
				mainWindow.Focus()
			},
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	mainWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "SuperBoard",
		Width:            1440,
		Height:           900,
		MinWidth:         1024,
		MinHeight:        680,
		BackgroundColour: application.NewRGB(247, 244, 236),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
