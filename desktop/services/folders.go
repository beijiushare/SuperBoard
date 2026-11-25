package services

import (
	"os"
	"path/filepath"
	"strings"
)

func (s *WorkspaceService) ListFolders() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := []FolderRow{}
	for _, scope := range []string{"public", "private"} {
		root, err := s.scopeDir(scope, false)
		if err != nil {
			continue
		}
		_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil || !entry.IsDir() {
				return nil
			}
			if path == root {
				return nil
			}
			if strings.HasPrefix(entry.Name(), ".") {
				return filepath.SkipDir
			}
			rel, relErr := filepath.Rel(root, path)
			if relErr != nil {
				return nil
			}
			rows = append(rows, FolderRow{Path: filepath.ToSlash(rel), Scope: scope})
			return nil
		})
	}
	return ok(map[string]any{"folders": rows})
}

func (s *WorkspaceService) CreateFolder(parent string, name string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\`) || invalidParts.MatchString(name) {
		return fail(400, "workspace.badFolderName")
	}
	dir, err := s.folderDir(scope, parent, true)
	if err != nil {
		return fail(400, err.Error())
	}
	if err := os.MkdirAll(filepath.Join(dir, name), 0o755); err != nil {
		return fail(500, err.Error())
	}
	parentParts, _ := folderSegments(parent)
	return created(map[string]any{
		"ok":   true,
		"path": joinedPath(append(parentParts, name)),
	})
}

func (s *WorkspaceService) UpdateFolder(folderPath string, name string, parent string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	sourceParts, err := folderSegments(folderPath)
	if err != nil || len(sourceParts) == 0 {
		return fail(400, "workspace.badParams")
	}
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsAny(name, `/\`) || invalidParts.MatchString(name) {
		return fail(400, "workspace.badFolderName")
	}
	currentParent := joinedPath(sourceParts[:len(sourceParts)-1])
	if strings.TrimSpace(parent) == "" && currentParent != "" {
		parent = currentParent
	}
	parentParts, err := folderSegments(parent)
	if err != nil {
		return fail(400, err.Error())
	}
	sourcePath := joinedPath(sourceParts)
	targetParentPath := joinedPath(parentParts)
	if targetParentPath == sourcePath || strings.HasPrefix(targetParentPath, sourcePath+"/") {
		return fail(400, "workspace.moveIntoSelf")
	}
	if targetParentPath == currentParent && name == sourceParts[len(sourceParts)-1] {
		return simplePath(sourcePath)
	}
	sourceRoot, err := s.folderDir(scope, currentParent, false)
	if err != nil {
		return fail(400, err.Error())
	}
	source := filepath.Join(sourceRoot, sourceParts[len(sourceParts)-1])
	targetRoot, err := s.folderDir(scope, targetParentPath, true)
	if err != nil {
		return fail(400, err.Error())
	}
	target := filepath.Join(targetRoot, name)
	if _, statErr := os.Stat(target); statErr == nil {
		return fail(409, "workspace.folderExists|"+name)
	}
	if err := os.Rename(source, target); err != nil {
		return fail(500, err.Error())
	}
	s.invalidateVersions()
	return simplePath(joinedPath(append(parentParts, name)))
}

func (s *WorkspaceService) DeleteFolder(folderPath string, scope string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	parts, err := folderSegments(folderPath)
	if err != nil || len(parts) == 0 {
		return fail(400, "workspace.deleteRoot")
	}
	dir, err := s.folderDir(scope, folderPath, false)
	if err != nil {
		return fail(400, err.Error())
	}
	s.removeFolderHistory(scope, dir)
	if err := os.RemoveAll(dir); err != nil {
		return fail(500, err.Error())
	}
	s.invalidateVersions()
	return simpleOK()
}
