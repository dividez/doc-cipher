import { FolderOpen } from 'lucide-react';
import type { AppSettingsConfig } from '@app/shared';
import { Button, Card, Input, cn } from '../../../components/ui.js';
import { Field } from '../workbench-ui.js';

type SettingsGeneralTabProps = {
  app: AppSettingsConfig;
  onUpdateAppConfig: (patch: Partial<AppSettingsConfig>) => void;
  onPickDefaultOutputDir: () => void;
};

export function SettingsGeneralTab({
  app,
  onUpdateAppConfig,
  onPickDefaultOutputDir,
}: SettingsGeneralTabProps) {
  return (
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
  );
}
