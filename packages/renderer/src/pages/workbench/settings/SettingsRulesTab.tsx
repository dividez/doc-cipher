import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Settings as AppSettings } from '@app/shared';
import { Card, cn } from '../../../components/ui.js';
import { RuleDetail } from '../workbench-ui.js';
import { ruleTypeLabel } from '../workbench-utils.js';

type SettingsRulesTabProps = {
  settings: AppSettings;
  enabledCount: number;
  rulesListOpen: boolean;
  expandedRuleId: string | null;
  onToggleRulesList: () => void;
  onExpandRule: (id: string | null) => void;
  onToggleRule: (id: string) => void;
};

export function SettingsRulesTab({
  settings,
  enabledCount,
  rulesListOpen,
  expandedRuleId,
  onToggleRulesList,
  onExpandRule,
  onToggleRule,
}: SettingsRulesTabProps) {
  return (
    <>
      <Card className="rules-summary-card">
        <div className="section-head">
          <h3>默认规则模板</h3>
          <span className="section-meta">新建方案时复制</span>
        </div>
        <div className="rules-stats">
          <div>
            <strong>{enabledCount}</strong>
            <span>已启用</span>
          </div>
          <div>
            <strong>{settings.rules.length}</strong>
            <span>规则总数</span>
          </div>
          <div>
            <strong>{settings.version}</strong>
            <span>版本</span>
          </div>
        </div>
      </Card>

      <Card className="rules-section">
        <button type="button" className="section-toggle" onClick={onToggleRulesList}>
          {rulesListOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>默认模板规则</span>
        </button>
        {rulesListOpen ? (
          <ul className="rules-list">
            {settings.rules.map((rule) => (
              <li key={rule.id} className="rules-list-item">
                <div className="rule-row">
                  <button
                    type="button"
                    className="rule-expand"
                    onClick={() => onExpandRule(expandedRuleId === rule.id ? null : rule.id)}
                  >
                    {expandedRuleId === rule.id ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                  <div className="rule-info">
                    <strong>{rule.name}</strong>
                    <span>{ruleTypeLabel(rule)}</span>
                  </div>
                  <button
                    type="button"
                    className={cn('rule-toggle', rule.enabled && 'rule-toggle-on')}
                    onClick={() => onToggleRule(rule.id)}
                  >
                    {rule.enabled ? '已启用' : '已停用'}
                  </button>
                </div>
                {expandedRuleId === rule.id ? <RuleDetail rule={rule} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
