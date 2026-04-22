export type RawIngredient = { name: string; amount: string };
export type MergedIngredient = {
  name: string;
  display: string; // e.g. "900g" or "2 ss + 1 stk"
  sources: string[]; // raw amount strings this came from
};

/**
 * Units we can sum together. All of a unit's variants collapse to a
 * canonical lowercase key.
 */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gr: 'g',
  gram: 'g',
  kg: 'kg',
  ml: 'ml',
  dl: 'dl',
  l: 'l',
  liter: 'l',
  ss: 'ss',
  tsp: 'ts',
  ts: 'ts',
  stk: 'stk',
  pcs: 'stk',
  pc: 'stk',
  boks: 'boks',
  pakke: 'pakke',
  klype: 'klype',
  pinch: 'klype',
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Extract a numeric quantity + unit from a string like "250g", "1.5 dl",
 * "2 ss", "1/2 kopp". Returns null if the shape isn't recognised.
 */
function parseAmount(raw: string): { value: number; unit: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Match leading number (int, decimal with . or ,, or simple fraction like 1/2)
  const m = trimmed.match(/^([\d]+(?:[.,]\d+)?|\d+\/\d+)\s*([a-zA-ZåøæÅØÆ]+)?/);
  if (!m) return null;

  let numStr = m[1];
  let value: number;
  if (numStr.includes('/')) {
    const [a, b] = numStr.split('/').map(Number);
    if (!b) return null;
    value = a / b;
  } else {
    value = parseFloat(numStr.replace(',', '.'));
  }
  if (isNaN(value)) return null;

  const rawUnit = (m[2] ?? '').toLowerCase();
  const unit = UNIT_ALIASES[rawUnit] ?? rawUnit;
  return { value, unit };
}

function formatAmount(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  if (!unit) return str;
  // No space before unit for compact units (g/kg/ml/dl/l), space for word units
  if (['g', 'kg', 'ml', 'dl', 'l'].includes(unit)) return `${str}${unit}`;
  return `${str} ${unit}`;
}

export function mergeIngredients(raw: RawIngredient[]): MergedIngredient[] {
  const map = new Map<string, { name: string; groups: Map<string, number>; raws: string[] }>();

  for (const ing of raw) {
    const key = normalizeName(ing.name);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name: ing.name.trim(), groups: new Map(), raws: [] });
    }
    const entry = map.get(key)!;
    entry.raws.push(ing.amount);
    const parsed = parseAmount(ing.amount);
    if (parsed && parsed.unit) {
      entry.groups.set(parsed.unit, (entry.groups.get(parsed.unit) ?? 0) + parsed.value);
    } else {
      // unparseable — stash under a special bucket
      entry.groups.set(`__raw:${ing.amount.trim().toLowerCase()}`, 1);
    }
  }

  const out: MergedIngredient[] = [];
  for (const entry of map.values()) {
    const parts: string[] = [];
    for (const [unit, value] of entry.groups.entries()) {
      if (unit.startsWith('__raw:')) {
        parts.push(unit.slice('__raw:'.length));
      } else {
        parts.push(formatAmount(value, unit));
      }
    }
    out.push({
      name: entry.name,
      display: parts.join(' + '),
      sources: entry.raws,
    });
  }

  // Sort alphabetically by name for a predictable list
  out.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  return out;
}
