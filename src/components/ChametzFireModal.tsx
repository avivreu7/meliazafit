"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChametzFireModalProps {
  chametz: string;   // my_chametz — what's being burned
  blessing: string;  // AI blessing
  onClose: () => void;
}

// Full-screen personal fire moment shown on mobile after submit.
// The chametz rises upward in flames; the blessing fades in below.
// Auto-dismisses after 6 seconds or on tap.
export default function ChametzFireModal({ chametz, blessing, onClose }: ChametzFireModalProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        onClick={onClose}
        className="fixed inset-0 flex flex-col items-center justify-center select-none cursor-pointer"
        style={{
          zIndex: 100,
          background: "radial-gradient(ellipse at 50% 100%, rgba(255,60,0,0.85) 0%, rgba(120,10,0,0.95) 45%, rgba(10,0,0,0.98) 100%)",
        }}
      >
        {/* Ambient fire sparks overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {FIRE_SPARKS.map((s, i) => (
            <span key={i} className="spark" style={{
              position: "absolute",
              left: s.left, bottom: s.bottom,
              width: s.w, height: s.h,
              animationDelay: s.delay, animationDuration: s.dur,
              opacity: s.opacity,
            }} />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center max-w-xs">

          {/* Big flame emoji pulsing */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], rotate: [-3, 3, -3] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="text-7xl"
          >
            🔥
          </motion.div>

          {/* "What burns" — rises upward and fades */}
          <motion.div
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -60, opacity: 0, scale: 0.7 }}
            transition={{ delay: 1.2, duration: 2.8, ease: "easeIn" }}
            className="flex flex-col items-center gap-2"
          >
            <p className="text-orange-300/70 text-xs font-bold tracking-widest uppercase">
              עולה באש
            </p>
            <p className="text-white font-black text-2xl leading-snug"
              style={{ textShadow: "0 0 20px rgba(255,150,0,0.9), 0 0 40px rgba(255,80,0,0.6)" }}>
              {chametz}
            </p>
          </motion.div>

          {/* Blessing fades in after chametz starts rising */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5, duration: 1.0 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-px" style={{ background: "rgba(255,160,60,0.5)" }} />
            <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-1">
              ✨ ברכה אישית
            </p>
            <p className="text-white/90 text-base font-semibold leading-relaxed">
              {blessing}
            </p>
          </motion.div>

          {/* Tap to dismiss hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 4.5 }}
            className="text-white/30 text-xs mt-2"
          >
            לחץ בכל מקום לסגירה
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Static sparks for inside the modal (different timing from FireAmbient)
const FIRE_SPARKS = [
  { left: "10%", bottom: "5%",  delay: "0.2s", dur: "2.8s", w: 4, h: 7,  opacity: 0.9 },
  { left: "25%", bottom: "8%",  delay: "1.1s", dur: "3.2s", w: 5, h: 10, opacity: 0.8 },
  { left: "40%", bottom: "4%",  delay: "0.5s", dur: "2.5s", w: 3, h: 5,  opacity: 0.7 },
  { left: "55%", bottom: "9%",  delay: "1.8s", dur: "3.6s", w: 6, h: 11, opacity: 1.0 },
  { left: "70%", bottom: "6%",  delay: "0.9s", dur: "2.9s", w: 4, h: 8,  opacity: 0.85 },
  { left: "85%", bottom: "7%",  delay: "2.2s", dur: "3.3s", w: 5, h: 9,  opacity: 0.75 },
  { left: "17%", bottom: "12%", delay: "2.8s", dur: "3.0s", w: 3, h: 6,  opacity: 0.65 },
  { left: "63%", bottom: "10%", delay: "0.3s", dur: "4.0s", w: 7, h: 13, opacity: 0.95 },
];
