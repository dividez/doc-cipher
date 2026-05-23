import { describe, expect, it } from 'vitest';
import { resolveAiAssistReadiness } from './ai-assist-readiness.js';

describe('resolveAiAssistReadiness', () => {
  it('returns ready when runtime, model, and active id are set', () => {
    expect(
      resolveAiAssistReadiness({
        runtime_available: true,
        model_installed: true,
        active_model_id: 'qwen',
      }),
    ).toEqual({ ready: true, reason: null });
  });

  it('prioritizes missing runtime', () => {
    expect(
      resolveAiAssistReadiness({
        runtime_available: false,
        model_installed: false,
        active_model_id: null,
      }),
    ).toEqual({ ready: false, reason: '未检测到 AI 运行时' });
  });

  it('reports missing model when runtime is available', () => {
    expect(
      resolveAiAssistReadiness({
        runtime_available: true,
        model_installed: false,
        active_model_id: null,
      }),
    ).toEqual({ ready: false, reason: '请先在设置中下载 AI 模型' });
  });

  it('reports missing active model when models are installed', () => {
    expect(
      resolveAiAssistReadiness({
        runtime_available: true,
        model_installed: true,
        active_model_id: null,
      }),
    ).toEqual({ ready: false, reason: '请在设置中将已安装模型「设为当前」' });
  });
});
