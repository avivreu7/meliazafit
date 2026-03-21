"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface BlessingEntry {
  id: string;
  user_name: string;
  ai_blessing: string;
  created_at: string;
}

interface RealTimeBoardProps {
  roomId: number;
}

export default function RealTimeBoard({ roomId }: RealTimeBoardProps) {
  const [entries, setEntries] = useState<BlessingEntry[]>([]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Load existing entries on mount so the board isn't empty on reload
    supabase
      .from("chametz_entries")
      .select("id, user_name, ai_blessing, created_at")
      .eq("room_number", roomId)
      .not("ai_blessing", "is", null)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setEntries(data as BlessingEntry[]);
      });

    // Subscribe to new inserts for this room only
    const channel = supabase
      .channel(`room-board-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chametz_entries",
          filter: `room_number=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as BlessingEntry;
          if (row.ai_blessing) {
            setEntries((prev) => {
              // Prevent duplicates if the row was already loaded via the initial fetch
              if (prev.some((e) => e.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (entries.length === 0) {
    return (
      <p className="text-white/50 text-sm text-center py-4">
        הברכות יופיעו כאן בזמן אמת...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="glass px-4 py-3"
          >
            <p className="text-orange-300 text-sm font-bold mb-1">
              🔥 {entry.user_name}
            </p>
            <p className="text-white text-base leading-relaxed">
              {entry.ai_blessing}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
