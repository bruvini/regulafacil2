import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, History, CalendarIcon, Filter } from 'lucide-react';
import { format, subDays } from 'date-fns';
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

const getDefaultFilters = () => ({
  startDate: subDays(new Date(), 1),
  endDate: new Date(),
  user: 'all',
  action: 'all',
});

const AuditoriaPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters);

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

  const uniqueUsers = useMemo(() => {
    return [...new Set(logs.map((log) => log.userName).filter(Boolean))].sort();
  }, [logs]);

  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map((log) => log.action).filter(Boolean))].sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (filters.startDate && filters.endDate) {
      result = result.filter((log) => {
        const logTimestamp = log.timestamp;

        if (!(logTimestamp instanceof Date) || Number.isNaN(logTimestamp.getTime())) {
          return false;
        }

        return logTimestamp >= filters.startDate && logTimestamp <= filters.endDate;
      });
    }

    if (filters.user !== 'all') {
      result = result.filter((log) => log.userName === filters.user);
    }

    if (filters.action !== 'all') {
      result = result.filter((log) => log.action === filters.action);
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(
        (log) =>
          log.userName?.toLowerCase().includes(lowercasedTerm) ||
          log.action?.toLowerCase().includes(lowercasedTerm) ||
          log.details?.toLowerCase().includes(lowercasedTerm)
      );
    }

    return result;
  }, [logs, searchTerm, filters]);

  const handleDateChange = (key, date) => {
    if (!date) return;

    setFilters((prev) => {
      const existing = prev[key];
      const hours = existing ? existing.getHours() : 0;
      const minutes = existing ? existing.getMinutes() : 0;
      const updatedDate = new Date(date);
      updatedDate.setHours(hours, minutes, 0, 0);

      return { ...prev, [key]: updatedDate };
    });
  };

  const handleTimeChange = (key, value) => {
    if (!value) return;

    const [hours, minutes] = value.split(':').map((num) => parseInt(num, 10));

    setFilters((prev) => {
      const base = prev[key] ? new Date(prev[key]) : new Date();
      base.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
      return { ...prev, [key]: base };
    });
  };

  const handleClearFilters = () => {
    setFilters(getDefaultFilters());
  };

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

      <div className="space-y-4">
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

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          </Button>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent className="space-y-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Início do período</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start text-left font-normal flex-1"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.startDate
                          ? format(filters.startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.startDate}
                        onSelect={(date) => handleDateChange('startDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={filters.startDate ? format(filters.startDate, 'HH:mm') : ''}
                    onChange={(event) => handleTimeChange('startDate', event.target.value)}
                    className="sm:w-32"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Fim do período</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start text-left font-normal flex-1"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.endDate
                          ? format(filters.endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.endDate}
                        onSelect={(date) => handleDateChange('endDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={filters.endDate ? format(filters.endDate, 'HH:mm') : ''}
                    onChange={(event) => handleTimeChange('endDate', event.target.value)}
                    className="sm:w-32"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Usuário</p>
                <Select
                  value={filters.user}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, user: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {uniqueUsers.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Ação</p>
                <Select
                  value={filters.action}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, action: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as ações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setFiltersOpen(false)}>
                Aplicar filtros
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
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
