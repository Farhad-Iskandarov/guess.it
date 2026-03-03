/**
 * Format a UTC date string into the user's local timezone.
 * Returns a human-friendly string like "Today, 21:30" or "Tomorrow, 18:00"
 * 
 * @param {string} utcDateStr - ISO 8601 UTC date string (e.g. "2026-03-02T17:30:00Z")
 * @returns {string} Formatted local time string
 */
export function formatLocalDateTime(utcDateStr) {
  if (!utcDateStr) return '';
  try {
    const dt = new Date(utcDateStr);
    if (isNaN(dt.getTime())) return utcDateStr;

    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matchLocal = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const diffDays = Math.round((matchLocal - todayLocal) / (1000 * 60 * 60 * 24));

    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    if (diffDays === 0) return `Today, ${timeStr}`;
    if (diffDays === 1) return `Tomorrow, ${timeStr}`;
    if (diffDays === -1) return `Yesterday, ${timeStr}`;
    if (diffDays > 1 && diffDays <= 6) {
      const weekday = dt.toLocaleDateString([], { weekday: 'long' });
      return `${weekday}, ${timeStr}`;
    }
    const dateStr = dt.toLocaleDateString([], { day: '2-digit', month: 'short' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return utcDateStr;
  }
}

/**
 * Format a UTC date string into a full local date+time for detail pages.
 * Returns something like "Monday, 2 March 2026 at 21:30"
 * 
 * @param {string} utcDateStr - ISO 8601 UTC date string
 * @returns {string} Full formatted local date and time
 */
export function formatLocalDateTimeFull(utcDateStr) {
  if (!utcDateStr) return '';
  try {
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return utcDateStr;
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return utcDateStr;
  }
}
