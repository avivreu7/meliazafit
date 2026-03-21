"use client";

import { motion } from "framer-motion";
import MobileBackground from "@/components/MobileBackground";

export default function SummaryPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <MobileBackground />

      {/* Bottom fire glow */}
      <div
        className="fixed bottom-0 inset-x-0 h-72 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 100%, rgba(255,80,0,0.45) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-xs flex flex-col items-center gap-5 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="glass w-full px-7 py-8 flex flex-col items-center gap-5"
        >
          {/* Pulsing flame */}
          <motion.div
            animate={{ scale: [1, 1.18, 1], rotate: [-2, 2, -2] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="text-7xl"
          >
            🔥
          </motion.div>

          {/* Main */}
          <div>
            <h1 className="text-3xl font-extrabold text-white leading-snug mb-2">
              האש כבר דולקת!
            </h1>
            <p
              className="text-lg font-bold leading-relaxed"
              style={{
                background:
                  "linear-gradient(90deg, #ff9500, #ffcc00, #ff9500)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              שימו לב למסך המשותף בזום
            </p>
          </div>

          {/* Divider */}
          <div
            className="w-full h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,160,60,0.5), transparent)",
            }}
          />

          {/* Principal's lesson plan closing text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="flex flex-col gap-3"
          >
            <p className="text-white/85 text-base font-semibold leading-relaxed">
              חיבור בין נקיון הבית לניקיון הלב
            </p>
            <p className="text-white/65 text-sm leading-relaxed">
              כמו שחלקנו מנקים את הבית —<br />
              כך אנו בוחרים איך להרגיש ולהיות
            </p>
          </motion.div>

          {/* Passover greeting */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-orange-300 font-bold text-lg"
          >
            חג פסח שמח! 🌟
          </motion.p>
        </motion.div>
      </div>
    </main>
  );
}
