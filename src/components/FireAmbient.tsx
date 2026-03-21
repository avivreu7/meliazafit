// Pure CSS fire sparks — no JS randomness during render (SSR-safe).
// All values are static so server and client produce identical HTML.

const SPARKS = [
  { left: "6%",  bottom: "8%",  delay: "0s",    dur: "3.2s", w: 5, h: 9,  opacity: 0.9 },
  { left: "13%", bottom: "6%",  delay: "0.7s",  dur: "4.1s", w: 3, h: 5,  opacity: 0.7 },
  { left: "20%", bottom: "10%", delay: "1.4s",  dur: "3.6s", w: 6, h: 11, opacity: 1.0 },
  { left: "27%", bottom: "7%",  delay: "0.3s",  dur: "5.0s", w: 4, h: 7,  opacity: 0.8 },
  { left: "34%", bottom: "12%", delay: "1.9s",  dur: "3.8s", w: 7, h: 13, opacity: 0.9 },
  { left: "41%", bottom: "5%",  delay: "0.9s",  dur: "4.4s", w: 3, h: 6,  opacity: 0.75 },
  { left: "48%", bottom: "9%",  delay: "2.5s",  dur: "3.2s", w: 5, h: 9,  opacity: 1.0 },
  { left: "55%", bottom: "6%",  delay: "0.1s",  dur: "4.8s", w: 4, h: 7,  opacity: 0.85 },
  { left: "62%", bottom: "11%", delay: "1.6s",  dur: "3.9s", w: 6, h: 11, opacity: 0.9 },
  { left: "69%", bottom: "7%",  delay: "0.5s",  dur: "4.2s", w: 3, h: 5,  opacity: 0.7 },
  { left: "76%", bottom: "9%",  delay: "2.1s",  dur: "3.5s", w: 7, h: 13, opacity: 1.0 },
  { left: "83%", bottom: "6%",  delay: "0.8s",  dur: "5.1s", w: 4, h: 7,  opacity: 0.8 },
  { left: "90%", bottom: "10%", delay: "1.3s",  dur: "3.7s", w: 5, h: 9,  opacity: 0.9 },
  { left: "10%", bottom: "14%", delay: "3.0s",  dur: "4.0s", w: 3, h: 5,  opacity: 0.65 },
  { left: "37%", bottom: "8%",  delay: "3.4s",  dur: "3.3s", w: 4, h: 7,  opacity: 0.85 },
  { left: "54%", bottom: "12%", delay: "3.8s",  dur: "4.5s", w: 6, h: 11, opacity: 0.75 },
  { left: "71%", bottom: "5%",  delay: "4.2s",  dur: "3.6s", w: 3, h: 5,  opacity: 0.9 },
  { left: "87%", bottom: "9%",  delay: "2.8s",  dur: "4.9s", w: 5, h: 9,  opacity: 1.0 },
];

export default function FireAmbient() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="spark"
          style={{
            position: "absolute",
            left: s.left,
            bottom: s.bottom,
            width: s.w,
            height: s.h,
            animationDelay: s.delay,
            animationDuration: s.dur,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}
