# 桌面端发布

## 版本来源

`package.json` 的 `version` 是唯一来源。`npm run sync:version` 会把它同步到：

- `desktop/build/config.yml`
- `desktop/build/windows/info.json`
- `desktop/version.go`（Go 里的 `appVersion`，更新器用它比较版本）

tag 使用 `v` 前缀（`v0.2.0`），应用内版本不带前缀（`0.2.0`）。

## 发布步骤

1. 修改 `package.json` 的版本号，例如 `0.2.0`；
2. 打包（会自动构建桌面端）：

   ```bash
   npm run release:desktop
   ```

   产物在 `dist/release/`：

   - `SuperBoard-0.2.0-windows-amd64.exe`
   - `SHA256SUMS`

3. 本地验证产物可以启动；
4. 发布到 GitHub Releases：

   ```bash
   npm run release:desktop:publish -- --skip-build
   ```

   等价于：

   ```bash
   gh release create v0.2.0 \
     --title "SuperBoard 0.2.0" \
     --notes "..." \
     dist/release/SuperBoard-0.2.0-windows-amd64.exe \
     dist/release/SHA256SUMS
   ```

5. 用旧版本验证更新流程（见下）。

## 更新器行为

- 只读取 GitHub 的 **latest 正式 release**；draft 和 prerelease 不会被发现；
- 资产按 `windows` + `amd64` 匹配，所以文件名必须包含这两个词；
- 校验使用同 release 的 `SHA256SUMS`（digest-only，不做签名）；
- 下载包暂存在 exe 同目录的 `wails-update-*`，替换后自动重启；
- 如果 exe 所在目录不可写，设置页会禁用「检查更新」，只保留「手动下载」。

## 验证更新

1. 把上一个版本的 exe 复制到可写目录，例如 `D:\Apps\SuperBoard\superboard.exe`；
2. 启动它：设置 → 关于 → 检查更新；
3. 应显示新版本、大小和发布说明；
4. 点「立即更新」→ 下载 → 校验 → 替换 → 自动重启；
5. 重启后版本号应变为新版本。

测试用的临时 release 可以删除：

```bash
gh release delete v0.2.0 --yes
```

## 注意事项

- 绿色版：不要放在 `C:\Program Files`、`C:\Windows` 等需要管理员权限的位置；
- exe 未做 Authenticode 签名，Windows 可能提示未知发布者；
- 更新为全量下载，没有增量包；
- 目录可写检测是实际创建临时文件，不是猜测路径。
