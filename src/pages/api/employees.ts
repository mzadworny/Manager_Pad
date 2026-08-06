import type { APIRoute } from "astro";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toEmployee, type EmployeeRow, type TeamRow } from "@/types";

export const prerender = false;

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  role: z.string().trim(),
  teamId: z.uuid().nullable(),
});

const teamIdQuerySchema = z.uuid();

async function getOwnedFilterTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ team: Pick<TeamRow, "id" | "is_system"> | null; error: PostgrestError | null }> {
  const result = (await supabase.from("teams").select("id, is_system").eq("id", teamId).maybeSingle()) as {
    data: Pick<TeamRow, "id" | "is_system"> | null;
    error: PostgrestError | null;
  };
  return { team: result.data, error: result.error };
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const teamIdParam = context.url.searchParams.get("teamId");

  let query = auth.supabase.from("employees").select("*").order("created_at", { ascending: true });

  if (teamIdParam !== null) {
    const teamIdResult = teamIdQuerySchema.safeParse(teamIdParam);
    if (!teamIdResult.success) {
      return Response.json({ error: "teamId query parameter must be a valid UUID" }, { status: 400 });
    }

    const { team, error: teamError } = await getOwnedFilterTeam(auth.supabase, teamIdResult.data);
    if (teamError) {
      return Response.json({ error: teamError.message }, { status: 500 });
    }
    if (!team) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.is_system) {
      return Response.json(
        { error: "Cannot filter by the All people system team; omit teamId instead" },
        { status: 400 },
      );
    }

    query = query.eq("team_id", teamIdResult.data);
  }

  const { data, error } = await query;

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

  if (parsed.data.teamId !== null) {
    const { team, error: teamError } = await getOwnedFilterTeam(auth.supabase, parsed.data.teamId);
    if (teamError) {
      return Response.json({ error: teamError.message }, { status: 500 });
    }
    if (!team) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.is_system) {
      return Response.json(
        { error: "Cannot assign employee to the All people system team; use teamId null instead" },
        { status: 400 },
      );
    }
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
