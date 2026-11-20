import React from 'react';
import Svg, { Path, Circle, Rect, Polygon, Ellipse, Line } from 'react-native-svg';

export interface LandmarkIconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * 1. Kota Semarang - Tugu Muda
 */
export function TuguMudaSemarangIcon({ size = 24, color = '#1E293B', secondaryColor = '#EF4444' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="4" y="27" width="24" height="3" rx="1" fill={color} />
      <Rect x="7" y="24" width="18" height="3" rx="0.5" fill={color} />
      <Rect x="9" y="21" width="14" height="3" rx="0.5" fill={color} />
      <Path d="M12 21 L13.5 8 L18.5 8 L20 21 Z" fill={color} opacity={0.9} />
      <Path d="M15 21 L15.5 8 L16.5 8 L17 21 Z" fill="#FFFFFF" opacity={0.3} />
      <Path d="M13.5 8 L16 3 L18.5 8 Z" fill={color} />
      <Path d="M16 1 C15 3 14 4 14.5 5.5 C15 7 16 7 16 7 C16 7 17 7 17.5 5.5 C18 4 17 3 16 1 Z" fill={secondaryColor} />
      <Circle cx="16" cy="4.5" r="1" fill="#FDE047" />
    </Svg>
  );
}

/**
 * 2. Kota Surakarta / Solo - Keraton Solo (Gapura Kori Kamandungan)
 */
export function KeratonSoloIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 4 L26 12 L24 14 L21 13 L21 27 L11 27 L11 13 L8 14 L6 12 Z" fill={color} />
      <Path d="M16 1 L17.5 4 L14.5 4 Z" fill="#FACC15" />
      <Path d="M13 27 L13 18 C13 16.3 14.3 15 16 15 C17.7 15 19 16.3 19 18 L19 27 Z" fill="#FFFFFF" />
      <Circle cx="16" cy="11" r="1.5" fill="#FACC15" />
    </Svg>
  );
}

/**
 * 3. Kab. Magelang - Candi Borobudur (Stupa Utama)
 */
export function BorobudurStupaIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="15" y="2" width="2" height="6" fill={color} />
      <Circle cx="16" cy="2" r="1.5" fill="#FACC15" />
      <Path d="M16 7 C11.5 7 9 11 9 16 L23 16 C23 11 20.5 7 16 7 Z" fill={color} />
      <Rect x="6" y="16" width="20" height="3" rx="0.5" fill={color} opacity={0.9} />
      <Rect x="4" y="19" width="24" height="3" rx="0.5" fill={color} opacity={0.8} />
      <Rect x="2" y="22" width="28" height="4" rx="1" fill={color} />
      <Circle cx="13" cy="12" r="1" fill="#FFFFFF" />
      <Circle cx="16" cy="12" r="1" fill="#FFFFFF" />
      <Circle cx="19" cy="12" r="1" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 4. Kudus - Menara Kudus
 */
export function MenaraKudusIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 2 L22 7 L10 7 Z" fill="#DC2626" />
      <Path d="M16 6 L24 12 L8 12 Z" fill="#DC2626" />
      <Rect x="10" y="12" width="12" height="5" fill={color} />
      <Rect x="9" y="17" width="14" height="5" fill={color} opacity={0.9} />
      <Rect x="8" y="22" width="16" height="6" fill={color} />
      <Rect x="6" y="27" width="20" height="3" rx="0.5" fill={color} />
      <Path d="M14 28 L14 23 C14 22 15 21 16 21 C17 21 18 22 18 23 L18 28 Z" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 5. Demak - Masjid Agung Demak
 */
export function MasjidDemakIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 3 L21 8 L11 8 Z" fill="#15803D" />
      <Path d="M16 7 L24 13 L8 13 Z" fill="#15803D" />
      <Path d="M16 12 L27 19 L5 19 Z" fill="#15803D" />
      <Rect x="7" y="19" width="18" height="8" fill={color} />
      <Rect x="5" y="27" width="22" height="3" rx="1" fill={color} />
      <Path d="M13 27 L13 22 C13 21 14 20 16 20 C18 20 19 21 19 22 L19 27 Z" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 6. Pekalongan - Canting & Kain Batik
 */
export function BatikPekalonganIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M7 25 L17 15 C19 13 22 13 24 15 C26 17 26 20 24 22 C22 24 19 24 17 22 Z" fill="#D97706" />
      <Path d="M25 15 L29 11 L28 10 L24 13 Z" fill="#B45309" />
      <Circle cx="29" cy="8" r="1.5" fill="#F59E0B" />
      <Path d="M5 27 L10 22 L7 19 L2 24 Z" fill={color} />
      <Circle cx="20" cy="18" r="2" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 7. Brebes - Bawang Merah & Telur Asin
 */
