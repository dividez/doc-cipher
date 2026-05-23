import type { AiAssistSettings, AppSettingsConfig } from '@app/shared';
import { AiAssistSection } from '../AiAssistSection.js';

type SettingsAiTabProps = {
  aiAssist: AppSettingsConfig['ai_assist'];
  onUpdateAiAssist: (patch: Partial<AiAssistSettings>) => void;
  onNotice: (type: 'success' | 'error' | 'info', text: string) => void;
};

export function SettingsAiTab({ aiAssist, onUpdateAiAssist, onNotice }: SettingsAiTabProps) {
  return (
    <AiAssistSection aiAssist={aiAssist} onUpdateAiAssist={onUpdateAiAssist} onNotice={onNotice} />
  );
}
