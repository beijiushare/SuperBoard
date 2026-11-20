package services

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	Workspace string `json:"workspace"`
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
