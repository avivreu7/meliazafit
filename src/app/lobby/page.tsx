"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import MobileBackground from "@/components/MobileBackground";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LobbyPage() {
  const router = useRouter();
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [savedRoom,  setSavedRoom]  = useState<number | null>(null);

  // Live participant counter + check for saved room
  useEffect(() => {
    const room = localStorage.getItem("meliazafit_room");
    if (room) setSavedRoom(Number(room));

    const supabase = getSupabaseBrowserClient();
    // Initial count
    supabase
      .from("chametz_entries")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => { if (count !== null) setTotalCount(count); });

    // Subscribe to new inserts
    const channel = supabase
      .channel("lobby-live-count")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        () => setTotalCount(n => (n ?? 0) + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const goToRoom = (n: number) => {
    localStorage.setItem("meliazafit_room", String(n));
    router.push(`/room/${n}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden">
      <MobileBackground />

      <div className="w-full max-w-sm flex flex-col items-center gap-5 relative z-10">

        {/* Live counter badge */}
        {totalCount !== null && totalCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl"
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

        {/* Return to saved room */}
        {savedRoom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push(`/room/${savedRoom}`)}
            className="w-full py-3 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.5), rgba(220,38,38,0.4))",
              border: "1px solid rgba(249,115,22,0.5)",
            }}
          >
            ↩ המשך לחדר {savedRoom} שלי
          </motion.button>
        )}

        {/* Room selection */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
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
                transition={{ delay: 0.32 + idx * 0.045, type: "spring", stiffness: 270, damping: 18 }}
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

      </div>
    </main>
  );
}
