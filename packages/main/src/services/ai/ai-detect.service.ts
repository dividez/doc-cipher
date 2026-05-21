import { aiDetectResultSchema, type AiDetectResult, type Settings } from '@app/shared';
import { entitiesToPendingMatches, parseEntitiesFromContent } from './ai-entities.util.js';
import { getActiveModelGgufPath } from './model-manager.service.js';
import { ensureLlamaServer, getLlamaServerBaseUrl } from './llama-runtime.service.js';
import { logger } from '../app/log.service.js';

const MAX_PARAGRAPH_CHARS = 2000;

const SYSTEM_PROMPT = `你是文档敏感信息识别助手。从用户给出的段落文本中识别可能需要脱敏的实体。
只输出 JSON 数组，不要 markdown，不要解释。每项格式：
{"text":"实体原文","type":"person_name|company_name|address|project_name|other","confidence":0.0-1.0}
若无敏感实体，输出 []。`;

export function isAiAssistEnabled(settings: Settings, override?: boolean): boolean {
  const flag = override ?? settings.app.ai_assist.enabled;
  return flag === true;
}

function truncateText(text: string): string {
  if (text.length <= MAX_PARAGRAPH_CHARS) {
    return text;
  }
  return text.slice(0, MAX_PARAGRAPH_CHARS);
}

export async function detectSensitiveEntities(text: string): Promise<AiDetectResult> {
  const modelPath = await getActiveModelGgufPath();
  if (!modelPath) {
    throw new Error('未安装本地 AI 模型');
  }

  const baseUrl = await ensureLlamaServer(modelPath);
  const userText = truncateText(text);

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
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
  return aiDetectResultSchema.parse({ entities });
}

export async function aiDetectToPendingMatches(
  paragraphText: string,
  settings: Settings,
): Promise<ReturnType<typeof entitiesToPendingMatches>> {
  if (!isAiAssistEnabled(settings)) {
    return [];
  }

  try {
    const { entities } = await detectSensitiveEntities(paragraphText);
    return entitiesToPendingMatches(
      paragraphText,
      entities,
      settings.app.ai_assist.confidence_threshold,
    );
  } catch (error) {
    logger().warn(`AI detect skipped: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
