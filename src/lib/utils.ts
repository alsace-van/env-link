import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extrait un message d'erreur détaillé à partir d'une erreur
 */
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  
  return (
    error?.message ||
    error?.error_description ||
    error?.error ||
    error?.details ||
    JSON.stringify(error) ||
    "Erreur inconnue"
  );
}
