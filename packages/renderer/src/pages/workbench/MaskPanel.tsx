import { useMemo } from 'react';
import {
  Check,
  FolderOpen,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  PROFILE_KEYWORD_RULE_ID,
  SYSTEM_KEYWORD_RULE_ID,
  type DocxMatchHit,
  type DocxManualSelection,
  type DocxMatchPreviewResult,
  type DocxPreviewResult,
  type KeywordRule,
  type MaskDocxResult,
  type MaskProfile,
  type MaskingRule,
} from '@app/shared';
import { MatchPreviewDialog } from '../../components/MatchPreviewDialog.js';
import { Button, Card, Input, cn } from '../../components/ui.js';
import { DocxReviewPanel } from './DocxReviewPanel.js';
import type { ManualSelectionDraft } from './types.js';
import { Field, PanelHero, ResultFileRow } from './workbench-ui.js';
import { fileName } from './workbench-utils.js';

export function MaskPanel({
  activeProfileId,
  busy,
  dragOver,
  docxPreview,
  enabledRules,
  form,
  manualSelections,
  matchPreview,
  matchPreviewDialogOpen,
  matchPreviewLoading,
  profiles,
  previewLoading,
  result,
  systemKeywords,
  systemKeywordsEnabled,
  onAddManualSelection,
  onClearManualSelections,
  onCreateProfile,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFormChange,
  onPreviewSelectionError,
  onRemoveManualSelection,
  onOpenFolder,
  onPickDocx,
  onPickOutput,
  onRun,
  onCloseMatchPreview,
  onPreviewMatches,
  onSaveProfile,
  onSelectProfile,
  onGoRules,
  onReset,
}: {
  activeProfileId: string;
  busy: boolean;
  dragOver: boolean;
  docxPreview: DocxPreviewResult | null;
  enabledRules: MaskingRule[];
  form: { inputPath: string; outputDir: string; password: string };
  manualSelections: DocxManualSelection[];
  matchPreview: DocxMatchPreviewResult | null;
  matchPreviewDialogOpen: boolean;
  matchPreviewLoading: boolean;
  profiles: MaskProfile[];
  previewLoading: boolean;
  result: MaskDocxResult | null;
  systemKeywords: string[];
  systemKeywordsEnabled: boolean;
  onAddManualSelection: (selection: ManualSelectionDraft) => void;
  onClearManualSelections: () => void;
  onCreateProfile: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onFormChange: React.Dispatch<
    React.SetStateAction<{ inputPath: string; outputDir: string; password: string }>
  >;
  onPreviewSelectionError: (type: 'success' | 'error' | 'info', text: string) => void;
  onRemoveManualSelection: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onPickDocx: () => void;
  onPickOutput: () => void;
  onRun: () => void;
  onCloseMatchPreview: () => void;
  onPreviewMatches: () => void;
  onSaveProfile: () => void;
  onSelectProfile: (profileId: string) => void;
  onGoRules: () => void;
  onReset: () => void;
}) {
  const hasFile = !!form.inputPath;
  const regexRules = useMemo(
    () =>
      enabledRules.filter(
        (rule) =>
          rule.type === 'regex' ||
          (rule.type === 'keyword' &&
            rule.id !== SYSTEM_KEYWORD_RULE_ID &&
            rule.id !== PROFILE_KEYWORD_RULE_ID),
      ),
    [enabledRules],
  );
  const systemKeywordRule = useMemo(
    () =>
      enabledRules.find(
        (rule): rule is KeywordRule =>
          rule.type === 'keyword' && rule.id === SYSTEM_KEYWORD_RULE_ID,
      ) ?? null,
    [enabledRules],
  );
  const profileKeywordRule = useMemo(
    () =>
      enabledRules.find(
        (rule): rule is KeywordRule =>
          rule.type === 'keyword' && rule.id === PROFILE_KEYWORD_RULE_ID,
      ) ?? null,
    [enabledRules],
  );
  const ruleHitsByBlock = useMemo(() => {
    const map = new Map<string, DocxMatchHit[]>();
    if (!matchPreview) {
      return map;
    }
    for (const hit of matchPreview.hits) {
      const key = `${hit.partName}:${hit.blockIndex}`;
      const list = map.get(key) ?? [];
      list.push(hit);
      map.set(key, list);
    }
    return map;
  }, [matchPreview]);

  return (
    <div className="panel-stack panel-stack-wide">
      <PanelHero
        title={hasFile ? fileName(form.inputPath) : '脱敏任务'}
        description={
          hasFile
            ? '在文档预览中划词加入手动脱敏项，再配置密码并生成文件。'
            : '请先选择或拖入 Word 文档。'
        }
      />

      {!hasFile && (
        <div
          className={cn('drop-zone drop-zone-compact', dragOver && 'drop-zone-active')}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <Upload size={22} />
          <p>拖拽 docx 到这里</p>
          <Button type="button" variant="outline" onClick={onPickDocx}>
            选择文件
          </Button>
        </div>
      )}

      {hasFile && (
        <div className="mask-layout">
          <DocxReviewPanel
            preview={docxPreview}
            loading={previewLoading}
            ruleHitsByBlock={ruleHitsByBlock}
            selections={manualSelections}
            onAddSelection={onAddManualSelection}
            onClearSelections={onClearManualSelections}
            onRemoveSelection={onRemoveManualSelection}
            onSelectionError={onPreviewSelectionError}
          />

          {matchPreview && matchPreviewDialogOpen && (
            <MatchPreviewDialog
              open={matchPreviewDialogOpen}
              preview={matchPreview}
              systemKeywordsEnabled={systemKeywordsEnabled}
              onClose={onCloseMatchPreview}
            />
          )}

          <Card className="task-card task-card-sticky">
            <div className="task-actions">
              <Button type="button" onClick={onRun} disabled={busy}>
                {busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
                开始脱敏
              </Button>
              <Button type="button" variant="outline" onClick={onGoRules}>
                方案管理
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onPreviewMatches}
                disabled={matchPreviewLoading}
                title={
                  matchPreview
                    ? `已预估 ${matchPreview.totalHits} 处，点击刷新并查看详情`
                    : '统计脱敏前规则命中（不修改文件）'
                }
              >
                {matchPreviewLoading ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Search size={16} />
                )}
                命中预估
              </Button>
              {result && (
                <Button type="button" variant="ghost" onClick={onReset}>
                  重新选择
                </Button>
              )}
            </div>

            <section className="profile-panel">
              <div className="section-head">
                <h3>脱敏方案</h3>
                <span className="section-meta">{profiles.length} 个</span>
              </div>
              <select
                className="profile-select"
                value={activeProfileId}
                onChange={(event) => onSelectProfile(event.target.value)}
              >
                <option value="">当前临时方案</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <div className="profile-actions">
                <Button type="button" variant="secondary" onClick={onCreateProfile}>
                  新建方案
                </Button>
                <Button type="button" variant="outline" onClick={onSaveProfile}>
                  <Save size={16} /> 保存方案
                </Button>
              </div>
            </section>

            <section className="manual-summary">
              <div className="section-head">
                <h3>手动标注</h3>
                <span className="section-meta">{manualSelections.length} 项</span>
              </div>
              {manualSelections.length > 0 ? (
                <ul className="manual-list">
                  {manualSelections.map((selection) => (
                    <li key={selection.id}>
                      <span title={selection.text}>{selection.text}</span>
                      <button
                        type="button"
                        aria-label="移除手动项"
                        onClick={() => onRemoveManualSelection(selection.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="manual-empty">在左侧预览中划词后加入脱敏。</p>
              )}
            </section>

            <section className="rules-summary">
              <div className="section-head">
                <h3>检测规则</h3>
                <span className="section-meta">{enabledRules.length} 项已启用</span>
              </div>
              {regexRules.length > 0 && (
                <ul className="rule-chips">
                  {regexRules.map((rule) => (
                    <li key={rule.id}>
                      <span className="rule-chip">
                        <Check size={12} />
                        {rule.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {systemKeywordRule && (
                <ul className="rule-chips rule-chips-group">
                  <li>
                    <span className="rule-chip rule-chip-system">
                      <Check size={12} />
                      系统 · {systemKeywordRule.name}
                    </span>
                  </li>
                </ul>
              )}
              {profileKeywordRule && (
                <ul className="rule-chips rule-chips-group">
                  <li>
                    <span className="rule-chip rule-chip-profile">
                      <Check size={12} />
                      方案 · {profileKeywordRule.name}
                    </span>
                  </li>
                </ul>
              )}
              {!systemKeywordsEnabled && systemKeywords.length > 0 && (
                <p className="rules-summary-hint">
                  系统关键词开关已关闭，脱敏时不应用模板中的通用关键词。
                </p>
              )}
            </section>

            <Field label="还原密码">
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="用于加密 restore.enc"
              />
            </Field>

            <Field label="输出目录（可选）">
              <div className="path-field">
                <Input value={form.outputDir} readOnly placeholder="默认：原文件旁的 output 目录" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPickOutput}
                  aria-label="选择输出目录"
                >
                  <FolderOpen size={16} />
                </Button>
              </div>
            </Field>
          </Card>
        </div>
      )}

      {result && (
        <Card className="result-panel">
          <h3>已生成</h3>
          <ul className="result-files">
            <ResultFileRow
              path={result.maskedDocxPath}
              onOpen={() => onOpenFolder(result.maskedDocxPath)}
            />
            <ResultFileRow
              path={result.restoreFilePath}
              onOpen={() => onOpenFolder(result.restoreFilePath)}
            />
          </ul>
          <p className="result-stats">共替换 {result.itemCount} 处敏感信息</p>
          <div className="result-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenFolder(result.maskedDocxPath)}
            >
              <FolderOpen size={16} /> 打开目录
            </Button>
            <Button type="button" variant="ghost" onClick={onReset}>
              重新脱敏
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
