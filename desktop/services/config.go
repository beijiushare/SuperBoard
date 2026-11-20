package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type RecentWorkspace struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	LastOpened string `json:"lastOpened,omitempty"`
}

type Config struct {
	Workspace string            `json:"workspace"`
	Recent    []RecentWorkspace `json:"recent,omitempty"`
}

func samePath(a string, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

func rememberWorkspace(config *Config, root string) {
	if root == "" {
		return
	}
	entry := RecentWorkspace{
		Path:       root,
		Name:       filepath.Base(root),
		LastOpened: nowISO(),
	}
	next := []RecentWorkspace{entry}
	for _, item := range config.Recent {
		if samePath(item.Path, root) {
			continue
		}
		next = append(next, item)
		if len(next) >= 8 {
			break
		}
	}
	config.Recent = next
	config.Workspace = root
}

func configPath() string {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		return ""
	}
	return filepath.Join(dir, "SuperBoard", "config.json")
}

func loadConfig() Config {
	config := Config{}
	path := configPath()
	if path == "" {
		return config
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return config
	}
	_ = json.Unmarshal(data, &config)
	return config
}

func saveConfig(config Config) error {
	path := configPath()
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, data, 0o644); err != nil {
		return err
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		return err
	}
	return nil
}
