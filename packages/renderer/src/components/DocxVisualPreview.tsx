import { useCallback, useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { ChevronDown, ChevronUp, Clipboard, Highlighter, Loader2, X } from 'lucide-react';
import { Button, cn } from './ui.js';
import { getLocalApi, isLocalApiReady } from '../lib/local-api.js';
import {
  applyPreviewHighlights,
  type PreviewHighlightTerm,
} from '../lib/docx-preview-highlights.js';
import {
  applyPreviewSearch,
  clearPreviewSearchMarks,
  scrollSearchMatchIntoView,
} from '../lib/docx-preview-search.js';
import { compactText, formatError } from '../pages/workbench/workbench-utils.js';

type SelectionMenu = {
  x: number;
  y: number;
  text: string;
};

type DocxVisualPreviewProps = {
  filePath: string | null;
  loading?: boolean;
  highlightTerms?: PreviewHighlightTerm[];
  highlightRevision?: number;
  onSelectionCapture?: (text: string) => void;
  onError?: (message: string) => void;
  onHighlightIncomplete?: (message: string) => void;
};

const MENU_MARGIN = 8;
const HIGHLIGHT_DEBOUNCE_MS = 120;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function clampMenuPosition(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth - MENU_MARGIN;
  const maxY = window.innerHeight - MENU_MARGIN;
  return {
    x: Math.min(Math.max(x, MENU_MARGIN), maxX),
    y: Math.min(Math.max(y, MENU_MARGIN), maxY),
  };
}

export function DocxVisualPreview({
  filePath,
  loading: externalLoading = false,
  highlightTerms = [],
  highlightRevision = 0,
  onSelectionCapture,
  onError,
  onHighlightIncomplete,
}: DocxVisualPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renderTokenRef = useRef(0);
  const onErrorRef = useRef(onError);
  const onHighlightIncompleteRef = useRef(onHighlightIncomplete);
  const onSelectionCaptureRef = useRef(onSelectionCapture);
  const highlightTermsRef = useRef(highlightTerms);
  const highlightIncompleteNotifiedRef = useRef(false);
  const searchQueryRef = useRef('');
  const searchCurrentIndexRef = useRef(0);
  const [internalLoading, setInternalLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menu, setMenu] = useState<SelectionMenu | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);

  onErrorRef.current = onError;
  onHighlightIncompleteRef.current = onHighlightIncomplete;
  onSelectionCaptureRef.current = onSelectionCapture;
  highlightTermsRef.current = highlightTerms;
  searchQueryRef.current = searchQuery;
  searchCurrentIndexRef.current = searchCurrentIndex;

  const loading = externalLoading || internalLoading;
  const showEmptyHint = !filePath && !loading && !loadError;
  const searchEnabled = Boolean(filePath && !loading && !loadError && !showEmptyHint);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchCurrentIndex(0);
    setSearchTotal(0);
    searchQueryRef.current = '';
    searchCurrentIndexRef.current = 0;
    const container = containerRef.current;
    if (container) {
      clearPreviewSearchMarks(container);
    }
  }, []);

  const runPreviewSearch = useCallback(
    (container: HTMLElement, query: string, currentIndex: number) => {
      const result = applyPreviewSearch(container, query, currentIndex);
      setSearchTotal(result.total);
      setSearchCurrentIndex(result.currentIndex);
      searchCurrentIndexRef.current = result.currentIndex;
      scrollSearchMatchIntoView(result.currentElement);
      return result;
    },
    [],
  );

  const refreshPreviewDecorations = useCallback(
    (container: HTMLElement) => {
      clearPreviewSearchMarks(container);
      const result = applyPreviewHighlights(container, highlightTermsRef.current);
      if (
        result.failed > 0 &&
        !highlightIncompleteNotifiedRef.current &&
        onHighlightIncompleteRef.current
      ) {
        highlightIncompleteNotifiedRef.current = true;
        onHighlightIncompleteRef.current('部分预览高亮可能不完整');
      }
      const query = searchQueryRef.current.trim();
      if (query) {
        runPreviewSearch(container, query, searchCurrentIndexRef.current);
      } else {
        setSearchTotal(0);
        setSearchCurrentIndex(0);
        searchCurrentIndexRef.current = 0;
      }
    },
    [runPreviewSearch],
  );

  const goToSearchMatch = useCallback(
    (direction: 1 | -1) => {
      const container = containerRef.current;
      const query = searchQueryRef.current.trim();
      if (!container || !query) {
        return;
      }
      const nextIndex = searchCurrentIndexRef.current + direction;
      runPreviewSearch(container, query, nextIndex);
    },
    [runPreviewSearch],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const token = ++renderTokenRef.current;
    highlightIncompleteNotifiedRef.current = false;
    setMenu(null);
    setLoadError(null);
    closeSearch();
    container.replaceChildren();

    if (!filePath) {
      setInternalLoading(false);
      return;
    }

    if (!isLocalApiReady()) {
      return;
    }

    let cancelled = false;
    setInternalLoading(true);

    void (async () => {
      try {
        const { base64 } = await getLocalApi().readDocxFile({ filePath });
        if (cancelled || token !== renderTokenRef.current) {
          return;
        }
        const buffer = base64ToArrayBuffer(base64);
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        container.replaceChildren();
        await renderAsync(blob, container, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          useBase64URL: true,
        });
        if (!cancelled && token === renderTokenRef.current) {
          refreshPreviewDecorations(container);
        }
      } catch (error) {
        if (cancelled || token !== renderTokenRef.current) {
          return;
        }
        const message = formatError(error);
        setLoadError(message);
        onErrorRef.current?.(message);
      } finally {
        if (!cancelled && token === renderTokenRef.current) {
          setInternalLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [filePath, closeSearch, refreshPreviewDecorations]);

  useEffect(() => {
    if (loading || loadError || !filePath) {
      return;
    }
    const container = containerRef.current;
    if (!container || container.childElementCount === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      refreshPreviewDecorations(container);
    }, HIGHLIGHT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [highlightTerms, highlightRevision, loading, loadError, filePath, refreshPreviewDecorations]);

  useEffect(() => {
    if (!searchEnabled || !searchOpen) {
      return;
    }
    const container = containerRef.current;
    if (!container || container.childElementCount === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const query = searchQueryRef.current.trim();
      if (!query) {
        clearPreviewSearchMarks(container);
        setSearchTotal(0);
        setSearchCurrentIndex(0);
        searchCurrentIndexRef.current = 0;
        return;
      }
      runPreviewSearch(container, query, 0);
    }, HIGHLIGHT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery, searchEnabled, searchOpen, runPreviewSearch]);

  useEffect(() => {
    if (!searchEnabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const inSearchInput =
        target instanceof HTMLElement && target.closest('.docx-search-float') !== null;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      if (!searchOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (inSearchInput && event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          goToSearchMatch(-1);
        } else {
          goToSearchMatch(1);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchEnabled, searchOpen, closeSearch, goToSearchMatch]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    function closeMenu(event: Event) {
      if ((event.target as Element | null)?.closest('.preview-context-menu')) {
        return;
      }
      setMenu(null);
    }
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [menu]);

  useEffect(() => {
    const root = containerRef.current?.closest('.docx-visual-preview');
    if (!root) {
      return;
    }

    function handleWheel(event: Event) {
      if (!(event instanceof WheelEvent)) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest('.docx-preview-container')) {
        return;
      }
      event.preventDefault();
    }

    root.addEventListener('wheel', handleWheel, { passive: false });
    return () => root.removeEventListener('wheel', handleWheel);
  }, [filePath]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function handleMouseUp() {
      if (!onSelectionCaptureRef.current) {
        return;
      }
      const hostEl = containerRef.current;
      if (!hostEl) {
        return;
      }
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!text || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (!hostEl.contains(range.commonAncestorContainer)) {
        return;
      }
      const rect = range.getBoundingClientRect();
      const { x, y } = clampMenuPosition(rect.left + rect.width / 2, rect.top);
      setMenu({ text, x, y });
    }

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [filePath]);

  const searchCountLabel =
    searchTotal === 0
      ? searchQuery.trim()
        ? '0/0'
        : '—'
      : `${searchCurrentIndex + 1}/${searchTotal}`;

  return (
    <div className="docx-visual-preview">
      {loading && (
        <div className="docx-visual-preview-status docx-visual-preview-status-overlay">
          <Loader2 className="spin" size={20} />
          <span>正在加载预览…</span>
        </div>
      )}
      {!loading && loadError && (
        <div className="docx-visual-preview-status docx-visual-preview-status-overlay docx-visual-preview-error">
          <span>{loadError}</span>
        </div>
      )}
      {showEmptyHint && (
        <div className="docx-visual-preview-status docx-visual-preview-status-overlay">
          <span>选择文档后将在此显示版式预览</span>
        </div>
      )}
      {searchOpen && searchEnabled && (
        <div className="docx-search-float" onMouseDown={(event) => event.stopPropagation()}>
          <input
            ref={searchInputRef}
            className={cn('ui-input', 'docx-search-input')}
            placeholder="在文档中查找…"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              searchQueryRef.current = event.target.value;
              setSearchCurrentIndex(0);
              searchCurrentIndexRef.current = 0;
            }}
            aria-label="搜索文档"
          />
          <span className="docx-search-count">{searchCountLabel}</span>
          <Button
            type="button"
            variant="outline"
            aria-label="上一处"
            disabled={searchTotal === 0}
            onClick={() => goToSearchMatch(-1)}
          >
            <ChevronUp size={14} />
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="下一处"
            disabled={searchTotal === 0}
            onClick={() => goToSearchMatch(1)}
          >
            <ChevronDown size={14} />
          </Button>
          <Button type="button" variant="ghost" aria-label="关闭搜索" onClick={closeSearch}>
            <X size={14} />
          </Button>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          'docx-preview-container',
          (loading || loadError || showEmptyHint) && 'docx-preview-container-hidden',
        )}
      />
      {menu && onSelectionCaptureRef.current && (
        <div
          className="preview-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="preview-context-menu-actions">
            <Button
              type="button"
              onClick={() => {
                onSelectionCaptureRef.current?.(menu.text);
                setMenu(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <Highlighter size={14} />
              加入脱敏
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(menu.text);
                setMenu(null);
              }}
            >
              <Clipboard size={14} />
              复制
            </Button>
            <Button type="button" variant="ghost" aria-label="关闭" onClick={() => setMenu(null)}>
              <X size={14} />
            </Button>
          </div>
          <span className="preview-context-menu-hint" title={menu.text}>
            {compactText(menu.text, 48)}
          </span>
        </div>
      )}
    </div>
  );
}
