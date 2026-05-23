# DocCipher

DocCipher 是一个基于 Electron、React、Vite 和 TypeScript 的离线 Word `docx` 脱敏客户端。

## 开发

```bash
pnpm install
pnpm dev
```

使用 **AI 辅助识别** 前需拉取内置 llama 运行时（不提交到 Git，仅本机/CI 生成）：

```bash
pnpm fetch:llama-runtime
```

更新运行时可先删除 `buildResources/llama-runtime` 再执行上述命令。详见 [docs/ai-local-model.md](docs/ai-local-model.md)。

## 校验

```bash
pnpm typecheck
pnpm build
```

## 打包

Release 会为每个平台产出 **两个** 安装包（同一 `appId`，二选一安装）：

| 变体   | 文件名示例                             | 说明                              |
| ------ | -------------------------------------- | --------------------------------- |
| 精简版 | `DocCipher-{version}-mac-arm64.dmg`    | 规则扫描与脱敏，无本地 AI         |
| AI 版  | `DocCipher-{version}-mac-arm64-ai.dmg` | 含 llama 运行时，支持 AI 辅助识别 |

本地打包示例（macOS arm64）：

```bash
# 精简版
DOCIPHER_BUNDLE_LLAMA=0 pnpm gen:build-info && pnpm build
DOCIPHER_BUNDLE_LLAMA=0 pnpm exec electron-builder --config electron-builder.mjs --mac dmg zip --arm64

# AI 版（仅拉取当前平台运行时）
LLAMA_RUNTIME_PLATFORMS=darwin-arm64 pnpm fetch:llama-runtime
DOCIPHER_BUNDLE_LLAMA=1 pnpm gen:build-info && pnpm build
DOCIPHER_BUNDLE_LLAMA=1 LLAMA_RUNTIME_PLATFORMS=darwin-arm64 pnpm exec electron-builder --config electron-builder.mjs --mac dmg zip --arm64
```

## 说明

- 技术基线见 [docs/technical-baseline.md](docs/technical-baseline.md)。

- 产品与能力说明见 [docs/product-design.md](docs/product-design.md)、[docs/capability-guide.md](docs/capability-guide.md)。
