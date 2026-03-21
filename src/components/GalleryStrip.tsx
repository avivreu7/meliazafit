"use client";

import { motion, AnimatePresence } from "framer-motion";

interface GalleryStripProps {
  items: { id: string; text: string; userName: string }[];
}

// Shows up to 8 "new_invitation" cards in a horizontal strip.
// Older items fade-out from the right; newest enters from the left.
export default function GalleryStrip({ items }: GalleryStripProps) {
  const visible = items.slice(-8).reverse(); // newest first

  if (visible.length === 0) return null;

  return (
    <div className="absolute bottom-14 inset-x-0 z-20 px-6 overflow-hidden">
      <div className="flex gap-3 justify-center flex-wrap-reverse max-h-28 overflow-hidden">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.75, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.8,   y: -10 }}
              transition={{ duration: 0.45, type: "spring", bounce: 0.2 }}
              className="shrink-0 px-4 py-2 rounded-xl text-center max-w-48"
              style={{
                background: "rgba(255,80,0,0.22)",
                border: "1px solid rgba(255,140,50,0.45)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 0 14px rgba(255,80,0,0.2)",
              }}
            >
              <p className="text-orange-200 text-xs font-semibold mb-0.5 truncate">
                {item.userName}
              </p>
              <p className="text-white text-sm font-bold leading-snug line-clamp-2">
                {item.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
