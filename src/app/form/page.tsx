"use client";

import { useEffect, useRef, useState, useActionState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import EmberParticle from "@/components/EmberParticle";
import FireAmbient from "@/components/FireAmbient";
import { submitChametz, SubmitChametzState } from "@/app/actions/submit-chametz";

const initialState: SubmitChametzState = { success: false };

interface Ember  { id: string; text: string }
interface Recent { id: string; userName: string; myChametz: string; newInvitation: string }
interface Submitted { blessing: string; chametz: string; invitation: string; userName: string }
interface Entry  { id: string; userName: string; myChametz: string; newInvitation: string }

type Step        = "loading" | "name" | "form";
type TimerPhase  = "discussion" | "writing";

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

function printPersonalMemorial(data: Submitted) {
  const esc = (v: string) => (v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const date = new Date().toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"><title>מזכרת — ${esc(data.userName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Assistant', Arial, sans-serif; direction: rtl; background: #fff7ed;
           min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 30px; }
    .card { max-width: 480px; width: 100%; background: white; border: 2px solid #fed7aa;
            border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 4px 30px rgba(0,0,0,0.1); }
    h1 { font-size: 1.8rem; color: #c2410c; margin-bottom: 6px; }
    .date { color: #9ca3af; font-size: 0.9rem; margin-bottom: 24px; }
    .name { font-size: 1.4rem; font-weight: 800; color: #9a3412; margin-bottom: 28px; }
    .label { font-size: 0.72rem; color: #c2410c; font-weight: 700; text-transform: uppercase;
             letter-spacing: 0.08em; margin-bottom: 6px; }
    .value { font-size: 1.05rem; color: #1c0500; margin-bottom: 22px; line-height: 1.6; }
    .blessing { border-top: 1px solid #fde68a; padding-top: 18px; font-style: italic;
                color: #92400e; font-size: 0.95rem; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔥 ביעור חמץ רגשי</h1>
    <p class="date">${date}</p>
    <p class="name">✦ ${esc(data.userName)} ✦</p>
    <p class="label">החמץ שרפתי</p>
    <p class="value">${esc(data.chametz)}</p>
    <p class="label">ומזמין/ת במקום</p>
    <p class="value">${esc(data.invitation)}</p>
    ${data.blessing ? `<p class="blessing">✨ ${esc(data.blessing)}</p>` : ""}
  </div>
</body>
</html>`;
  const win = window.open("", "_blank");
  if (!win) { alert("אפשר חלונות קופצים בדפדפן"); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

export default function FormPage() {
  const router  = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const formRef  = useRef<HTMLFormElement>(null);

  const [step,       setStep]       = useState<Step>("loading");
  const [nameInput,  setNameInput]  = useState("");
  const [nameError,  setNameError]  = useState(false);
  const [userName,   setUserName]   = useState("");

  const [alreadySubmitted, setAlreadySubmitted] = useState<Submitted | null>(null);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);

  const [timerPhase,    setTimerPhase]    = useState<TimerPhase | null>(null);
  const [timerActive,   setTimerActive]   = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerEndRef = useRef<Date | null>(null);

  const [embers,     setEmbers]     = useState<Ember[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [recent,     setRecent]     = useState<Recent | null>(null);
  const recentTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [entries,    setEntries]    = useState<Entry[]>([]);

  const formLocked = timerPhase === "discussion" && timerActive && (timeRemaining ?? 0) > 0;

  // ── Video autoplay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    document.addEventListener("click", tryPlay, { once: true });
    return () => document.removeEventListener("click", tryPlay);
  }, []);

  // ── Load name + check duplicate
  useEffect(() => {
    const stored = localStorage.getItem("meliazafit_name");
    if (stored) { setUserName(stored); setStep("form"); }
    else         { setStep("name"); }
    const prev = localStorage.getItem("meliazafit_submitted_form");
    if (prev) { try { setAlreadySubmitted(JSON.parse(prev)); } catch {} }
  }, []);

  // ── Load initial data
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("chametz_entries")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count) setTotalCount(count); });
    supabase
      .from("chametz_entries")
      .select("id, user_name, my_chametz, new_invitation")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setEntries(
          (data as { id: string; user_name: string; my_chametz: string; new_invitation: string }[])
            .reverse()
            .map(r => ({ id: r.id, userName: r.user_name, myChametz: r.my_chametz, newInvitation: r.new_invitation }))
        );
      });
  }, []);

  // ── Timer fetch + subscribe
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("event_timer")
      .select("ends_at, is_active, phase")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        if (data.is_active && data.ends_at) {
          const end = new Date(data.ends_at as string);
          if (end > new Date()) {
            timerEndRef.current = end;
            setTimerPhase((data.phase as TimerPhase) ?? "writing");
            setTimerActive(true);
            setTimeRemaining(Math.ceil((end.getTime() - Date.now()) / 1000));
          }
        }
      });

    const channel = supabase
      .channel("form-timer-watch")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_timer", filter: "id=eq.1" },
        (payload) => {
          const row = payload.new as { ends_at: string | null; is_active: boolean; phase: string };
          if (row.is_active && row.ends_at) {
            const end = new Date(row.ends_at);
            timerEndRef.current = end;
            setTimerPhase((row.phase as TimerPhase) ?? "writing");
            setTimerActive(true);
            setTimeRemaining(Math.ceil((end.getTime() - Date.now()) / 1000));
          } else {
            timerEndRef.current = null;
            setTimerPhase(null);
            setTimerActive(false);
            setTimeRemaining(null);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Countdown tick
  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 0) {
      if (timerPhase === "writing") {
        router.push("/dashboard");
      } else {
        // Discussion ended → unlock form
        setTimerPhase(null);
        setTimerActive(false);
        setTimeRemaining(null);
      }
      return;
    }
    const t = setTimeout(() => setTimeRemaining(n => n !== null ? n - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [timeRemaining, timerPhase, router]);

  // ── Real-time entries
  const spawnEmber = useCallback((text: string) => {
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEmbers(prev => [...prev, { id, text }]);
  }, []);
  const removeEmber = useCallback((id: string) => {
    setEmbers(prev => prev.filter(e => e.id !== id));
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("form-global-feed")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        (payload) => {
          const row = payload.new as {
            id: string; user_name: string; my_chametz: string; new_invitation: string;
          };
          setTotalCount(n => n + 1);
          if (row.my_chametz) spawnEmber(row.my_chametz);
          setRecent({ id: row.id, userName: row.user_name,
                      myChametz: row.my_chametz, newInvitation: row.new_invitation });
          setEntries(prev => [...prev, {
            id: row.id, userName: row.user_name,
            myChametz: row.my_chametz, newInvitation: row.new_invitation,
          }]);
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

  // ── Form submission
  const boundAction = async (
    prevState: SubmitChametzState,
    formData: FormData
  ): Promise<SubmitChametzState> => {
    formData.set("user_name", userName || "אנונימי");
    const result = await submitChametz(prevState, formData);
    if (result.success && result.blessing) {
      triggerHaptic();
      const submittedData: Submitted = {
        blessing:   result.blessing,
        chametz:    (formData.get("my_chametz")      as string)?.trim() ?? "",
        invitation: (formData.get("new_invitation")  as string)?.trim() ?? "",
        userName,
      };
      setShowSuccessFlash(true);
      setTimeout(() => {
        setShowSuccessFlash(false);
        localStorage.setItem("meliazafit_submitted_form", JSON.stringify(submittedData));
        setAlreadySubmitted(submittedData);
      }, 1800);
    }
    return result;
  };

  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError(true); return; }
    localStorage.setItem("meliazafit_name", trimmed);
    setUserName(trimmed);
    setStep("form");
  };

  return (
    <div className="flex h-screen overflow-hidden w-full" dir="rtl">

      {/* ══ RIGHT PANEL — Fire ══ */}
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
            <EmberParticle key={ember.id} text={ember.text} onDone={() => removeEmber(ember.id)} />
          ))}
        </div>

        {/* Counter */}
        <div className="absolute top-5 left-5 z-20">
          <motion.div key={totalCount} initial={{ scale: 1.4 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="glass-fire px-4 py-2 text-center">
            <p className="text-orange-200 text-xs font-semibold">שרפו כבר</p>
            <p className="text-white font-black text-3xl leading-none">{totalCount}</p>
          </motion.div>
        </div>

        {/* Recent */}
        <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 px-4">
          <AnimatePresence mode="wait">
            {recent ? (
              <motion.div key={recent.id}
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.9,   y: -15 }}
                transition={{ duration: 0.45, type: "spring", bounce: 0.2 }}
                className="max-w-xs w-full px-5 py-4 rounded-2xl text-center"
                style={{
                  background: "rgba(140,20,0,0.6)",
                  border: "1px solid rgba(255,130,0,0.6)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 0 50px rgba(255,70,0,0.4)",
                }}>
                <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-1">
                  🔥 {recent.userName} שורף/ת
                </p>
                <p className="text-white font-black text-lg leading-snug mb-1">{recent.myChametz}</p>
                <p className="text-white/65 text-sm">ומזמין/ת: {recent.newInvitation}</p>
              </motion.div>
            ) : (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-white/40 text-lg font-semibold text-center">
                {totalCount > 0 ? `${totalCount} כבר שרפו 🔥` : "המדורה מחכה..."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══ LEFT PANEL ══ */}
      <div className="relative z-10 flex flex-col w-full lg:w-1/2 lg:shrink-0 overflow-y-auto
        lg:border-r lg:border-orange-600/30"
        style={{
          background: [
            "radial-gradient(ellipse at 100% 85%, rgba(220,60,0,0.22) 0%, transparent 55%)",
            "radial-gradient(ellipse at 0%   20%, rgba(180,30,0,0.12) 0%, transparent 50%)",
            "linear-gradient(175deg, #0e0200 0%, #1c0500 30%, #260800 60%, #160300 100%)",
          ].join(", "),
        }}>

        {/* Timer banner */}
        <AnimatePresence>
          {timeRemaining !== null && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-between px-5 py-2 shrink-0"
              style={{
                background: timeRemaining < 60
                  ? "rgba(220,20,0,0.5)"
                  : timerPhase === "discussion"
                  ? "rgba(80,40,0,0.5)"
                  : "rgba(180,50,0,0.4)",
                borderBottom: "1px solid rgba(255,120,0,0.3)",
              }}>
              <span className="text-orange-200 text-sm font-bold flex items-center gap-2">
                <span className="flicker">🔥</span>
                {timerPhase === "discussion" ? "זמן השיח" : "זמן הכתיבה"}
              </span>
              <span className={`font-black text-xl tabular-nums ${timeRemaining < 60 ? "text-red-300" : "text-white"}`}>
                {formatTime(timeRemaining)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center min-h-full px-3 py-4 sm:px-6 sm:py-6 max-w-md mx-auto w-full">

          {/* ── Name entry step ── */}
          {step === "name" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="w-full flex flex-col items-center gap-6 mt-8">
              <div className="text-center">
                <div className="text-5xl flicker mb-3">🔥</div>
                <h1 className="text-white font-black text-2xl title-hero mb-1">ביעור חמץ רגשי</h1>
                <p className="text-white/60 text-sm">לפני שנתחיל — מה שמך?</p>
              </div>
              <form onSubmit={handleNameSubmit} className="w-full flex flex-col gap-3">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameError(false); }}
                  placeholder="שם מלא"
                  autoFocus
                  className="fire-input text-center text-lg font-bold"
                  style={{ borderColor: nameError ? "rgba(239,68,68,0.7)" : undefined }}
                />
                {nameError && <p className="text-red-300 text-sm text-center">נא להכניס שם</p>}
                <button type="submit"
                  className="w-full text-white font-black text-lg py-4 rounded-2xl transition-all duration-150"
                  style={{
                    background: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
                    boxShadow: "0 4px 24px rgba(249,115,22,0.6)",
                  }}>
                  המשך למדורה 🔥
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Loading ── */}
          {step === "loading" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-4xl flicker">🔥</div>
            </div>
          )}

          {/* ── Form step ── */}
          {step === "form" && (
            <>
              {/* Header */}
              <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-1 mb-3 mt-1 sm:mb-5 sm:mt-2">
                <p className="text-orange-300 text-sm font-semibold">שלום, {userName} 👋</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl flicker">🔥</span>
                  <h1 className="text-white font-black text-xl sm:text-2xl title-hero">ביעור חמץ רגשי</h1>
                  <span className="text-xl flicker" style={{ animationDelay: "0.4s" }}>🔥</span>
                </div>
              </motion.div>

              {/* Memorial card (if already submitted) */}
              {alreadySubmitted ? (
                <motion.div
                  key="submitted"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1,   y: 0  }}
                  className="glass w-full px-4 py-5 sm:px-6 sm:py-8 flex flex-col items-center gap-4 text-center">
                  <motion.div animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }} className="text-5xl">🔥</motion.div>
                  <div>
                    <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-2">
                      שרפת בהצלחה ✓
                    </p>
                    <p className="text-white font-black text-base sm:text-xl leading-snug">
                      {alreadySubmitted.chametz}
                    </p>
                  </div>
                  <div className="w-full border-t border-orange-500/30 pt-4">
                    <p className="text-orange-300/80 text-xs font-bold tracking-wider uppercase mb-2">
                      ✨ הברכה האישית שלך
                    </p>
                    <p className="text-white/90 text-sm sm:text-base leading-relaxed italic">
                      {alreadySubmitted.blessing}
                    </p>
                  </div>
                  <button
                    onClick={() => printPersonalMemorial(alreadySubmitted)}
                    className="px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: "linear-gradient(135deg, #f97316, #dc2626)",
                      boxShadow: "0 4px 16px rgba(249,115,22,0.4)",
                    }}>
                    🖨️ שמור מזכרת אישית
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem("meliazafit_submitted_form");
                      setAlreadySubmitted(null);
                    }}
                    className="text-white/30 text-xs hover:text-white/50 transition-colors">
                    שלח שוב (לביטול)
                  </button>
                </motion.div>

              ) : formLocked ? (
                /* ── Discussion phase: locked, projectable questions ── */
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col gap-4">
                  <div className="glass w-full px-5 py-4 text-center">
                    <p className="text-orange-300 font-bold text-sm tracking-widest uppercase mb-1">
                      💬 זמן השיח בקבוצה
                    </p>
                    <p className="text-white/65 text-sm">
                      שוחחו על השאלות — הטופס ייפתח בסיום השיח
                    </p>
                  </div>
                  {QUESTIONS.map((q, i) => (
                    <motion.div key={q.name}
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.15 }}
                      className="glass-fire w-full px-5 py-5">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
                          style={{ background: "linear-gradient(135deg, #f97316, #dc2626)", boxShadow: "0 0 10px rgba(249,115,22,0.5)" }}>
                          {q.num}
                        </span>
                        <p className="text-white font-bold text-base sm:text-lg">{q.label}</p>
                      </div>
                      <p className="text-orange-200/70 text-sm italic" style={{ marginRight: "2.75rem" }}>
                        {q.hint}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>

              ) : (
                /* ── Normal form ── */
                <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="glass w-full px-5 py-6 flex-1 relative overflow-hidden">

                  {/* Success flash */}
                  <AnimatePresence>
                    {showSuccessFlash && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 rounded-[inherit] flex flex-col items-center justify-center z-30"
                        style={{
                          background: "radial-gradient(ellipse at 50% 65%, rgba(255,60,0,0.45) 0%, rgba(10,0,0,0.88) 100%)",
                        }}>
                        <motion.div
                          initial={{ scale: 0.4, y: 30 }}
                          animate={{ scale: [0.4, 1.4, 1.0], y: [30, -15, 0] }}
                          transition={{ duration: 0.7, times: [0, 0.5, 1] }}
                          className="text-6xl">🔥</motion.div>
                        <motion.p
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 }}
                          className="text-white font-black text-xl mt-3 text-center"
                          style={{ textShadow: "0 0 24px rgba(255,100,0,0.9)" }}>
                          החמץ שלך עולה באש!
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

              {/* Back to plenary */}
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                onClick={() => router.push("/dashboard")}
                className="w-full mt-3 mb-2 text-white/50 font-semibold text-sm py-2 sm:py-3 rounded-2xl
                           hover:bg-white/10 active:scale-95 transition-all duration-150"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                סיימנו — חזרה למליאה 🏠
              </motion.button>

              {/* Entries list */}
              {entries.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }} className="w-full mb-3">
                  <p className="text-orange-300/80 text-xs font-bold tracking-wide mb-2 px-1">
                    🔥 מה כולם שורפים ({entries.length})
                  </p>
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                    {[...entries].reverse().map(e => (
                      <div key={e.id} className="rounded-xl px-3 py-2.5" style={{
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,140,50,0.2)",
                      }}>
                        <p className="text-orange-200 text-xs font-bold mb-1 truncate">✦ {e.userName}</p>
                        <p className="text-white/80 text-xs leading-snug">
                          <span className="text-orange-400/70">שורף: </span>{e.myChametz}
                        </p>
                        <p className="text-white/50 text-xs leading-snug mt-0.5">
                          <span className="text-green-400/60">מזמין: </span>{e.newInvitation}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-white/30 text-xs text-center mt-2 italic">
                    💬 מה דומה בחמץ שלך? מה שונה?
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
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
