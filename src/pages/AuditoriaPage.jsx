import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getAuditoriaCollection,
  getHistoricoRegulacoesCollection,
  onSnapshot,
  orderBy,
  query,
} from '@/lib/firebase';

const transformHistoricoToLog = (id, data) => {
  let action = `Regulação: ${data.statusFinal || data.status}`;
  let details = `Paciente: ${data.pacienteNome}.`;
  let userName = data.userNameInicio;

  switch (data.statusFinal || data.status) {
    case 'Concluída':
      details += ` Movido do leito ${data.leitoOrigemId} para ${data.leitoDestinoFinalId}.`;
      userName = data.userNameConclusao || data.userNameInicio;
      break;
    case 'Cancelada':
      details += ` Regulação cancelada. Motivo: ${data.motivoCancelamento || 'Não especificado'}.`;
      userName = data.userNameCancelamento || data.userNameInicio;
      break;
    case 'Alterada':
      details += ` Destino alterado para o leito ${data.leitoDestinoFinalId}.`;
      userName = data.userNameAlteracao || data.userNameInicio;
      break;
    default:
      details += ` Solicitação de regulação do leito ${data.leitoOrigemId} para ${data.leitoDestinoId}.`;
      break;
  }

  return {
    id,
    type: 'historico',
    timestamp: data.dataInicio?.toDate(),
    userName,
    action,
    details,
  };
};

const mergeAndSortLogs = (newLogs, existingLogs) => {
  const combined = [...newLogs, ...existingLogs];
  return combined.sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
    return timeB - timeA;
  });
};

const AuditoriaPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);

    const unsubAuditoria = onSnapshot(
      query(getAuditoriaCollection(), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const auditoriaLogs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'auditoria',
            timestamp: data.timestamp?.toDate(),
            userName: data.userName,
            action: data.action,
            details: data.details,
          };
        });

        setLogs((currentLogs) =>
          mergeAndSortLogs(
            auditoriaLogs,
            currentLogs.filter((log) => log.type !== 'auditoria')
          )
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubHistorico = onSnapshot(
      query(getHistoricoRegulacoesCollection(), orderBy('dataInicio', 'desc')),
      (snapshot) => {
        const historicoLogs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return transformHistoricoToLog(doc.id, data);
        });

        setLogs((currentLogs) =>
          mergeAndSortLogs(
            historicoLogs,
            currentLogs.filter((log) => log.type !== 'historico')
          )
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubAuditoria();
      unsubHistorico();
    };
  }, []);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) {
      return logs;
    }

    const lowercasedTerm = searchTerm.toLowerCase();

    return logs.filter(
      (log) =>
        log.userName?.toLowerCase().includes(lowercasedTerm) ||
        log.action?.toLowerCase().includes(lowercasedTerm) ||
        log.details?.toLowerCase().includes(lowercasedTerm)
    );
  }, [logs, searchTerm]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria do Sistema</h1>
          <p className="text-muted-foreground">
            Acompanhe todos os eventos e ações realizadas no sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-lg py-1 px-3">
            {filteredLogs.length} / {logs.length} registros
          </Badge>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Pesquisar por usuário, ação ou detalhes..."
          className="w-full pl-10 h-12 text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando logs...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="mt-1">
                  <History className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-primary">{log.userName || 'Sistema'}</p>
                    <span className="text-xs text-muted-foreground">
                      {log.timestamp
                        ? format(log.timestamp, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                        : 'Data indisponível'}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1">{log.action}</p>
                  <p className="text-sm text-muted-foreground">{log.details}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditoriaPage;
