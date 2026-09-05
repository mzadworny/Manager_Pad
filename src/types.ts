export interface Team {
  id: string;
  managerId: string;
  name: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  managerId: string;
  teamId: string | null;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/** TipTap JSON document stored as meeting notes. Never null or `{}`. */
export interface NotesJson {
  type: string;
  content?: NotesJson[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export const EMPTY_NOTES_DOC: NotesJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function isEmptyParagraph(node: unknown): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }
  const paragraph = node as { type?: string; content?: unknown[] };
  if (paragraph.type !== "paragraph") {
    return false;
  }
  if (!paragraph.content || paragraph.content.length === 0) {
    return true;
  }
  return paragraph.content.every((child) => {
    if (typeof child !== "object" || child === null) {
      return false;
    }
    const textNode = child as { type?: string; text?: string };
    return textNode.type === "text" && !textNode.text?.trim();
  });
}

export function isEmptyNotesJson(doc: NotesJson): boolean {
  const content = doc.content;
  if (!Array.isArray(content) || content.length === 0) {
    return true;
  }
  return content.every(isEmptyParagraph);
}

export type MeetingStatus = "open" | "completed";

export interface Meeting {
  id: string;
  managerId: string;
  employeeId: string;
  meetingDate: string;
  topics: string;
  notesJson: NotesJson;
  observationsJson: NotesJson;
  conclusionsJson: NotesJson;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  managerId: string;
  meetingId: string | null;
  employeeId: string;
  title: string;
  plannedDate: string | null;
  completedAt: string | null;
  completedMeetingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRow {
  id: string;
  manager_id: string;
  name: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRow {
  id: string;
  manager_id: string;
  team_id: string | null;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    managerId: row.manager_id,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    managerId: row.manager_id,
    teamId: row.team_id,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface MeetingRow {
  id: string;
  manager_id: string;
  employee_id: string;
  meeting_date: string;
  topics: string;
  notes_json: NotesJson;
  observations_json: NotesJson;
  conclusions_json: NotesJson;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  manager_id: string;
  meeting_id: string | null;
  employee_id: string;
  title: string;
  planned_date: string | null;
  completed_at: string | null;
  completed_meeting_id: string | null;
  created_at: string;
  updated_at: string;
}

function parseNotesJson(value: NotesJson | string | null | undefined): NotesJson {
  if (value == null) {
    return EMPTY_NOTES_DOC;
  }

  return typeof value === "string" ? (JSON.parse(value) as NotesJson) : value;
}

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    managerId: row.manager_id,
    employeeId: row.employee_id,
    meetingDate: row.meeting_date,
    topics: row.topics,
    notesJson: parseNotesJson(row.notes_json),
    observationsJson: parseNotesJson(row.observations_json),
    conclusionsJson: parseNotesJson(row.conclusions_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    managerId: row.manager_id,
    meetingId: row.meeting_id,
    employeeId: row.employee_id,
    title: row.title,
    plannedDate: row.planned_date,
    completedAt: row.completed_at,
    completedMeetingId: row.completed_meeting_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
