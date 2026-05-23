import type { ReactNode } from 'react';
import { BUILD_INFO, isDevBuild, isLocalAiBundled } from '@app/shared';
import { AppIcon } from '../../../components/AppIcon.js';
import { Card } from '../../../components/ui.js';
import { getLocalApi, isLocalApiReady } from '../../../lib/local-api.js';

const PDF24_URL = 'https://www.pdf24.org/zh/';

function Kw({ children }: { children: ReactNode }) {
  return <mark className="app-settings-about-kw">{children}</mark>;
}

function AboutExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="app-settings-about-link"
      onClick={(event) => {
        event.preventDefault();
        if (!isLocalApiReady()) {
          return;
        }
        void getLocalApi()
          .openExternalUrl(href)
          .catch((error) => {
            console.error(error);
          });
      }}
    >
      {children}
    </a>
  );
}

export function SettingsAboutTab() {
  return (
    <Card className="app-settings-card app-settings-about-card">
      <div className="app-settings-about-header">
        <AppIcon size={48} className="app-settings-about-icon" />
        <div>
          <h3 className="app-settings-about-title">DocCipher</h3>
          <p className="app-settings-about-version">
            版本 {BUILD_INFO.version}
            {isDevBuild() ? null : ` · 构建 ${BUILD_INFO.build}`}
          </p>
        </div>
      </div>

      <section className="app-settings-about-section">
        <h4>功能描述</h4>
        <p>
          DocCipher 是<Kw>完全离线</Kw>的 Word <Kw>docx</Kw>{' '}
          脱敏与还原桌面客户端。选择文档、扫描并确认敏感内容后生成 脱敏文件与 <Kw>restore.enc</Kw>
          ；可在本地使用还原密码恢复文档。
        </p>
        <p>
          支持按业务场景维护<Kw>脱敏方案</Kw>、预览<Kw>划词备选</Kw>，以及查看<Kw>任务历史</Kw>。
        </p>
      </section>

      <section className="app-settings-about-section">
        <h4>支持的文件格式</h4>
        <p>
          当前<Kw>仅支持</Kw> <Kw>.docx</Kw>（Office Open XML）格式。
        </p>
        <p>
          <Kw>不支持 .doc</Kw>：旧版 Word 的 <Kw>doc</Kw> 为<Kw>二进制</Kw>
          格式，本应用无法直接处理。请先在 Word、WPS 等文档编辑器中<Kw>另存为 docx</Kw>
          ；自行转换时可能<Kw>损失样式与版式</Kw>，建议转换后预览核对。
        </p>
        <p>
          <Kw>不支持 PDF</Kw>：本应用<Kw>不做 OCR</Kw>，也无法直接脱敏 PDF。请先将 PDF{' '}
          <Kw>转为 docx</Kw>
          （扫描件需先完成 <Kw>OCR</Kw>），再导入本应用。可免费使用{' '}
          <AboutExternalLink href={PDF24_URL}>PDF24</AboutExternalLink> 等离线工具完成 PDF 与 Office
          文档互转。
        </p>
      </section>

      <section className="app-settings-about-section">
        <h4>支持的能力</h4>
        <ul className="app-settings-about-list">
          <li>
            <Kw>离线 docx</Kw> 脱敏与可逆还原（原文与映射不出本机）
          </li>
          <li>
            <Kw>正则规则</Kw>、系统/方案关键词与<Kw>划词备选</Kw>
          </li>
          <li>
            脱敏方案管理、文档预览与<Kw>任务历史</Kw>
          </li>
          {isLocalAiBundled() ? (
            <li>
              <Kw>本地 AI 辅助识别</Kw>敏感词（需下载模型）
            </li>
          ) : null}
        </ul>
      </section>

      <section className="app-settings-about-section">
        <h4>源代码</h4>
        <p>
          <AboutExternalLink href={BUILD_INFO.repo}>{BUILD_INFO.repo}</AboutExternalLink>
        </p>
      </section>

      <section className="app-settings-about-section app-settings-about-disclaimer">
        <h4>免责声明</h4>
        <p>
          本软件按「现状」提供，不构成法律、合规或信息安全方面的专业建议。脱敏与识别结果须由您
          <Kw>自行复核</Kw>；处理重要文档前请<Kw>保留备份</Kw>。
        </p>
        {isLocalAiBundled() ? (
          <p>
            <Kw>本地 AI</Kw> 辅助识别可能存在<Kw>漏检与误检</Kw>，不应作为唯一依据。
          </p>
        ) : null}
      </section>
    </Card>
  );
}