export function BawangBrebesIcon({ size = 24, color = '#E11D48' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 4 C16 4 10 11 10 18 C10 24 13 28 16 28 C19 28 22 24 22 18 C22 11 16 4 16 4 Z" fill={color} />
      <Path d="M16 4 C13 11 13 24 16 28" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M16 4 L14 1" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" />
      <Path d="M16 4 L18 1.5" stroke="#16A34A" strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="24" cy="22" r="5" fill="#38BDF8" opacity={0.8} />
      <Circle cx="24" cy="22" r="2.5" fill="#EA580C" />
    </Svg>
  );
}

/**
 * 8. Cilacap - Kilang Minyak & Mercusuar
 */
export function KilangCilacapIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="7" y="10" width="8" height="17" rx="1" fill={color} />
      <Rect x="19" y="8" width="3" height="19" fill={color} />
      <Path d="M20.5 2 C19.5 4 19 5.5 19.5 6.5 C20 7.5 21 7.5 21 7.5 C21 7.5 22 7.5 22.5 6.5 C23 5.5 21.5 4 20.5 2 Z" fill="#EF4444" />
      <Circle cx="11" cy="6" r="3" fill="#3B82F6" />
      <Rect x="4" y="27" width="24" height="3" rx="1" fill={color} />
    </Svg>
  );
}

/**
 * 9. Boyolali - Sapi Perah
 */
export function SapiBoyolaliIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M11 12 C11 9 13 7 16 7 C19 7 21 9 21 12 L21 21 C21 24 19 26 16 26 C13 26 11 24 11 21 Z" fill={color} />
      <Rect x="13" y="19" width="6" height="5" rx="2" fill="#FFFFFF" />
      <Circle cx="14.5" cy="21.5" r="0.8" fill={color} />
      <Circle cx="17.5" cy="21.5" r="0.8" fill={color} />
      <Path d="M11 9 C9 8 7 5 6 3 C8 5 10 7 11 9 Z" fill="#F59E0B" />
      <Path d="M21 9 C23 8 25 5 26 3 C24 5 22 7 21 9 Z" fill="#F59E0B" />
      <Path d="M11 13 L6 14 L8 17 Z" fill="#E2E8F0" />
      <Path d="M21 13 L26 14 L24 17 Z" fill="#E2E8F0" />
      <Circle cx="13.5" cy="13" r="1.2" fill="#FFFFFF" />
      <Circle cx="18.5" cy="13" r="1.2" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 10. Klaten - Candi Prambanan
 */
export function PrambananKlatenIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 2 L17.5 7 L14.5 7 Z" fill="#F59E0B" />
      <Path d="M16 6 L19 12 L13 12 Z" fill={color} />
      <Path d="M16 11 L21 18 L11 18 Z" fill={color} />
      <Path d="M16 17 L23 25 L9 25 Z" fill={color} />
      <Rect x="6" y="25" width="20" height="4" rx="0.5" fill={color} />
      <Path d="M7 21 L9 25 L5 25 Z" fill={color} opacity={0.7} />
      <Path d="M25 21 L27 25 L23 25 Z" fill={color} opacity={0.7} />
    </Svg>
  );
}

/**
 * 11. Jepara - Ukiran Kayu Khas Jepara
 */
export function UkiranJeparaIcon({ size = 24, color = '#D97706' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 16 C12 10 6 12 6 17 C6 22 12 24 16 21 C20 24 26 22 26 17 C26 12 20 10 16 16 Z" fill={color} />
      <Path d="M16 5 C14 8 13 12 16 16 C19 12 18 8 16 5 Z" fill="#B45309" />
      <Circle cx="16" cy="16" r="3" fill="#FDE68A" />
      <Circle cx="16" cy="16" r="1.5" fill="#78350F" />
    </Svg>
  );
}

/**
 * 12. Wonogiri - Waduk Gajah Mungkur
 */
export function WadukWonogiriIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="5" y="8" width="22" height="6" rx="1" fill="#475569" />
      <Path d="M7 14 L11 26 L21 26 L25 14 Z" fill="#64748B" />
      <Path d="M12 20 C14 22 18 22 20 20" stroke="#38BDF8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M10 24 C13 26 19 26 22 24" stroke="#0284C7" strokeWidth={2} strokeLinecap="round" />
      <Circle cx="16" cy="11" r="1.5" fill="#EF4444" />
    </Svg>
  );
}

