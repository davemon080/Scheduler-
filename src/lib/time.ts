/**
 * Formats a 24-hour time string (e.g. "14:30" or "08:00") into a 12-hour format with am/pm suffix (e.g. "2:30pm" or "8:00am").
 */
export function formatTimeSlot(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // "0" maps to "12"
  return `${hours}:${minutes}${ampm}`;
}

/**
 * Returns a full display slot for period, e.g. "8:00am - 10:00am"
 */
export function formatTimerange(start: string | undefined | null, end: string | undefined | null): string {
  if (!start && !end) return '';
  if (!start) return formatTimeSlot(end);
  if (!end) return formatTimeSlot(start);
  return `${formatTimeSlot(start)} - ${formatTimeSlot(end)}`;
}
