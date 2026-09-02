import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupIsolationFixtures, createIsolationFixtures, type IsolationFixture } from "../helpers/fixtures";
import { idsFrom, jsonAs, jsonInit, populatedProductKeys, recordOf } from "../helpers/http";
import { readIsolationEnv } from "../helpers/env";
import { signIn, type AuthedFetch } from "../helpers/session";

describe("cross-manager isolation", () => {
  let asA: AuthedFetch | undefined;
  let asB: AuthedFetch | undefined;
  let fixture: IsolationFixture | undefined;

  function ready(): { asA: AuthedFetch; asB: AuthedFetch; fixture: IsolationFixture } {
    if (!asA || !asB || !fixture) {
      throw new Error("cross-manager harness not initialized");
    }
    return { asA, asB, fixture };
  }

  beforeAll(async () => {
    const env = readIsolationEnv();
    asA = await signIn(env.managerA.email, env.managerA.password);
    asB = await signIn(env.managerB.email, env.managerB.password);
    fixture = await createIsolationFixtures(asA);
  });

  afterAll(async () => {
    const session = asA;
    const created = fixture;
    if (!session || !created) {
      return;
    }
    await cleanupIsolationFixtures(session, created);

    const employee = await jsonAs(session, `/api/employees/${created.employeeId}`);
    expect(employee.status).not.toBe(200);

    const teams = await jsonAs(session, "/api/teams");
    expect(idsFrom(teams.body, "teams")).not.toContain(created.teamId);
  });

  it("does not return A's employee to B on read or rename", async () => {
    const { asB: client, fixture: row } = ready();
    const get = await jsonAs(client, `/api/employees/${row.employeeId}`);
    expect(get.status).toBe(404);
    expect(populatedProductKeys(get.body)).not.toContain("employee");

    const patch = await jsonAs(
      client,
      `/api/employees/${row.employeeId}`,
      jsonInit("PATCH", { name: "should-not-rename" }),
    );
    expect(patch.status).toBe(404);
  });

  it("does not return A's meeting notes to B on read or write", async () => {
    const { asB: client, fixture: row } = ready();
    const get = await jsonAs(client, `/api/meetings/${row.meetingId}`);
    expect(get.status).toBe(404);
    expect(populatedProductKeys(get.body)).not.toContain("meeting");
    expect(populatedProductKeys(get.body)).not.toContain("notesJson");

    const patch = await jsonAs(
      client,
      `/api/meetings/${row.meetingId}`,
      jsonInit("PATCH", { topics: "should-not-write" }),
    );
    expect(patch.status).toBe(404);
  });

  it("lists A's meetings and tasks by employeeId as 200-empty, not 404", async () => {
    const { asB: client, fixture: row } = ready();
    const meetings = await jsonAs(client, `/api/meetings?employeeId=${row.employeeId}`);
    expect(meetings.status).toBe(200);
    expect(recordOf(meetings.body)?.meetings).toEqual([]);

    const tasks = await jsonAs(client, `/api/tasks?employeeId=${row.employeeId}`);
    expect(tasks.status).toBe(200);
    expect(recordOf(tasks.body)?.tasks).toEqual([]);
  });

  it("does not let B read or write via A's meeting or task ids", async () => {
    const { asB: client, fixture: row } = ready();
    const byMeeting = await jsonAs(client, `/api/tasks?meetingId=${row.meetingId}`);
    expect(byMeeting.status).toBe(404);

    const create = await jsonAs(
      client,
      "/api/tasks",
      jsonInit("POST", { meetingId: row.meetingId, title: "should-not-create" }),
    );
    expect(create.status).toBe(404);

    const del = await jsonAs(client, `/api/tasks/${row.taskId}`, { method: "DELETE" });
    expect(del.status).toBe(404);
  });

  it("does not include A's team or employee in B's lists", async () => {
    const { asB: client, fixture: row } = ready();
    const teams = await jsonAs(client, "/api/teams");
    expect(teams.status).toBe(200);
    expect(idsFrom(teams.body, "teams")).not.toContain(row.teamId);

    const byTeam = await jsonAs(client, `/api/employees?teamId=${row.teamId}`);
    expect(byTeam.status).toBe(404);

    const people = await jsonAs(client, "/api/employees");
    expect(people.status).toBe(200);
    expect(idsFrom(people.body, "employees")).not.toContain(row.employeeId);
  });

  it("leaves A's employee, meeting, and task unchanged after B's attempts", async () => {
    const { asA: client, fixture: row } = ready();
    const employee = await jsonAs(client, `/api/employees/${row.employeeId}`);
    expect(employee.status).toBe(200);
    expect(recordOf(recordOf(employee.body)?.employee)?.name).toBe(row.employeeName);

    const meeting = await jsonAs(client, `/api/meetings/${row.meetingId}`);
    expect(meeting.status).toBe(200);
    const meetingBody = recordOf(recordOf(meeting.body)?.meeting);
    expect(meetingBody?.topics).toBe(row.topics);
    expect(JSON.stringify(meetingBody?.notesJson)).toContain(row.notesText);

    const tasks = await jsonAs(client, `/api/tasks?meetingId=${row.meetingId}`);
    expect(tasks.status).toBe(200);
    expect(idsFrom(tasks.body, "tasks")).toContain(row.taskId);
    const tasksValue = recordOf(tasks.body)?.tasks;
    const list: unknown[] = Array.isArray(tasksValue) ? tasksValue : [];
    const match = list.find((item) => recordOf(item)?.id === row.taskId);
    expect(recordOf(match)?.title).toBe(row.taskTitle);
  });
});
