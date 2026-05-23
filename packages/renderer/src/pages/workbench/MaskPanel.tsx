import { useMemo } from 'react';
import {
  Check,
  FolderOpen,
  Loader2,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  PROFILE_KEYWORD_RULE_ID,
  SYSTEM_KEYWORD_RULE_ID,
  type AiInferenceEstimate,
  type AiMaskProgress,
  type DocxMatchPreviewResult,
  type KeywordRule,
  type ManualKeyword,
  type MaskDocxResult,
  type MaskProfile,
  type MaskingRule,
} from '@app/shared';
import type { PreviewHighlightTerm } from '../../lib/docx-preview-highlights.js';
import { MatchPreviewDialog } from '../../components/MatchPreviewDialog.js';
import { Button, Card, Input, cn } from '../../components/ui.js';
import { DocxReviewPanel } from './DocxReviewPanel.js';
import { Field, PanelHero, ResultFileRow, SectionHead } from './workbench-ui.js';
import { fileName, taskKeywordSourceLabel } from './workbench-utils.js';

function formatEstimateRange(minSec: number, maxSec: number): string {
  const format = (seconds: number) => {
    if (seconds < 60) {
      return `约 ${seconds} 秒`;
    }
    return `约 ${Math.max(1, Math.round(seconds / 60))} 分钟`;
  };
  if (minSec === maxSec) {
    return format(minSec);
  }
  return `${format(minSec)}～${format(maxSec)}`;
}

