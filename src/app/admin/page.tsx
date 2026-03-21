"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetAllEntries, resetRoomEntries, setEventTimer } from "@/app/actions/submit-chametz";

const ADMIN_PIN = "1234";

type Entry = {
  id: string;
  created_at: string;
  user_name: string;
  room_number: number;
  my_chametz: string;
  new_invitation: string;
  why_let_go?: string;
  ai_blessing: string | null;
};

/* ── PDF Export ─────────────────────────────────────────────────────────── */
async function printPDF() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("chametz_entries")
    .select("id, created_at, user_name, room_number, my_chametz, new_invitation, ai_blessing")
    .order("room_number", { ascending: true })
    .order("created_at",  { ascending: true });

  if (!data || data.length === 0) { alert("אין נתונים לייצוא"); return; }

  const rows = data as Entry[];
  const byRoom: Record<number, Entry[]> = {};
  rows.forEach(e => { (byRoom[e.room_number] ??= []).push(e); });

  const esc = (v: string) => (v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const date = new Date().toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>ביעור חמץ רגשי — ${date}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Assistant', Arial, sans-serif; direction: rtl; color: #1c0500; padding: 40px; background: #fff; }
    .cover { text-align: center; padding: 60px 0 50px; border-bottom: 3px solid #f97316; margin-bottom: 50px; }
    .cover h1 { font-size: 2.8rem; font-weight: 800; color: #c2410c; margin-bottom: 10px; }
    .cover .sub { color: #78350f; font-size: 1.1rem; margin-bottom: 6px; }
    .cover .meta { color: #9ca3af; font-size: 0.9rem; }
    .room-title { font-size: 1.5rem; font-weight: 800; color: #c2410c;
                  margin: 40px 0 14px; padding-bottom: 8px;
                  border-bottom: 2px solid #fed7aa; }
    .entry { padding: 16px 18px; margin-bottom: 14px;
             background: #fff7ed; border: 1px solid #fed7aa;
             border-radius: 10px; page-break-inside: avoid; }
    .name { font-weight: 700; font-size: 1.05rem; color: #9a3412; margin-bottom: 10px; }
    .label { font-size: 0.72rem; color: #c2410c; font-weight: 700;
             text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
    .value { font-size: 0.95rem; color: #1c0500; margin-bottom: 10px; line-height: 1.5; }
    .blessing { border-top: 1px solid #fde68a; padding-top: 10px; margin-top: 6px;
                font-style: italic; color: #92400e; font-size: 0.9rem; line-height: 1.6; }
    @media print {
      body { padding: 20px; }
      .room-title { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>🔥 ביעור חמץ רגשי</h1>
    <p class="sub">${date}</p>
    <p class="meta">${rows.length} שולחים · ${Object.keys(byRoom).length} חדרים</p>
  </div>
  ${Object.entries(byRoom).map(([room, entries]) => `
    <div class="room-title">חדר ${room} — ${entries.length} שולחים</div>
    ${entries.map(e => `
      <div class="entry">
        <div class="name">✦ ${esc(e.user_name)}</div>
        <div class="label">החמץ שלי</div>
        <div class="value">${esc(e.my_chametz)}</div>
        <div class="label">ומזמין/ת במקום</div>
        <div class="value">${esc(e.new_invitation)}</div>
        ${e.ai_blessing ? `<div class="blessing">✨ ${esc(e.ai_blessing)}</div>` : ""}
      </div>
    `).join("")}
  `).join("")}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("אפשר חלונות קופצים בדפדפן ונסה שוב"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

/* ── CSV Export ─────────────────────────────────────────────────────────── */
async function downloadCSV() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("chametz_entries")
    .select("id, created_at, user_name, room_number, my_chametz, why_let_go, new_invitation, ai_blessing")
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) { alert("אין נתונים לייצוא"); return; }
  const rows = data as Entry[];
  const esc  = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    "שם,חדר,החמץ שלי,למה להיפרד,מה מזמין,ברכה,זמן",
    ...rows.map(r => [
      esc(r.user_name), r.room_number, esc(r.my_chametz),
      esc(r.why_let_go ?? ""), esc(r.new_invitation),
      esc(r.ai_blessing ?? ""),
      new Date(r.created_at).toLocaleString("he-IL"),
    ].join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `chametz-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── PIN Gate ─────────────────────────────────────────────────────────── */
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake]   = useState(false);
  const press = (d: string) => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      if (next.join("") === ADMIN_PIN) { onUnlock(); }
      else { setShake(true); setTimeout(() => { setDigits([]); setShake(false); }, 600); }
    }
  };
  const keys = ["1","2","3","4","5","6","7","8","9","⌫","0","✓"];
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #1a0500 0%, #2d0a00 100%)" }}>
      <motion.div animate={shake ? { x: [-12,12,-8,8,-4,0] } : {}} transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6">
        <div className="text-5xl flicker">🔒</div>
        <h1 className="text-white text-2xl font-extrabold">ניהול מערכת</h1>
        <p className="text-white/40 text-sm">הזן קוד גישה</p>
        <div className="flex gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="w-4 h-4 rounded-full transition-all duration-200"
              style={{ background: digits[i] ? "#f97316" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {keys.map(k => (
            <button key={k} onClick={() => k === "⌫" ? setDigits(d => d.slice(0,-1)) : k !== "✓" && press(k)}
              className="w-16 h-16 rounded-2xl text-white text-xl font-bold transition-all active:scale-90"
              style={{ background: k === "✓" ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.12)",
                       border: "1px solid rgba(255,255,255,0.18)" }}>
              {k}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Admin Dashboard ──────────────────────────────────────────────────── */
export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [entries,  setEntries]  = useState<Entry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone]           = useState(false);

  const [roomResetState, setRoomResetState] =
    useState<Record<number, "confirm" | "deleting" | null>>({});

  const [liveFeed, setLiveFeed] = useState<Entry[]>([]);
  const liveFeedRef = useRef<Entry[]>([]);

  // ── Timer state ──
  const [timerMinutes, setTimerMinutes]   = useState(10);
  const [timerActive,  setTimerActive]    = useState(false);
  const [timerEnd,     setTimerEnd]       = useState<Date | null>(null);
  const [timerRemain,  setTimerRemain]    = useState<number | null>(null);
  const [timerLoading, setTimerLoading]   = useState(false);
  const [timerError,   setTimerError]     = useState<string | null>(null);

  // ── Ignite ceremony ──
  const [igniteLoading, setIgniteLoading] = useState(false);
  const [igniteSent,    setIgniteSent]    = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, count } = await supabase
      .from("chametz_entries")
      .select("id, created_at, user_name, room_number, my_chametz, new_invitation, ai_blessing",
              { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(30);
    setEntries((data as Entry[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  // Fetch current timer state
  const fetchTimer = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("event_timer").select("ends_at, is_active").eq("id", 1).single();
    if (data?.is_active && data?.ends_at) {
      const end = new Date(data.ends_at);
      if (end > new Date()) {
        setTimerActive(true);
        setTimerEnd(end);
        setTimerRemain(Math.ceil((end.getTime() - Date.now()) / 1000));
      } else {
        setTimerActive(false);
      }
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    fetchData();
    fetchTimer().catch(() => {}); // ignore if table doesn't exist

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin-live-feed")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        (payload) => {
          const row = payload.new as Entry;
          const next = [row, ...liveFeedRef.current].slice(0, 6);
          liveFeedRef.current = next;
          setLiveFeed([...next]);
          setTotal(n => n + 1);
          setEntries(prev => [row, ...prev].slice(0, 30));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  // Timer countdown tick
  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => {
      const rem = Math.ceil((timerEnd.getTime() - Date.now()) / 1000);
      if (rem <= 0) { setTimerRemain(0); setTimerActive(false); clearInterval(id); }
      else setTimerRemain(rem);
    }, 1000);
    return () => clearInterval(id);
  }, [timerEnd]);

  const handleStartTimer = async () => {
    setTimerLoading(true); setTimerError(null);
    const result = await setEventTimer(timerMinutes);
    if (result.success) {
      const end = new Date(Date.now() + timerMinutes * 60_000);
      setTimerActive(true); setTimerEnd(end);
      setTimerRemain(timerMinutes * 60);
    } else {
      setTimerError(result.error ?? "שגיאה — האם יצרת את טבלת event_timer?");
    }
    setTimerLoading(false);
  };

  const handleIgnite = async () => {
    setIgniteLoading(true);
    setIgniteSent(false);
    const supabase = getSupabaseBrowserClient();
    const channel  = supabase.channel("event-control");
    await new Promise<void>(resolve => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "ignite_ceremony", payload: {} })
            .then(() => { setIgniteSent(true); resolve(); });
        }
      });
    });
    setTimeout(() => supabase.removeChannel(channel), 1500);
    setIgniteLoading(false);
  };

  const handleStopTimer = async () => {
    setTimerLoading(true);
    await setEventTimer(null);
    setTimerActive(false); setTimerEnd(null); setTimerRemain(null);
    setTimerLoading(false);
  };

  const handleReset = async () => {
    if (!confirmed) { setConfirmed(true); return; }
    setDeleting(true);
    const result = await resetAllEntries();
    if (result.success) {
      setEntries([]); setTotal(0); setDone(true);
      setLiveFeed([]); liveFeedRef.current = [];
    } else { alert("שגיאה: " + result.error); }
    setDeleting(false); setConfirmed(false);
  };

  const handleRoomReset = async (room: number) => {
    if (roomResetState[room] !== "confirm") {
      setRoomResetState(s => ({ ...s, [room]: "confirm" }));
      setTimeout(() => setRoomResetState(s => ({ ...s, [room]: null })), 3000);
      return;
    }
    setRoomResetState(s => ({ ...s, [room]: "deleting" }));
    const result = await resetRoomEntries(room);
    if (result.success) {
      setEntries(prev => prev.filter(e => e.room_number !== room));
      setTotal(prev => prev - (roomCounts[room] ?? 0));
    } else { alert("שגיאה: " + result.error); }
    setRoomResetState(s => ({ ...s, [room]: null }));
  };

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  const roomCounts = entries.reduce<Record<number, number>>((acc, e) => {
    acc[e.room_number] = (acc[e.room_number] ?? 0) + 1; return acc;
  }, {});

  const fmt = (s: number) =>
    `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div className="min-h-screen p-6"
      style={{ background: "linear-gradient(135deg, #1a0500 0%, #2d0a00 50%, #1a0500 100%)",
               direction: "rtl", fontFamily: "var(--font-assistant), Arial Hebrew, Arial, sans-serif" }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-white text-3xl font-extrabold">⚙️ ניהול מערכת</h1>
            <p className="text-white/50 text-sm mt-1">ביעור חמץ רגשי — {total} רשומות</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => printPDF()}
              className="text-white/60 text-sm px-4 py-2 rounded-xl transition-all hover:text-white flex items-center gap-1.5"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.35)" }}>
              🖨️ PDF מזכרת
            </button>
            <button onClick={() => downloadCSV()}
              className="text-white/60 text-sm px-4 py-2 rounded-xl transition-all hover:text-white flex items-center gap-1.5"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              ⬇ CSV
            </button>
            <button onClick={fetchData}
              className="text-white/60 text-sm px-4 py-2 rounded-xl transition-all hover:text-white"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              רענן ↻
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="סה״כ רשומות"  value={total}                              color="#f97316" />
          <StatCard label="חדרים פעילים" value={Object.keys(roomCounts).length}     color="#22c55e" />
          <StatCard label="חדרים שקטים"  value={Math.max(0, 10-Object.keys(roomCounts).length)} color="#94a3b8" />
        </div>

        {/* ── Timer Control ── */}
        <div className="mb-8 p-6 rounded-2xl"
          style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.35)" }}>
          <h2 className="text-orange-300 font-bold text-lg mb-1 flex items-center gap-2">
            ⏱️ טיימר האירוע
          </h2>
          <p className="text-white/45 text-sm mb-4">
            הפעלת הטיימר תציג ספירה לאחור לכל החדרים ותעביר אוטומטית לדשבורד הקולקטיבי.
          </p>

          {timerError && (
            <div className="mb-3 px-4 py-2 rounded-xl text-red-300 text-sm"
              style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
              {timerError}
              <br /><span className="text-xs opacity-70">הרץ את ה-SQL מקובץ submit-chametz.ts בעורך Supabase SQL</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!timerActive ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">זמן:</span>
                  {[5, 8, 10, 15, 20].map(m => (
                    <button key={m} onClick={() => setTimerMinutes(m)}
                      className="px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: timerMinutes === m
                          ? "linear-gradient(135deg, #f97316, #dc2626)"
                          : "rgba(255,255,255,0.1)",
                        color: timerMinutes === m ? "#fff" : "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}>
                      {m}′
                    </button>
                  ))}
                </div>
                <button onClick={handleStartTimer} disabled={timerLoading}
                  className="px-6 py-2.5 rounded-xl font-bold text-white transition-all active:scale-95 pulse-ring"
                  style={{
                    background: "linear-gradient(135deg, #f97316, #dc2626)",
                    boxShadow: "0 0 20px rgba(249,115,22,0.5)",
                    opacity: timerLoading ? 0.6 : 1,
                  }}>
                  {timerLoading ? "מפעיל..." : "🔥 הפעל טיימר"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-1">
                  <div className="glass-fire px-5 py-3 text-center">
                    <p className="text-orange-200 text-xs font-semibold mb-0.5">נותר</p>
                    <p className={`font-black text-3xl tabular-nums ${(timerRemain ?? 0) < 60 ? "text-red-300" : "text-white"}`}>
                      {timerRemain !== null ? fmt(timerRemain) : "--:--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-orange-300 font-bold text-sm">הטיימר פעיל!</p>
                    <p className="text-white/40 text-xs">כל החדרים רואים ספירה לאחור</p>
                  </div>
                </div>
                <button onClick={handleStopTimer} disabled={timerLoading}
                  className="px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95"
                  style={{
                    background: "rgba(220,38,38,0.3)",
                    border: "1px solid rgba(220,38,38,0.5)",
                    color: "#fca5a5",
                    opacity: timerLoading ? 0.6 : 1,
                  }}>
                  עצור
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Ignite Ceremony ── */}
        <div className="mb-8 p-6 rounded-2xl"
          style={{ background: "rgba(255,60,0,0.15)", border: "2px solid rgba(255,100,0,0.55)",
                   boxShadow: "0 0 40px rgba(255,70,0,0.2)" }}>
          <h2 className="text-orange-300 font-bold text-lg mb-1 flex items-center gap-2">
            🔥 הצתת המדורה הקולקטיבית
          </h2>
          <p className="text-white/45 text-sm mb-5">
            לחיצה על הכפתור תפעיל את טקס הביעור על מסך הדשבורד הראשי.
            <br />
            ודאי שהדשבורד פתוח ומוקרן לפני הלחיצה.
          </p>
          <AnimatePresence mode="wait">
            {igniteSent ? (
              <motion.div key="sent"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 text-green-400 font-bold text-lg">
                ✅ האות נשלח! המדורה מוצתת.
                <button onClick={() => setIgniteSent(false)}
                  className="text-white/40 text-sm font-normal hover:text-white/70 transition-colors">
                  שלח שוב
                </button>
              </motion.div>
            ) : (
              <motion.button key="btn"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                onClick={handleIgnite} disabled={igniteLoading}
                className="px-10 py-4 rounded-2xl text-white font-black text-2xl pulse-ring transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #ff6000 0%, #cc1500 100%)",
                  boxShadow: "0 0 60px rgba(255,80,0,0.6), 0 8px 32px rgba(0,0,0,0.4)",
                  textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  opacity: igniteLoading ? 0.7 : 1,
                }}>
                {igniteLoading ? "שולח אות..." : "הצת את המדורה! 🔥"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Live feed */}
        <AnimatePresence>
          {liveFeed.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="mb-6 p-4 rounded-2xl"
              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}>
              <p className="text-orange-300 font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                פעילות בזמן אמת
              </p>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {liveFeed.map((e) => (
                    <motion.div key={e.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      <span className="text-xs px-2 py-0.5 rounded-lg font-bold shrink-0"
                        style={{ background: "rgba(249,115,22,0.2)", color: "#fdba74" }}>
                        חדר {e.room_number}
                      </span>
                      <span className="text-white/70 text-xs font-semibold truncate">{e.user_name}</span>
                      <span className="text-white/40 text-xs truncate flex-1">{e.my_chametz}</span>
                      <span className="text-white/25 text-xs shrink-0">
                        {new Date(e.created_at).toLocaleTimeString("he-IL",
                          { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Room breakdown */}
        <div className="mb-8">
          <p className="text-white/50 text-sm font-semibold mb-3">פירוט לפי חדר:</p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(room => {
              const rs = roomResetState[room];
              return (
                <div key={room} className="rounded-xl p-3 text-center"
                  style={{ background: roomCounts[room] ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.05)",
                           border: `1px solid ${roomCounts[room] ? "rgba(249,115,22,0.45)" : "rgba(255,255,255,0.1)"}` }}>
                  <p className="text-white/50 text-xs mb-0.5">חדר {room}</p>
                  <p className="text-white font-black text-2xl mb-2">{roomCounts[room] ?? 0}</p>
                  {roomCounts[room] ? (
                    <button onClick={() => handleRoomReset(room)} disabled={rs === "deleting"}
                      className="text-xs px-2 py-1 rounded-lg transition-all w-full"
                      style={{
                        background: rs === "confirm" ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.08)",
                        color: rs === "confirm" ? "#fca5a5" : "rgba(255,255,255,0.4)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}>
                      {rs === "deleting" ? "..." : rs === "confirm" ? "בטוח?" : "אפס"}
                    </button>
                  ) : <div className="h-6" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Full reset */}
        <div className="mb-8 p-6 rounded-2xl"
          style={{ background: "rgba(220,20,0,0.12)", border: "1px solid rgba(220,20,0,0.35)" }}>
          <h2 className="text-red-300 font-bold text-lg mb-1">🗑️ איפוס מלא לאירוע חדש</h2>
          <p className="text-white/50 text-sm mb-5">מוחק את כל הרשומות. בלתי הפיך.</p>
          <AnimatePresence mode="wait">
            {done ? (
              <motion.p key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="text-green-400 font-bold text-center py-2 text-lg">
                ✅ אופס בהצלחה! מוכן לאירוע חדש.
              </motion.p>
            ) : (
              <motion.div key="btn" className="flex flex-wrap gap-3 items-center">
                <button onClick={handleReset} disabled={deleting}
                  className="px-6 py-3 font-bold text-white rounded-xl transition-all active:scale-95"
                  style={{ background: confirmed ? "linear-gradient(135deg,#dc2626,#991b1b)" : "rgba(220,38,38,0.55)",
                           border: "1px solid rgba(239,68,68,0.5)", opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? "מוחק..." : confirmed ? "⚠️ אני בטוח — מחק הכל!" : "🗑️ אפס מערכת"}
                </button>
                {confirmed && (
                  <>
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      onClick={() => setConfirmed(false)}
                      className="px-4 py-3 text-white/50 text-sm rounded-xl hover:bg-white/10">
                      ביטול
                    </motion.button>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-red-400 text-sm font-semibold">לחץ שוב לאישור</motion.p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Entries list */}
        <p className="text-white/50 text-sm font-semibold mb-3">
          {loading ? "טוען..." : `${Math.min(total, 30)} מתוך ${total} רשומות אחרונות:`}
        </p>
        {entries.length === 0 && !loading && (
          <p className="text-white/25 text-sm text-center py-8">אין רשומות</p>
        )}
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.id} className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span className="text-xs px-2 py-1 rounded-lg font-bold shrink-0 mt-0.5"
                style={{ background: "rgba(249,115,22,0.2)", color: "#fdba74" }}>
                חדר {entry.room_number}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{entry.user_name}</p>
                <p className="text-white/45 text-xs truncate mt-0.5">{entry.my_chametz}</p>
              </div>
              <p className="text-white/25 text-xs shrink-0">
                {new Date(entry.created_at).toLocaleTimeString("he-IL",
                  { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-4 text-center"
      style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${color}35` }}>
      <p className="text-white font-black text-4xl" style={{ color }}>{value}</p>
      <p className="text-white/50 text-xs mt-1">{label}</p>
    </div>
  );
}
