export interface FhirPatient {
  id: string;
  name: string;
  birthDate?: string | Date | null;
  gender: string;
  extension?: Array<{ url: string; valueString?: string; valueBoolean?: boolean }>;
}

export interface FhirLocation {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'inactive';
  type?: string; 
  identifier?: string; 
  partOf?: string; 
}

export interface FhirEncounter {
  id: string;
  subject: { reference: string }; 
  period: { start: string | Date | number; end?: string | Date | number };
  location: Array<{ location: { reference: string } }>;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: string; 
}

export interface FhirFlag {
  id: string;
  subject: { reference: string };
  code: { text: string }; 
  status: 'active' | 'inactive';
}

export interface RegulacaoSuggestion {
  paciente: FhirPatient;
  encounter: FhirEncounter;
  score: number;
  motivos: string[];
  isolamentos: string[];
}

export function validateHospitalData(hospitalData: any): any[] {
  if (!hospitalData || !hospitalData.estrutura) {
    console.debug('[RegulacaoService] estrutura recebida: undefined/null -> fallback []');
    return [];
  }

  const estrutura = hospitalData.estrutura;
  const tipo = Array.isArray(estrutura) ? 'array' : typeof estrutura;
  
  console.debug(`[RegulacaoService] estrutura recebida: tipo=${tipo}`);

  if (Array.isArray(estrutura)) {
    return estrutura;
  }

  if (typeof estrutura === 'object') {
    return Object.values(estrutura).filter(Boolean);
  }

  return [];
}
