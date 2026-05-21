import type { ManifestModelEntry, ModelHardware } from '../schema/ai-model.schema.js';

export function resolveModelHardware(entry: ManifestModelEntry): ModelHardware | null {
  if (entry.hardware) {
    return entry.hardware;
  }
  if (entry.min_memory_gb) {
    return { min_memory_gb: entry.min_memory_gb };
  }
  return null;
}

export function formatModelHardwareLines(entry: ManifestModelEntry): string[] {
  const hw = resolveModelHardware(entry);
  if (!hw) {
    return [];
  }
  const lines: string[] = [];
  lines.push(
    `内存：最低 ${hw.min_memory_gb} GB` +
      (hw.recommended_memory_gb ? `，建议 ${hw.recommended_memory_gb} GB` : ''),
  );
  if (hw.min_cpu_cores) {
    lines.push(`CPU：${hw.min_cpu_cores} 核及以上${hw.cpu ? `；${hw.cpu}` : ''}`);
  } else if (hw.cpu) {
    lines.push(`CPU：${hw.cpu}`);
  }
  if (hw.disk_gb) {
    lines.push(`磁盘：约 ${hw.disk_gb} GB 可用空间`);
  }
  if (hw.gpu) {
    lines.push(`GPU：${hw.gpu}`);
  }
  if (hw.notes) {
    lines.push(hw.notes);
  }
  return lines;
}

export function modelTierLabel(tier: ManifestModelEntry['tier']): string {
  switch (tier) {
    case 'light':
      return '轻量';
    case 'balanced':
      return '均衡';
    case 'quality':
      return '高精度';
    default:
      return '';
  }
}
