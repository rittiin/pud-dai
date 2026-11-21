// "น้องพูดได้" — an original mascot shaped like a speech bubble (the name means "can talk").
// Pure SVG + CSS animations (blink, float); mood changes the face.

export type Mood = "idle" | "listening" | "happy" | "worried" | "celebrate";

export default function Mascot({ mood = "idle", size = 48, float = false }: { mood?: Mood; size?: number; float?: boolean }) {
  const eyesClosedHappy = mood === "happy" || mood === "celebrate";
  return (
    <span className={`inline-block shrink-0 ${float ? "mascot-float" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* body: speech bubble */}
        <path
          d="M60 10c27 0 48 18 48 42s-21 42-48 42c-5 0-10-.6-14-1.8L24 106l5-20C18 78 12 66 12 52 12 28 33 10 60 10z"
          fill="var(--brand)"
        />
        <path d="M60 18c22 0 40 15 40 34" stroke="#fff" strokeOpacity=".22" strokeWidth="6" strokeLinecap="round" fill="none" />
        {/* little cross on the head (health) */}
        <g transform="translate(84 20)">
          <circle r="11" fill="#fff" />
          <path d="M-5 0h10M0 -5v10" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* cheeks */}
        <ellipse cx="36" cy="62" rx="7" ry="4.5" fill="#ff9aa2" opacity={mood === "worried" ? 0.35 : 0.75} />
        <ellipse cx="84" cy="62" rx="7" ry="4.5" fill="#ff9aa2" opacity={mood === "worried" ? 0.35 : 0.75} />
        {/* eyes */}
        {eyesClosedHappy ? (
          <g stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M38 50q7-8 14 0" />
            <path d="M68 50q7-8 14 0" />
          </g>
        ) : (
          <g className="mascot-eyes" fill="#fff">
            <ellipse cx="45" cy={mood === "listening" ? 46 : 49} rx="7" ry="8.5" />
            <ellipse cx="75" cy={mood === "listening" ? 46 : 49} rx="7" ry="8.5" />
            <circle cx={mood === "listening" ? 47 : 46} cy={mood === "listening" ? 43 : 50} r="3.6" fill="var(--ink)" />
            <circle cx={mood === "listening" ? 77 : 76} cy={mood === "listening" ? 43 : 50} r="3.6" fill="var(--ink)" />
          </g>
        )}
        {/* brows when worried */}
        {mood === "worried" && (
          <g stroke="#fff" strokeWidth="4" strokeLinecap="round">
            <path d="M37 40l14 -6" />
            <path d="M83 40l-14 -6" />
          </g>
        )}
        {/* mouth */}
        {mood === "worried" ? (
          <path d="M52 72q8-6 16 0" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        ) : mood === "listening" ? (
          <ellipse cx="60" cy="70" rx="5" ry="4" fill="#fff" />
        ) : mood === "celebrate" ? (
          <path d="M46 64q14 18 28 0z" fill="#fff" />
        ) : (
          <path d="M50 66q10 10 20 0" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        )}
        {mood === "celebrate" && (
          <g className="mascot-sparkle" fill="var(--amber)">
            <path d="M14 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
            <path d="M104 74l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          </g>
        )}
      </svg>
    </span>
  );
}
