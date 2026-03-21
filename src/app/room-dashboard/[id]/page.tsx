"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import EmberParticle from "@/components/EmberParticle";
import FireAmbient from "@/components/FireAmbient";

interface Ember         { id: string; text: string }
interface SpotlightEntry { id: string; userName: string; myChametz: string; newInvitation: string; aiBlessing: string }
interface Submission    { id: string; userName: string; myChametz: string; created_at: string }

export default function RoomDashboardPage() {
  const params   = useParams();
  const roomId   = Number(params.id);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [embers,      setEmbers]      = useState<Ember[]>([]);
  const [spotlight,   setSpotlight]   = useState<SpotlightEntry | null>(null);
  const [total,       setTotal]       = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const spotlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Force video autoplay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    document.addEventListener("click", tryPlay, { once: true });
    return () => document.removeEventListener("click", tryPlay);
  }, []);

  const showSpotlight = useCallback((entry: SpotlightEntry) => {
    setSpotlight(entry);
    if (spotlightTimer.current) clearTimeout(spotlightTimer.current);
    spotlightTimer.current = setTimeout(() => setSpotlight(null), 5500);
  }, []);

  const spawnEmber  = useCallback((text: string) => {
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEmbers(prev => [...prev, { id, text }]);
  }, []);
  const removeEmber = useCallback((id: string) => {
    setEmbers(prev => prev.filter(e => e.id !== id));
  }, []);

  // Load initial data (count + submissions list)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("chametz_entries")
      .select("id, user_name, my_chametz, created_at", { count: "exact" })
      .eq("room_number", roomId)
      .order("created_at", { ascending: true })
      .then(({ data, count }) => {
        if (count) setTotal(count);
        if (data) {
          setSubmissions((data as { id: string; user_name: string; my_chametz: string; created_at: string }[])
            .map(r => ({ id: r.id, userName: r.user_name, myChametz: r.my_chametz, created_at: r.created_at })));
        }
      });
  }, [roomId]);

  // Real-time for THIS room only
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`room-dashboard-${roomId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries",
          filter: `room_number=eq.${roomId}` },
        (payload) => {
          const row = payload.new as {
            id: string; user_name: string;
            my_chametz: string; new_invitation: string; ai_blessing: string; created_at: string;
          };
          setTotal(n => n + 1);
          if (row.my_chametz) spawnEmber(row.my_chametz);
          setSubmissions(prev => [...prev, {
            id: row.id, userName: row.user_name,
            myChametz: row.my_chametz, created_at: row.created_at,
          }]);
          showSpotlight({
            id: row.id, userName: row.user_name,
            myChametz: row.my_chametz, newInvitation: row.new_invitation,
            aiBlessing: row.ai_blessing,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (spotlightTimer.current) clearTimeout(spotlightTimer.current);
    };
  }, [roomId, spawnEmber, showSpotlight]);

  return (
    <div className="dashboard-root">

      <video ref={videoRef} autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 1, filter: "brightness(1.15) saturate(1.3)" }}>
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        zIndex: 1,
        background: [
          "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 18%, transparent 78%, rgba(0,0,0,0.7) 100%)",
          "linear-gradient(to right,  rgba(0,0,0,0.25) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.25) 100%)",
        ].join(", "),
      }} />

      <FireAmbient />

      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 15 }}>
        {embers.map(ember => (
          <EmberParticle key={ember.id} text={ember.text} onDone={() => removeEmber(ember.id)} />
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-8 py-5" style={{ zIndex: 20 }}>
        <div className="glass px-6 py-3 flex items-center gap-3">
          <span className="text-2xl flicker">🔥</span>
          <h1 className="text-white font-extrabold text-2xl title-hero">מדורת חדר {roomId}</h1>
        </div>
        <motion.div key={total} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          className="glass-fire px-5 py-3 text-center">
          <p className="text-orange-200 text-xs font-semibold mb-0.5">שלחו בחדר</p>
          <p className="text-white font-black text-4xl leading-none">{total}</p>
          <p className="text-orange-300 text-xs mt-0.5">🔥</p>
        </motion.div>
      </div>

      {/* Center spotlight */}
      <AnimatePresence>
        {spotlight && (
          <motion.div key={spotlight.id}
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1,   y: 0  }}
            exit={{   opacity: 0, scale: 0.88, y: -20 }}
            transition={{ duration: 0.55, type: "spring", bounce: 0.25 }}
            className="absolute inset-x-0 flex justify-center pointer-events-none"
            style={{ top: "50%", transform: "translateY(-50%)", zIndex: 20 }}
          >
            <div className="max-w-lg w-full mx-10 px-8 py-7 rounded-3xl text-center" style={{
              background: "rgba(140,25,0,0.55)",
              border: "1px solid rgba(255,130,0,0.65)",
              backdropFilter: "blur(28px)",
              boxShadow: "0 0 80px rgba(255,70,0,0.4), 0 12px 48px rgba(0,0,0,0.6)",
            }}>
              <p className="text-orange-300/80 text-xs font-bold tracking-widest uppercase mb-3">
                🔥 {spotlight.userName} שורף/ת
              </p>
              <p className="text-white font-black text-3xl leading-snug mb-3 title-hero">
                {spotlight.myChametz}
              </p>
              <p className="text-orange-400 text-2xl mb-3">↑ ✦ ↓</p>
              <p className="text-orange-200 text-xs font-bold tracking-wider uppercase mb-1">ומזמין/ת במקום</p>
              <p className="text-white/90 font-bold text-xl leading-snug mb-4">{spotlight.newInvitation}</p>
              {spotlight.aiBlessing && (
                <div className="border-t border-white/20 pt-4">
                  <p className="text-orange-200/75 text-sm leading-relaxed italic">{spotlight.aiBlessing}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Submissions list (bottom-left) ── */}
      {submissions.length > 0 && (
        <div className="absolute bottom-14 right-6 w-52 max-h-72 overflow-y-auto"
          style={{ zIndex: 20 }}
          dir="rtl"
        >
          <p className="text-white/40 text-xs font-semibold mb-2 px-1">
            שלחו ({submissions.length}):
          </p>
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {submissions.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i < 5 ? 0 : 0 }}
                  className="rounded-xl px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,160,60,0.2)",
                  }}
                >
                  <p className="text-white/80 text-sm font-semibold leading-tight truncate">
                    {s.userName}
                  </p>
                  <p className="text-white/35 text-xs truncate mt-0.5">{s.myChametz}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && !spotlight && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
          <motion.p
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="text-white/55 text-2xl font-semibold"
          >
            ממתין לשליחות מחדר {roomId}...
          </motion.p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center py-3 px-6" style={{ zIndex: 20 }}>
        <div className="glass flex items-center gap-3 px-5 py-2">
          <span className="text-orange-400 font-bold text-sm flicker">🔥</span>
          <span className="text-white/55 text-sm">
            מדורת ביעור — חדר {roomId}
            {total > 0 && ` · ${total} נשרפו`}
          </span>
        </div>
      </div>

    </div>
  );
}
