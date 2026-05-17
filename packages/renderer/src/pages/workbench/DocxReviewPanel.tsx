import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Clipboard, Highlighter, Trash2, X } from 'lucide-react';
import {
  expandManualSegments,
  type DocxMatchHit,
  type DocxManualSelection,
  type DocxPreviewResult,
  type DocxStructureHint,
  type DocxTextBlock,
} from '@app/shared';
import { Button, Input, cn } from '../../components/ui.js';
import {
  findSearchRanges,
  mergePreviewHighlightRanges,
  type PreviewHighlightRange,
} from '../../lib/preview-highlights.js';
import type { ManualSelectionDraft, PreviewContextMenu } from './types.js';
import {
  blockLocalRanges,
  buildDraftFromPreviewSelection,
  manualDraftsMatch,
  resolveSelectionPoint,
  structureRegionLabel,
} from './workbench-utils.js';

export type GlobalSearchMatch = {
  blockId: string;
  start: number;
  end: number;
};

export function DocxReviewPanel({
  preview,
  loading,
  ruleHitsByBlock,
  selections,
  onAddSelection,
  onClearSelections,
  onRemoveSelection,
  onSelectionError,
}: {
  preview: DocxPreviewResult | null;
  loading: boolean;
  ruleHitsByBlock: Map<string, DocxMatchHit[]>;
  selections: DocxManualSelection[];
  onAddSelection: (selection: ManualSelectionDraft) => void;
  onClearSelections: () => void;
  onRemoveSelection: (id: string) => void;
  onSelectionError: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [draft, setDraft] = useState<ManualSelectionDraft | null>(null);
  const [contextMenu, setContextMenu] = useState<PreviewContextMenu | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  const globalSearchMatches = useMemo(() => {
    if (!preview || !searchQuery.trim()) {
      return [] as GlobalSearchMatch[];
    }
    const matches: GlobalSearchMatch[] = [];
    for (const block of preview.blocks) {
      for (const range of findSearchRanges(block.text, searchQuery)) {
        matches.push({ blockId: block.id, start: range.start, end: range.end });
      }
    }
    return matches;
  }, [preview, searchQuery]);

  const currentSearchMatch = globalSearchMatches[searchIndex] ?? null;
  const currentSearchKey = currentSearchMatch
    ? `${currentSearchMatch.blockId}:${currentSearchMatch.start}:${currentSearchMatch.end}`
    : null;

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, preview?.filePath]);

  useEffect(() => {
    if (!currentSearchMatch) {
      return;
    }
    document
      .querySelector(
        `[data-block-id="${currentSearchMatch.blockId}"] [data-segment-start="${currentSearchMatch.start}"]`,
      )
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSearchMatch, searchIndex]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    function closeMenu(event: Event) {
      if ((event.target as Element | null)?.closest('.preview-context-menu')) {
        return;
      }
      setContextMenu(null);
    }
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [contextMenu]);

  function captureSelection(): ManualSelectionDraft | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !preview) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const start = resolveSelectionPoint(range.startContainer, range.startOffset);
    const end = resolveSelectionPoint(range.endContainer, range.endOffset);

    if (!start || !end) {
      return null;
    }

    const nextDraft = buildDraftFromPreviewSelection(preview, start, end);
    if (!nextDraft) {
      setDraft(null);
      return null;
    }
    setDraft(nextDraft);
    return nextDraft;
  }

  function addDraft() {
    if (!draft) {
      return;
    }
    onAddSelection(draft);
    setDraft(null);
    window.getSelection()?.removeAllRanges();
  }

  function openContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const nextDraft = captureSelection();
    if (!nextDraft) {
      setContextMenu(null);
      return;
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      selection: nextDraft,
    });
  }

  function addContextSelection() {
    if (!contextMenu) {
      return;
    }
    onAddSelection(contextMenu.selection);
    setDraft(null);
    setContextMenu(null);
    window.getSelection()?.removeAllRanges();
  }

  async function copyContextSelection() {
    if (!contextMenu) {
      return;
    }
    try {
      await navigator.clipboard.writeText(contextMenu.selection.text);
      setContextMenu(null);
    } catch {
      onSelectionError('error', '复制失败');
    }
  }

  function clearCurrentSelection() {
    if (!contextMenu) {
      return;
    }
    const matchedSelection = selections.find((selection) =>
      manualDraftsMatch(contextMenu.selection, selection),
    );

    if (matchedSelection) {
      onRemoveSelection(matchedSelection.id);
    }
    setDraft(null);
    setContextMenu(null);
    window.getSelection()?.removeAllRanges();
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchIndex(0);
  }

  function getPreviewSelectionText(): string {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return '';
    }
    const page = document.querySelector('.docx-preview-body .docx-page');
    if (!page) {
      return '';
    }
    const anchor = selection.anchorNode;
    if (!anchor || !page.contains(anchor)) {
      return '';
    }
    return selection.toString().replace(/\s+/g, ' ').trim();
  }

  function focusSearchInput() {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.docx-search-float .docx-search-input');
      el?.focus();
      el?.select();
    }, 0);
  }

  function stepSearch(delta: number) {
    if (globalSearchMatches.length === 0) {
      return;
    }
    setSearchIndex((current) => {
      const next = current + delta;
      if (next < 0) {
        return globalSearchMatches.length - 1;
      }
      if (next >= globalSearchMatches.length) {
        return 0;
      }
      return next;
    });
  }

  function handlePageKeyDown(event: React.KeyboardEvent) {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      const seed = getPreviewSelectionText();
      setSearchOpen(true);
      if (seed) {
        setSearchQuery(seed);
      }
      focusSearchInput();
      return;
    }
    if (event.key === 'Escape') {
      if (searchOpen || searchQuery) {
        event.preventDefault();
        closeSearch();
      }
      return;
    }
    if (!searchOpen || !searchQuery.trim()) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      stepSearch(event.shiftKey ? -1 : 1);
    }
  }

  return (
    <section className="docx-review">
      <div className="docx-review-toolbar">
        <div>
          <h3>文档预览</h3>
          <span>
            {loading
              ? '读取中'
              : preview
                ? `${preview.blockCount} 段 · ${preview.charCount} 字`
                : '等待选择文件'}
          </span>
        </div>
        <div className="docx-review-actions">
          {draft && (
            <Button type="button" onClick={addDraft}>
              <Highlighter size={16} /> 加入脱敏
            </Button>
          )}
          {selections.length > 0 && (
            <Button type="button" variant="ghost" onClick={onClearSelections}>
              清空标注
            </Button>
          )}
        </div>
      </div>

      <div className="docx-preview-body">
        {(searchOpen || searchQuery) && (
          <div
            className="docx-search-float"
            role="search"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Input
              className="docx-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="在预览中搜索"
              aria-label="预览搜索"
            />
            <Button
              type="button"
              variant="outline"
              aria-label="上一个"
              disabled={globalSearchMatches.length === 0}
              onClick={() => stepSearch(-1)}
            >
              <ChevronUp size={16} />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label="下一个"
              disabled={globalSearchMatches.length === 0}
              onClick={() => stepSearch(1)}
            >
              <ChevronDown size={16} />
            </Button>
            <span className="docx-search-count">
              {globalSearchMatches.length === 0
                ? '0/0'
                : `${searchIndex + 1}/${globalSearchMatches.length}`}
            </span>
            <Button type="button" variant="ghost" aria-label="关闭搜索" onClick={closeSearch}>
              <X size={16} />
            </Button>
          </div>
        )}

        <div
          className="docx-page"
          onKeyDown={handlePageKeyDown}
          onMouseUp={(event) => {
            if (event.button !== 0) {
              return;
            }
            setContextMenu(null);
            captureSelection();
          }}
          onKeyUp={captureSelection}
          onContextMenu={openContextMenu}
          role="document"
          tabIndex={0}
        >
          {loading && <div className="docx-empty">正在读取 DOCX 内容...</div>}
          {!loading && !preview && (
            <div className="docx-empty">选择文件后会在这里显示文本内容。</div>
          )}
          {!loading &&
            preview?.blocks.map((block) => (
              <DocxTextBlockView
                key={block.id}
                block={block}
                ruleHits={ruleHitsByBlock.get(block.id) ?? []}
                selections={selections}
                searchQuery={searchQuery}
                currentSearchKey={currentSearchKey}
                onRemoveSelection={onRemoveSelection}
              />
            ))}
        </div>
      </div>
      {contextMenu && (
        <div
          className="preview-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" onClick={addContextSelection}>
            <Highlighter size={14} />
            <span>加入脱敏</span>
          </button>
          <button type="button" onClick={() => void copyContextSelection()}>
            <Clipboard size={14} />
            <span>复制文字</span>
          </button>
          <button type="button" onClick={clearCurrentSelection}>
            <Trash2 size={14} />
            <span>清空当前选择</span>
          </button>
        </div>
      )}
    </section>
  );
}

