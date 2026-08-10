import { EMPTY_NOTES_DOC, type Meeting, type Task } from "@/types";

const STORAGE_KEY = "manager-pad:meeting-mock-v1";

interface MockStoreData {
  meetings: Meeting[];
  tasks: Task[];
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyStore(): MockStoreData {
  return { meetings: [], tasks: [] };
}

function readStore(): MockStoreData {
  if (typeof sessionStorage === "undefined") {
    return emptyStore();
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }
    const parsed = JSON.parse(raw) as Partial<MockStoreData>;
    return {
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(data: MockStoreData): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listMeetingsByEmployee(employeeId: string): Meeting[] {
  return readStore()
    .meetings.filter((meeting) => meeting.employeeId === employeeId)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || b.createdAt.localeCompare(a.createdAt));
}

export function getMeeting(meetingId: string): Meeting | null {
  return readStore().meetings.find((meeting) => meeting.id === meetingId) ?? null;
}

export function createMeeting(input: { employeeId: string; managerId: string; meetingDate?: string }): Meeting {
  const store = readStore();
  const timestamp = nowIso();
  const meeting: Meeting = {
    id: crypto.randomUUID(),
    managerId: input.managerId,
    employeeId: input.employeeId,
    meetingDate: input.meetingDate ?? todayDate(),
    topics: "",
    notesJson: structuredClone(EMPTY_NOTES_DOC),
    status: "open",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.meetings.push(meeting);
  writeStore(store);
  return meeting;
}

export function updateMeeting(
  meetingId: string,
  patch: Partial<Pick<Meeting, "meetingDate" | "topics" | "notesJson" | "status">>,
): Meeting | null {
  const store = readStore();
  const index = store.meetings.findIndex((meeting) => meeting.id === meetingId);
  if (index === -1) {
    return null;
  }
  const current = store.meetings[index];
  const next: Meeting = {
    ...current,
    meetingDate: patch.meetingDate ?? current.meetingDate,
    topics: patch.topics ?? current.topics,
    notesJson: patch.notesJson ?? current.notesJson,
    status: patch.status ?? current.status,
    updatedAt: nowIso(),
  };
  store.meetings[index] = next;
  writeStore(store);
  return next;
}

export function softDeleteMeeting(meetingId: string): boolean {
  const store = readStore();
  const before = store.meetings.length;
  store.meetings = store.meetings.filter((meeting) => meeting.id !== meetingId);
  store.tasks = store.tasks.filter((task) => task.meetingId !== meetingId);
  if (store.meetings.length === before) {
    return false;
  }
  writeStore(store);
  return true;
}

export function listTasksByMeeting(meetingId: string): Task[] {
  return readStore()
    .tasks.filter((task) => task.meetingId === meetingId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createTask(input: { meetingId: string; title: string; plannedDate?: string | null }): Task | null {
  const store = readStore();
  const meeting = store.meetings.find((item) => item.id === input.meetingId);
  if (!meeting) {
    return null;
  }
  const timestamp = nowIso();
  const task: Task = {
    id: crypto.randomUUID(),
    managerId: meeting.managerId,
    meetingId: meeting.id,
    employeeId: meeting.employeeId,
    title: input.title,
    plannedDate: input.plannedDate ?? null,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.tasks.push(task);
  writeStore(store);
  return task;
}

export function updateTask(
  taskId: string,
  patch: Partial<Pick<Task, "title" | "plannedDate" | "completedAt">>,
): Task | null {
  const store = readStore();
  const index = store.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) {
    return null;
  }
  const current = store.tasks[index];
  const next: Task = {
    ...current,
    title: patch.title ?? current.title,
    plannedDate: patch.plannedDate !== undefined ? patch.plannedDate : current.plannedDate,
    completedAt: patch.completedAt !== undefined ? patch.completedAt : current.completedAt,
    updatedAt: nowIso(),
  };
  store.tasks[index] = next;
  writeStore(store);
  return next;
}

export function softDeleteTask(taskId: string): boolean {
  const store = readStore();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((task) => task.id !== taskId);
  if (store.tasks.length === before) {
    return false;
  }
  writeStore(store);
  return true;
}
