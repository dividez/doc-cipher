import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  formatModelHardwareLines,
  modelTierLabel,
  type AiAssistSettings,
  type AiDownloadProgress,
  type AiStatus,
  type ManifestModelEntry,
} from '@app/shared';
import { Button, Card, cn } from '../../components/ui.js';
import { TipsButton } from '../../components/TipsButton.js';
import { Field, SectionHead } from './workbench-ui.js';
import { formatError } from './workbench-utils.js';
import { getLocalApi, isLocalApiReady } from '../../lib/local-api.js';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

type ModelInstallState = 'not_installed' | 'installed' | 'active';

function ModelCatalogCard({
  entry,
  installState,
  isRecommended,
  downloadingModelId,
  progress,
  downloadLocked,
  actionBusy,
  onDownload,
  onCancel,
  onSetActive,
  onDelete,
}: {
  entry: ManifestModelEntry;
  installState: ModelInstallState;
  isRecommended: boolean;
  downloadingModelId: string | null;
  progress: AiDownloadProgress | null;
  downloadLocked: boolean;
  actionBusy: boolean;
  onDownload: (modelId: string) => void;
  onCancel: () => void;
  onSetActive: (modelId: string) => void;
  onDelete: (modelId: string) => void;
}) {
  const isDownloading = downloadingModelId === entry.id;
  const progressBytes = isDownloading && progress?.model_id === entry.id ? progress.bytes_done : 0;
  const progressTotal =
    isDownloading && progress?.model_id === entry.id ? progress.total_bytes : entry.size_bytes;
  const progressPct =
    progressTotal > 0 ? Math.min(100, Math.round((progressBytes / progressTotal) * 100)) : 0;
  const hardwareLines = formatModelHardwareLines(entry);
  const tier = modelTierLabel(entry.tier);

  const stateBadge =
    installState === 'active' ? (
      <span className="ai-model-badge ai-model-badge-active">当前模型</span>
    ) : installState === 'installed' ? (
      <span className="ai-model-badge ai-model-badge-muted">已安装</span>
    ) : null;

  return (
    <li
      className={cn(
        'ai-model-card',
        installState === 'active' && 'ai-model-card-active',
        installState === 'installed' && 'ai-model-card-installed',
      )}
    >
      <div className="ai-model-card-head">
        <div>
          <strong>{entry.name}</strong>
          {isRecommended ? <span className="ai-model-badge">推荐</span> : null}
          {tier ? <span className="ai-model-badge ai-model-badge-muted">{tier}</span> : null}
          {stateBadge}
        </div>
        <span className="section-meta">{formatBytes(entry.size_bytes)}</span>
      </div>
      <p className="app-settings-hint">{entry.description}</p>
      {hardwareLines.length > 0 ? (
        <ul className="ai-model-hardware">
          {hardwareLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {isDownloading ? (
        <div className="ai-download-progress">
          <div className="ai-progress-bar">
            <div className="ai-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span>
            {progress?.status === 'verifying' ? '校验中…' : '下载中…'} {formatBytes(progressBytes)}{' '}
            / {formatBytes(progressTotal)}（{progressPct}%）
          </span>
          <Button type="button" variant="outline" onClick={onCancel}>
            取消下载
          </Button>
        </div>
      ) : (
        <div className="ai-model-card-actions">
          {installState === 'not_installed' ? (
            <Button
              type="button"
              variant={isRecommended ? 'default' : 'outline'}
              onClick={() => onDownload(entry.id)}
              disabled={downloadLocked || actionBusy}
            >
              下载
            </Button>
          ) : null}
          {installState === 'installed' ? (
            <Button
              type="button"
              variant="default"
              onClick={() => onSetActive(entry.id)}
              disabled={actionBusy}
            >
              设为当前
            </Button>
          ) : null}
          {installState !== 'not_installed' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onDelete(entry.id)}
              disabled={actionBusy || downloadLocked}
            >
              <Trash2 size={16} /> 删除
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function AiAssistSection({
  aiAssist,
  onUpdateAiAssist,
  onNotice,
}: {
  aiAssist: AiAssistSettings;
  onUpdateAiAssist: (patch: Partial<AiAssistSettings>) => void;
  onNotice: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [progress, setProgress] = useState<AiDownloadProgress | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!isLocalApiReady()) {
      return;
    }
    try {
      const next = await getLocalApi().getAiStatus();
      setStatus(next);
    } catch (error) {
      onNotice('error', formatError(error));
    }
  }, [onNotice]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!isLocalApiReady()) {
      return;
    }
    return getLocalApi().onAiDownloadProgress((event) => {
      setProgress(event);
      if (
        event.status === 'completed' ||
        event.status === 'failed' ||
        event.status === 'cancelled'
      ) {
        setActiveDownloadId(null);
        void refreshStatus();
      }
    });
  }, [refreshStatus]);

  const models = status?.available_models ?? [];
  const installedIds = useMemo(
    () => new Set((status?.installed_models ?? []).map((m) => m.id)),
    [status?.installed_models],
  );
  const activeModelId = status?.active_model_id ?? null;
  const downloadingModelId =
    activeDownloadId ??
    (progress?.status === 'downloading' || progress?.status === 'verifying'
      ? progress.model_id
      : status?.download_task?.status === 'downloading' ||
          status?.download_task?.status === 'verifying'
        ? status.download_task.model_id
        : null);
  const downloadingEntry = downloadingModelId
    ? models.find((m) => m.id === downloadingModelId)
    : null;
  const downloadLocked = Boolean(downloadingModelId);
  const canTuneThreshold = installedIds.size > 0;

  const resolveInstallState = (modelId: string): ModelInstallState => {
    if (activeModelId === modelId) {
      return 'active';
    }
    if (installedIds.has(modelId)) {
      return 'installed';
    }
    return 'not_installed';
  };

  const handleDownload = (modelId: string) => {
    if (!isLocalApiReady() || downloadLocked) {
      return;
    }
    setActiveDownloadId(modelId);
    void (async () => {
      try {
        await getLocalApi().downloadAiModel(modelId);
        onNotice('success', '模型下载并校验完成');
        await refreshStatus();
      } catch (error) {
        const message = formatError(error);
        if (!message.includes('取消')) {
          onNotice('error', message);
        }
      } finally {
        setActiveDownloadId(null);
      }
    })();
  };

  const handleCancel = () => {
    if (!isLocalApiReady() || !downloadLocked) {
      return;
    }
    void (async () => {
      try {
        await getLocalApi().cancelAiDownload();
        onNotice('info', '已取消下载');
        setActiveDownloadId(null);
        setProgress(null);
        await refreshStatus();
      } catch (error) {
        onNotice('error', formatError(error));
      }
    })();
  };

  const handleSetActive = (modelId: string) => {
    if (!isLocalApiReady()) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await getLocalApi().setActiveAiModel(modelId);
        const name = models.find((m) => m.id === modelId)?.name ?? modelId;
        onNotice('success', `已将「${name}」设为当前模型`);
        await refreshStatus();
      } catch (error) {
        onNotice('error', formatError(error));
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleDelete = (modelId: string) => {
    if (!isLocalApiReady()) {
      return;
    }
    const entry = models.find((m) => m.id === modelId);
    const label = entry?.name ?? modelId;
    if (!window.confirm(`确定删除本地模型「${label}」？删除后需重新下载才能用于识别。`)) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await getLocalApi().deleteAiModel(modelId);
        onNotice('success', '模型已删除');
        await refreshStatus();
      } catch (error) {
        onNotice('error', formatError(error));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Card className="app-settings-card">
      <SectionHead
        title="本地 AI 模型"
        meta="本地推理"
        tips={
          <p>
            可安装多个模型，在卡片上点「设为当前」选择脱敏时使用的模型。脱敏页使用「AI
            辅助识别」；正式脱敏不调用模型。
          </p>
        }
      />

      {status?.manifest_error ? (
        <p className="app-settings-hint ai-hint-error">
          暂时无法加载可下载模型列表，请关闭应用后重新打开；若仍无法显示，请联系技术支持。
        </p>
      ) : null}

      {installedIds.size > 0 ? (
        <ul className="app-settings-list">
          <li className="app-settings-row app-settings-row-stack">
            <div className="app-settings-copy">
              <strong>当前使用模型</strong>
              <span>{status?.active_model_name ?? '未选择'}</span>
            </div>
          </li>
          <li className="app-settings-row">
            <div className="app-settings-copy">
              <strong>已安装</strong>
              <span>{installedIds.size} 个</span>
            </div>
          </li>
          {installedIds.size >= 2 ? (
            <li className="app-settings-row app-settings-row-stack">
              <p className="app-settings-hint">
                已安装多个模型，在下方卡片点「设为当前」即可更换当前模型。
              </p>
            </li>
          ) : null}
        </ul>
      ) : null}

      {status && !status.runtime_available ? (
        <p className="app-settings-hint ai-hint-error">未检测到 llama 运行时</p>
      ) : null}

      {downloadLocked && downloadingEntry ? (
        <div className="ai-download-banner">
          <span>
            正在下载：{downloadingEntry.name}（
            {progress?.status === 'verifying' ? '校验中…' : '下载中…'}）
          </span>
          <Button type="button" variant="outline" onClick={handleCancel}>
            取消下载
          </Button>
        </div>
      ) : null}

      {models.length > 0 ? (
        <ul className="ai-model-catalog">
          {models.map((entry) => (
            <ModelCatalogCard
              key={entry.id}
              entry={entry}
              installState={resolveInstallState(entry.id)}
              isRecommended={entry.recommended}
              downloadingModelId={downloadingModelId}
              progress={progress}
              downloadLocked={downloadLocked}
              actionBusy={busy}
              onDownload={handleDownload}
              onCancel={handleCancel}
              onSetActive={handleSetActive}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      ) : (
        <p className="app-settings-hint">暂时无法显示可下载模型，请重启应用后重试。</p>
      )}

      <Field
        label={
          <span className="field-label-with-tips">
            置信度阈值：{aiAssist.confidence_threshold.toFixed(2)}
            <TipsButton label="置信度说明">
              <p>高于此值的 AI 实体才会写入识别结果，可在下载模型后调整。</p>
            </TipsButton>
          </span>
        }
      >
        <input
          type="range"
          min={0.5}
          max={0.95}
          step={0.05}
          value={aiAssist.confidence_threshold}
          onChange={(event) =>
            onUpdateAiAssist({ confidence_threshold: Number(event.target.value) })
          }
          disabled={!canTuneThreshold}
        />
      </Field>
    </Card>
  );
}
