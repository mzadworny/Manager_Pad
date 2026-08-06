import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toTeam, type TeamRow } from "@/types";

export const prerender = false;

const ALL_PEOPLE_NAME = "All people";

const updateTeamSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

const uuidSchema = z.uuid();

function isReservedTeamName(name: string): boolean {
  return name.toLowerCase() === ALL_PEOPLE_NAME.toLowerCase();
}

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid team id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const existingResult = (await auth.supabase
    .from("teams")
    .select("id, is_system")
    .eq("id", idResult.data)
    .maybeSingle()) as {
    data: Pick<TeamRow, "id" | "is_system"> | null;
    error: PostgrestError | null;
  };
  const { data: existing, error: existingError } = existingResult;

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  if (existing.is_system) {
    return Response.json({ error: "System team cannot be renamed" }, { status: 403 });
  }

  if (isReservedTeamName(parsed.data.name)) {
    return Response.json({ error: '"All people" is a reserved team name' }, { status: 400 });
  }

  const result = (await auth.supabase
    .from("teams")
    .update({ name: parsed.data.name })
    .eq("id", idResult.data)
    .select("*")
    .maybeSingle()) as { data: TeamRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  return Response.json({ team: toTeam(data) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const idResult = uuidSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid team id" }, { status: 400 });
  }

  const existingResult = (await auth.supabase
    .from("teams")
    .select("id, is_system")
    .eq("id", idResult.data)
    .maybeSingle()) as {
    data: Pick<TeamRow, "id" | "is_system"> | null;
    error: PostgrestError | null;
  };
  const { data: existing, error: existingError } = existingResult;

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  if (existing.is_system) {
    return Response.json({ error: "System team cannot be deleted" }, { status: 403 });
  }

  const result = (await auth.supabase.rpc("soft_delete_team", {
    team_id_param: idResult.data,
  })) as { data: boolean | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
};
