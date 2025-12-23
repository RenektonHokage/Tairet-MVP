/**
 * Formatting utilities for currency and dates
 */

/**
 * Formats a number as Paraguayan Guaraní currency
 * @param value - The number to format
 * @returns Formatted string with thousands separator and "Gs" suffix
 */
export const formatPYG = (value: number): string => {
  return `${value.toLocaleString()} Gs`;
};

/**
 * Formats event date(s) in Spanish Paraguay locale
 * @param startIso - ISO date string for event start
 * @param endIso - Optional ISO date string for event end
 * @returns Formatted date string
 */
export const formatEventDate = (startIso: string, endIso?: string): string => {
  const startDate = new Date(startIso);
  
  if (!endIso) {
    return startDate.toLocaleDateString('es-PY', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  const endDate = new Date(endIso);
  
  // If same day, show single date
  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString('es-PY', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  // Different days, show range
  const startFormatted = startDate.toLocaleDateString('es-PY', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  const endFormatted = endDate.toLocaleDateString('es-PY', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
  
  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Formats a date for short display (DD/MM format)
 * @param dateString - ISO date string
 * @returns Short formatted date string
 */
export const formatShortDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PY', { 
    day: '2-digit', 
    month: '2-digit' 
  });
};

/**
 * Formats a date for reservation display
 * @param dateStr - ISO date string
 * @returns Formatted date string for reservations
 */
export const formatReservationDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};