/**
 * 13. Tegal Kab / Kota - Poci Teh Slawi
 */
export function PociTegalIcon({ size = 24, color = '#B45309' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="18" r="8" fill={color} />
      <Rect x="12" y="9" width="8" height="3" rx="1.5" fill="#78350F" />
      <Circle cx="16" cy="8" r="1.5" fill="#78350F" />
      <Path d="M8 17 C6 16 4 13 4 11 C6 11 8 13 10 15 Z" fill={color} />
      <Path d="M22 13 C26 13 27 21 22 22" stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M14 4 C13 2 15 1 16 2" stroke="#F59E0B" strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * 14. Pati - Padi & Ikan (Bumi Mina Tani)
 */
export function PadiPatiIcon({ size = 24, color = '#EAB308' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 28 C16 16 12 8 8 4" stroke="#854D0E" strokeWidth={2} strokeLinecap="round" />
      <Circle cx="10" cy="7" r="2" fill={color} />
      <Circle cx="13" cy="10" r="2" fill={color} />
      <Circle cx="11" cy="13" r="2" fill={color} />
      <Circle cx="15" cy="15" r="2" fill={color} />
      <Circle cx="13" cy="18" r="2" fill={color} />
      <Circle cx="17" cy="20" r="2" fill={color} />
      <Circle cx="15" cy="23" r="2" fill={color} />
      <Path d="M20 10 C24 10 28 14 28 14 C28 14 24 18 20 18 C19 18 18 16 18 14 C18 12 19 10 20 10 Z" fill="#38BDF8" />
      <Polygon points="27,14 30,11 30,17" fill="#38BDF8" />
    </Svg>
  );
}

/**
 * 15. Wonosobo - Dieng & Telaga Warna
 */
export function DiengWonosoboIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M3 24 L13 6 L23 24 Z" fill={color} />
      <Path d="M15 24 L23 10 L31 24 Z" fill="#16A34A" opacity={0.8} />
      <Ellipse cx="16" cy="24" rx="10" ry="4" fill="#06B6D4" />
      <Circle cx="16" cy="24" r="2" fill="#FACC15" />
    </Svg>
  );
}

/**
 * 16. Blora - Pohon Kayu Jati
 */
export function PohonJatiBloraIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="14" y="16" width="4" height="12" rx="1" fill="#78350F" />
      <Circle cx="16" cy="11" r="8" fill={color} />
      <Circle cx="11" cy="13" r="6" fill="#16A34A" />
      <Circle cx="21" cy="13" r="6" fill="#16A34A" />
    </Svg>
  );
}

/**
 * 17. Banjarnegara - Candi Dieng (Arjuna)
 */
export function CandiDiengBanjarnegaraIcon({ size = 24, color = '#78350F' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Puncak Candi */}
      <Path d="M16 2 L17 6 L15 6 Z" fill="#F59E0B" />
      <Rect x="14" y="6" width="4" height="3" fill={color} />
      {/* Atap Kubus Candi Dieng */}
      <Rect x="11" y="9" width="10" height="4" rx="0.5" fill={color} />
      {/* Badan Candi */}
      <Rect x="10" y="13" width="12" height="8" fill={color} opacity={0.9} />
      {/* Relung Arca */}
      <Rect x="13" y="15" width="6" height="6" rx="1" fill="#FFFFFF" opacity={0.3} />
      {/* Kaki Candi */}
      <Rect x="8" y="21" width="16" height="4" rx="0.5" fill={color} />
      <Rect x="6" y="25" width="20" height="4" rx="1" fill={color} />
    </Svg>
  );
}

/**
 * 18. Banyumas - Baturraden (Lembah + Air Terjun)
 */
export function BaturradenBanyumasIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gunung / Lereng Slamet */}
      <Path d="M4 26 L16 6 L28 26 Z" fill={color} />
      {/* Salju / Puncak */}
      <Path d="M16 6 L19 13 L13 13 Z" fill="#E2E8F0" />
      {/* Air Terjun Baturraden */}
      <Path d="M16 14 L15 22 C15 24 14 26 13 26" stroke="#38BDF8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M16 14 L17 22 C17 24 18 26 19 26" stroke="#0EA5E9" strokeWidth={1.5} strokeLinecap="round" />
      {/* Kolam Bawah */}
      <Ellipse cx="16" cy="27" rx="6" ry="2" fill="#38BDF8" opacity={0.7} />
    </Svg>
  );
}

