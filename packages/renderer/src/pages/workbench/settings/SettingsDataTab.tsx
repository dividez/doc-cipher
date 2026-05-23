import { FolderOpen } from 'lucide-react';
import type { AppStoragePathsInfo } from '../../../lib/local-api.js';
import { Button, Card, Input } from '../../../components/ui.js';
import { Field } from '../workbench-ui.js';

type SettingsDataTabProps = {
  storagePaths: AppStoragePathsInfo | null;
  onOpenAppDataDir: () => void;
  onOpenUserDataDir: () => void;
  onPickUserDataDir: () => void;
  onResetUserDataDir: () => void;
};

export function SettingsDataTab({
  storagePaths,
  onOpenAppDataDir,
  onOpenUserDataDir,
  onPickUserDataDir,
  onResetUserDataDir,
}: SettingsDataTabProps) {
  return (
    <Card className="app-settings-card">
      <div className="section-head">
        <h3>数据存放位置</h3>
      </div>
      <ul className="app-settings-list">
        <li className="app-settings-row app-settings-row-stack">
          <div className="app-settings-copy">
            <strong>应用设置</strong>
            <span>位置固定，不能改</span>
          </div>
          <Field label="位置">
            <div className="path-field">
              <Input value={storagePaths?.appDataDir ?? ''} readOnly spellCheck={false} />
              <Button
                type="button"
                variant="outline"
                onClick={onOpenAppDataDir}
                disabled={!storagePaths}
                aria-label="在 Finder 中查看应用设置文件夹"
              >
                <FolderOpen size={16} />
              </Button>
            </div>
          </Field>
        </li>
        <li className="app-settings-row app-settings-row-stack">
          <div className="app-settings-copy">
            <strong>方案与记录</strong>
            <span>可以改到其他文件夹，改完要重启</span>
          </div>
          <Field label="位置">
            <div className="path-field">
              <Input value={storagePaths?.userDataDir ?? ''} readOnly spellCheck={false} />
              <Button
                type="button"
                variant="outline"
                onClick={onOpenUserDataDir}
                disabled={!storagePaths}
                aria-label="在 Finder 中查看方案与记录文件夹"
              >
                <FolderOpen size={16} />
              </Button>
            </div>
          </Field>
          <div className="profile-actions profile-actions-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={onPickUserDataDir}
              disabled={!storagePaths}
            >
              更换位置…
            </Button>
            {storagePaths?.isCustomUserDataDir ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onResetUserDataDir}
                disabled={!storagePaths}
              >
                恢复默认
              </Button>
            ) : null}
          </div>
        </li>
      </ul>
    </Card>
  );
}
