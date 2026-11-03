const TZ = "Europe/Madrid";
const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

function parts(ms: number) {
  const p = Object.fromEntries(formatter.formatToParts(new Date(ms)).map(x => [x.type, x.value])) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}
function offset(ms: number) {
  const p = parts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}
const pad = (n: number) => String(n).padStart(2, "0");

/** UTC ISO instant of 00:00 Madrid time for a YYYY-MM-DD day. */
export function madridDayStart(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!);
  let t = guess - offset(guess);
  t = guess - offset(t);
  return new Date(t).toISOString();
}
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}
export function madridToday(now = new Date()) {
  const p = parts(now.getTime());
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
/** Monday (YYYY-MM-DD) of the Madrid week containing `day`. */
export function weekStart(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const dow = (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}
export function madridDateTime(iso: string | null) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const p = parts(ms);
  return `${pad(p.d)}/${pad(p.m)}/${p.y} ${pad(p.h)}:${pad(p.mi)}`;
}
