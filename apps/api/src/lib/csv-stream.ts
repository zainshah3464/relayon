import type { Response } from 'express';

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function startCsvResponse(res: Response, filename: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.write('\uFEFF'); // BOM for Excel
}

export function writeCsvRow(res: Response, fields: unknown[]): void {
  res.write(fields.map(escapeCsvField).join(',') + '\r\n');
}