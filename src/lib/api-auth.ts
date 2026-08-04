import type { APIContext } from "astro";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

export type ApiAuthResult = { ok: true; supabase: SupabaseClient; user: User } | { ok: false; response: Response };

export async function requireApiAuth(context: APIContext): Promise<ApiAuthResult> {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return {
      ok: false,
      response: Response.json({ error: "Supabase is not configured" }, { status: 503 }),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, supabase, user };
}