export function MaskPanel({
  activeProfileId,
  busy,
  maskBusyAction,
  maskAiProgress,
  dragOver,
  enabledRules,
  form,
  manualKeywords,
  matchPreview,
  matchPreviewDialogOpen,
  previewFilePath,
  localAiEnabled,
  aiReady,
  aiBlockReason,
  aiEstimate,
  aiEstimateLoading,
  highlightTerms,
  highlightRevision,
  profiles,
  result,
  systemKeywords,
  systemKeywordsEnabled,
  onAddManualKeyword,
  onClearManualKeywords,
  onCreateProfile,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFormChange,
  onPreviewSelectionError,
  onRemoveManualKeyword,
  onOpenFolder,
  onPickDocx,
  onPickOutput,
  onRuleScan,
  onAiRecognize,
  onStartMask,
  onCancelMask,
  onCloseMatchPreview,
  onOpenMatchPreview,
  onOpenSettings,
  onConfirmMaskFromPreview,
  onSaveProfile,
  onSelectProfile,
  onGoRules,
  onReset,
}: {
  activeProfileId: string;
  busy: boolean;
  maskBusyAction: 'idle' | 'scan' | 'ai' | 'mask';
  maskAiProgress: AiMaskProgress | null;
  dragOver: boolean;
  enabledRules: MaskingRule[];
  form: { inputPath: string; outputDir: string; password: string };
  manualKeywords: ManualKeyword[];
  matchPreview: DocxMatchPreviewResult | null;
  matchPreviewDialogOpen: boolean;
  previewFilePath: string | null;
  localAiEnabled: boolean;
  aiReady: boolean;
  aiBlockReason: string | null;
  aiEstimate: AiInferenceEstimate | null;
  aiEstimateLoading: boolean;
  highlightTerms: PreviewHighlightTerm[];
  highlightRevision: number;
  profiles: MaskProfile[];
  result: MaskDocxResult | null;
  systemKeywords: string[];
  systemKeywordsEnabled: boolean;
  onAddManualKeyword: (text: string) => void;
  onClearManualKeywords: () => void;
  onCreateProfile: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onFormChange: React.Dispatch<
    React.SetStateAction<{ inputPath: string; outputDir: string; password: string }>
  >;
  onPreviewSelectionError: (type: 'success' | 'error' | 'info', text: string) => void;
  onRemoveManualKeyword: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onPickDocx: () => void;
  onPickOutput: () => void;
  onRuleScan: () => void;
  onAiRecognize: () => void;
  onStartMask: () => void;
  onCancelMask: () => void;
  onCloseMatchPreview: () => void;
  onOpenMatchPreview: () => void;
  onOpenSettings: () => void;
  onConfirmMaskFromPreview: () => void;
  onSaveProfile: () => void;
  onSelectProfile: (profileId: string) => void;
  onGoRules: () => void;
  onReset: () => void;
}) {
  const hasFile = !!form.inputPath;
  const scanning = busy && maskBusyAction === 'scan';
  const aiRecognizing = busy && maskBusyAction === 'ai';
  const masking = busy && maskBusyAction === 'mask';

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

  const manualPickCount = manualKeywords.filter((k) => k.source !== 'ai').length;
  const aiPickCount = manualKeywords.filter((k) => k.source === 'ai').length;
  const profileKeywordCount = profileKeywordRule?.keywords.length ?? 0;

  const aiProgressPct =
    maskAiProgress && maskAiProgress.totalWindows > 0
      ? Math.min(100, Math.round((maskAiProgress.doneWindows / maskAiProgress.totalWindows) * 100))
      : 0;

  return (
    <div className="panel-stack panel-stack-wide">
      <PanelHero
        title={hasFile ? fileName(form.inputPath) : '脱敏任务'}
        description={hasFile ? undefined : '选择或拖入 docx 文件'}
        tips={
          <p>
            流程：扫描文档
            {localAiEnabled ? ' → 可选 AI 辅助识别' : ''} → 确认备选词 → 开始脱敏。
            {localAiEnabled ? '模型在「设置」中下载并设为当前。' : ''}
          </p>
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
            previewFilePath={previewFilePath}
            loading={false}
            manualKeywordCount={manualKeywords.length}
            highlightTerms={highlightTerms}
            highlightRevision={highlightRevision}
            onAddKeyword={onAddManualKeyword}
            onClearKeywords={onClearManualKeywords}
            onPreviewError={onPreviewSelectionError}
          />

          {matchPreview && matchPreviewDialogOpen && (
            <MatchPreviewDialog
              open={matchPreviewDialogOpen}
              preview={matchPreview}
              systemKeywordsEnabled={systemKeywordsEnabled}
              taskFlow
              confirmBusy={masking}
              onConfirmMask={onConfirmMaskFromPreview}
              onClose={onCloseMatchPreview}
            />
          )}

          <Card className="task-card task-card-sticky">
            <section className="profile-panel">
              <SectionHead
                title="脱敏方案"
                meta={`${profiles.length} 个`}
                tips={<p>选择或保存方案；正则与关键词在方案管理中配置。</p>}
              />
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
                <Button type="button" variant="outline" onClick={onGoRules}>
                  方案管理
                </Button>
              </div>
            </section>

            <section className="manual-summary">
              <SectionHead
                title="备选词"
                meta={`${manualKeywords.length} 项`}
                tips={
                  <p>
                    左侧划词
                    {localAiEnabled ? '或 AI 识别' : ''}
                    写入此列表。删除的项不参与脱敏；保存方案时会写入方案关键词。
                  </p>
                }
              />
              {manualKeywords.length > 0 ? (
                <ul className="manual-list">
                  {manualKeywords.map((keyword) => (
                    <li key={keyword.id}>
                      <span className="task-keyword-source">
                        {taskKeywordSourceLabel(keyword.source)}
                      </span>
                      <span title={keyword.text}>{keyword.text}</span>
                      <button
                        type="button"
                        aria-label="从备选列表移除"
                        onClick={() => onRemoveManualKeyword(keyword.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="manual-empty">暂无</p>
              )}
            </section>

            <section className="rules-summary">
              <SectionHead
                title="检测规则"
                meta={`${enabledRules.length} 项已启用`}
                tips={
                  <>
                    <p>扫描与脱敏时应用已启用的正则、系统词、方案词。</p>
                    {!systemKeywordsEnabled && systemKeywords.length > 0 ? (
                      <p>系统关键词开关已关闭，不使用设置模板中的通用词。</p>
                    ) : null}
                  </>
                }
              />
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
            </section>

            <section className="task-sources">
              <SectionHead
                title="敏感信息来源"
                tips={
                  <ul>
                    <li>正则、方案/系统关键词：来自方案与设置</li>
                    <li>{localAiEnabled ? '划词、AI：来自备选列表' : '划词：来自备选列表'}</li>
                    <li>四类来源在扫描与脱敏时一并生效</li>
                  </ul>
                }
              />
              <ul className="task-sources-list">
                <li>
                  <span>正则</span>
                  <span className="section-meta">{regexRules.length} 条启用</span>
                </li>
                <li>
                  <span>方案/系统关键词</span>
                  <span className="section-meta">
                    方案 {profileKeywordCount} · 系统{' '}
                    {systemKeywordsEnabled && systemKeywordRule ? systemKeywords.length : '关'}
                  </span>
                </li>
                <li>
                  <span>划词</span>
                  <span className="section-meta">{manualPickCount} 项</span>
                </li>
                {localAiEnabled ? (
                  <li>
                    <span>AI 辅助识别</span>
                    <span className="section-meta">{aiPickCount} 项</span>
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="task-steps">
              <SectionHead
                title="发现敏感信息"
                tips={
                  <ul>
                    <li>扫描文档：规则与备选词，较快</li>
                    {localAiEnabled ? (
                      <>
                        <li>AI 辅助识别：补充敏感词到备选列表，显示进度可取消</li>
                        <li>须先在设置中配置并启用本地模型</li>
                      </>
                    ) : null}
                  </ul>
                }
              />
              <div className="task-step-actions">
                <Button type="button" variant="outline" disabled={busy} onClick={onRuleScan}>
                  {scanning ? <Loader2 className="spin" size={16} /> : <ScanSearch size={16} />}
                  扫描文档
                </Button>
                {localAiEnabled ? (
                  <div className="task-step-ai">
                    <Button
                      type="button"
                      variant="default"
                      disabled={busy || !aiReady}
                      onClick={onAiRecognize}
                    >
                      {aiRecognizing ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      AI 辅助识别
                    </Button>
                    {!aiReady ? (
                      <>
                        <Button type="button" variant="ghost" onClick={onOpenSettings}>
                          去设置
                        </Button>
                        {aiBlockReason ? (
                          <span className="section-meta task-step-ai-hint">{aiBlockReason}</span>
                        ) : null}
                      </>
                    ) : null}
                    {aiReady && aiEstimate && !aiRecognizing ? (
                      <span className="section-meta task-step-estimate">
                        {aiEstimateLoading
                          ? '估算中…'
                          : formatEstimateRange(
                              aiEstimate.estimatedSecondsMin,
                              aiEstimate.estimatedSecondsMax,
                            )}
                      </span>
                    ) : null}
                    {aiRecognizing && maskAiProgress && maskAiProgress.totalWindows > 0 ? (
                      <div className="ai-mask-progress task-step-ai-progress">
                        <div className="ai-progress-bar">
                          <div
                            className="ai-progress-fill"
                            style={{ width: `${aiProgressPct}%` }}
                          />
                        </div>
                        <span>
                          识别中 {maskAiProgress.doneWindows} / {maskAiProgress.totalWindows} 窗口
                        </span>
                        <Button type="button" variant="outline" onClick={onCancelMask}>
                          取消识别
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {scanning ? (
                <p className="task-step-status">
                  <Loader2 className="spin" size={14} /> 正在扫描文档…
                </p>
              ) : null}
              {matchPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="task-step-view-result"
                  onClick={onOpenMatchPreview}
                >
                  查看识别结果（共 {matchPreview.totalHits} 处）
                </Button>
              ) : null}
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

            <section className="task-step-mask">
              <SectionHead
                title="正式脱敏"
                tips={
                  <p>
                    须先完成扫描。填写还原密码后生成 masked.docx 与
                    restore.enc；此步骤不再调用本地模型。
                  </p>
                }
              />
              <Button
                type="button"
                className="task-mask-primary"
                disabled={busy || !matchPreview || !form.password.trim()}
                title={
                  !matchPreview
                    ? '请先扫描文档'
                    : !form.password.trim()
                      ? '请填写还原密码'
                      : undefined
                }
                onClick={onStartMask}
              >
                {masking ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
                开始脱敏
              </Button>
              {masking && maskAiProgress?.phase === 'mask' ? (
                <p className="task-step-status">
                  <Loader2 className="spin" size={14} /> 正在写入脱敏文件…
                </p>
              ) : null}
            </section>

            {result && (
              <Button type="button" variant="ghost" onClick={onReset}>
                重新选择文档
              </Button>
            )}
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
