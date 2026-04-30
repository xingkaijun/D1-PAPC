import { format } from 'date-fns';

export const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const safeFormatDate = (
  value: unknown,
  pattern: string,
  fallback = '—'
): string => {
  const date = toValidDate(value);
  return date ? format(date, pattern) : fallback;
};
