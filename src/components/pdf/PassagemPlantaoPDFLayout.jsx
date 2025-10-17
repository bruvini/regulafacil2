import React from 'react';
import { format } from 'date-fns';

const styles = {
  page: {
    width: '210mm',
    minHeight: '296mm',
    padding: '15mm',
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '12px',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '12mm',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
  },
  headerInfo: {
    margin: '2mm 0',
  },
  section: {
    marginBottom: '10mm',
  },
  itemContainer: {
    pageBreakInside: 'avoid',
    marginBottom: '8px',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: '14px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #000000',
    paddingBottom: '3mm',
    marginBottom: '4mm',
  },
  subSection: {
    marginBottom: '5mm',
    paddingBottom: '3mm',
    borderBottom: '1px solid #dddddd',
  },
  subSectionTitle: {
    fontWeight: 'bold',
    fontSize: '12px',
    margin: '0 0 2mm 0',
  },
  infoText: {
    margin: '0 0 2mm 0',
  },
  listBlock: {
    marginBottom: '3mm',
  },
  listTitle: {
    fontWeight: 'bold',
    marginBottom: '1.5mm',
  },
  list: {
    margin: 0,
    paddingLeft: '5mm',
  },
  listItem: {
    marginBottom: '1mm',
    pageBreakInside: 'avoid',
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#333333',
  },
  observacoesText: {
    whiteSpace: 'pre-wrap',
    fontSize: '12px',
    color: '#333333',
    lineHeight: 1.5,
    margin: 0,
  },
};

const turnoLabels = {
  DIURNO: 'Diurno',
  MATUTINO: 'Matutino',
  VESPERTINO: 'Vespertino',
  NOTURNO: 'Noturno',
};

