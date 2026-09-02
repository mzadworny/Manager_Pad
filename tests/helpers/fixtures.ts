import { entityId, jsonAs, jsonInit } from "./http";
import type { AuthedFetch } from "./session";

export interface IsolationFixture {
  runId: string;
  teamId: string;
  employeeId: string;
  meetingId: string;
  taskId: string;
  teamName: string;
  employeeName: string;
  topics: string;
  notesText: string;
  notesJson: { type: string; content: unknown[] };
  taskTitle: string;
}

function notesDoc(text: string): IsolationFixture["notesJson"] {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export async function createIsolationFixtures(asA: AuthedFetch): Promise<IsolationFixture> {
  const runId = crypto.randomUUID().slice(0, 8);
  const teamName = `iso-${runId}-team`;
  const employeeName = `iso-${runId}-person`;
  const topics = `iso-${runId}-topics`;
  const notesText = `iso-${runId}-notes`;
  const notesJson = notesDoc(notesText);
  const taskTitle = `iso-${runId}-task`;

  const team = await jsonAs(asA, "/api/teams", jsonInit("POST", { name: teamName }));
  if (team.status !== 201) {
    throw new Error(`Failed to create fixture team (${String(team.status)}): ${JSON.stringify(team.body)}`);
  }
  const teamId = entityId(team.body, "team");

  const employee = await jsonAs(
    asA,
    "/api/employees",
    jsonInit("POST", { name: employeeName, role: "isolation", teamId }),
  );
  if (employee.status !== 201) {
    throw new Error(`Failed to create fixture employee (${String(employee.status)}): ${JSON.stringify(employee.body)}`);
  }
  const employeeId = entityId(employee.body, "employee");

  const meeting = await jsonAs(asA, "/api/meetings", jsonInit("POST", { employeeId }));
  if (meeting.status !== 201) {
    throw new Error(`Failed to create fixture meeting (${String(meeting.status)}): ${JSON.stringify(meeting.body)}`);
  }
  const meetingId = entityId(meeting.body, "meeting");

  const patched = await jsonAs(asA, `/api/meetings/${meetingId}`, jsonInit("PATCH", { topics, notesJson }));
  if (patched.status !== 200) {
    throw new Error(`Failed to stamp fixture meeting (${String(patched.status)}): ${JSON.stringify(patched.body)}`);
  }

  const task = await jsonAs(asA, "/api/tasks", jsonInit("POST", { meetingId, title: taskTitle }));
  if (task.status !== 201) {
    throw new Error(`Failed to create fixture task (${String(task.status)}): ${JSON.stringify(task.body)}`);
  }
  const taskId = entityId(task.body, "task");

  return {
    runId,
    teamId,
    employeeId,
    meetingId,
    taskId,
    teamName,
    employeeName,
    topics,
    notesText,
    notesJson,
    taskTitle,
  };
}

export async function cleanupIsolationFixtures(asA: AuthedFetch, fixture: IsolationFixture): Promise<void> {
  await asA(`/api/employees/${fixture.employeeId}`, { method: "DELETE" });
  await asA(`/api/teams/${fixture.teamId}`, { method: "DELETE" });
}