/**
 * 19. Purbalingga - Owabong (Kolam Renang / Wahana Air)
 */
export function OwabongPurbalinggaIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Perosotan / Seluncuran */}
      <Path d="M6 4 C8 6 12 10 14 16 C15 20 15 24 16 26" stroke="#EF4444" strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* Kolam Air */}
      <Ellipse cx="18" cy="26" rx="10" ry="4" fill={color} opacity={0.8} />
      {/* Percikan Air */}
      <Circle cx="10" cy="22" r="1.5" fill="#38BDF8" />
      <Circle cx="26" cy="22" r="1.5" fill="#38BDF8" />
      {/* Tiang Penyangga */}
      <Line x1="8" y1="6" x2="8" y2="22" stroke="#94A3B8" strokeWidth={1.5} />
    </Svg>
  );
}

/**
 * 20. Purworejo - Goa Seplawan (Gua Batu Stalaktit)
 */
export function GoaSeplawanPurworejo({ size = 24, color = '#475569' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Mulut Gua / Tebing */}
      <Path d="M4 28 L4 10 C4 10 10 4 16 4 C22 4 28 10 28 10 L28 28 Z" fill={color} />
      {/* Langit-langit Gua Hitam */}
      <Path d="M4 14 C8 10 12 8 16 8 C20 8 24 10 28 14 L28 10 C28 10 22 4 16 4 C10 4 4 10 4 10 Z" fill="#1E293B" />
      {/* Stalaktit menggantung */}
      <Path d="M10 14 L9 20 L11 20 Z" fill="#94A3B8" />
      <Path d="M16 12 L15 19 L17 19 Z" fill="#94A3B8" />
      <Path d="M22 14 L21 20 L23 20 Z" fill="#94A3B8" />
      {/* Cahaya / Tetesan Air */}
      <Ellipse cx="16" cy="26" rx="5" ry="2" fill="#38BDF8" opacity={0.5} />
    </Svg>
  );
}

/**
 * 21. Sukoharjo - Keraton Kartasura (Reruntuhan)
 */
export function KeratonKartasuraSukoharjo({ size = 24, color = '#78350F' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gapura / Pintu Gerbang Kartasura */}
      <Rect x="5" y="12" width="22" height="16" rx="1" fill={color} opacity={0.85} />
      {/* Atap Gapura Joglo */}
      <Path d="M4 12 L16 4 L28 12 Z" fill="#92400E" />
      <Path d="M8 12 L16 6 L24 12 Z" fill="#B45309" />
      {/* Lorong Gerbang Utama */}
      <Path d="M13 28 L13 20 C13 18 14.3 17 16 17 C17.7 17 19 18 19 20 L19 28 Z" fill="#FBBF24" opacity={0.5} />
      {/* Ornamen */}
      <Circle cx="16" cy="10" r="1.5" fill="#FBBF24" />
      {/* Reruntuhan bata di bawah */}
      <Rect x="2" y="27" width="28" height="3" rx="1" fill="#92400E" />
    </Svg>
  );
}

/**
 * 22. Sragen - Museum Purbakala Sangiran (Tengkorak Fosil)
 */
export function SangiranSragenIcon({ size = 24, color = '#78350F' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Kubah Kepala Tengkorak */}
      <Path d="M8 18 C8 10 12 5 16 5 C20 5 24 10 24 18 Z" fill={color} />
      {/* Bagian Muka Tengkorak */}
      <Rect x="10" y="18" width="12" height="7" rx="1" fill={color} />
      {/* Mata Kosong */}
      <Ellipse cx="13" cy="15" rx="2" ry="2.5" fill="#FFFFFF" opacity={0.6} />
      <Ellipse cx="19" cy="15" rx="2" ry="2.5" fill="#FFFFFF" opacity={0.6} />
      {/* Tulang Hidung */}
      <Path d="M15 18 L16 20 L17 18" stroke="#FFFFFF" strokeWidth={0.8} />
      {/* Rahang Bawah / Gigi */}
      <Rect x="11" y="23" width="10" height="3" rx="0.5" fill={color} opacity={0.7} />
      <Rect x="11" y="27" width="10" height="3" rx="1" fill="#B45309" />
      {/* Tulang silang di bawah */}
      <Path d="M8 29 L24 29" stroke="#B45309" strokeWidth={1.5} />
    </Svg>
  );
}

