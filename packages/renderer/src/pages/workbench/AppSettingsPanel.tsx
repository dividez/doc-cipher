import { ChevronDown, ChevronRight, FolderOpen, RefreshCw, Save } from 'lucide-react';
import type { Settings as AppSettings, AppSettingsConfig, MaskingRule } from '@app/shared';
import { Button, Card, Input, Label, Textarea, cn } from '../../components/ui.js';
import { Field, PanelHero, RuleDetail } from './workbench-ui.js';
import { ruleTypeLabel } from './workbench-utils.js';

export function AppSettingsPanel({
  settings,
  enabledCount,
  rulesListOpen,
  advancedJsonOpen,
  expandedRuleId,
  settingsText,
  onToggleRulesList,
  onToggleAdvanced,
  onExpandRule,
  onToggleRule,
  onUpdateAppConfig,
  onPickDefaultOutputDir,
  onSettingsTextChange,
  onReload,
  onSave,
}: {
  settings: AppSettings;
  enabledCount: number;
  rulesListOpen: boolean;
  advancedJsonOpen: boolean;
  expandedRuleId: string | null;
  settingsText: string;
  onToggleRulesList: () => void;
  onToggleAdvanced: () => void;
  onExpandRule: (id: string | null) => void;
  onToggleRule: (id: string) => void;
  onUpdateAppConfig: (patch: Partial<AppSettingsConfig>) => void;
  onPickDefaultOutputDir: () => void;
  onSettingsTextChange: (text: string) => void;
  onReload: () => void;
  onSave: () => void;
}) {
  const app = settings.app;

  return (
    <div className="panel-stack">
      <PanelHero
        title="应用设置"
        description="控制全局行为。脱敏方案中的规则组合请在「方案」中维护。"
      />

      <Card className="app-settings-card">
        <div className="section-head">
          <h3>快捷开关</h3>
          <span className="section-meta">全局生效</span>
        </div>
        <ul className="app-settings-list">
          <li className="app-settings-row">
            <div className="app-settings-copy">
              <strong>正则规则</strong>
              <span>脱敏与命中预估时，是否应用模板中的手机号、身份证等正则规则</span>
            </div>
            <button
              type="button"
              className={cn('rule-toggle', app.enable_regex_rules && 'rule-toggle-on')}
              onClick={() => onUpdateAppConfig({ enable_regex_rules: !app.enable_regex_rules })}
            >
              {app.enable_regex_rules ? '已启用' : '已停用'}
            </button>
          </li>
          <li className="app-settings-row">
            <div className="app-settings-copy">
              <strong>系统关键词</strong>
              <span>是否应用默认模板中 id 为 keywords 的通用关键词规则（如示例人名、公司名）</span>
            </div>
            <button
              type="button"
              className={cn('rule-toggle', app.enable_system_keywords && 'rule-toggle-on')}
              onClick={() =>
                onUpdateAppConfig({ enable_system_keywords: !app.enable_system_keywords })
              }
            >
              {app.enable_system_keywords ? '已启用' : '已停用'}
            </button>
          </li>
        </ul>
        <Field label="默认输出目录">
          <div className="path-field">
            <Input
              value={app.default_output_dir}
              readOnly
              placeholder="未设置时，输出到源文件旁的 DocCipher_Output"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onPickDefaultOutputDir}
              aria-label="选择默认输出目录"
            >
              <FolderOpen size={16} />
            </Button>
            {app.default_output_dir ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onUpdateAppConfig({ default_output_dir: '' })}
              >
                清除
              </Button>
            ) : null}
          </div>
        </Field>
      </Card>

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
        {rulesListOpen && (
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
                {expandedRuleId === rule.id && <RuleDetail rule={rule} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="rules-section">
        <button type="button" className="section-toggle" onClick={onToggleAdvanced}>
          {advancedJsonOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>高级 · 应用配置 JSON</span>
        </button>
        {advancedJsonOpen && (
          <>
            <Textarea
              value={settingsText}
              onChange={(event) => onSettingsTextChange(event.target.value)}
              rows={16}
              spellCheck={false}
            />
            <div className="actions">
              <Button type="button" variant="outline" onClick={onReload}>
                <RefreshCw size={16} /> 重载
              </Button>
              <Button type="button" onClick={onSave}>
                <Save size={16} /> 保存
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
