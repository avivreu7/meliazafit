"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Lobby redirects to /form — kept for backward compatibility with old QR codes
export default function LobbyPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/form"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0e0200 0%, #1c0500 100%)" }}>
      <div className="text-4xl" style={{ animation: "flicker 1.5s infinite" }}>🔥</div>
    </div>
  );
}
