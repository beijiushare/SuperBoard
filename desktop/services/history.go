package services

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// History entries are timestamped full copies of a board. The filename carries
// the creation time and a content hash so listing does not need an index and
// dedupe can compare filenames.
const (
	historyMaxBytes  = 2 * 1024 * 1024
	historyMaxCount  = 1000
	historyEntryName = `^\d{13}-[a-f0-9]{10}$`
)

var historyEntryPattern = regexp.MustCompile(historyEntryName)

type HistoryEntry struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	Size      int64  `json:"size"`
}

func (e HistoryEntry) timestamp() int64 {
	value, _ := strconv.ParseInt(e.ID[:13], 10, 64)
	return value
}

func (e HistoryEntry) hash() string {
	if index := strings.LastIndex(e.ID, "-"); index >= 0 {
		return e.ID[index+1:]
	}
	return ""
}

func contentHash(text string) string {
	sum := sha1.Sum([]byte(text))
	return hex.EncodeToString(sum[:])[:10]
}

func (s *WorkspaceService) historyRoot() string {
	return filepath.Join(s.root, ".superboard", "history")
}

func (s *WorkspaceService) historyDir(scope string, slug string) string {
	return filepath.Join(s.historyRoot(), scope, slug)
}

func listHistoryEntries(dir string) ([]HistoryEntry, int64) {
	entries := []HistoryEntry{}
	var total int64
	items, err := os.ReadDir(dir)
	if err != nil {
		return entries, 0
	}
	for _, item := range items {
		if item.IsDir() {
			continue
		}
		name := item.Name()
		if !strings.HasSuffix(name, ".canvas") {
			continue
		}
		id := strings.TrimSuffix(name, ".canvas")
		if !historyEntryPattern.MatchString(id) {
			continue
		}
		info, err := item.Info()
		if err != nil {
			continue
		}
		millis, err := strconv.ParseInt(id[:13], 10, 64)
		if err != nil {
			continue
		}
		entries = append(entries, HistoryEntry{
			ID: id,
			CreatedAt: time.UnixMilli(millis).
				UTC().
				Format("2006-01-02T15:04:05.000Z"),
			Size: info.Size(),
		})
		total += info.Size()
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].ID > entries[j].ID
	})
	return entries, total
}

func trimHistory(dir string, limit int) {
	if limit <= 0 {
		return
	}
	if limit > historyMaxCount {
		limit = historyMaxCount
	}
	entries, _ := listHistoryEntries(dir)
	if len(entries) <= limit {
		return
	}
	for _, entry := range entries[limit:] {
		_ = os.Remove(filepath.Join(dir, entry.ID+".canvas"))
	}
}

// appendHistory writes one entry. Callers hold the workspace lock.
func (s *WorkspaceService) appendHistory(
	dir string,
	text string,
	limit int,
) error {
	if len(text) > historyMaxBytes {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	millis := time.Now().UnixMilli()
	hash := contentHash(text)
	for attempt := 0; attempt < 1000; attempt++ {
		name := fmt.Sprintf("%013d-%s.canvas", millis+int64(attempt), hash)
		target := filepath.Join(dir, name)
		if _, err := os.Stat(target); err == nil {
			continue
		}
		temp := filepath.Join(dir, "."+name+".tmp")
		if err := os.WriteFile(temp, []byte(text), 0o644); err != nil {
			return err
		}
		if err := os.Rename(temp, target); err != nil {
			_ = os.Remove(temp)
			return err
		}
		trimHistory(dir, limit)
		return nil
	}
	return fmt.Errorf("workspace.historyNameFailed")
}

func writeFileAtomic(path string, data []byte) error {
	temp := filepath.Join(
		filepath.Dir(path),
		"."+filepath.Base(path)+".tmp",
	)
	if err := os.WriteFile(temp, data, 0o644); err != nil {
		return err
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		return err
	}
	return nil
}

// maybeSnapshot samples saved content: first save after a change, then at most
// once per interval. Identical content is skipped via the hash in the name.
func (s *WorkspaceService) maybeSnapshot(
	scope string,
	slug string,
	text string,
	intervalSeconds int,
	limit int,
) {
	if intervalSeconds <= 0 || limit <= 0 || len(text) > historyMaxBytes {
		return
	}
	dir := s.historyDir(scope, slug)
	entries, _ := listHistoryEntries(dir)
	hash := contentHash(text)
	if len(entries) > 0 {
		newest := entries[0]
		if newest.hash() == hash {
			return
		}
		if time.Since(time.UnixMilli(newest.timestamp())) <
			time.Duration(intervalSeconds)*time.Second {
			return
		}
	}
	_ = s.appendHistory(dir, text, limit)
}

func (s *WorkspaceService) removeSlugHistory(scope string, slug string) {
	_ = os.RemoveAll(s.historyDir(scope, slug))
}

func (s *WorkspaceService) moveSlugHistory(
	scope string,
	from string,
	to string,
) {
	if from == to {
		return
	}
	source := s.historyDir(scope, from)
	target := s.historyDir(scope, to)
	if _, err := os.Stat(source); err != nil {
		return
	}
	_ = os.RemoveAll(target)
	_ = os.MkdirAll(filepath.Dir(target), 0o755)
	_ = os.Rename(source, target)
}

// removeFolderHistory drops the history of every board inside a folder that is
// about to be deleted.
func (s *WorkspaceService) removeFolderHistory(scope string, dir string) {
	_ = filepath.WalkDir(dir, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".canvas") {
			return nil
		}
		slug := strings.TrimSuffix(name, ".canvas")
		if slugPattern.MatchString(slug) {
			s.removeSlugHistory(scope, slug)
		}
		return nil
	})
}

