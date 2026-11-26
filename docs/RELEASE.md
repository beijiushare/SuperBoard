# 发布

## 版本来源

`package.json` 的 `version` 是唯一来源。`npm run sync:version` 会同步到：

- `desktop/build/config.yml`
- `desktop/build/windows/info.json`
- `desktop/version.go`（`appVersion`，桌面端版本比较用）

tag 使用 `v` 前缀（如 `v0.4.0`），应用内版本不带前缀。

## 步骤

1. 修改 `package.json` 的版本号（`npm version <x.y.z> --no-git-tag-version`）；
2. 打包并构建桌面端：

   ```bash
   npm run release:desktop
   ```

   产物在 `dist/release/`：

   - `SuperBoard-<version>-windows-amd64.exe`
   - `SHA256SUMS`

3. 本地启动产物确认能打开；
4. 提交版本号，推送 `master`；
5. 发布 GitHub Release：

   ```bash
   node scripts/release-desktop.mjs --publish --skip-build --notes-file <notes.md>
   ```

   等价于：

   ```bash
   gh release create v<version> \
     --title "SuperBoard <version>" \
     --notes "..." \
     dist/release/SuperBoard-<version>-windows-amd64.exe \
     dist/release/SHA256SUMS
   ```

   `npm run release:desktop:publish -- ...` 在部分 npm 版本上会把参数当作自己的配置解析；直接调用脚本更稳。

6. 用旧版本验证「检查更新」（见下）。

## 检查更新的行为

桌面端只负责**发现新版本**，不自动下载或替换：

- 只读取 GitHub 的 **latest 正式 Release**；draft / prerelease 不参与；
- 资产按 `windows` + `amd64` 匹配，文件名必须同时包含这两个词；
- 设置页显示版本、大小和发布说明，提供「手动下载」与「定位路径」；
- 用户退出应用后，用新 exe 替换同目录下的旧文件；
- `SHA256SUMS` 供手动校验，不做代码签名。

自动安装曾经存在，因下载失败和替换时机问题已移除。

## 验证

1. 把上一个版本的 exe 放到可写目录，例如 `D:\Apps\SuperBoard\superboard.exe`；
2. 启动后进入 设置 → 版本 → 检查更新；
3. 确认显示新版本、大小和发布说明；
4. 点「手动下载」应打开 Releases 页面；点「定位路径」应打开 exe 所在目录并选中 exe；
5. 按提示退出、替换、重新启动，版本号应更新。

测试用的临时 Release 可以删除：

```bash
gh release delete v<version> --yes
```

## 注意

- 绿色版不要放在 `C:\Program Files`、`C:\Windows` 等需要管理员权限的位置；
- 未做 Authenticode 签名，Windows 可能提示未知发布者；
- 全量下载，没有增量包；
- 版本号未变时不要重复发布同一个 tag。
