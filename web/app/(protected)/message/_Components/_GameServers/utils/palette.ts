// Ported from the game-servers design, remapped to our palette (styles/colors.css).
// The red-accent ramp → our brand; the deep shade is `brand-deep` (#7d1d24) — the
// colour of an active/selected chat row. Status colours (online/idle/offline) keep
// their semantic meaning.
export const C = {
  bg:    "#2b2d31", // surface-sidebar (page background)
  surf:  "#313338", // surface-chat (card surface)
  surf2: "#3a3c42", // slightly lighter surface
  red:   "#ff3b47", // brand — our active accent
  redD:  "#7d1d24", // brand-deep — the active-chat row colour
  redM:  "#e62d3a", // brand-hover
  redL:  "#ff6b73", // lighter brand tint
  w:     "#FFFFFF",
  gi:    "#B0B4BC",
  gm:    "#8C8C9A",
  ga:    "#4E5058",
  bd:    "#3f4147", // surface-border
  online: "#23A55A",
  idle:   "#F0B232",
  offline:"#80848E",
};
