import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { HarnessMeta } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function complexityBadgeClass(level?: string | null): string {
  switch ((level || '').toUpperCase()) {
    case 'L1': return 'badge badge-l1';
    case 'L2': return 'badge badge-l2';
    case 'L3': return 'badge badge-l3';
    default:   return 'badge badge-l1';
  }
}

/** Pretty-print a harness slug, e.g. "qwenpaw" → "QwenPaw". */
export function harnessLabel(
  slug: string,
  meta?: Record<string, HarnessMeta>,
): string {
  return meta?.[slug]?.display ?? defaultHarnessLabel(slug);
}

export function harnessVersion(
  slug: string,
  meta?: Record<string, HarnessMeta>,
): string | undefined {
  const v = meta?.[slug]?.version;
  return v ? v : undefined;
}

function defaultHarnessLabel(slug: string): string {
  if (!slug) return slug;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
