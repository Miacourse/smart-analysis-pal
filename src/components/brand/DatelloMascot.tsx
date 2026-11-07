// Datello — composant mascotte (React + TypeScript, prêt pour Lovable)
// Utilisation : <DatelloMascot mood="trouve" size={48} />
//   mood : "neutre" | "bonjour" | "reflechit" | "trouve" | "oups"
//   dark : true sur fond sombre (barre haute blanche)
//   animate : petite animation pendant "reflechit"

import * as React from "react";

export type DatelloMood = "neutre" | "bonjour" | "reflechit" | "trouve" | "oups";

const LABELS: Record<DatelloMood, string> = {
  neutre: "Datello",
  bonjour: "Datello vous salue",
  reflechit: "Datello réfléchit",
  trouve: "Datello a trouvé",
  oups: "Datello a rencontré un problème",
};

function Face({ mood, dark }: { mood: DatelloMood; dark: boolean }) {
  switch (mood) {
    case "neutre":
      return dark ? (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#6CC7B8"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#FFFFFF"/>
          <circle cx="95" cy="36" r="3.6" fill="#14213D"/>
          <circle cx="105" cy="36" r="3.6" fill="#14213D"/>
          <path d="M93 46 Q100 52 107 46" stroke="#F2A541" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#0B7A6B"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#14213D"/>
          <circle cx="95" cy="36" r="3.6" fill="#FFFFFF"/>
          <circle cx="105" cy="36" r="3.6" fill="#FFFFFF"/>
          <path d="M93 46 Q100 52 107 46" stroke="#F2A541" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
        </>
      );
    case "bonjour":
      return dark ? (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#6CC7B8"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#FFFFFF"/>
          <circle cx="95" cy="36" r="3.6" fill="#14213D"/>
          <circle cx="105" cy="36" r="3.6" fill="#14213D"/>
          <path d="M93 46 Q100 52 107 46" stroke="#F2A541" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
          <path d="M114 50 L128 30" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
          <circle cx="129" cy="28" r="5" fill="#FFFFFF"/>
          <path d="M134 16 Q139 22 136 30" stroke="#F2A541" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
          <path d="M122 14 Q127 12 131 15" stroke="#F2A541" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#0B7A6B"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#14213D"/>
          <circle cx="95" cy="36" r="3.6" fill="#FFFFFF"/>
          <circle cx="105" cy="36" r="3.6" fill="#FFFFFF"/>
          <path d="M93 46 Q100 52 107 46" stroke="#F2A541" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
          <path d="M114 50 L128 30" stroke="#14213D" strokeWidth="6" strokeLinecap="round"/>
          <circle cx="129" cy="28" r="5" fill="#14213D"/>
          <path d="M134 16 Q139 22 136 30" stroke="#F2A541" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
          <path d="M122 14 Q127 12 131 15" stroke="#F2A541" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
        </>
      );
    case "reflechit":
      return dark ? (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#6CC7B8"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#FFFFFF"/>
          <circle cx="97" cy="33" r="3.2" fill="#14213D"/>
          <circle cx="107" cy="33" r="3.2" fill="#14213D"/>
          <path d="M95 48 H105" stroke="#F2A541" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
          <circle cx="120" cy="26" r="2.6" fill="#9ADBD0"/>
          <circle cx="126" cy="15" r="3.8" fill="#9ADBD0"/>
          <circle cx="132" cy="1" r="7" fill="#9ADBD0"/>
        </>
      ) : (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#0B7A6B"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#14213D"/>
          <circle cx="97" cy="33" r="3.2" fill="#FFFFFF"/>
          <circle cx="107" cy="33" r="3.2" fill="#FFFFFF"/>
          <path d="M95 48 H105" stroke="#F2A541" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
          <circle cx="120" cy="26" r="2.6" fill="#9ADBD0"/>
          <circle cx="126" cy="15" r="3.8" fill="#9ADBD0"/>
          <circle cx="132" cy="1" r="7" fill="#9ADBD0"/>
        </>
      );
    case "trouve":
      return dark ? (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#6CC7B8"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#FFFFFF"/>
          <path d="M91 37 Q95 31 99 37" stroke="#14213D" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
          <path d="M101 37 Q105 31 109 37" stroke="#14213D" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
          <path d="M92 44 Q100 56 108 44 Z" fill="#F2A541"/>
          <path d="M128 -6 L131 2 L139 5 L131 8 L128 16 L125 8 L117 5 L125 2 Z" fill="#F2A541"/>
          <path d="M120 22 L121.5 26 L125.5 27.5 L121.5 29 L120 33 L118.5 29 L114.5 27.5 L118.5 26 Z" fill="#F2A541"/>
        </>
      ) : (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#0B7A6B"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#14213D"/>
          <path d="M91 37 Q95 31 99 37" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
          <path d="M101 37 Q105 31 109 37" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
          <path d="M92 44 Q100 56 108 44 Z" fill="#F2A541"/>
          <path d="M128 -6 L131 2 L139 5 L131 8 L128 16 L125 8 L117 5 L125 2 Z" fill="#F2A541"/>
          <path d="M120 22 L121.5 26 L125.5 27.5 L121.5 29 L120 33 L118.5 29 L114.5 27.5 L118.5 26 Z" fill="#F2A541"/>
        </>
      );
    case "oups":
      return dark ? (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#6CC7B8"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#FFFFFF"/>
          <path d="M91 32.5 L98 29.5" stroke="#14213D" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M109 32.5 L102 29.5" stroke="#14213D" strokeWidth="2.4" strokeLinecap="round"/>
          <circle cx="95" cy="38" r="3.4" fill="#14213D"/>
          <circle cx="105" cy="38" r="3.4" fill="#14213D"/>
          <circle cx="100" cy="49" r="3.2" stroke="#F2A541" strokeWidth="2.8" fill="none"/>
          <path d="M124 10 C124 10 130 18 130 22 A6 6 0 0 1 118 22 C118 18 124 10 124 10 Z" fill="#6CC7B8"/>
        </>
      ) : (
        <>
          <rect x="4" y="74" width="21" height="30" rx="8" fill="#9ADBD0"/>
          <rect x="31" y="58" width="21" height="46" rx="8" fill="#0F9D8A"/>
          <rect x="58" y="40" width="21" height="64" rx="8" fill="#0B7A6B"/>
          <rect x="85" y="16" width="30" height="88" rx="10" fill="#14213D"/>
          <path d="M91 32.5 L98 29.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M109 32.5 L102 29.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round"/>
          <circle cx="95" cy="38" r="3.4" fill="#FFFFFF"/>
          <circle cx="105" cy="38" r="3.4" fill="#FFFFFF"/>
          <circle cx="100" cy="49" r="3.2" stroke="#F2A541" strokeWidth="2.8" fill="none"/>
          <path d="M124 10 C124 10 130 18 130 22 A6 6 0 0 1 118 22 C118 18 124 10 124 10 Z" fill="#6CC7B8"/>
        </>
      );
  }
}

export function DatelloMascot({
  mood = "neutre",
  dark = false,
  size = 48,
  animate = true,
  className,
}: {
  mood?: DatelloMood;
  dark?: boolean;
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  const wide = mood !== "neutre";
  const viewBox = wide ? "-6 -12 150 128" : "-4 6 128 108";
  const ratio = wide ? 128 / 150 : 108 / 128;
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={Math.round(size * ratio)}
      role="img"
      aria-label={LABELS[mood]}
      className={[
        className,
        animate && mood === "reflechit" ? "motion-safe:animate-pulse" : "",
      ].filter(Boolean).join(" ")}
    >
      <Face mood={mood} dark={dark} />
    </svg>
  );
}

export default DatelloMascot;
