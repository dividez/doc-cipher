# 本地 AI 辅助脱敏（第一期）

## 架构

- 安装包内置 **llama.cpp `llama-server`**（按平台），**不包含** GGUF 模型。
- 用户从 manifest 下载推荐模型到 `{userDataDir}/doc-cipher/models/{modelId}/`。
- 脱敏时 AI 仅识别敏感实体 span，与规则命中合并后走现有 token + `restore.enc` 流程。

## 目录

| 路径                                                | 说明               |
| --------------------------------------------------- | ------------------ |
| `{userDataDir}/doc-cipher/models/{id}/model.gguf`   | 模型权重           |
| `{userDataDir}/doc-cipher/models/{id}/model.json`   | 安装元数据         |
| `{userDataDir}/doc-cipher/model-state.json`         | 本地注册与下载状态 |
| `{userDataDir}/doc-cipher/downloads/*.part`         | 断点续传临时文件   |
| `{resources}/llama-runtime/{platform}/llama-server` | 内置运行时         |

## Manifest

模型清单**仅本地加载**：开发时读 `buildResources/default-model-manifest.json`，安装后读应用包内 `resources/default-model-manifest.json`（由 electron-builder `extraResources` 打入）。不请求远程 URL。

字段：`id`, `name`, `download_url`（**GGUF 直链**）, `size_bytes`, `sha256`（可选）, `recommended`, `tier`（`light` / `balanced` / `quality`）, `hardware`（CPU/内存/磁盘/GPU 说明）。

### 默认模型列表

| ID                         | 定位          | 体积约  | 最低内存 |
| -------------------------- | ------------- | ------- | -------- |
| `qwen2.5-1.5b-instruct-q4` | 推荐 / 均衡   | ~1.0 GB | 8 GB     |
| `qwen2.5-0.5b-instruct-q4` | 备选 / 轻量   | ~0.4 GB | 4 GB     |
| `qwen2.5-3b-instruct-q4`   | 备选 / 高精度 | ~2.1 GB | 12 GB    |

`hardware` 示例：

```json
"hardware": {
  "min_memory_gb": 8,
  "recommended_memory_gb": 12,
  "min_cpu_cores": 4,
  "disk_gb": 1.2,
  "cpu": "x64 / Apple Silicon，4 核及以上",
  "gpu": "非必需；16GB 统一内存体验更流畅",
  "notes": "普通办公本可运行"
}
```

## 打包

```bash
pnpm fetch:llama-runtime   # 下载三平台 llama-server 到 buildResources/llama-runtime
pnpm compile               # electron-builder 打入 extraResources
```

支持平台：`darwin-arm64`, `darwin-x64`, `win32-x64`。Linux 客户端不启用本地推理。

## ModelScope 发布清单

1. 上传 GGUF 到 ModelScope 或 CDN，获取 **文件直链**（非模型页 URL）。
2. 用 `sha256sum model.gguf` 计算校验值，写入 manifest。
3. 更新 `size_bytes` 为实际字节数。
4. 在测试机完成：下载 → 校验 → 启用 AI → 预览命中 → 正式脱敏。

当前默认模型：`qwen2.5-1.5b-instruct-q4`（Qwen2.5-1.5B-Instruct Q4_K_M）。

## IPC

| Channel                | 说明                                       |
| ---------------------- | ------------------------------------------ |
| `ai:get-status`        | 运行时/模型/下载状态                       |
| `ai:fetch-manifest`    | 重新读取内置 manifest（清内存缓存）        |
| `ai:download-model`    | 下载模型（可选 `modelId`，缺省为推荐模型） |
| `ai:cancel-download`   | 取消下载                                   |
| `ai:delete-model`      | 删除本地模型                               |
| `ai:detect-sensitive`  | 单段文本检测（调试）                       |
| `ai:download-progress` | 下载进度事件                               |

## 设置

`setting.json` → `app.ai_assist.enabled` / `confidence_threshold`（应用设置页）。

预览时 AI 最多处理 **50** 个段落，避免大文档卡死；正式脱敏处理全部段落。
