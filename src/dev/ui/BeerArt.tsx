/**
 * SVG drawings of a beer serving: a 330 ml can, a long-neck bottle or a bia hơi
 * glass ("cốc vại"). Real proportions, cylindrical shading, condensation and see-
 * through glass make them read as real objects. Colours and two plain label lines
 * come from the catalogue entry; labels are our own design, not the brands' logos.
 *
 * All drawings share a 100 × 200 viewBox with the base at y ≈ 192.
 */
import React from 'react';
import type { Beer } from '../../game/beerCatalog';

/** Deterministic pseudo-random numbers, so droplets don't jump between renders. */
function seeded(text: string) {
  let s = 0;
  for (const ch of text) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Light falling on a cylinder from the front-left: dark rim, hot streak, soft fall-off. */
const CylinderShade: React.FC<{ id: string; strength?: number }> = ({ id, strength = 1 }) => (
  <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stopColor="#000" stopOpacity={0.55 * strength} />
    <stop offset="0.1" stopColor="#000" stopOpacity={0.15 * strength} />
    <stop offset="0.24" stopColor="#fff" stopOpacity={0.55 * strength} />
    <stop offset="0.3" stopColor="#fff" stopOpacity={0.12 * strength} />
    <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
    <stop offset="0.78" stopColor="#000" stopOpacity={0.12 * strength} />
    <stop offset="0.9" stopColor="#fff" stopOpacity={0.12 * strength} />
    <stop offset="1" stopColor="#000" stopOpacity={0.6 * strength} />
  </linearGradient>
);

/** Water droplets scattered inside a rectangle (condensation on a cold drink). */
const Condensation: React.FC<{ id: string; x: number; y: number; w: number; h: number; count: number; clip?: string; mist?: number }> = ({
  id,
  x,
  y,
  w,
  h,
  count,
  clip,
  mist = 0.06,
}) => {
  const random = seeded(id);
  const drops = Array.from({ length: count }, () => ({
    cx: x + random() * w,
    cy: y + random() * h,
    r: 0.5 + random() * random() * 1.8,
    long: random() < 0.15,
  }));
  return (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <defs>
        <radialGradient id={`drop-${id}`} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      {/* Fine mist */}
      <rect x={x} y={y} width={w} height={h} fill="#fff" opacity={mist} />
      {drops.map((d, i) =>
        d.long ? (
          <path
            key={i}
            d={`M${d.cx} ${d.cy} q ${d.r} ${d.r * 3} 0 ${d.r * 6} q ${-d.r} ${-d.r * 3} 0 ${-d.r * 6}`}
            fill={`url(#drop-${id})`}
          />
        ) : (
          <ellipse key={i} cx={d.cx} cy={d.cy} rx={d.r} ry={d.r * 1.15} fill={`url(#drop-${id})`} />
        )
      )}
    </g>
  );
};

/** Generic round badge with a star (our own mark, not a brand emblem). */
const Medallion: React.FC<{ cx: number; cy: number; r: number; fill: string; ring: string }> = ({ cx, cy, r, fill, ring }) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.28 : r * 0.62;
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
  }).join(' ');
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={ring} strokeWidth={r * 0.18} />
      <polygon points={points} fill={ring} />
    </g>
  );
};

// ---------------------------------------------------------------- can (330 ml)

