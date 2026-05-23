# Electron 离线 Word 文档脱敏客户端技术基线 v0.1

## 目标

DocCipher 以完全离线的 Electron 桌面客户端处理 `docx` 文档：

```txt
原始 docx -> 脱敏后的 docx + 加密还原文件
脱敏后的 docx + 加密还原文件 -> 还原后的 docx
```

核心原则：

- 不把原文或映射信息写回 `docx`
- 脱敏文件只保留唯一 token
- 原文只进入独立的加密 `restore.enc`
- `restore.enc` 密码和结构必须严格正确；当前 docx 指纹不一致时不阻断，还原报告中标记风险
- 还原只基于完整稳定 token 做精确全文替换，不依赖 OOXML 节点、段落序号、XML offset 或 `<w:t>` 顺序
- 允许部分还原：被用户删除、编辑、拆坏的 token 跳过，不做模糊猜测

## 技术栈

- Electron
- Vite
- React
- TypeScript
- shadcn/ui 风格本地组件
- adm-zip
- @xmldom/xmldom
- zod
- electron-log
- Node.js crypto

## 安全基线

Renderer 不启用 Node 能力：

```txt
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
```

preload 只暴露：

```ts
window.localApi;
```

IPC 白名单包括文件选择、设置读写、脱敏、还原和日志读取。

## MVP 范围

已初始化的 MVP 聚焦：

- 选择 `docx`
- 编辑和保存 `setting.json`
- 正则脱敏
- 关键词脱敏
- 手动项 schema
- 生成 `*.masked.docx`
- 生成 `*.restore.enc`
- 还原 `*.restored.docx`
- 生成 `restore-report.json`
- 本地日志

暂缓：

- 图片 OCR
- PDF
- Office Add-in
- 宏、OLE、嵌入对象处理
- 预览 DOM 上叠加命中高亮
- 原生 Word 选区集成

## 预览架构（Renderer / Main）

```txt
Renderer: docx-preview 只读版式预览 + 划词采集手动词
Main:     docx:read-file → 二进制；docx:recognize-matches → 识别；docx:mask → OOXML 脱敏（recognizedHits 快照）
```

- IPC `docx:read-file`：校验 `.docx` 存在，返回 base64，不解析内容。
- 划词：`window.getSelection().toString()` → `manualKeywords[]`，脱敏时全文 `indexOf`。
- 已移除 UI 路径上的 `docx:preview`（段落文本抽取预览）。

## OOXML 处理策略

第一版处理：

```txt
word/document.xml
word/header*.xml
word/footer*.xml
word/footnotes.xml
word/endnotes.xml
word/comments.xml
```

文本处理采用段落级聚合：

```txt
多个 <w:t> -> 段落纯文本 -> 规则匹配 -> offset 回写对应 <w:t>
```

这能覆盖 Word 把连续文本拆成多个 `<w:t>` 的常见情况。

## 加密映射文件

`restore.enc` 使用：

```txt
AES-256-GCM
scrypt 派生密钥
随机 salt
随机 iv
auth tag
```

映射明文只在内存中短暂存在，落盘为加密 JSON 载荷。

`restore.enc` 的核心语义是 Token Vault：

```json
{
  "version": "1.0.0",
  "task_id": "task_20260517_120000_ab12",
  "tokens": {
    "[PHONE_000001]": "13800138000",
    "[ID_CARD_000001]": "430203197802116050"
  }
}
```

`items.location` 只能作为调试元信息，不能参与还原。AI 审查或改写后，OOXML 结构可能被重排、拆分或重新生成；还原流程必须遍历文本 part 并按 token 替换回原文。

## 部分还原策略

还原采用 `Partial Restore`：

1. 解密 `restore.enc`，取得 token vault。
2. 读取当前 docx 并计算 SHA-256。
3. 当前 docx SHA 与 `restore.enc` 中的 `masked_doc_fingerprint` 不一致时，仅写入 warning，不中止。
4. 遍历文本 part，按段落拼接 `<w:t>` 内容。
5. 只替换仍完整存在、且能在 token vault 中精确匹配的 token。
6. 文档中符合 token 形态但不在 token vault 中的内容记为 `unknown`。
7. 输出 `*.restored.docx` 与 `restore-report.json`。

不做模糊还原。以下内容均不会被猜成合法 token：

```txt
[PHONE_00001]
[PH0NE_000001]
[PHONE_000001
PHONE_000001]
```

如果同一个合法 token 被复制多次，所有出现位置都会还原为同一个原文。报告同时统计 token 维度和实际替换次数：

```json
{
  "version": "1.0.0",
  "mode": "partial_restore",
  "fingerprint_match": false,
  "total_tokens": 20,
  "restored_tokens": 16,
  "restored_occurrences": 18,
  "missing_tokens": 4,
  "unknown_tokens": 1,
  "unknown_occurrences": 1,
  "items": [
    {
      "token": "[PHONE_000001]",
      "status": "restored",
      "occurrences": 3
    },
    {
      "token": "[PERSON_000002]",
      "status": "missing",
      "occurrences": 0
    },
    {
      "token": "[PHONE_999999]",
      "status": "unknown",
      "occurrences": 1
    }
  ]
}
```

`restore-report.json` 不包含原文，避免报告文件成为新的敏感数据载体。
