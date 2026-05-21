import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  formatModelHardwareLines,
  modelTierLabel,
  type AiAssistSettings,
  type AiDownloadProgress,
  type AiStatus,
  type ManifestModelEntry,
} from '@app/shared';
import { Button, Card, cn } from '../../components/ui.js';
import { Field } from './workbench-ui.js';
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

function ModelCatalogCard({
  entry,
  isRecommended,
  isActive,
  downloadingModelId,
  progress,
  downloadLocked,
  onDownload,
  onCancel,
}: {
  entry: ManifestModelEntry;
  isRecommended: boolean;
  isActive: boolean;
  downloadingModelId: string | null;
  progress: AiDownloadProgress | null;
  downloadLocked: boolean;
  onDownload: (modelId: string) => void;
  onCancel: () => void;
}) {
  const isDownloading = downloadingModelId === entry.id;
  const progressBytes = isDownloading && progress?.model_id === entry.id ? progress.bytes_done : 0;
  const progressTotal =
    isDownloading && progress?.model_id === entry.id ? progress.total_bytes : entry.size_bytes;
  const progressPct =
    progressTotal > 0 ? Math.min(100, Math.round((progressBytes / progressTotal) * 100)) : 0;
  const hardwareLines = formatModelHardwareLines(entry);
  const tier = modelTierLabel(entry.tier);

  return (
    <li className={cn('ai-model-card', isActive && 'ai-model-card-active')}>
      <div className="ai-model-card-head">
        <div>
          <strong>{entry.name}</strong>
          {isRecommended ? <span className="ai-model-badge">推荐</span> : null}
          {tier ? <span className="ai-model-badge ai-model-badge-muted">{tier}</span> : null}
          {isActive ? <span className="ai-model-badge ai-model-badge-active">已安装</span> : null}
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
        <Button
          type="button"
          variant={isRecommended ? 'default' : 'outline'}
          onClick={() => onDownload(entry.id)}
          disabled={(downloadLocked && !isDownloading) || isActive}
        >
          {isActive ? '已安装' : isRecommended ? '下载推荐模型' : '下载此模型'}
        </Button>
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
  const installed = status?.model_installed ?? false;
  const canEnable = installed;
  const activeModelId = status?.active_model_id;

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

  const handleDelete = async () => {
    if (!isLocalApiReady()) {
      return;
    }
    if (!window.confirm('确定删除本地模型？删除后需重新下载才能使用 AI 辅助脱敏。')) {
      return;
    }
    setBusy(true);
    try {
      await getLocalApi().deleteAiModel();
      onUpdateAiAssist({ enabled: false });
      onNotice('success', '本地模型已删除');
      await refreshStatus();
    } catch (error) {
      onNotice('error', formatError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="app-settings-card">
      <div className="section-head">
        <h3>AI 辅助脱敏</h3>
        <span className="section-meta">本地推理，文档不上传云端</span>
      </div>

      {status?.manifest_error ? (
        <p className="app-settings-hint ai-hint-error">
          暂时无法加载可下载模型列表，请关闭应用后重新打开；若仍无法显示，请联系技术支持。
        </p>
      ) : null}

      {!installed ? (
        <>
          <p className="app-settings-hint">
            请先下载下方模型。下载完成后，打开「启用 AI
            辅助脱敏」即可使用；识别在本地进行，文档不会上传云端。
          </p>
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
                  isRecommended={entry.recommended}
                  isActive={false}
                  downloadingModelId={downloadingModelId}
                  progress={progress}
                  downloadLocked={downloadLocked}
                  onDownload={handleDownload}
                  onCancel={handleCancel}
                />
              ))}
            </ul>
          ) : (
            <p className="app-settings-hint">暂时无法显示可下载模型，请重启应用后重试。</p>
          )}
        </>
      ) : (
        <>
          <ul className="app-settings-list">
            <li className="app-settings-row app-settings-row-stack">
              <div className="app-settings-copy">
                <strong>当前模型</strong>
                <span>{status?.active_model_name ?? '已安装'}</span>
              </div>
            </li>
            <li className="app-settings-row">
              <div className="app-settings-copy">
                <strong>运行方式</strong>
                <span>本地推理</span>
              </div>
              <span className="section-meta">
                {status?.server_running ? '正在运行' : '待命中时自动启动'}
              </span>
            </li>
          </ul>

          {activeModelId
            ? (() => {
                const activeEntry = models.find((m) => m.id === activeModelId);
                const hwLines = activeEntry ? formatModelHardwareLines(activeEntry) : [];
                return hwLines.length > 0 ? (
                  <ul className="ai-model-hardware ai-model-hardware-compact">
                    {hwLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null;
              })()
            : null}

          {installed ? (
            <p className="app-settings-hint">
              模型已就绪。打开下方「启用 AI 辅助脱敏」即可在脱敏时使用本地识别。
            </p>
          ) : null}

          <ul className="app-settings-list">
            <li className="app-settings-row">
              <div className="app-settings-copy">
                <strong>启用 AI 辅助脱敏</strong>
                <span>与规则脱敏同时生效，自动识别并替换敏感信息</span>
              </div>
              <button
                type="button"
                className={cn('rule-toggle', aiAssist.enabled && canEnable && 'rule-toggle-on')}
                disabled={!canEnable}
                onClick={() => onUpdateAiAssist({ enabled: !aiAssist.enabled })}
              >
                {aiAssist.enabled && canEnable ? '已启用' : '已停用'}
              </button>
            </li>
          </ul>

          <Field label={`置信度阈值：${aiAssist.confidence_threshold.toFixed(2)}`}>
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.05}
              value={aiAssist.confidence_threshold}
              onChange={(event) =>
                onUpdateAiAssist({ confidence_threshold: Number(event.target.value) })
              }
              disabled={!canEnable}
            />
          </Field>

          <div className="profile-actions profile-actions-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              <Trash2 size={16} /> 删除当前模型
            </Button>
          </div>

          {models.filter((m) => m.id !== activeModelId).length > 0 ? (
            <>
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
              <p className="app-settings-hint">更换模型需先删除当前模型，再下载其他备选：</p>
              <ul className="ai-model-catalog">
                {models
                  .filter((m) => m.id !== activeModelId)
                  .map((entry) => (
                    <ModelCatalogCard
                      key={entry.id}
                      entry={entry}
                      isRecommended={entry.recommended}
                      isActive={false}
                      downloadingModelId={downloadingModelId}
                      progress={progress}
                      downloadLocked={downloadLocked}
                      onDownload={handleDownload}
                      onCancel={handleCancel}
                    />
                  ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