/**
 * 23. Grobogan - Api Abadi Mrapen
 */
export function MrapenGroboganIcon({ size = 24, color = '#EF4444' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Batu Ladang / Tanah Mrapen */}
      <Ellipse cx="16" cy="26" rx="12" ry="4" fill="#78350F" />
      <Ellipse cx="16" cy="24" rx="8" ry="3" fill="#92400E" />
      {/* Lidah Api Abadi Mrapen */}
      <Path d="M16 24 C14 20 12 16 13 11 C14 8 15 7 16 6 C17 7 18 8 19 11 C20 16 18 20 16 24 Z" fill="#F97316" />
      <Path d="M16 24 C15 19 15 15 15.5 12 C16 10 16 9 16 8 C16.5 9 17 11 17 14 C17 18 17 22 16 24 Z" fill={color} />
      {/* Percikan Api */}
      <Circle cx="12" cy="10" r="1" fill="#FACC15" />
      <Circle cx="20" cy="8" r="1" fill="#FACC15" />
      <Circle cx="14" cy="6" r="0.8" fill="#FDE047" />
    </Svg>
  );
}

/**
 * 24. Kab. Semarang - Rawa Pening (Danau + Eceng Gondok)
 */
export function RawaPeningKabSemarangIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gunung Merbabu / Telomoyo di latar */}
      <Path d="M2 22 L10 10 L18 22 Z" fill="#15803D" opacity={0.7} />
      <Path d="M14 22 L22 12 L30 22 Z" fill="#16A34A" opacity={0.6} />
      {/* Danau Rawa Pening */}
      <Ellipse cx="16" cy="25" rx="13" ry="5" fill={color} opacity={0.75} />
      {/* Eceng Gondok (tanaman air) */}
      <Circle cx="10" cy="23" r="2.5" fill="#22C55E" />
      <Circle cx="22" cy="24" r="2" fill="#22C55E" />
      <Circle cx="16" cy="22" r="1.5" fill="#16A34A" />
    </Svg>
  );
}

/**
 * 25. Temanggung - Sindoro-Sumbing Twin Peaks
 */
export function SindoroSumbingTemanggungIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gunung Sumbing (kiri) */}
      <Path d="M2 28 L12 8 L22 28 Z" fill={color} />
      <Path d="M12 8 L14.5 15 L9.5 15 Z" fill="#E2E8F0" />
      {/* Gunung Sindoro (kanan) */}
      <Path d="M12 28 L22 10 L32 28 Z" fill="#16A34A" opacity={0.9} />
      <Path d="M22 10 L24.5 17 L19.5 17 Z" fill="#F1F5F9" />
      {/* Lembah / Kebun Tembakau */}
      <Rect x="2" y="27" width="28" height="3" rx="1" fill="#A3E635" opacity={0.5} />
    </Svg>
  );
}

/**
 * 26. Karanganyar - Candi Sukuh / Cetho (Candi Hindu Jawa)
 */
export function CandiSukuhKaranganyarIcon({ size = 24, color = '#78350F' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Piramida Bertingkat Candi Sukuh (khas trapesium) */}
      <Rect x="10" y="23" width="12" height="5" fill={color} />
      <Rect x="11" y="18" width="10" height="5" fill={color} opacity={0.9} />
      <Rect x="12" y="13" width="8" height="5" fill={color} opacity={0.85} />
      <Rect x="13" y="9" width="6" height="4" fill={color} opacity={0.8} />
      <Rect x="14" y="6" width="4" height="3" fill={color} />
      <Rect x="15" y="4" width="2" height="2" fill="#F59E0B" />
      {/* Batu Dasar */}
      <Rect x="6" y="27" width="20" height="3" rx="1" fill="#92400E" />
      {/* Relief / Ornamen */}
      <Rect x="13" y="20" width="2" height="2" fill="#FBBF24" opacity={0.6} />
      <Rect x="17" y="20" width="2" height="2" fill="#FBBF24" opacity={0.6} />
    </Svg>
  );
}

/**
 * 27. Rembang - Makam R.A. Kartini (Nisan Bintang)
 */
