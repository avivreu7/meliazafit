"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import MobileBackground from "@/components/MobileBackground";

export default function WelcomePage() {
  const [name, setName] = useState("");
  const router = useRouter();

  const handleContinue = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem("meliazafit_name", trimmed);
    router.push("/lobby");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <MobileBackground />

      {/* Warm fire glow at bottom */}
      <div
        className="fixed bottom-0 inset-x-0 h-64 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,80,0,0.35) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm flex flex-col items-center gap-6 relative z-10">
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="glass w-full px-6 py-7"
        >
          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mb-5"
          >
            <div className="text-4xl mb-2 flicker">🔥</div>
            <h1 className="text-fire-shimmer text-3xl font-extrabold mb-1">
              ביעור חמץ רגשי
            </h1>
            <p className="text-white/70 text-sm">ברוכים הבאים לאירוע הפסח שלנו</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <label className="block text-white font-semibold mb-2 text-base">
              איך קוראים לך?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              placeholder="כתוב את שמך כאן..."
              maxLength={30}
              autoFocus
              className="w-full rounded-2xl px-4 py-3.5 text-lg
                         text-white placeholder:text-white/40
                         focus:outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.35)",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.15)",
              }}
            />

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleContinue}
              disabled={!name.trim()}
              className="mt-4 w-full text-white font-bold text-lg py-3.5 rounded-2xl
                         transition-all duration-150
                         disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: name.trim()
                  ? "linear-gradient(135deg, #f97316 0%, #dc2626 100%)"
                  : "rgba(255,255,255,0.2)",
                boxShadow: name.trim()
                  ? "0 4px 20px rgba(249,115,22,0.5)"
                  : "none",
              }}
            >
              המשך ללובי ←
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
