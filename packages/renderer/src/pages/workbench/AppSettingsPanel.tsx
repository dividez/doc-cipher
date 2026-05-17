import { ChevronDown, ChevronRight, FolderOpen, RefreshCw, Save } from 'lucide-react';
import type { Settings as AppSettings, AppSettingsConfig, MaskingRule } from '@app/shared';
import type { AppStoragePathsInfo } from '../../lib/local-api.js';
import { Button, Card, Input, Label, Textarea, cn } from '../../components/ui.js';
import { Field, PanelHero, RuleDetail } from './workbench-ui.js';
import { ruleTypeLabel } from './workbench-utils.js';

export function AppSettingsPanel({
  settings,
  storagePaths,
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
  onOpenAppDataDir,
  onOpenUserDataDir,
  onPickUserDataDir,
  onResetUserDataDir,
  onSettingsTextChange,
  onReload,
  onSave,
}: {
  settings: AppSettings;
  storagePaths: AppStoragePathsInfo | null;
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
  onOpenAppDataDir: () => void;
  onOpenUserDataDir: () => void;
  onPickUserDataDir: () => void;
  onResetUserDataDir: () => void;
  onSettingsTextChange: (text: string) => void;
  onReload: () => void;
  onSave: () => void;
}) {
  const app = settings.app;

  return (
    <div className="panel-stack">
      <PanelHero title="应用设置" description="调整通用选项；具体脱敏规则请在「方案」中设置。" />

      <Card className="app-settings-card">
        <div className="section-head">
          <h3>数据存放位置</h3>
        </div>
        <ul className="app-settings-list">
          <li className="app-settings-row app-settings-row-stack">
            <div className="app-settings-copy">
              <strong>应用设置</strong>
              <span>位置固定，不能改</span>
            </div>
            <Field label="位置">
              <div className="path-field">
                <Input value={storagePaths?.appDataDir ?? ''} readOnly spellCheck={false} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenAppDataDir}
                  disabled={!storagePaths}
                  aria-label="在 Finder 中查看应用设置文件夹"
                >
                  <FolderOpen size={16} />
                </Button>
              </div>
            </Field>
          </li>
          <li className="app-settings-row app-settings-row-stack">
            <div className="app-settings-copy">
              <strong>方案与记录</strong>
              <span>可以改到其他文件夹，改完要重启</span>
            </div>
            <Field label="位置">
              <div className="path-field">
                <Input value={storagePaths?.userDataDir ?? ''} readOnly spellCheck={false} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenUserDataDir}
                  disabled={!storagePaths}
                  aria-label="在 Finder 中查看方案与记录文件夹"
                >
                  <FolderOpen size={16} />
                </Button>
              </div>
            </Field>
            <div className="profile-actions profile-actions-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={onPickUserDataDir}
                disabled={!storagePaths}
              >
                更换位置…
              </Button>
              {storagePaths?.isCustomUserDataDir ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onResetUserDataDir}
                  disabled={!storagePaths}
                >
                  恢复默认
                </Button>
              ) : null}
            </div>
          </li>
        </ul>
      </Card>

      <Card className="app-settings-card">
        <div className="section-head">
          <h3>快捷开关</h3>
          <span className="section-meta">全局生效</span>
        </div>
        <ul className="app-settings-list">
          <li className="app-settings-row">
            <div className="app-settings-copy">
              <strong>正则规则</strong>
              <span>识别手机号、身份证号等常见格式</span>
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
              <span>识别模板里的示例关键词（如常见人名、公司名）</span>
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
