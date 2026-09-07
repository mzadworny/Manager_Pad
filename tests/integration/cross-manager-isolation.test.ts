import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupIsolationFixtures,
  cleanupStampAttackFixtures,
  createIsolationFixtures,
  createStampAttackFixtures,
  type IsolationFixture,
  type StampAttackFixture,
} from "../helpers/fixtures";
import { idsFrom, jsonAs, jsonInit, populatedProductKeys, recordOf } from "../helpers/http";
import { readIsolationEnv } from "../helpers/env";
import { signIn, type AuthedFetch } from "../helpers/session";

describe("cross-manager isolation", () => {
  let asA: AuthedFetch | undefined;
  let asB: AuthedFetch | undefined;
  let fixture: IsolationFixture | undefined;
  let stampFixture: StampAttackFixture | undefined;

  function ready(): {
    asA: AuthedFetch;
    asB: AuthedFetch;
    fixture: IsolationFixture;
    stampFixture: StampAttackFixture;
  } {
    if (!asA || !asB || !fixture || !stampFixture) {
      throw new Error("cross-manager harness not initialized");
    }
    return { asA, asB, fixture, stampFixture };
  }

  beforeAll(async () => {
    const env = readIsolationEnv();
    asA = await signIn(env.managerA.email, env.managerA.password);
    asB = await signIn(env.managerB.email, env.managerB.password);
    fixture = await createIsolationFixtures(asA);
    stampFixture = await createStampAttackFixtures(asB);
  });

  afterAll(async () => {
    const sessionA = asA;
    const sessionB = asB;
    const created = fixture;
    const stamp = stampFixture;

    try {
      if (sessionB && stamp) {
        await cleanupStampAttackFixtures(sessionB, stamp);
        const employee = await jsonAs(sessionB, `/api/employees/${stamp.employeeId}`);
        expect(employee.status).not.toBe(200);
      }
    } finally {
      if (sessionA && created) {
        await cleanupIsolationFixtures(sessionA, created);

        const employee = await jsonAs(sessionA, `/api/employees/${created.employeeId}`);
        expect(employee.status).not.toBe(200);

        const teams = await jsonAs(sessionA, "/api/teams");
        expect(idsFrom(teams.body, "teams")).not.toContain(created.teamId);
      }
    }
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

  it("does not let B rename A's task", async () => {
    const { asB: client, fixture: row } = ready();
    const patch = await jsonAs(client, `/api/tasks/${row.taskId}`, jsonInit("PATCH", { title: "should-not-rename" }));
    expect(patch.status).toBe(404);
    expect(populatedProductKeys(patch.body)).not.toContain("task");
  });

  it("does not let B stamp A's meeting onto B's own task", async () => {
    const { asB: client, fixture: row, stampFixture: stamp } = ready();
    const patch = await jsonAs(
      client,
      `/api/tasks/${stamp.taskId}`,
      jsonInit("PATCH", {
        completedAt: new Date().toISOString(),
        completedMeetingId: row.meetingId,
      }),
    );
    expect(patch.status).toBe(404);

    const tasks = await jsonAs(client, `/api/tasks?employeeId=${stamp.employeeId}`);
    expect(tasks.status).toBe(200);
    const tasksValue = recordOf(tasks.body)?.tasks;
    const list: unknown[] = Array.isArray(tasksValue) ? tasksValue : [];
    const match = list.find((item) => recordOf(item)?.id === stamp.taskId);
    const task = recordOf(match);
    expect(task?.title).toBe(stamp.taskTitle);
    expect(task?.completedMeetingId).toBeNull();
  });

  it("does not let B create a meeting or floating task on A's person", async () => {
    const { asB: client, fixture: row } = ready();
    const meeting = await jsonAs(client, "/api/meetings", jsonInit("POST", { employeeId: row.employeeId }));
    expect(meeting.status).toBe(404);
    expect(populatedProductKeys(meeting.body)).not.toContain("meeting");

    const task = await jsonAs(
      client,
      "/api/tasks",
      jsonInit("POST", { employeeId: row.employeeId, title: "should-not-create" }),
    );
    expect(task.status).toBe(404);
    expect(populatedProductKeys(task.body)).not.toContain("task");
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

    const meetings = await jsonAs(client, `/api/meetings?employeeId=${row.employeeId}`);
    expect(meetings.status).toBe(200);
    expect(idsFrom(meetings.body, "meetings")).toEqual([row.meetingId]);

    const tasksByEmployee = await jsonAs(client, `/api/tasks?employeeId=${row.employeeId}`);
    expect(tasksByEmployee.status).toBe(200);
    expect(idsFrom(tasksByEmployee.body, "tasks")).toEqual([row.taskId]);
    const byEmployeeValue = recordOf(tasksByEmployee.body)?.tasks;
    const byEmployeeList: unknown[] = Array.isArray(byEmployeeValue) ? byEmployeeValue : [];
    const byEmployeeMatch = byEmployeeList.find((item) => recordOf(item)?.id === row.taskId);
    expect(recordOf(byEmployeeMatch)?.title).toBe(row.taskTitle);

    const tasks = await jsonAs(client, `/api/tasks?meetingId=${row.meetingId}`);
    expect(tasks.status).toBe(200);
    expect(idsFrom(tasks.body, "tasks")).toContain(row.taskId);
    const tasksValue = recordOf(tasks.body)?.tasks;
    const list: unknown[] = Array.isArray(tasksValue) ? tasksValue : [];
    const match = list.find((item) => recordOf(item)?.id === row.taskId);
    expect(recordOf(match)?.title).toBe(row.taskTitle);
  });
});
