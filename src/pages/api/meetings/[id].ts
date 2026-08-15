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
    observationsJson: notesJsonSchema.optional(),
    conclusionsJson: notesJsonSchema.optional(),
    status: z.enum(["open", "completed"]).optional(),
  })
  .refine(
    (value) =>
      value.meetingDate !== undefined ||
      value.topics !== undefined ||
      value.notesJson !== undefined ||
      value.observationsJson !== undefined ||
      value.conclusionsJson !== undefined ||
      value.status !== undefined,
    { message: "At least one field is required" },
  );

const COMPLETED_WRITE_ERROR = "Meeting is completed; reopen required to edit";

function hasContentWrite(data: z.infer<typeof updateMeetingSchema>): boolean {
  return (
    data.meetingDate !== undefined ||
    data.topics !== undefined ||
    data.notesJson !== undefined ||
    data.observationsJson !== undefined ||
    data.conclusionsJson !== undefined
  );
}

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

  const currentResult = (await auth.supabase
    .from("meetings")
    .select("status")
    .eq("id", idResult.data)
    .maybeSingle()) as { data: Pick<MeetingRow, "status"> | null; error: PostgrestError | null };

  if (currentResult.error) {
    return Response.json({ error: currentResult.error.message }, { status: 500 });
  }

  if (!currentResult.data) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (currentResult.data.status === "completed" && parsed.data.status !== "open" && hasContentWrite(parsed.data)) {
    return Response.json({ error: COMPLETED_WRITE_ERROR }, { status: 409 });
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
  if (parsed.data.observationsJson !== undefined) {
    updates.observations_json = parsed.data.observationsJson;
  }
  if (parsed.data.conclusionsJson !== undefined) {
    updates.conclusions_json = parsed.data.conclusionsJson;
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
