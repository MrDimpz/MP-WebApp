import React from 'react';
import { SupermarketItem } from '../data/items';

type PackShape =
  | 'carton'
  | 'tin'
  | 'jar'
  | 'box'
  | 'pouch'
  | 'bottle'
  | 'tray'
  | 'tub'
  | 'loaf';

interface Palette {
  bg: string;
  primary: string;
  secondary: string;
  foil?: string;
}

const AISLE_PALETTES: Record<string, Palette> = {
  'Dairy & Chilled': { bg: '#EBF3FA', primary: '#1E5BB8', secondary: '#7DB5EC', foil: '#FFD100' },
  'Bakery': { bg: '#FDF3E6', primary: '#B46924', secondary: '#E6AF68', foil: '#F59E0B' },
  'Pantry & Tins': { bg: '#FEF0EE', primary: '#C8282B', secondary: '#F28E7D', foil: '#FFD100' },
  'Snacks & Confectionery': { bg: '#F3EEFB', primary: '#5B21B6', secondary: '#A78BFA', foil: '#FBBF24' },
  'Fresh Produce': { bg: '#EBF7F0', primary: '#1B7B49', secondary: '#67C68E', foil: '#FDE047' },
  'Frozen': { bg: '#EBF6FA', primary: '#0E7490', secondary: '#67E8F9', foil: '#FFFFFF' },
  'Tea, Coffee & Drinks': { bg: '#F7EFEA', primary: '#78350F', secondary: '#C08457', foil: '#FBBF24' },
  'Meat, Fish & Deli': { bg: '#FBECEE', primary: '#9F1239', secondary: '#FB7185', foil: '#FDE047' },
  'Household & Care': { bg: '#EEF2F8', primary: '#1E3A8A', secondary: '#60A5FA', foil: '#E2E8F0' },
};

function inferShape(item: SupermarketItem): PackShape {
  const n = `${item.name} ${item.packSize}`.toLowerCase();
  if (n.includes('milk') || n.includes('juice') || n.includes('squash') || n.includes('oil') || n.includes('sauce bottle') || n.includes('wash') || n.includes('bleach') || n.includes('shampoo') || n.includes('cola') || n.includes('water') || n.includes('wine') || n.includes('beer') || n.includes('liquid')) {
    return n.includes('carton') || n.includes('1l') || n.includes('1.5l') ? 'carton' : 'bottle';
  }
  if (n.includes('beans') || n.includes('soup') || n.includes('tuna') || n.includes('tomatoes') || n.includes('sweetcorn') || n.includes('chickpeas') || n.includes('400g')) {
    return 'tin';
  }
  if (n.includes('jam') || n.includes('marmalade') || n.includes('honey') || n.includes('coffee') || n.includes('pesto') || n.includes('paste') || n.includes('mayonnaise') || n.includes('pickle') || n.includes('butter') && n.includes('peanut')) {
    return 'jar';
  }
  if (n.includes('loaf') || n.includes('bread') || n.includes('sourdough') || n.includes('rolls') || n.includes('bagels') || n.includes('crumpets')) {
    return 'loaf';
  }
  if (n.includes('tub') || n.includes('ice cream') || n.includes('yoghurt') || n.includes('spread') || n.includes('hummus') || n.includes('cream')) {
    return 'tub';
  }
  if (n.includes('mince') || n.includes('chicken') || n.includes('steak') || n.includes('bacon') || n.includes('sausages') || n.includes('salmon') || n.includes('apples') || n.includes('berries') || n.includes('strawberries')) {
    return 'tray';
  }
  if (n.includes('crisps') || n.includes('pasta') || n.includes('rice') || n.includes('flour') || n.includes('sugar') || n.includes('beans') || n.includes('peas') || n.includes('chips') || n.includes('nuts')) {
    return 'pouch';
  }
  return 'box';
}

