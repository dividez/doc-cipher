import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from './ui.js';

export function TipsButton({
  label = '查看说明',
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={cn('tips-button', className)} ref={rootRef}>
      <button
        type="button"
        className="tips-button-trigger"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={14} aria-hidden />
      </button>
      {open ? (
        <div id={popoverId} className="tips-button-popover" role="dialog" aria-label={label}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
