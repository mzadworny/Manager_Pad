import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { EMPTY_NOTES_DOC, toMeeting, type MeetingRow } from "@/types";

export const prerender = false;

const employeeIdQuerySchema = z.uuid();

const createMeetingSchema = z.object({
  employeeId: z.uuid(),
  meetingDate: z.iso.date().optional(),
});

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const employeeIdParam = context.url.searchParams.get("employeeId");
  if (employeeIdParam === null) {
    return Response.json({ error: "employeeId query parameter is required" }, { status: 400 });
  }

  const employeeIdResult = employeeIdQuerySchema.safeParse(employeeIdParam);
  if (!employeeIdResult.success) {
    return Response.json({ error: "employeeId query parameter must be a valid UUID" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("meetings")
    .select("*")
    .eq("employee_id", employeeIdResult.data)
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ meetings: (data as MeetingRow[]).map(toMeeting) });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const employeeResult = (await auth.supabase
    .from("employees")
    .select("id")
    .eq("id", parsed.data.employeeId)
    .maybeSingle()) as { data: { id: string } | null; error: PostgrestError | null };

  if (employeeResult.error) {
    return Response.json({ error: employeeResult.error.message }, { status: 500 });
  }
  if (!employeeResult.data) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  const result = (await auth.supabase
    .from("meetings")
    .insert({
      manager_id: auth.user.id,
      employee_id: parsed.data.employeeId,
      meeting_date: parsed.data.meetingDate ?? todayDate(),
      topics: "",
      notes_json: EMPTY_NOTES_DOC,
      status: "open",
    })
    .select("*")
    .single()) as { data: MeetingRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Failed to create meeting" }, { status: 500 });
  }

  return Response.json({ meeting: toMeeting(data) }, { status: 201 });
};
