import { RefreshCw, Upload } from 'lucide-react';
import type { TaskHistoryEntry } from '@app/shared';
import { Button, Card, cn } from '../../components/ui.js';
import { PanelHero } from './workbench-ui.js';
import { formatRecentTime } from './workbench-utils.js';
import type { RecentTask } from '../../lib/recent-tasks.js';

export function HomePanel({
  dragOver,
  recentTasks,
  taskHistory,
  taskHistoryRefreshing,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onPick,
  onOpenRecent,
  onRefreshHistory,
  onOpenTaskDir,
}: {
  dragOver: boolean;
  recentTasks: RecentTask[];
  taskHistory: TaskHistoryEntry[];
  taskHistoryRefreshing: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onPick: () => void;
  onOpenRecent: (path: string) => void;
  onRefreshHistory: () => void;
  onOpenTaskDir: (path: string) => void;
}) {
  return (
    <div className="panel-stack">
      <PanelHero
        title="选择文件开始脱敏"
        description="拖拽 docx 到下方区域，或点击选择文件。所有处理均在本地完成。"
      />
      <div
        className={cn('drop-zone', dragOver && 'drop-zone-active')}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Upload size={28} />
        <p>拖拽 docx 到这里</p>
        <Button type="button" onClick={onPick}>
          选择文件
        </Button>
      </div>
      {recentTasks.length > 0 && (
        <Card className="recent-card">
          <h3>最近打开</h3>
          <ul className="recent-list">
            {recentTasks.map((task) => (
              <li key={task.path}>
                <button
                  type="button"
                  className="recent-item"
                  onClick={() => onOpenRecent(task.path)}
                >
                  <span>{task.name}</span>
                  <span className="recent-meta">{formatRecentTime(task.timestamp)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="recent-card">
        <div className="section-head task-history-head">
          <h3>任务历史</h3>
          <button
            type="button"
            className={cn(
              'task-history-refresh',
              taskHistoryRefreshing && 'task-history-refresh-loading',
            )}
            disabled={taskHistoryRefreshing}
            onClick={onRefreshHistory}
          >
            <RefreshCw size={14} className={taskHistoryRefreshing ? 'spin' : undefined} />
            <span>{taskHistoryRefreshing ? '刷新中…' : '刷新'}</span>
          </button>
        </div>
        {taskHistory.length > 0 ? (
          <ul className="task-history-list">
            {taskHistory.map((task) => (
              <li key={task.task_id} className="task-history-item">
                <div className="task-history-main">
                  <span className="task-history-title">{task.source_file_name}</span>
                  <span className="task-history-meta">
                    <span
                      className={cn(
                        'task-history-status-text',
                        task.status === 'success' && 'task-history-status-success',
                        task.status === 'failed' && 'task-history-status-failed',
                      )}
                    >
                      {task.status === 'success'
                        ? '成功'
                        : task.status === 'failed'
                          ? '失败'
                          : '进行中'}
                    </span>
                    <span>
                      {' '}
                      · {task.kind === 'mask' ? '脱敏' : '还原'} · {task.item_count} 处 ·{' '}
                    </span>
                    <span>{formatRecentTime(task.updated_at)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="task-history-open"
                  onClick={() => onOpenTaskDir(task.manifest_path)}
                >
                  打开目录
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="manual-empty">尚无任务记录，完成一次脱敏或还原后将出现在此处。</p>
        )}
      </Card>
    </div>
  );
}
