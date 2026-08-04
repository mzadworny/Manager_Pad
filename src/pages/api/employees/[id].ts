import type { APIRoute } from "astro";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toEmployee, type EmployeeRow } from "@/types";

export const prerender = false;

const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    role: z.string().trim().optional(),
    teamId: z.uuid().optional(),
  })
  .refine((value) => value.name !== undefined || value.role !== undefined || value.teamId !== undefined, {
    message: "At least one field is required",
  });

const uuidSchema = z.uuid();

async function teamOwnedByUser(supabase: SupabaseClient, teamId: string): Promise<boolean> {
  const { data, error } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle();
  return !error && data !== null;
}

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid employee id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  if (parsed.data.teamId !== undefined) {
    const ownsTeam = await teamOwnedByUser(auth.supabase, parsed.data.teamId);
    if (!ownsTeam) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }
  }

  const updates: Record<string, string> = {};
  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }
  if (parsed.data.role !== undefined) {
    updates.role = parsed.data.role;
  }
  if (parsed.data.teamId !== undefined) {
    updates.team_id = parsed.data.teamId;
  }

  const result = (await auth.supabase
    .from("employees")
    .update(updates)
    .eq("id", idResult.data)
    .select("*")
    .maybeSingle()) as { data: EmployeeRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  return Response.json({ employee: toEmployee(data) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid employee id" }, { status: 400 });
  }

  const result = (await auth.supabase.rpc("soft_delete_employee", {
    employee_id_param: idResult.data,
  })) as { data: boolean | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
};
