import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toTask, type MeetingRow, type TaskRow } from "@/types";

export const prerender = false;

const meetingIdQuerySchema = z.uuid();

const createTaskSchema = z.object({
  meetingId: z.uuid(),
  title: z.string().trim().min(1, "Title is required"),
  plannedDate: z.iso.date().nullable().optional(),
});

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const meetingIdParam = context.url.searchParams.get("meetingId");
  if (meetingIdParam === null) {
    return Response.json({ error: "meetingId query parameter is required" }, { status: 400 });
  }

  const meetingIdResult = meetingIdQuerySchema.safeParse(meetingIdParam);
  if (!meetingIdResult.success) {
    return Response.json({ error: "meetingId query parameter must be a valid UUID" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("tasks")
    .select("*")
    .eq("meeting_id", meetingIdResult.data)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ tasks: (data as TaskRow[]).map(toTask) });
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

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const meetingResult = (await auth.supabase
    .from("meetings")
    .select("id, manager_id, employee_id")
    .eq("id", parsed.data.meetingId)
    .maybeSingle()) as {
    data: Pick<MeetingRow, "id" | "manager_id" | "employee_id"> | null;
    error: PostgrestError | null;
  };

  if (meetingResult.error) {
    return Response.json({ error: meetingResult.error.message }, { status: 500 });
  }
  if (!meetingResult.data) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const result = (await auth.supabase
    .from("tasks")
    .insert({
      manager_id: meetingResult.data.manager_id,
      meeting_id: meetingResult.data.id,
      employee_id: meetingResult.data.employee_id,
      title: parsed.data.title,
      planned_date: parsed.data.plannedDate ?? null,
    })
    .select("*")
    .single()) as { data: TaskRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Failed to create task" }, { status: 500 });
  }

  return Response.json({ task: toTask(data) }, { status: 201 });
};
