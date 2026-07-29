import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sortIntoGroups, type Individual } from "@/lib/grouping";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 6) {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
    if (session.host_token !== data.hostToken) throw new Error("Only the creator can run the sort");

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

    const result = sortIntoGroups(individuals, 4);

    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({ status: "finished", result: JSON.parse(JSON.stringify(result)) })
      .eq("id", session.id);
    if (updateError) throw updateError;

    return result;
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
    if (session.host_token !== data.hostToken) throw new Error("Only the creator can reopen");

    await supabaseAdmin
      .from("sessions")
      .update({ status: "open", result: null })
      .eq("id", session.id);
    return { ok: true };
  });