export function KartiniRembangIcon({ size = 24, color = '#BE185D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Nisan / Batu Nisan */}
      <Path d="M13 8 C13 5.5 14.3 4 16 4 C17.7 4 19 5.5 19 8 L19 26 L13 26 Z" fill={color} />
      <Rect x="11" y="26" width="10" height="3" rx="0.5" fill="#9D174D" />
      {/* Bintang di Puncak Nisan (simbol Kartini) */}
      <Path d="M16 2 L16.8 4.5 L19.5 4.5 L17.3 6 L18.1 8.5 L16 7 L13.9 8.5 L14.7 6 L12.5 4.5 L15.2 4.5 Z" fill="#FBBF24" />
      {/* Bunga Melati (Dua Bunga Kecil) */}
      <Circle cx="10" cy="20" r="2.5" fill="#FDF4FF" />
      <Circle cx="22" cy="20" r="2.5" fill="#FDF4FF" />
      <Circle cx="10" cy="20" r="1" fill="#BE185D" />
      <Circle cx="22" cy="20" r="1" fill="#BE185D" />
    </Svg>
  );
}

/**
 * 28. Pemalang - Pantai Widuri (Matahari + Ombak)
 */
export function PantaiWiduriPemalangIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Matahari Pantai */}
      <Circle cx="22" cy="8" r="4" fill="#FBBF24" />
      <Path d="M22 1 L22 3" stroke="#FBBF24" strokeWidth={1.5} />
      <Path d="M22 13 L22 15" stroke="#FBBF24" strokeWidth={1.5} />
      <Path d="M15 8 L17 8" stroke="#FBBF24" strokeWidth={1.5} />
      <Path d="M27 8 L29 8" stroke="#FBBF24" strokeWidth={1.5} />
      {/* Pantai / Pasir */}
      <Ellipse cx="12" cy="26" rx="12" ry="4" fill="#D97706" opacity={0.5} />
      {/* Ombak Laut */}
      <Path d="M4 20 C7 17 11 21 15 19 C19 17 23 21 27 19" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M3 24 C6 22 10 25 14 23 C18 21 22 25 28 23" stroke="#38BDF8" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * 29. Batang - Pantai & Ikan Laut (Daerah Nelayan)
 */
export function NelayanBatangIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Perahu Layar / Kapal Nelayan */}
      <Path d="M4 20 L16 6 L16 20 Z" fill="#94A3B8" />
      <Path d="M16 20 L28 20 L16 6 Z" fill="#CBD5E1" />
      <Path d="M4 20 L28 20 L24 26 L8 26 Z" fill="#78350F" />
      {/* Tiang */}
      <Line x1="16" y1="6" x2="16" y2="26" stroke="#475569" strokeWidth={1.5} />
      {/* Ombak */}
      <Path d="M2 28 C6 26 10 29 14 27 C18 25 22 29 28 27" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * 30. Kendal - Pantai Cahaya & Lumba-lumba
 */
export function LumbaLumbaKendalIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Lumba-lumba Meloncat */}
      <Path d="M4 22 C6 16 10 12 16 10 C20 9 24 10 27 13 C29 15 29 18 27 20 C24 22 20 21 18 19 C16 17 13 20 10 24 Z" fill={color} />
      {/* Sirip Punggung */}
      <Path d="M18 10 L20 5 L22 10" fill="#0369A1" />
      {/* Ekor */}
      <Path d="M10 24 L6 28 L4 22 Z" fill="#0369A1" />
      {/* Mata */}
      <Circle cx="25" cy="15" r="1.2" fill="#FFFFFF" />
      {/* Ombak */}
      <Path d="M2 28 C7 26 12 29 17 27 C22 25 26 28 30 27" stroke="#38BDF8" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * 31. Kebumen - Goa Jatijajar (Mulut Gua + Stalaktit)
 */
export function GoaJatijajarKebumenIcon({ size = 24, color = '#475569' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Tebing Gua */}
      <Path d="M2 28 L2 12 C2 12 7 4 16 4 C25 4 30 12 30 12 L30 28 Z" fill={color} />
      {/* Langit-langit Gelap */}
      <Path d="M2 15 C6 9 11 7 16 7 C21 7 26 9 30 15 L30 12 C30 12 25 4 16 4 C7 4 2 12 2 12 Z" fill="#1E293B" />
      {/* Stalaktit menggantung panjang */}
      <Path d="M9 15 L8 23 L10 23 Z" fill="#94A3B8" />
      <Path d="M15 13 L14 22 L16 22 Z" fill="#94A3B8" />
      <Path d="M21 15 L20 23 L22 23 Z" fill="#94A3B8" />
      {/* Kolam Air di dalam */}
      <Ellipse cx="16" cy="27" rx="8" ry="2.5" fill="#38BDF8" opacity={0.5} />
    </Svg>
  );
}

/**
 * 32. Salatiga - Monumen Palagan Ambarawa
 */
