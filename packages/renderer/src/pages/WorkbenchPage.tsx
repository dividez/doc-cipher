import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileKey2,
  FolderOpen,
  History,
  Home,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  defaultSettings,
  type AppLogEntry,
  type MaskDocxResult,
  type MaskingRule,
  type RestoreDocxResult,
  type Settings as AppSettings,
} from '@app/shared';
import {Badge, Button, Card, Input, Label, Textarea, cn} from '../components/ui';
import {getDebugApi} from '../lib/debug-api';
import {getLocalApi, isLocalApiReady} from '../lib/local-api';
import {loadRecentTasks, pushRecentTask, type RecentTask} from '../lib/recent-tasks';

type ActiveView = 'home' | 'mask' | 'restore' | 'rules';
type LastResult = MaskDocxResult | RestoreDocxResult;

export function WorkbenchPage() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsText, setSettingsText] = useState(JSON.stringify(defaultSettings, null, 2));
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{type: 'success' | 'error' | 'info'; text: string} | null>(null);
  const [maskResult, setMaskResult] = useState<MaskDocxResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreDocxResult | null>(null);
  const [maskForm, setMaskForm] = useState({inputPath: '', outputDir: '', password: ''});
  const [restoreForm, setRestoreForm] = useState({maskedDocxPath: '', restoreFilePath: '', outputDir: '', password: ''});
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>(() => loadRecentTasks());
  const [logBarExpanded, setLogBarExpanded] = useState(false);
  const [rulesListOpen, setRulesListOpen] = useState(false);
  const [advancedJsonOpen, setAdvancedJsonOpen] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [devDebugOpen, setDevDebugOpen] = useState(false);
  const [devPingResult, setDevPingResult] = useState<{message: string; time: string} | null>(null);
  const [devFilePath, setDevFilePath] = useState<string | null>(null);
  const [devMaskResult, setDevMaskResult] = useState<{success: boolean; outputPath: string} | null>(null);

  const enabledRules = useMemo(() => settings.rules.filter((rule) => rule.enabled), [settings]);
  const latestLogs = useMemo(() => logs.slice(-5), [logs]);

  const showNotice = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setNotice({type, text});
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const refreshLogs = useCallback(async () => {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const entries = await getLocalApi().readLogs();
      setLogs(entries);
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }, [showNotice]);

  const refreshSettings = useCallback(async () => {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const next = await getLocalApi().readSettings();
      setSettings(next);
      setSettingsText(JSON.stringify(next, null, 2));
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }, [showNotice]);

  useEffect(() => {
    if (!isLocalApiReady()) {
      return;
    }
    void refreshSettings();
    void refreshLogs();
    const timer = window.setInterval(() => void refreshLogs(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshLogs, refreshSettings]);

  function selectDocxFile(path: string, target: 'mask' | 'restore' | 'home' = 'mask') {
    pushRecentTask(path);
    setRecentTasks(loadRecentTasks());
    if (target === 'restore') {
      setRestoreForm((current) => ({...current, maskedDocxPath: path}));
      setActiveView('restore');
      return;
    }
    setMaskForm((current) => ({...current, inputPath: path}));
    setMaskResult(null);
    setActiveView('mask');
  }

  const pickDocx = useCallback(async (target: 'mask' | 'restore') => {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const path = await getLocalApi().selectDocx();
      if (path) {
        selectDocxFile(path, target);
      }
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }, [showNotice]);

  async function pickRestoreFile() {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const path = await getLocalApi().selectRestoreFile();
      if (path) {
        setRestoreForm((current) => ({...current, restoreFilePath: path}));
      }
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function pickOutputDir(target: 'mask' | 'restore') {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const path = await getLocalApi().selectOutputDir();
      if (!path) {
        return;
      }
      if (target === 'mask') {
        setMaskForm((current) => ({...current, outputDir: path}));
      } else {
        setRestoreForm((current) => ({...current, outputDir: path}));
      }
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function openInFolder(filePath: string) {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const api = getLocalApi();
      if (typeof api.showItemInFolder === 'function') {
        await api.showItemInFolder(filePath);
      }
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  function handleDrop(event: React.DragEvent, target: 'home' | 'mask') {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (!file) {
      return;
    }
    const path = getDroppedPath(file);
    if (!path) {
      showNotice('error', '无法读取拖拽文件路径，请使用「选择文件」按钮');
      return;
    }
    if (!path.toLowerCase().endsWith('.docx')) {
      showNotice('error', '仅支持 .docx 文件');
      return;
    }
    selectDocxFile(path, target === 'home' ? 'mask' : 'mask');
  }

  async function runMask() {
    if (!maskForm.inputPath || !maskForm.password) {
      showNotice('error', '请选择 docx 并输入还原密码');
      return;
    }
    setBusy(true);
    try {
      const result = await getLocalApi().maskDocx({
        inputPath: maskForm.inputPath,
        outputDir: maskForm.outputDir || undefined,
        password: maskForm.password,
        settings,
      });
      setMaskResult(result);
      pushRecentTask(maskForm.inputPath);
      setRecentTasks(loadRecentTasks());
      showNotice('success', `脱敏完成，共替换 ${result.itemCount} 处`);
      await refreshLogs();
    } catch (error) {
      showNotice('error', formatError(error));
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
      const result = await getLocalApi().restoreDocx({
        maskedDocxPath: restoreForm.maskedDocxPath,
        restoreFilePath: restoreForm.restoreFilePath,
        outputDir: restoreForm.outputDir || undefined,
        password: restoreForm.password,
      });
      setRestoreResult(result);
      showNotice('success', '还原完成');
      await refreshLogs();
    } catch (error) {
      showNotice('error', formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettingsJson() {
    try {
      const parsed = JSON.parse(settingsText) as AppSettings;
      const saved = await getLocalApi().saveSettings(parsed);
      setSettings(saved);
      setSettingsText(JSON.stringify(saved, null, 2));
      showNotice('success', '规则已保存');
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function toggleRule(ruleId: string) {
    const nextRules = settings.rules.map((rule) =>
      rule.id === ruleId ? {...rule, enabled: !rule.enabled} : rule,
    );
    const next = {...settings, rules: nextRules};
    try {
      const saved = await getLocalApi().saveSettings(next);
      setSettings(saved);
      setSettingsText(JSON.stringify(saved, null, 2));
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  return (
    <div className="workspace">
      <header className="status-bar">
        <div className="status-left">
          <FileKey2 size={16} />
          <span>DocCipher</span>
          <span className="status-sub">本地 · 离线</span>
        </div>
        <div className="status-right">
          {notice && <span className={cn('status-notice', `status-notice-${notice.type}`)}>{notice.text}</span>}
        </div>
      </header>

      <div className="workspace-body">
        <aside className="sidebar">
          <SidebarNav activeView={activeView} onNavigate={setActiveView} />
          {maskResult && activeView === 'mask' && (
            <Card className="sidebar-result">
              <p className="sidebar-result-title">最近输出</p>
              <ResultFile name={fileName(maskResult.maskedDocxPath)} />
              <ResultFile name={fileName(maskResult.restoreFilePath)} />
            </Card>
          )}
        </aside>

        <main className="work-area">
          {activeView === 'home' && (
            <HomePanel
              dragOver={dragOver}
              recentTasks={recentTasks}
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, 'home')}
              onPick={() => void pickDocx('mask')}
              onOpenRecent={(path) => selectDocxFile(path, 'mask')}
            />
          )}

          {activeView === 'mask' && (
            <MaskPanel
              busy={busy}
              dragOver={dragOver}
              enabledRules={enabledRules}
              form={maskForm}
              result={maskResult}
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, 'mask')}
              onFormChange={setMaskForm}
              onOpenFolder={openInFolder}
              onPickDocx={() => void pickDocx('mask')}
              onPickOutput={() => void pickOutputDir('mask')}
              onRun={() => void runMask()}
              onGoRules={() => setActiveView('rules')}
              onReset={() => {
                setMaskResult(null);
                setMaskForm({inputPath: '', outputDir: '', password: ''});
                setActiveView('home');
              }}
            />
          )}

          {activeView === 'restore' && (
            <RestorePanel
              busy={busy}
              form={restoreForm}
              result={restoreResult}
              onFormChange={setRestoreForm}
              onOpenFolder={openInFolder}
              onPickDocx={() => void pickDocx('restore')}
              onPickRestore={() => void pickRestoreFile()}
              onPickOutput={() => void pickOutputDir('restore')}
              onRun={() => void runRestore()}
            />
          )}

          {activeView === 'rules' && (
            <RulesPanel
              settings={settings}
              enabledCount={enabledRules.length}
              rulesListOpen={rulesListOpen}
              advancedJsonOpen={advancedJsonOpen}
              expandedRuleId={expandedRuleId}
              settingsText={settingsText}
              onToggleRulesList={() => setRulesListOpen((open) => !open)}
              onToggleAdvanced={() => setAdvancedJsonOpen((open) => !open)}
              onExpandRule={setExpandedRuleId}
              onToggleRule={(id) => void toggleRule(id)}
              onSettingsTextChange={setSettingsText}
              onReload={() => void refreshSettings()}
              onSave={() => void saveSettingsJson()}
            />
          )}
        </main>
      </div>

      <DevDebugPanel
        open={devDebugOpen}
        pingResult={devPingResult}
        filePath={devFilePath}
        maskResult={devMaskResult}
        onToggle={() => setDevDebugOpen((value) => !value)}
        onPing={async () => {
          const api = getDebugApi();
          if (!api) {
            console.error('IPC bridge not available');
            return;
          }
          try {
            const res = await api.ping();
            console.log(res);
            setDevPingResult(res);
          } catch (error) {
            console.error(error);
            setDevPingResult(null);
          }
        }}
        onSelectDocx={async () => {
          const api = getDebugApi();
          if (!api) {
            console.error('IPC bridge not available');
            return;
          }
          try {
            const path = await api.selectDocx();
            console.log(path);
            setDevFilePath(path);
          } catch (error) {
            console.error(error);
            setDevFilePath(null);
          }
        }}
        onSelectAndMask={async () => {
          const api = getDebugApi();
          if (!api) {
            console.error('IPC bridge not available');
            return;
          }
          try {
            const path = await api.selectDocx();
            if (!path) {
              return;
            }
            setDevFilePath(path);
            const result = await api.maskDocx({filePath: path});
            console.log(result);
            setDevMaskResult(result);
          } catch (error) {
            console.error(error);
            setDevMaskResult(null);
          }
        }}
      />

      <footer className={cn('log-bar', logBarExpanded && 'log-bar-expanded')}>
        <button type="button" className="log-bar-toggle" onClick={() => setLogBarExpanded((open) => !open)}>
          {logBarExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <History size={14} />
          <span>实时日志</span>
          {latestLogs.length > 0 && <Badge variant="secondary">{logs.length}</Badge>}
        </button>
        <div className="log-bar-content">
          {(logBarExpanded ? logs.slice().reverse() : latestLogs.slice().reverse()).map((entry, index) => (
            <div className="log-bar-line" key={`${entry.timestamp}-${index}`}>
              <span className="log-time">{entry.timestamp}</span>
              <span className={cn('log-level', `log-level-${entry.level.toLowerCase()}`)}>{entry.level}</span>
              <span className="log-msg">{entry.message}</span>
            </div>
          ))}
          {logs.length === 0 && <span className="log-empty">暂无日志</span>}
        </div>
        <Button type="button" variant="ghost" className="log-refresh" onClick={() => void refreshLogs()}>
          <RefreshCw size={14} />
        </Button>
      </footer>

    </div>
  );
}

function DevDebugPanel({
  open,
  pingResult,
  filePath,
  maskResult,
  onToggle,
  onPing,
  onSelectDocx,
  onSelectAndMask,
}: {
  open: boolean;
  pingResult: {message: string; time: string} | null;
  filePath: string | null;
  maskResult: {success: boolean; outputPath: string} | null;
  onToggle: () => void;
  onPing: () => void;
  onSelectDocx: () => void;
  onSelectAndMask: () => void;
}) {
  return (
    <section className="dev-debug">
      <button type="button" className="dev-debug-toggle" onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>开发调试</span>
      </button>
      {open && (
        <div className="dev-debug-body">
          <div className="dev-debug-actions">
            <Button type="button" variant="outline" onClick={onPing}>Ping Main</Button>
            <Button type="button" variant="outline" onClick={onSelectDocx}>选择 Word 文件</Button>
            <Button type="button" variant="outline" onClick={onSelectAndMask}>选择并脱敏（smoke）</Button>
          </div>
          <div className="dev-debug-output">
            {pingResult && (
              <p>
                ping: {pingResult.message} @ {pingResult.time}
              </p>
            )}
            {filePath && <p>file: {filePath}</p>}
            {maskResult && <p>output: {maskResult.outputPath}</p>}
            {!pingResult && !filePath && !maskResult && <p className="dev-debug-empty">暂无调试输出</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function SidebarNav({activeView, onNavigate}: {activeView: ActiveView; onNavigate: (view: ActiveView) => void}) {
  return (
    <nav className="sidebar-nav" aria-label="主导航">
      <div className="sidebar-brand">
        <div className="brand-mark"><FileKey2 size={20} /></div>
        <div>
          <h1>DocCipher</h1>
          <p>本地安全文档工作台</p>
        </div>
      </div>
      <div className="nav-flow">
        <NavItem active={activeView === 'home'} icon={<Home size={16} />} label="工作台" onClick={() => onNavigate('home')} />
        <NavItem active={activeView === 'mask'} icon={<ShieldCheck size={16} />} label="脱敏" onClick={() => onNavigate('mask')} />
        <NavItem active={activeView === 'restore'} icon={<Undo2 size={16} />} label="还原" onClick={() => onNavigate('restore')} />
      </div>
      <div className="nav-secondary">
        <NavItem active={activeView === 'rules'} icon={<Settings size={14} />} label="规则" secondary onClick={() => onNavigate('rules')} />
      </div>
    </nav>
  );
}

function NavItem({
  active,
  icon,
  label,
  secondary,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  secondary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('nav-item', active && 'nav-item-active', secondary && 'nav-item-secondary')}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function HomePanel({
  dragOver,
  recentTasks,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onPick,
  onOpenRecent,
}: {
  dragOver: boolean;
  recentTasks: RecentTask[];
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onPick: () => void;
  onOpenRecent: (path: string) => void;
}) {
  return (
    <div className="panel-stack">
      <PanelHero title="选择文件开始脱敏" description="拖拽 docx 到下方区域，或点击选择文件。所有处理均在本地完成。" />
      <div
        className={cn('drop-zone', dragOver && 'drop-zone-active')}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Upload size={28} />
        <p>拖拽 docx 到这里</p>
        <Button type="button" onClick={onPick}>选择文件</Button>
      </div>
      {recentTasks.length > 0 && (
        <Card className="recent-card">
          <h3>最近任务</h3>
          <ul className="recent-list">
            {recentTasks.map((task) => (
              <li key={task.path}>
                <button type="button" className="recent-item" onClick={() => onOpenRecent(task.path)}>
                  <span>{task.name}</span>
                  <span className="recent-meta">{formatRecentTime(task.timestamp)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MaskPanel({
  busy,
  dragOver,
  enabledRules,
  form,
  result,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFormChange,
  onOpenFolder,
  onPickDocx,
  onPickOutput,
  onRun,
  onGoRules,
  onReset,
}: {
  busy: boolean;
  dragOver: boolean;
  enabledRules: MaskingRule[];
  form: {inputPath: string; outputDir: string; password: string};
  result: MaskDocxResult | null;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onFormChange: React.Dispatch<React.SetStateAction<{inputPath: string; outputDir: string; password: string}>>;
  onOpenFolder: (path: string) => void;
  onPickDocx: () => void;
  onPickOutput: () => void;
  onRun: () => void;
  onGoRules: () => void;
  onReset: () => void;
}) {
  const hasFile = !!form.inputPath;

  return (
    <div className="panel-stack">
      <PanelHero
        title={hasFile ? fileName(form.inputPath) : '脱敏任务'}
        description={hasFile ? '配置规则与密码后，开始本地脱敏。' : '请先选择或拖入 Word 文档。'}
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
          <Button type="button" variant="outline" onClick={onPickDocx}>选择文件</Button>
        </div>
      )}

      {hasFile && (
        <Card className="task-card">
          <div className="task-actions">
            <Button type="button" onClick={onRun} disabled={busy}>
              {busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
              开始脱敏
            </Button>
            <Button type="button" variant="outline" onClick={onGoRules}>配置规则</Button>
            {result && (
              <Button type="button" variant="ghost" onClick={onReset}>重新选择</Button>
            )}
          </div>

          <section className="rules-summary">
            <div className="section-head">
              <h3>检测规则</h3>
              <span className="section-meta">{enabledRules.length} 项已启用</span>
            </div>
            <ul className="rule-chips">
              {enabledRules.map((rule) => (
                <li key={rule.id}>
                  <span className="rule-chip">
                    <Check size={12} />
                    {rule.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Field label="还原密码">
            <Input
              type="password"
              value={form.password}
              onChange={(event) => onFormChange((current) => ({...current, password: event.target.value}))}
              placeholder="用于加密 restore.enc"
            />
          </Field>

          <Field label="输出目录（可选）">
            <div className="path-field">
              <Input value={form.outputDir} readOnly placeholder="默认：原文件旁的 output 目录" />
              <Button type="button" variant="outline" onClick={onPickOutput} aria-label="选择输出目录">
                <FolderOpen size={16} />
              </Button>
            </div>
          </Field>
        </Card>
      )}

      {result && (
        <Card className="result-panel">
          <h3>已生成</h3>
          <ul className="result-files">
            <ResultFileRow path={result.maskedDocxPath} onOpen={() => onOpenFolder(result.maskedDocxPath)} />
            <ResultFileRow path={result.restoreFilePath} onOpen={() => onOpenFolder(result.restoreFilePath)} />
          </ul>
          <p className="result-stats">共替换 {result.itemCount} 处敏感信息</p>
          <div className="result-actions">
            <Button type="button" variant="outline" onClick={() => onOpenFolder(result.maskedDocxPath)}>
              <FolderOpen size={16} /> 打开目录
            </Button>
            <Button type="button" variant="ghost" onClick={onReset}>重新脱敏</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function RestorePanel({
  busy,
  form,
  result,
  onFormChange,
  onOpenFolder,
  onPickDocx,
  onPickRestore,
  onPickOutput,
  onRun,
}: {
  busy: boolean;
  form: {maskedDocxPath: string; restoreFilePath: string; outputDir: string; password: string};
  result: RestoreDocxResult | null;
  onFormChange: React.Dispatch<React.SetStateAction<{maskedDocxPath: string; restoreFilePath: string; outputDir: string; password: string}>>;
  onOpenFolder: (path: string) => void;
  onPickDocx: () => void;
  onPickRestore: () => void;
  onPickOutput: () => void;
  onRun: () => void;
}) {
  return (
    <div className="panel-stack">
      <PanelHero title="还原文档" description="使用脱敏 docx 与 restore.enc，在本地还原 Word 文档。" />
      <Card className="task-card">
        <PathField label="脱敏 docx" value={form.maskedDocxPath} onPick={onPickDocx} />
        <PathField label="还原文件 restore.enc" value={form.restoreFilePath} onPick={onPickRestore} />
        <PathField label="输出目录（可选）" value={form.outputDir} onPick={onPickOutput} placeholder="默认输出到脱敏文件旁" />
        <Field label="还原密码">
          <Input
            type="password"
            value={form.password}
            onChange={(event) => onFormChange((current) => ({...current, password: event.target.value}))}
          />
        </Field>
        <Button type="button" onClick={onRun} disabled={busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Undo2 size={16} />}
          开始还原
        </Button>
      </Card>
      {result && (
        <Card className="result-panel">
          <h3>已生成</h3>
          <ul className="result-files">
            <ResultFileRow path={result.restoredDocxPath} onOpen={() => onOpenFolder(result.restoredDocxPath)} />
          </ul>
          <p className="result-stats">共还原 {result.itemCount} 处</p>
          <Button type="button" variant="outline" onClick={() => onOpenFolder(result.restoredDocxPath)}>
            <FolderOpen size={16} /> 打开目录
          </Button>
        </Card>
      )}
    </div>
  );
}

function RulesPanel({
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
  onSettingsTextChange: (text: string) => void;
  onReload: () => void;
  onSave: () => void;
}) {
  return (
    <div className="panel-stack">
      <PanelHero title="脱敏规则" description="面向业务的规则名称，高级正则仅在展开后可见。" />
      <Card className="rules-summary-card">
        <div className="rules-stats">
          <div><strong>{enabledCount}</strong><span>已启用</span></div>
          <div><strong>{settings.rules.length}</strong><span>规则总数</span></div>
          <div><strong>{settings.version}</strong><span>版本</span></div>
        </div>
      </Card>

      <Card className="rules-section">
        <button type="button" className="section-toggle" onClick={onToggleRulesList}>
          {rulesListOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>规则列表</span>
        </button>
        {rulesListOpen && (
          <ul className="rules-list">
            {settings.rules.map((rule) => (
              <li key={rule.id} className="rules-list-item">
                <div className="rule-row">
                  <button type="button" className="rule-expand" onClick={() => onExpandRule(expandedRuleId === rule.id ? null : rule.id)}>
                    {expandedRuleId === rule.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
          <span>高级 · setting.json</span>
        </button>
        {advancedJsonOpen && (
          <>
            <Textarea value={settingsText} onChange={(event) => onSettingsTextChange(event.target.value)} rows={16} spellCheck={false} />
            <div className="actions">
              <Button type="button" variant="outline" onClick={onReload}><RefreshCw size={16} /> 重载</Button>
              <Button type="button" onClick={onSave}><Save size={16} /> 保存</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function RuleDetail({rule}: {rule: MaskingRule}) {
  if (rule.type === 'regex') {
    return (
      <div className="rule-detail">
        <Label>匹配模式</Label>
        <code>{rule.pattern}</code>
        <Label>占位符</Label>
        <code>{rule.placeholder}</code>
      </div>
    );
  }
  if (rule.type === 'keyword') {
    return (
      <div className="rule-detail">
        <Label>关键词</Label>
        <code>{rule.keywords.join('、')}</code>
        <Label>占位符</Label>
        <code>{rule.placeholder}</code>
      </div>
    );
  }
  return (
    <div className="rule-detail">
      <Label>手动项</Label>
      <code>{rule.selections.length > 0 ? rule.selections.join('、') : '（暂无）'}</code>
      <Label>占位符</Label>
      <code>{rule.placeholder}</code>
    </div>
  );
}

function PanelHero({title, description}: {title: string; description: string}) {
  return (
    <header className="panel-hero">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
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
      </div>
    </Field>
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

function ResultFile({name}: {name: string}) {
  return (
    <div className="result-file-mini">
      <Check size={12} />
      <span>{name}</span>
    </div>
  );
}

function ResultFileRow({path, onOpen}: {path: string; onOpen: () => void}) {
  return (
    <li>
      <Check size={14} className="result-check" />
      <span className="result-name">{fileName(path)}</span>
      <button type="button" className="result-open" onClick={onOpen}>打开</button>
    </li>
  );
}


function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

function formatRecentTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
  } catch {
    return '';
  }
}

function ruleTypeLabel(rule: MaskingRule): string {
  if (rule.type === 'regex') {
    return '正则匹配';
  }
  if (rule.type === 'keyword') {
    return '关键词匹配';
  }
  return '手动项';
}

function getDroppedPath(file: File): string | null {
  const electronFile = file as File & {path?: string};
  return electronFile.path ?? null;
}
