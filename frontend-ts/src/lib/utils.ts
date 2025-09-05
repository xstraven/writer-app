import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}