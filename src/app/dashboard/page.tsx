"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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

type CeremonyState = "idle" | "loading" | "running" | "finale";

const BASE_INTERVAL = 2400;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export default function DashboardPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [embers,    setEmbers]    = useState<Ember[]>([]);
  const [spotlight, setSpotlight] = useState<SpotlightEntry | null>(null);
  const [gallery,   setGallery]   = useState<GalleryItem[]>([]);
  const [total,     setTotal]     = useState(0);
  const spotlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ceremony,      setCeremony]      = useState<CeremonyState>("idle");
  const [chametzWords,  setChametzWords]  = useState<string[]>([]);
  const ceremonyAborted = useRef(false);
  const startCeremonyRef  = useRef<() => void>(() => {});
  const ceremonyStateRef  = useRef<CeremonyState>("idle");

  useEffect(() => { ceremonyStateRef.current = ceremony; }, [ceremony]);

  // ── Force video autoplay (slow)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.playbackRate = 0.5;
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

  // ── Load initial count + gallery
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("chametz_entries")
      .select("id, user_name, my_chametz, new_invitation", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, count }) => {
        if (count) setTotal(count);
        if (data) {
          const rows = data as { id: string; user_name: string; new_invitation: string }[];
          setGallery(rows.reverse().map(r => ({ id: r.id, text: r.new_invitation, userName: r.user_name })));
        }
      });
  }, []);

  // ── Real-time
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("dashboard-all-rooms")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chametz_entries" },
        (payload) => {
          if (ceremony === "running") return;
          const row = payload.new as {
            id: string; user_name: string;
            my_chametz: string; new_invitation: string; ai_blessing: string;
          };
          setTotal(n => n + 1);
          if (row.my_chametz)    spawnEmber(row.my_chametz, 1);
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

  // ── 🔥 COLLECTIVE BURN CEREMONY
  const startCeremony = useCallback(async () => {
    ceremonyAborted.current = false;
    setCeremony("loading");
    setSpotlight(null);

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("chametz_entries")
      .select("id, user_name, my_chametz, new_invitation, ai_blessing")
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) { setCeremony("idle"); return; }

    const entries = data as {
      id: string; user_name: string; my_chametz: string;
      new_invitation: string; ai_blessing: string;
    }[];
    setCeremony("running");

    for (let i = 0; i < entries.length; i++) {
      if (ceremonyAborted.current) break;
      const entry = entries[i];
      spawnEmber(entry.my_chametz, 1);
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
      // Ember burst for finale
      entries.forEach((e, i) => {
        setTimeout(() => spawnEmber(e.my_chametz, 1), i * 55);
      });
      setChametzWords(entries.map(e => e.my_chametz));
      setCeremony("finale");
    }
  }, [spawnEmber, forceSpotlight]);

  useEffect(() => { startCeremonyRef.current = startCeremony; }, [startCeremony]);

  // ── Listen for admin ignite signal
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

  // ── Word bubble positions (deterministic pseudo-random by index)
  const bubblePositions = useMemo(() =>
    chametzWords.map((_, i) => ({
      left:  `${5  + (i * 47 + 11) % 82}%`,
      top:   `${8  + (i * 31 + 19) % 72}%`,
      size:  (["text-xs", "text-sm", "text-base"] as const)[i % 3],
      delay: 0.6 + i * 0.07,
      float: 2.5 + (i % 5) * 0.6,
    })),
  [chametzWords]);

  return (
    <div className="dashboard-root">

      {/* 1. Fire video */}
      <video
        ref={videoRef}
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 1, filter: "brightness(1.15) saturate(1.3)" }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* 2. Edge vignette */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        zIndex: 1,
        background: [
          "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 16%, transparent 76%, rgba(0,0,0,0.72) 100%)",
          "linear-gradient(to right,  rgba(0,0,0,0.22) 0%, transparent 10%, transparent 90%, rgba(0,0,0,0.22) 100%)",
        ].join(", "),
      }} />

      {/* 3. Ambient sparks */}
      <FireAmbient />

      {/* 4. Ember particles */}
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

      {/* 5. Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-4" style={{ zIndex: 20 }}>
        <div className="glass px-5 py-3 flex items-center gap-3">
          <span className="text-2xl flicker">🔥</span>
          <h1 className="text-white font-extrabold text-xl title-hero">ביעור חמץ רגשי</h1>
        </div>
        <motion.div key={total} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          className="glass-fire px-5 py-3 text-center">
          <p className="text-orange-200 text-xs font-semibold mb-0.5">נשרפו</p>
          <p className="text-white font-black text-4xl leading-none">{total}</p>
          <p className="text-orange-300 text-xs mt-0.5">חמץ 🔥</p>
        </motion.div>
      </div>

      {/* 6. Spotlight (shown during idle/running) */}
      {ceremony !== "finale" && (
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
      )}

      {/* 7. Loading state */}
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

      {/* 8. 🌋 FINALE SCREEN */}
      {ceremony === "finale" && (
        <motion.div
          key="finale"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6"
          style={{
            background: "radial-gradient(ellipse at 50% 60%, rgba(200,50,0,0.35) 0%, transparent 70%)",
          }}
        >
          {/* Title */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", bounce: 0.35, duration: 0.9 }}
            className="text-center mb-6 z-10"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 2.8, repeat: Infinity }}
              className="text-7xl mb-4"
            >🔥</motion.div>
            <h1 className="text-fire-shimmer text-4xl sm:text-6xl font-extrabold title-hero leading-tight mb-3">
              כל החמץ עלה לאש
            </h1>
            <p className="text-orange-300 text-lg sm:text-xl font-semibold">
              {total} חמץ רגשי נמחק ✦ חג פסח כשר ושמח ✨
            </p>
          </motion.div>

          {/* Word bubble cloud */}
          <div className="relative w-full max-w-5xl" style={{ height: "clamp(220px, 35vh, 320px)" }}>
            {chametzWords.map((word, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{
                  opacity: [0, 0.85, 0.85],
                  scale: [0.3, 1.1, 1],
                  y: [0, -(4 + (i % 5) * 2), 0],
                }}
                transition={{
                  opacity:  { delay: bubblePositions[i].delay, duration: 0.5 },
                  scale:    { delay: bubblePositions[i].delay, duration: 0.5, type: "spring" },
                  y: {
                    delay: bubblePositions[i].delay + 0.5,
                    duration: bubblePositions[i].float,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
                className={`absolute glass-fire rounded-full px-3 py-1.5 text-white font-bold ${bubblePositions[i].size}`}
                style={{
                  left: bubblePositions[i].left,
                  top:  bubblePositions[i].top,
                  maxWidth: "180px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {word}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 9. Gallery strip (hidden during finale) */}
      {ceremony !== "loading" && ceremony !== "finale" && (
        <GalleryStrip items={gallery} />
      )}

      {/* 10. Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center py-3 px-6" style={{ zIndex: 20 }}>
        <div className="glass flex items-center gap-3 px-5 py-2">
          <span className="text-orange-400 font-bold text-sm flicker">🔥</span>
          <span className="text-white/55 text-sm">
            {ceremony === "running"
              ? "המדורה בוערת..."
              : ceremony === "finale"
              ? "הטקס הסתיים — חג פסח שמח 🕊️"
              : total > 0
              ? `${total} חמץ רגשי עלה לאש`
              : "המדורה מחכה..."}
          </span>
        </div>
      </div>

      {/* 11. Empty state */}
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
