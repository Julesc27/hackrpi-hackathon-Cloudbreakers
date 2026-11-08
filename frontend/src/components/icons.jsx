// Small inline SVG icon set. Each icon takes `size` and passes other props through.
const I = ({ size = 24, children, vb = '0 0 24 24', ...p }) => (
  <svg width={size} height={size} viewBox={vb} aria-hidden="true" {...p}>{children}</svg>
)

export const Bolt = (p) => (
  <I {...p}><path d="M13.5 2 5 13.2h5.6L9.4 22 19 9.8h-5.7L13.5 2z" fill="#f6cf4b" stroke="#b8862a" strokeWidth="1" strokeLinejoin="round" /></I>
)
export const Drop = (p) => (
  <I {...p}><path d="M12 2.5c3.8 5 6.2 8.3 6.2 11.4a6.2 6.2 0 0 1-12.4 0C5.8 10.8 8.2 7.5 12 2.5z" fill="#4db4ff" stroke="#1f6fb3" strokeWidth="1" /><path d="M9 14.5a3 3 0 0 0 2.5 3" stroke="#d7efff" strokeWidth="1.4" fill="none" strokeLinecap="round" /></I>
)
export const Smile = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9.5" fill="#f5d36b" stroke="#b58b2b" /><circle cx="9" cy="10" r="1.3" fill="#5b3d10" /><circle cx="15" cy="10" r="1.3" fill="#5b3d10" /><path d="M8 14c1.8 2.4 6.2 2.4 8 0" stroke="#5b3d10" strokeWidth="1.5" fill="none" strokeLinecap="round" /></I>
)
export const Wheat = (p) => (
  <I {...p}><path d="M12 22V8" stroke="#a5d47b" strokeWidth="1.6" strokeLinecap="round" />{[0, 1, 2].map((i) => (<g key={i}><ellipse cx="9.5" cy={9 + i * 4} rx="2.4" ry="1.4" transform={`rotate(-35 9.5 ${9 + i * 4})`} fill="#86cf6a" /><ellipse cx="14.5" cy={9 + i * 4} rx="2.4" ry="1.4" transform={`rotate(35 14.5 ${9 + i * 4})`} fill="#86cf6a" /></g>))}<ellipse cx="12" cy="5.5" rx="1.5" ry="2.6" fill="#a5d47b" /></I>
)
export const Log = (p) => (
  <I {...p}><rect x="3" y="8" width="16" height="9" rx="4.5" fill="#c98d55" stroke="#7a4d26" /><ellipse cx="18.5" cy="12.5" rx="3" ry="4.5" fill="#e8c08a" stroke="#7a4d26" /><ellipse cx="18.5" cy="12.5" rx="1.3" ry="2" fill="none" stroke="#a87445" /><path d="M6 11h7M7 14h5" stroke="#8a5a2e" strokeLinecap="round" /></I>
)
export const Coin = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9.5" fill="#f4c34f" stroke="#a87d1e" /><circle cx="12" cy="12" r="6.5" fill="none" stroke="#c99a2e" /><path d="m12 8.3 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="#fff1c2" /></I>
)
export const People = (p) => (
  <I {...p}><circle cx="9" cy="8" r="3.2" fill="#cfd8ff" /><path d="M3 19c.5-4 3-6 6-6s5.5 2 6 6z" fill="#cfd8ff" /><circle cx="16.5" cy="9" r="2.6" fill="#9fb0ef" /><path d="M14 13.5c3.6-.6 6.3 1.4 6.8 5.5h-4.3" fill="#9fb0ef" /></I>
)
export const Leaf = (p) => (
  <I {...p}><path d="M5 19C5 10 10 5 20 4c0 9-5 15-13 15z" fill="#7fe0a4" stroke="#2d8a57" /><path d="M5 19 14 10" stroke="#2d8a57" strokeWidth="1.3" strokeLinecap="round" /></I>
)
export const Scroll = (p) => (
  <I {...p}><path d="M6 4h11a2 2 0 0 1 2 2v12H8a2 2 0 0 1-2-2z" fill="#f1e2bd" stroke="#8a6a35" /><path d="M6 4a2 2 0 0 0-2 2v1.5h2M8 18a2 2 0 1 1-2-2" fill="#e4cf9c" stroke="#8a6a35" /><path d="M9.5 8h6M9.5 11h6M9.5 14h4" stroke="#a08250" strokeLinecap="round" /></I>
)
export const Hammer = (p) => (
  <I {...p}><path d="m13.5 9.5-9 9 2 2 9-9" fill="#c98d55" stroke="#6b4426" strokeLinejoin="round" /><path d="m11 5 3-2.5 6.5 6.5-2.5 3-2-2-1.5 1.5-3-3L13 7z" fill="#b9c6e8" stroke="#4d5d8a" strokeLinejoin="round" /></I>
)
export const CloudIcon = (p) => (
  <I {...p}><path d="M7 18.5a4.5 4.5 0 0 1-.6-9 5.6 5.6 0 0 1 10.8 1.3 3.9 3.9 0 0 1-.4 7.7z" fill="#e9f1ff" stroke="#8fb3ea" /><path d="M8.5 17a3 3 0 0 1 0-5.5" stroke="#bcd3f7" fill="none" strokeLinecap="round" /></I>
)
export const HouseIcon = (p) => (
  <I {...p}><path d="M3.5 11 12 4l8.5 7" fill="none" stroke="#e3c27a" strokeWidth="1.6" strokeLinejoin="round" /><path d="M6 10v9.5h12V10L12 5z" fill="#f1e2bd" stroke="#8a6a35" /><rect x="10" y="13.5" width="4" height="6" fill="#7a4d26" /><rect x="7.5" y="11.5" width="2" height="2" fill="#ffd66b" /><rect x="14.5" y="11.5" width="2" height="2" fill="#ffd66b" /></I>
)
export const Compass = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9.5" fill="#1b2766" stroke="#e3c27a" strokeWidth="1.4" /><path d="M12 4.5 14 12l-2 7.5L10 12z" fill="#e3c27a" /><path d="M4.5 12 12 10l7.5 2-7.5 2z" fill="#9fb0ef" /><circle cx="12" cy="12" r="1.4" fill="#fff" /></I>
)
export const Book = (p) => (
  <I {...p}><path d="M12 6.5C9.5 4.8 6.5 4.5 3 5v13c3.5-.5 6.5-.2 9 1.5 2.5-1.7 5.5-2 9-1.5V5c-3.5-.5-6.5-.2-9 1.5z" fill="#f1e2bd" stroke="#8a6a35" strokeLinejoin="round" /><path d="M12 6.5v13" stroke="#8a6a35" /><path d="M5.5 9h4M5.5 12h4M14.5 9h4M14.5 12h4" stroke="#b49a68" strokeLinecap="round" /></I>
)
export const Crate = (p) => (
  <I {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="1" fill="#c98d55" stroke="#6b4426" /><path d="M3.5 4.5l17 15M20.5 4.5l-17 15" stroke="#8a5a2e" strokeWidth="1.4" /><rect x="3.5" y="4.5" width="17" height="15" rx="1" fill="none" stroke="#6b4426" strokeWidth="1.5" /></I>
)
export const Shop = (p) => (
  <I {...p}><path d="M4.5 10.5v9h15v-9" fill="#f1e2bd" stroke="#8a6a35" strokeLinejoin="round" /><path d="M3 6.5 4.5 3.5h15L21 6.5v1.5a2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0z" fill="#e3c27a" stroke="#8a6a35" strokeLinejoin="round" /><path d="M7.5 6.5v1.5M12 6.5v1.5M16.5 6.5v1.5" stroke="#c98d55" strokeLinecap="round" /><rect x="10" y="13.5" width="4" height="6" fill="#7a4d26" /><circle cx="7.5" cy="14.5" r="1.4" fill="#f4c34f" stroke="#a87d1e" strokeWidth=".6" /></I>
)
export const Lantern = (p) => (
  <I {...p}><path d="M9 4.5h6M12 2.5v2" stroke="#8a6a35" strokeWidth="1.4" strokeLinecap="round" /><path d="M7.5 7.5h9l-1 11h-7z" fill="#2a3a6e" stroke="#e3c27a" strokeLinejoin="round" /><path d="M7 7.5h10M7.5 18.5h9" stroke="#e3c27a" strokeWidth="1.6" strokeLinecap="round" /><path d="M12 9.5c2 2.2 2.4 3.8 2.4 4.9a2.4 2.4 0 0 1-4.8 0c0-1.1.4-2.7 2.4-4.9z" fill="#b8a4f2" /><path d="M12 12.3c.9 1 1.1 1.7 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.5.2-1.2 1.1-2.2z" fill="#f3eeff" /><path d="M10 21h4" stroke="#8a6a35" strokeWidth="1.4" strokeLinecap="round" /></I>
)
export const Gear = (p) => (
  <I {...p}><path fill="#c9d3f5" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.3 2.5h4l.4-2.5c.6-.3 1.1-.6 1.7-1l2.4 1 2-3.4zM12 15.3a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6z" /></I>
)
export const Lock = (p) => (
  <I {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" fill="#e3c27a" stroke="#8a6a35" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#e3c27a" strokeWidth="2" /><circle cx="12" cy="15.5" r="1.6" fill="#5b4420" /></I>
)
export const Plus = (p) => (
  <I {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></I>
)
export const Close = (p) => (
  <I {...p}><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></I>
)
export const Check = (p) => (
  <I {...p}><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></I>
)
export const Star = (p) => (
  <I {...p}><path d="M12 2l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8z" fill="currentColor" /></I>
)
export const Hourglass = (p) => (
  <I {...p}><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" stroke="#e3c27a" strokeWidth="1.6" fill="none" strokeLinecap="round" /></I>
)
export const BridgeIcon = (p) => (
  <I {...p}><path d="M2 15c4-5 16-5 20 0" stroke="#c98d55" strokeWidth="2.2" fill="none" /><path d="M2 11c4-5 16-5 20 0" stroke="#e3c27a" strokeWidth="1.2" fill="none" /><path d="M6 9.5v4.2M10 8v5M14 8v5M18 9.5v4.2" stroke="#e3c27a" strokeWidth="1.2" /></I>
)

export const WeatherIcon = ({ kind, ...p }) => {
  switch (kind) {
    case 'rain':
      return <I {...p}><path d="M6.5 14a4 4 0 0 1-.4-8 5 5 0 0 1 9.6 1.1A3.4 3.4 0 0 1 16 14z" fill="#c9d6f2" /><path d="M8 16.5 7 19.5M12 16.5l-1 3M16 16.5l-1 3" stroke="#4db4ff" strokeWidth="1.8" strokeLinecap="round" /></I>
    case 'wind':
      return <I {...p}><path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" stroke="#bfe3ff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></I>
    case 'heat':
      return <I {...p}><circle cx="12" cy="12" r="5" fill="#ff9e5b" />{[...Array(8)].map((_, i) => <path key={i} d="M12 2.5v3" stroke="#ffb35b" strokeWidth="1.8" strokeLinecap="round" transform={`rotate(${i * 45} 12 12)`} />)}</I>
    case 'storm':
      return <I {...p}><path d="M6.5 13a4 4 0 0 1-.4-8 5 5 0 0 1 9.6 1.1A3.4 3.4 0 0 1 16 13z" fill="#9aa6cf" /><path d="m12 12-2.5 4.5h3L11 21l4.5-6h-3l1.5-3z" fill="#f6cf4b" /></I>
    case 'drought':
      return <I {...p}><path d="M6.5 14a4 4 0 0 1-.4-8 5 5 0 0 1 9.6 1.1A3.4 3.4 0 0 1 16 14z" fill="#d9c9a8" /><path d="M7 18h10" stroke="#c9a46b" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 2.5" /></I>
    default:
      return <I {...p}><circle cx="12" cy="12" r="4.6" fill="#ffd95a" />{[...Array(8)].map((_, i) => <path key={i} d="M12 2.2v3.2" stroke="#ffd95a" strokeWidth="1.8" strokeLinecap="round" transform={`rotate(${i * 45} 12 12)`} />)}</I>
  }
}

export const Scales = (p) => (
  <I {...p}><path d="M12 3v16M8 19h8" stroke="#1f2a5a" strokeWidth="1.6" strokeLinecap="round" /><path d="M6 6h12" stroke="#c9a24f" strokeWidth="1.6" strokeLinecap="round" /><path d="M6 6 3.5 11h5zM18 6l-2.5 5h5z" fill="#d7c4f2" stroke="#1f2a5a" strokeLinejoin="round" /></I>
)
export const MapIcon = (p) => (
  <I {...p}><path d="M4 6.5 9 4.5l6 2.2 5-2v13.2l-5 2-6-2.2-5 2z" fill="#e7f0ff" stroke="#1f2a5a" strokeLinejoin="round" /><path d="M9 4.5v13.2M15 6.7v13.2" stroke="#8aa4d8" /><circle cx="12" cy="11" r="1.6" fill="#e3c27a" /></I>
)
export const SunArt = (p) => (
  <I {...p}><circle cx="12" cy="12" r="4.4" fill="#ffe28a" stroke="#c9a24f" /><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" stroke="#f0c53c" strokeWidth="1.6" strokeLinecap="round" /></I>
)

export const BackpackIcon = (p) => (
  <I {...p}>
    <path d="M8 6V4a4 4 0 0 1 8 0v2" fill="none" stroke="#d5b775" strokeWidth="1.5" />
    <rect x="4" y="5" width="16" height="17" rx="4" fill="#34546c" stroke="#d5b775" />
    <path d="M4 9c4 4 12 4 16 0V8a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3Z" fill="#ad7b48" stroke="#e2c27f" />
    <rect x="7" y="14" width="10" height="6" rx="2" fill="#976a40" stroke="#e2c27f" />
    <path d="M9 8v5m6-5v5" stroke="#f1d69c" strokeWidth="1.5" />
    <rect x="10.5" y="15" width="3" height="2" rx=".5" fill="#f1d69c" />
  </I>
)

const ART = {
  backpack: BackpackIcon,
  energy: Bolt, water: Drop, happiness: Smile, wood: Log, coins: Coin,
  sun: SunArt, quest: Scroll, build: Hammer, cloud: CloudIcon, map: MapIcon,
  journal: Book, storage: Crate, store: Shop, ancestors: Lantern, gear: Gear, 'hammer-gold': Hammer, scales: Scales,
}

// Drawn icons. Nothing here loads a picture file.
export const ArtIcon = ({ name, size = 24, ...p }) => {
  const Icon = ART[name] || CloudIcon
  return <Icon size={size} {...p} />
}
const art = (name) => (p) => <ArtIcon name={name} {...p} />
export const EnergyArt = art('energy')
export const WaterArt = art('water')
export const HappyArt = art('happiness')
export const WoodArt = art('wood')
export const CoinArt = art('coins')

export const StoneIcon = (p) => <I {...p}><path d="M3 17 6 7l8-3 7 9-3 7H7Z" fill="#b5c6d9" stroke="#5c7693" /><path d="m6 7 5 7 10-1M11 14l-4 6M11 14l3-10" fill="none" stroke="#dde8f1" /></I>
export const SeedIcon = (p) => <I {...p}><path d="M8 20C2 12 8 4 19 3c1 11-2 18-11 17Z" fill="#c6d87b" stroke="#587f48" /><path d="m8 19 7-10" stroke="#587f48" fill="none" /></I>
export const CrystalIcon = (p) => <I {...p}><path d="m12 2 7 7-2 10-5 3-5-3L5 9Z" fill="#7ee6ff" stroke="#3f8cc3" /><path d="m12 2-2 8 2 12 3-12Z" fill="#d8f8ff" /><path d="m5 9 5 1 5 0 4-1" fill="none" stroke="#4aaed4" /></I>
export const MaterialIcon = (p) => <I {...p}><path d="m3 8 9-5 9 5v11l-9 3-9-3Z" fill="#c49b67" stroke="#77573b" /><path d="m3 8 9 4 9-4M12 12v10M7 6l10 4" fill="none" stroke="#f3d8a6" /></I>
export const FishIcon = (p) => <I {...p}><path d="M4 12c4-8 10-8 15-2l3-4v12l-3-4C14 20 8 20 4 12Z" fill="#87cfe1" stroke="#3e849e" /><circle cx="9" cy="11" r="1.2" fill="#17354c" /></I>
export const RES_ICON = { energy: EnergyArt, water: WaterArt, food: Wheat, wood: WoodArt, coins: CoinArt, happiness: HappyArt, stone: StoneIcon, seeds: SeedIcon, crystals: CrystalIcon, materials: MaterialIcon, fish: FishIcon }
