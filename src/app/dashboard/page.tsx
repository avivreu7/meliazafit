"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import EmberParticle from "@/components/EmberParticle";
import FireAmbient from "@/components/FireAmbient";
import GalleryStrip from "@/components/GalleryStrip";

interface Ember { id: string; text: string; roomNum: number }
interface SpotlightEntry {
  id: string; userName: string;
  myChametz: string; newInvitation: string; aiBlessing: string;
}
interface GalleryItem { id: string; text: string; userName: string }

type CeremonyState = "idle" | "loading" | "running";

const BASE_INTERVAL = 2400; // ms between entries
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const ROOMS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function DashboardPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [embers,    setEmbers]    = useState<Ember[]>([]);
  const [spotlight, setSpotlight] = useState<SpotlightEntry | null>(null);
  const [gallery,   setGallery]   = useState<GalleryItem[]>([]);
  const [total,     setTotal]     = useState(0);
  // Per-room counts (for bar chart)
  const [roomCounts, setRoomCounts] = useState<Record<number, number>>({});
  const spotlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Collective burn ceremony state ──────────────────────────────────
  const [ceremony,      setCeremony]      = useState<CeremonyState>("idle");
  const ceremonyAborted = useRef(false);
  const startCeremonyRef  = useRef<() => void>(() => {});
  const ceremonyStateRef  = useRef<CeremonyState>("idle");

  // All 10 rooms submitted at least one entry
  const allRoomsDone = ROOMS.every(n => (roomCounts[n] ?? 0) > 0);

  // Sync ceremony state → ref (readable in stable broadcast listener)
  useEffect(() => { ceremonyStateRef.current = ceremony; }, [ceremony]);

  // ── Force video autoplay ─────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    document.addEventListener("click", tryPlay, { once: true });
    return () => document.removeEventListener("click", tryPlay);
  }, []);

  const forceSpotlight = useCallback((entry: SpotlightEntry, durationMs?: number) => {
    if (spotlightTimer.current) clearTimeout(spotlightTimer.current);
    setSpotlight(entry);
    spotlightTimer.current = setTimeout(
      () => setSpotlight(null),
      durationMs ?? 5500
    );
  }, []);

  const spawnEmber = useCallback((text: string, roomNum: number) => {
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEmbers(prev => [...prev, { id, text, roomNum }]);
  }, []);

  const removeEmber = useCallback((id: string) => {
    setEmbers(prev => prev.filter(e => e.id !== id));
  }, []);

  // ── Load initial count, gallery, and per-room counts ─────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Gallery (last 8)
    supabase
      .from("chametz_entries")
      .select("id, user_name, my_chametz, new_invitation, room_number", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, count }) => {
        if (count) setTotal(count);
        if (data) {
          const rows = data as {
            id: string; user_name: string;
            my_chametz: string; new_invitation: string; room_number: number;
          }[];
          setGallery(rows.reverse().map(r => ({ id: r.id, text: r.new_invitation, userName: r.user_name })));
        }
      });

    // Per-room counts (fetch all room_numbers — lightweight)
    supabase
      .from("chametz_entries")
      .select("room_number")
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<number, number> = {};
        (data as { room_number: number }[]).forEach(r => {
          counts[r.room_number] = (counts[r.room_number] ?? 0) + 1;
        });
        setRoomCounts(counts);
      });
  }, []);

  // ── Real-time (live submissions during breakout rooms) ───────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("dashboard-all-rooms")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        (payload) => {
          if (ceremony === "running") return;
          const row = payload.new as {
            id: string; user_name: string; room_number: number;
            my_chametz: string; new_invitation: string; ai_blessing: string;
          };
          setTotal(n => n + 1);
          setRoomCounts(prev => ({
            ...prev,
            [row.room_number]: (prev[row.room_number] ?? 0) + 1,
          }));
          if (row.my_chametz)    spawnEmber(row.my_chametz, row.room_number);
          if (row.new_invitation)
            setGallery(prev => [...prev, { id: row.id, text: row.new_invitation, userName: row.user_name }]);
          forceSpotlight({ id: row.id, userName: row.user_name,
                           myChametz: row.my_chametz, newInvitation: row.new_invitation,
                           aiBlessing: row.ai_blessing });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (spotlightTimer.current) clearTimeout(spotlightTimer.current);
    };
  }, [spawnEmber, forceSpotlight, ceremony]);

  // ── 🔥 COLLECTIVE BURN CEREMONY ──────────────────────────────────────
  const startCeremony = useCallback(async () => {
    ceremonyAborted.current = false;
    setCeremony("loading");
    setSpotlight(null);

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("chametz_entries")
      .select("id, user_name, my_chametz, new_invitation, ai_blessing, room_number")
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) { setCeremony("idle"); return; }

    const entries = data as {
      id: string; user_name: string; my_chametz: string;
      new_invitation: string; ai_blessing: string; room_number: number;
    }[];
    setCeremony("running");

    for (let i = 0; i < entries.length; i++) {
      if (ceremonyAborted.current) break;
      const entry = entries[i];
      spawnEmber(entry.my_chametz, entry.room_number);
      forceSpotlight({
        id: `cer-${entry.id}`,
        userName: entry.user_name,
        myChametz: entry.my_chametz,
        newInvitation: entry.new_invitation,
        aiBlessing: entry.ai_blessing,
      }, BASE_INTERVAL - 200);
      await sleep(BASE_INTERVAL);
    }

    if (!ceremonyAborted.current) {
      setSpotlight(null);
      setCeremony("idle");
    }
  }, [spawnEmber, forceSpotlight]);

  // Sync startCeremony → ref (stable ref for broadcast listener)
  useEffect(() => { startCeremonyRef.current = startCeremony; }, [startCeremony]);

  // ── Listen for admin ignite signal ───────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("event-control")
      .on("broadcast", { event: "ignite_ceremony" }, () => {
        if (ceremonyStateRef.current === "idle") startCeremonyRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Max count for bar chart scaling
  const maxRoomCount = Math.max(1, ...Object.values(roomCounts));

  return (
    <div className="dashboard-root">

      {/* ── 1. Fire video ─────────────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 1, filter: "brightness(1.15) saturate(1.3)" }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* ── 2. Edge vignette ──────────────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        zIndex: 1,
        background: [
          "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 16%, transparent 76%, rgba(0,0,0,0.72) 100%)",
          "linear-gradient(to right,  rgba(0,0,0,0.22) 0%, transparent 10%, transparent 90%, rgba(0,0,0,0.22) 100%)",
        ].join(", "),
      }} />

      {/* ── 3. Ambient sparks ─────────────────────────────────────── */}
      <FireAmbient />

      {/* ── 4. Ember particles ────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 15 }}>
        {embers.map(ember => (
          <EmberParticle
            key={ember.id}
            text={ember.text}
            roomNumber={ember.roomNum}
            speedMultiplier={1}
            onDone={() => removeEmber(ember.id)}
          />
        ))}
      </div>

      {/* ── 5. Top bar ────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-4" style={{ zIndex: 20 }}>
        <div className="glass px-5 py-3 flex items-center gap-3">
          <span className="text-2xl flicker">🔥</span>
          <h1 className="text-white font-extrabold text-xl title-hero">ביעור חמץ רגשי</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* ── Room bar chart ── */}
          <div className="glass px-4 py-3 min-w-52">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/50 text-xs font-semibold">חדרים</p>
              <p className="text-orange-300 text-xs font-bold">
                {Object.keys(roomCounts).length}/10
                {allRoomsDone && <span className="text-green-400 mr-1"> ✓ הכל מוכן!</span>}
              </p>
            </div>
            <div className="flex gap-1 items-end h-10">
              {ROOMS.map(n => {
                const count = roomCounts[n] ?? 0;
                const heightPct = count > 0 ? Math.max(15, (count / maxRoomCount) * 100) : 6;
                return (
                  <div key={n} className="flex flex-col items-center gap-0.5 flex-1">
                    <motion.div
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
                      className="w-full rounded-sm"
                      style={{
                        background: count > 0
                          ? "linear-gradient(to top, #dc2626, #f97316)"
                          : "rgba(255,255,255,0.12)",
                        boxShadow: count > 0 ? "0 0 6px rgba(249,115,22,0.5)" : "none",
                        minHeight: "3px",
                      }}
                    />
                    <span className="text-white/40 text-xs leading-none">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Counter */}
          <motion.div key={total} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 18 }}
            className="glass-fire px-5 py-3 text-center">
            <p className="text-orange-200 text-xs font-semibold mb-0.5">נשרפו</p>
            <p className="text-white font-black text-4xl leading-none">{total}</p>
            <p className="text-orange-300 text-xs mt-0.5">חמץ 🔥</p>
          </motion.div>
        </div>
      </div>

      {/* ── 6. Spotlight ──────────────────────────────────────────── */}
      <AnimatePresence>
        {spotlight && (
          <motion.div key={spotlight.id}
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1,   y: 0  }}
            exit={{   opacity: 0, scale: 0.88, y: -20 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.25 }}
            className="absolute inset-x-0 flex justify-center pointer-events-none"
            style={{ top: "50%", transform: "translateY(-50%)", zIndex: 20 }}
          >
            <div className="max-w-xl w-full mx-10 px-8 py-7 rounded-3xl text-center" style={{
              background: "rgba(140,25,0,0.55)",
              border: "1px solid rgba(255,130,0,0.65)",
              backdropFilter: "blur(28px)",
              boxShadow: "0 0 80px rgba(255,70,0,0.45), 0 12px 48px rgba(0,0,0,0.6)",
            }}>
              <p className="text-orange-300/80 text-xs font-bold tracking-widest uppercase mb-3">
                🔥 {spotlight.userName} שורף/ת
              </p>
              <p className="text-white font-black text-3xl leading-snug mb-3 title-hero">
                {spotlight.myChametz}
              </p>
              <p className="text-orange-400 text-2xl mb-3">↑ ✦ ↓</p>
              <p className="text-orange-200 text-xs font-bold tracking-wider uppercase mb-1">ומזמין/ת במקום</p>
              <p className="text-white/90 font-bold text-xl leading-snug mb-4">
                {spotlight.newInvitation}
              </p>
              {spotlight.aiBlessing && (
                <div className="border-t border-white/20 pt-4">
                  <p className="text-orange-200/75 text-sm leading-relaxed italic">{spotlight.aiBlessing}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 8. Loading state ──────────────────────────────────────── */}
      {ceremony === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 25 }}>
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="text-6xl flicker">🔥</div>
            <p className="text-white text-2xl font-bold">מדליקים את המדורה...</p>
          </motion.div>
        </div>
      )}


      {/* ── 11. Gallery strip ─────────────────────────────────────── */}
      {ceremony !== "loading" && (
        <GalleryStrip items={gallery} />
      )}

      {/* ── 12. Bottom bar ────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center py-3 px-6" style={{ zIndex: 20 }}>
        <div className="glass flex items-center gap-3 px-5 py-2">
          <span className="text-orange-400 font-bold text-sm flicker">🔥</span>
          <span className="text-white/55 text-sm">
            {ceremony === "running"
              ? "המדורה בוערת..."
              : total > 0
              ? `${total} חמץ רגשי עלה לאש`
              : "המדורה מחכה..."}
          </span>
        </div>
      </div>

      {/* ── 13. Empty state ───────────────────────────────────────── */}
      {total === 0 && ceremony === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
          <motion.p
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="text-white/55 text-2xl font-semibold"
          >
            ממתין לחזיונות מהמדורה...
          </motion.p>
        </div>
      )}

    </div>
  );
}
