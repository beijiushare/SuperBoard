package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readCanvasText(t *testing.T, service *WorkspaceService, slug string) string {
	t.Helper()
	result := service.ReadBoard(slug, "public")
	if result.Status != 200 {
		t.Fatalf("read board: %d %s", result.Status, result.Body)
	}
	return result.Body
}

func writeCanvasText(t *testing.T, service *WorkspaceService, slug string, text string, interval int, limit int) {
	t.Helper()
	if result := service.WriteBoard(slug, "public", text, true, interval, limit); result.Status != 200 {
		t.Fatalf("write board: %d %s", result.Status, result.Body)
	}
}

func listHistory(t *testing.T, service *WorkspaceService, slug string) []HistoryEntry {
	t.Helper()
	result := service.ListBoardHistory(slug, "public")
	if result.Status != 200 {
		t.Fatalf("list history: %d %s", result.Status, result.Body)
	}
	var payload struct {
		Entries []HistoryEntry `json:"entries"`
	}
	if err := json.Unmarshal([]byte(result.Body), &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Entries
}

func TestHistorySnapshotsFollowTheInterval(t *testing.T) {
	service, _ := newTestWorkspace(t)
	if result := service.CreateBoard("Board", "board", "", "public"); result.Status != 201 {
		t.Fatalf("create board: %s", result.Body)
	}

	base := readCanvasText(t, service, "board")
	writeCanvasText(t, service, "board", base, 300, 3)
	if entries := listHistory(t, service, "board"); len(entries) != 1 {
		t.Fatalf("first save should create one entry, got %d", len(entries))
	}

	// The newest entry already holds this content, so nothing is added.
	writeCanvasText(t, service, "board", base, 300, 3)
	if entries := listHistory(t, service, "board"); len(entries) != 1 {
		t.Fatalf("identical content should not add an entry, got %d", len(entries))
	}

	// A different content inside the interval is deferred.
	var doc map[string]any
	if err := json.Unmarshal([]byte(base), &doc); err != nil {
		t.Fatal(err)
	}
	doc["nodes"] = []any{
		map[string]any{"id": "n1", "type": "text", "text": "second", "x": 0, "y": 0, "width": 100, "height": 40},
	}
	next, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	writeCanvasText(t, service, "board", string(next), 300, 3)
	if entries := listHistory(t, service, "board"); len(entries) != 1 {
		t.Fatalf("interval should defer the snapshot, got %d", len(entries))
	}

	// Disabling history stops new entries.
	writeCanvasText(t, service, "board", base, 0, 3)
	if entries := listHistory(t, service, "board"); len(entries) != 1 {
		t.Fatalf("disabled history should not add an entry, got %d", len(entries))
	}
}

func TestHistoryRestoreRenamesAndDeletes(t *testing.T) {
	service, root := newTestWorkspace(t)
	if result := service.CreateBoard("Board", "board", "", "public"); result.Status != 201 {
		t.Fatalf("create board: %s", result.Body)
	}

	base := readCanvasText(t, service, "board")
	var doc map[string]any
	if err := json.Unmarshal([]byte(base), &doc); err != nil {
		t.Fatal(err)
	}
	doc["nodes"] = []any{
		map[string]any{"id": "n1", "type": "text", "text": "one", "x": 0, "y": 0, "width": 100, "height": 40},
	}
	one, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	writeCanvasText(t, service, "board", string(one), 300, 3)
	entries := listHistory(t, service, "board")
	if len(entries) != 1 {
		t.Fatalf("expected one history entry, got %d", len(entries))
	}

	doc["nodes"] = []any{
		map[string]any{"id": "n1", "type": "text", "text": "two", "x": 0, "y": 0, "width": 100, "height": 40},
	}
	two, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	writeCanvasText(t, service, "board", string(two), 300, 3)

	if result := service.RestoreBoardHistory("board", entries[0].ID, "public", 3); result.Status != 200 {
		t.Fatalf("restore: %d %s", result.Status, result.Body)
	}
	restored := readCanvasText(t, service, "board")
	if !strings.Contains(restored, `"one"`) {
		t.Fatalf("expected restored content, got %s", restored)
	}
	if entries := listHistory(t, service, "board"); len(entries) != 2 {
		t.Fatalf("restore should keep the replaced version, got %d entries", len(entries))
	}

	if result := service.UpdateBoard("board", "public", "Board", "renamed", "", ""); result.Status != 200 {
		t.Fatalf("rename: %d %s", result.Status, result.Body)
	}
	if _, err := os.Stat(filepath.Join(root, ".superboard", "history", "public", "renamed")); err != nil {
		t.Fatalf("history should follow the rename: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, ".superboard", "history", "public", "board")); !os.IsNotExist(err) {
		t.Fatal("old history folder should be gone")
	}

	if result := service.DeleteBoard("renamed", "public"); result.Status != 200 {
		t.Fatalf("delete: %d %s", result.Status, result.Body)
	}
	if _, err := os.Stat(filepath.Join(root, ".superboard", "history", "public", "renamed")); !os.IsNotExist(err) {
		t.Fatal("history should be removed with the board")
	}
}

func TestHistoryTrimsToLimit(t *testing.T) {
	service, _ := newTestWorkspace(t)
	if result := service.CreateBoard("Board", "board", "", "public"); result.Status != 201 {
		t.Fatalf("create board: %s", result.Body)
	}
	dir := service.historyDir("public", "board")
	for index := 0; index < 6; index++ {
		if err := service.appendHistory(dir, fmt.Sprintf(`{"n":%d}`, index), 3); err != nil {
			t.Fatal(err)
		}
	}
	if entries := listHistory(t, service, "board"); len(entries) != 3 {
		t.Fatalf("expected 3 entries after trim, got %d", len(entries))
	}
}

func TestHistoryRejectsMismatchedEntry(t *testing.T) {
	service, _ := newTestWorkspace(t)
	if result := service.CreateBoard("Board", "board", "", "public"); result.Status != 201 {
		t.Fatalf("create board: %s", result.Body)
	}
	base := readCanvasText(t, service, "board")
	writeCanvasText(t, service, "board", base, 300, 3)
	entries := listHistory(t, service, "board")
	if len(entries) == 0 {
		t.Fatal("expected a history entry")
	}
	if result := service.RestoreBoardHistory("board", "../oops", "public", 3); result.Status != 400 {
		t.Fatalf("invalid id should be rejected, got %d", result.Status)
	}
}
