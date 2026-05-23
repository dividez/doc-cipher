import { aiDetectResultSchema, type AiDetectResult, type Settings } from '@app/shared';
import {
  entitiesToPendingMatches,
  mergeAiDetectEntities,
  parseEntitiesFromContent,
} from './ai-entities.util.js';
import { getActiveModelGgufPath } from './model-manager.service.js';
import { ensureLlamaServer, getLlamaServerBaseUrl } from './llama-runtime.service.js';
import { logger } from '../app/log.service.js';
import { RECOGNITION_CANCELLED_MESSAGE } from '@app/shared';
import { markAiMaskCancelled } from './ai-mask-task.service.js';
import { iterTextWindows } from './ai-window.util.js';

function isAiRuntimeFatalError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('未找到内置 llama') ||
    message.includes('未安装本地 AI 模型') ||
    message.includes('llama-server 启动超时')
  );
}

const SYSTEM_PROMPT = `你是文档敏感信息识别助手。从用户给出的段落文本中识别可能需要脱敏的实体。
只输出 JSON 数组，不要 markdown，不要解释。每项格式：
{"text":"实体原文","type":"person_name|company_name|address|project_name|other","confidence":0.0-1.0}
若无敏感实体，输出 []。`;

const MAX_RAW_LOG_CHARS = 8_192;

export type AiDetectOptions = {
  signal?: AbortSignal;
  onWindowComplete?: () => void;
  onWindowOutput?: (payload: { rawContent: string; entityCount: number }) => void;
};

function truncateRawLog(content: string): string {
  if (content.length <= MAX_RAW_LOG_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_RAW_LOG_CHARS)}\n…（已截断）`;
}

export async function detectSensitiveEntities(
  text: string,
  options?: AiDetectOptions,
): Promise<AiDetectResult> {
  const modelPath = await getActiveModelGgufPath();
  if (!modelPath) {
    throw new Error('未安装本地 AI 模型');
  }

  const baseUrl = await ensureLlamaServer(modelPath);
  options?.signal?.throwIfAborted();

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
    signal: options?.signal ?? AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI 推理失败 HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '[]';
  const entities = parseEntitiesFromContent(content);
  options?.onWindowOutput?.({
    rawContent: truncateRawLog(content),
    entityCount: entities.length,
  });
  return aiDetectResultSchema.parse({ entities });
}

export async function detectSensitiveEntitiesWithSlidingWindow(
  text: string,
  options?: AiDetectOptions,
): Promise<AiDetectResult> {
  const merged: AiDetectResult['entities'] = [];

  for (const { slice } of iterTextWindows(text)) {
    options?.signal?.throwIfAborted();
    try {
      const { entities } = await detectSensitiveEntities(slice, options);
      merged.push(...entities);
    } catch (error) {
      if (options?.signal?.aborted) {
        markAiMaskCancelled();
        throw error;
      }
      if (isAiRuntimeFatalError(error)) {
        throw error;
      }
      logger().warn(
        `AI window detect skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    options?.onWindowComplete?.();
  }

  return aiDetectResultSchema.parse({ entities: mergeAiDetectEntities(merged) });
}

export async function aiDetectToPendingMatches(
  paragraphText: string,
  settings: Settings,
  options?: AiDetectOptions,
): Promise<ReturnType<typeof entitiesToPendingMatches>> {
  try {
    const { entities } = await detectSensitiveEntitiesWithSlidingWindow(paragraphText, options);
    return entitiesToPendingMatches(
      paragraphText,
      entities,
      settings.app.ai_assist.confidence_threshold,
    );
  } catch (error) {
    if (options?.signal?.aborted) {
      markAiMaskCancelled();
      throw new Error(RECOGNITION_CANCELLED_MESSAGE);
    }
    logger().warn(`AI detect skipped: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
