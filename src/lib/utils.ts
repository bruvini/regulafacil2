import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Anonimiza nome de paciente exibindo apenas iniciais (LGPD compliance)
 * @param nomeCompleto - Nome completo do paciente
 * @returns Iniciais do nome (ex: "Bruno Vinicius da Silva" -> "B. V. S.")
 */
export function getIniciaisPaciente(nomeCompleto: string | null | undefined): string {
  if (!nomeCompleto) return 'N/A';
  
  const partesIgnoradas = ['de', 'da', 'do', 'dos', 'das', 'e'];
  
  return nomeCompleto
    .trim()
    .split(' ')
    .filter(parte => parte.length > 0 && !partesIgnoradas.includes(parte.toLowerCase()))
    .map(parte => `${parte.charAt(0).toUpperCase()}.`)
    .join(' ');
}
