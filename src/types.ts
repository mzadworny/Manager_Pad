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
  content?: unknown[];
  [key: string]: unknown;
}

export const EMPTY_NOTES_DOC: NotesJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export type MeetingStatus = "open";

export interface Meeting {
  id: string;
  managerId: string;
  employeeId: string;
  meetingDate: string;
  topics: string;
  notesJson: NotesJson;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  managerId: string;
  meetingId: string;
  employeeId: string;
  title: string;
  plannedDate: string | null;
  completedAt: string | null;
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
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  manager_id: string;
  meeting_id: string;
  employee_id: string;
  title: string;
  planned_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toMeeting(row: MeetingRow): Meeting {
  const notesJson = typeof row.notes_json === "string" ? (JSON.parse(row.notes_json) as NotesJson) : row.notes_json;

  return {
    id: row.id,
    managerId: row.manager_id,
    employeeId: row.employee_id,
    meetingDate: row.meeting_date,
    topics: row.topics,
    notesJson,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
