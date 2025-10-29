// src/pages/RegulacoesAtivasPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { getPacientesCollection, getSetoresCollection } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Clock, RefreshCw } from 'lucide-react';
import { getIniciaisPaciente } from '@/lib/utils';

// Hook para calcular o tempo de duração
const useTempoDeRegulacao = (dataInicio) => {
  const [tempo, setTempo] = useState('');

  useEffect(() => {
    if (!dataInicio) {
      setTempo('N/A');
      return;
    }

    const data = dataInicio.toDate ? dataInicio.toDate() : new Date(dataInicio);

    const calcularTempo = () => {
      setTempo(formatDistanceToNow(data, { addSuffix: false, locale: ptBR }));
    };

    calcularTempo();
    const interval = setInterval(calcularTempo, 60000); // Atualiza a cada minuto

    return () => clearInterval(interval);
  }, [dataInicio]);

  return tempo;
};

// Componente do Item da Regulação (Read-Only)
const RegulacaoItem = ({ regulacao }) => {
  const tempoDeRegulacao = useTempoDeRegulacao(regulacao.iniciadoEm);
  const dataInicioFormatada = regulacao.iniciadoEm?.toDate 
    ? regulacao.iniciadoEm.toDate().toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : 'N/A';

  return (
    <TableRow>
      <TableCell className="font-medium">{regulacao.nomePaciente}</TableCell>
      <TableCell>{regulacao.descricaoLeitoOrigem || 'N/A'}</TableCell>
      <TableCell className="text-center">
        <ArrowRight className="h-4 w-4 text-primary mx-auto" />
      </TableCell>
      <TableCell>{regulacao.descricaoLeitoDestino || 'N/A'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm">{dataInicioFormatada}</span>
            <span className="text-xs text-muted-foreground">({tempoDeRegulacao})</span>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
};

const RegulacoesAtivasPage = () => {
  const [regulacoes, setRegulacoes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [filtroDestino, setFiltroDestino] = useState('todos');

  // Buscar dados em tempo real (Regulações e Setores)
  useEffect(() => {
    // Query para pacientes COM 'regulacaoAtiva'
    const q = query(getPacientesCollection(), where("regulacaoAtiva", "!=", null));
    
    const unsubscribePacientes = onSnapshot(q, (snapshot) => {
      const regulacoesAtivas = snapshot.docs.map(doc => ({
        id: doc.id,
        // LGPD: Anonimizar nome do paciente exibindo apenas iniciais
        nomePaciente: getIniciaisPaciente(doc.data().nomePaciente),
        ...doc.data().regulacaoAtiva
      }));
      setRegulacoes(regulacoesAtivas);
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });

    // Busca de setores (para os filtros)
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        nomeSetor: doc.data().nomeSetor,
        siglaSetor: doc.data().siglaSetor,
      })).sort((a, b) => a.nomeSetor.localeCompare(b.nomeSetor));
      setSetores(setoresData);
    });

    return () => {
      unsubscribePacientes();
      unsubscribeSetores();
    };
  }, []);

  // Lógica de filtragem
  const regulacoesFiltradas = useMemo(() => {
    return regulacoes.filter(reg => {
      const origemOk = filtroOrigem === 'todos' || reg.setorOrigemId === filtroOrigem;
      const destinoOk = filtroDestino === 'todos' || reg.setorDestinoId === filtroDestino;
      return origemOk && destinoOk;
    }).sort((a, b) => {
      const dateA = a.iniciadoEm?.toDate ? a.iniciadoEm.toDate() : new Date(0);
      const dateB = b.iniciadoEm?.toDate ? b.iniciadoEm.toDate() : new Date(0);
      return dateA - dateB;
    }); // Mais antigas primeiro
  }, [regulacoes, filtroOrigem, filtroDestino]);

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 md:p-8">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">RegulaFacil</h1>
        <p className="text-lg text-muted-foreground">Regulações em Andamento</p>
      </header>

      <Card className="shadow-card">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <CardTitle>Movimentações Pendentes</CardTitle>
            <RefreshCw className="h-4 w-4 text-primary animate-spin" />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            {/* Filtro de Origem */}
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Origens</SelectItem>
                {setores.map(setor => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.siglaSetor || setor.nomeSetor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Filtro de Destino */}
            <Select value={filtroDestino} onValueChange={setFiltroDestino}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por Destino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Destinos</SelectItem>
                {setores.map(setor => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.siglaSetor || setor.nomeSetor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <p className="text-muted-foreground">Carregando regulações...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Início (Duração)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regulacoesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            Nenhuma regulação em andamento.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    regulacoesFiltradas.map(reg => (
                      <RegulacaoItem key={reg.id} regulacao={reg} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          {!loading && regulacoesFiltradas.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Total: {regulacoesFiltradas.length} regulação(ões) em andamento
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RegulacoesAtivasPage;
