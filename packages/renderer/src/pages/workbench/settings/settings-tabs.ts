import { isLocalAiBundled } from '@app/shared';

export type SettingsTabId = 'general' | 'data' | 'ai' | 'rules' | 'advanced' | 'about';

export type SettingsTabItem = {
  id: SettingsTabId;
  label: string;
};

const BASE_TABS: SettingsTabItem[] = [
  { id: 'general', label: '通用' },
  { id: 'data', label: '数据' },
  { id: 'rules', label: '规则模板' },
  { id: 'advanced', label: '高级' },
  { id: 'about', label: '关于' },
];

export function getSettingsTabs(): SettingsTabItem[] {
  if (!isLocalAiBundled()) {
    return BASE_TABS;
  }
  return [
    { id: 'general', label: '通用' },
    { id: 'data', label: '数据' },
    { id: 'ai', label: '本地 AI' },
    { id: 'rules', label: '规则模板' },
    { id: 'advanced', label: '高级' },
    { id: 'about', label: '关于' },
  ];
}

export function settingsTabPanelId(tabId: SettingsTabId): string {
  return `settings-tabpanel-${tabId}`;
}

export function settingsTabButtonId(tabId: SettingsTabId): string {
  return `settings-tab-${tabId}`;
}
