"use client";

import { useEffect, useRef, useState, useActionState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import EmberParticle from "@/components/EmberParticle";
import FireAmbient from "@/components/FireAmbient";
import { submitChametz, SubmitChametzState } from "@/app/actions/submit-chametz";

const initialState: SubmitChametzState = { success: false };

interface Ember  { id: string; text: string; roomNum: number }
interface Recent { id: string; userName: string; myChametz: string; newInvitation: string }
interface Submitted { blessing: string; chametz: string }

const QUESTIONS = [
  { name: "my_chametz",     label: "החמץ שלי?",                  hint: "מה אני נושא שכבד עליי...", num: 1 },
  { name: "why_let_go",     label: "למה אני רוצה להיפרד ממנו?",  hint: "מה זה עושה לי...",          num: 2 },
  { name: "new_invitation", label: "מה אני מזמין במקום?",         hint: "מה אני בוחר לקבל...",       num: 3 },
];

function triggerHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate([80, 30, 150]);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RoomPage() {
  const params   = useParams();
  const roomId   = Number(params.id);
  const router   = useRouter();
  const formRef  = useRef<HTMLFormElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [userName,   setUserName]   = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  // Already submitted this room?
  const [alreadySubmitted, setAlreadySubmitted] = useState<Submitted | null>(null);
  // Brief success flash animation
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);

  // Fire panel (global)
  const [embers,     setEmbers]     = useState<Ember[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [recent,     setRecent]     = useState<Recent | null>(null);
  const recentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Countdown timer (set by admin)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerEnd = useRef<Date | null>(null);

  // ── Force video autoplay ────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    document.addEventListener("click", tryPlay, { once: true });
    return () => document.removeEventListener("click", tryPlay);
  }, []);

  // ── Load name + check duplicate + save room ─────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("meliazafit_name");
    setUserName(stored ?? "אנונימי");
    setNameLoaded(true);
    // Save current room for "return to room" in lobby
    localStorage.setItem("meliazafit_room", String(roomId));
    // Check if already submitted this room
    const prev = localStorage.getItem(`meliazafit_submitted_${roomId}`);
    if (prev) {
      try { setAlreadySubmitted(JSON.parse(prev)); } catch {}
    }
  }, [roomId]);

  // ── Load initial global count ───────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("chametz_entries")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count) setTotalCount(count); });
  }, []);

  // ── Timer: fetch initial state + subscribe to changes ──────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Fetch current timer state (table may not exist — ignore errors)
    supabase
      .from("event_timer")
      .select("ends_at, is_active")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        if (data.is_active && data.ends_at) {
          const end = new Date(data.ends_at as string);
          if (end > new Date()) {
            timerEnd.current = end;
            setTimeRemaining(Math.ceil((end.getTime() - Date.now()) / 1000));
          }
        }
      });

    // Subscribe to timer updates
    const channel = supabase
      .channel("room-timer-watch")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_timer", filter: "id=eq.1" },
        (payload) => {
          const row = payload.new as { ends_at: string | null; is_active: boolean };
          if (row.is_active && row.ends_at) {
            const end = new Date(row.ends_at);
            timerEnd.current = end;
            setTimeRemaining(Math.ceil((end.getTime() - Date.now()) / 1000));
          } else {
            timerEnd.current = null;
            setTimeRemaining(null);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Countdown tick ──────────────────────────────────────────────────
  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 0) { router.push("/dashboard"); return; }
    const t = setTimeout(() => setTimeRemaining(n => (n !== null ? n - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [timeRemaining, router]);

  // ── Real-time ember particles ───────────────────────────────────────
  const spawnEmber = useCallback((text: string, roomNum: number) => {
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEmbers(prev => [...prev, { id, text, roomNum }]);
  }, []);
  const removeEmber = useCallback((id: string) => {
    setEmbers(prev => prev.filter(e => e.id !== id));
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("room-split-global")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        (payload) => {
          const row = payload.new as {
            id: string; user_name: string;
            my_chametz: string; new_invitation: string; room_number: number;
          };
          setTotalCount(n => n + 1);
          if (row.my_chametz) spawnEmber(row.my_chametz, row.room_number);
          setRecent({ id: row.id, userName: row.user_name,
                      myChametz: row.my_chametz, newInvitation: row.new_invitation });
          if (recentTimer.current) clearTimeout(recentTimer.current);
          recentTimer.current = setTimeout(() => setRecent(null), 4500);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (recentTimer.current) clearTimeout(recentTimer.current);
    };
  }, [spawnEmber]);

  // ── Form submission ─────────────────────────────────────────────────
  const boundAction = async (
    prevState: SubmitChametzState,
    formData: FormData
  ): Promise<SubmitChametzState> => {
    formData.set("user_name", userName || "אנונימי");
    formData.set("room_number", String(roomId));
    const result = await submitChametz(prevState, formData);
    if (result.success && result.blessing) {
      triggerHaptic();
      const submittedData: Submitted = {
        blessing: result.blessing,
        chametz: (formData.get("my_chametz") as string)?.trim() ?? "",
      };
      // Show flash for 1.8s, then switch to submitted screen
      setShowSuccessFlash(true);
      setTimeout(() => {
        setShowSuccessFlash(false);
        localStorage.setItem(`meliazafit_submitted_${roomId}`, JSON.stringify(submittedData));
        setAlreadySubmitted(submittedData);
      }, 1800);
    }
    return result;
  };

  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  return (
    <>
      <div className="flex h-screen overflow-hidden w-full" dir="rtl">

        {/* ══ RIGHT PANEL — Global Fire ══ */}
        <div className="absolute inset-0 lg:relative lg:inset-auto lg:w-1/2 lg:shrink-0 overflow-hidden">
          <video ref={videoRef} autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 1, filter: "brightness(1.1) saturate(1.3)" }}>
            <source src="/bg-video.mp4" type="video/mp4" />
          </video>

          <div className="absolute inset-0 lg:hidden" style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 100%)"
          }} />
          <div className="absolute inset-0 hidden lg:block" style={{
            background: [
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 20%, transparent 75%, rgba(0,0,0,0.6) 100%)",
              "linear-gradient(to right, transparent 80%, rgba(0,0,0,0.35) 100%)",
            ].join(", ")
          }} />

          <FireAmbient />

          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 10 }}>
            {embers.map(ember => (
              <EmberParticle key={ember.id} text={ember.text} roomNumber={ember.roomNum}
                onDone={() => removeEmber(ember.id)} />
            ))}
          </div>

          {/* Global counter */}
          <div className="absolute top-5 left-5 z-20">
            <motion.div key={totalCount} initial={{ scale: 1.4 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="glass-fire px-4 py-2 text-center">
              <p className="text-orange-200 text-xs font-semibold">נשרפו סה״כ</p>
              <p className="text-white font-black text-3xl leading-none">{totalCount}</p>
            </motion.div>
          </div>

          {/* Recent / idle */}
          <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 px-4">
            <AnimatePresence mode="wait">
              {recent ? (
                <motion.div key={recent.id}
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  exit={{   opacity: 0, scale: 0.9,   y: -15 }}
                  transition={{ duration: 0.45, type: "spring", bounce: 0.2 }}
                  className="max-w-xs w-full px-6 py-5 rounded-2xl text-center"
                  style={{
                    background: "rgba(140,20,0,0.6)",
                    border: "1px solid rgba(255,130,0,0.6)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 0 50px rgba(255,70,0,0.4)",
                  }}>
                  <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-2">
                    🔥 {recent.userName} שורף/ת
                  </p>
                  <p className="text-white font-black text-xl leading-snug mb-2">{recent.myChametz}</p>
                  <p className="text-orange-400 mb-1">✦</p>
                  <p className="text-white/70 text-sm font-semibold">ומזמין/ת: {recent.newInvitation}</p>
                </motion.div>
              ) : (
                <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-white/40 text-lg font-semibold text-center">
                  מדורת חדר {roomId} 🔥
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ══ LEFT PANEL — Form ══ */}
        <div className="relative z-10 flex flex-col w-full lg:w-1/2 lg:shrink-0 overflow-y-auto
          lg:border-r lg:border-orange-600/30"
          style={{
            background: [
              "radial-gradient(ellipse at 100% 85%, rgba(220,60,0,0.22) 0%, transparent 55%)",
              "radial-gradient(ellipse at 0%   20%, rgba(180,30,0,0.12) 0%, transparent 50%)",
              "linear-gradient(175deg, #0e0200 0%, #1c0500 30%, #260800 60%, #160300 100%)",
            ].join(", "),
          }}>

          {/* ── Countdown timer banner ── */}
          <AnimatePresence>
            {timeRemaining !== null && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{   opacity: 0, y: -20 }}
                className="flex items-center justify-between px-5 py-2 shrink-0"
                style={{
                  background: timeRemaining < 60
                    ? "rgba(220,20,0,0.5)"
                    : "rgba(180,50,0,0.4)",
                  borderBottom: "1px solid rgba(255,120,0,0.3)",
                }}
              >
                <span className="text-orange-200 text-sm font-bold flex items-center gap-2">
                  <span className="flicker">🔥</span>
                  המדורה ניסגרת בעוד
                </span>
                <span className={`font-black text-xl tabular-nums ${timeRemaining < 60 ? "text-red-300" : "text-white"}`}>
                  {formatTime(timeRemaining)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center min-h-full px-3 py-4 sm:px-6 sm:py-6 max-w-md mx-auto w-full">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-1 mb-3 mt-1 sm:mb-5 sm:mt-2">
              <div className="h-5">
                {nameLoaded ? (
                  userName && userName !== "אנונימי"
                    ? <p className="text-orange-300 text-sm font-semibold">שלום, {userName} 👋</p>
                    : null
                ) : (
                  <div className="w-28 h-4 rounded-full animate-pulse"
                    style={{ background: "rgba(255,140,0,0.2)" }} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl flicker">🔥</span>
                <h1 className="text-white font-black text-xl sm:text-2xl title-hero">חדר {roomId}</h1>
                <span className="text-xl flicker" style={{ animationDelay: "0.4s" }}>🔥</span>
              </div>
            </motion.div>

            {/* ── Already Submitted Screen ── */}
            <AnimatePresence mode="wait">
              {alreadySubmitted ? (
                <motion.div
                  key="submitted"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1,   y: 0  }}
                  className="glass w-full px-4 py-5 sm:px-6 sm:py-8 flex flex-col items-center gap-4 text-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="text-5xl"
                  >🔥</motion.div>

                  <div>
                    <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-2">
                      שרפת בהצלחה
                    </p>
                    <p className="text-white font-black text-base sm:text-xl leading-snug">
                      {alreadySubmitted.chametz}
                    </p>
                  </div>

                  <div className="w-full border-t border-orange-500/30 pt-4">
                    <p className="text-orange-300/80 text-xs font-bold tracking-wider uppercase mb-2">
                      ✨ הברכה האישית שלך
                    </p>
                    <p className="text-white/90 text-base leading-relaxed italic">
                      {alreadySubmitted.blessing}
                    </p>
                  </div>

                  <p className="text-white/40 text-xs mt-2">
                    עכשיו צפו במדורה המשותפת בצד ימין 👀
                  </p>

                  <button
                    onClick={() => {
                      localStorage.removeItem(`meliazafit_submitted_${roomId}`);
                      setAlreadySubmitted(null);
                    }}
                    className="text-white/30 text-xs hover:text-white/50 transition-colors mt-1"
                  >
                    שלח שוב (לביטול)
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="glass w-full px-5 py-6 flex-1 relative overflow-hidden">

                  {/* ── Success flash overlay (left panel only) ── */}
                  <AnimatePresence>
                    {showSuccessFlash && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 rounded-[inherit] flex flex-col items-center justify-center z-30"
                        style={{
                          background: "radial-gradient(ellipse at 50% 65%, rgba(255,60,0,0.45) 0%, rgba(10,0,0,0.88) 100%)",
                        }}
                      >
                        <motion.div
                          initial={{ scale: 0.4, y: 30 }}
                          animate={{ scale: [0.4, 1.4, 1.0], y: [30, -15, 0] }}
                          transition={{ duration: 0.7, times: [0, 0.5, 1] }}
                          className="text-6xl"
                        >🔥</motion.div>
                        <motion.p
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 }}
                          className="text-white font-black text-xl mt-3 text-center"
                          style={{ textShadow: "0 0 24px rgba(255,100,0,0.9)" }}
                        >
                          החמץ שלך עולה באש!
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.7 }}
                          className="text-orange-300/70 text-sm mt-2"
                        >
                          מכין את הברכה שלך...
                        </motion.p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:gap-4 h-full">
                    {QUESTIONS.map((q, i) => (
                      <motion.div key={q.name}
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.22 + i * 0.1 }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center
                                           text-white text-xs font-black shrink-0"
                            style={{
                              background: "linear-gradient(135deg, #f97316, #dc2626)",
                              boxShadow: "0 0 8px rgba(249,115,22,0.5)",
                            }}>
                            {q.num}
                          </span>
                          <label className="text-white font-bold text-sm">{q.label}</label>
                        </div>
                        <textarea name={q.name} required rows={2}
                          placeholder={q.hint} className="fire-input" />
                      </motion.div>
                    ))}

                    <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={isPending}
                      className="w-full text-white font-black text-base sm:text-lg py-3 sm:py-4 rounded-2xl mt-auto
                                 transition-all duration-150 disabled:opacity-55 disabled:cursor-not-allowed
                                 flex items-center justify-center gap-2"
                      style={{
                        background: isPending ? "rgba(255,255,255,0.15)"
                          : "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
                        boxShadow: isPending ? "none" : "0 4px 24px rgba(249,115,22,0.6)",
                      }}>
                      {isPending ? <><Spinner />שולח למדורה...</> : "שגר למדורה 🔥"}
                    </motion.button>
                  </form>

                  {state?.error && (
                    <p className="text-red-300 text-sm mt-3 text-center">{state.error}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              onClick={() => router.push("/dashboard")}
              className="w-full mt-3 mb-2 text-white/50 font-semibold text-sm py-2 sm:py-3 rounded-2xl
                         hover:bg-white/10 active:scale-95 transition-all duration-150"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
              סיימנו — חזרה למליאה 🏠
            </motion.button>
          </div>
        </div>

      </div>
    </>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white me-1" xmlns="http://www.w3.org/2000/svg"
      fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
