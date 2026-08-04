import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toTeam, type TeamRow } from "@/types";

export const prerender = false;

const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const { data, error } = await auth.supabase.from("teams").select("*").order("created_at", {
    ascending: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ teams: (data as TeamRow[]).map(toTeam) });
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
