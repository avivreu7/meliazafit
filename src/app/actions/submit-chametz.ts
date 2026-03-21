"use server";

import { generateBlessing } from "@/lib/gemini";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase/server";

export type SubmitChametzState = {
  success: boolean;
  blessing?: string;
  error?: string;
};

export async function submitChametz(
  _prevState: SubmitChametzState,
  formData: FormData
): Promise<SubmitChametzState> {
  const userName     = (formData.get("user_name")      as string)?.trim();
  const roomNumber   = Number(formData.get("room_number"));
  const myChametz    = (formData.get("my_chametz")     as string)?.trim();
  const whyLetGo     = (formData.get("why_let_go")     as string)?.trim();
  const newInvitation = (formData.get("new_invitation") as string)?.trim();

  if (!userName || !myChametz || !whyLetGo || !newInvitation)
    return { success: false, error: "נא למלא את כל השדות" };

  if (roomNumber < 1 || roomNumber > 10 || isNaN(roomNumber))
    return { success: false, error: "מספר חדר לא תקין" };

  const aiBlessing = await generateBlessing(myChametz, whyLetGo, newInvitation, userName);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("chametz_entries").insert({
    user_name: userName,
    room_number: roomNumber,
    my_chametz: myChametz,
    why_let_go: whyLetGo,
    new_invitation: newInvitation,
    ai_blessing: aiBlessing,
  });

  if (error) {
    console.error("[Supabase] Insert failed:", error);
    return { success: false, error: "שגיאה בשמירת הנתונים. נסו שוב." };
  }

  return { success: true, blessing: aiBlessing };
}

// ── Admin: reset all entries ──────────────────────────────────────────────
export async function resetAllEntries(): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("chametz_entries").delete().gt("created_at", "1970-01-01");
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Admin: reset a single room ────────────────────────────────────────────
export async function resetRoomEntries(
  roomNumber: number
): Promise<{ success: boolean; error?: string }> {
  if (roomNumber < 1 || roomNumber > 10)
    return { success: false, error: "מספר חדר לא תקין" };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("chametz_entries").delete().eq("room_number", roomNumber);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Admin: set/clear the event countdown timer ────────────────────────────
// Requires the event_timer table. Run this SQL in Supabase:
//
//   create table if not exists event_timer (
//     id integer primary key default 1,
//     ends_at timestamptz,
//     is_active boolean default false,
//     check (id = 1)
//   );
//   insert into event_timer values (1, null, false)
//     on conflict (id) do nothing;
//   alter table event_timer enable row level security;
//   create policy "Public read" on event_timer for select using (true);
//
export async function setEventTimer(
  minutes: number | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();
  const ends_at  = minutes
    ? new Date(Date.now() + minutes * 60_000).toISOString()
    : null;
  const { error } = await supabase
    .from("event_timer")
    .upsert({ id: 1, ends_at, is_active: minutes !== null });
  if (error) {
    console.error("[Timer] upsert failed:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
