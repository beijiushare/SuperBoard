package services

import (
	"os"
	"path/filepath"
)

func (s *WorkspaceService) RecentWorkspaces() Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	config := loadConfig()
	if config.Workspace != "" {
		found := false
		for _, item := range config.Recent {
			if samePath(item.Path, config.Workspace) {
				found = true
				break
			}
		}
		if !found {
			config.Recent = append([]RecentWorkspace{{
				Path:       config.Workspace,
				Name:       filepath.Base(config.Workspace),
				LastOpened: nowISO(),
			}}, config.Recent...)
		}
	}
	rows := make([]map[string]any, 0, len(config.Recent))
	kept := make([]RecentWorkspace, 0, len(config.Recent))
	for _, item := range config.Recent {
		info, err := os.Stat(item.Path)
		if err != nil || !info.IsDir() || !looksLikeWorkspace(item.Path) {
			continue
		}
		kept = append(kept, item)
		rows = append(rows, map[string]any{
			"path":       item.Path,
			"name":       item.Name,
			"lastOpened": item.LastOpened,
			"available":  true,
		})
	}
	if len(kept) != len(config.Recent) {
		config.Recent = kept
		if config.Workspace != "" {
			if info, err := os.Stat(config.Workspace); err != nil || !info.IsDir() {
				config.Workspace = ""
			}
		}
		_ = saveConfig(config)
	}
	return ok(map[string]any{"recent": rows})
}

func (s *WorkspaceService) ForgetWorkspace(path string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()
	if path == "" {
		return fail(400, "workspace.emptyPath")
	}
	config := loadConfig()
	next := make([]RecentWorkspace, 0, len(config.Recent))
	for _, item := range config.Recent {
		if !samePath(item.Path, path) {
			next = append(next, item)
		}
	}
	config.Recent = next
	if samePath(config.Workspace, path) {
		config.Workspace = ""
	}
	if err := saveConfig(config); err != nil {
		return fail(500, err.Error())
	}
	return simpleOK()
}
