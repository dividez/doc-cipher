const STORAGE_KEY = 'doccipher-recent-tasks';
const MAX_TASKS = 8;

export type RecentTask = {
  path: string;
  name: string;
  timestamp: string;
};

export function loadRecentTasks(): RecentTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RecentTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentTask(path: string): RecentTask[] {
  const name = path.split(/[/\\]/).pop() ?? path;
  const next: RecentTask[] = [
    {path, name, timestamp: new Date().toISOString()},
    ...loadRecentTasks().filter((task) => task.path !== path),
  ].slice(0, MAX_TASKS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
