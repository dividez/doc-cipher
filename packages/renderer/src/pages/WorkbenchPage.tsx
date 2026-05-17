import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  defaultSettings,
  extractSystemKeywords,
  manualSelectionsOverlap,
  type AppLogEntry,
  type DocxManualSelection,
  type DocxMatchPreviewResult,
  type DocxPreviewResult,
  type MaskDocxResult,
  type MaskProfile,
  type MaskingRule,
  type RestoreDocxResult,
  type Settings as AppSettings,
  type AppSettingsConfig,
  type TaskHistoryEntry,
} from '@app/shared';
import { AppIcon } from '../components/AppIcon.js';
import { Badge, Button, Card, cn } from '../components/ui.js';
import { getDebugApi } from '../lib/debug-api.js';
import { getLocalApi, isLocalApiReady } from '../lib/local-api.js';
import { loadRecentTasks, pushRecentTask, type RecentTask } from '../lib/recent-tasks.js';
import { AppSettingsPanel } from './workbench/AppSettingsPanel.js';
import { HomePanel } from './workbench/HomePanel.js';
import { MaskPanel } from './workbench/MaskPanel.js';
import { ProfilesPanel } from './workbench/ProfilesPanel.js';
import { RestorePanel } from './workbench/RestorePanel.js';
import { DevDebugPanel, ResultFile, SidebarNav } from './workbench/workbench-ui.js';
import {
  buildSettingsWithProfileKeywords,
  compactText,
  dedupeKeywordDraftLines,
  extractProfileKeywords,
  fileName,
  filterExecutableRules,
  formatError,
  getDroppedPath,
  withGlobalAppConfig,
} from './workbench/workbench-utils.js';
import type { ActiveView, ManualSelectionDraft } from './workbench/types.js';

