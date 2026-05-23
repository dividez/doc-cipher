import { RefreshCw, Save } from 'lucide-react';
import { Button, Card, Textarea } from '../../../components/ui.js';

type SettingsAdvancedTabProps = {
  settingsText: string;
  onSettingsTextChange: (text: string) => void;
  onReload: () => void;
  onSave: () => void;
};

export function SettingsAdvancedTab({
  settingsText,
  onSettingsTextChange,
  onReload,
  onSave,
}: SettingsAdvancedTabProps) {
  return (
    <Card className="rules-section app-settings-advanced-card">
      <div className="section-head">
        <h3>应用配置 JSON</h3>
        <span className="section-meta">修改默认规则模板，保存后立即生效</span>
      </div>
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
    </Card>
  );
}
