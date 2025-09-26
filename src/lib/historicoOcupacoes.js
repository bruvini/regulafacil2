// Histórico e Análise de Ocupações - Business Intelligence Helper
import { addDoc, serverTimestamp } from './firebase';
import { getHistoricoOcupacoesCollection } from './firebase';
import { logAction } from './auditoria';

/**
 * Registra uma ocupação finalizada no histórico para análise BI
 * @param {Object} paciente - Dados do paciente
 * @param {Object} leito - Dados do leito
 * @param {string} motivoSaida - Motivo da saída (Alta, Transferência Externa, Óbito, etc.)
 */
export async function registrarHistoricoOcupacao(paciente, leito, motivoSaida) {
  try {
    const historicoData = {
      pacienteNome: paciente.nomePaciente,
      leitoId: leito.id,
      leitoCodigoLeito: leito.codigoLeito, // Para facilitar análises
      setorId: leito.setorId,
      setorNome: leito.setorNome, // Para facilitar análises
      especialidade: paciente.especialidade,
      dataEntrada: paciente.dataInternacao,
      dataSaida: serverTimestamp(),
      motivoSaida,
      timestamp: serverTimestamp()
    };

    await addDoc(getHistoricoOcupacoesCollection(), historicoData);
    
    await logAction(
      'Sistema BI',
      `Histórico de ocupação registrado: ${paciente.nomePaciente} (${motivoSaida})`,
      null
    );
  } catch (error) {
    console.error('Erro ao registrar histórico de ocupação:', error);
    // Não bloquear o fluxo principal por erro de BI
  }
}

/**
 * Calcula a permanência em dias entre duas datas
 * @param {Date|Timestamp} dataEntrada 
 * @param {Date|Timestamp} dataSaida 
 * @returns {number} Dias de permanência
 */
export function calcularPermanenciaEmDias(dataEntrada, dataSaida) {
  if (!dataEntrada || !dataSaida) return 0;
  
  const entrada = dataEntrada.toDate ? dataEntrada.toDate() : new Date(dataEntrada);
  const saida = dataSaida.toDate ? dataSaida.toDate() : new Date(dataSaida);
  
  const diffTime = Math.abs(saida - entrada);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calcula tempo de permanência atual para pacientes internados
 * @param {Date|Timestamp} dataInternacao 
 * @returns {number} Dias de permanência atual
 */
export function calcularPermanenciaAtual(dataInternacao) {
  if (!dataInternacao) return 0;
  
  const entrada = dataInternacao.toDate ? dataInternacao.toDate() : new Date(dataInternacao);
  const hoje = new Date();
  
  const diffTime = Math.abs(hoje - entrada);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}