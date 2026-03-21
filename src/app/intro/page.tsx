"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";

const STEPS = [
  {
    icon: "🏠",
    title: "ניקיון הבית",
    body: "לפני פסח אנחנו מנקים את הבית מחמץ — לחלוטין, עד הפינות הנסתרות ביותר.",
  },
  {
    icon: "❤️",
    title: "ניקיון הלב",
    body: "היום אנחנו עושים את אותו הדבר מבפנים — מחפשים את החמץ הרגשי שאנו נושאים.",
  },
  {
    icon: "🔥",
    title: "הביעור",
    body: "כמו שמבערים חמץ באש — כך אנחנו בוחרים לשחרר, להיפרד, ולהזמין משהו חדש.",
  },
  {
    icon: "✨",
    title: "ההזמנה",
    body: "מה תרצו להזמין במקום? יותר שמחה? שקט? ביטחון? זה הרגע לבחור.",
  },
];

export default function IntroPage() {
  const [phase, setPhase] = useState<"intro" | "instructions">("intro");
  const router = useRouter();

  return (
    <div className="dashboard-root select-none">
      {/* ── Fire video background ─────────────── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.55 }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlay — warmer at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(80,10,0,0.85) 0%, rgba(10,0,0,0.55) 50%, rgba(0,0,0,0.3) 100%)",
        }}
      />

      {/* ── Content ───────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          <IntroPhase key="intro" onNext={() => setPhase("instructions")} />
        ) : (
          <InstructionsPhase
            key="instructions"
            onStart={() => router.push("/dashboard")}
            onBack={() => setPhase("intro")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Phase 1: Opening statement ─────────────────────────────────────────── */
function IntroPhase({ onNext }: { onNext: () => void }) {
  const [lobbyUrl, setLobbyUrl] = useState("");

  useEffect(() => {
    setLobbyUrl(window.location.origin + "/lobby");
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.7 }}
      className="absolute inset-0 flex flex-col items-center justify-between py-10 px-8 z-10"
    >
      {/* spacer */}
      <div />

      {/* Central title block */}
      <div className="flex flex-col items-center gap-4 text-center max-w-5xl w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8, type: "spring", bounce: 0.3 }}
          className="text-8xl flicker"
        >
          🔥
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="text-fire-shimmer text-6xl md:text-7xl font-extrabold leading-tight"
        >
          ביעור חמץ רגשי
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.7 }}
          className="text-white/85 text-2xl md:text-3xl font-semibold leading-relaxed"
        >
          חיבור בין נקיון הבית לניקיון הלב
        </motion.p>

        {/* QR code + concept cards row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.7 }}
          className="flex flex-col md:flex-row items-center gap-6 w-full mt-2"
        >
          {/* 4 concept cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6 + i * 0.12, duration: 0.45 }}
                className="glass-fire px-4 py-4 text-center"
              >
                <div className="text-3xl mb-2">{step.icon}</div>
                <p className="text-orange-200 font-bold text-sm mb-1">{step.title}</p>
                <p className="text-white/70 text-xs leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>

          {/* QR code panel */}
          {lobbyUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.1, duration: 0.5, type: "spring" }}
              className="glass px-6 py-5 flex flex-col items-center gap-3 shrink-0"
            >
              <p className="text-orange-300 text-sm font-bold">סרקו להתחיל 👇</p>
              <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.95)" }}>
                <QRCode
                  value={lobbyUrl}
                  size={140}
                  bgColor="transparent"
                  fgColor="#1a0500"
                  level="M"
                />
              </div>
              <p className="text-white/40 text-xs text-center max-w-28 leading-snug">
                {lobbyUrl.replace(/^https?:\/\//, "")}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Next button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 0.6 }}
        onClick={onNext}
        className="glass-fire px-10 py-4 text-white font-bold text-xl rounded-2xl
                   hover:scale-105 active:scale-95 transition-transform duration-150
                   relative pulse-ring"
      >
        המשך להוראות ←
      </motion.button>
    </motion.div>
  );
}

/* ── Phase 2: Instructions for students ─────────────────────────────────── */
function InstructionsPhase({
  onStart,
  onBack,
}: {
  onStart: () => void;
  onBack: () => void;
}) {
  const [lobbyUrl, setLobbyUrl] = useState("");

  useEffect(() => {
    setLobbyUrl(window.location.origin + "/lobby");
  }, []);

  const instructions = [
    { num: "1", text: "פתחו את האפליקציה בטלפון שלכם ורשמו את שמכם" },
    { num: "2", text: "בחרו את מספר חדר הזום שאליו שובצתם" },
    { num: "3", text: "ענו על 3 שאלות בשקט ובכנות" },
    { num: "4", text: 'לחצו על "שגר למדורה" ← ← ←' },
  ];

  const questions = [
    { q: "החמץ שלי?",               hint: "מה אני נושא שכבד עליי..." },
    { q: "למה אני רוצה להיפרד ממנו?", hint: "מה זה עושה לי..." },
    { q: "מה אני מזמין במקום?",       hint: "מה אני בוחר לקבל..." },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 flex flex-col items-center justify-between py-8 px-8 z-10"
    >
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <h2 className="text-fire-shimmer text-4xl font-extrabold">איך עושים את זה?</h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl">
        {/* Steps */}
        <div className="flex flex-col gap-3">
          <p className="text-orange-300 font-bold text-lg mb-1">שלבי הפעילות:</p>
          {instructions.map((item, i) => (
            <motion.div
              key={item.num}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
              className="glass flex items-center gap-4 px-5 py-3"
            >
              <span className="glass-fire w-9 h-9 rounded-full flex items-center justify-center
                               text-orange-200 font-black text-lg shrink-0">
                {item.num}
              </span>
              <p className="text-white font-semibold text-base leading-snug">{item.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-3">
          <p className="text-orange-300 font-bold text-lg mb-1">3 שאלות שתענו עליהן:</p>
          {questions.map((item, i) => (
            <motion.div
              key={item.q}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.5 }}
              className="glass-fire px-5 py-4"
            >
              <p className="text-orange-200 font-bold text-base mb-1">🔥 {item.q}</p>
              <p className="text-white/60 text-sm italic">{item.hint}</p>
            </motion.div>
          ))}
        </div>

        {/* QR code */}
        {lobbyUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5, type: "spring" }}
            className="glass px-6 py-5 flex flex-col items-center gap-3"
          >
            <p className="text-orange-300 text-base font-bold">📱 סרקו להכנס</p>
            <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.95)" }}>
              <QRCode
                value={lobbyUrl}
                size={150}
                bgColor="transparent"
                fgColor="#1a0500"
                level="M"
              />
            </div>
            <p className="text-white/40 text-xs text-center leading-snug">
              {lobbyUrl.replace(/^https?:\/\//, "")}
            </p>
          </motion.div>
        )}
      </div>

      {/* Bottom buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="flex gap-4 items-center"
      >
        <button
          onClick={onBack}
          className="glass px-6 py-3 text-white/70 font-semibold rounded-2xl
                     hover:bg-white/20 transition-all text-base"
        >
          ← חזרה
        </button>
        <button
          onClick={onStart}
          className="glass-fire px-12 py-4 text-white font-extrabold text-xl rounded-2xl
                     hover:scale-105 active:scale-95 transition-transform duration-150
                     relative pulse-ring"
          style={{
            background: "linear-gradient(135deg, rgba(255,100,0,0.7), rgba(220,40,0,0.7))",
          }}
        >
          🔥 פותחים את המדורה!
        </button>
      </motion.div>
    </motion.div>
  );
}
