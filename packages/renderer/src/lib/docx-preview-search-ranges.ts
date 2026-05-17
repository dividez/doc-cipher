export type SearchRange = {
  start: number;
  end: number;
};

export function findSearchRanges(
  plainText: string,
  query: string,
  options?: { caseSensitive?: boolean },
): SearchRange[] {
  const trimmed = query.trim();
  if (!trimmed || !plainText) {
    return [];
  }

  const caseSensitive = options?.caseSensitive ?? false;
  const haystack = caseSensitive ? plainText : plainText.toLowerCase();
  const needle = caseSensitive ? trimmed : trimmed.toLowerCase();

  const ranges: SearchRange[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    ranges.push({ start: index, end: index + needle.length });
    index = haystack.indexOf(needle, index + needle.length);
  }

  return ranges;
}
