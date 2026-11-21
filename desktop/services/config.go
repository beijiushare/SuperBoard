package services

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type RecentWorkspace struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	LastOpened string `json:"lastOpened,omitempty"`
}

type Config struct {
	Workspace string            `json:"workspace"`
	Language  string            `json:"language,omitempty"`
	Recent    []RecentWorkspace `json:"recent,omitempty"`
}

func samePath(a string, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

// uiText returns the localized UI string for native dialogs based on the
// persisted language preference.
func uiText(zh string, en string) string {
	if loadConfig().Language == "en-US" {
		return en
	}
	return zh
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

var (
	configPathOnce  sync.Once
	configPathValue string
)

func configPath() string {
	configPathOnce.Do(func() {
		configPathValue = resolveConfigPath()
		if configPathValue != "" {
			log.Printf("[config] using %s", configPathValue)
		}
	})
	return configPathValue
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// resolveConfigPath prefers a portable config next to the executable. When the
// executable directory is read-only it falls back to the per-user config
// directory.
func resolveConfigPath() string {
	var exeConfig string
	if exe, err := os.Executable(); err == nil {
		exeConfig = filepath.Join(filepath.Dir(exe), "config.json")
	}
	if exeConfig != "" && fileExists(exeConfig) {
		return exeConfig
	}

	userDir, err := os.UserConfigDir()
	if err != nil || userDir == "" {
		userDir = ""
	}
	userConfig := ""
	if userDir != "" {
		userConfig = filepath.Join(userDir, "SuperBoard", "config.json")
		if fileExists(userConfig) {
			return userConfig
		}
	}

	if exeConfig != "" {
		if err := os.WriteFile(exeConfig, []byte("{}\n"), 0o644); err == nil {
			return exeConfig
		}
	}
	return userConfig
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
