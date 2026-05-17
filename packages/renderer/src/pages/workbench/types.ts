import type { DocxManualSelection } from '@app/shared';

export type ActiveView = 'home' | 'mask' | 'restore' | 'profiles' | 'settings';
export type ManualSelectionDraft = Omit<DocxManualSelection, 'id'>;
export type PreviewContextMenu = {
  x: number;
  y: number;
  selection: ManualSelectionDraft;
};
