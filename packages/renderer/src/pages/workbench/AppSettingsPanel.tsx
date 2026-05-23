import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import type { AiAssistSettings, Settings as AppSettings, AppSettingsConfig } from '@app/shared';
import type { AppStoragePathsInfo } from '../../lib/local-api.js';
import { PanelHero } from './workbench-ui.js';
import { SettingsAboutTab } from './settings/SettingsAboutTab.js';
import { SettingsAdvancedTab } from './settings/SettingsAdvancedTab.js';
import { SettingsAiTab } from './settings/SettingsAiTab.js';
import { SettingsDataTab } from './settings/SettingsDataTab.js';
import { SettingsGeneralTab } from './settings/SettingsGeneralTab.js';
import { SettingsRulesTab } from './settings/SettingsRulesTab.js';
import {
  getSettingsTabs,
  settingsTabButtonId,
  settingsTabPanelId,
  type SettingsTabId,
} from './settings/settings-tabs.js';

export function AppSettingsPanel({
  settings,
  storagePaths,
  enabledCount,
  rulesListOpen,
  expandedRuleId,
  settingsText,
  onToggleRulesList,
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
  onNotice,
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
  onNotice: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const tabs = useMemo(() => getSettingsTabs(), []);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const app = settings.app;

  const selectAdjacentTab = useCallback(
    (direction: 1 | -1) => {
      const index = tabs.findIndex((tab) => tab.id === activeTab);
      if (index < 0) {
        return;
      }
      const next = tabs[index + direction];
      if (next) {
        setActiveTab(next.id);
      }
    },
    [activeTab, tabs],
  );

  const handleNavKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectAdjacentTab(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectAdjacentTab(-1);
    }
  };

  return (
    <div className="panel-stack app-settings-page">
      <PanelHero title="应用设置" description="按分类调整选项；具体脱敏规则请在「方案」中设置。" />

      <div className="app-settings-shell">
        <nav className="app-settings-nav" role="tablist" aria-label="设置分类">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={settingsTabButtonId(tab.id)}
              className={activeTab === tab.id ? 'app-settings-nav-item-active' : undefined}
              aria-selected={activeTab === tab.id}
              aria-controls={settingsTabPanelId(tab.id)}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleNavKeyDown}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div
          className="app-settings-panel"
          role="tabpanel"
          id={settingsTabPanelId(activeTab)}
          aria-labelledby={settingsTabButtonId(activeTab)}
        >
          {activeTab === 'general' ? (
            <SettingsGeneralTab
              app={app}
              onUpdateAppConfig={onUpdateAppConfig}
              onPickDefaultOutputDir={onPickDefaultOutputDir}
            />
          ) : null}

          {activeTab === 'data' ? (
            <SettingsDataTab
              storagePaths={storagePaths}
              onOpenAppDataDir={onOpenAppDataDir}
              onOpenUserDataDir={onOpenUserDataDir}
              onPickUserDataDir={onPickUserDataDir}
              onResetUserDataDir={onResetUserDataDir}
            />
          ) : null}

          {activeTab === 'ai' ? (
            <SettingsAiTab
              aiAssist={app.ai_assist}
              onUpdateAiAssist={(patch: Partial<AiAssistSettings>) =>
                onUpdateAppConfig({
                  ai_assist: { ...app.ai_assist, ...patch },
                })
              }
              onNotice={onNotice}
            />
          ) : null}

          {activeTab === 'rules' ? (
            <SettingsRulesTab
              settings={settings}
              enabledCount={enabledCount}
              rulesListOpen={rulesListOpen}
              expandedRuleId={expandedRuleId}
              onToggleRulesList={onToggleRulesList}
              onExpandRule={onExpandRule}
              onToggleRule={onToggleRule}
            />
          ) : null}

          {activeTab === 'advanced' ? (
            <SettingsAdvancedTab
              settingsText={settingsText}
              onSettingsTextChange={onSettingsTextChange}
              onReload={onReload}
              onSave={onSave}
            />
          ) : null}

          {activeTab === 'about' ? <SettingsAboutTab /> : null}
        </div>
      </div>
    </div>
  );
}