function renderSilhouette(shape: PackShape, primary: string, secondary: string, foil: string) {
  switch (shape) {
    case 'carton':
      return (
        <g>
          <polygon points="88,68 130,36 172,68" fill={secondary} stroke={primary} strokeWidth="2" />
          <rect x="118" y="28" width="24" height="10" rx="2" fill={primary} />
          <ellipse cx="148" cy="54" rx="10" ry="6" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
          <rect x="88" y="68" width="84" height="142" rx="4" fill={primary} />
          <rect x="156" y="68" width="16" height="142" fill="#000000" opacity="0.14" />
          <rect x="95" y="88" width="56" height="96" rx="4" fill="#FFFFFF" />
          <rect x="95" y="88" width="56" height="14" rx="2" fill={foil} />
          <circle cx="123" cy="144" r="18" fill={secondary} />
          <circle cx="123" cy="144" r="10" fill={primary} opacity="0.85" />
        </g>
      );
    case 'tin':
      return (
        <g>
          <ellipse cx="130" cy="64" rx="46" ry="11" fill="#CBD5E1" />
          <ellipse cx="130" cy="64" rx="38" ry="7" fill="#E2E8F0" />
          <ellipse cx="136" cy="63" rx="9" ry="4" fill="none" stroke="#94A3B8" strokeWidth="2" />
          <path d="M84 64 L84 194 C84 202 104 208 130 208 C156 208 176 202 176 194 L176 64 Z" fill={primary} />
          <rect x="94" y="96" width="72" height="72" rx="6" fill="#FFFFFF" />
          <rect x="94" y="96" width="72" height="14" rx="3" fill={foil} />
          <circle cx="130" cy="142" r="16" fill={secondary} />
          <rect x="92" y="72" width="8" height="122" fill="#FFFFFF" opacity="0.18" />
        </g>
      );
    case 'jar':
      return (
        <g>
          <rect x="92" y="42" width="76" height="22" rx="5" fill="#1E293B" />
          <rect x="92" y="57" width="76" height="5" fill={foil} opacity="0.85" />
          <path d="M96 64 L164 64 L174 84 L174 196 C174 205 166 210 156 210 L104 210 C94 210 86 205 86 196 L86 84 Z" fill={primary} />
          <path d="M96 86 L96 194" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.24" />
          <rect x="96" y="102" width="68" height="76" rx="5" fill="#FFFDF7" />
          <rect x="102" y="109" width="56" height="62" rx="3" fill="none" stroke={foil} strokeWidth="1.5" />
          <rect x="108" y="122" width="44" height="6" rx="2" fill={primary} />
          <rect x="114" y="134" width="32" height="4" rx="2" fill="#94A3B8" />
          <rect x="112" y="152" width="36" height="10" rx="2" fill={secondary} />
        </g>
      );
    case 'box':
      return (
        <g>
          <rect x="68" y="40" width="110" height="168" rx="5" fill={primary} />
          <polygon points="178,40 196,50 196,198 178,208" fill="#000000" opacity="0.22" />
          <polygon points="178,40 196,50 196,198 178,208" fill={primary} opacity="0.72" />
          <rect x="78" y="56" width="90" height="136" rx="4" fill="#FFFFFF" />
          <rect x="78" y="56" width="90" height="22" rx="3" fill={foil} />
          <circle cx="123" cy="136" r="28" fill={secondary} />
          <circle cx="123" cy="136" r="18" fill={primary} opacity="0.88" />
        </g>
      );
    case 'pouch':
      return (
        <g>
          <rect x="82" y="34" width="96" height="12" rx="2" fill={foil} />
          <path d="M84 46 L176 46 L184 196 C184 204 176 210 166 210 L94 210 C84 210 76 204 76 196 Z" fill={primary} />
          <rect x="92" y="68" width="76" height="94" rx="8" fill="#FFFFFF" />
          <rect x="92" y="68" width="76" height="18" rx="4" fill={foil} />
          <ellipse cx="130" cy="126" rx="24" ry="20" fill={secondary} />
          <ellipse cx="130" cy="126" rx="14" ry="11" fill={primary} opacity="0.82" />
          <path d="M88 58 L84 192" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.2" />
        </g>
      );
    case 'bottle':
      return (
        <g>
          <rect x="114" y="24" width="32" height="18" rx="3" fill="#1E293B" />
          <path d="M116 42 L144 42 L152 82 L166 96 L166 198 C166 206 160 212 150 212 L110 212 C100 212 94 206 94 198 L94 96 L108 82 Z" fill={primary} />
          <rect x="98" y="112" width="64" height="62" rx="4" fill="#FFFFFF" />
          <rect x="98" y="112" width="64" height="14" rx="2" fill={foil} />
          <circle cx="130" cy="150" r="14" fill={secondary} />
          <path d="M104 98 L104 196" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.22" />
        </g>
      );
    case 'tray':
      return (
        <g>
          <rect x="54" y="62" width="152" height="134" rx="14" fill="#1E293B" />
          <rect x="64" y="72" width="132" height="114" rx="10" fill={secondary} />
          <ellipse cx="105" cy="128" rx="26" ry="30" fill={primary} opacity="0.88" />
          <ellipse cx="152" cy="128" rx="26" ry="30" fill={primary} opacity="0.95" />
          <rect x="76" y="78" width="108" height="24" rx="4" fill="#FFFFFF" />
          <rect x="76" y="78" width="108" height="7" rx="2" fill={foil} />
          <path d="M68 82 L188 176" stroke="#FFFFFF" strokeWidth="6" opacity="0.16" />
        </g>
      );
    case 'tub':
      return (
        <g>
          <ellipse cx="130" cy="72" rx="64" ry="15" fill={foil} />
          <ellipse cx="130" cy="68" rx="66" ry="13" fill={secondary} />
          <path d="M72 78 L188 78 L174 196 C174 205 154 210 130 210 C106 210 86 205 86 196 Z" fill={primary} />
          <rect x="86" y="104" width="88" height="64" rx="6" fill="#FFFFFF" />
          <rect x="86" y="104" width="88" height="14" rx="3" fill={foil} />
          <circle cx="130" cy="144" r="16" fill={secondary} />
        </g>
      );
    case 'loaf':
      return (
        <g>
          <path d="M64 114 C64 74 96 58 130 58 C164 58 196 74 196 114 L196 194 C196 204 188 210 176 210 L84 210 C72 210 64 204 64 194 Z" fill={secondary} />
          <path d="M64 114 C64 78 96 62 130 62 C164 62 196 78 196 114" fill="none" stroke={primary} strokeWidth="6" opacity="0.55" />
          <rect x="76" y="114" width="108" height="72" rx="6" fill={primary} />
          <rect x="84" y="122" width="92" height="54" rx="4" fill="#FFFFFF" />
          <rect x="84" y="122" width="92" height="12" rx="2" fill={foil} />
          <circle cx="130" cy="154" r="14" fill={secondary} />
        </g>
      );
  }
}

