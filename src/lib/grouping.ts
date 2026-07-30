export const INDUSTRY_SECTORS = [
  "Construction and Real Estate",
  "Education",
  "Energy and Utilities",
  "Financial and Professional Services",
  "Healthcare and Pharmaceuticals",
  "Hospitality, Tourism, and Entertainment",
  "Information and Communication Technology",
  "Retail and E-commerce",
  "Transportation, Logistics, and Supply Chain",
  "Others",
] as const;

export const AREAS_OF_EXPERTISE = [
  "Artificial Intelligence and Data Analytics",
  "Corporate Finance and Capital Allocation",
  "Formal and Professional Educator",
  "Human Capital Management",
  "Precision Engineering and Smart Manufacturing",
  "Regulatory Compliance and Corporate Governance",
  "Software Engineering and Cybersecurity",
  "Strategic Marketing and Brand Management",
  "Supply Chain Optimization and Logistics",
  "Others",
] as const;

export type Industry = (typeof INDUSTRY_SECTORS)[number];
export type Expertise = (typeof AREAS_OF_EXPERTISE)[number];
export type Similarity = "High" | "Medium" | "Low";

type SimMap<T extends string> = Partial<Record<T, Partial<Record<T, Similarity>>>>;

// Symmetric similarity mapping helper
function symmetric<T extends string>(entries: Array<[T, T, Similarity]>): SimMap<T> {
  const map: SimMap<T> = {};
  for (const [a, b, s] of entries) {
    (map[a] ??= {} as Partial<Record<T, Similarity>>)[b] = s;
    (map[b] ??= {} as Partial<Record<T, Similarity>>)[a] = s;
  }
  return map;
}

export const INDUSTRY_SIMILARITY: SimMap<Industry> = symmetric<Industry>([
  ["Healthcare and Pharmaceuticals", "Education", "Medium"],
  ["Healthcare and Pharmaceuticals", "Information and Communication Technology", "Medium"],
  ["Healthcare and Pharmaceuticals", "Hospitality, Tourism, and Entertainment", "Low"],
  ["Financial and Professional Services", "Information and Communication Technology", "Medium"],
  ["Financial and Professional Services", "Construction and Real Estate", "Medium"],
  ["Financial and Professional Services", "Retail and E-commerce", "Medium"],
  ["Financial and Professional Services", "Education", "Low"],
  ["Information and Communication Technology", "Retail and E-commerce", "High"],
  ["Information and Communication Technology", "Transportation, Logistics, and Supply Chain", "Medium"],
  ["Information and Communication Technology", "Education", "Medium"],
  ["Energy and Utilities", "Construction and Real Estate", "Medium"],
  ["Energy and Utilities", "Transportation, Logistics, and Supply Chain", "Medium"],
  ["Energy and Utilities", "Information and Communication Technology", "Low"],
  ["Construction and Real Estate", "Transportation, Logistics, and Supply Chain", "Low"],
  ["Retail and E-commerce", "Transportation, Logistics, and Supply Chain", "High"],
  ["Retail and E-commerce", "Hospitality, Tourism, and Entertainment", "Medium"],
  ["Transportation, Logistics, and Supply Chain", "Hospitality, Tourism, and Entertainment", "Medium"],
  ["Hospitality, Tourism, and Entertainment", "Education", "Low"],
]);

export const EXPERTISE_SIMILARITY: SimMap<Expertise> = symmetric<Expertise>([
  ["Artificial Intelligence and Data Analytics", "Software Engineering and Cybersecurity", "High"],
  ["Artificial Intelligence and Data Analytics", "Supply Chain Optimization and Logistics", "Medium"],
  ["Artificial Intelligence and Data Analytics", "Strategic Marketing and Brand Management", "Medium"],
  ["Artificial Intelligence and Data Analytics", "Precision Engineering and Smart Manufacturing", "Medium"],
  ["Supply Chain Optimization and Logistics", "Precision Engineering and Smart Manufacturing", "Medium"],
  ["Supply Chain Optimization and Logistics", "Software Engineering and Cybersecurity", "Medium"],
  ["Corporate Finance and Capital Allocation", "Regulatory Compliance and Corporate Governance", "Medium"],
  ["Corporate Finance and Capital Allocation", "Strategic Marketing and Brand Management", "Low"],
  ["Regulatory Compliance and Corporate Governance", "Human Capital Management", "Low"],
  ["Software Engineering and Cybersecurity", "Precision Engineering and Smart Manufacturing", "Medium"],
  ["Software Engineering and Cybersecurity", "Strategic Marketing and Brand Management", "Low"],
  ["Strategic Marketing and Brand Management", "Human Capital Management", "Low"],
  ["Human Capital Management", "Formal and Professional Educator", "Medium"],
  ["Formal and Professional Educator", "Artificial Intelligence and Data Analytics", "Low"],
]);

