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

// nativeTexts holds the titles used by OS dialogs. One entry per key and
// language; adding a language here does not require touching call sites.
var nativeTexts = map[string]map[string]string{
	"workspace.select": {
		"zh-CN": "选择 SuperBoard 工作区",
		"zh-TW": "選擇 SuperBoard 工作區",
		"en-US": "Select SuperBoard workspace",
		"ja-JP": "SuperBoard ワークスペースを選択",
		"ko-KR": "SuperBoard 작업 공간 선택",
	},
	"export.html": {
		"zh-CN": "导出 HTML",
		"zh-TW": "匯出 HTML",
		"en-US": "Export HTML",
		"ja-JP": "HTML をエクスポート",
		"ko-KR": "HTML 내보내기",
	},
	"export.folder": {
		"zh-CN": "选择导出目录",
		"zh-TW": "選擇匯出目錄",
		"en-US": "Choose export folder",
		"ja-JP": "エクスポート先フォルダーを選択",
		"ko-KR": "내보낼 폴더 선택",
	},
	"files.insert": {
		"zh-CN": "选择要插入的文件",
		"zh-TW": "選擇要插入的檔案",
		"en-US": "Choose files to insert",
		"ja-JP": "挿入するファイルを選択",
		"ko-KR": "삽입할 파일 선택",
	},
	"sample.copy": {
		"zh-CN": "选择示例复制位置",
		"zh-TW": "選擇範例複製位置",
		"en-US": "Choose where to copy the sample",
		"ja-JP": "サンプルのコピー先を選択",
		"ko-KR": "샘플을 복사할 위치 선택",
	},
}

// uiText returns the native dialog string for the persisted language. Unknown
// locales fall back to their base language before zh-CN.
func uiText(key string) string {
	values, ok := nativeTexts[key]
	if !ok {
		return key
	}
	lang := loadConfig().Language
	if text, found := values[lang]; found {
		return text
	}
	switch {
	case strings.HasPrefix(lang, "zh"):
		if text, found := values["zh-CN"]; found {
			return text
		}
	case strings.HasPrefix(lang, "en"):
		if text, found := values["en-US"]; found {
			return text
		}
	case strings.HasPrefix(lang, "ja"):
		if text, found := values["ja-JP"]; found {
			return text
		}
	case strings.HasPrefix(lang, "ko"):
		if text, found := values["ko-KR"]; found {
			return text
		}
	}
	if text, found := values["zh-CN"]; found {
		return text
	}
	return key
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
