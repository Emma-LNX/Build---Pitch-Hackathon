import type { Gender, Outfit, OutfitPresentation, WardrobeState } from '../../types';

/**
 * Umbrales de desbloqueo (XP acumulada). Valores PROVISIONALES para el demo;
 * ajustar aquí sin tocar el resto del código.
 */
export const UNLOCK_THRESHOLDS = {
  inicial: 0,
  primero: 100,
  segundo: 250,
  tercero: 450,
} as const;

/* Fuentes citadas por varias fichas */
const TRC_HUIPILES = {
  label: 'Textile Research Centre (Leiden): “1210 huipiles from Guatemala”',
  url: 'https://www.trc-leiden.nl/trc/index.php/en/blog/1210-huipiles-from-guatemala',
};
const DEGUATE_ATITLAN = {
  label: 'Deguate: “Traje típico de Santiago Atitlán”',
  url: 'https://www.deguate.com/arte-cultura/vestimenta-guatemala/traje-tipico-de-santiago-atitlan.shtml',
};
const PRENSA_ATITLAN = {
  label: 'Prensa Libre: “Tradición textil maya: Santiago Atitlán, Sololá”',
  url: 'https://www.prensalibre.com/vida/escenario/tradicion-textil-maya-santiago-atitlan-solola/',
};

/**
 * Catálogo del guardarropa: indumentaria de comunidades de Guatemala.
 *
 * Reglas (ver docs/guardarropa.md):
 * - Cada ficha describe solo lo que dicen sus fuentes; lo no documentado va en `pendingDetails`.
 * - Ninguna ficha está `verificado` todavía: las ilustraciones son interpretaciones
 *   de descripciones publicadas y deben revisarse con el Museo Ixchel o la comunidad.
 * - Todos los conjuntos tienen el mismo valor: no hay rarezas ni ventajas.
 */
