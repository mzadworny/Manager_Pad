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
