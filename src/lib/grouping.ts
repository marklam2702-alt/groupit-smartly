export const INDUSTRY_SECTORS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Manufacturing",
  "Retail",
  "Media",
  "Energy",
  "Others",
] as const;

export const AREAS_OF_EXPERTISE = [
  "Engineering",
  "Marketing",
  "Sales",
  "Design",
  "Operations",
  "Human Resources",
  "Legal",
  "Data Science",
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
  ["Technology", "Media", "High"],
  ["Technology", "Finance", "Medium"],
  ["Technology", "Education", "Medium"],
  ["Technology", "Manufacturing", "Low"],
  ["Finance", "Retail", "Medium"],
  ["Finance", "Education", "Low"],
  ["Healthcare", "Education", "Medium"],
  ["Healthcare", "Manufacturing", "Low"],
  ["Manufacturing", "Energy", "High"],
  ["Manufacturing", "Retail", "Medium"],
  ["Retail", "Media", "Medium"],
  ["Media", "Education", "Low"],
  ["Energy", "Technology", "Low"],
]);

export const EXPERTISE_SIMILARITY: SimMap<Expertise> = symmetric<Expertise>([
  ["Engineering", "Data Science", "High"],
  ["Engineering", "Design", "Medium"],
  ["Engineering", "Operations", "Medium"],
  ["Marketing", "Sales", "High"],
  ["Marketing", "Design", "Medium"],
  ["Sales", "Operations", "Medium"],
  ["Design", "Marketing", "Medium"],
  ["Operations", "Human Resources", "Medium"],
  ["Human Resources", "Legal", "Medium"],
  ["Legal", "Operations", "Low"],
  ["Data Science", "Marketing", "Low"],
]);

export interface Sample {
  id: string;
  nickName: string;
  industry: Industry;
  industryOther?: string;
  expertise: Expertise;
  expertiseOther?: string;
}

const SIM_WEIGHT: Record<Similarity, number> = { High: 3, Medium: 2, Low: 1 };

function industrySim(a: Sample, b: Sample): number {
  if (a.industry === b.industry) {
    if (a.industry === "Others") {
      return a.industryOther && a.industryOther === b.industryOther ? 10 : 0;
    }
    return 10;
  }
  const s = INDUSTRY_SIMILARITY[a.industry]?.[b.industry];
  return s ? SIM_WEIGHT[s] : 0;
}

function expertiseSim(a: Sample, b: Sample): number {
  if (a.expertise === b.expertise) {
    if (a.expertise === "Others") {
      return a.expertiseOther && a.expertiseOther === b.expertiseOther ? 20 : 0;
    }
    return 20;
  }
  const s = EXPERTISE_SIMILARITY[a.expertise]?.[b.expertise];
  return s ? SIM_WEIGHT[s] * 2 : 0;
}

/** Priority score between two samples: expertise dominates industry. */
export function pairScore(a: Sample, b: Sample): number {
  // Weighted so ordering matches the spec priority:
  // same expertise > same industry > similar industry (H>M>L) > similar expertise (H>M>L)
  const sameExp = a.expertise === b.expertise && a.expertise !== "Others" ? 1000 : 0;
  const sameExpOther =
    a.expertise === "Others" && b.expertise === "Others" && a.expertiseOther === b.expertiseOther
      ? 1000
      : 0;
  const sameInd = a.industry === b.industry && a.industry !== "Others" ? 500 : 0;
  const sameIndOther =
    a.industry === "Others" && b.industry === "Others" && a.industryOther === b.industryOther
      ? 500
      : 0;

  const simInd = INDUSTRY_SIMILARITY[a.industry]?.[b.industry];
  const simIndScore = simInd ? { High: 300, Medium: 200, Low: 100 }[simInd] : 0;

  const simExp = EXPERTISE_SIMILARITY[a.expertise]?.[b.expertise];
  const simExpScore = simExp ? { High: 30, Medium: 20, Low: 10 }[simExp] : 0;

  return sameExp + sameExpOther + sameInd + sameIndOther + simIndScore + simExpScore;
}

export interface GroupResult {
  groups: Sample[][];
  targetSizes: number[];
}

export function sortIntoGroups(samples: Sample[], groupCount = 4): GroupResult {
  const n = samples.length;
  const base = Math.floor(n / groupCount);
  const extra = n % groupCount;
  const targetSizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));

  const groups: Sample[][] = Array.from({ length: groupCount }, () => []);
  if (n === 0) return { groups, targetSizes };

  // Phase 1: cluster by (expertise + expertiseOther, industry + industryOther)
  const keyOf = (s: Sample) =>
    `${s.expertise}::${s.expertiseOther ?? ""}||${s.industry}::${s.industryOther ?? ""}`;
  const expKeyOf = (s: Sample) => `${s.expertise}::${s.expertiseOther ?? ""}`;

  // First, cluster tightly: same expertise + same industry
  const clusters = new Map<string, Sample[]>();
  for (const s of samples) {
    const k = keyOf(s);
    if (!clusters.has(k)) clusters.set(k, []);
    clusters.get(k)!.push(s);
  }
  // Merge tight clusters into larger expertise-clusters (Phase 1 priority: same expertise)
  const expClusters = new Map<string, Sample[]>();
  for (const s of samples) {
    const k = expKeyOf(s);
    if (!expClusters.has(k)) expClusters.set(k, []);
    expClusters.get(k)!.push(s);
  }

  // Sort each expertise cluster internally so same-industry members are adjacent
  const orderedClusters = Array.from(expClusters.values())
    .map((arr) => {
      const byInd = new Map<string, Sample[]>();
      for (const s of arr) {
        const ik = `${s.industry}::${s.industryOther ?? ""}`;
        if (!byInd.has(ik)) byInd.set(ik, []);
        byInd.get(ik)!.push(s);
      }
      return Array.from(byInd.values()).flat();
    })
    .sort((a, b) => b.length - a.length);

  const remaining: Sample[] = [];

  // Assign clusters round-robin to the least-full group that has capacity,
  // keeping same-expertise members together as much as possible.
  for (const cluster of orderedClusters) {
    for (const person of cluster) {
      // Find groups with capacity
      const candidates = groups
        .map((g, i) => ({ g, i, room: targetSizes[i] - g.length }))
        .filter((c) => c.room > 0);
      if (candidates.length === 0) {
        remaining.push(person);
        continue;
      }
      // Score each candidate: prefer group with existing members most similar to person
      candidates.sort((a, b) => {
        const sa = a.g.reduce((sum, m) => sum + pairScore(person, m), 0);
        const sb = b.g.reduce((sum, m) => sum + pairScore(person, m), 0);
        if (sb !== sa) return sb - sa;
        // Tie-break: prefer emptier group for balance
        return b.room - a.room;
      });
      candidates[0].g.push(person);
    }
  }

  // Fill remainders (shouldn't happen but safe)
  for (const person of remaining) {
    const target = groups
      .map((g, i) => ({ g, i, room: targetSizes[i] - g.length }))
      .filter((c) => c.room > 0)
      .sort((a, b) => b.room - a.room)[0];
    if (target) target.g.push(person);
    else groups[0].push(person);
  }

  return { groups, targetSizes };
}