export function MonumenAmbarawaSalatiaga({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Obelisk Monumen */}
      <Path d="M12 28 L14 10 L18 10 L20 28 Z" fill={color} />
      <Path d="M14 10 L16 4 L18 10 Z" fill="#EF4444" />
      {/* Bintang Merah di Puncak */}
      <Path d="M16 2 L16.6 4 L18.5 4 L17 5.3 L17.6 7.3 L16 6 L14.4 7.3 L15 5.3 L13.5 4 L15.4 4 Z" fill="#EF4444" />
      {/* Relief Senjata / Relief Perang (Garis Abstrak) */}
      <Rect x="13.5" y="14" width="1.5" height="8" fill="#FFFFFF" opacity={0.3} />
      <Rect x="17" y="14" width="1.5" height="8" fill="#FFFFFF" opacity={0.3} />
      {/* Podium Bertingkat */}
      <Rect x="10" y="27" width="12" height="2" fill={color} />
      <Rect x="8" y="29" width="16" height="2" rx="0.5" fill="#334155" />
    </Svg>
  );
}

/**
 * 33. Kota Magelang - Gunung Tidar (Pakunya Pulau Jawa)
 */
export function GunungTidarKotaMagelangIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gunung Tidar - Berbentuk Kerucut Ramping */}
      <Path d="M8 28 L16 5 L24 28 Z" fill={color} />
      <Path d="M16 5 L18.5 13 L13.5 13 Z" fill="#E2E8F0" />
      {/* Tiang / Paku Jawa di Puncak */}
      <Rect x="15" y="2" width="2" height="6" fill="#78350F" />
      <Rect x="13.5" y="2" width="5" height="1.5" rx="0.5" fill="#78350F" />
      {/* Pepohonan (Hutan di Lereng) */}
      <Circle cx="11" cy="22" r="3" fill="#16A34A" opacity={0.8} />
      <Circle cx="21" cy="22" r="3" fill="#16A34A" opacity={0.8} />
      {/* Tanah / Kaki Gunung */}
      <Rect x="4" y="27" width="24" height="3" rx="1" fill="#A3E635" opacity={0.4} />
    </Svg>
  );
}

/**
 * 34. Kebumen alt / Generic Coastal Fallback
 */
export function GenericCoastalIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 22 C9 18 13 24 17 21 C21 18 25 24 29 21" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M6 26 C10 23 14 27 18 25 C22 23 25 27 28 25" stroke="#38BDF8" strokeWidth={2} strokeLinecap="round" />
      <Circle cx="16" cy="9" r="4" fill="#FACC15" />
    </Svg>
  );
}

/**
 * Generic Mountain Fallback
 */
export function GenericMountainIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 25 L16 7 L28 25 Z" fill={color} />
      <Path d="M12 25 L20 13 L28 25 Z" fill="#22C55E" opacity={0.8} />
      <Path d="M16 7 L18 12 L14 12 Z" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * Resolver Ikon Landmark Berdasarkan Region ID
 * Setiap wilayah Kabupaten/Kota di Jawa Tengah memiliki ikon landmark uniknya sendiri.
 */
