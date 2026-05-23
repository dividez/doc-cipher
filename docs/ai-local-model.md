# 本地 AI 辅助脱敏

> **安装包**：仅 **AI 版**（Release 资产名带 `-ai` 后缀）内置 llama 运行时与设置页「本地 AI 模型」。**精简版**无 AI 能力，界面不展示相关入口。

## 脱敏任务流程

1. **配置**（脱敏页）：选择 docx、脱敏方案、划词备选词；在设置页下载模型并在卡片上点「设为当前」。
2. **扫描文档**：规则、方案/系统关键词、备选词命中统计，不改写文件。
3. **AI 辅助识别**（可选）：点击按钮即开始，按钮下显示窗口进度，可取消；敏感词写入备选列表。
4. **开始脱敏**：填写还原密码后执行；按识别快照写 masked.docx 与 restore.enc（不再调用 llama）。

## 多模型

- 在 **设置 → 本地 AI 模型** 可下载多个模型；已安装卡片上点 **设为当前** 选定当前模型（`active_model_id`），状态保存在 `model-state.json`。
- 脱敏页不选择模型，仅使用设置页当前使用项。

## 开发环境：llama 运行时

AI 识别除 GGUF 外还需要 **llama-server** 二进制。开发时若未打包进应用，需先执行：

```bash
pnpm fetch:llama-runtime
```

将 `llama-server` 与依赖库（`.dylib` / `.dll`）放入 `buildResources/llama-runtime/<平台>/`；macOS 会创建 `@rpath` 符号链接。更新时建议 `rm -rf buildResources/llama-runtime` 后重新执行。默认 tag `b9277`，可用 `LLAMA_RELEASE_TAG` 覆盖。

仅拉取当前平台（打包 AI 版时推荐）：

```bash
LLAMA_RUNTIME_PLATFORMS=darwin-arm64 pnpm fetch:llama-runtime
# 或 LLAMA_RUNTIME_ONLY=1（按 Node 所在 OS/arch 自动选择）
```

编译期开关 `DOCIPHER_BUNDLE_LLAMA=1` 时应用内 `BUILD_INFO.features.localAi` 为 true（`pnpm dev` 默认已启用）。

## IPC

| Channel                  | 说明                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `docx:recognize-matches` | 扫描（`useLocalAi: false`）或 AI 补充（`aiSupplementOnly: true`） |
| `docx:mask`              | 正式脱敏（`recognizedHits` 快照）                                 |
| `ai:estimate-inference`  | 推理耗时预估                                                      |
| `ai:cancel-mask`         | 取消 AI 识别                                                      |
| `ai:set-active-model`    | 设置页切换当前使用模型                                            |
| `ai:mask-progress`       | `phase: recognize \| mask`                                        |

## 设置

`app.ai_assist.confidence_threshold` 控制 AI 置信度阈值。
