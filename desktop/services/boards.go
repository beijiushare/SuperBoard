package services

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

func parseCanvas(text string) (map[string]any, map[string]any, error) {
	var doc map[string]any
	if err := json.Unmarshal([]byte(text), &doc); err != nil {
		return nil, nil, errors.New("workspace.invalidJson")
	}
	meta := metaOf(doc)
	if meta == nil {
		return nil, nil, errors.New("workspace.missingMeta")
	}
	return doc, meta, nil
}

func metaOf(doc map[string]any) map[string]any {
	extra, ok := doc["x-superboard"].(map[string]any)
	if !ok {
		return nil
	}
	meta, ok := extra["meta"].(map[string]any)
	if !ok {
		return nil
	}
	return meta
}

func (s *WorkspaceService) scanBoards() ([]BoardRow, error) {
	rows := []BoardRow{}
	for _, scope := range []string{"public", "private"} {
		root, err := s.scopeDir(scope, false)
		if err != nil {
			continue
		}
		_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			name := entry.Name()
			if entry.IsDir() {
				if path != root && strings.HasPrefix(name, ".") {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(name, ".canvas") || strings.HasPrefix(name, ".") {
				return nil
			}
			data, readErr := os.ReadFile(path)
			if readErr != nil {
				return nil
			}
			_, meta, parseErr := parseCanvas(string(data))
			if parseErr != nil {
				return nil
			}
			rel, relErr := filepath.Rel(root, filepath.Dir(path))
			if relErr != nil || rel == "." {
				rel = ""
			}
			row := BoardRow{
				Slug:      stringValue(meta["slug"]),
				Title:     stringValue(meta["title"]),
				Summary:   stringValue(meta["summary"]),
				UpdatedAt: stringValue(meta["updatedAt"]),
				Path:      filepath.ToSlash(rel),
				Scope:     scope,
			}
			if order, ok := meta["order"].(float64); ok {
				row.Order = &order
			}
			if row.Slug != "" {
				rows = append(rows, row)
			}
			return nil
		})
	}
	return rows, nil
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func (s *WorkspaceService) ListBoards() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows, err := s.scanBoards()
	if err != nil {
		return fail(500, err.Error())
	}
	return ok(map[string]any{"canvases": rows})
}

func (s *WorkspaceService) boardLocation(scope string, slug string) (string, string, error) {
	root, err := s.scopeDir(scope, false)
	if err != nil {
		return "", "", err
	}
	var dir string
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil || dir != "" {
			return nil
		}
		if entry.IsDir() {
			if path != root && strings.HasPrefix(entry.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Name() == slug+".canvas" {
			dir = filepath.Dir(path)
		}
		return nil
	})
	if dir == "" {
		return "", "", errors.New("workspace.boardMissing")
	}
	return dir, filepath.Join(dir, slug+".canvas"), nil
}

func (s *WorkspaceService) ReadBoard(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(slug) && slug != "" {
		return fail(400, "workspace.badSlug")
	}
	_, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	data, err := os.ReadFile(file)
	if err != nil {
		return fail(404, err.Error())
	}
	s.versions[scope+"/"+slug] = string(data)
	return Result{Status: 200, Body: string(data)}
}

func (s *WorkspaceService) writeBoard(scope string, folder string, slug string, text string) error {
	if !slugPattern.MatchString(slug) {
		return errors.New("workspace.badSlug")
	}
	dir, err := s.folderDir(scope, folder, true)
	if err != nil {
		return err
	}
	target := filepath.Join(dir, slug+".canvas")
	var backup []byte
	if current, readErr := os.ReadFile(target); readErr == nil {
		backup = current
		_ = os.WriteFile(target+".bak", current, 0o644)
	}
	temp := filepath.Join(dir, "."+slug+".canvas.tmp")
	if err := os.WriteFile(temp, []byte(text), 0o644); err != nil {
		return err
	}
	if err := os.Rename(temp, target); err != nil {
		_ = os.Remove(temp)
		_ = os.Remove(target)
		if retry := os.WriteFile(target, []byte(text), 0o644); retry != nil {
			if backup != nil {
				_ = os.WriteFile(target, backup, 0o644)
			}
			return retry
		}
	}
	s.versions[scope+"/"+slug] = text
	return nil
}

