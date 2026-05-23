import type { AiStatus } from '../schema/ai-model.schema.js';

export type AiAssistReadiness = {
  ready: boolean;
  reason: string | null;
};

export function resolveAiAssistReadiness(
  status: Pick<AiStatus, 'runtime_available' | 'model_installed' | 'active_model_id'>,
): AiAssistReadiness {
  if (!status.runtime_available) {
    return { ready: false, reason: '未检测到 AI 运行时' };
  }
  if (!status.model_installed) {
    return { ready: false, reason: '请先在设置中下载 AI 模型' };
  }
  if (!status.active_model_id) {
    return { ready: false, reason: '请在设置中将已安装模型「设为当前」' };
  }
  return { ready: true, reason: null };
}
