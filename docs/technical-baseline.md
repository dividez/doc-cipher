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
- 还原前校验 `restore.enc` 是否属于当前 masked docx
- 还原只基于稳定 token 做全文替换，不依赖 OOXML 节点、段落序号、XML offset 或 `<w:t>` 顺序

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
window.localApi
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
- 本地日志

暂缓：

- 图片 OCR
- PDF
- Office Add-in
- 宏、OLE、嵌入对象处理
- 复杂预览和原生 Word 选区

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
