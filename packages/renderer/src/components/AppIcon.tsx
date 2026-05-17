import { appIconUrl } from '../lib/app-icon-url';
import { cn } from './ui';

export function AppIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src={appIconUrl}
      alt=""
      width={size}
      height={size}
      className={cn('app-icon', className)}
      draggable={false}
    />
  );
}
