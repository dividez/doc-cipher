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
