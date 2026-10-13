import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function userEmail(code: string, name: string) {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slug(code)}.${slug(name)}@users.festize.app`;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in before creating users" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authenticated = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: identity, error: authError } = await authenticated.auth.getUser(token);
    if (authError || !identity.user) return reply(401, { error: "Invalid session" });

    const body = await request.json();
    const action = String(body.action || "create");
    const festId = String(body.festId || "");
    const code = String(body.code || "");
    const candidate = body.user || {};
    const name = String(candidate.name || "").trim();
    const password = String(candidate.password || "");
    const role = String(candidate.role || "");
    const allowed = ["MAIN", "JUDGE", "MEDIA", "TEAM MANAGER", "MONITOR", "STAGE MANAGER", "MEMBER"];
    if (!/^[0-9a-f-]{36}$/i.test(festId)) return reply(400, { error: "Invalid fest ID" });

    const { data: fest } = await admin.from("fests").select("id, code, owner_id").eq("id", festId).maybeSingle();
    if (!fest || (action !== "deleteFest" && fest.code !== code)) return reply(404, { error: "Fest not found" });
    const owner = fest.owner_id === identity.user.id;

    if (action === "deleteFest") {
      if (!owner) return reply(403, { error: "Only the fest owner can delete the fest" });
      const { data: users, error: listError } = await admin.from("fest_members").select("auth_user_id").eq("fest_id", festId);
      if (listError) return reply(500, { error: listError.message });
      for (const user of users || []) {
        const { error } = await admin.auth.admin.deleteUser(user.auth_user_id);
        if (error) return reply(500, { error: error.message });
      }
      const { error } = await admin.from("fests").delete().eq("id", festId);
      return error ? reply(500, { error: error.message }) : reply(200, { ok: true });
    }

    if (!/^[0-9a-f-]{36}$/i.test(String(candidate.id || "")) || !name || name.length > 100 || !allowed.includes(role) || (action === "create" && password.length < 6)) {
      return reply(400, { error: "Invalid user details" });
    }
    const { data: membership } = await admin.from("fest_members").select("role,team_id").eq("fest_id", festId).eq("auth_user_id", identity.user.id).maybeSingle();
    const main = membership?.role === "MAIN";
    const teamManager = membership?.role === "TEAM MANAGER";
    if (!owner && !main && !(teamManager && role === "MEMBER" && candidate.teamId === membership.team_id)) {
      return reply(403, { error: "You cannot manage this user" });
    }
    if (role === "MAIN" && !owner) return reply(403, { error: "Only the fest owner can create main users" });

    if (action === "update" || action === "revoke") {
      const { data: target } = await admin.from("fest_members").select("id,auth_user_id,role,team_id").eq("fest_id", festId).eq("id", candidate.id).maybeSingle();
      if (!target) return reply(404, { error: "User not found in this fest" });
      if ((target.role === "MAIN" && !owner) || (teamManager && (target.role !== "MEMBER" || target.team_id !== membership?.team_id))) {
        return reply(403, { error: "You cannot change this user" });
      }
      if (action === "revoke") {
        const { error } = await admin.auth.admin.deleteUser(target.auth_user_id);
        return error ? reply(500, { error: error.message }) : reply(200, { ok: true });
      }
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
        email: userEmail(code, name), email_confirm: true,
        ...(password ? { password } : {}),
        user_metadata: { fest_id: festId, role },
      });
      if (authUpdateError) return reply(400, { error: authUpdateError.message });
      const { error: memberUpdateError } = await admin.from("fest_members").update({ username: name, role, team_id: candidate.teamId || null, member_id: candidate.memberId || null }).eq("id", target.id);
      return memberUpdateError ? reply(400, { error: memberUpdateError.message }) : reply(200, { ok: true });
    }
    if (action !== "create") return reply(400, { error: "Unknown action" });

    const email = userEmail(code, name);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { fest_id: festId, role },
    });
    if (createError || !created.user) return reply(400, { error: createError?.message || "Could not create user" });

    const { error: insertError } = await admin.from("fest_members").insert({
      id: candidate.id, fest_id: festId, auth_user_id: created.user.id, username: name, role,
      team_id: candidate.teamId || null, member_id: candidate.memberId || null,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return reply(400, { error: insertError.message });
    }
    return reply(200, { ok: true, userId: created.user.id });
  } catch (error) {
    return reply(500, { error: error instanceof Error ? error.message : "Unable to create user" });
  }
});