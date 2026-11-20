package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func newTestWorkspace(t *testing.T) (*WorkspaceService, string) {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "public"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "private"), 0o755); err != nil {
		t.Fatal(err)
	}
	service := NewWorkspaceService()
	if result := service.OpenWorkspaceAt(root); result.Status != 200 {
		t.Fatalf("open workspace: %s", result.Body)
	}
	return service, root
}

func TestWorkspaceBoardLifecycle(t *testing.T) {
	service, root := newTestWorkspace(t)

	if result := service.CreateBoard("Test", "test-board", "", "public"); result.Status != 201 {
		t.Fatalf("create board: %d %s", result.Status, result.Body)
	}
	if _, err := os.Stat(filepath.Join(root, "public", "test-board.canvas")); err != nil {
		t.Fatalf("board file missing: %v", err)
	}
	if result := service.CreateBoard("Test", "test-board", "", "public"); result.Status != 409 {
		t.Fatalf("duplicate board should conflict, got %d", result.Status)
	}

	listed := service.ListBoards()
	var payload struct {
		Canvases []BoardRow `json:"canvases"`
	}
	if err := json.Unmarshal([]byte(listed.Body), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Canvases) != 1 || payload.Canvases[0].Slug != "test-board" {
		t.Fatalf("unexpected boards: %s", listed.Body)
	}

	read := service.ReadBoard("test-board", "public")
	if read.Status != 200 {
		t.Fatalf("read board: %s", read.Body)
	}

	if result := service.CreateFolder("", "docs", "public"); result.Status != 201 {
		t.Fatalf("create folder: %s", result.Body)
	}
	if result := service.UpdateBoard("test-board", "public", "Test 2", "test-board-2", "docs", ""); result.Status != 200 {
		t.Fatalf("update board: %s", result.Body)
	}
	if _, err := os.Stat(filepath.Join(root, "public", "docs", "test-board-2.canvas")); err != nil {
		t.Fatalf("moved board missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "public", "test-board.canvas")); !os.IsNotExist(err) {
		t.Fatalf("old board should be removed: %v", err)
	}

	if result := service.UpdateFolder("docs", "documents", "", "public"); result.Status != 200 {
		t.Fatalf("move folder: %s", result.Body)
	}
	if _, err := os.Stat(filepath.Join(root, "public", "documents", "test-board-2.canvas")); err != nil {
		t.Fatalf("moved folder missing board: %v", err)
	}

	if result := service.DeleteBoard("test-board-2", "public"); result.Status != 200 {
		t.Fatalf("delete board: %s", result.Body)
	}
	if result := service.DeleteFolder("documents", "public"); result.Status != 200 {
		t.Fatalf("delete folder: %s", result.Body)
	}
}

func TestWorkspaceConflictsAndPaths(t *testing.T) {
	service, root := newTestWorkspace(t)
	if result := service.CreateBoard("Test", "board", "", "public"); result.Status != 201 {
		t.Fatalf("create board: %s", result.Body)
	}
	read := service.ReadBoard("board", "public")
	if read.Status != 200 {
		t.Fatalf("read board: %s", read.Body)
	}

	path := filepath.Join(root, "public", "board.canvas")
	external, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, external, 0o644); err != nil {
		t.Fatal(err)
	}
	var document map[string]any
	if err := json.Unmarshal(external, &document); err != nil {
		t.Fatal(err)
	}
	document["nodes"] = []any{map[string]any{
		"id":     "external",
		"type":   "text",
		"x":      0,
		"y":      0,
		"width":  10,
		"height": 10,
		"text":   "external",
	}}
	changed, err := json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, changed, 0o644); err != nil {
		t.Fatal(err)
	}
	if result := service.WriteBoard("board", "public", read.Body, false); result.Status != 409 {
		t.Fatalf("expected conflict, got %d %s", result.Status, result.Body)
	}
	if result := service.WriteBoard("board", "public", read.Body, true); result.Status != 200 {
		t.Fatalf("forced write failed: %s", result.Body)
	}

	if _, err := service.ResolveFile("public/../../secret.txt"); err == nil {
		t.Fatal("path traversal should be rejected")
	}
	if _, err := service.ResolveFile("public/assets/files/missing.png"); err == nil {
		t.Fatal("missing file should be rejected")
	}
}

func TestWorkspaceImportFile(t *testing.T) {
	service, root := newTestWorkspace(t)
	result := service.ImportFile("hello.txt", "aGVsbG8=", "public")
	if result.Status != 201 {
		t.Fatalf("import file: %s", result.Body)
	}
	var payload struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal([]byte(result.Body), &payload); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "public", "assets", "files", filepath.Base(payload.Path))); err != nil {
		t.Fatalf("imported file missing: %v", err)
	}
	url, err := service.FileURL(payload.Path)
	if err != nil {
		t.Fatalf("file url: %v", err)
	}
	if url == "" {
		t.Fatal("empty file url")
	}
}
