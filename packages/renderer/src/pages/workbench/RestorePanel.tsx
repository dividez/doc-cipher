import { FolderOpen, Loader2, Undo2 } from 'lucide-react';
import type { RestoreDocxResult } from '@app/shared';
import { Button, Card, Input } from '../../components/ui.js';
import { Field, PanelHero, PathField, ResultFileRow } from './workbench-ui.js';

export function RestorePanel({
  busy,
  form,
  result,
  onFormChange,
  onOpenFolder,
  onPickDocx,
  onPickRestore,
  onPickOutput,
  onRun,
}: {
  busy: boolean;
  form: { maskedDocxPath: string; restoreFilePath: string; outputDir: string; password: string };
  result: RestoreDocxResult | null;
  onFormChange: React.Dispatch<
    React.SetStateAction<{
      maskedDocxPath: string;
      restoreFilePath: string;
      outputDir: string;
      password: string;
    }>
  >;
  onOpenFolder: (path: string) => void;
  onPickDocx: () => void;
  onPickRestore: () => void;
  onPickOutput: () => void;
  onRun: () => void;
}) {
  return (
    <div className="panel-stack">
      <PanelHero
        title="还原文档"
        description="使用脱敏 docx 与 restore.enc，在本地按完整 token 执行部分还原。"
      />
      <Card className="task-card">
        <PathField label="脱敏 docx" value={form.maskedDocxPath} onPick={onPickDocx} />
        <PathField
          label="还原文件 restore.enc"
          value={form.restoreFilePath}
          onPick={onPickRestore}
        />
        <PathField
          label="输出目录（可选）"
          value={form.outputDir}
          onPick={onPickOutput}
          placeholder="默认输出到脱敏文件旁"
        />
        <Field label="还原密码">
          <Input
            type="password"
            value={form.password}
            onChange={(event) =>
              onFormChange((current) => ({ ...current, password: event.target.value }))
            }
          />
        </Field>
        <Button type="button" onClick={onRun} disabled={busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Undo2 size={16} />}
          开始还原
        </Button>
      </Card>
      {result && (
        <Card className="result-panel">
          <h3>已生成</h3>
          <ul className="result-files">
            <ResultFileRow
              path={result.restoredDocxPath}
              onOpen={() => onOpenFolder(result.restoredDocxPath)}
            />
            <ResultFileRow
              path={result.reportPath}
              onOpen={() => onOpenFolder(result.reportPath)}
            />
          </ul>
          <p className="result-stats">
            成功还原 {result.restoredTokens} / {result.totalTokens} 个 token，共替换{' '}
            {result.restoredOccurrences} 处
          </p>
          <p className="result-stats">
            未找到 {result.missingTokens} 个，未知 token {result.unknownTokens} 个
            {result.fingerprintMatch ? '' : '，当前 docx 已被编辑'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenFolder(result.restoredDocxPath)}
          >
            <FolderOpen size={16} /> 打开目录
          </Button>
        </Card>
      )}
    </div>
  );
}
