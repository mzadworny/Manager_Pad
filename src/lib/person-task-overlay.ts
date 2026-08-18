import type { Meeting, Task } from "@/types";

const STORAGE_KEY_PREFIX = "manager-pad:person-task-overlay:v1:";
const OVERLAY_TASK_ID_PREFIX = "overlay:";

interface OverlayStamp {
  completedMeetingId: string | null;
}

interface OverlayState {
  floating: Task[];
  stamps: Record<string, OverlayStamp>;
}

function storageKey(employeeId: string): string {
  return `${STORAGE_KEY_PREFIX}${employeeId}`;
}

function emptyState(): OverlayState {
  return { floating: [], stamps: {} };
}

function readOverlay(employeeId: string): OverlayState {
  if (typeof sessionStorage === "undefined") {
    return emptyState();
  }

  try {
    const raw = sessionStorage.getItem(storageKey(employeeId));
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as Partial<OverlayState>;
    return {
      floating: Array.isArray(parsed.floating) ? parsed.floating : [],
      stamps: parsed.stamps && typeof parsed.stamps === "object" ? parsed.stamps : {},
    };
  } catch {
    return emptyState();
  }
}

function writeOverlay(employeeId: string, state: OverlayState): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(storageKey(employeeId), JSON.stringify(state));
  } catch {
    // Private mode / quota — overlay is best-effort until Phase 3.
  }
}

export function isOverlayTaskId(id: string): boolean {
  return id.startsWith(OVERLAY_TASK_ID_PREFIX);
}

export function sortPersonTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.completedAt ? 1 : 0;
    const bDone = b.completedAt ? 1 : 0;
    if (aDone !== bDone) {
      return aDone - bDone;
    }
    const aPlanned = a.plannedDate ?? "9999-12-31";
    const bPlanned = b.plannedDate ?? "9999-12-31";
    if (aPlanned !== bPlanned) {
      return aPlanned.localeCompare(bPlanned);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function addFloatingPersonTask(
  employeeId: string,
  input: { managerId: string; title: string; plannedDate: string | null },
): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: `${OVERLAY_TASK_ID_PREFIX}${crypto.randomUUID()}`,
    managerId: input.managerId,
    meetingId: null,
    employeeId,
    title: input.title,
    plannedDate: input.plannedDate,
    completedAt: null,
    completedMeetingId: null,
    createdAt: now,
    updatedAt: now,
  };
  const state = readOverlay(employeeId);
  state.floating.push(task);
  writeOverlay(employeeId, state);
  return task;
}

export function updateFloatingPersonTask(
  employeeId: string,
  taskId: string,
  patch: Partial<Pick<Task, "title" | "plannedDate" | "completedAt" | "completedMeetingId">>,
): Task | null {
  const state = readOverlay(employeeId);
  const current = state.floating.find((task) => task.id === taskId);
  if (!current) {
    return null;
  }
  const updated: Task = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  state.floating = state.floating.map((task) => (task.id === taskId ? updated : task));
  writeOverlay(employeeId, state);
  return updated;
}

export function deleteFloatingPersonTask(employeeId: string, taskId: string): void {
  const state = readOverlay(employeeId);
  state.floating = state.floating.filter((task) => task.id !== taskId);
  writeOverlay(employeeId, state);
}

export function stampPersonTaskCompletion(employeeId: string, taskId: string, stamp: OverlayStamp | null): void {
  const state = readOverlay(employeeId);
  if (stamp === null) {
    state.stamps = Object.fromEntries(Object.entries(state.stamps).filter(([id]) => id !== taskId));
  } else {
    state.stamps = { ...state.stamps, [taskId]: stamp };
  }
  writeOverlay(employeeId, state);
}

export function mergePersonTaskOverlay(employeeId: string, fetched: Task[]): Task[] {
  const state = readOverlay(employeeId);
  const byId = new Map<string, Task>();

  for (const task of fetched) {
    const completedAt = task.completedAt;
    let completedMeetingId: string | null;
    if (Object.hasOwn(state.stamps, task.id)) {
      completedMeetingId = state.stamps[task.id].completedMeetingId;
    } else if (completedAt) {
      completedMeetingId = task.meetingId;
    } else {
      completedMeetingId = task.completedMeetingId;
    }
    byId.set(task.id, {
      ...task,
      meetingId: task.meetingId,
      completedMeetingId,
    });
  }

  for (const floating of state.floating) {
    if (!byId.has(floating.id)) {
      byId.set(floating.id, floating);
    }
  }

  return sortPersonTasks([...byId.values()]);
}

export function filterMeetingFollowupTasks(tasks: Task[], meetingId: string): Task[] {
  return tasks.filter((task) => task.completedAt == null || task.completedMeetingId === meetingId);
}

export async function loadMergedPersonTasks(employeeId: string, meetings: Meeting[]): Promise<Task[]> {
  const fetched = (
    await Promise.all(
      meetings.map(async (meeting) => {
        const response = await fetch(`/api/tasks?meetingId=${encodeURIComponent(meeting.id)}`);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Unable to load tasks");
        }
        const payload = (await response.json()) as { tasks: Task[] };
        return payload.tasks;
      }),
    )
  ).flat();

  return mergePersonTaskOverlay(employeeId, fetched);
}