export const OUTFITS: Outfit[] = [
  /* ---------- Presentación femenina ---------- */
  {
    id: 'chichicastenango-f',
    name: 'Traje de Chichicastenango',
    community: 'Chichicastenango',
    department: 'Quiché',
    linguisticCommunity: 'K’iche’',
    presentation: 'femenina',
    description:
      'Huipil de tres lienzos con brocados y cuello circular bordado con picos. Corte de fondo oscuro con líneas finas y jaspe, sujeto con una faja de colores.',
    pendingDetails: 'Los colores exactos del huipil son aproximados.',
    sources: [
      {
        label: 'Prensa Libre: “Tradición textil maya: Chichicastenango, Quiché”',
        url: 'https://www.prensalibre.com/vida/escenario/tradicion-textil-maya-chichicastenango-quiche/',
      },
      TRC_HUIPILES,
    ],
    xpRequired: UNLOCK_THRESHOLDS.inicial,
    review: 'en-revision',
  },
  {
    id: 'san-juan-sacatepequez-f',
    name: 'Traje de San Juan Sacatepéquez',
    community: 'San Juan Sacatepéquez',
    department: 'Guatemala',
    linguisticCommunity: 'Kaqchikel',
    presentation: 'femenina',
    description: 'Huipil de franjas anchas, sobre todo moradas y amarillas, con brocado en la zona de los hombros.',
    pendingDetails: 'El corte de la ilustración es liso porque aún no está documentado.',
    sources: [TRC_HUIPILES],
    xpRequired: UNLOCK_THRESHOLDS.primero,
    review: 'en-revision',
  },
  {
    id: 'nebaj-f',
    name: 'Traje de Nebaj',
    community: 'Santa María Nebaj',
    department: 'Quiché',
    linguisticCommunity: 'Ixil',
    presentation: 'femenina',
    description:
      'Corte rojo, huipil de dos lienzos con brocados, faja de colores, perraje sobre el hombro y tocado de cinta con pompones en los extremos.',
    pendingDetails: 'Los colores del huipil y del perraje son aproximados.',
    sources: [
      {
        label: 'Prensa Libre: “Tradición textil maya: Nebaj, Quiché”',
        url: 'https://www.prensalibre.com/vida/escenario/tradicion-textil-maya-nebaj-quiche/',
      },
      { label: 'Museo Ixchel, colección de perrajes: perraje de Nebaj MI-00968', url: 'https://museoixchel.org/coleccion-textil-perrajes/' },
      { label: 'Huipils.com: “Nebaj”', url: 'https://huipils.com/nebaj/' },
    ],
    xpRequired: UNLOCK_THRESHOLDS.segundo,
    review: 'en-revision',
  },
  {
    id: 'santiago-atitlan-f',
    name: 'Traje de Santiago Atitlán',
    community: 'Santiago Atitlán',
    department: 'Sololá',
    linguisticCommunity: 'Tz’utujil',
    presentation: 'femenina',
    description: 'Tocoyal: cinta roja muy larga enrollada alrededor de la cabeza. Huipil con aves bordadas.',
    pendingDetails: 'El corte de la ilustración es liso porque aún no está documentado.',
    sources: [DEGUATE_ATITLAN, PRENSA_ATITLAN],
    xpRequired: UNLOCK_THRESHOLDS.tercero,
    review: 'en-revision',
  },

  /* ---------- Presentación masculina ---------- */
  {
    id: 'todos-santos-m',
    name: 'Traje de Todos Santos Cuchumatán',
    community: 'Todos Santos Cuchumatán',
    department: 'Huehuetenango',
    linguisticCommunity: 'Mam',
    presentation: 'masculina',
    description:
      'Pantalón rojo con rayas blancas, camisa clara de rayas finas con cuello ancho decorado, sobrepantalón negro y sombrero de palma con cinta azul.',
    pendingDetails: 'Las fuentes difieren en el color de las rayas de la camisa.',
    sources: [
      { label: 'Museo Ixchel, colección de camisas: camisa de Todos Santos Cuchumatán MI-06867', url: 'https://museoixchel.org/en/textile-shirts/' },
      { label: 'Deguate: “Todos Santos Cuchumatán”', url: 'https://deguate.com/artman/publish/Huehuetenango_228/todos_santos_cuchumatan.shtml' },
    ],
    xpRequired: UNLOCK_THRESHOLDS.inicial,
    review: 'en-revision',
  },
  {
    id: 'santiago-atitlan-m',
    name: 'Traje de Santiago Atitlán',
    community: 'Santiago Atitlán',
    department: 'Sololá',
    linguisticCommunity: 'Tz’utujil',
    presentation: 'masculina',
    description:
      'Pantalón corto tejido en telar de cintura, con aves y diseños geométricos bordados en el borde inferior; camisa y faja.',
    pendingDetails: 'Las fuentes no coinciden en el color de las franjas del pantalón.',
    sources: [
      { label: 'Museo Ixchel, pieza del mes: pantalón de Santiago Atitlán', url: 'https://ixchelm.squarespace.com/pieza-del-mes' },
      DEGUATE_ATITLAN,
    ],
    xpRequired: UNLOCK_THRESHOLDS.primero,
    review: 'en-revision',
  },
  {
    id: 'solola-m',
    name: 'Traje de Sololá',
    community: 'Sololá',
    department: 'Sololá',
    linguisticCommunity: 'Kaqchikel',
    presentation: 'masculina',
    description: 'Incluye la rodillera (wa’a’): una tela de lana que se envuelve sobre el pantalón.',
    pendingDetails: 'Falta documentar los colores y el diseño de las prendas para ilustrarlo.',
    sources: [{ label: 'Prensa Libre: “Es vestir, no moda”', url: 'https://www.prensalibre.com/revista-d/es-vestir-no-moda/' }],
    xpRequired: UNLOCK_THRESHOLDS.segundo,
    review: 'pendiente-ilustracion',
  },
  {
    id: 'nahuala-m',
    name: 'Traje de Nahualá',
    community: 'Nahualá',
    department: 'Sololá',
    linguisticCommunity: 'K’iche’',
    presentation: 'masculina',
    description: 'Pantalón corto cubierto por la rodillera de lana; los bordados se ubican en la faja y los bordes del pantalón.',
    pendingDetails: 'Las fuentes difieren en los colores de la camisa; falta una referencia para ilustrarlo.',
    sources: [
      { label: 'Deguate: “Traje típico de Nahualá”', url: 'https://www.deguate.com/arte-cultura/vestimenta-guatemala/traje-tipico-de-nahuala.shtml' },
    ],
    xpRequired: UNLOCK_THRESHOLDS.tercero,
    review: 'pendiente-ilustracion',
  },
];

export function presentationFor(gender: Gender): OutfitPresentation {
  return gender === 'nina' ? 'femenina' : 'masculina';
}

