"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import MobileBackground from "@/components/MobileBackground";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Step = "loading" | "name" | "room";

export default function LobbyPage() {
  const router = useRouter();
  const [step,       setStep]       = useState<Step>("loading");
  const [nameInput,  setNameInput]  = useState("");
  const [nameError,  setNameError]  = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [savedRoom,  setSavedRoom]  = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // On mount: decide which step to show
  useEffect(() => {
    const saved = localStorage.getItem("meliazafit_name");
    const room  = localStorage.getItem("meliazafit_room");
    if (room) setSavedRoom(Number(room));

    if (saved && saved !== "אנונימי") {
      setNameInput(saved);
      setStep("room");
    } else {
      setStep("name");
    }

    const supabase = getSupabaseBrowserClient();
    supabase
      .from("chametz_entries")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count !== null) setTotalCount(count); });

    const channel = supabase
      .channel("lobby-live-count")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        () => setTotalCount(n => (n ?? 0) + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-focus name input when step becomes "name"
  useEffect(() => {
    if (step === "name") setTimeout(() => inputRef.current?.focus(), 300);
  }, [step]);

  const submitName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError(true); return; }
    localStorage.setItem("meliazafit_name", trimmed);
    setNameError(false);
    setStep("room");
  };

  const goToRoom = (n: number) => {
    localStorage.setItem("meliazafit_room", String(n));
    router.push(`/room/${n}`);
  };

  if (step === "loading") return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden">
      <MobileBackground />

      {/* Live counter badge */}
      <div className="absolute top-5 inset-x-0 flex justify-center z-10 pointer-events-none">
        <AnimatePresence>
          {totalCount !== null && totalCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl pointer-events-auto"
              style={{
                background: "rgba(255,80,0,0.2)",
                border: "1px solid rgba(255,140,50,0.4)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
              <span className="text-orange-200 text-sm font-bold">
                {totalCount} אנשים כבר שרפו 🔥
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-5 relative z-10">

        <AnimatePresence mode="wait">

          {/* ── Step 1: Name entry ── */}
          {step === "name" && (
            <motion.div
              key="name-step"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, type: "spring", bounce: 0.2 }}
              className="glass w-full px-6 py-8 flex flex-col items-center gap-5"
            >
              <div className="text-5xl">👋</div>
              <div className="text-center">
                <h2 className="text-white text-2xl font-extrabold mb-1">
                  מה שמך?
                </h2>
                <p className="text-white/45 text-sm">
                  השם שלך יופיע כשהחמץ שלך יישרף
                </p>
              </div>

              <div className="w-full flex flex-col gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameError(false); }}
                  onKeyDown={e => e.key === "Enter" && submitName()}
                  placeholder="הכנס/י שם..."
                  dir="rtl"
                  maxLength={40}
                  className="w-full px-4 py-3 rounded-2xl text-white text-lg font-semibold
                             placeholder:text-white/30 outline-none transition-all"
                  style={{
                    background: nameError
                      ? "rgba(220,38,38,0.2)"
                      : "rgba(255,255,255,0.1)",
                    border: nameError
                      ? "1px solid rgba(220,38,38,0.6)"
                      : "1px solid rgba(255,160,60,0.35)",
                  }}
                />
                {nameError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs font-semibold text-center"
                  >
                    נא להכניס שם לפני המשך
                  </motion.p>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={submitName}
                className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all"
                style={{
                  background: "linear-gradient(135deg, #f97316, #dc2626)",
                  boxShadow: "0 0 30px rgba(249,115,22,0.4)",
                }}
              >
                המשך לבחירת חדר 🔥
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2: Room selection ── */}
          {step === "room" && (
            <motion.div
              key="room-step"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, type: "spring", bounce: 0.2 }}
              className="w-full flex flex-col gap-5"
            >
              {/* Greeting */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <p className="text-white font-bold text-lg">
                  שלום, {nameInput} 👋
                </p>
                <button
                  onClick={() => setStep("name")}
                  className="text-white/35 text-xs hover:text-white/60 transition-colors mt-0.5"
                >
                  לא אני — שנה שם
                </button>
              </motion.div>

              {/* Return to saved room */}
              {savedRoom && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => goToRoom(savedRoom)}
                  className="w-full py-3 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(249,115,22,0.5), rgba(220,38,38,0.4))",
                    border: "1px solid rgba(249,115,22,0.5)",
                  }}
                >
                  ↩ המשך לחדר {savedRoom} שלי
                </motion.button>
              )}

              {/* Room grid */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass w-full px-6 py-6"
              >
                <h2 className="text-white text-xl font-extrabold text-center mb-1">
                  לאיזה חדר זום שובצת?
                </h2>
                <p className="text-white/45 text-xs text-center mb-5">בחר את מספר החדר שלך</p>

                <div className="grid grid-cols-5 gap-3">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n, idx) => (
                    <motion.button
                      key={n}
                      initial={{ opacity: 0, scale: 0.65 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.22 + idx * 0.04, type: "spring", stiffness: 270, damping: 18 }}
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => goToRoom(n)}
                      className="aspect-square rounded-2xl text-white text-2xl font-black
                                 flex items-center justify-center transition-all duration-150
                                 relative overflow-hidden group"
                      style={{
                        background: savedRoom === n
                          ? "rgba(249,115,22,0.35)"
                          : "rgba(255,255,255,0.14)",
                        border: savedRoom === n
                          ? "1px solid rgba(249,115,22,0.7)"
                          : "1px solid rgba(255,160,60,0.3)",
                      }}
                    >
                      <span
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{
                          background: "linear-gradient(135deg, rgba(249,115,22,0.75), rgba(220,38,38,0.65))",
                          boxShadow: "inset 0 0 16px rgba(255,100,0,0.3)",
                        }}
                      />
                      <span className="relative z-10">{n}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
