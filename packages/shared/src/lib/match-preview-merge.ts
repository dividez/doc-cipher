import type {
  DocxMatchHit,
  DocxMatchPreviewResult,
  DocxMatchPreviewSample,
  DocxMatchRuleHit,
} from '../types/tasks.js';
function hitKey(hit: DocxMatchHit): string {
  return `${hit.partName}\0${hit.blockIndex}\0${hit.start}\0${hit.end}\0${hit.ruleId}`;
}

function sampleKey(sample: DocxMatchPreviewSample): string {
  return `${sample.ruleId}\0${sample.kind}\0${sample.snippet}`;
}

export function mergeMatchPreviewResults(
  base: DocxMatchPreviewResult | null,
  supplement: DocxMatchPreviewResult,
): DocxMatchPreviewResult {
  if (!base) {
    return supplement;
  }

  const seenHits = new Set(base.hits.map(hitKey));
  const mergedHits = [...base.hits];
  for (const hit of supplement.hits) {
    const key = hitKey(hit);
    if (!seenHits.has(key)) {
      seenHits.add(key);
      mergedHits.push(hit);
    }
  }

  const ruleHitMap = new Map<string, DocxMatchRuleHit>();
  for (const hit of [...base.ruleHits, ...supplement.ruleHits]) {
    const prev = ruleHitMap.get(hit.ruleId);
    if (prev) {
      ruleHitMap.set(hit.ruleId, { ...prev, count: prev.count + hit.count });
    } else {
      ruleHitMap.set(hit.ruleId, { ...hit });
    }
  }
  const ruleHits = [...ruleHitMap.values()].sort((a, b) => b.count - a.count);

  const seenSamples = new Set(base.samples.map(sampleKey));
  const samples = [...base.samples];
  for (const sample of supplement.samples) {
    const key = sampleKey(sample);
    if (!seenSamples.has(key) && samples.length < 40) {
      seenSamples.add(key);
      samples.push(sample);
    }
  }

  const zeroByRule = new Map(base.zeroHitRules.map((z) => [z.ruleId, z]));
  for (const z of supplement.zeroHitRules) {
    if (!ruleHitMap.has(z.ruleId)) {
      zeroByRule.set(z.ruleId, z);
    } else {
      zeroByRule.delete(z.ruleId);
    }
  }

  const manualSelectionHits = mergedHits.filter((h) => h.ruleId === 'manual_selection').length;

  return {
    filePath: base.filePath || supplement.filePath,
    paragraphCount: Math.max(base.paragraphCount, supplement.paragraphCount),
    totalHits: ruleHits.reduce((sum, r) => sum + r.count, 0),
    manualSelectionHits,
    ruleHits,
    hits: mergedHits,
    zeroHitRules: [...zeroByRule.values()],
    samples,
  };
}