export function getLandmarkIcon(regionId: string, size = 22, color = '#1E293B'): React.ReactNode {
  switch (regionId) {
    // ── KOTA ──────────────────────────────────────────────────────────
    case 'reg_33_74': // Kota Semarang - Tugu Muda
      return <TuguMudaSemarangIcon size={size} color={color} secondaryColor="#EF4444" />;

    case 'reg_33_72': // Kota Surakarta / Solo - Keraton Solo
      return <KeratonSoloIcon size={size} color={color} />;

    case 'reg_33_71': // Kota Magelang - Gunung Tidar (berbeda dari Kab yang pakai Borobudur)
      return <GunungTidarKotaMagelangIcon size={size} color="#15803D" />;

    case 'reg_33_73': // Kota Salatiga - Monumen Palagan Ambarawa
      return <MonumenAmbarawaSalatiaga size={size} color={color} />;

    case 'reg_33_75': // Kota Pekalongan - Batik Canting
      return <BatikPekalonganIcon size={size} color={color} />;

    case 'reg_33_76': // Kota Tegal - Poci Teh
      return <PociTegalIcon size={size} color="#B45309" />;

    // ── KABUPATEN ──────────────────────────────────────────────────────
    case 'reg_33_01': // Kab. Cilacap - Kilang Minyak Pertamina
      return <KilangCilacapIcon size={size} color={color} />;

    case 'reg_33_02': // Kab. Banyumas - Baturraden & Gunung Slamet
      return <BaturradenBanyumasIcon size={size} color="#15803D" />;

    case 'reg_33_03': // Kab. Purbalingga - Owabong Water Park
      return <OwabongPurbalinggaIcon size={size} color="#0284C7" />;

    case 'reg_33_04': // Kab. Banjarnegara - Candi Dieng Arjuna
      return <CandiDiengBanjarnegaraIcon size={size} color="#78350F" />;

    case 'reg_33_05': // Kab. Kebumen - Goa Jatijajar
      return <GoaJatijajarKebumenIcon size={size} color="#475569" />;

    case 'reg_33_06': // Kab. Purworejo - Goa Seplawan
      return <GoaSeplawanPurworejo size={size} color="#475569" />;

    case 'reg_33_07': // Kab. Wonosobo - Dieng & Telaga Warna
      return <DiengWonosoboIcon size={size} color="#15803D" />;

    case 'reg_33_08': // Kab. Magelang - Candi Borobudur
      return <BorobudurStupaIcon size={size} color={color} />;

    case 'reg_33_09': // Kab. Boyolali - Sapi Perah
      return <SapiBoyolaliIcon size={size} color={color} />;

    case 'reg_33_10': // Kab. Klaten - Candi Prambanan
      return <PrambananKlatenIcon size={size} color={color} />;

    case 'reg_33_11': // Kab. Sukoharjo - Keraton Kartasura
      return <KeratonKartasuraSukoharjo size={size} color="#78350F" />;

    case 'reg_33_12': // Kab. Wonogiri - Waduk Gajah Mungkur
      return <WadukWonogiriIcon size={size} color="#0284C7" />;

    case 'reg_33_13': // Kab. Karanganyar - Candi Sukuh / Cetho
      return <CandiSukuhKaranganyarIcon size={size} color="#78350F" />;

    case 'reg_33_14': // Kab. Sragen - Museum Purbakala Sangiran
      return <SangiranSragenIcon size={size} color="#78350F" />;

    case 'reg_33_15': // Kab. Grobogan - Api Abadi Mrapen
      return <MrapenGroboganIcon size={size} color="#EF4444" />;

    case 'reg_33_16': // Kab. Blora - Pohon Kayu Jati
      return <PohonJatiBloraIcon size={size} color="#15803D" />;

    case 'reg_33_17': // Kab. Rembang - Makam R.A. Kartini
      return <KartiniRembangIcon size={size} color="#BE185D" />;

    case 'reg_33_18': // Kab. Pati - Padi & Ikan (Mina Tani)
      return <PadiPatiIcon size={size} color="#EAB308" />;

    case 'reg_33_19': // Kab. Kudus - Menara Kudus
      return <MenaraKudusIcon size={size} color={color} />;

    case 'reg_33_20': // Kab. Jepara - Ukiran Kayu
      return <UkiranJeparaIcon size={size} color="#D97706" />;

    case 'reg_33_21': // Kab. Demak - Masjid Agung Demak
      return <MasjidDemakIcon size={size} color={color} />;

    case 'reg_33_22': // Kab. Semarang - Rawa Pening
      return <RawaPeningKabSemarangIcon size={size} color="#0284C7" />;

    case 'reg_33_23': // Kab. Temanggung - Twin Peaks Sindoro-Sumbing
      return <SindoroSumbingTemanggungIcon size={size} color="#15803D" />;

    case 'reg_33_24': // Kab. Kendal - Lumba-lumba Pantai Cahaya
      return <LumbaLumbaKendalIcon size={size} color="#0284C7" />;

    case 'reg_33_25': // Kab. Batang - Nelayan & Kapal Layar
      return <NelayanBatangIcon size={size} color="#0284C7" />;

    case 'reg_33_26': // Kab. Pekalongan - Batik Canting
      return <BatikPekalonganIcon size={size} color={color} />;

    case 'reg_33_27': // Kab. Pemalang - Pantai Widuri
      return <PantaiWiduriPemalangIcon size={size} color="#0284C7" />;

    case 'reg_33_28': // Kab. Tegal - Poci Teh Slawi
      return <PociTegalIcon size={size} color="#B45309" />;

    case 'reg_33_29': // Kab. Brebes - Bawang Merah & Telur Asin
      return <BawangBrebesIcon size={size} color="#E11D48" />;

    default:
      return <TuguMudaSemarangIcon size={size} color={color} />;
  }
}