export function DocxTextBlockView({
  block,
  selections,
  ruleHits,
  searchQuery,
  currentSearchKey,
  onRemoveSelection,
}: {
  block: DocxTextBlock;
  selections: DocxManualSelection[];
  ruleHits: DocxMatchHit[];
  searchQuery: string;
  currentSearchKey: string | null;
  onRemoveSelection: (id: string) => void;
}) {
  const localRanges = blockLocalRanges(block, selections);
  const highlightRanges = useMemo(() => {
    const ranges: PreviewHighlightRange[] = localRanges.map((range) => ({
      start: range.start,
      end: range.end,
      kind: 'manual' as const,
      selectionId: range.selection.id,
    }));
    for (const hit of ruleHits) {
      ranges.push({
        start: hit.start,
        end: hit.end,
        kind: 'rule',
        ruleKind: hit.kind,
      });
    }
    for (const range of findSearchRanges(block.text, searchQuery)) {
      ranges.push({
        start: range.start,
        end: range.end,
        kind: 'search',
        searchIndex: 0,
      });
    }
    return mergePreviewHighlightRanges(block.text.length, ranges);
  }, [block.text, localRanges, ruleHits, searchQuery]);

  const showStructureMeta =
    block.structure && (block.structure.region !== 'body' || block.structure.inTable);

  return (
    <>
      {showStructureMeta && (
        <div className="docx-block-meta">
          {block.structure!.region !== 'body' && (
            <span className="docx-structure-chip">
              {structureRegionLabel(block.structure!.region)}
            </span>
          )}
          {block.structure!.inTable && (
            <span className="docx-structure-chip docx-structure-chip-table">表格内</span>
          )}
        </div>
      )}
      <p className="docx-block" data-block-id={block.id}>
        {highlightRanges.length === 0
          ? block.text
          : renderHighlightedBlockText(block, highlightRanges, currentSearchKey, onRemoveSelection)}
      </p>
    </>
  );
}