export function WorkbenchPage() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [templateSettings, setTemplateSettings] = useState<AppSettings>(defaultSettings);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsText, setSettingsText] = useState(JSON.stringify(defaultSettings, null, 2));
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const [maskResult, setMaskResult] = useState<MaskDocxResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreDocxResult | null>(null);
  const [docxPreview, setDocxPreview] = useState<DocxPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [manualSelections, setManualSelections] = useState<DocxManualSelection[]>([]);
  const [matchPreview, setMatchPreview] = useState<DocxMatchPreviewResult | null>(null);
  const [matchPreviewLoading, setMatchPreviewLoading] = useState(false);
  const [matchPreviewDialogOpen, setMatchPreviewDialogOpen] = useState(false);
  const matchPreviewDebounceRef = useRef<number | null>(null);
  const [maskProfiles, setMaskProfiles] = useState<MaskProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileDraftName, setProfileDraftName] = useState('');
  const [profileDraftKeywords, setProfileDraftKeywords] = useState('');
  const [maskForm, setMaskForm] = useState({ inputPath: '', outputDir: '', password: '' });
  const [restoreForm, setRestoreForm] = useState({
    maskedDocxPath: '',
    restoreFilePath: '',
    outputDir: '',
    password: '',
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>(() => loadRecentTasks());
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [taskHistoryRefreshing, setTaskHistoryRefreshing] = useState(false);
  const [logBarExpanded, setLogBarExpanded] = useState(false);
  const [rulesListOpen, setRulesListOpen] = useState(false);
  const [advancedJsonOpen, setAdvancedJsonOpen] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [devDebugOpen, setDevDebugOpen] = useState(false);
  const [devPingResult, setDevPingResult] = useState<{ message: string; time: string } | null>(
    null,
  );
  const [devFilePath, setDevFilePath] = useState<string | null>(null);
  const [devMaskResult, setDevMaskResult] = useState<{
    success: boolean;
    outputPath: string;
  } | null>(null);

  const enabledRules = useMemo(
    () => filterExecutableRules(settings, templateSettings.app),
    [settings, templateSettings.app],
  );
  const templateEnabledRules = useMemo(
    () => templateSettings.rules.filter((rule) => rule.enabled),
    [templateSettings],
  );
  const latestLogs = useMemo(() => logs.slice(-5), [logs]);
  const selectedProfile = useMemo(
    () => maskProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [maskProfiles, selectedProfileId],
  );

  const showNotice = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setNotice({ type, text });
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
      setTemplateSettings(next);
      if (!activeProfileId) {
        setSettings(next);
      }
      setSettingsText(JSON.stringify(next, null, 2));
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }, [activeProfileId, showNotice]);

  const refreshMaskProfiles = useCallback(async () => {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const profiles = await getLocalApi().listMaskProfiles();
      setMaskProfiles(profiles);
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }, [showNotice]);

  const refreshTaskHistory = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isLocalApiReady()) {
        return;
      }
      setTaskHistoryRefreshing(true);
      try {
        const entries = await getLocalApi().listTaskHistory(100);
        setTaskHistory(entries);
        if (!options?.silent) {
          showNotice(
            'info',
            entries.length > 0
              ? `任务历史已更新，共 ${entries.length} 条`
              : '任务历史已更新，暂无记录',
          );
        }
      } catch (error) {
        showNotice('error', formatError(error));
      } finally {
        setTaskHistoryRefreshing(false);
      }
    },
    [showNotice],
  );

  const loadDocxPreview = useCallback(
    async (path: string) => {
      if (!isLocalApiReady()) {
        return;
      }
      setPreviewLoading(true);
      setDocxPreview(null);
      try {
        const preview = await getLocalApi().previewDocx({ filePath: path });
        setDocxPreview(preview);
        if (preview.blocks.length === 0) {
          showNotice('info', '文档中没有读取到可预览文本');
        }
      } catch (error) {
        showNotice('error', formatError(error));
      } finally {
        setPreviewLoading(false);
      }
    },
    [showNotice],
  );

  const refreshMatchPreview = useCallback(
    async (options?: { silent?: boolean; openDialog?: boolean }) => {
      if (!isLocalApiReady() || !maskForm.inputPath || !docxPreview) {
        if (!options?.silent) {
          showNotice('error', '请先选择文档并等待预览加载');
        }
        return;
      }
      setMatchPreviewLoading(true);
      try {
        const result = await getLocalApi().previewDocxMatches({
          filePath: maskForm.inputPath,
          settings: withGlobalAppConfig(settings, templateSettings.app),
          manualSelections,
        });
        setMatchPreview(result);
        if (options?.openDialog) {
          setMatchPreviewDialogOpen(true);
          showNotice('info', `命中预估：共 ${result.totalHits} 处，未改写文件`);
        }
      } catch (error) {
        if (!options?.silent) {
          showNotice('error', formatError(error));
        }
      } finally {
        setMatchPreviewLoading(false);
      }
    },
    [docxPreview, maskForm.inputPath, settings, templateSettings.app, manualSelections, showNotice],
  );

  useEffect(() => {
    if (!docxPreview || !maskForm.inputPath) {
      return;
    }
    if (matchPreviewDebounceRef.current !== null) {
      window.clearTimeout(matchPreviewDebounceRef.current);
    }
    matchPreviewDebounceRef.current = window.setTimeout(() => {
      void refreshMatchPreview({ silent: true });
    }, 400);
    return () => {
      if (matchPreviewDebounceRef.current !== null) {
        window.clearTimeout(matchPreviewDebounceRef.current);
      }
    };
  }, [
    docxPreview,
    maskForm.inputPath,
    settings,
    manualSelections,
    templateSettings.app,
    refreshMatchPreview,
  ]);

  useEffect(() => {
    if (!isLocalApiReady()) {
      return;
    }
    void refreshSettings();
    void refreshMaskProfiles();
    void refreshLogs();
    void refreshTaskHistory({ silent: true });
    const timer = window.setInterval(() => void refreshLogs(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshLogs, refreshMaskProfiles, refreshSettings, refreshTaskHistory]);

  useEffect(() => {
    if (selectedProfile) {
      setProfileDraftName(selectedProfile.name);
      setProfileDraftKeywords(extractProfileKeywords(selectedProfile.settings).join('\n'));
      return;
    }
    setProfileDraftName('');
    setProfileDraftKeywords('');
  }, [selectedProfile]);

  function selectDocxFile(path: string, target: 'mask' | 'restore' | 'home' = 'mask') {
    pushRecentTask(path);
    setRecentTasks(loadRecentTasks());
    if (target === 'restore') {
      setRestoreForm((current) => ({ ...current, maskedDocxPath: path }));
      setActiveView('restore');
      return;
    }
    setMaskForm((current) => ({ ...current, inputPath: path }));
    setMaskResult(null);
    setManualSelections([]);
    setActiveView('mask');
    void loadDocxPreview(path);
  }

  const pickDocx = useCallback(
    async (target: 'mask' | 'restore') => {
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
    },
    [showNotice],
  );

  async function pickRestoreFile() {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const path = await getLocalApi().selectRestoreFile();
      if (path) {
        setRestoreForm((current) => ({ ...current, restoreFilePath: path }));
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
        setMaskForm((current) => ({ ...current, outputDir: path }));
      } else {
        setRestoreForm((current) => ({ ...current, outputDir: path }));
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
      let executionSettings = withGlobalAppConfig(settings, templateSettings.app);
      if (manualSelections.length > 0) {
        const activeProfile = maskProfiles.find((profile) => profile.id === activeProfileId);
        const autoName =
          activeProfile?.name || `${fileName(maskForm.inputPath).replace(/\.docx$/i, '')} 脱敏方案`;
        const profileSettings = buildSettingsWithProfileKeywords(settings, manualSelections, '');
        const savedProfile = await getLocalApi().saveMaskProfile({
          id: activeProfile?.id,
          name: autoName,
          settings: withGlobalAppConfig(profileSettings, templateSettings.app),
        });
        executionSettings = withGlobalAppConfig(savedProfile.settings, templateSettings.app);
        setSettings(savedProfile.settings);
        setActiveProfileId(savedProfile.id);
        setSelectedProfileId(savedProfile.id);
        await refreshMaskProfiles();
      }
      const result = await getLocalApi().maskDocx({
        inputPath: maskForm.inputPath,
        outputDir: maskForm.outputDir || templateSettings.app.default_output_dir || undefined,
        password: maskForm.password,
        settings: executionSettings,
        manualSelections,
      });
      setMaskResult(result);
      pushRecentTask(maskForm.inputPath);
      setRecentTasks(loadRecentTasks());
      setDocxPreview(null);
      setMatchPreview(null);
      setMatchPreviewDialogOpen(false);
      setManualSelections([]);
      setMaskForm((current) => ({ ...current, inputPath: '', password: '' }));
      setActiveView('home');
      showNotice('success', `脱敏完成，共替换 ${result.itemCount} 处`);
      await refreshTaskHistory({ silent: true });
      await refreshLogs();
    } catch (error) {
      showNotice('error', formatError(error));
    } finally {
      setBusy(false);
    }
  }

  function addManualSelection(selection: ManualSelectionDraft) {
    const draftAsItem = { ...selection, id: '__draft__' } as DocxManualSelection;
    const overlaps = manualSelections.some((item) => manualSelectionsOverlap(item, draftAsItem));
    if (overlaps) {
      showNotice('error', '这段文字已经和现有手动项重叠');
      return;
    }

    setManualSelections((current) => [
      ...current,
      {
        ...selection,
        id: `manual-${Date.now()}-${current.length + 1}`,
      },
    ]);
    showNotice('success', `已加入手动脱敏：${compactText(selection.text, 18)}`);
  }

  function removeManualSelection(id: string) {
    setManualSelections((current) => current.filter((item) => item.id !== id));
  }

  function selectMaskProfile(profileId: string) {
    setActiveProfileId(profileId);
    setSelectedProfileId(profileId);
    const profile = maskProfiles.find((item) => item.id === profileId);
    if (!profile) {
      setSettings(templateSettings);
      return;
    }
    setSettings({
      ...profile.settings,
      app: templateSettings.app,
    });
    setManualSelections([]);
    showNotice('success', `已切换方案：${profile.name}`);
  }

  function createMaskProfileDraft() {
    setActiveProfileId('');
    setSelectedProfileId('');
    setSettings(templateSettings);
    setManualSelections([]);
    showNotice('info', '已新建临时方案，可命名后保存');
  }

  async function saveCurrentProfile(nameInput?: string, keywordInput?: string) {
    const activeProfile = maskProfiles.find((profile) => profile.id === activeProfileId);
    const defaultName = activeProfile?.name || `脱敏方案 ${maskProfiles.length + 1}`;
    const name = (nameInput ?? activeProfile?.name ?? '').trim() || defaultName;
    if (!name) {
      return;
    }

    try {
      const profileSettings = buildSettingsWithProfileKeywords(
        settings,
        manualSelections,
        keywordInput ?? extractProfileKeywords(settings).join('\n'),
      );
      const saved = await getLocalApi().saveMaskProfile({
        id: activeProfile?.id,
        name,
        settings: profileSettings,
      });
      setSettings(saved.settings);
      setActiveProfileId(saved.id);
      setSelectedProfileId(saved.id);
      setManualSelections([]);
      await refreshMaskProfiles();
      showNotice('success', `方案已保存：${saved.name}`);
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function deleteCurrentProfile() {
    const activeProfile = maskProfiles.find((profile) => profile.id === activeProfileId);
    if (!activeProfile) {
      return;
    }

    try {
      await getLocalApi().deleteMaskProfile(activeProfile.id);
      setActiveProfileId('');
      setSelectedProfileId('');
      setSettings(templateSettings);
      await refreshMaskProfiles();
      showNotice('success', '方案已删除');
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function saveSelectedProfile() {
    if (!selectedProfile) {
      return;
    }
    try {
      const nextSettings = buildSettingsWithProfileKeywords(
        selectedProfile.settings,
        [],
        profileDraftKeywords,
      );
      const saved = await getLocalApi().saveMaskProfile({
        id: selectedProfile.id,
        name: profileDraftName.trim() || selectedProfile.name,
        settings: nextSettings,
      });
      if (activeProfileId === saved.id) {
        setSettings(saved.settings);
      }
      await refreshMaskProfiles();
      showNotice('success', `方案已保存：${saved.name}`);
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function deleteSelectedProfile() {
    if (!selectedProfile) {
      return;
    }
    try {
      await getLocalApi().deleteMaskProfile(selectedProfile.id);
      if (activeProfileId === selectedProfile.id) {
        setActiveProfileId('');
        setSettings(templateSettings);
      }
      setSelectedProfileId('');
      await refreshMaskProfiles();
      showNotice('success', '方案已删除');
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function exportSelectedProfile() {
    if (!selectedProfile) {
      return;
    }
    try {
      const path = await getLocalApi().exportMaskProfile(selectedProfile.id);
      if (path) {
        showNotice('success', `方案已导出：${fileName(path)}`);
      }
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function duplicateSelectedProfile() {
    if (!selectedProfile) {
      return;
    }
    try {
      const saved = await getLocalApi().saveMaskProfile({
        name: `${selectedProfile.name} 副本`,
        settings: structuredClone(selectedProfile.settings),
      });
      await refreshMaskProfiles();
      setSelectedProfileId(saved.id);
      showNotice('success', `已复制为新方案：${saved.name}`);
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function importProfile() {
    try {
      const profile = await getLocalApi().importMaskProfile();
      if (!profile) {
        return;
      }
      await refreshMaskProfiles();
      setSelectedProfileId(profile.id);
      showNotice('success', `方案已导入：${profile.name}`);
    } catch (error) {
      showNotice('error', formatError(error));
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
        outputDir: restoreForm.outputDir || templateSettings.app.default_output_dir || undefined,
        password: restoreForm.password,
      });
      setRestoreResult(result);
      setRestoreForm((current) => ({
        maskedDocxPath: '',
        restoreFilePath: '',
        outputDir: current.outputDir,
        password: '',
      }));
      showNotice('success', '还原完成');
      await refreshTaskHistory({ silent: true });
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
      setTemplateSettings(saved);
      if (!activeProfileId) {
        setSettings(saved);
      }
      setSettingsText(JSON.stringify(saved, null, 2));
      showNotice('success', '默认规则模板已保存');
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function saveTemplateSettings(next: AppSettings) {
    try {
      const saved = await getLocalApi().saveSettings(next);
      setTemplateSettings(saved);
      setSettings((current) => withGlobalAppConfig(current, saved.app));
      setSettingsText(JSON.stringify(saved, null, 2));
      showNotice('success', '应用设置已保存');
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  function updateAppConfig(patch: Partial<AppSettingsConfig>) {
    const next = {
      ...templateSettings,
      app: {
        ...templateSettings.app,
        ...patch,
      },
    };
    void saveTemplateSettings(next);
  }

  async function pickDefaultOutputDir() {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const path = await getLocalApi().selectOutputDir();
      if (path) {
        updateAppConfig({ default_output_dir: path });
      }
    } catch (error) {
      showNotice('error', formatError(error));
    }
  }

  async function toggleRule(ruleId: string) {
    const nextRules = templateSettings.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule,
    );
    const next = { ...templateSettings, rules: nextRules };
    await saveTemplateSettings(next);
  }

  return (
    <div className="workspace">
      <header className="status-bar">
        <div className="status-left">
          <AppIcon size={18} className="status-app-icon" />
          <span>DocCipher</span>
          <span className="status-sub">本地 · 离线</span>
        </div>
        <div className="status-right">
          {notice && (
            <span className={cn('status-notice', `status-notice-${notice.type}`)}>
              {notice.text}
            </span>
          )}
        </div>
      </header>

      <div className="workspace-body">
        <aside className="sidebar">
          <SidebarNav activeView={activeView} onNavigate={setActiveView} />
          {maskResult && (activeView === 'home' || activeView === 'mask') && (
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
              taskHistory={taskHistory}
              taskHistoryRefreshing={taskHistoryRefreshing}
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, 'home')}
              onPick={() => void pickDocx('mask')}
              onOpenRecent={(path) => selectDocxFile(path, 'mask')}
              onRefreshHistory={() => void refreshTaskHistory()}
              onOpenTaskDir={openInFolder}
            />
          )}

          {activeView === 'mask' && (
            <MaskPanel
              activeProfileId={activeProfileId}
              busy={busy}
              dragOver={dragOver}
              docxPreview={docxPreview}
              enabledRules={enabledRules}
              form={maskForm}
              manualSelections={manualSelections}
              matchPreview={matchPreview}
              matchPreviewDialogOpen={matchPreviewDialogOpen}
              matchPreviewLoading={matchPreviewLoading}
              profiles={maskProfiles}
              previewLoading={previewLoading}
              result={maskResult}
              systemKeywords={extractSystemKeywords(templateSettings)}
              systemKeywordsEnabled={templateSettings.app.enable_system_keywords}
              onAddManualSelection={addManualSelection}
              onClearManualSelections={() => setManualSelections([])}
              onCreateProfile={createMaskProfileDraft}
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, 'mask')}
              onFormChange={setMaskForm}
              onPreviewSelectionError={showNotice}
              onRemoveManualSelection={removeManualSelection}
              onOpenFolder={openInFolder}
              onPickDocx={() => void pickDocx('mask')}
              onPickOutput={() => void pickOutputDir('mask')}
              onRun={() => void runMask()}
              onCloseMatchPreview={() => setMatchPreviewDialogOpen(false)}
              onPreviewMatches={() => void refreshMatchPreview({ openDialog: true })}
              onSaveProfile={() => void saveCurrentProfile()}
              onSelectProfile={selectMaskProfile}
              onGoRules={() => setActiveView('profiles')}
              onReset={() => {
                setMaskResult(null);
                setMaskForm({ inputPath: '', outputDir: '', password: '' });
                setMatchPreview(null);
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

          {activeView === 'profiles' && (
            <ProfilesPanel
              profiles={maskProfiles}
              selectedProfileId={selectedProfileId}
              selectedProfile={selectedProfile}
              draftName={profileDraftName}
              draftKeywords={profileDraftKeywords}
              systemKeywords={extractSystemKeywords(templateSettings)}
              systemKeywordsEnabled={templateSettings.app.enable_system_keywords}
              onGoSettings={() => setActiveView('settings')}
              onCreate={() => {
                createMaskProfileDraft();
                setActiveView('mask');
              }}
              onSelect={setSelectedProfileId}
              onDraftNameChange={setProfileDraftName}
              onDraftKeywordsChange={setProfileDraftKeywords}
              onSave={() => void saveSelectedProfile()}
              onDelete={() => void deleteSelectedProfile()}
              onExport={() => void exportSelectedProfile()}
              onImport={() => void importProfile()}
              onDuplicate={() => void duplicateSelectedProfile()}
              onDedupeKeywords={() => {
                setProfileDraftKeywords(dedupeKeywordDraftLines(profileDraftKeywords));
                showNotice('info', '关键词列表已去重整理');
              }}
            />
          )}

          {activeView === 'settings' && (
            <AppSettingsPanel
              settings={templateSettings}
              enabledCount={templateEnabledRules.length}
              rulesListOpen={rulesListOpen}
              advancedJsonOpen={advancedJsonOpen}
              expandedRuleId={expandedRuleId}
              settingsText={settingsText}
              onToggleRulesList={() => setRulesListOpen((open) => !open)}
              onToggleAdvanced={() => setAdvancedJsonOpen((open) => !open)}
              onExpandRule={setExpandedRuleId}
              onToggleRule={(id) => void toggleRule(id)}
              onUpdateAppConfig={updateAppConfig}
              onPickDefaultOutputDir={() => void pickDefaultOutputDir()}
              onSettingsTextChange={setSettingsText}
              onReload={() => void refreshSettings()}
              onSave={() => void saveSettingsJson()}
            />
          )}
        </main>
      </div>

      {import.meta.env.DEV && (
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
              const result = await api.maskDocx({ filePath: path });
              console.log(result);
              setDevMaskResult(result);
            } catch (error) {
              console.error(error);
              setDevMaskResult(null);
            }
          }}
        />
      )}

      <footer className={cn('log-bar', logBarExpanded && 'log-bar-expanded')}>
        <button
          type="button"
          className="log-bar-toggle"
          onClick={() => setLogBarExpanded((open) => !open)}
        >
          {logBarExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <HistoryIcon size={14} />
          <span>实时日志</span>
          {latestLogs.length > 0 && <Badge variant="secondary">{logs.length}</Badge>}
        </button>
        <div className="log-bar-content">
          {(logBarExpanded ? logs.slice().reverse() : latestLogs.slice().reverse()).map(
            (entry, index) => (
              <div className="log-bar-line" key={`${entry.timestamp}-${index}`}>
                <span className="log-time">{entry.timestamp}</span>
                <span className={cn('log-level', `log-level-${entry.level.toLowerCase()}`)}>
                  {entry.level}
                </span>
                <span className="log-msg">{entry.message}</span>
              </div>
            ),
          )}
          {logs.length === 0 && <span className="log-empty">暂无日志</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="log-refresh"
          onClick={() => void refreshLogs()}
        >
          <RefreshCw size={14} />
        </Button>
      </footer>
    </div>
  );
}
