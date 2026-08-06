import type { APIRoute } from "astro";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toTeam, type TeamRow } from "@/types";

export const prerender = false;

const ALL_PEOPLE_NAME = "All people";

const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

function isReservedTeamName(name: string): boolean {
  return name.toLowerCase() === ALL_PEOPLE_NAME.toLowerCase();
}

async function ensureAllPeopleTeam(supabase: SupabaseClient, userId: string): Promise<PostgrestError | null> {
  const { data: existing, error: lookupError } = await supabase
    .from("teams")
    .select("id")
    .eq("is_system", true)
    .maybeSingle();

  if (lookupError) {
    return lookupError;
  }

  if (existing) {
    return null;
  }

  const { error: insertError } = await supabase.from("teams").insert({
    name: ALL_PEOPLE_NAME,
    is_system: true,
    manager_id: userId,
  });

  // Unique partial index makes concurrent ensures safe — treat conflict as success.
  if (insertError && insertError.code !== "23505") {
    return insertError;
  }

  return null;
}

function sortTeamsSystemFirst(teams: ReturnType<typeof toTeam>[]) {
  return teams.sort((a, b) => {
    if (a.isSystem !== b.isSystem) {
      return a.isSystem ? -1 : 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const ensureError = await ensureAllPeopleTeam(auth.supabase, auth.user.id);
  if (ensureError) {
    return Response.json({ error: ensureError.message }, { status: 500 });
  }

  const { data, error } = await auth.supabase.from("teams").select("*").order("created_at", {
    ascending: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const teams = sortTeamsSystemFirst((data as TeamRow[]).map(toTeam));
  return Response.json({ teams });
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

  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  if (isReservedTeamName(parsed.data.name)) {
    return Response.json({ error: '"All people" is a reserved team name' }, { status: 400 });
  }

  const result = (await auth.supabase
    .from("teams")
    .insert({ name: parsed.data.name, manager_id: auth.user.id })
    .select("*")
    .single()) as { data: TeamRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Failed to create team" }, { status: 500 });
  }

  return Response.json({ team: toTeam(data) }, { status: 201 });
};
