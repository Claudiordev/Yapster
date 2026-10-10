/** Builds an SVG data URL so the seeded servers have real icon images without any asset files. */
function svgIcon(from: string, to: string, art: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="128" height="128" fill="url(#g)"/>${art}</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Crescent moon over a wine-red night sky. */
export const NIGHTFALL_ICON = svgIcon(
  "#ff5a6b",
  "#4a0a16",
  `<path d="M82 24a42 42 0 1 0 24 74A50 50 0 0 1 82 24z" fill="#fff"/>` +
    `<circle cx="34" cy="34" r="3.5" fill="#fff" opacity=".9"/><circle cx="100" cy="30" r="2.5" fill="#fff" opacity=".7"/>` +
    `<circle cx="24" cy="78" r="2.5" fill="#fff" opacity=".6"/>`,
);

/** Game controller on an orange arcade background. */
export const ARCADE_ICON = svgIcon(
  "#ffc56b",
  "#d6502f",
  `<rect x="22" y="44" width="84" height="46" rx="23" fill="#fff"/>` +
    `<rect x="40" y="58" width="8" height="20" rx="2" fill="#d6502f"/><rect x="34" y="64" width="20" height="8" rx="2" fill="#d6502f"/>` +
    `<circle cx="80" cy="60" r="5.5" fill="#d6502f"/><circle cx="92" cy="72" r="5.5" fill="#d6502f"/>`,
);
