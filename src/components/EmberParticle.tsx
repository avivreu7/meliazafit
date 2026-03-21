"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface EmberParticleProps {
  text: string;
  onDone: () => void;
  roomNumber?: number;
  speedMultiplier?: number;
}

const SIZES = ["text-xl", "text-2xl", "text-3xl"];
const ROTATIONS = [-8, -4, 0, 4, 8];

export default function EmberParticle({
  text,
  onDone,
  roomNumber,
  speedMultiplier = 1,
}: EmberParticleProps) {
  const [x]         = useState(() => Math.floor(Math.random() * 72) + 8);
  const [baseDur]   = useState(() => 7 + Math.random() * 5);
  const [sizeClass] = useState(() => SIZES[Math.floor(Math.random() * SIZES.length)]);
  const [rotation]  = useState(() => ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)]);
  const [swayX]     = useState(() => (Math.random() - 0.5) * 80);

  // Faster when speedMultiplier > 1 (ceremony speed-up)
  const duration = Math.max(2.5, baseDur / speedMultiplier);

  return (
    <motion.div
      className="absolute bottom-16 pointer-events-none select-none z-20"
      style={{ right: `${x}%` }}
      initial={{ y: 0, opacity: 1, x: 0, rotate: rotation }}
      animate={{
        y: "-92vh",
        opacity: [1, 1, 0.85, 0],
        x: swayX,
        rotate: rotation + (Math.random() - 0.5) * 12,
      }}
      transition={{
        duration,
        ease: [0.2, 0.8, 0.4, 1],
        opacity: { duration, times: [0, 0.6, 0.8, 1] },
      }}
      onAnimationComplete={onDone}
    >
      <span
        className={`inline-block font-extrabold ${sizeClass} px-5 py-2.5 rounded-full`}
        style={{
          background:
            "linear-gradient(135deg, rgba(255,145,0,0.92) 0%, rgba(255,55,0,0.82) 100%)",
          color: "#fff",
          textShadow:
            "0 0 16px rgba(255,220,0,1), 0 0 32px rgba(255,140,0,0.8)",
          boxShadow:
            "0 0 24px rgba(255,100,0,0.7), 0 0 48px rgba(255,60,0,0.4), inset 0 1px 0 rgba(255,240,180,0.4)",
          border: "1px solid rgba(255,200,80,0.5)",
          backdropFilter: "blur(8px)",
          whiteSpace: "nowrap",
          maxWidth: "42vw",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "block",
        }}
      >
        {text}
      </span>
      {roomNumber !== undefined && (
        <span className="block text-center text-orange-300/60 text-xs mt-1 font-semibold">
          חדר {roomNumber}
        </span>
      )}
    </motion.div>
  );
}
