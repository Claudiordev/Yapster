import { CLOUDS, Cloud, STARS } from "./sunset-data";

export function SunsetBackdrop() {
  return (
    <div
      aria-hidden
      className="sunset-sky pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* twinkling stars in the dark upper sky */}
      {STARS.map((star, i) => (
        <span
          key={`star-${i}`}
          className="star"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}

      {/* setting sun glowing above the horizon */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: "28%",
          width: 300,
          height: 300,
          background:
            "radial-gradient(circle, #ffe0b0 0%, #ff5a5f 45%, rgba(255,90,95,0) 72%)",
        }}
      />

      {/* grey silhouette clouds (the chat menu colour), some drifting */}
      {CLOUDS.map((cloud, i) => (
        <div
          key={`cloud-${i}`}
          className={`absolute ${cloud.drift ? "cloud-drift" : ""}`}
          style={{
            left: cloud.left,
            bottom: cloud.bottom,
            opacity: cloud.opacity,
            animationDuration: cloud.drift ? `${cloud.drift}s` : undefined,
            animationDelay: cloud.drift ? `-${i * 4}s` : undefined,
          }}
        >
          <div style={{ transform: cloud.flip ? "scaleX(-1)" : undefined }}>
            <Cloud
              id={`cloud-grad-${i}`}
              shape={cloud.shape}
              width={cloud.width}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
