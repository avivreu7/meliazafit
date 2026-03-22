"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import FireAmbient from "@/components/FireAmbient";
import GalleryStrip from "@/components/GalleryStrip";

type TimerPhase = "discussion" | "writing";

interface Spotlight {
  id: string; userName: string; myChametz: string; newInvitation: string; aiBlessing: string;
}
interface GalleryItem { id: string; text: string; userName: string }

const QUESTIONS = [
  { num: 1, label: "החמץ שלי?",                  hint: "מה אני נושא שכבד עליי..." },
  { num: 2, label: "למה אני רוצה להיפרד ממנו?",  hint: "מה זה עושה לי..."          },
  { num: 3, label: "מה אני מזמין במקום?",         hint: "מה אני בוחר לקבל..."       },
];

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function ProjectorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [timerPhase,    setTimerPhase]    = useState<TimerPhase | null>(null);
  const [timerActive,   setTimerActive]   = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [totalCount,    setTotalCount]    = useState(0);
  const [spotlight,     setSpotlight]     = useState<Spotlight | null>(null);
  const [gallery,       setGallery]       = useState<GalleryItem[]>([]);
  const spotlightTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slow video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.playbackRate = 0.5;
    const play = () => v.play().catch(() => {});
    play();
    document.addEventListener("click", play, { once: true });
    return () => document.removeEventListener("click", play);
  }, []);

  // Load initial data
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.from("chametz_entries").select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count) setTotalCount(count); });
    supabase.from("chametz_entries")
      .select("id, user_name, new_invitation")
      .order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => {
        if (data) setGallery(
          (data as { id: string; user_name: string; new_invitation: string }[])
            .reverse().map(r => ({ id: r.id, text: r.new_invitation, userName: r.user_name }))
        );
      });
  }, []);

  // Timer + broadcasts
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const applyTimer = (row: { ends_at: string | null; is_active: boolean; phase: string | null }) => {
      if (row.is_active && row.ends_at) {
        const end = new Date(row.ends_at);
        if (end > new Date()) {
          setTimerPhase((row.phase as TimerPhase) ?? "writing");
          setTimerActive(true);
          setTimeRemaining(Math.ceil((end.getTime() - Date.now()) / 1000));
          return;
        }
      }
      setTimerPhase(null); setTimerActive(false); setTimeRemaining(null);
    };

    supabase.from("event_timer").select("ends_at, is_active, phase").eq("id", 1).single()
      .then(({ data }) => { if (data) applyTimer(data as { ends_at: string | null; is_active: boolean; phase: string | null }); });

    const dbCh = supabase.channel("projector-timer-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_timer" }, (p) => {
        const row = (p.new ?? p.old) as { ends_at: string | null; is_active: boolean; phase: string | null };
        if (row) applyTimer(row);
      }).subscribe();

    const bcastCh = supabase.channel("projector-event-control")
      .on("broadcast", { event: "timer_update" }, ({ payload }) => {
        applyTimer(payload as { ends_at: string | null; is_active: boolean; phase: string | null });
      })
      .subscribe();

    return () => { supabase.removeChannel(dbCh); supabase.removeChannel(bcastCh); };
  }, []);

  // Countdown tick
  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 0) {
      setTimerActive(false); setTimeRemaining(null);
      return;
    }
    const t = setTimeout(() => setTimeRemaining(n => n !== null ? n - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [timeRemaining]);

  // Live submissions
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const ch = supabase.channel("projector-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chametz_entries" }, (p) => {
        const row = p.new as { id: string; user_name: string; my_chametz: string; new_invitation: string; ai_blessing: string };
        setTotalCount(n => n + 1);
        setGallery(prev => [...prev, { id: row.id, text: row.new_invitation, userName: row.user_name }]);
        if (spotlightTimer.current) clearTimeout(spotlightTimer.current);
        setSpotlight({ id: row.id, userName: row.user_name, myChametz: row.my_chametz,
                       newInvitation: row.new_invitation, aiBlessing: row.ai_blessing });
        spotlightTimer.current = setTimeout(() => setSpotlight(null), 6000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); if (spotlightTimer.current) clearTimeout(spotlightTimer.current); };
  }, []);

  const isDiscussion = timerPhase === "discussion" && timerActive;
  const isWriting    = timerPhase === "writing"    && timerActive;

  return (
    <div className="dashboard-root select-none">
      {/* Fire video */}
      <video ref={videoRef} autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: isDiscussion ? 0.35 : 0.75, transition: "opacity 2s", filter: "brightness(1.1) saturate(1.3)" }}>
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="absolute inset-0" style={{
        background: isDiscussion
          ? "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(5,0,0,0.6) 100%)"
          : "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 18%, transparent 75%, rgba(0,0,0,0.65) 100%)",
      }} />

      <FireAmbient />

      {/* Timer corner */}
      {timeRemaining !== null && (
        <div className="absolute top-5 left-5 z-30">
          <div className="glass px-4 py-2 text-center">
            <p className="text-orange-200 text-xs font-bold mb-0.5">
              {isDiscussion ? "💬 שיח" : "✍️ כתיבה"}
            </p>
            <p className={`font-black text-3xl tabular-nums ${timeRemaining < 60 ? "text-red-300" : "text-white"}`}>
              {formatTime(timeRemaining)}
            </p>
          </div>
        </div>
      )}

      {/* Counter top-right */}
      <div className="absolute top-5 right-5 z-30">
        <motion.div key={totalCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          className="glass-fire px-5 py-3 text-center">
          <p className="text-orange-200 text-xs font-semibold mb-0.5">שרפו</p>
          <p className="text-white font-black text-4xl leading-none">{totalCount}</p>
          <p className="text-orange-300 text-xs mt-0.5">🔥</p>
        </motion.div>
      </div>

      {/* ── DISCUSSION PHASE: large projectable questions ── */}
      {isDiscussion && (
        <motion.div
          key="discussion"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 flex flex-col items-center justify-center z-20 px-10 gap-8">
          <motion.h2
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="text-fire-shimmer text-4xl md:text-6xl font-extrabold text-center">
            שיח בקבוצה
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
            {QUESTIONS.map((q, i) => (
              <motion.div
                key={q.num}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.2 }}
                className="glass-fire px-8 py-8 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-black mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #f97316, #dc2626)", boxShadow: "0 0 20px rgba(249,115,22,0.6)" }}>
                  {q.num}
                </div>
                <p className="text-white font-extrabold text-2xl md:text-3xl leading-snug mb-3">{q.label}</p>
                <p className="text-orange-200/70 text-base md:text-lg italic">{q.hint}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── WRITING PHASE or IDLE: spotlight ── */}
      {!isDiscussion && (
        <>
          <AnimatePresence>
            {spotlight && (
              <motion.div key={spotlight.id}
                initial={{ opacity: 0, scale: 0.85, y: 40 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.9,   y: -20 }}
                transition={{ duration: 0.55, type: "spring", bounce: 0.2 }}
                className="absolute inset-x-0 flex justify-center pointer-events-none z-20"
                style={{ top: "50%", transform: "translateY(-50%)" }}>
                <div className="max-w-2xl w-full mx-10 px-10 py-8 rounded-3xl text-center" style={{
                  background: "rgba(140,25,0,0.55)",
                  border: "1px solid rgba(255,130,0,0.65)",
                  backdropFilter: "blur(28px)",
                  boxShadow: "0 0 80px rgba(255,70,0,0.45)",
                }}>
                  <p className="text-orange-300/80 text-sm font-bold tracking-widest uppercase mb-3">
                    🔥 {spotlight.userName} שורף/ת
                  </p>
                  <p className="text-white font-black text-4xl leading-snug mb-3 title-hero">
                    {spotlight.myChametz}
                  </p>
                  <p className="text-orange-400 text-2xl mb-3">↑ ✦ ↓</p>
                  <p className="text-orange-200 text-sm font-bold tracking-wider uppercase mb-1">
                    ומזמין/ת במקום
                  </p>
                  <p className="text-white/90 font-bold text-2xl leading-snug mb-4">
                    {spotlight.newInvitation}
                  </p>
                  {spotlight.aiBlessing && (
                    <div className="border-t border-white/20 pt-4">
                      <p className="text-orange-200/75 text-base leading-relaxed italic">{spotlight.aiBlessing}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Waiting / idle state */}
          {!spotlight && totalCount === 0 && !isWriting && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}
                className="text-center">
                <div className="text-7xl flicker mb-4">🔥</div>
                <p className="text-white/55 text-3xl font-semibold">המדורה מחכה...</p>
              </motion.div>
            </div>
          )}

          {isWriting && !spotlight && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
                className="text-white/60 text-3xl font-semibold text-center px-10">
                ✍️ כולם כותבים עכשיו...
              </motion.p>
            </div>
          )}

          <GalleryStrip items={gallery} />
        </>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center py-3 z-20">
        <div className="glass flex items-center gap-3 px-5 py-2">
          <span className="text-orange-400 font-bold text-sm flicker">🔥</span>
          <span className="text-white/55 text-sm">
            {isDiscussion ? "שיח קבוצתי בעיצומו" : isWriting ? "זמן הכתיבה — הטופס פתוח" : totalCount > 0 ? `${totalCount} חמץ רגשי עלה לאש` : "ביעור חמץ רגשי"}
          </span>
        </div>
      </div>
    </div>
  );
}
