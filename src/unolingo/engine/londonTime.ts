const LONDON_TZ = 'Europe/London';
export const ARCHIVE_DAYS_COUNT = 183;

const londonDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LONDON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const londonPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Returns the current date string in Europe/London as YYYY-MM-DD.
 */
export function getLondonDateStr(date: Date = new Date()): string {
  try {
    return londonDateFormatter.format(date);
  } catch {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Computes milliseconds remaining until the next 00:00:00 in Europe/London.
 * Handles GMT/BST transitions accurately using Intl parts.
 */
export function getMsUntilNextLondonMidnight(now: Date = new Date()): number {
  const parts = londonPartsFormatter.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');

  const h = get('hour') % 24;
  const m = get('minute');
  const s = get('second');
  const ms = now.getMilliseconds();

  const elapsedTodayMs = ((h * 60 + m) * 60 + s) * 1000 + ms;
  const approxRemaining = Math.max(1000, 24 * 60 * 60 * 1000 - elapsedTodayMs);

  const todayStr = getLondonDateStr(now);
  let targetTime = now.getTime() + approxRemaining;

  if (
    getLondonDateStr(new Date(targetTime - 2000)) === todayStr &&
    getLondonDateStr(new Date(targetTime + 2000)) === todayStr
  ) {
    targetTime += 60 * 60 * 1000;
  }

  if (getLondonDateStr(new Date(targetTime - 60 * 60 * 1000 + 2000)) !== todayStr) {
    targetTime -= 60 * 60 * 1000;
  }

  return Math.max(0, targetTime - now.getTime());
}

/**
 * Returns YYYY-MM-DD shifted by deltaDays from baseDateStr.
 */
export function shiftDateStr(baseDateStr: string, deltaDays: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Returns the 6-month archive list (today + trailing 182 days = 183 puzzles) in Europe/London.
 */
export function getArchiveDateRange(
  daysCount: number = ARCHIVE_DAYS_COUNT,
  now: Date = new Date()
): string[] {
  const today = getLondonDateStr(now);
  const dates: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    dates.push(shiftDateStr(today, -i));
  }
  return dates;
}

export function getArchiveBounds(todayLondonStr: string = getLondonDateStr()): {
  minDateStr: string;
  maxDateStr: string;
} {
  return {
    minDateStr: shiftDateStr(todayLondonStr, -(ARCHIVE_DAYS_COUNT - 1)),
    maxDateStr: todayLondonStr,
  };
}

export function isDateInArchive(
  dateStr: string,
  todayLondonStr: string = getLondonDateStr()
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const { minDateStr, maxDateStr } = getArchiveBounds(todayLondonStr);
  return dateStr >= minDateStr && dateStr <= maxDateStr;
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}
