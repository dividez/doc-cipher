# DocCipher

DocCipher 是一个基于 Electron、React、Vite 和 TypeScript 的离线 Word `docx` 脱敏客户端。

当前初始化基线包含：

- Electron 主进程、preload、renderer 隔离架构
- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- `window.localApi` 白名单 IPC
- 正则、关键词、手动项规则 schema
- `docx` OOXML 段落级聚合匹配与 token 替换
- 独立 `restore.enc` AES-256-GCM 加密映射文件
- 还原前 masked docx SHA-256 指纹校验
- 本地 `setting.json` 与 `electron-log` 日志
- shadcn 风格桌面工作台 UI

## 开发

```bash
pnpm install
pnpm dev
```

## 校验

```bash
pnpm typecheck
pnpm build
```

## 打包

```bash
pnpm compile
```

## GitHub Release 打包

发布 GitHub Release 后会自动触发 `.github/workflows/release.yml`，并上传以下安装包到当前 Release：

- Windows x64: `nsis` installer + `zip`
- macOS x64: `dmg` + `zip`
- macOS arm64: `dmg` + `zip`

Release tag 建议使用语义化版本，例如：

```txt
v0.1.0
```

流水线会把 tag 中的版本号同步到打包产物版本。首次发布的是未签名安装包；后续如果要接入 Apple Developer ID 或 Windows 代码签名，再补充对应 GitHub Secrets 和 electron-builder 签名配置。

## 目录

```txt
packages/
├── main/
│   └── src/
│       ├── ipc/
│       └── services/
├── preload/
├── renderer/
└── shared/
```

技术基线见 [docs/technical-baseline.md](docs/technical-baseline.md)。
