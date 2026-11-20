package services

import (
	"encoding/json"
)

// Result is a small envelope shared by all workspace operations. The frontend
// backend turns it back into a Response-like object, which keeps the existing
// workspaceApi contract untouched.
type Result struct {
	Status int    `json:"status"`
	Body   string `json:"body"`
}

func ok(body any) Result {
	data, err := json.Marshal(body)
	if err != nil {
		return fail(500, err.Error())
	}
	return Result{Status: 200, Body: string(data)}
}

func created(body any) Result {
	result := ok(body)
	result.Status = 201
	return result
}

func fail(status int, message string) Result {
	data, _ := json.Marshal(map[string]string{"error": message})
	return Result{Status: status, Body: string(data)}
}

func canvasOK(canvas any, meta any, folder string, scope string) Result {
	return ok(map[string]any{
		"ok":     true,
		"canvas": canvas,
		"meta":   meta,
		"path":   folder,
		"scope":  scope,
	})
}

func simpleOK() Result {
	return ok(map[string]any{"ok": true})
}

func simplePath(path string) Result {
	return ok(map[string]any{"ok": true, "path": path})
}
