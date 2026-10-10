export type TxType = "expense" | "income";

export const EXPENSE_CATEGORIES = {
  market: "Market",
  yeme_icme: "Yeme-İçme",
  ulasim: "Ulaşım",
  faturalar: "Faturalar",
  kira: "Kira",
  saglik: "Sağlık",
  giyim: "Giyim",
  eglence: "Eğlence",
  abonelik: "Abonelikler",
  egitim: "Eğitim",
  teknoloji: "Teknoloji",
  ev: "Ev",
  kisisel_bakim: "Kişisel Bakım",
  seyahat: "Seyahat",
  hediye: "Hediye",
  diger: "Diğer",
} as const;

export const INCOME_CATEGORIES = {
  maas: "Maaş",
  ek_gelir: "Ek Gelir",
  yatirim: "Yatırım",
  diger_gelir: "Diğer Gelir",
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export type IncomeCategory = keyof typeof INCOME_CATEGORIES;
export type Category = ExpenseCategory | IncomeCategory;

const ALL: Record<string, string> = { ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES };

export function categoryLabel(key: string): string {
  return ALL[key] ?? key;
}

export function isCategory(key: string, type: TxType): boolean {
  return type === "expense" ? key in EXPENSE_CATEGORIES : key in INCOME_CATEGORIES;
}

/** Bilinmeyen kategoriyi türün "diğer" kategorisine indirger. */
export function normalizeCategory(key: string, type: TxType): Category {
  if (isCategory(key, type)) return key as Category;
  return type === "expense" ? "diger" : "diger_gelir";
}
