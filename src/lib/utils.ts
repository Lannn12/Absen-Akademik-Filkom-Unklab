import { clsx, type ClassValue } from 'clsx';

/**
 * Utility to merge class names conditionally.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format date to Indonesian locale string.
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time to HH:MM Indonesian locale.
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format datetime to full Indonesian locale string.
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Calculate duration between two timestamps in minutes.
 */
export function calculateDuration(
  checkIn: string | Date,
  checkOut: string | Date
): number {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Calculate tingkat from semester.
 */
export function calculateTingkat(semester: number): number {
  return Math.ceil(semester / 2);
}

/**
 * Get risk level color.
 */
export function getRiskColor(level: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'bg-red-500/15 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return colors[level];
}

/**
 * Export JSON data to CSV and trigger download.
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(fieldName => {
        const value = row[fieldName];
        const escaped = ('' + value).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
