const TIME_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
});

/** Giờ HH:MM:SS theo chuẩn vi-VN. */
export function formatClock(ms: number | null): string {
  if (!ms) return "—";
  return TIME_FORMAT.format(new Date(ms));
}

/** Hôm nay thì chỉ giờ, ngày khác thì kèm ngày/tháng. */
export function formatActivityTime(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const time = TIME_FORMAT.format(d);
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${DATE_FORMAT.format(d)} ${time}`;
}
