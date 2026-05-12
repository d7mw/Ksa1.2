// Date parsing helpers — ensures naive ISO strings from the backend
// (e.g. "2025-01-15T10:30:00") are treated as UTC, then converted to
// the user's local timezone automatically by the browser.

export const parseUTC = (iso) => {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  const s = typeof iso === 'string' && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? `${iso}Z` : iso;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const formatDateTime = (iso, lang = 'ar') => {
  const d = parseUTC(iso);
  if (!d) return '';
  return d.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatMonthYear = (iso, lang = 'ar') => {
  const d = parseUTC(iso);
  if (!d) return '';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
  });
};

export const timeAgo = (iso, lang = 'ar') => {
  const date = parseUTC(iso);
  if (!date) return '';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return lang === 'ar' ? 'الآن' : 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === 'ar' ? `منذ ${min} د` : `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return lang === 'ar' ? `منذ ${h} س` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return lang === 'ar' ? `منذ ${d} ي` : `${d}d`;
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');
};