/** Catálogo visible para el estudiante: solo su presentación, ordenado por XP. */
export function catalogFor(gender: Gender): Outfit[] {
  const p = presentationFor(gender);
  return OUTFITS.filter((o) => o.presentation === p).sort((a, b) => a.xpRequired - b.xpRequired);
}

/** Un conjunto se puede vestir si ya tiene ilustración. */
export function isWearable(outfit: Outfit): boolean {
  return outfit.review !== 'pendiente-ilustracion';
}

export function initialOutfitId(gender: Gender): string {
  return catalogFor(gender).find((o) => o.xpRequired <= 0 && isWearable(o))!.id;
}

export function findOutfit(id: string | null | undefined): Outfit | undefined {
  return OUTFITS.find((o) => o.id === id);
}

/** Conjunto que se debe mostrar: el equipado si es compatible; si no, el inicial del género. */
export function outfitToWear(wardrobe: WardrobeState | null, gender: Gender): Outfit {
  const presentation = presentationFor(gender);
  const usable = (id: string | undefined) => {
    const o = findOutfit(id);
    return o && o.presentation === presentation && isWearable(o) && (!wardrobe || wardrobe.unlocked.includes(o.id)) ? o : undefined;
  };
  return usable(wardrobe?.equipped) ?? usable(wardrobe?.equippedBy?.[presentation]) ?? findOutfit(initialOutfitId(gender))!;
}

/** Equipa un conjunto y recuerda la elección para su presentación. */
export function withEquipped(wardrobe: WardrobeState, outfit: Outfit): WardrobeState {
  return { ...wardrobe, equipped: outfit.id, equippedBy: { ...wardrobe.equippedBy, [outfit.presentation]: outfit.id } };
}

export function initialWardrobe(studentId: string, gender: Gender): WardrobeState {
  const free = OUTFITS.filter((o) => o.xpRequired <= 0).map((o) => o.id);
  return { studentId, unlocked: free, equipped: initialOutfitId(gender), celebrated: free };
}

/**
 * Agrega los conjuntos cuyo umbral ya se alcanzó, de ambas presentaciones, para
 * que corregir el género conserve el historial. Los desbloqueos son permanentes.
 * Devuelve el mismo objeto si no hubo cambios (idempotente).
 */
export function applyUnlocks(wardrobe: WardrobeState, xp: number): { wardrobe: WardrobeState; newlyUnlocked: string[] } {
  const newlyUnlocked = OUTFITS.filter((o) => o.xpRequired <= xp && !wardrobe.unlocked.includes(o.id)).map((o) => o.id);
  if (newlyUnlocked.length === 0) return { wardrobe, newlyUnlocked };
  return { wardrobe: { ...wardrobe, unlocked: [...wardrobe.unlocked, ...newlyUnlocked] }, newlyUnlocked };
}

/**
 * Tras corregir el género: si el conjunto actual no corresponde, equipa el último
 * elegido para esa presentación o, si no hay, el inicial. Conserva lo desbloqueado.
 */
export function adaptToGender(wardrobe: WardrobeState, gender: Gender): WardrobeState {
  const wearing = outfitToWear(wardrobe, gender);
  return wearing.id === wardrobe.equipped ? wardrobe : withEquipped(wardrobe, wearing);
}

/** Próximo conjunto por desbloquear del catálogo del estudiante. */
export function nextUnlock(wardrobe: WardrobeState, xp: number, gender: Gender) {
  const catalog = catalogFor(gender);
  const next = catalog.find((o) => !wardrobe.unlocked.includes(o.id) && o.xpRequired > xp);
  if (!next) return null;
  const previous = Math.max(0, ...catalog.filter((o) => o.xpRequired <= xp).map((o) => o.xpRequired));
  return { outfit: next, from: previous, remaining: next.xpRequired - xp };
}

export function isUnlocked(wardrobe: WardrobeState, outfitId: string): boolean {
  return wardrobe.unlocked.includes(outfitId);
}

/** Desbloqueos por celebrar: solo del catálogo del estudiante y con ilustración. */
export function pendingCelebrations(wardrobe: WardrobeState, gender: Gender): string[] {
  return catalogFor(gender)
    .filter((o) => isWearable(o) && wardrobe.unlocked.includes(o.id) && !wardrobe.celebrated.includes(o.id))
    .map((o) => o.id);
}
