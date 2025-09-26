import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BedDouble, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  doc,
  db,
  writeBatch,
  arrayUnion,
  serverTimestamp
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return 0;

  let dataObj;

  if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
    const [dia, mes, ano] = dataNascimento.split('/');
    dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  } else if (dataNascimento && typeof dataNascimento.toDate === 'function') {
    dataObj = dataNascimento.toDate();
  } else {
    dataObj = new Date(dataNascimento);
  }

  if (isNaN(dataObj.getTime())) return 0;

  const hoje = new Date();
  let idade = hoje.getFullYear() - dataObj.getFullYear();
  const m = hoje.getMonth() - dataObj.getMonth();

  if (m < 0 || (m === 0 && hoje.getDate() < dataObj.getDate())) {
    idade--;
  }

  return idade;
};

const getLeitosCompatíveis = (paciente, todosOsDados, modo = 'enfermaria') => {
  if (!paciente || !todosOsDados) return [];

  const {
    leitos = [],
    setores = [],
    pacientes: pacientesExistentes = []
  } = todosOsDados;

  const normalizarIsolamentos = (lista) => {
    if (!Array.isArray(lista) || lista.length === 0) return '';

    return lista
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item).trim().toLowerCase();
        }

        const identificador =
          item.infecaoId ||
          item.infeccaoId ||
          item.id ||
          item.codigo ||
          item.nome ||
          '';

        return String(identificador).trim().toLowerCase();
      })
      .filter(Boolean)
      .sort()
      .join('|');
  };

  const possuiInformacaoAtiva = (campo) => {
    if (!campo) return false;
    if (typeof campo === 'object') {
      return Object.keys(campo).length > 0;
    }
    return Boolean(campo);
  };

  const obterTipoSetorNormalizado = (setor) =>
    String(setor?.tipoSetor || '').trim().toLowerCase();

  const normalizarStatus = (status) =>
    String(status || '').trim().toLowerCase();

  const obterStatusLeito = (leito) => {
    const statusValor = leito?.status ?? leito?.statusLeito ?? '';
    return normalizarStatus(statusValor);
  };

  const possuiReservaOuRegulacao = (leito) =>
    possuiInformacaoAtiva(leito?.regulacaoEmAndamento) ||
    possuiInformacaoAtiva(leito?.reservaExterna) ||
    possuiInformacaoAtiva(leito?.regulacaoReserva);

  const statusElegiveis = new Set(['vago', 'higienização', 'higienizacao']);
  const statusOcupado = 'ocupado';

  const setoresPorId = new Map(setores.map((setor) => [setor.id, setor]));

  if (modo === 'uti') {
    return leitos.filter((leito) => {
      const setor = setoresPorId.get(leito.setorId);

      if (obterTipoSetorNormalizado(setor) !== 'uti') return false;
      if (!statusElegiveis.has(obterStatusLeito(leito))) return false;
      if (possuiReservaOuRegulacao(leito)) return false;

      return true;
    });
  }

  const idadePaciente = calcularIdade(paciente.dataNascimento);
  const chaveIsolamentoPaciente = normalizarIsolamentos(paciente.isolamentos);
  const normalizarSexo = (valor) =>
    (typeof valor === 'string' ? valor.trim().toUpperCase() : '');
  const sexoPaciente = normalizarSexo(paciente?.sexo);

  const pacientesPorLeito = new Map();
  pacientesExistentes.forEach((pacienteAtual) => {
    if (pacienteAtual?.leitoId) {
      pacientesPorLeito.set(pacienteAtual.leitoId, pacienteAtual);
    }
  });

  const leitosPorQuarto = new Map();
  leitos.forEach((leitoAtual) => {
    if (!leitoAtual?.quartoId) return;
    if (!leitosPorQuarto.has(leitoAtual.quartoId)) {
      leitosPorQuarto.set(leitoAtual.quartoId, []);
    }
    leitosPorQuarto.get(leitoAtual.quartoId).push(leitoAtual);
  });

  const candidatos = leitos.filter((leito) => {
    const setor = setoresPorId.get(leito.setorId);

    if (obterTipoSetorNormalizado(setor) !== 'enfermaria') return false;
    if (!statusElegiveis.has(obterStatusLeito(leito))) return false;
    if (possuiReservaOuRegulacao(leito)) return false;

    return true;
  });

  const leitosCompativeis = [];

  candidatos.forEach((leito) => {
    if (leito.isPCP) {
      if (idadePaciente < 18 || idadePaciente > 60) {
        return;
      }
      if (chaveIsolamentoPaciente !== '') {
        return;
      }
    }

    const quartoId = leito.quartoId;
    if (!quartoId) {
      leitosCompativeis.push(leito);
      return;
    }

    const leitosMesmoQuarto = (leitosPorQuarto.get(quartoId) || [])
      .filter((outroLeito) => outroLeito.id !== leito.id);

    const ocupantesDoQuarto = leitosMesmoQuarto
      .filter((outroLeito) => obterStatusLeito(outroLeito) === statusOcupado)
      .map((leitoOcupado) => pacientesPorLeito.get(leitoOcupado.id))
      .filter(Boolean);

    if (ocupantesDoQuarto.length > 0) {
      const sexoReferencia = normalizarSexo(ocupantesDoQuarto[0]?.sexo);
      if (sexoPaciente && sexoReferencia && sexoPaciente !== sexoReferencia) {
        return;
      }

      if (sexoPaciente) {
        const algumSexoDiferente = ocupantesDoQuarto.some((ocupante) => {
          const sexoOcupante = normalizarSexo(ocupante?.sexo);
          return sexoOcupante && sexoOcupante !== sexoPaciente;
        });

        if (algumSexoDiferente) {
          return;
        }
      }

      const chaveIsolamentoOcupantes = normalizarIsolamentos(
        ocupantesDoQuarto[0]?.isolamentos
      );

      const isolamentosDivergentesEntreOcupantes = ocupantesDoQuarto.some(
        (ocupante) =>
          normalizarIsolamentos(ocupante?.isolamentos) !==
          chaveIsolamentoOcupantes
      );

      if (isolamentosDivergentesEntreOcupantes) {
        return;
      }

      if (chaveIsolamentoPaciente !== chaveIsolamentoOcupantes) {
        return;
      }
    }

    leitosCompativeis.push(leito);
  });

  return leitosCompativeis;
};

