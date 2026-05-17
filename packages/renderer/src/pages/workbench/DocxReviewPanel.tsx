import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import type { PreviewHighlightTerm } from '../../lib/docx-preview-highlights.js';
import { Button } from '../../components/ui.js';
import { DocxVisualPreview } from '../../components/DocxVisualPreview.js';

export function DocxReviewPanel({
  previewFilePath,
  loading,
  manualKeywordCount,
  highlightTerms,
  highlightRevision,
  onAddKeyword,
  onClearKeywords,
  onPreviewError,
}: {
  previewFilePath: string | null;
  loading: boolean;
  manualKeywordCount: number;
  highlightTerms: PreviewHighlightTerm[];
  highlightRevision: number;
  onAddKeyword: (text: string) => void;
  onClearKeywords: () => void;
  onPreviewError: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const handlePreviewError = useCallback(
    (message: string) => onPreviewError('error', message),
    [onPreviewError],
  );

  const handleHighlightIncomplete = useCallback(
    (message: string) => onPreviewError('info', message),
    [onPreviewError],
  );

  return (
    <section className="docx-review">
      <div className="docx-review-toolbar">
        <div>
          <h3>文档预览</h3>
          <span>只读版式 · 划词加入手动关键词</span>
        </div>
        <div className="docx-review-actions">
          <Button
            type="button"
            variant="outline"
            disabled={manualKeywordCount === 0}
            onClick={onClearKeywords}
          >
            <Trash2 size={14} />
            清空手动词
          </Button>
        </div>
      </div>
      <div className="docx-preview-body">
        <DocxVisualPreview
          filePath={previewFilePath}
          loading={loading}
          highlightTerms={highlightTerms}
          highlightRevision={highlightRevision}
          onSelectionCapture={onAddKeyword}
          onError={handlePreviewError}
          onHighlightIncomplete={handleHighlightIncomplete}
        />
      </div>
    </section>
  );
}
