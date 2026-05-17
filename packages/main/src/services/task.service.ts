import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { MappingItem, MaskingRule, TaskHistoryEntry } from '@app/shared';
import { ensureAppDataDirs } from './app-paths.service.js';

export type TaskKind = 'mask' | 'restore';
export type TaskStatus = 'running' | 'success' | 'failed';

export type RuleManifestSummary = {
  id: string;
  name: string;
  matched_count: number;
};

export type TaskManifest = {
  version: '1.0.0';
  task_id: string;
  kind: TaskKind;
  source_file_name: string;
  masked_file_name?: string;
  restore_file_name?: string;
  restored_file_name?: string;
  created_at: string;
  updated_at: string;
  status: TaskStatus;
  rules?: RuleManifestSummary[];
  source_sha256?: string;
  masked_sha256?: string;
  restored_sha256?: string;
  item_count: number;
  error_message?: string;
};

export type TaskContext = {
  taskId: string;
  kind: TaskKind;
  taskDir: string;
  manifestPath: string;
  taskLogPath: string;
  sourceFileName: string;
  createdAt: string;
};

type TaskIndex = {
  version: '1.0.0';
  updated_at: string;
  tasks: Array<{
    task_id: string;
    kind: TaskKind;
    status: TaskStatus;
    source_file_name: string;
    task_dir: string;
    manifest_path: string;
    created_at: string;
    updated_at: string;
    item_count: number;
  }>;
};

export async function createTaskContext(payload: {
  kind: TaskKind;
  sourcePath: string;
  outputRoot?: string;
}): Promise<TaskContext> {
  await ensureAppDataDirs();

  const createdAt = new Date().toISOString();
  const stamp = formatLocalTimestamp(new Date());
  const sourceFileName = basename(payload.sourcePath);
  const baseName = sanitizePathSegment(basename(sourceFileName, extname(sourceFileName)));
  const suffix = Math.random().toString(16).slice(2, 6);
  const taskId = `task_${stamp}_${suffix}`;
  const outputRoot = payload.outputRoot || join(dirname(payload.sourcePath), 'DocCipher_Output');
  const taskDir = join(outputRoot, `${stamp}_${baseName}`);
  const manifestPath = join(taskDir, 'manifest.json');
  const taskLogPath = join(taskDir, 'task.log');

  await mkdir(taskDir, { recursive: true });
  await writeTaskLog({ taskLogPath }, `Task ${taskId} created`);

  return {
    taskId,
    kind: payload.kind,
    taskDir,
    manifestPath,
    taskLogPath,
    sourceFileName,
    createdAt,
  };
}

export async function writeTaskLog(
  task: Pick<TaskContext, 'taskLogPath'>,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
): Promise<void> {
  const line = `${new Date().toISOString()} [${level}] ${message}\n`;
  await appendFile(task.taskLogPath, line, 'utf8');
}

export async function writeTaskManifest(
  task: TaskContext,
  manifest: Omit<
    TaskManifest,
    'version' | 'task_id' | 'kind' | 'source_file_name' | 'created_at' | 'updated_at'
  >,
): Promise<TaskManifest> {
  const fullManifest: TaskManifest = {
    version: '1.0.0',
    task_id: task.taskId,
    kind: task.kind,
    source_file_name: task.sourceFileName,
    created_at: task.createdAt,
    updated_at: new Date().toISOString(),
    ...manifest,
  };

  await writeFile(task.manifestPath, JSON.stringify(fullManifest, null, 2), 'utf8');
  await updateTaskIndex(task, fullManifest);
  return fullManifest;
}

export function summarizeRules(rules: MaskingRule[], items: MappingItem[]): RuleManifestSummary[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.rule_id, (counts.get(item.rule_id) ?? 0) + 1);
  }

  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    matched_count: counts.get(rule.id) ?? 0,
  }));
}

async function updateTaskIndex(task: TaskContext, manifest: TaskManifest): Promise<void> {
  const { tasksDir } = await ensureAppDataDirs();
  const indexPath = join(tasksDir, 'task-index.json');
  const index = await readTaskIndex(indexPath);
  const entry = {
    task_id: task.taskId,
    kind: task.kind,
    status: manifest.status,
    source_file_name: task.sourceFileName,
    task_dir: task.taskDir,
    manifest_path: task.manifestPath,
    created_at: task.createdAt,
    updated_at: manifest.updated_at,
    item_count: manifest.item_count,
  };
  const nextTasks = [entry, ...index.tasks.filter((item) => item.task_id !== task.taskId)].slice(
    0,
    500,
  );

  await writeFile(
    indexPath,
    JSON.stringify(
      {
        version: '1.0.0',
        updated_at: new Date().toISOString(),
        tasks: nextTasks,
      } satisfies TaskIndex,
      null,
      2,
    ),
    'utf8',
  );
}

export async function listTaskHistory(limit = 120): Promise<TaskHistoryEntry[]> {
  const { tasksDir } = await ensureAppDataDirs();
  const indexPath = join(tasksDir, 'task-index.json');
  const index = await readTaskIndex(indexPath);
  return index.tasks.slice(0, Math.max(1, limit));
}

async function readTaskIndex(indexPath: string): Promise<TaskIndex> {
  try {
    const parsed = JSON.parse(await readFile(indexPath, 'utf8')) as TaskIndex;
    return {
      version: '1.0.0',
      updated_at: parsed.updated_at || new Date().toISOString(),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      tasks: [],
    };
  }
}

function formatLocalTimestamp(date: Date): string {
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ].map((value) => String(value).padStart(2, '0'));

  return `${parts[0]}${parts[1]}${parts[2]}_${parts[3]}${parts[4]}${parts[5]}`;
}

function sanitizePathSegment(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'document'
  );
}