const SelecionarLeitoModal = ({ isOpen, onClose, reserva, dadosHospital }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const {
    leitos: leitosHospital = [],
    setores: setoresHospital = [],
    quartos: quartosHospital = [],
    pacientes: pacientesHospital = [],
    loading: dadosHospitalLoading = false
  } = dadosHospital || {};

  const isolamentoTexto = (reserva?.isolamento ?? '').toString().trim();
  const deveExibirIsolamento = isolamentoTexto && !['NÃO', 'NAO'].includes(isolamentoTexto.toUpperCase());

  const pacienteAdaptado = useMemo(() => {
    if (!reserva) return null;

    const sexoBase = reserva.sexo ?? reserva.sexoPaciente ?? '';
    const sexoNormalizado = typeof sexoBase === 'string' ? sexoBase : String(sexoBase || '');

    const obterIsolamentos = () => {
      const valorBruto = reserva.isolamentos ?? reserva.isolamento;
      if (!valorBruto) return [];
      if (Array.isArray(valorBruto)) {
        return valorBruto;
      }
      if (typeof valorBruto === 'string') {
        const texto = valorBruto.trim();
        if (!texto) return [];
        const textoUpper = texto.toUpperCase();
        if (textoUpper === 'NÃO' || textoUpper === 'NAO' || textoUpper === 'NAO INFORMADO') {
          return [];
        }
        return [{ tipo: texto, ativo: true }];
      }
      if (typeof valorBruto === 'object') {
        return [valorBruto];
      }
      return [];
    };

    const detectarPedidoUti = () => {
      if (reserva?.pedidoUTI || reserva?.necessitaUTI) return true;

      const camposTexto = [
        reserva?.tipo,
        reserva?.tipoLeito,
        reserva?.especialidade,
        reserva?.especialidadeOncologia,
        reserva?.destinoPreferencial,
        reserva?.setorDestino,
        reserva?.setorSolicitado,
        reserva?.classificacao
      ];

      return camposTexto.some((campo) =>
        typeof campo === 'string' && campo.toUpperCase().includes('UTI')
      );
    };

    return {
      ...reserva,
      id: reserva.id,
      sexo: sexoNormalizado,
      isolamentos: obterIsolamentos(),
      pedidoUTI: detectarPedidoUti()
    };
  }, [reserva]);

  const leitosDisponiveis = useMemo(() => {
    if (!pacienteAdaptado || dadosHospitalLoading) return [];

    const todosOsDados = {
      leitos: leitosHospital,
      setores: setoresHospital,
      pacientes: pacientesHospital
    };

    if (!todosOsDados.leitos.length || !todosOsDados.setores.length) {
      return [];
    }

    const setoresPorId = new Map(setoresHospital.map((setor) => [setor.id, setor]));
    const quartosPorId = new Map(quartosHospital.map((quarto) => [quarto.id, quarto]));

    const leitosEnfermaria = pacienteAdaptado.pedidoUTI
      ? []
      : getLeitosCompatíveis(pacienteAdaptado, todosOsDados, 'enfermaria');
    const leitosUti = getLeitosCompatíveis(pacienteAdaptado, todosOsDados, 'uti');

    const candidatos = pacienteAdaptado.pedidoUTI
      ? leitosUti
      : (leitosEnfermaria.length > 0 ? leitosEnfermaria : leitosUti);

    const mapa = new Map();

    candidatos.forEach((leito) => {
      if (!leito) return;
      const setor = setoresPorId.get(leito.setorId);
      const quarto = quartosPorId.get(leito.quartoId);

      mapa.set(leito.id, {
        ...leito,
        nomeSetor: leito.nomeSetor || setor?.nomeSetor,
        siglaSetor: leito.siglaSetor || setor?.siglaSetor,
        tipoSetor: leito.tipoSetor || setor?.tipoSetor,
        nomeQuarto: leito.nomeQuarto || quarto?.nomeQuarto
      });
    });

    return Array.from(mapa.values()).sort((a, b) =>
      (a.codigoLeito || '').localeCompare(b.codigoLeito || '')
    );
  }, [
    pacienteAdaptado,
    dadosHospitalLoading,
    leitosHospital,
    setoresHospital,
    pacientesHospital,
    quartosHospital
  ]);

  const handleSelecionarLeito = async (leito) => {
    try {
      const batch = writeBatch(db);

      // Atualizar reserva com leito selecionado
      const reservaRef = doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id);
      batch.update(reservaRef, {
        leitoReservadoId: leito.id,
        leitoCodigo: leito.codigoLeito || null,
        status: 'Reservado',
        atualizadoEm: serverTimestamp(),
        userName: currentUser?.nomeCompleto || 'Usuário'
      });

      // Atualizar leito com informações da reserva
      const leitoRef = doc(db, 'artifacts/regulafacil/public/data/leitos', leito.id);
      batch.update(leitoRef, {
        reservaExterna: {
          reservaId: reserva.id,
          pacienteNome: reserva.nomeCompleto,
          pacienteSexo: reserva.sexo,
          pacienteDataNascimento: reserva.dataNascimento,
          origem: reserva.origem,
          detalheOrigem: reserva.origem === 'SISREG'
            ? `${reserva.instituicaoOrigem}, ${reserva.cidadeOrigem}`
            : reserva.especialidadeOncologia,
          idSolicitacao: reserva.idSolicitacao || null,
          instituicaoOrigem: reserva.instituicaoOrigem || null,
          cidadeOrigem: reserva.cidadeOrigem || null,
          especialidadeOncologia: reserva.especialidadeOncologia || null,
          telefoneContato: reserva.telefoneContato || null,
          isolamento: reserva.isolamento || 'NÃO'
        },
        status: 'Reservado',
        historico: arrayUnion({
          status: 'Reservado',
          timestamp: new Date(),
          origem: 'Reserva Externa'
        })
      });

      await batch.commit();

      await logAction(
        'Reservas de Leitos',
        `Leito ${leito.codigoLeito} reservado para: ${reserva.nomeCompleto}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: `Leito ${leito.codigoLeito} reservado com sucesso!`
      });

      onClose();
    } catch (error) {
      console.error('Erro ao reservar leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao reservar leito. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  if (!reserva) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Selecionar Leito para {reserva.nomeCompleto}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do paciente */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="font-semibold">Paciente:</span> {reserva.nomeCompleto}
                </div>
                <div>
                  <span className="font-semibold">Sexo:</span> {reserva.sexo}
                </div>
                {deveExibirIsolamento && (
                  <div>
                    <span className="font-semibold">Isolamento:</span>
                    <Badge variant="destructive" className="ml-2">
                      {isolamentoTexto}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de leitos disponíveis */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              Leitos Disponíveis ({leitosDisponiveis.length})
            </h3>
            
            {leitosDisponiveis.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    Nenhum leito disponível no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {leitosDisponiveis.map(leito => (
                  <LeitoCard 
                    key={leito.id}
                    leito={leito}
                    onSelecionar={handleSelecionarLeito}
                    reserva={reserva}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LeitoCard = ({ leito, onSelecionar, reserva }) => {
  // Verificar compatibilidade
  const isCompativel = () => {
    // Verificar contexto do quarto (coorte)
    if (leito.contextoQuarto) {
      // Se há um contexto de quarto, verificar sexo
      if (leito.contextoQuarto.sexo !== reserva.sexo) {
        return false;
      }
      // TODO: Verificar isolamentos também se necessário
    }
    return true;
  };

  const compativel = isCompativel();
  const nomeSetor = leito.nomeSetor || leito.siglaSetor || 'Setor não informado';
  const statusLeito = leito.status || leito.statusLeito || 'Vago';

  return (
    <Card className={`transition-colors ${compativel ? 'hover:bg-accent cursor-pointer' : 'opacity-50'}`}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4" />
              <span className="font-semibold text-lg">{leito.codigoLeito}</span>
              <Badge variant="outline">{statusLeito}</Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{nomeSetor}</span>
              {leito.nomeQuarto && <span>• {leito.nomeQuarto}</span>}
            </div>

            {/* Mostrar contexto do quarto se houver */}
            {leito.contextoQuarto && (
              <div className="text-sm">
                <Badge variant={compativel ? "secondary" : "destructive"}>
                  Coorte: Apenas {leito.contextoQuarto.sexo}
                  {leito.contextoQuarto.isolamentos && leito.contextoQuarto.isolamentos.length > 0 && 
                    ` com ${leito.contextoQuarto.isolamentos.map(i => i.sigla).join(', ')}`
                  }
                </Badge>
              </div>
            )}

            {!compativel && (
              <p className="text-sm text-destructive">
                Este leito não é compatível com o paciente
              </p>
            )}
          </div>

          <Button 
            onClick={() => onSelecionar(leito)}
            disabled={!compativel}
            size="sm"
          >
            Selecionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SelecionarLeitoModal;