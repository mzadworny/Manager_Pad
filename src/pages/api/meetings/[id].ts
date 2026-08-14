import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toMeeting, type MeetingRow, type NotesJson } from "@/types";

export const prerender = false;

const uuidSchema = z.uuid();

const notesJsonSchema = z.looseObject({
  type: z.string().min(1),
}) as z.ZodType<NotesJson>;

const updateMeetingSchema = z
  .object({
    meetingDate: z.iso.date().optional(),
    topics: z.string().optional(),
    notesJson: notesJsonSchema.optional(),
    status: z.literal("open").optional(),
  })
  .refine(
    (value) =>
      value.meetingDate !== undefined ||
      value.topics !== undefined ||
      value.notesJson !== undefined ||
      value.status !== undefined,
    { message: "At least one field is required" },
  );

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid meeting id" }, { status: 400 });
  }

  const result = (await auth.supabase.from("meetings").select("*").eq("id", idResult.data).maybeSingle()) as {
    data: MeetingRow | null;
    error: PostgrestError | null;
  };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  return Response.json({ meeting: toMeeting(data) });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid meeting id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const updates: Record<string, string | NotesJson> = {};
  if (parsed.data.meetingDate !== undefined) {
    updates.meeting_date = parsed.data.meetingDate;
  }
  if (parsed.data.topics !== undefined) {
    updates.topics = parsed.data.topics;
  }
  if (parsed.data.notesJson !== undefined) {
    updates.notes_json = parsed.data.notesJson;
  }
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }

  const result = (await auth.supabase
    .from("meetings")
    .update(updates)
    .eq("id", idResult.data)
    .select("*")
    .maybeSingle()) as { data: MeetingRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  return Response.json({ meeting: toMeeting(data) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid meeting id" }, { status: 400 });
  }

  const result = (await auth.supabase.rpc("soft_delete_meeting", {
    meeting_id_param: idResult.data,
  })) as { data: boolean | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
};
