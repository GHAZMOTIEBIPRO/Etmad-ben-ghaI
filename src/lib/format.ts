export const currency = new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
export const number = new Intl.NumberFormat("ar-SA");
export function formatDate(value: string | null | undefined) { if (!value) return "—"; return new Intl.DateTimeFormat("ar-SA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)); }
export function statusLabel(status: string) { const labels: Record<string, string> = { open: "مفتوحة", closed: "مغلقة", awarded: "تمت الترسية", cancelled: "ملغاة" }; return labels[status] ?? status; }
