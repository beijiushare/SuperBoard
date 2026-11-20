package services

import (
	"net/http"
	"strings"
)

// NewAssetHandler serves the embedded frontend and adds a guarded /__files/
// route for workspace attachments.
func NewAssetHandler(static http.Handler, workspace *WorkspaceService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/__files/") {
			workspace.serveFile(w, r)
			return
		}
		static.ServeHTTP(w, r)
	})
}