export const ProductPackVisual: React.FC<{ item: SupermarketItem; compact?: boolean }> = ({
  item,
  compact = false,
}) => {
  const palette = AISLE_PALETTES[item.aisle] || AISLE_PALETTES['Pantry & Tins'];
  const shape = inferShape(item);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 38%, #FFFFFF 0%, ${palette.bg} 78%)`,
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-[28%]"
        style={{
          background: 'linear-gradient(180deg, #D8E0EA 0%, #E7ECF2 100%)',
        }}
      />
      <div
        className="absolute bottom-[16%] w-[52%] h-4 rounded-full blur-md opacity-35"
        style={{ backgroundColor: '#0F1D36' }}
      />
      <svg
        viewBox="0 0 260 235"
        className={`relative z-10 w-auto ${compact ? 'h-[78%]' : 'h-[82%]'} drop-shadow-sm`}
        aria-hidden="true"
      >
        {renderSilhouette(
          shape,
          palette.primary,
          palette.secondary,
          palette.foil || '#FFD100'
        )}
      </svg>
      {!compact && (
        <div className="absolute top-3 left-3 z-20 max-w-[82%]">
          <div className="bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-md px-2.5 py-1">
            <div className="text-[10px] font-semibold tracking-wide text-slate-600 truncate">
              {item.aisle} · {item.packSize}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
