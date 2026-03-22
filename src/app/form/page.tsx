"use client";

import { useEffect, useRef, useState, useActionState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import EmberParticle from "@/components/EmberParticle";
import FireAmbient from "@/components/FireAmbient";
import { submitChametz, SubmitChametzState } from "@/app/actions/submit-chametz";

const initialState: SubmitChametzState = { success: false };

const DRAFT_KEY  = "meliazafit_draft";
const NAME_KEY   = "meliazafit_name";
const SUBMIT_KEY = "meliazafit_submitted_form";

interface Ember  { id: string; text: string }
interface Recent { id: string; userName: string; myChametz: string; newInvitation: string }
interface Submitted { blessing: string; chametz: string; invitation: string; userName: string }
interface Entry  { id: string; userName: string; myChametz: string; newInvitation: string }

type Step       = "loading" | "name" | "form";
type TimerPhase = "discussion" | "writing";
type Draft      = { my_chametz: string; why_let_go: string; new_invitation: string };

const QUESTIONS = [
  { name: "my_chametz"     as keyof Draft, label: "החמץ שלי?",                  hint: "מה אני נושא שכבד עליי...", num: 1 },
  { name: "why_let_go"     as keyof Draft, label: "למה אני רוצה להיפרד ממנו?",  hint: "מה זה עושה לי...",          num: 2 },
  { name: "new_invitation" as keyof Draft, label: "מה אני מזמין במקום?",         hint: "מה אני בוחר לקבל...",       num: 3 },
];

const EMPTY_DRAFT: Draft = { my_chametz: "", why_let_go: "", new_invitation: "" };

function triggerHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate([80, 30, 150]);
}
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function FormPage() {
  const router   = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const formRef  = useRef<HTMLFormElement>(null);

  const [step,      setStep]      = useState<Step>("loading");
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState(false);
  const [userName,  setUserName]  = useState("");

  const [alreadySubmitted, setAlreadySubmitted] = useState<Submitted | null>(null);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);

  // Draft auto-save
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDraft = useCallback((field: keyof Draft, value: string) => {
    setDraft(prev => {
      const next = { ...prev, [field]: value };
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      }, 400);
      return next;
    });
  }, []);

  // Timer state
  const [timerPhase,    setTimerPhase]    = useState<TimerPhase | null>(null);
  const [timerActive,   setTimerActive]   = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerLoaded,   setTimerLoaded]   = useState(false);
  const timerEndRef = useRef<Date | null>(null);

  const [embers,     setEmbers]     = useState<Ember[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [recent,     setRecent]     = useState<Recent | null>(null);
  const recentTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [entries,    setEntries]    = useState<Entry[]>([]);

  // Form open only when writing phase is active
  const formOpen    = timerLoaded && timerPhase === "writing" && timerActive && (timeRemaining ?? 0) > 0;
  const inDiscussion = timerLoaded && timerPhase === "discussion" && timerActive && (timeRemaining ?? 0) > 0;

  // ── Video autoplay (slow)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.playbackRate = 0.5;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    document.addEventListener("click", tryPlay, { once: true });
    return () => document.removeEventListener("click", tryPlay);
  }, []);

  // ── Load name + check duplicate + load draft
  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) { setUserName(stored); setStep("form"); }
    else         { setStep("name"); }
    const prev = localStorage.getItem(SUBMIT_KEY);
    if (prev) { try { setAlreadySubmitted(JSON.parse(prev)); } catch {} }
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) { try { setDraft(JSON.parse(savedDraft)); } catch {} }
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

  // ── Timer fetch + realtime (postgres_changes + broadcast)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const applyTimerRow = (row: { ends_at: string | null; is_active: boolean; phase: string | null }) => {
      if (row.is_active && row.ends_at) {
        const end = new Date(row.ends_at);
        if (end > new Date()) {
          timerEndRef.current = end;
          setTimerPhase((row.phase as TimerPhase) ?? "writing");
          setTimerActive(true);
          setTimeRemaining(Math.ceil((end.getTime() - Date.now()) / 1000));
          return;
        }
      }
      timerEndRef.current = null;
      setTimerPhase(null);
      setTimerActive(false);
      setTimeRemaining(null);
    };

    // Initial fetch
    supabase
      .from("event_timer")
      .select("ends_at, is_active, phase")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) applyTimerRow(data as { ends_at: string | null; is_active: boolean; phase: string | null });
        setTimerLoaded(true);
      });

    // postgres_changes fallback (no filter — more reliable)
    const dbChannel = supabase
      .channel("form-timer-db")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_timer" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { ends_at: string | null; is_active: boolean; phase: string | null };
          if (row) applyTimerRow(row);
        }
      )
      .subscribe();

    // Broadcast channel: timer_update (instant from admin) + db_reset
    const bcastChannel = supabase
      .channel("form-event-control")
      .on("broadcast", { event: "timer_update" }, ({ payload }) => {
        applyTimerRow(payload as { ends_at: string | null; is_active: boolean; phase: string | null });
      })
      .on("broadcast", { event: "db_reset" }, () => {
        localStorage.removeItem(SUBMIT_KEY);
        localStorage.removeItem(NAME_KEY);
        localStorage.removeItem(DRAFT_KEY);
        setAlreadySubmitted(null);
        setDraft(EMPTY_DRAFT);
        setUserName("");
        setStep("name");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(bcastChannel);
    };
  }, []);

  // ── Countdown tick
  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 0) {
      if (timerPhase === "writing") {
        router.push("/dashboard");
      } else {
        // Discussion ended → keep form locked until admin starts writing
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
        localStorage.setItem(SUBMIT_KEY, JSON.stringify(submittedData));
        localStorage.removeItem(DRAFT_KEY);
        setDraft(EMPTY_DRAFT);
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
    localStorage.setItem(NAME_KEY, trimmed);
    setUserName(trimmed);
    setStep("form");
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row overflow-x-hidden w-full" dir="rtl">

      {/* ══ FIRE PANEL (top on mobile, right on desktop) ══ */}
      <div className="relative lg:fixed lg:inset-y-0 lg:right-0 lg:w-1/2 h-48 sm:h-64 lg:h-full shrink-0 overflow-hidden">
        <video ref={videoRef} autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 1, filter: "brightness(1.1) saturate(1.3)" }}>
          <source src="/bg-video.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 lg:hidden" style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 60%, rgba(14,2,0,1) 100%)"
        }} />
        <div className="absolute inset-0 hidden lg:block" style={{
          background: [
            "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 75%, rgba(0,0,0,0.6) 100%)",
            "linear-gradient(to left, transparent 80%, rgba(14,2,0,0.8) 100%)",
          ].join(", ")
        }} />
        <FireAmbient />
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 10 }}>
          {embers.map(ember => (
            <EmberParticle key={ember.id} text={ember.text} onDone={() => removeEmber(ember.id)} />
          ))}
        </div>

        {/* Counter */}
        <div className="absolute top-3 left-3 lg:top-5 lg:left-5 z-20">
          <motion.div key={totalCount} initial={{ scale: 1.4 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="glass-fire px-3 py-1.5 lg:px-4 lg:py-2 text-center">
            <p className="text-orange-200 text-xs font-semibold">שרפו כבר</p>
            <p className="text-white font-black text-2xl lg:text-3xl leading-none">{totalCount}</p>
          </motion.div>
        </div>

        {/* Recent submission */}
        <div className="absolute bottom-3 lg:bottom-20 inset-x-0 flex justify-center z-20 px-4">
          <AnimatePresence mode="wait">
            {recent ? (
              <motion.div key={recent.id}
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.9,   y: -15 }}
                transition={{ duration: 0.45, type: "spring", bounce: 0.2 }}
                className="max-w-xs w-full px-4 py-3 lg:px-5 lg:py-4 rounded-2xl text-center"
                style={{
                  background: "rgba(140,20,0,0.6)",
                  border: "1px solid rgba(255,130,0,0.6)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 0 50px rgba(255,70,0,0.4)",
                }}>
                <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-1">
                  🔥 {recent.userName} שורף/ת
                </p>
                <p className="text-white font-black text-base lg:text-lg leading-snug mb-1">{recent.myChametz}</p>
                <p className="text-white/65 text-xs lg:text-sm">ומזמין/ת: {recent.newInvitation}</p>
              </motion.div>
            ) : (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-white/40 text-base font-semibold text-center">
                {totalCount > 0 ? `${totalCount} כבר שרפו 🔥` : "המדורה מחכה..."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══ FORM PANEL ══ */}
      <div className="relative z-10 flex flex-col w-full lg:w-1/2 lg:mr-auto lg:ml-0"
        style={{
          background: [
            "radial-gradient(ellipse at 100% 85%, rgba(220,60,0,0.22) 0%, transparent 55%)",
            "radial-gradient(ellipse at 0%   20%, rgba(180,30,0,0.12) 0%, transparent 50%)",
            "linear-gradient(175deg, #0e0200 0%, #1c0500 30%, #260800 60%, #160300 100%)",
          ].join(", "),
          minHeight: "100vh",
        }}>

        {/* Sticky timer banner */}
        <AnimatePresence>
          {timeRemaining !== null && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-between px-5 py-2 shrink-0 sticky top-0 z-30"
              style={{
                background: timeRemaining < 60
                  ? "rgba(220,20,0,0.7)"
                  : timerPhase === "discussion"
                  ? "rgba(80,40,0,0.7)"
                  : "rgba(180,50,0,0.65)",
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

        <div className="flex flex-col items-center px-3 py-5 sm:px-6 sm:py-7 max-w-md mx-auto w-full flex-1">

          {/* ── Name entry ── */}
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
                className="flex flex-col items-center gap-1 mb-4 mt-1">
                <p className="text-orange-300 text-sm font-semibold">שלום, {userName} 👋</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl flicker">🔥</span>
                  <h1 className="text-white font-black text-xl sm:text-2xl title-hero">ביעור חמץ רגשי</h1>
                  <span className="text-xl flicker" style={{ animationDelay: "0.4s" }}>🔥</span>
                </div>
              </motion.div>

              {/* ── Already submitted ── */}
              {alreadySubmitted ? (
                <motion.div
                  key="submitted"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1,   y: 0  }}
                  className="glass w-full px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center gap-4 text-center">
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
                </motion.div>

              ) : !timerLoaded ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="text-4xl flicker">🔥</div>
                </div>

              ) : !formOpen ? (
                /* ── Locked state ── */
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col gap-4">
                  <div className="glass w-full px-5 py-4 text-center">
                    {inDiscussion ? (
                      <>
                        <p className="text-orange-300 font-bold text-sm tracking-widest uppercase mb-1">
                          💬 זמן השיח בקבוצה
                        </p>
                        <p className="text-white/65 text-sm">
                          שוחחו על השאלות — הטופס ייפתח בסיום השיח
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-orange-300 font-bold text-sm tracking-widest uppercase mb-1">
                          ⏳ ממתינים להתחלה
                        </p>
                        <p className="text-white/65 text-sm">
                          הטופס ייפתח כאשר המורה תתחיל את הפעילות
                        </p>
                      </>
                    )}
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
                /* ── Form open (writing phase) ── */
                <motion.div key="form-open" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="glass w-full px-5 py-5 relative overflow-hidden">

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

                  <form ref={formRef} action={formAction} className="flex flex-col gap-4">
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
                        <textarea
                          name={q.name}
                          required
                          rows={2}
                          placeholder={q.hint}
                          className="fire-input"
                          value={draft[q.name]}
                          onChange={e => updateDraft(q.name, e.target.value)}
                        />
                      </motion.div>
                    ))}

                    <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={isPending}
                      className="w-full text-white font-black text-base sm:text-lg py-4 rounded-2xl mt-2
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
                className="w-full mt-4 mb-2 text-white/50 font-semibold text-sm py-3 rounded-2xl
                           hover:bg-white/10 active:scale-95 transition-all duration-150"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                סיימנו — חזרה למליאה 🏠
              </motion.button>

              {/* Entries list */}
              {entries.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }} className="w-full mb-4">
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
