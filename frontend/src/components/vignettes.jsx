// Small drawn scenes for panels. These are vectors, not crops of the concept paintings.

const sky = (
  <>
    <rect width="160" height="100" rx="8" fill="#14204f" />
    <circle cx="132" cy="18" r="8" fill="#f4edd4" />
    <circle cx="128" cy="16" r="7" fill="#14204f" />
  </>
)
const cloud = (x, y, w) => (
  <ellipse cx={x} cy={y} rx={w} ry={w * 0.38} fill="#f7f4ff" />
)

function Island({ cx = 80, cy = 62, rock = '#5a62b8', grass = '#6fbf6a', children }) {
  return (
    <g>
      <path d={`M${cx - 46} ${cy} Q${cx} ${cy + 38} ${cx + 46} ${cy} L${cx + 34} ${cy + 22} Q${cx} ${cy + 48} ${cx - 34} ${cy + 22} Z`} fill={rock} />
      <ellipse cx={cx} cy={cy} rx="46" ry="18" fill={grass} />
      <ellipse cx={cx - 10} cy={cy - 4} rx="16" ry="6" fill="#c6e98a" opacity="0.55" />
      {children}
    </g>
  )
}

function Cottage({ x, y, roof = '#d15a3a' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points="0,10 18,16 18,-2 0,-8" fill="#f6efe2" />
      <polygon points="0,10 -16,16 -16,-2 0,-8" fill="#e4d2b0" />
      <polygon points="-18,-4 0,-14 18,-4 0,2" fill={roof} />
      <rect x="6" y="2" width="4" height="5" fill="#ffe7a0" />
    </g>
  )
}

function Tree({ x, y, pine = false }) {
  return pine ? (
    <polygon points={`${x},${y - 16} ${x + 7},${y} ${x - 7},${y}`} fill="#2f6a48" />
  ) : (
    <g>
      <rect x={x - 1} y={y - 6} width="2" height="6" fill="#6b4426" />
      <circle cx={x} cy={y - 10} r="6" fill="#3f9a5c" />
    </g>
  )
}

