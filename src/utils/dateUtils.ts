/**
 * Formats a Date object to YYYY-MM-DD string in local timezone (not UTC)
 * This prevents timezone shift issues where dates can shift by one day
 * when using toISOString() which converts to UTC.
 * 
 * @param date - The Date object to format
 * @returns A string in format "YYYY-MM-DD" in local timezone
 */
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


