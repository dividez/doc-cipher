export const TEXT_PART_PATTERN = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

export function shouldProcessPart(entryName: string): boolean {
  return TEXT_PART_PATTERN.test(entryName);
}