func (s *WorkspaceService) WriteBoard(
	slug string,
	scope string,
	data string,
	force bool,
	historyInterval int,
	historyLimit int,
) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	current, err := os.ReadFile(file)
	if err != nil {
		return fail(404, err.Error())
	}
	text := string(current)
	key := scope + "/" + slug
	baseline, seen := s.versions[key]
	if !force && seen && baseline != text && data != text {
		return fail(409, "workspace.conflictOtherTab")
	}
	doc, meta, err := parseCanvas(data)
	if err != nil {
		return fail(400, err.Error())
	}
	if stringValue(meta["slug"]) != slug {
		return fail(409, "workspace.slugMismatch")
	}
	meta["updatedAt"] = nowISO()
	next, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	folder, relErr := filepath.Rel(mustScopeRoot(s, scope), dir)
	if relErr != nil || folder == "." {
		folder = ""
	}
	folder = filepath.ToSlash(folder)
	if err := s.writeBoard(scope, folder, slug, string(next)); err != nil {
		return fail(500, err.Error())
	}
	s.maybeSnapshot(scope, slug, string(next), historyInterval, historyLimit)
	return canvasOK(doc, meta, folder, scope)
}

func mustScopeRoot(s *WorkspaceService, scope string) string {
	root, err := s.scopeDir(scope, false)
	if err != nil {
		return s.root
	}
	return root
}

func (s *WorkspaceService) CreateBoard(title string, slug string, folder string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	title = strings.TrimSpace(title)
	if title == "" || !slugPattern.MatchString(slug) {
		return fail(400, "workspace.badParams")
	}
	if _, _, err := s.boardLocation(scope, slug); err == nil {
		return fail(409, "workspace.slugExists|"+slug)
	}
	parts, err := folderSegments(folder)
	if err != nil {
		return fail(400, err.Error())
	}
	doc := map[string]any{
		"nodes": []any{},
		"edges": []any{},
		"x-superboard": map[string]any{
			"version": 1,
			"meta": map[string]any{
				"title":     title,
				"slug":      slug,
				"updatedAt": nowISO(),
			},
		},
	}
	text, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	folderPath := joinedPath(parts)
	if err := s.writeBoard(scope, folderPath, slug, string(text)); err != nil {
		return fail(500, err.Error())
	}
	return created(map[string]any{
		"ok":     true,
		"canvas": doc,
		"path":   folderPath,
		"scope":  scope,
	})
}

func (s *WorkspaceService) UpdateBoard(slug string, scope string, title string, nextSlug string, folder string, summary string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slugPattern.MatchString(nextSlug) {
		return fail(400, "workspace.badSlug")
	}
	locationDir, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	current, err := os.ReadFile(file)
	if err != nil {
		return fail(404, err.Error())
	}
	doc, meta, err := parseCanvas(string(current))
	if err != nil {
		return fail(400, err.Error())
	}
	currentFolder, relErr := filepath.Rel(mustScopeRoot(s, scope), locationDir)
	if relErr != nil || currentFolder == "." {
		currentFolder = ""
	}
	currentFolder = filepath.ToSlash(currentFolder)
	parts, err := folderSegments(folder)
	if err != nil {
		return fail(400, err.Error())
	}
	nextFolder := joinedPath(parts)
	if nextSlug != slug || nextFolder != currentFolder {
		if _, _, err := s.boardLocation(scope, nextSlug); err == nil {
			if nextSlug != slug {
				return fail(409, "workspace.slugExists|"+nextSlug)
			}
		}
		if nextFolder != currentFolder {
			target, targetErr := s.folderDir(scope, nextFolder, false)
			if targetErr == nil {
				if _, statErr := os.Stat(filepath.Join(target, nextSlug+".canvas")); statErr == nil {
					return fail(409, "workspace.slugExists|"+nextSlug)
				}
			}
		}
	}
	meta["title"] = chooseString(title, stringValue(meta["title"]))
	meta["slug"] = nextSlug
	if summary != "" {
		meta["summary"] = summary
	}
	meta["updatedAt"] = nowISO()
	next, err := json.Marshal(doc)
	if err != nil {
		return fail(500, err.Error())
	}
	if err := s.writeBoard(scope, nextFolder, nextSlug, string(next)); err != nil {
		return fail(500, err.Error())
	}
	if nextSlug != slug {
		s.moveSlugHistory(scope, slug, nextSlug)
	}
	if nextSlug != slug || nextFolder != currentFolder {
		_ = os.Remove(file)
		delete(s.versions, scope+"/"+slug)
	}
	return canvasOK(doc, meta, nextFolder, scope)
}

func chooseString(next string, fallback string) string {
	next = strings.TrimSpace(next)
	if next == "" {
		return fallback
	}
	return next
}

func (s *WorkspaceService) DeleteBoard(slug string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, file, err := s.boardLocation(scope, slug)
	if err != nil {
		return fail(404, err.Error())
	}
	if err := os.Remove(file); err != nil {
		return fail(500, err.Error())
	}
	s.removeSlugHistory(scope, slug)
	delete(s.versions, scope+"/"+slug)
	return simpleOK()
}
