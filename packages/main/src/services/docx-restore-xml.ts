import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';

export type Replacement = {
  token: string;
  original: string;
};

type TextNodeRef = {
  element: XmlElement;
  text: string;
  start: number;
  end: number;
};

type RestoreMatch = {
  start: number;
  end: number;
  token: string;
  original: string;
};

export type RestoreXmlPartResult = {
  updatedXml: string;
  restoredCounts: Map<string, number>;
  unknownCounts: Map<string, number>;
};

const TOKEN_PATTERN = /\[[A-Z][A-Z0-9_]*_\d{6}\]/g;

export function restoreXmlPart(
  xml: string,
  replacements: Replacement[],
  knownTokens = new Set(replacements.map((item) => item.token)),
): RestoreXmlPartResult {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const serializer = new XMLSerializer();
  const paragraphs = Array.from(document.getElementsByTagName('w:p'));
  const restoredCounts = new Map<string, number>();
  const unknownCounts = new Map<string, number>();

  for (const paragraph of paragraphs) {
    const nodes = Array.from(paragraph.getElementsByTagName('w:t')).map((element) => ({
      element,
      text: element.textContent ?? '',
    }));
    const paragraphText = nodes.map((node) => node.text).join('');

    if (!paragraphText) {
      continue;
    }

    addUnknownTokenCounts(unknownCounts, paragraphText, knownTokens);
    const matches = findTokenMatches(paragraphText, replacements);

    if (matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      restoredCounts.set(match.token, (restoredCounts.get(match.token) ?? 0) + 1);
    }

    rewriteTextNodes(
      document,
      nodes.map((node, index) => {
        const start = nodes.slice(0, index).reduce((sum, item) => sum + item.text.length, 0);
        return {
          ...node,
          start,
          end: start + node.text.length,
        };
      }),
      paragraphText,
      matches,
    );
  }

  return {
    updatedXml: serializer.serializeToString(document),
    restoredCounts,
    unknownCounts,
  };
}

function findTokenMatches(text: string, replacements: Replacement[]): RestoreMatch[] {
  const matches: RestoreMatch[] = [];

  for (const replacement of replacements) {
    let index = text.indexOf(replacement.token);

    while (index !== -1) {
      matches.push({
        start: index,
        end: index + replacement.token.length,
        token: replacement.token,
        original: replacement.original,
      });
      index = text.indexOf(replacement.token, index + replacement.token.length);
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

function addUnknownTokenCounts(
  counts: Map<string, number>,
  text: string,
  knownTokens: Set<string>,
): void {
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    if (!knownTokens.has(token)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
}

function rewriteTextNodes(
  document: XmlDocument,
  textNodes: TextNodeRef[],
  fullText: string,
  matches: RestoreMatch[],
): void {
  const starts = new Map(matches.map((match) => [match.start, match]));

  for (const node of textNodes) {
    let output = '';
    let position = node.start;

    while (position < node.end) {
      const startingMatch = starts.get(position);

      if (startingMatch) {
        output += startingMatch.original;
        position = startingMatch.end;
        continue;
      }

      const containingMatch = matches.find(
        (match) => match.start < position && position < match.end,
      );
      if (containingMatch) {
        position = Math.min(containingMatch.end, node.end);
        continue;
      }

      output += fullText[position] ?? '';
      position += 1;
    }

    setElementText(document, node.element, output);
  }
}

function setElementText(document: XmlDocument, element: XmlElement, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (/^\s|\s$/.test(text)) {
    element.setAttribute('xml:space', 'preserve');
  }

  element.appendChild(document.createTextNode(text));
}