const renderList = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div style={{ ...styles.listBlock, ...styles.itemContainer }}>
      <p style={styles.listTitle}>{label}</p>
      <ul style={styles.list}>
        {items.map((item, index) => (
          <li key={`${label}-${index}`} style={styles.listItem}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

const renderEmptyMessage = (message) => (
  <p style={{ ...styles.infoText, ...styles.emptyText }}>{message}</p>
);

const PassagemPlantaoPDFLayout = ({ data, pdfInfo }) => {
  const {
    uti = [],
    centroCirurgico = {},
    emergencia = {},
    emergenciaOrdenada = [],
    enfermaria = [],
    outros = [],
    observacoesGerais = '',
  } = data || {};

  const dataPlantao =
    pdfInfo?.data instanceof Date ? format(pdfInfo.data, 'dd/MM/yyyy') : '';
  const turno = turnoLabels[pdfInfo?.turno] || pdfInfo?.turno || '';

  const centroCirurgicoBlocos = [
    centroCirurgico?.recuperacao,
    centroCirurgico?.salasCirurgicas,
  ].filter(Boolean);

  const emergenciaFallback = [
    emergencia?.avcAgudo,
    emergencia?.salaEmergencia,
    emergencia?.salaLaranja,
    emergencia?.psDecisaoClinica,
    emergencia?.psDecisaoCirurgica,
  ].filter(Boolean);
  const emergenciaBlocos = Array.isArray(emergenciaOrdenada) && emergenciaOrdenada.length > 0
    ? emergenciaOrdenada
    : emergenciaFallback;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Relatório de Passagem de Plantão</h1>
        <p style={styles.headerInfo}>
          Data: <strong>{dataPlantao || '—'}</strong> | Turno:{' '}
          <strong>{turno || '—'}</strong>
        </p>
        <p style={styles.headerInfo}>
          Enfermeiro(a) Responsável: <strong>{pdfInfo?.enfermeiro || '—'}</strong>
        </p>
        <p style={styles.headerInfo}>
          Médico(a) Responsável: <strong>{pdfInfo?.medico || '—'}</strong>
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Enfermaria</h2>
        {enfermaria.length === 0 &&
          renderEmptyMessage('Nenhum setor de enfermaria disponível.')}
        {enfermaria.map((setor) => {
          const dados = setor?.dadosPlantao;
          const todasListas = dados
            ? [
                dados.isolamentos,
                dados.leitosRegulados,
                dados.pedidosUTI,
                dados.transferencias,
                dados.provaveisAltas,
                dados.altasNoLeito,
                dados.reservasExternas,
                dados.observacoes,
                dados.leitosVagos,
                dados.listaEsperaOncologia,
              ]
            : [];

          return (
            <div
              key={setor.id || setor.nomeSetor}
              style={{ ...styles.subSection, ...styles.itemContainer }}
            >
              <h3 style={styles.subSectionTitle}>{setor.nomeSetor}</h3>
              {dados ? (
                <>
                  {renderList('Isolamentos', dados.isolamentos)}
                  {renderList('Leitos Regulados (Reservados)', dados.leitosRegulados)}
                  {renderList('Pedidos de UTI', dados.pedidosUTI)}
                  {renderList('Transferências Externas', dados.transferencias)}
                  {renderList('Prováveis Altas', dados.provaveisAltas)}
                  {renderList('Altas no Leito', dados.altasNoLeito)}
                  {renderList('Reservas Externas', dados.reservasExternas)}
                  {renderList('Observações Relevantes', dados.observacoes)}
                  {renderList(
                    'Leitos Vagos',
                    dados.leitosVagos?.map((leito) => {
                      const compat =
                        leito.compatibilidade && leito.compatibilidade !== 'Livre'
                          ? ` - ${leito.compatibilidade}`
                          : '';
                      return `${leito.codigoLeito} (${leito.status})${compat}`;
                    }),
                  )}
                  {renderList(
                    'Lista de Espera (Oncologia)',
                    dados.listaEsperaOncologia?.map((item) => item.texto),
                  )}
                  {todasListas.every((lista) => !lista || lista.length === 0) &&
                    renderEmptyMessage('Nenhuma pendência registrada para este setor.')}
                </>
              ) : (
                renderEmptyMessage('Dados não disponíveis para este setor.')
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Unidades de Terapia Intensiva (UTI)</h2>
        {uti.length === 0 && renderEmptyMessage('Nenhum registro disponível para UTIs.')}
        {uti.map((setor) => (
          <div
            key={setor.id || setor.nome}
            style={{ ...styles.subSection, ...styles.itemContainer }}
          >
            <h3 style={styles.subSectionTitle}>{setor.nome}</h3>
            {renderList('Prováveis Altas', setor.provaveisAltas)}
            {renderList('Regulações em Andamento', setor.regulacoes)}
            {renderList('Pedidos de Remanejamento', setor.remanejamentos)}
            {renderList('Transferências Externas', setor.transferencias)}
            {renderList('Observações Relevantes', setor.observacoes)}
            {[
              setor.provaveisAltas,
              setor.regulacoes,
              setor.remanejamentos,
              setor.transferencias,
              setor.observacoes,
            ].every((lista) => !lista || lista.length === 0) &&
              renderEmptyMessage('Nenhuma pendência registrada para este setor.')}
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Centro Cirúrgico</h2>
        {centroCirurgicoBlocos.length === 0 &&
          renderEmptyMessage('Nenhum bloco do centro cirúrgico disponível.')}
        {centroCirurgicoBlocos.map((bloco) => (
          <div
            key={bloco.nome}
            style={{ ...styles.subSection, ...styles.itemContainer }}
          >
            <h3 style={styles.subSectionTitle}>{bloco.nome}</h3>
            {bloco.existe ? (
              <>
                <p style={styles.infoText}>
                  Pacientes Internados: <strong>{bloco.pacientesInternados}</strong>
                </p>
                {renderList('Aguardando UTI', bloco.aguardandoUti)}
                {renderList('Regulações em Andamento', bloco.regulacoes)}
                {renderList('Transferências Externas', bloco.transferencias)}
                {renderList('Observações', bloco.observacoes)}
                {[
                  bloco.aguardandoUti,
                  bloco.regulacoes,
                  bloco.transferencias,
                  bloco.observacoes,
                ].every((lista) => !lista || lista.length === 0) &&
                  renderEmptyMessage('Nenhuma pendência registrada para este bloco.')}
              </>
            ) : (
              renderEmptyMessage('Setor não disponível no momento.')
            )}
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Emergência</h2>
        {emergenciaBlocos.length === 0 &&
          renderEmptyMessage('Nenhum setor de emergência disponível.')}
        {emergenciaBlocos.map((bloco) => (
          <div
            key={bloco.nome}
            style={{ ...styles.subSection, ...styles.itemContainer }}
          >
            <h3 style={styles.subSectionTitle}>{bloco.nome}</h3>
            {bloco.existe ? (
              <>
                <p style={styles.infoText}>
                  Pacientes Internados: <strong>{bloco.pacientesInternados}</strong>
                </p>
                {renderList('Aguardando UTI', bloco.aguardandoUti)}
                {renderList('Pedidos de Remanejamento', bloco.remanejamentos)}
                {renderList('Pacientes em Isolamento', bloco.isolamentos)}
                {renderList('Transferências Externas', bloco.transferencias)}
                {renderList('Observações', bloco.observacoes)}
                {[
                  bloco.aguardandoUti,
                  bloco.remanejamentos,
                  bloco.isolamentos,
                  bloco.transferencias,
                  bloco.observacoes,
                ].every((lista) => !lista || lista.length === 0) &&
                  renderEmptyMessage('Nenhuma pendência registrada para este setor.')}
              </>
            ) : (
              renderEmptyMessage('Setor não disponível no momento.')
            )}
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Outros Setores</h2>
        {outros.length === 0 &&
          renderEmptyMessage('Nenhum outro setor cadastrado no momento.')}
        {outros
          .filter((grupo) => Array.isArray(grupo.setores) && grupo.setores.length > 0)
          .map((grupo) => (
            <div
              key={grupo.tipo}
              style={{ ...styles.subSection, ...styles.itemContainer }}
            >
              <h3 style={styles.subSectionTitle}>{grupo.tipo}</h3>
              <ul style={styles.list}>
                {grupo.setores.map((setor) => (
                  <li key={setor.id} style={styles.listItem}>
                    {setor.nome}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Observações Gerais</h2>
        <p style={styles.observacoesText}>
          {observacoesGerais || 'Nenhuma observação registrada.'}
        </p>
      </div>
    </div>
  );
};

export default PassagemPlantaoPDFLayout;

