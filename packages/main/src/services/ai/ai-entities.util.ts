import { AI_SENSITIVE_RULE_ID, aiDetectEntitySchema, type AiDetectEntity } from '@app/shared';

const AI_RULE_ORDER_BASE = 1_000_000;

export type PendingMatchLike = {
  start: number;
  end: number;
  original: string;
  ruleId: string;
  order: number;
};

export function parseEntitiesFromContent(content: string): AiDetectEntity[] {
  const trimmed = content.trim();
  const jsonStart = trimmed.indexOf('[');
  const jsonEnd = trimmed.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) {
    return [];
  }
  const slice = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(slice) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  const entities: AiDetectEntity[] = [];
  for (const item of parsed) {
    const result = aiDetectEntitySchema.safeParse(item);
    if (result.success) {
      entities.push(result.data);
    }
  }
  return entities;
}

export function entitiesToPendingMatches(
  paragraphText: string,
  entities: AiDetectEntity[],
  threshold: number,
  orderStart = AI_RULE_ORDER_BASE,
): PendingMatchLike[] {
  const pending: PendingMatchLike[] = [];
  let order = orderStart;

  for (const entity of entities) {
    if (entity.confidence < threshold) {
      continue;
    }
    const value = entity.text.trim();
    if (!value) {
      continue;
    }
    let index = paragraphText.indexOf(value);
    while (index !== -1) {
      pending.push({
        start: index,
        end: index + value.length,
        original: value,
        ruleId: AI_SENSITIVE_RULE_ID,
        order: order++,
      });
      index = paragraphText.indexOf(value, index + value.length);
    }
  }

  return pending;
}
