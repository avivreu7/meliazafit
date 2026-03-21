import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export default function GlassCard({ children, className = "" }: GlassCardProps) {
  return <div className={`glass px-6 py-6 ${className}`}>{children}</div>;
}
