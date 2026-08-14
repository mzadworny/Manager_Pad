import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toTask, type TaskRow } from "@/types";

export const prerender = false;

const uuidSchema = z.uuid();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").optional(),
    plannedDate: z.iso.date().nullable().optional(),
    completedAt: z.iso.datetime().nullable().optional(),
  })
  .refine((value) => value.title !== undefined || value.plannedDate !== undefined || value.completedAt !== undefined, {
    message: "At least one field is required",
  });

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid task id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
  }
  if (parsed.data.plannedDate !== undefined) {
    updates.planned_date = parsed.data.plannedDate;
  }
  if (parsed.data.completedAt !== undefined) {
    updates.completed_at = parsed.data.completedAt;
  }

  const result = (await auth.supabase
    .from("tasks")
    .update(updates)
    .eq("id", idResult.data)
    .select("*")
    .maybeSingle()) as { data: TaskRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return Response.json({ task: toTask(data) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid task id" }, { status: 400 });
  }

  const result = (await auth.supabase.rpc("soft_delete_task", {
    task_id_param: idResult.data,
  })) as { data: boolean | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
};
