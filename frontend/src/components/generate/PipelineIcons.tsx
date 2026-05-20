/**
 * Custom animated SVG icons for the pipeline stages. Each accepts an `active`
 * flag — only the active stage animates, the rest hold their static frame.
 */

interface IconProps {
  active: boolean;
}

const STROKE = "#00F0FF";
const DIM = "rgba(168,168,179,0.5)";

export function CloneIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="2.5" stroke={c} strokeWidth="1.5" />
      <circle cx="6" cy="18" r="2.5" stroke={c} strokeWidth="1.5" />
      <circle cx="18" cy="12" r="2.5" stroke={c} strokeWidth="1.5" />
      <path
        d="M6 8.5v7M8.5 6h0c4 0 4 6 7 6"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={active ? "16" : "0"}
      >
        {active && (
          <animate
            attributeName="stroke-dashoffset"
            from="16"
            to="0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </svg>
  );
}

export function AnalyzeIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke={c} strokeWidth="1.5" />
      <line x1="3" x2="21" stroke={c} strokeWidth="1.5">
        {active ? (
          <>
            <animate attributeName="y1" values="6;18;6" dur="2s" repeatCount="indefinite" />
            <animate attributeName="y2" values="6;18;6" dur="2s" repeatCount="indefinite" />
          </>
        ) : (
          <>
            <set attributeName="y1" to="12" />
            <set attributeName="y2" to="12" />
          </>
        )}
      </line>
    </svg>
  );
}

export function MapIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="6" r="2" fill={c} />
      <circle cx="19" cy="6" r="2" fill={c} />
      <circle cx="12" cy="18" r="2" fill={c} />
      <path
        d="M5 6h14M5 6l7 12M19 6l-7 12"
        stroke={c}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        strokeDasharray={active ? "4 4" : "0"}
      >
        {active && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="8"
            dur="0.6s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </svg>
  );
}

export function ScriptIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h12l4 4v12H4z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 4v4h4" stroke={c} strokeWidth="1.5" />
      <line x1="7" y1="13" x2="14" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round">
        {active && (
          <animate attributeName="x2" values="7;16;7" dur="1.8s" repeatCount="indefinite" />
        )}
      </line>
      <line x1="7" y1="16" x2="11" y2="16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function VoiceIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {[4, 8, 12, 16, 20].map((x, i) => (
        <line key={x} x1={x} y1="12" x2={x} stroke={c} strokeWidth="1.6" strokeLinecap="round">
          {active ? (
            <animate
              attributeName="y2"
              values={`${12 - (i % 2 ? 6 : 3)};${12 + (i % 2 ? 6 : 3)};${12 - (i % 2 ? 6 : 3)}`}
              dur={`${0.6 + i * 0.12}s`}
              repeatCount="indefinite"
            />
          ) : (
            <set attributeName="y2" to={`${12 + (i % 2 ? 4 : 2)}`} />
          )}
        </line>
      ))}
    </svg>
  );
}

export function RenderIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke={c} strokeWidth="1.5" />
      <circle cx="7" cy="6" r="1" fill={c} />
      <circle cx="12" cy="6" r="1" fill={c} />
      <circle cx="17" cy="6" r="1" fill={c} />
      <circle cx="7" cy="18" r="1" fill={c} />
      <circle cx="12" cy="18" r="1" fill={c} />
      <circle cx="17" cy="18" r="1" fill={c} />
      <g style={{ transformOrigin: "12px 12px" }}>
        {active && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="3.6s"
            repeatCount="indefinite"
          />
        )}
        <path d="M12 9v6M9.4 10.5l5.2 3M9.4 13.5l5.2-3" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CheckIcon({ active }: IconProps) {
  const c = active ? STROKE : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5" />
      <path
        d="m8 12 3 3 5-6"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="14"
      >
        {active && (
          <animate
            attributeName="stroke-dashoffset"
            from="14"
            to="0"
            dur="0.6s"
            fill="freeze"
          />
        )}
      </path>
    </svg>
  );
}
