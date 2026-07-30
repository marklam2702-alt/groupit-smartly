import { AREAS_OF_EXPERTISE, INDUSTRY_SECTORS } from "@/lib/grouping";

export interface CategoryDef {
  name: string;
  items: string[];
}

export interface CategoryConfig {
  first: CategoryDef;
  second: CategoryDef;
}

export const DEFAULT_CATEGORIES: CategoryConfig = {
  first: { name: "Industry Sector", items: [...INDUSTRY_SECTORS] },
  second: { name: "Area of Expertise", items: [...AREAS_OF_EXPERTISE] },
};

export function normalizeCategories(raw: unknown): CategoryConfig {
  const c = raw as Partial<CategoryConfig> | null | undefined;
  const pick = (d: Partial<CategoryDef> | undefined, fallback: CategoryDef): CategoryDef => {
    const items = Array.isArray(d?.items)
      ? d!.items.map((i) => String(i).trim()).filter(Boolean)
      : [];
    return {
      name: (d?.name && String(d.name).trim()) || fallback.name,
      items: items.length ? items : fallback.items,
    };
  };
  return {
    first: pick(c?.first, DEFAULT_CATEGORIES.first),
    second: pick(c?.second, DEFAULT_CATEGORIES.second),
  };
}

/** Build the Category.xlsx template rows for the given config. */
export function categoriesToRows(cfg: CategoryConfig): (string | null)[][] {
  const rows: (string | null)[][] = Array.from({ length: 40 }, () => ["", ""]);
  rows[0] = ["Category", "First Category"];
  rows[1] = ["Category Name", cfg.first.name];
  for (let i = 0; i < 16; i++) rows[2 + i] = ["item", cfg.first.items[i] ?? ""];
  rows[22] = ["Category", "Second Category"];
  rows[23] = ["Category Name", cfg.second.name];
  for (let i = 0; i < 16; i++) rows[24 + i] = ["item", cfg.second.items[i] ?? ""];
  return rows;
}

/** Parse a sheet (array of rows, B column = index 1) back into a config. */
export function rowsToCategories(rows: unknown[][]): CategoryConfig {
  const cell = (r: number) => {
    const v = rows[r - 1]?.[1];
    return v == null ? "" : String(v).trim();
  };
  const range = (from: number, to: number) => {
    const out: string[] = [];
    for (let r = from; r <= to; r++) {
      const v = cell(r);
      if (v) out.push(v);
    }
    return out;
  };
  const first = { name: cell(2), items: range(3, 18) };
  const second = { name: cell(24), items: range(25, 40) };
  if (!first.items.length || !second.items.length) {
    throw new Error("The file has no category items — check cells B3:B18 and B25:B40.");
  }
  return normalizeCategories({ first, second });
}
