import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getSetoresCollection,
  getLeitosCollection,
  getPacientesCollection,
  getInfeccoesCollection,
  getAuditoriaCollection,
  onSnapshot,
  query,
  where,
  orderBy
} from '@/lib/firebase';

const PassagemPlantaoModal = ({ isOpen, onClose, periodo }) => {
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [auditoriaData, setAuditoriaData] = useState([]);

  // Buscar dados em tempo real
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribes = [];

    // Setores
    const unsubSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      setSetores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    unsubscribes.push(unsubSetores);

    // Leitos
    const unsubLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      setLeitos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    unsubscribes.push(unsubLeitos);

    // Pacientes
    const unsubPacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      setPacientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    unsubscribes.push(unsubPacientes);

    // Infecções
    const unsubInfeccoes = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      setInfeccoes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    unsubscribes.push(unsubInfeccoes);

    // Dados históricos de auditoria
    if (periodo?.inicio && periodo?.fim) {
      const auditoriaQuery = query(
        getAuditoriaCollection(),
        where("timestamp", ">=", periodo.inicio),
        where("timestamp", "<=", periodo.fim),
        orderBy("timestamp", "desc")
      );

      const unsubAuditoria = onSnapshot(auditoriaQuery, (snapshot) => {
        setAuditoriaData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(unsubAuditoria);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub?.());
    };
  }, [isOpen, periodo]);

  // Processamento dos dados
  const dadosProcessados = useMemo(() => {
    if (!setores.length || !leitos.length || !pacientes.length) {
      return [];
    }

    // Mapas para facilitar lookup
    const setoresPorId = new Map(setores.map(s => [s.id, s]));
    const leitosPorId = new Map(leitos.map(l => [l.id, l]));
    const infeccoesPorId = new Map(infeccoes.map(i => [i.id, i]));

    // Agrupar por setor
    const dadosPorSetor = new Map();

    setores.forEach(setor => {
      const leitosDoSetor = leitos.filter(l => l.setorId === setor.id);
      const pacientesDoSetor = pacientes.filter(p => {
        const leito = leitosPorId.get(p.leitoId);
        return leito?.setorId === setor.id;
      });

      // Isolamentos ativos
      const isolamentosAtivos = pacientesDoSetor.filter(p => 
        p.isolamentos && Array.isArray(p.isolamentos) && p.isolamentos.length > 0
      ).map(paciente => {
        const leito = leitosPorId.get(paciente.leitoId);
        const isolamentosSiglas = paciente.isolamentos
          .map(iso => {
            if (typeof iso === 'string') return iso;
            const infeccao = infeccoesPorId.get(iso.infecaoId || iso.infeccaoId || iso.id);
            return infeccao?.siglaInfeccao || infeccao?.sigla || iso.sigla || 'ISOLA';
          })
          .join(' ');
        
        return {
          codigoLeito: leito?.codigoLeito || 'S/L',
          nomePaciente: paciente.nome || 'Nome não informado',
          isolamentos: isolamentosSiglas
        };
      });

      // Regulações em andamento
      const regulacoesAndamento = pacientesDoSetor.filter(p => p.regulacaoAtiva).map(paciente => {
        const leitoOrigem = leitosPorId.get(paciente.leitoId);
        const leitoDestino = leitosPorId.get(paciente.regulacaoAtiva.leitoDestinoId);
        const setorDestino = setoresPorId.get(leitoDestino?.setorId);
        
        // Calcular tempo de espera
        const tempoEspera = paciente.regulacaoAtiva.timestamp ? 
          Math.floor((Date.now() - new Date(paciente.regulacaoAtiva.timestamp).getTime()) / (1000 * 60)) : 0;
        const horas = Math.floor(tempoEspera / 60);
        const minutos = tempoEspera % 60;
        
        return {
          leitoOrigem: leitoOrigem?.codigoLeito || 'S/L',
          leitoDestino: leitoDestino?.codigoLeito || 'S/L',
          setorDestino: setorDestino?.siglaSetor || 'S/S',
          nomePaciente: paciente.nome || 'Nome não informado',
          tempoEspera: `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`
        };
      });

      // Leitos vagos/higienização
      const leitosVagos = leitosDoSetor.filter(l => 
        ['vago', 'higienizacao'].includes((l.status || l.statusLeito || '').toLowerCase())
      ).map(leito => ({
        codigoLeito: leito.codigoLeito || 'S/C',
        status: leito.status || leito.statusLeito || 'VAGO'
      }));

      // Pedidos (UTI, Remanejamento, Transferência)
      const pedidos = pacientesDoSetor.filter(p => 
        p.pedidoUTI || p.pedidoRemanejamento || p.pedidoTransferenciaExterna
      ).map(paciente => {
        const leito = leitosPorId.get(paciente.leitoId);
        let tipoPedido = '';
        if (paciente.pedidoUTI) tipoPedido = 'UTI';
        else if (paciente.pedidoRemanejamento) tipoPedido = 'REMANEJAMENTO';
        else if (paciente.pedidoTransferenciaExterna) tipoPedido = 'TRANSFERÊNCIA EXTERNA';
        
        return {
          codigoLeito: leito?.codigoLeito || 'S/L',
          nomePaciente: paciente.nome || 'Nome não informado',
          tipoPedido
        };
      });

      // Leitos PCP
      const leitosPCP = leitosDoSetor.filter(l => l.isPCP).map(leito => {
        const paciente = pacientes.find(p => p.leitoId === leito.id);
        return {
          codigoLeito: leito.codigoLeito || 'S/C',
          nomePaciente: paciente?.nome || null,
          sexoCompativel: leito.sexoCompativel || 'AMBOS',
          ocupado: !!paciente
        };
      });

      dadosPorSetor.set(setor.id, {
        setor,
        isolamentosAtivos,
        regulacoesAndamento,
        leitosVagos,
        pedidos,
        leitosPCP
      });
    });

    return Array.from(dadosPorSetor.values())
      .filter(dados => {
        // Só inclui setores que têm alguma informação relevante
        return dados.isolamentosAtivos.length > 0 ||
               dados.regulacoesAndamento.length > 0 ||
               dados.leitosVagos.length > 0 ||
               dados.pedidos.length > 0 ||
               dados.leitosPCP.length > 0;
      })
      .sort((a, b) => (a.setor.nomeSetor || a.setor.siglaSetor || '').localeCompare(
        b.setor.nomeSetor || b.setor.siglaSetor || '', 'pt-BR'
      ));
  }, [setores, leitos, pacientes, infeccoes]);

  const SetorCard = ({ dados }) => {
    const { setor, isolamentosAtivos, regulacoesAndamento, leitosVagos, pedidos, leitosPCP } = dados;

    return (
      <Card className="mb-4 bg-gray-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-gray-800 border-b-2 border-gray-300 pb-2">
            {setor.nomeSetor || setor.siglaSetor || 'Setor sem nome'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ISOLAMENTOS */}
          {isolamentosAtivos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                ISOLAMENTOS
              </h4>
              <div className="space-y-1 text-sm">
                {isolamentosAtivos.map((item, idx) => (
                  <div key={idx} className="text-red-700 font-bold">
                    {item.codigoLeito} {item.nomePaciente} / ISOLA {item.isolamentos}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REGULAÇÕES EM ANDAMENTO */}
          {regulacoesAndamento.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                REGULAÇÕES EM ANDAMENTO
              </h4>
              <div className="space-y-1 text-sm">
                {regulacoesAndamento.map((item, idx) => (
                  <div key={idx}>
                    {item.leitoOrigem} → {item.setorDestino} - {item.leitoDestino} {item.nomePaciente} (Ativa há {item.tempoEspera})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEITOS VAGOS / HIGIENIZAÇÃO */}
          {leitosVagos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                LEITOS VAGOS / HIGIENIZAÇÃO
              </h4>
              <div className="space-y-1 text-sm">
                {leitosVagos.map((item, idx) => (
                  <div key={idx}>
                    {item.codigoLeito} - {item.status.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PEDIDOS */}
          {pedidos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                PEDIDOS (UTI, Remanejamento, Transferência)
              </h4>
              <div className="space-y-1 text-sm">
                {pedidos.map((item, idx) => (
                  <div key={idx} className="font-bold">
                    {item.codigoLeito} {item.nomePaciente} / PEDIDO {item.tipoPedido}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEITOS PCP */}
          {leitosPCP.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                LEITOS PCP
              </h4>
              <div className="space-y-1 text-sm">
                {leitosPCP.map((item, idx) => (
                  <div key={idx} className="text-blue-700 font-bold">
                    ##PCP {item.codigoLeito} {item.ocupado ? item.nomePaciente : `${item.sexoCompativel} VAGO`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6" />
            Passagem de Plantão
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[80vh]">
          <div className="bg-gray-50 p-4 sm:p-6 lg:p-8">
            {/* Header do Relatório */}
            <div className="mb-6 pb-4 border-b-2 border-gray-300">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Relatório de Passagem de Plantão
              </h2>
              {periodo && (
                <p className="text-gray-600 mb-4">
                  Período: {format(periodo.inicio, "PPP 'às' HH:mm", { locale: ptBR })} até {format(periodo.fim, "PPP 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
              
              <div className="flex gap-3">
                <Button variant="outline" disabled className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Gerar PDF
                </Button>
                <Button variant="outline" disabled className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Observações do Plantão
                </Button>
              </div>
            </div>

            {/* Conteúdo por Setor */}
            {dadosProcessados.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhuma informação relevante encontrada para o período selecionado.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {dadosProcessados.map((dados) => (
                  <SetorCard key={dados.setor.id} dados={dados} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PassagemPlantaoModal;