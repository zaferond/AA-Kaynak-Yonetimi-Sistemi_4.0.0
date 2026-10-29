import { currentPlanningMonth } from "./resource-dates.ts";
export { SYSTEM_NAME, UI_THEME } from "./branding.ts";
// Hidden by default; a future release can opt in at build time.
export const RISK_MANAGEMENT_ENABLED =
  process.env.AA_RISK_UI_ENABLED === "true";
export const TAB_LABELS = {
  home: "Ana Sayfa",
  plan: "Kaynak Planlama",
  projects: "Projeler",
  risk: "Risk Yönetimi",
  resources: "Organizasyon & Çalışan & Yetki",
  actual: "Aktivite Giriş",
  activity: "Aktivite Raporu",
  critical: "Haftalık Kritik Konular",
  overview: "Raporlar",
  progress: "Proje ve Kaynak Değerlendirme",
};
export const DEFAULT_FILTERS = {
  start: currentPlanningMonth().slice(0, 4) + "-01",
  count: 24,
};
export const ACTUAL_DEFAULT_PERIOD_MONTHS = 24;
