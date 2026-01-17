import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const normalizeKey = (key: string): string => {
  if (key === ' ') return 'Space';
  if (key === 'Control') return 'Ctrl';
  if (key === 'ArrowUp') return 'Up';
  if (key === 'ArrowDown') return 'Down';
  if (key === 'ArrowLeft') return 'Left';
  if (key === 'ArrowRight') return 'Right';
  if (key.length === 1) return key.toUpperCase();
  return key;
};

export const sortKeys = (keys: string[]): string[] => {
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta', 'Cmd'];
  return keys.sort((a, b) => {
    const aIsMod = modifiers.includes(a);
    const bIsMod = modifiers.includes(b);
    if (aIsMod && !bIsMod) return -1;
    if (!aIsMod && bIsMod) return 1;
    return a.localeCompare(b);
  });
};
