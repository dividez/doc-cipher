import { Copy, Download, Save, Settings, Trash2, UploadCloud } from 'lucide-react';
import type { MaskProfile } from '@app/shared';
import { Button, Card, Input, Textarea, cn } from '../../components/ui.js';
import { Field, PanelHero } from './workbench-ui.js';
import { compactText } from './workbench-utils.js';

export function ProfilesPanel({
  profiles,
  selectedProfileId,
  selectedProfile,
  draftName,
  draftKeywords,
  systemKeywords,
  systemKeywordsEnabled,
  onCreate,
  onSelect,
  onDraftNameChange,
  onDraftKeywordsChange,
  onSave,
  onDelete,
  onExport,
  onImport,
  onDuplicate,
  onDedupeKeywords,
  onGoSettings,
}: {
  profiles: MaskProfile[];
  selectedProfileId: string;
  selectedProfile: MaskProfile | null;
  draftName: string;
  draftKeywords: string;
  systemKeywords: string[];
  systemKeywordsEnabled: boolean;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDraftNameChange: (name: string) => void;
  onDraftKeywordsChange: (keywords: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: () => void;
  onDuplicate: () => void;
  onDedupeKeywords: () => void;
  onGoSettings: () => void;
}) {
  return (
    <div className="panel-stack panel-stack-wide">
      <PanelHero
        title="方案管理"
        description="方案按业务场景保存，例如劳动合同、采购合同。脱敏页只负责选择方案和执行任务。"
      />
      <div className="profiles-layout">
        <Card className="profiles-list-card">
          <div className="section-head">
            <h3>脱敏方案</h3>
            <span className="section-meta">{profiles.length} 个</span>
          </div>
          <div className="profile-actions">
            <Button type="button" variant="outline" onClick={onImport}>
              <UploadCloud size={16} /> 导入
            </Button>
            <Button type="button" onClick={onCreate}>
              新建方案
            </Button>
          </div>
          <ul className="profiles-list">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className={cn(
                    'profile-list-item',
                    selectedProfileId === profile.id && 'profile-list-item-active',
                  )}
                  onClick={() => onSelect(profile.id)}
                >
                  <span>{profile.name}</span>
                  <code>{profile.id}</code>
                </button>
              </li>
            ))}
          </ul>
          {profiles.length === 0 && (
            <p className="manual-empty">暂无方案，可从脱敏页划词后保存。</p>
          )}
        </Card>

        <Card className="profile-editor-card">
          {selectedProfile ? (
            <>
              <div className="section-head">
                <h3>方案详情</h3>
                <span className="section-meta">ID: {selectedProfile.id}</span>
              </div>
              <Field label="方案名称">
                <Input
                  value={draftName}
                  onChange={(event) => onDraftNameChange(event.target.value)}
                />
              </Field>
              <Field label="方案关键词">
                <Textarea
                  className="profile-keywords profile-keywords-large"
                  value={draftKeywords}
                  onChange={(event) => onDraftKeywordsChange(event.target.value)}
                  placeholder="每行一个关键词，支持批量粘贴后去重"
                />
              </Field>
              <p className="profile-keywords-hint">
                系统关键词在{' '}
                <button type="button" className="inline-link" onClick={onGoSettings}>
                  设置
                </button>{' '}
                中配置，脱敏页受「系统关键词」开关控制。
                {systemKeywords.length > 0 && (
                  <>
                    {' '}
                    当前模板词：
                    {systemKeywordsEnabled ? (
                      <code>{compactText(systemKeywords.join('、'), 80)}</code>
                    ) : (
                      <span>（开关已关闭，脱敏时不生效）</span>
                    )}
                  </>
                )}
              </p>
              <div className="profile-actions profile-actions-wrap">
                <Button type="button" onClick={onSave}>
                  <Save size={16} /> 保存
                </Button>
                <Button type="button" variant="outline" onClick={onDedupeKeywords}>
                  去重整理
                </Button>
                <Button type="button" variant="outline" onClick={onDuplicate}>
                  <Copy size={16} /> 复制方案
                </Button>
                <Button type="button" variant="outline" onClick={onExport}>
                  <Download size={16} /> 导出
                </Button>
                <Button type="button" variant="ghost" onClick={onDelete}>
                  <Trash2 size={16} /> 删除
                </Button>
              </div>
            </>
          ) : (
            <div className="profile-empty-state">
              <Settings size={28} />
              <p>选择左侧方案查看名称、ID、关键词，并进行导入导出管理。</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
