// Brand mark — "Coin Day". A calendar (two binding tabs, a header rule) with a
// single filled coin sitting on one day = a date that costs money, which is
// exactly what the app tracks: commitments by their next due date. No
// typography. The card + header are the `body` colour; the coin-day is `accent`.
//
// Source of truth for every rendered icon. `mark()` returns inner SVG markup
// sized to a `size`x`size` viewBox, so callers drop it onto a clay plate, a
// sand page, or `currentColor` in React.
//
// All geometry derives from `u = size * ratio` (the card's half-width), so a
// smaller `ratio` shrinks the whole mark and buys safe-zone padding for
// maskable icons without changing its proportions.

export function mark(size, body, accent, ratio = 0.28) {
  const c = size / 2;
  const u = size * ratio;

  const sw = u * 0.187; // card / tab stroke
  const w = 2 * u;
  const h = 1.93 * u;
  const r = 0.227 * u; // card corner radius
  const x = c - u;
  const y = c - 0.8 * u;

  // Two binding tabs on top, overlapping the card edge so they read as joined.
  const tw = u * 0.22;
  const th = u * 0.36;
  const ty = y - u * 0.22;
  const tdx = u * 0.44;
  const tab = (dx) =>
    `<rect x="${(c + dx - tw / 2).toFixed(2)}" y="${ty.toFixed(2)}" width="${tw.toFixed(2)}" height="${th.toFixed(2)}" rx="${(tw / 2).toFixed(2)}" fill="${body}"/>`;

  // Header rule under the tabs (the calendar's month band).
  const hy = y + 0.52 * u;
  const header = `<line x1="${(x + sw).toFixed(2)}" y1="${hy.toFixed(2)}" x2="${(x + w - sw).toFixed(2)}" y2="${hy.toFixed(2)}" stroke="${body}" stroke-width="${(u * 0.147).toFixed(2)}"/>`;

  // The coin-day, seated in the lower half of the grid.
  const coinR = u * 0.4;
  const coinCy = c + 0.465 * u;
  const coin = `<circle cx="${c.toFixed(2)}" cy="${coinCy.toFixed(2)}" r="${coinR.toFixed(2)}" fill="${accent}"/>`;

  const card = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${r.toFixed(2)}" fill="none" stroke="${body}" stroke-width="${sw.toFixed(2)}"/>`;

  return `
    ${tab(-tdx)}
    ${tab(tdx)}
    ${card}
    ${header}
    ${coin}`;
}