function Can({ beer }: { beer: Beer }) {
  const id = beer.id;
  const { body, accent, stripe, ink } = beer.art;
  // 66 mm × 115 mm → 60 × 104 in our units.
  const L = 20;
  const R = 80;
  const top = 78;
  const bottom = 186;
  const silhouette = `M${L} ${top + 8} Q${L} ${top} ${L + 7} ${top - 4} L${L + 9} ${top - 9} L${R - 9} ${top - 9} L${R - 7} ${top - 4} Q${R} ${top} ${R} ${top + 8} L${R} ${bottom - 4} Q${R} ${bottom + 2} ${R - 6} ${bottom + 4} L${L + 6} ${bottom + 4} Q${L} ${bottom + 2} ${L} ${bottom - 4} Z`;
  return (
    <>
      <defs>
        <CylinderShade id={`shade-${id}`} />
        <clipPath id={`clip-${id}`}>
          <path d={silhouette} />
        </clipPath>
        <linearGradient id={`lid-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#6b7280" />
          <stop offset="0.3" stopColor="#f1f5f9" />
          <stop offset="0.6" stopColor="#9ca3af" />
          <stop offset="1" stopColor="#4b5563" />
        </linearGradient>
      </defs>
      {/* Shadow on the table */}
      <ellipse cx="50" cy={bottom + 5} rx="34" ry="4" fill="#000" opacity="0.45" />
      {/* Body paint */}
      <g clipPath={`url(#clip-${id})`}>
        <rect x={L} y={top - 10} width={R - L} height={bottom - top + 16} fill={body} />
        {/* Label band with trim */}
        <rect x={L} y={top + 22} width={R - L} height="48" fill={accent} />
        <rect x={L} y={top + 19} width={R - L} height="3" fill={stripe} />
        <rect x={L} y={top + 70} width={R - L} height="3" fill={stripe} />
        <Medallion cx={50} cy={top + 12} r={6.5} fill={accent} ring={stripe} />
        <text x="50" y={top + 46} textAnchor="middle" fontSize="15" fontWeight={900} fill={ink} letterSpacing="0.5" style={{ fontFamily: 'Georgia, serif' }}>
          {beer.art.label[0]}
        </text>
        <text x="50" y={top + 59} textAnchor="middle" fontSize="6.4" fontWeight={800} fill={ink} letterSpacing="1.2">
          {beer.art.label[1]}
        </text>
        <text x="50" y={bottom - 12} textAnchor="middle" fontSize="5.2" fontWeight={700} fill={accent} opacity="0.9">
          {beer.volumeMl} ml • {beer.abv}% vol
        </text>
        {/* Bottom dome ring */}
        <rect x={L} y={bottom - 3} width={R - L} height="8" fill={`url(#lid-${id})`} />
        <rect x={L} y={top - 10} width={R - L} height={bottom - top + 16} fill={`url(#shade-${id})`} />
      </g>
      {/* Lid: rim, recessed panel, rivet and pull tab */}
      <ellipse cx="50" cy={top - 9} rx={(R - L) / 2 - 9} ry="3.4" fill={`url(#lid-${id})`} />
      <ellipse cx="50" cy={top - 9} rx={(R - L) / 2 - 11} ry="2.4" fill="#cbd5e1" />
      <ellipse cx="50" cy={top - 9.2} rx={(R - L) / 2 - 12.5} ry="1.8" fill="#94a3b8" opacity="0.6" />
      <path d={`M45 ${top - 10.6} h10 a2 1.2 0 0 1 0 2.4 h-10 a2 1.2 0 0 1 0 -2.4 Z`} fill="#e2e8f0" stroke="#64748b" strokeWidth="0.4" />
      <ellipse cx="48" cy={top - 9.4} rx="1.6" ry="0.7" fill="#64748b" />
      <Condensation id={`can-${id}`} x={L} y={top} w={R - L} h={bottom - top} count={70} clip={`clip-${id}`} />
    </>
  );
}

// ---------------------------------------------------------------- bottle (330 ml long neck)

function Bottle({ beer }: { beer: Beer }) {
  const id = beer.id;
  const { body, accent, stripe, ink } = beer.art;
  const outline =
    'M44.5 16 L55.5 16 L56 22 L56.5 58 Q57 70 64 80 Q71 90 71 104 L71 184 Q71 192 63 192 L37 192 Q29 192 29 184 L29 104 Q29 90 36 80 Q43 70 43.5 58 L44 22 Z';
  const labelTop = 120;
  const labelBottom = 168;
  return (
    <>
      <defs>
        <CylinderShade id={`shade-${id}`} />
        <clipPath id={`clip-${id}`}>
          <path d={outline} />
        </clipPath>
        <linearGradient id={`glass-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={body} stopOpacity="0.8" />
          <stop offset="1" stopColor={body} />
        </linearGradient>
        <linearGradient id={`beer-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`cap-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#6b7280" />
          <stop offset="0.35" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#4b5563" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="194" rx="25" ry="3.5" fill="#000" opacity="0.45" />
      <g clipPath={`url(#clip-${id})`}>
        {/* Tinted glass, the beer inside (filled to the neck), and the air gap above */}
        <rect x="20" y="10" width="60" height="190" fill={`url(#glass-${id})`} />
        <rect x="20" y="40" width="60" height="160" fill={`url(#beer-${id})`} />
        <rect x="20" y="38.5" width="60" height="1.5" fill="#fff" opacity="0.25" />
        {/* Neck foil with a zigzag lower edge */}
        <path
          d={`M40 16 L60 16 L60 44 ${Array.from({ length: 8 }, (_, i) => `L${60 - (i + 0.5) * 2.5} ${i % 2 ? 44 : 47}`).join(' ')} L40 44 Z`}
          fill={stripe}
        />
        <rect x="40" y="26" width="20" height="5" fill={accent} />
        {/* Small shoulder label */}
        <ellipse cx="50" cy="82" rx="9" ry="6" fill={accent} stroke={stripe} strokeWidth="1" />
        <text x="50" y="84" textAnchor="middle" fontSize="4" fontWeight={900} fill={ink}>
          {beer.art.label[0]}
        </text>
        {/* Body label, curved top and bottom edges to sit on the cylinder */}
        <path
          d={`M29 ${labelTop} Q50 ${labelTop + 4} 71 ${labelTop} L71 ${labelBottom} Q50 ${labelBottom + 4} 29 ${labelBottom} Z`}
          fill={accent}
        />
        <path d={`M29 ${labelTop + 3} Q50 ${labelTop + 7} 71 ${labelTop + 3}`} stroke={stripe} strokeWidth="1.6" fill="none" />
        <path d={`M29 ${labelBottom - 3} Q50 ${labelBottom + 1} 71 ${labelBottom - 3}`} stroke={stripe} strokeWidth="1.6" fill="none" />
        <Medallion cx={50} cy={labelTop + 13} r={5.5} fill={accent} ring={stripe} />
        <text
          x="50"
          y={labelTop + 31}
          textAnchor="middle"
          fontSize={beer.art.label[0].length > 5 ? 8.6 : 11}
          fontWeight={900}
          fill={ink}
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {beer.art.label[0]}
        </text>
        <text x="50" y={labelTop + 39} textAnchor="middle" fontSize="4.4" fontWeight={800} fill={ink} letterSpacing="0.5">
          {beer.art.label[1]}
        </text>
        <text x="50" y={labelBottom - 6} textAnchor="middle" fontSize="3.6" fontWeight={700} fill={ink} opacity="0.85">
          {beer.volumeMl} ml • {beer.abv}% vol
        </text>
        {/* Glass shading, a sharp window reflection and the thick base */}
        <rect x="20" y="10" width="60" height="190" fill={`url(#shade-${id})`} />
        <rect x="35" y="88" width="2.2" height="96" rx="1.1" fill="#fff" opacity="0.5" />
        <rect x="38.5" y="96" width="0.8" height="80" fill="#fff" opacity="0.3" />
        <rect x="20" y="186" width="60" height="8" fill="#000" opacity="0.35" />
      </g>
      {/* Crown cap with a crimped skirt */}
      <path
        d={`M43.2 16 ${Array.from({ length: 11 }, (_, i) => `L${43.2 + i * 1.36} ${i % 2 ? 17.6 : 16}`).join(' ')} L57 16 L56.6 10.5 Q50 8.6 43.4 10.5 Z`}
        fill={`url(#cap-${id})`}
      />
      <ellipse cx="50" cy="10.4" rx="6.6" ry="1.3" fill={stripe} />
      <Condensation id={`bottle-${id}`} x={29} y={60} w={42} h={128} count={60} clip={`clip-${id}`} />
    </>
  );
}

// ---------------------------------------------------------------- bia hơi glass (cốc vại)

function Glass({ beer }: { beer: Beer }) {
  const id = beer.id;
  const { body, accent, stripe } = beer.art;
  // Thick, slightly green recycled glass, tapering a little toward the base.
  const outer = 'M22 44 L78 44 L74.5 186 Q74 192 68 192 L32 192 Q26 192 25.5 186 Z';
  const inner = 'M25.5 47 L74.5 47 L71.3 172 L28.7 172 Z';
  const random = seeded(id + 'glass');
  return (
    <>
      <defs>
        <CylinderShade id={`shade-${id}`} strength={0.8} />
        <clipPath id={`clip-${id}`}>
          <path d={outer} />
        </clipPath>
        <clipPath id={`inner-${id}`}>
          <path d={inner} />
        </clipPath>
        <linearGradient id={`beer-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f5b829" />
          <stop offset="0.45" stopColor={body} />
          <stop offset="1" stopColor="#9a4f08" />
        </linearGradient>
        <radialGradient id={`foam-${id}`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor={accent} />
          <stop offset="1" stopColor="#e7dcc3" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="194" rx="30" ry="4" fill="#000" opacity="0.45" />
      {/* Beer and rising bubbles inside the inner wall */}
      <g clipPath={`url(#inner-${id})`}>
        <rect x="20" y="58" width="60" height="120" fill={`url(#beer-${id})`} />
        {Array.from({ length: 14 }, (_, i) => {
          const x = 30 + random() * 40;
          const r = 0.5 + random() * 0.9;
          const dur = 1.8 + random() * 2.2;
          return (
            <circle key={i} cx={x} cy="170" r={r} fill="#fff7d6" opacity="0.75">
              <animate attributeName="cy" from="172" to="60" dur={`${dur}s`} begin={`${random() * dur}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>
      {/* Glass: green tint, thick base, embedded seeds (air bubbles) of recycled glass */}
      <g clipPath={`url(#clip-${id})`}>
        <path d={outer} fill={stripe} fillOpacity="0.12" />
        <rect x="20" y="172" width="60" height="22" fill={stripe} fillOpacity="0.55" />
        <rect x="20" y="172" width="60" height="2" fill="#fff" opacity="0.35" />
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={24 + random() * 52} cy={50 + random() * 140} r={0.3 + random() * 0.7} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.3" />
        ))}
        <rect x="20" y="40" width="60" height="160" fill={`url(#shade-${id})`} opacity="0.7" />
        <rect x="30" y="52" width="2.6" height="130" rx="1.3" fill="#fff" opacity="0.4" />
        <rect x="67" y="56" width="1.4" height="120" rx="0.7" fill="#fff" opacity="0.25" />
      </g>
      <path d={outer} fill="none" stroke="#e8f5ec" strokeOpacity="0.6" strokeWidth="1.2" />
      {/* Foam head, slightly spilling over the rim */}
      <path
        d="M22.5 60 Q20 50 26 46 Q24 37 34 37 Q38 30 47 33 Q53 28 60 33 Q69 30 71 38 Q80 39 77.5 48 Q80 55 77 60 Q50 64 22.5 60 Z"
        fill={`url(#foam-${id})`}
      />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={28 + random() * 44} cy={38 + random() * 18} r={0.6 + random() * 1.4} fill="none" stroke="#d6c7a5" strokeOpacity="0.6" strokeWidth="0.4" />
      ))}
      <path d="M77.2 56 Q79.5 64 77.8 70 Q76.6 66 76.6 60 Z" fill={accent} />
      <ellipse cx="50" cy="44.5" rx="28" ry="2.2" fill="none" stroke="#f0fdf4" strokeOpacity="0.7" strokeWidth="1" />
      <Condensation id={`glass-${id}`} x={24} y={64} w={52} h={110} count={60} clip={`clip-${id}`} mist={0.02} />
    </>
  );
}

export const BeerArt: React.FC<{ beer: Beer; className?: string }> = ({ beer, className }) => (
  <svg viewBox="0 0 100 200" className={className} role="img" aria-label={`${beer.name} (${beer.format})`}>
    {beer.format === 'lon' && <Can beer={beer} />}
    {beer.format === 'chai' && <Bottle beer={beer} />}
    {beer.format === 'ly' && <Glass beer={beer} />}
  </svg>
);
