import {useEffect, useMemo, useState} from 'react';
import {
  FileKey2,
  FileSearch,
  FolderOpen,
  History,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import {defaultSettings, type AppLogEntry, type MaskDocxResult, type RestoreDocxResult, type Settings as AppSettings} from '@app/shared';
import {Alert, Badge, Button, Card, Input, Label, Textarea, cn} from '../components/ui';
import {localApi} from '../lib/local-api';

type ActiveTab = 'mask' | 'restore' | 'settings' | 'logs';
type LastResult = MaskDocxResult | RestoreDocxResult;

export function WorkbenchPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mask');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsText, setSettingsText] = useState(JSON.stringify(defaultSettings, null, 2));
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{type: 'success' | 'error' | 'info'; text: string} | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [maskForm, setMaskForm] = useState({inputPath: '', outputDir: '', password: ''});
  const [restoreForm, setRestoreForm] = useState({maskedDocxPath: '', restoreFilePath: '', outputDir: '', password: ''});

  const enabledRules = useMemo(() => settings.rules.filter((rule) => rule.enabled), [settings]);

  useEffect(() => {
    void refreshSettings();
    void refreshLogs();
  }, []);

  async function refreshSettings() {
    const next = await localApi.readSettings();
    setSettings(next);
    setSettingsText(JSON.stringify(next, null, 2));
  }

  async function refreshLogs() {
    setLogs(await localApi.readLogs());
  }

  function showNotice(type: 'success' | 'error' | 'info', text: string) {
    setNotice({type, text});
    window.setTimeout(() => setNotice(null), 4200);
  }

  async function pickDocx(target: 'mask' | 'restore') {
    const path = await localApi.selectDocx();
    if (!path) {
      return;
    }
    if (target === 'mask') {
      setMaskForm((current) => ({...current, inputPath: path}));
    } else {
      setRestoreForm((current) => ({...current, maskedDocxPath: path}));
    }
  }

  async function pickRestoreFile() {
    const path = await localApi.selectRestoreFile();
    if (path) {
      setRestoreForm((current) => ({...current, restoreFilePath: path}));
    }
  }

  async function pickOutputDir(target: 'mask' | 'restore') {
    const path = await localApi.selectOutputDir();
    if (!path) {
      return;
    }
    if (target === 'mask') {
      setMaskForm((current) => ({...current, outputDir: path}));
    } else {
      setRestoreForm((current) => ({...current, outputDir: path}));
    }
  }

  async function runMask() {
    if (!maskForm.inputPath || !maskForm.password) {
      showNotice('error', '请选择原始 docx 并输入还原密码');
      return;
    }

    setBusy(true);
    try {
      const result = await localApi.maskDocx({
        inputPath: maskForm.inputPath,
        outputDir: maskForm.outputDir || undefined,
        password: maskForm.password,
        settings,
      });
      setLastResult(result);
      showNotice('success', '脱敏完成');
      await refreshLogs();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '脱敏失败');
    } finally {
      setBusy(false);
    }
  }

  async function runRestore() {
    if (!restoreForm.maskedDocxPath || !restoreForm.restoreFilePath || !restoreForm.password) {
      showNotice('error', '请选择脱敏 docx、restore.enc 并输入密码');
      return;
    }

    setBusy(true);
    try {
      const result = await localApi.restoreDocx({
        maskedDocxPath: restoreForm.maskedDocxPath,
        restoreFilePath: restoreForm.restoreFilePath,
        outputDir: restoreForm.outputDir || undefined,
        password: restoreForm.password,
      });
      setLastResult(result);
      showNotice('success', '还原完成');
      await refreshLogs();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '还原失败');
    } finally {
      setBusy(false);
    }
  }

  async function saveSettingsJson() {
    try {
      const parsed = JSON.parse(settingsText) as AppSettings;
      const saved = await localApi.saveSettings(parsed);
      setSettings(saved);
      setSettingsText(JSON.stringify(saved, null, 2));
      showNotice('success', '设置已保存');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : '设置 JSON 无效');
    }
  }

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div>
          <div className="brand-mark"><FileKey2 size={22} /></div>
          <h1>DocCipher</h1>
          <p>离线 Word 文档脱敏客户端</p>
        </div>

        <div className="side-metrics">
          <Metric label="启用规则" value={enabledRules.length} />
          <Metric label="规则版本" value={settings.version} />
        </div>

        {lastResult && (
          <Card className="result-card">
            <h2>最近结果</h2>
            {Object.entries(lastResult).map(([key, value]) => (
              <div className="result-row" key={key}>
                <span>{key}</span>
                <code>{value}</code>
              </div>
            ))}
          </Card>
        )}
      </aside>

      <section className="main-panel">
        <div className="topbar">
          <nav className="tabs" aria-label="工作区">
            <TabButton active={activeTab === 'mask'} icon={<ShieldCheck size={16} />} onClick={() => setActiveTab('mask')}>脱敏</TabButton>
            <TabButton active={activeTab === 'restore'} icon={<Undo2 size={16} />} onClick={() => setActiveTab('restore')}>还原</TabButton>
            <TabButton active={activeTab === 'settings'} icon={<Settings size={16} />} onClick={() => setActiveTab('settings')}>规则</TabButton>
            <TabButton active={activeTab === 'logs'} icon={<History size={16} />} onClick={() => setActiveTab('logs')}>日志</TabButton>
          </nav>
          {notice && <div className={cn('notice', `notice-${notice.type}`)}>{notice.text}</div>}
        </div>

        {activeTab === 'mask' && (
          <Card className="tool-card">
            <PanelTitle title="生成脱敏文件" description="输出 masked.docx 和独立加密 restore.enc。" />
            <PathField label="原始 docx" value={maskForm.inputPath} onPick={() => pickDocx('mask')} />
            <PathField label="输出目录" value={maskForm.outputDir} onPick={() => pickOutputDir('mask')} placeholder="默认输出到原文件旁的 output 目录" />
            <Field label="还原密码">
              <Input type="password" value={maskForm.password} onChange={(event) => setMaskForm((current) => ({...current, password: event.target.value}))} />
            </Field>
            <Button onClick={runMask} disabled={busy}>
              {busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
              生成脱敏文件
            </Button>
          </Card>
        )}

        {activeTab === 'restore' && (
          <Card className="tool-card">
            <PanelTitle title="还原 Word 文档" description="还原前会校验 restore.enc 与 masked.docx 指纹。" />
            <PathField label="脱敏 docx" value={restoreForm.maskedDocxPath} onPick={() => pickDocx('restore')} />
            <PathField label="还原文件" value={restoreForm.restoreFilePath} onPick={pickRestoreFile} />
            <PathField label="输出目录" value={restoreForm.outputDir} onPick={() => pickOutputDir('restore')} placeholder="默认输出到脱敏文件旁的 output 目录" />
            <Field label="还原密码">
              <Input type="password" value={restoreForm.password} onChange={(event) => setRestoreForm((current) => ({...current, password: event.target.value}))} />
            </Field>
            <Button onClick={runRestore} disabled={busy}>
              {busy ? <Loader2 className="spin" size={16} /> : <Undo2 size={16} />}
              生成还原文件
            </Button>
          </Card>
        )}

        {activeTab === 'settings' && (
          <div className="stack">
            <div className="rules-grid">
              {settings.rules.map((rule) => (
                <Card className="rule-card" key={rule.id}>
                  <div>
                    <h3>{rule.name}</h3>
                    <p>{rule.id}</p>
                  </div>
                  <Badge variant={rule.enabled ? 'success' : 'secondary'}>{rule.enabled ? '启用' : '停用'}</Badge>
                  <Badge>{rule.type}</Badge>
                </Card>
              ))}
            </div>
            <Card className="tool-card">
              <PanelTitle title="setting.json" description="规则使用 zod 校验，保存后立即作为本地配置。" />
              <Textarea value={settingsText} onChange={(event) => setSettingsText(event.target.value)} rows={18} spellCheck={false} />
              <div className="actions">
                <Button variant="outline" onClick={refreshSettings}><RefreshCw size={16} /> 重载</Button>
                <Button onClick={saveSettingsJson}><Save size={16} /> 保存</Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'logs' && (
          <Card className="tool-card">
            <PanelTitle title="本地日志" description="仅展示最近 200 行应用日志。" />
            <Button variant="outline" onClick={refreshLogs}><RefreshCw size={16} /> 刷新</Button>
            {logs.length === 0 ? (
              <Alert>暂无日志</Alert>
            ) : (
              <div className="log-list">
                {logs.map((entry, index) => (
                  <div className="log-line" key={`${entry.timestamp}-${index}`}>
                    <Badge>{entry.level}</Badge>
                    <span>{entry.timestamp}</span>
                    <p>{entry.message}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </section>
    </main>
  );
}

function Metric({label, value}: {label: string; value: string | number}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TabButton({active, icon, children, onClick}: {active: boolean; icon: React.ReactNode; children: React.ReactNode; onClick: () => void}) {
  return (
    <button className={cn('tab-button', active && 'tab-button-active')} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function PanelTitle({title, description}: {title: string; description: string}) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PathField({label, value, onPick, placeholder}: {label: string; value: string; onPick: () => void; placeholder?: string}) {
  return (
    <Field label={label}>
      <div className="path-field">
        <Input value={value} readOnly placeholder={placeholder} />
        <Button type="button" variant="outline" onClick={onPick} aria-label={`选择${label}`}>
          <FolderOpen size={16} />
        </Button>
        <Button type="button" variant="ghost" onClick={onPick} aria-label={`浏览${label}`}>
          <FileSearch size={16} />
        </Button>
      </div>
    </Field>
  );
}
