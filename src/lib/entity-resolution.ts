export function normalizeEntityText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENTITY_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: "صندوق الاستثمارات العامة",
    aliases: ["pif", "public investment fund", "صندوق الاستثمارات العامة", "صندوق الاستثمارات العامه"],
  },
  {
    canonical: "المركز الوطني للتخصيص",
    aliases: ["ncp", "national center for privatization", "المركز الوطني للتخصيص", "المركز الوطني للتخصيص والشراكة بين القطاعين العام والخاص"],
  },
  {
    canonical: "الشركة السعودية لشراكات المياه",
    aliases: ["swpc", "saudi water partnership company", "الشركة السعودية لشراكات المياه", "الشركه السعوديه لشراكات المياه"],
  },
  {
    canonical: "وزارة البلديات والإسكان",
    aliases: ["momah", "moh", "ministry of municipalities and housing", "وزارة البلديات والإسكان", "وزارة الشؤون البلدية والقروية والإسكان"],
  },
  {
    canonical: "منصة فرص",
    aliases: ["furas", "فرص", "منصة فرص", "البوابة الموحدة للاستثمار في المدن السعودية"],
  },
  {
    canonical: "منصة مقاول",
    aliases: ["muqawil", "مقاول", "منصة مقاول", "الهيئة السعودية للمقاولين"],
  },
];

const aliasMap = new Map<string, string>();
for (const group of ENTITY_ALIASES) {
  aliasMap.set(normalizeEntityText(group.canonical), group.canonical);
  for (const alias of group.aliases) aliasMap.set(normalizeEntityText(alias), group.canonical);
}

export function canonicalEntityName(value: string): string {
  const normalized = normalizeEntityText(value);
  if (!normalized) return value.trim();
  const exact = aliasMap.get(normalized);
  if (exact) return exact;

  for (const [alias, canonical] of aliasMap) {
    if (alias.length >= 6 && (normalized.includes(alias) || alias.includes(normalized))) return canonical;
  }
  return value.trim();
}

export function entityAliasSeedRows(): Array<{ entity_type: string; canonical_name: string; alias: string; normalized_alias: string; confidence: number }> {
  return ENTITY_ALIASES.flatMap((group) => [group.canonical, ...group.aliases].map((alias) => ({
    entity_type: "organization",
    canonical_name: group.canonical,
    alias,
    normalized_alias: normalizeEntityText(alias),
    confidence: 1,
  })));
}