func (s *WorkspaceService) ListBoardHistory(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) || !isScope(scope) {
		return fail(400, "workspace.badParams")
	}
	entries, total := listHistoryEntries(s.historyDir(scope, slug))
	return ok(map[string]any{"entries": entries, "totalSize": total})
}

func (s *WorkspaceService) ReadBoardHistory(
	slug string,
	id string,
	scope string,
) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) || !isScope(scope) ||
		!historyEntryPattern.MatchString(id) {
		return fail(400, "workspace.badParams")
	}
	raw, err := os.ReadFile(
		filepath.Join(s.historyDir(scope, slug), id+".canvas"),
	)
	if err != nil {
		return fail(404, "workspace.historyMissing")
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return fail(400, "workspace.invalidJson")
	}
	meta := metaOf(doc)
	if meta == nil || stringValue(meta["slug"]) != slug {
		return fail(400, "workspace.historyMismatch")
	}
	return ok(doc)
}

func (s *WorkspaceService) RestoreBoardHistory(
	slug string,
	id string,
	scope string,
	limit int,
) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) || !isScope(scope) ||
		!historyEntryPattern.MatchString(id) {
		return fail(400, "workspace.badParams")
	}
	dir := s.historyDir(scope, slug)
	raw, err := os.ReadFile(filepath.Join(dir, id+".canvas"))
	if err != nil {
		return fail(404, "workspace.historyMissing")
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return fail(400, "workspace.invalidJson")
	}
	meta := metaOf(doc)
	if meta == nil || stringValue(meta["slug"]) != slug {
		return fail(400, "workspace.historyMismatch")
	}
	_, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	current, readErr := os.ReadFile(file)
	if readErr == nil {
		// Keep the version being replaced so a restore can itself be undone.
		_ = s.appendHistory(dir, string(current), limit)
	}
	meta["updatedAt"] = nowISO()
	next, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	if err := writeFileAtomic(file, next); err != nil {
		return fail(500, err.Error())
	}
	s.versions[scope+"/"+slug] = string(next)
	return ok(map[string]any{"ok": true, "canvas": doc})
}

func (s *WorkspaceService) ClearBoardHistory(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) || !isScope(scope) {
		return fail(400, "workspace.badParams")
	}
	if err := os.RemoveAll(s.historyDir(scope, slug)); err != nil {
		return fail(500, err.Error())
	}
	return simpleOK()
}

func (s *WorkspaceService) HistoryStats() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	var total int64
	count := 0
	root := s.historyRoot()
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		if !strings.HasSuffix(entry.Name(), ".canvas") {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return nil
		}
		total += info.Size()
		count++
		return nil
	})
	return ok(map[string]any{"totalSize": total, "count": count})
}

func (s *WorkspaceService) ClearAllHistory() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.RemoveAll(s.historyRoot()); err != nil {
		return fail(500, err.Error())
	}
	return simpleOK()
}