export interface Individual {
  id: string;
  nickName: string;
  industry: Industry;
  industryOther?: string;
  expertise: Expertise;
  expertiseOther?: string;
}

const SIM_WEIGHT: Record<Similarity, number> = { High: 3, Medium: 2, Low: 1 };

function industrySim(a: Individual, b: Individual): number {
  if (a.industry === b.industry) {
    if (a.industry === "Others") {
      return a.industryOther && a.industryOther === b.industryOther ? 10 : 0;
    }
    return 10;
  }
  const s = INDUSTRY_SIMILARITY[a.industry]?.[b.industry];
  return s ? SIM_WEIGHT[s] : 0;
}

function expertiseSim(a: Individual, b: Individual): number {
  if (a.expertise === b.expertise) {
    if (a.expertise === "Others") {
      return a.expertiseOther && a.expertiseOther === b.expertiseOther ? 20 : 0;
    }
    return 20;
  }
  const s = EXPERTISE_SIMILARITY[a.expertise]?.[b.expertise];
  return s ? SIM_WEIGHT[s] * 2 : 0;
}

/** Priority score between two individuals: expertise dominates industry. */
export function pairScore(a: Individual, b: Individual): number {
  // Weighted so ordering matches the spec priority:
  // same expertise > same industry > similar industry (H>M>L) > similar expertise (H>M>L)
  const sameExp = a.expertise === b.expertise && a.expertise !== "Others" ? 1000 : 0;
  const sameExpOther =
    a.expertise === "Others" && b.expertise === "Others" && a.expertiseOther === b.expertiseOther ? 1000 : 0;
  const sameInd = a.industry === b.industry && a.industry !== "Others" ? 500 : 0;
  const sameIndOther =
    a.industry === "Others" && b.industry === "Others" && a.industryOther === b.industryOther ? 500 : 0;

  const simInd = INDUSTRY_SIMILARITY[a.industry]?.[b.industry];
  const simIndScore = simInd ? { High: 300, Medium: 200, Low: 100 }[simInd] : 0;

  const simExp = EXPERTISE_SIMILARITY[a.expertise]?.[b.expertise];
  const simExpScore = simExp ? { High: 30, Medium: 20, Low: 10 }[simExp] : 0;

  return sameExp + sameExpOther + sameInd + sameIndOther + simIndScore + simExpScore;
}

export const GROUP_NAMES = ["Alpha", "Beta", "Gamma", "Delta"] as const;

/** Which category drives the bucketing: the first (industry) or second (expertise). */
export type GroupingBasis = "first" | "second";

export interface GroupResult {
  groups: Individual[][];
  targetSizes: number[];
  basis?: GroupingBasis;
}

/**
 * Industry-driven snake assignment:
 * 1. Count individuals per industry sector.
 * 2. Largest industry -> Alpha, 2nd -> Beta, 3rd -> Gamma, 4th -> Delta
 * 3. 5th -> Delta, 6th -> Gamma, 7th -> Beta, 8th -> Alpha (continues snaking)
 * 4. Rebalance so all groups have equal size (+/- 1).
 */