export function renderHighlightedBlockText(
  block: DocxTextBlock,
  ranges: PreviewHighlightRange[],
  currentSearchKey: string | null,
  onRemoveSelection: (id: string) => void,
) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      nodes.push(
        <span key={`plain-${cursor}`} data-block-id={block.id} data-segment-start={cursor}>
          {block.text.slice(cursor, range.start)}
        </span>,
      );
    }

    const text = block.text.slice(range.start, range.end);
    const segmentKey = `${block.id}:${range.start}:${range.end}`;
    const isCurrentSearch = range.kind === 'search' && currentSearchKey === segmentKey;

    if (range.kind === 'manual' && range.selectionId) {
      nodes.push(
        <mark
          key={`manual-${range.start}`}
          className="docx-highlight"
          data-block-id={block.id}
          data-segment-start={range.start}
          title="点击移除标注"
          onClick={() => onRemoveSelection(range.selectionId ?? '')}
        >
          {text}
        </mark>,
      );
    } else if (range.kind === 'rule') {
      const ruleClass =
        range.ruleKind === 'system_keyword'
          ? 'docx-rule-hit docx-rule-hit-system'
          : range.ruleKind === 'profile_keyword'
            ? 'docx-rule-hit docx-rule-hit-profile'
            : 'docx-rule-hit';
      nodes.push(
        <mark
          key={`rule-${range.start}`}
          className={ruleClass}
          data-block-id={block.id}
          data-segment-start={range.start}
        >
          {text}
        </mark>,
      );
    } else {
      nodes.push(
        <mark
          key={`search-${range.start}`}
          className={cn('docx-search-hit', isCurrentSearch && 'docx-search-current')}
          data-block-id={block.id}
          data-segment-start={range.start}
        >
          {text}
        </mark>,
      );
    }

    cursor = range.end;
  }

  if (cursor < block.text.length) {
    nodes.push(
      <span key={`plain-${cursor}`} data-block-id={block.id} data-segment-start={cursor}>
        {block.text.slice(cursor)}
      </span>,
    );
  }

  return nodes;
}
