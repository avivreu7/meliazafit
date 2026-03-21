import Image from "next/image";

export default function MobileBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      {/* bg-mobile.jpg must be placed in /public/bg-mobile.jpg */}
      <Image
        src="/bg-mobile.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
      />
      {/* Warm fire gradient — dark top for readability, amber glow from bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.08) 60%, rgba(20,5,0,0.55) 100%)",
            "radial-gradient(ellipse 130% 50% at 50% 110%, rgba(200,55,0,0.5) 0%, transparent 65%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
