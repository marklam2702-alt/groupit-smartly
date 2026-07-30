import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assignNewIndividuals, sortIntoGroups, type GroupResult, type Individual } from "@/lib/grouping";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 6) {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function randomToken(len = 8) {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export const createSession = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const hostToken = randomToken();
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .insert({ code, host_token: hostToken, status: "open" })
      .select("id, code")
      .maybeSingle();
    if (!error && data) return { code: data.code, hostToken };
    if (error && !error.message.includes("duplicate")) throw error;
  }
  throw new Error("Could not create a session, please try again.");
});

export const finishSession = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(1),
        hostToken: z.string().min(1),
        groupCount: z.number().int().min(2).max(4).optional(),
        basis: z.enum(["first", "second"]).optional(),
      })
      .parse(input),
  )

  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("id, host_token, result")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!session) throw new Error("Session not found");
    if (session.host_token !== data.hostToken) throw new Error("Only the host can run the sort");

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("individuals")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    if (rowsError) throw rowsError;
    if (!rows || rows.length === 0) throw new Error("No individuals submitted yet");

    const individuals: Individual[] = rows.map((r) => ({
      id: r.id,
      nickName: r.nick_name,
      industry: r.industry as Individual["industry"],
      industryOther: r.industry_other ?? undefined,
      expertise: r.expertise as Individual["expertise"],
      expertiseOther: r.expertise_other ?? undefined,
    }));

    const previous = (session.result as unknown as GroupResult | null) ?? null;
    let result: GroupResult;

    if (previous?.groups?.length) {
      // Group count is locked once a result exists.
      const groupCount = previous.groups.length;
      const alive = new Map(individuals.map((i) => [i.id, i]));
      // Keep everyone already grouped exactly where they are (minus deleted rows).
      const existingGroups = previous.groups.map((g) =>
        g.map((m) => alive.get(m.id)).filter((m): m is Individual => !!m),
      );
      const placed = new Set(existingGroups.flat().map((m) => m.id));
      const newcomers = individuals.filter((i) => !placed.has(i.id));
      result = assignNewIndividuals(existingGroups, newcomers, groupCount);
    } else {
      result = sortIntoGroups(individuals, data.groupCount ?? 4);
    }


    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({ status: "finished", result: JSON.parse(JSON.stringify(result)) })
      .eq("id", session.id);
    if (updateError) throw updateError;

    return result;
  });

/** Re-claim host rights on another device using the session code + host password. */
export const verifyHost = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ code: z.string().min(1), hostToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("code, host_token")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!session || session.host_token !== data.hostToken.trim()) {
      throw new Error("Invalid session code or host password");
    }
    return { code: session.code };
  });


/** Host can change their password (6-10 characters). */
export const updateHostPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(1),
        hostToken: z.string().min(1),
        newPassword: z
          .string()
          .trim()
          .min(6, "Password must be 6-10 characters")
          .max(10, "Password must be 6-10 characters"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("id, host_token")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!session) throw new Error("Session not found");
    if (session.host_token !== data.hostToken) throw new Error("Only the host can do this");

    const { error: upError } = await supabaseAdmin
      .from("sessions")
      .update({ host_token: data.newPassword })
      .eq("id", session.id);
    if (upError) throw upError;
    return { hostToken: data.newPassword };
  });

/** Host can replace the two category definitions used by the input form. */
export const updateCategories = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(1),
        hostToken: z.string().min(1),
        categories: z.object({
          first: z.object({ name: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
          second: z.object({ name: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("id, host_token")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!session) throw new Error("Session not found");
    if (session.host_token !== data.hostToken) throw new Error("Only the host can do this");

    const { error: upError } = await supabaseAdmin
      .from("sessions")
      .update({ categories: data.categories })
      .eq("id", session.id);
    if (upError) throw upError;
    return { ok: true };
  });

export const deleteIndividual = createServerFn({ method: "POST" })

  .inputValidator((input) =>
    z
      .object({ code: z.string().min(1), hostToken: z.string().min(1), id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("id, host_token")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!session) throw new Error("Session not found");
    if (session.host_token !== data.hostToken) throw new Error("Only the host can delete");

    const { error: delError } = await supabaseAdmin
      .from("individuals")
      .delete()
      .eq("id", data.id)
      .eq("session_id", session.id);
    if (delError) throw delError;
    return { ok: true };
  });

export const reopenSession = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ code: z.string().min(1), hostToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("id, host_token")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!session) throw new Error("Session not found");
    if (session.host_token !== data.hostToken) throw new Error("Only the host can reopen");

    await supabaseAdmin
      .from("sessions")
      .update({ status: "open", result: null })
      .eq("id", session.id);
    return { ok: true };
  });