const SCENES = {
  shelter: (<>{sky}<Island><Cottage x={78} y={50} /><Tree x={48} y={64} /><Tree x={112} y={66} /></Island>{cloud(30, 82, 22)}</>),
  bridgeAnchor: (<>{sky}<Island><rect x="62" y="48" width="36" height="8" rx="1" fill="#c48a4a" /><rect x="66" y="38" width="3" height="14" fill="#6b3e22" /><rect x="91" y="38" width="3" height="14" fill="#6b3e22" /></Island></>),
  waterCollector: (<>{sky}<Island grass="#7ec8a0"><ellipse cx="80" cy="52" rx="16" ry="7" fill="#7ee7f4" stroke="#f0d48a" /><path d="M96 54 v16" stroke="#bfefff" strokeWidth="3" /></Island></>),
  garden: (<>{sky}<Island><rect x="58" y="50" width="44" height="12" fill="#7a5236" />{[0, 1, 2, 3].map((i) => <circle key={i} cx={64 + i * 10} cy={52} r="3" fill={i % 2 ? '#7cc96a' : '#e3b84f'} />)}</Island></>),
  solarFarm: (<>{sky}<Island><g transform="translate(70 46)"><polygon points="0,8 28,14 28,4 0,-2" fill="#2456c8" stroke="#f0d48a" /><polygon points="0,8 -8,12 -8,2 0,-2" fill="#1a3c90" /></g></Island></>),
  windTurbine: (<>{sky}<Island><rect x="78" y="28" width="3" height="28" fill="#f4efe6" /><polygon points="80,28 84,8 78,10" fill="#f2e3c0" /><polygon points="80,28 96,32 94,36" fill="#e7d3a4" /></Island></>),
  storageHouse: (<>{sky}<Island><Cottage x={80} y={50} roof="#9a6a3e" /></Island></>),
  market: (<>{sky}<Island><rect x="60" y="52" width="40" height="8" fill="#c48a4a" /><polygon points="56,50 80,40 104,50 80,56" fill="#d9534f" /></Island></>),
  clinic: (<>{sky}<Island><rect x="62" y="42" width="36" height="16" fill="#fbf8f2" /><polygon points="58,42 80,32 102,42" fill="#4c78c8" /><rect x="76" y="44" width="8" height="3" fill="#e04545" /><rect x="78.5" y="41" width="3" height="8" fill="#e04545" /></Island></>),
  battery: (<>{sky}<Island><polygon points="80,34 90,50 86,62 74,62 70,50" fill="#c6a8ff" stroke="#f3eaff" /></Island></>),
  communityHall: (<>{sky}<Island><Cottage x={80} y={52} roof="#3a62c4" /><rect x="86" y="30" width="4" height="12" fill="#e7d3a4" /></Island></>),
  newHaven: (<>{sky}<Island><rect x="76" y="28" width="8" height="28" fill="#f6efe0" /><circle cx="80" cy="24" r="6" fill="#fff6c8" stroke="#e3c27a" /><circle cx="80" cy="24" r="10" fill="none" stroke="#f0d48a" /></Island></>),
  rain: (<>{sky}<Island grass="#8fd0b0"><ellipse cx="68" cy="50" rx="12" ry="6" fill="#5ad4ea" /><ellipse cx="96" cy="54" rx="10" ry="5" fill="#7ee7f4" /><path d="M80 58 v14" stroke="#d8f7ff" strokeWidth="3" /></Island></>),
  verdant: (<>{sky}<Island grass="#3f8a48"><Tree x={58} y={60} pine /><Tree x={74} y={58} pine /><Tree x={100} y={62} pine /><Cottage x={86} y={52} roof="#c48a4a" /></Island></>),
  mistral: (<>{sky}<Island><rect x="58" y="48" width="22" height="8" fill="#2456c8" stroke="#f0d48a" /><rect x="96" y="30" width="3" height="26" fill="#f4efe6" /><polygon points="97,30 104,16 94,18" fill="#f2e3c0" /></Island></>),
  mercy: (<>{sky}<Island><rect x="64" y="44" width="34" height="14" fill="#fbf8f2" /><polygon points="60,44 81,34 102,44" fill="#4c78c8" /><rect x="78" y="46" width="7" height="2.5" fill="#e04545" /><rect x="80" y="43.5" width="2.5" height="7" fill="#e04545" /></Island></>),
  hearth: (<>{sky}<Island><Cottage x={62} y={52} roof="#8a6ad8" /><Cottage x={88} y={50} roof="#d15a3a" /><Tree x={112} y={64} /></Island></>),
  gardens: (<>{sky}<Island><rect x="64" y="46" width="34" height="14" rx="8" fill="#bfefff" opacity="0.7" stroke="#eaf6ff" /><rect x="70" y="56" width="28" height="6" fill="#7a5236" /></Island></>),
  skyport: (<>{sky}<Island rock="#6a5438" grass="#c4a574"><rect x="58" y="52" width="48" height="6" fill="#a8743f" /><ellipse cx="108" cy="40" rx="18" ry="8" fill="#fff" stroke="#c9a24f" /><polygon points="124,36 132,40 124,44" fill="#2c4fb0" /></Island></>),
  uncharted: (
    <>
      {sky}
      {cloud(50, 62, 28)}
      {cloud(100, 58, 36)}
      {cloud(78, 78, 22)}
    </>
  ),
  log: (
    <>
      <rect width="160" height="110" fill="#d7ecff" />
      <ellipse cx="30" cy="78" rx="28" ry="10" fill="#fff" />
      <ellipse cx="80" cy="70" rx="34" ry="12" fill="#fff" />
      <ellipse cx="126" cy="82" rx="26" ry="10" fill="#fff" />
      <ellipse cx="80" cy="62" rx="22" ry="8" fill="#7dca72" />
      <rect x="76" y="40" width="6" height="20" fill="#f6efe0" />
      <circle cx="79" cy="36" r="5" fill="#fff6c8" stroke="#e3c27a" />
      <path d="M80 70 v18" stroke="#bfefff" strokeWidth="3" />
    </>
  ),
}

export default function Vignette({ kind, className = '' }) {
  const scene = SCENES[kind] || SCENES.newHaven
  return (
    <svg className={`vignette ${className}`} viewBox="0 0 160 100" role="img" aria-hidden="true">
      {scene}
    </svg>
  )
}
