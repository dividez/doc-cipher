import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { type DocxMatchHitKind, type DocxMatchPreviewResult, matchKindLabel } from '@app/shared';
import { TipsButton } from './TipsButton.js';
import { Button } from './ui.js';

const KIND_ORDER: DocxMatchHitKind[] = [
  'regex',
  'system_keyword',
  'profile_keyword',
  'manual',
  'ai',
];

const KIND_HINTS: Record<DocxMatchHitKind, string> = {
  regex: '来自默认规则模板中的正则规则',
  system_keyword: '来自「设置 → 系统关键词」，受脱敏页「系统关键词」开关控制',
  profile_keyword: '来自当前脱敏方案中的方案关键词',
  manual: '本次划词加入的手动词，全文子串匹配；可在预览中用 Ctrl/Cmd+F 查找',
  ai: '来自本次任务识别阶段的本地 AI 辅助识别',
};

type MatchPreviewDialogProps = {
  open: boolean;
  preview: DocxMatchPreviewResult;
  systemKeywordsEnabled: boolean;
  onClose: () => void;
  taskFlow?: boolean;
  confirmBusy?: boolean;
  onConfirmMask?: () => void;
};

export function MatchPreviewDialog({
  open,
  preview,
  systemKeywordsEnabled,
  onClose,
  taskFlow = false,
  confirmBusy = false,
  onConfirmMask,
}: MatchPreviewDialogProps) {
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      hits: preview.ruleHits.filter((hit) => hit.kind === kind),
      zeroHits: preview.zeroHitRules.filter((rule) => rule.kind === kind),
      samples: preview.samples.filter((sample) => sample.kind === kind),
    }));
  }, [preview]);

  if (!open) {
    return null;
  }

  return (
    <div className="match-preview-overlay" onClick={onClose}>
      <div
        className="match-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="match-preview-dialog-head">
          <div className="match-preview-dialog-title">
            <h2 id="match-preview-title">识别结果</h2>
            <TipsButton label="识别结果说明">
              <p>
                统计扫描与 AI
                识别的命中，未改写文件。确认后点「确认并脱敏」或关闭后在侧栏「开始脱敏」。
              </p>
              {!systemKeywordsEnabled ? <p>系统关键词开关已关闭，不含模板通用词规则。</p> : null}
            </TipsButton>
          </div>
          <Button type="button" variant="ghost" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>

        <div className="match-preview-summary">
          <span>合计 {preview.totalHits} 处</span>
          <span>扫描段落 {preview.paragraphCount}</span>
          <span>手动词 {preview.manualSelectionHits}</span>
        </div>

        <div className="match-preview-dialog-body">
          {grouped.map(({ kind, hits, zeroHits, samples }) => {
            if (hits.length === 0 && zeroHits.length === 0) {
              return null;
            }
            return (
              <section key={kind} className="match-preview-group">
                <div className="match-preview-group-head">
                  <h3>{matchKindLabel(kind)}</h3>
                  <TipsButton label={`${matchKindLabel(kind)}说明`}>
                    <p>{KIND_HINTS[kind]}</p>
                  </TipsButton>
                </div>
                {hits.length > 0 && (
                  <ul className="match-preview-rule-list">
                    {hits.map((hit) => {
                      const ruleSamples = samples.filter((s) => s.ruleId === hit.ruleId);
                      const expanded = expandedRuleId === hit.ruleId;
                      return (
                        <li key={hit.ruleId}>
                          <button
                            type="button"
                            className="match-preview-rule-row"
                            onClick={() => setExpandedRuleId(expanded ? null : hit.ruleId)}
                          >
                            {ruleSamples.length > 0 ? (
                              expanded ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )
                            ) : (
                              <span className="match-preview-rule-spacer" />
                            )}
                            <strong>{hit.ruleName}</strong>
                            <span className="match-preview-count">{hit.count} 处</span>
                          </button>
                          {expanded && ruleSamples.length > 0 && (
                            <ul className="match-preview-sample-list">
                              {ruleSamples.map((sample, idx) => (
                                <li key={`${sample.ruleId}-${idx}`}>
                                  <code>{sample.snippet}</code>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {zeroHits.length > 0 && (
                  <p className="match-preview-zero">
                    已启用未命中：{zeroHits.map((r) => r.ruleName).join('、')}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <footer className="match-preview-dialog-foot">
          {taskFlow ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={confirmBusy}>
                返回修改
              </Button>
              <Button
                type="button"
                onClick={onConfirmMask}
                disabled={confirmBusy || !onConfirmMask}
              >
                {confirmBusy ? '脱敏中…' : '确认并脱敏'}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              关闭
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
