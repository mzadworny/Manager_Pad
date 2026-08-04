import type { APIRoute } from "astro";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toEmployee, type EmployeeRow } from "@/types";

export const prerender = false;

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  role: z.string().trim(),
  teamId: z.uuid(),
});

const teamIdQuerySchema = z.uuid();

async function teamOwnedByUser(supabase: SupabaseClient, teamId: string): Promise<boolean> {
  const { data, error } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle();
  return !error && data !== null;
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const teamIdParam = context.url.searchParams.get("teamId");
  const teamIdResult = teamIdQuerySchema.safeParse(teamIdParam);
  if (!teamIdResult.success) {
    return Response.json({ error: "teamId query parameter must be a valid UUID" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("employees")
    .select("*")
    .eq("team_id", teamIdResult.data)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ employees: (data as EmployeeRow[]).map(toEmployee) });
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

  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const ownsTeam = await teamOwnedByUser(auth.supabase, parsed.data.teamId);
  if (!ownsTeam) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  const result = (await auth.supabase
    .from("employees")
    .insert({
      name: parsed.data.name,
      role: parsed.data.role,
      team_id: parsed.data.teamId,
      manager_id: auth.user.id,
    })
    .select("*")
    .single()) as { data: EmployeeRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Failed to create employee" }, { status: 500 });
  }

  return Response.json({ employee: toEmployee(data) }, { status: 201 });
};
