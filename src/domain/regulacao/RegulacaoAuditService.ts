export interface LogRegulacaoPayload {
  pacienteId: string;
  pacienteNome: string;
  leitoId: string;
  leitoCodigo: string;
  score: number;
  motivos: string[];
  usuarioId: string;
  timestamp?: string;
}

export class RegulacaoAuditService {
  static async logSugestao(payload: LogRegulacaoPayload): Promise<void> {
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const finalPayload = {
      ...payload,
      timestamp: formattedDate
    };

    console.log('[AUDIT REGULACAO]', JSON.stringify(finalPayload, null, 2));
  }
}
