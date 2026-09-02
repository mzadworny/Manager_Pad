import { describe, expect, it } from "vitest";
import { guestFetch, jsonInit, locationPath, populatedProductKeys, readJson, WELL_FORMED_UUID } from "../helpers/http";
import { testBaseUrl } from "../helpers/session";

async function expectGuestUnauthorized(path: string, init?: RequestInit): Promise<void> {
  const response = await guestFetch(path, init);
  const body = await readJson(response);
  expect(response.status).toBe(401);
  expect(body).toEqual({ error: "Unauthorized" });
  expect(populatedProductKeys(body)).toEqual([]);
}

describe("guest isolation", () => {
  it("denies unauthenticated product APIs with 401 and empty payloads", async () => {
    await expectGuestUnauthorized("/api/teams");
    await expectGuestUnauthorized("/api/teams", jsonInit("POST", { name: "should-not-create" }));

    await expectGuestUnauthorized("/api/employees");
    await expectGuestUnauthorized(
      "/api/employees",
      jsonInit("POST", { name: "should-not-create", role: "", teamId: null }),
    );

    await expectGuestUnauthorized(`/api/meetings?employeeId=${WELL_FORMED_UUID}`);
    await expectGuestUnauthorized("/api/meetings", jsonInit("POST", { employeeId: WELL_FORMED_UUID }));

    await expectGuestUnauthorized(`/api/tasks?employeeId=${WELL_FORMED_UUID}`);
    await expectGuestUnauthorized(
      "/api/tasks",
      jsonInit("POST", { meetingId: WELL_FORMED_UUID, title: "should-not-create" }),
    );
  });

  it("redirects protected pages to sign-in and leaves / public", async () => {
    const baseUrl = testBaseUrl();

    for (const path of ["/dashboard", "/employees"]) {
      const response = await guestFetch(path);
      expect([302, 303]).toContain(response.status);
      expect(locationPath(response, baseUrl)).toBe("/auth/signin");
    }

    const home = await guestFetch("/");
    expect(home.status).toBe(200);
    expect(locationPath(home, baseUrl)).not.toBe("/auth/signin");
  });
});