export function sortIntoGroups(
  individuals: Individual[],
  groupCount = 4,
  basis: GroupingBasis = "first",
): GroupResult {
  const n = individuals.length;
  const base = Math.floor(n / groupCount);
  const extra = n % groupCount;
  const targetSizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));

  const groups: Individual[][] = Array.from({ length: groupCount }, () => []);
  if (n === 0) return { groups, targetSizes, basis };

  const primaryKey = (s: Individual) =>
    basis === "first"
      ? s.industry === "Others"
        ? `Others::${s.industryOther ?? ""}`
        : s.industry
      : s.expertise === "Others"
        ? `Others::${s.expertiseOther ?? ""}`
        : s.expertise;
  const secondaryKey = (s: Individual) =>
    basis === "first" ? `${s.expertise}::${s.expertiseOther ?? ""}` : `${s.industry}::${s.industryOther ?? ""}`;

  // 1. Bucket by the chosen primary category (Others split by the free-text value)
  const buckets = new Map<string, Individual[]>();
  for (const s of individuals) {
    const k = primaryKey(s);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(s);
  }

  // Order buckets by size (desc); keep same-secondary-category members adjacent inside a bucket
  const ordered = Array.from(buckets.values())
    .map((arr) => {
      const bySecond = new Map<string, Individual[]>();
      for (const s of arr) {
        const ek = secondaryKey(s);
        if (!bySecond.has(ek)) bySecond.set(ek, []);
        bySecond.get(ek)!.push(s);
      }
      return Array.from(bySecond.values())
        .sort((a, b) => b.length - a.length)
        .flat();
    })
    .sort((a, b) => b.length - a.length);


  // 2 & 3. Snake order: 0,1,2,3,3,2,1,0,0,1,...
  ordered.forEach((bucket, idx) => {
    const cycle = Math.floor(idx / groupCount);
    const pos = idx % groupCount;
    const target = cycle % 2 === 0 ? pos : groupCount - 1 - pos;
    groups[target].push(...bucket);
  });

  // 4. Rebalance to equal sizes, moving the least "attached" member each time
  let guard = 0;
  while (guard++ < n * groupCount + 100) {
    const over = groups.findIndex((g, i) => g.length > targetSizes[i]);
    const under = groups.findIndex((g, i) => g.length < targetSizes[i]);
    if (over === -1 || under === -1) break;

    const src = groups[over];
    const dst = groups[under];
    let bestIdx = 0;
    let bestDelta = -Infinity;
    src.forEach((person, i) => {
      const loss = src.reduce((sum, m) => (m.id === person.id ? sum : sum + fitScore(person, m, basis)), 0);
      const gain = dst.reduce((sum, m) => sum + fitScore(person, m, basis), 0);
      const delta = gain - loss;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    });
    dst.push(src.splice(bestIdx, 1)[0]);
  }

  return { groups, targetSizes, basis };
}

/** pairScore oriented to the chosen primary category. */
export function fitScore(a: Individual, b: Individual, basis: GroupingBasis = "first"): number {
  if (basis === "first") return pairScore(a, b);
  // Swap the two categories so the second one dominates.
  const flip = (p: Individual): Individual => ({
    ...p,
    industry: p.expertise as unknown as Individual["industry"],
    industryOther: p.expertiseOther,
    expertise: p.industry as unknown as Individual["expertise"],
    expertiseOther: p.industryOther,
  });
  const fa = flip(a);
  const fb = flip(b);
  const sameExp = fa.expertise === fb.expertise && fa.expertise !== "Others" ? 1000 : 0;
  const sameExpOther =
    fa.expertise === "Others" && fb.expertise === "Others" && fa.expertiseOther === fb.expertiseOther ? 1000 : 0;
  const sameInd = fa.industry === fb.industry && fa.industry !== "Others" ? 500 : 0;
  const sameIndOther =
    fa.industry === "Others" && fb.industry === "Others" && fa.industryOther === fb.industryOther ? 500 : 0;
  const simInd = EXPERTISE_SIMILARITY[a.expertise]?.[b.expertise];
  const simIndScore = simInd ? { High: 300, Medium: 200, Low: 100 }[simInd] : 0;
  const simExp = INDUSTRY_SIMILARITY[a.industry]?.[b.industry];
  const simExpScore = simExp ? { High: 30, Medium: 20, Low: 10 }[simExp] : 0;
  return sameExp + sameExpOther + sameInd + sameIndOther + simIndScore + simExpScore;
}


/**
 * Incremental assignment: keeps every previously grouped individual exactly
 * where they are and only places the newcomers into the best-fitting group
 * that still has room (keeping group sizes equal +/- 1).
 */
export function assignNewIndividuals(
  existingGroups: Individual[][],
  newcomers: Individual[],
  groupCount = 4,
): GroupResult {
  const groups: Individual[][] = Array.from({ length: groupCount }, (_, i) => [...(existingGroups[i] ?? [])]);
  const n = groups.reduce((sum, g) => sum + g.length, 0) + newcomers.length;
  const base = Math.floor(n / groupCount);
  const extra = n % groupCount;
  const targetSizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));

  for (const person of newcomers) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < groupCount; i++) {
      // Groups already at or above their target only take newcomers if nothing else can.
      const roomPenalty = groups[i].length >= targetSizes[i] ? 1_000_000 : 0;
      const fit = groups[i].reduce((sum, m) => sum + pairScore(person, m), 0);
      const score = fit - roomPenalty - groups[i].length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    groups[bestIdx].push(person);
  }

  return { groups, targetSizes };
}
