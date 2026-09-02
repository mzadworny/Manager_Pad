import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/protected-routes";

describe("isProtectedPath", () => {
  it("protects dashboard, employees, and meetings prefixes", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/employees/abc")).toBe(true);
    expect(isProtectedPath("/meetings/abc")).toBe(true);
  });

  it("does not protect public, auth, or API paths", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/auth/signin")).toBe(false);
    expect(isProtectedPath("/api/teams")).toBe(false);
    expect(isProtectedPath("/api/employees")).toBe(false);
    expect(isProtectedPath("/api/meetings")).toBe(false);
    expect(isProtectedPath("/api/tasks")).toBe(false);
  });
});
