import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { type DocxMatchHitKind, type DocxMatchPreviewResult, matchKindLabel } from '@app/shared';
import { Button } from './ui';

const KIND_ORDER: DocxMatchHitKind[] = ['regex', 'system_keyword', 'profile_keyword', 'manual'];

const KIND_HINTS: Record<DocxMatchHitKind, string> = {
  regex: '来自默认规则模板中的正则规则',
  system_keyword: '来自「设置 → 系统关键词」，受脱敏页「系统关键词」开关控制',
  profile_keyword: '来自当前脱敏方案中的方案关键词',
  manual: '本次文档中划词加入的手动标注',
};

type MatchPreviewDialogProps = {
  open: boolean;
  preview: DocxMatchPreviewResult;
  systemKeywordsEnabled: boolean;
  onClose: () => void;
};

export function MatchPreviewDialog({
  open,
  preview,
  systemKeywordsEnabled,
  onClose,
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
          <div>
            <h2 id="match-preview-title">命中预览</h2>
            <p>脱敏前统计，未改写文件</p>
          </div>
          <Button type="button" variant="ghost" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>

        <div className="match-preview-summary">
          <span>合计 {preview.totalHits} 处</span>
          <span>扫描段落 {preview.paragraphCount}</span>
          <span>手动项 {preview.manualSelectionHits}</span>
        </div>

        {!systemKeywordsEnabled && (
          <p className="match-preview-hint">
            系统关键词开关已关闭，统计中不包含默认模板里的通用关键词规则。
          </p>
        )}

        <div className="match-preview-dialog-body">
          {grouped.map(({ kind, hits, zeroHits, samples }) => {
            if (hits.length === 0 && zeroHits.length === 0) {
              return null;
            }
            return (
              <section key={kind} className="match-preview-group">
                <h3>{matchKindLabel(kind)}</h3>
                <p className="match-preview-group-hint">{KIND_HINTS[kind]}</p>
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
          <Button type="button" variant="outline" onClick={onClose}>
            关闭
          </Button>
        </footer>
      </div>
    </div>
  );
}
