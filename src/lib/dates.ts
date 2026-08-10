// 计算下一次纪念日的日期与倒计时天数
export function nextOccurrence(date: Date, yearly: boolean, now: Date = new Date()): Date {
  if (!yearly) return date;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  if (next < today) next = new Date(now.getFullYear() + 1, date.getMonth(), date.getDate());
  return next;
}

// 距离下一次还有多少天（0 = 就是今天）
export function daysUntil(date: Date, yearly: boolean, now: Date = new Date()): number {
  const next = nextOccurrence(date, yearly, now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

// 已经过去多少周年（用于展示“第 N 周年”）
export function yearsSince(date: Date, now: Date = new Date()): number {
  let years = now.getFullYear() - date.getFullYear();
  const anniv = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  if (new Date(now.getFullYear(), now.getMonth(), now.getDate()) < anniv) years -= 1;
  return years;
}
