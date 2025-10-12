import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { FileDown, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";
import { useToast } from "@/hooks/use-toast";
import { collection, db, doc, getDoc, onSnapshot, setDoc } from "@/lib/firebase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PassagemPlantaoPDFLayout from "@/components/pdf/PassagemPlantaoPDFLayout";

const formatarMensagemRestricaoCoorte = (restricao) => {
  if (!restricao) {
    return '';
  }

  const { sexo, isolamentos } = restricao;
  if (isolamentos && isolamentos.length > 0) {
    return `Permitido apenas pacientes do sexo ${sexo} com isolamento de ${isolamentos.join(', ')}`;
  }

  return `Permitido apenas pacientes do sexo ${sexo}`;
};

const normalizarTexto = (texto = '') =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

const obterIdSetor = (setor) => setor?.id ?? setor?.idSetor ?? setor?.nomeSetor;

const obterObservacaoTexto = (observacoes) => {
  if (!observacoes) return '';
  if (typeof observacoes === 'string') {
    return observacoes.trim();
  }

  if (Array.isArray(observacoes)) {
    const ultima = [...observacoes]
      .reverse()
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        if (typeof item.texto === 'string') return item.texto.trim();
        return '';
      })
      .find((texto) => texto.length > 0);

    return ultima || '';
  }

  if (typeof observacoes.texto === 'string') {
    return observacoes.texto.trim();
  }

  return '';
};

const obterIsolamentosSiglas = (isolamentos) => {
  if (!Array.isArray(isolamentos)) return [];
  return isolamentos
    .map((iso) => {
      if (!iso) return '';
      if (typeof iso === 'string') return iso;
      return iso.sigla || iso.siglaInfeccao || iso.codigo || iso.nome || '';
    })
    .filter((valor) => valor && valor.trim().length > 0);
};

const PendenciaLista = ({ titulo, itens }) => {
  if (!Array.isArray(itens) || itens.length === 0) return null;

  return (
    <div>
      <h5 className="font-semibold text-gray-700 mb-1">{titulo}</h5>
      <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
        {itens.map((item, index) => (
          <li key={`${titulo}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const TURNOS = [
  { value: 'DIURNO', label: 'Diurno' },
  { value: 'MATUTINO', label: 'Matutino' },
  { value: 'VESPERTINO', label: 'Vespertino' },
  { value: 'NOTURNO', label: 'Noturno' },
];

const PassagemPlantaoModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reservasExternas, setReservasExternas] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [observacoesLoading, setObservacoesLoading] = useState(true);
  const [isPdfInfoModalOpen, setIsPdfInfoModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfInfo, setPdfInfo] = useState(() => ({
    enfermeiro: '',
    medico: '',
    data: new Date(),
    turno: '',
  }));
  const pdfLayoutRef = useRef(null);
  const {
    estrutura,
    infeccoes: infeccoesDados = [],
  } = useDadosHospitalares();

  const ORDEM_TIPO_SETOR = ["Enfermaria", "UTI", "Centro Cirúrgico", "Emergência"];

  const ORDEM_SETORES = {
    Enfermaria: [
      "UNID. JS ORTOPEDIA",
      "UNID. INT. GERAL - UIG",
      "UNID. DE AVC - INTEGRAL",
      "UNID. NEFROLOGIA TRANSPLANTE",
      "UNID. CIRURGICA",
      "UNID. ONCOLOGIA",
      "UNID. CLINICA MEDICA",
    ],
    UTI: ["UTI"],
    "Centro Cirúrgico": ["CC - RECUPERAÇÃO", "CC - SALAS CIRURGICAS"],
    Emergência: [
      "UNID. AVC AGUDO",
      "SALA DE EMERGENCIA",
      "SALA LARANJA",
      "PS DECISÃO CIRURGICA",
      "PS DECISão CLINICA",
    ],
  };

  const observacoesDocRef = useMemo(
    () => doc(db, 'artifacts/regulafacil/public/data/configuracoes/passagemDePlantao'),
    [],
  );

  const fetchObservacoes = useCallback(async () => {
    setObservacoesLoading(true);
    try {
      const docSnap = await getDoc(observacoesDocRef);
      if (docSnap.exists()) {
        setObservacoes(docSnap.data().observacoesGerais || '');
      } else {
        setObservacoes('');
      }
    } catch (error) {
      console.error('Erro ao buscar observações:', error);
      toast({
        title: 'Erro ao carregar anotações',
        description: 'Não foi possível buscar as observações salvas.',
        variant: 'destructive',
      });
    } finally {
      setObservacoesLoading(false);
    }
  }, [observacoesDocRef, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchObservacoes();
    }
  }, [isOpen, fetchObservacoes]);

  useEffect(() => {
    let timeoutId;

    if (isOpen) {
      setLoading(true);
      timeoutId = setTimeout(() => {
        setLoading(false);
      }, 2000);
    } else {
      setLoading(true);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const reservasExternasRef = collection(db, 'artifacts/regulafacil/public/data/reservasExternas');
    const unsubscribe = onSnapshot(reservasExternasRef, (snapshot) => {
      const listaReservas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReservasExternas(listaReservas);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleOpenChange = (open) => {
    if (!open) {
      onClose?.();
    }
  };

  const handleSalvarObservacoes = async () => {
    setObservacoesLoading(true);
    try {
      await setDoc(
        observacoesDocRef,
        { observacoesGerais: observacoes },
        { merge: true },
      );
      toast({
        title: 'Sucesso!',
        description: 'As observações foram salvas.',
      });
    } catch (error) {
      console.error('Erro ao salvar observações:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as anotações.',
        variant: 'destructive',
      });
    } finally {
      setObservacoesLoading(false);
    }
  };

  const handleLimparObservacoes = async () => {
    setObservacoesLoading(true);
    try {
      await setDoc(
        observacoesDocRef,
        { observacoesGerais: '' },
        { merge: true },
      );
      setObservacoes('');
      toast({
        title: 'Anotações limpas',
        description: 'O campo de observações foi esvaziado.',
      });
    } catch (error) {
      console.error('Erro ao limpar observações:', error);
      toast({
        title: 'Erro ao limpar',
        description: 'Não foi possível limpar as anotações.',
        variant: 'destructive',
      });
    } finally {
      setObservacoesLoading(false);
    }
  };

  const handleGeneratePdf = useCallback(async () => {
    if (!pdfInfo.enfermeiro.trim() || !pdfInfo.medico.trim() || !pdfInfo.turno) {
      toast({
        title: 'Informações incompletas',
        description: 'Preencha todos os campos para gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    if (!(pdfInfo.data instanceof Date) || Number.isNaN(pdfInfo.data.getTime())) {
      toast({
        title: 'Data inválida',
        description: 'Selecione uma data válida para o plantão.',
        variant: 'destructive',
      });
      return;
    }

    const reportElement = document.getElementById('pdf-layout');

    if (!reportElement) {
      console.error('Elemento do layout do PDF não encontrado!');
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível localizar o conteúdo do relatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGeneratingPdf(true);

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdfPageWidth = 210;
      const pdfPageHeight = 297;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const ratio = imgWidth / pdfPageWidth;
      const scaledImgHeight = imgHeight / ratio;

      let heightLeft = scaledImgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfPageWidth, scaledImgHeight);
      heightLeft -= pdfPageHeight;

      while (heightLeft > 0) {
        position = -heightLeft;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfPageWidth, scaledImgHeight);
        heightLeft -= pdfPageHeight;
      }

      window.open(pdf.output('bloburl'), '_blank');
      setIsPdfInfoModalOpen(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Ocorreu um erro ao gerar o documento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [pdfInfo, toast]);

  const relatorioPorTipo = useMemo(() => {
    if (!estrutura) {
      return {
        uti: [],
        centroCirurgico: {
          recuperacao: null,
          salasCirurgicas: null,
        },
        emergencia: {
          avcAgudo: null,
          salaEmergencia: null,
          salaLaranja: null,
          psDecisaoCirurgica: null,
          psDecisaoClinica: null,
        },
        enfermaria: [],
        outros: [],
      };
    }

    const infeccoesMap = new Map(infeccoesDados.map((i) => [i.id, i]));

    const obterLeitosDoSetor = (setor) => [
      ...((setor?.quartos || []).flatMap((q) => q.leitos || [])),
      ...(setor?.leitosSemQuarto || []),
    ];

    const leitosPorId = new Map();
    const leitosPorSetorId = new Map();
    const pacientesInfo = [];

    Object.entries(estrutura).forEach(([tipoSetor, setores = []]) => {
      setores.forEach((setor) => {
        if (!setor) return;
        const setorId = obterIdSetor(setor);
        const leitosDoSetor = obterLeitosDoSetor(setor);
        leitosPorSetorId.set(setorId, leitosDoSetor);
        leitosDoSetor.forEach((leito) => {
          if (!leito) return;
          leitosPorId.set(leito.id, { leito, setor });
          if (leito.paciente) {
            pacientesInfo.push({
              paciente: leito.paciente,
              leito,
              setor,
              setorId,
              tipoSetor,
            });
          }
        });
      });
    });

    const formatarDescricaoLeito = (leitoId) => {
      if (!leitoId) return 'N/A';
      const info = leitosPorId.get(leitoId);
      if (!info) return 'N/A';
      const { leito, setor } = info;
      const setorNome = setor?.nomeSetor || 'Setor não informado';
      const codigo = leito?.codigoLeito;
      return codigo ? `${setorNome} / ${codigo}` : setorNome;
    };

    const pacientesComRegulacao = pacientesInfo.filter(
      ({ paciente }) => paciente?.regulacaoAtiva,
    );

    const montarRegulacoesPara = (leitoIds) => {
      if (!leitoIds || leitoIds.size === 0) return [];
      return pacientesComRegulacao
        .filter(({ paciente }) => {
          const origem = paciente.regulacaoAtiva?.leitoOrigemId;
          const destino = paciente.regulacaoAtiva?.leitoDestinoId;
          return leitoIds.has(origem) || leitoIds.has(destino);
        })
        .map(({ paciente }) => {
          const origemDesc = formatarDescricaoLeito(
            paciente.regulacaoAtiva?.leitoOrigemId,
          );
          const destinoDesc = formatarDescricaoLeito(
            paciente.regulacaoAtiva?.leitoDestinoId,
          );
          return `${paciente.nomePaciente} - De: ${origemDesc} -> Para: ${destinoDesc}`;
        });
    };

    const uti = (estrutura['UTI'] || []).map((setor) => {
      const setorId = obterIdSetor(setor);
      const leitos = leitosPorSetorId.get(setorId) || [];
      const leitoIds = new Set(leitos.map((leito) => leito?.id));
      const pacientesSetor = pacientesInfo.filter((info) => info.setorId === setorId);

      const provaveisAltas = pacientesSetor
        .filter(({ paciente }) => paciente?.provavelAlta)
        .map(({ paciente, leito }) =>
          `${leito?.codigoLeito || ''} ${paciente.nomePaciente}`.trim(),
        );

      const remanejamentos = pacientesSetor
        .filter(({ paciente }) => paciente?.pedidoRemanejamento)
        .map(
          ({ paciente }) =>
            `${paciente.nomePaciente} - Motivo: ${paciente.pedidoRemanejamento.tipo}`,
        );

      const transferencias = pacientesSetor
        .filter(({ paciente }) => paciente?.transferenciaExterna)
        .map(({ paciente }) => {
          const status = paciente.transferenciaExterna.status || 'Sem status';
          return `${paciente.nomePaciente} - Status: ${status}`;
        });

      const observacoes = pacientesSetor
        .map(({ paciente }) => {
          const texto = obterObservacaoTexto(paciente.observacoes);
          if (!texto) return null;
          return `${paciente.nomePaciente}: "${texto}"`;
        })
        .filter(Boolean);

      return {
        id: setorId,
        nome: setor?.nomeSetor || 'UTI',
        provaveisAltas,
        regulacoes: montarRegulacoesPara(leitoIds),
        remanejamentos,
        transferencias,
        observacoes,
      };
    });

    const setoresCentro = estrutura['Centro Cirúrgico'] || [];

    const obterSetorPorNome = (nome) =>
      setoresCentro.find(
        (setor) => normalizarTexto(setor?.nomeSetor) === normalizarTexto(nome),
      );

    const montarBlocoCentro = (nome) => {
      const setor = obterSetorPorNome(nome);
      if (!setor) {
        return {
          nome,
          existe: false,
          pacientesInternados: 0,
          regulacoes: [],
          transferencias: [],
          observacoes: [],
          aguardandoUti: [],
        };
      }

      const setorId = obterIdSetor(setor);
      const leitos = leitosPorSetorId.get(setorId) || [];
      const leitoIds = new Set(leitos.map((leito) => leito?.id));
      const pacientesSetor = pacientesInfo.filter((info) => info.setorId === setorId);

      const transferencias = pacientesSetor
        .filter(({ paciente }) => paciente?.transferenciaExterna)
        .map(({ paciente }) => {
          const status = paciente.transferenciaExterna.status || 'Sem status';
          return `${paciente.nomePaciente} - Status: ${status}`;
        });

      const observacoes = pacientesSetor
        .map(({ paciente }) => {
          const texto = obterObservacaoTexto(paciente.observacoes);
          if (!texto) return null;
          return `${paciente.nomePaciente}: "${texto}"`;
        })
        .filter(Boolean);

      const aguardandoUti = pacientesSetor
        .filter(({ paciente }) => paciente?.pedidoUTI)
        .map(({ paciente }) => paciente.nomePaciente);

      return {
        nome,
        existe: true,
        setorId,
        pacientesInternados: pacientesSetor.length,
        regulacoes: montarRegulacoesPara(leitoIds),
        transferencias,
        observacoes,
        aguardandoUti,
      };
    };

    const centroCirurgico = {
      recuperacao: montarBlocoCentro('CC - RECUPERAÇÃO'),
      salasCirurgicas: montarBlocoCentro('CC - SALAS CIRURGICAS'),
    };

    const setoresEmergencia = estrutura['Emergência'] || [];

    const obterSetorEmergencia = (nome) =>
      setoresEmergencia.find(
        (setor) => normalizarTexto(setor?.nomeSetor) === normalizarTexto(nome),
      );

    const montarBlocoEmergencia = (nome, configuracoes = {}) => {
      const setor = obterSetorEmergencia(nome);
      if (!setor) {
        return {
          nome,
          existe: false,
          pacientesInternados: 0,
          aguardandoUti: [],
          remanejamentos: [],
          isolamentos: [],
          transferencias: [],
          observacoes: [],
        };
      }

      const { incluirAguardandoUti, incluirRemanejamento, incluirIsolamentos } =
        configuracoes;

      const setorId = obterIdSetor(setor);
      const pacientesSetor = pacientesInfo.filter((info) => info.setorId === setorId);

      const aguardandoUti = incluirAguardandoUti
        ? pacientesSetor
            .filter(({ paciente }) => paciente?.pedidoUTI)
            .map(({ paciente }) => paciente.nomePaciente)
        : [];

      const remanejamentos = incluirRemanejamento
        ? pacientesSetor
            .filter(({ paciente }) => paciente?.pedidoRemanejamento)
            .map(({ paciente }) => {
              const motivo = paciente.pedidoRemanejamento.tipo;
              return `${paciente.nomePaciente} - Motivo: ${motivo}`;
            })
        : [];

      const isolamentos = incluirIsolamentos
        ? pacientesSetor
            .map(({ paciente }) => {
              const siglas = obterIsolamentosSiglas(paciente.isolamentos);
              if (siglas.length === 0) return null;
              return `${paciente.nomePaciente} - Isolamento(s): ${siglas.join(', ')}`;
            })
            .filter(Boolean)
        : [];

      const transferencias = pacientesSetor
        .filter(({ paciente }) => paciente?.transferenciaExterna)
        .map(({ paciente }) => {
          const status = paciente.transferenciaExterna.status || 'Sem status';
          return `${paciente.nomePaciente} - Status: ${status}`;
        });

      const observacoes = pacientesSetor
        .map(({ paciente }) => {
          const texto = obterObservacaoTexto(paciente.observacoes);
          if (!texto) return null;
          return `${paciente.nomePaciente}: "${texto}"`;
        })
        .filter(Boolean);

      return {
        nome,
        existe: true,
        pacientesInternados: pacientesSetor.length,
        aguardandoUti,
        remanejamentos,
        isolamentos,
        transferencias,
        observacoes,
      };
    };

    const emergencia = {
      avcAgudo: montarBlocoEmergencia('UNID. AVC AGUDO', {
        incluirAguardandoUti: true,
        incluirRemanejamento: true,
      }),
      salaEmergencia: montarBlocoEmergencia('SALA DE EMERGENCIA', {
        incluirAguardandoUti: true,
        incluirRemanejamento: true,
      }),
      salaLaranja: montarBlocoEmergencia('SALA LARANJA', {
        incluirIsolamentos: true,
      }),
      psDecisaoCirurgica: montarBlocoEmergencia('PS DECISÃO CIRURGICA', {
        incluirIsolamentos: true,
      }),
      psDecisaoClinica: montarBlocoEmergencia('PS DECISÃO CLINICA', {
        incluirIsolamentos: true,
      }),
    };

    const ordenarEnfermaria = (setores = []) => {
      const ordemParaTipo = ORDEM_SETORES.Enfermaria || [];
      return [...setores].sort((a, b) => {
        const nomeA = a?.nomeSetor || '';
        const nomeB = b?.nomeSetor || '';
        const indexA = ordemParaTipo.indexOf(nomeA);
        const indexB = ordemParaTipo.indexOf(nomeB);
        if (ordemParaTipo.length === 0) {
          return nomeA.localeCompare(nomeB);
        }
        if (indexA === -1 && indexB === -1) {
          return nomeA.localeCompare(nomeB);
        }
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    };

    const enfermaria = ordenarEnfermaria(estrutura['Enfermaria'] || []).map((setor) => {
      const dadosPlantao = {
        isolamentos: [],
        leitosRegulados: [],
        leitosVagos: [],
        pedidosUTI: [],
        transferencias: [],
        observacoes: [],
        provaveisAltas: [],
        altasNoLeito: [],
        reservasExternas: [],
        listaEsperaOncologia: [],
      };

      const todosOsLeitosDoSetor = obterLeitosDoSetor(setor);
      const leitosMap = new Map(
        todosOsLeitosDoSetor.map((leito) => [leito?.id, leito]),
      );

      todosOsLeitosDoSetor.forEach((leito) => {
        if (!leito) return;
        const paciente = leito.paciente;

        if (leito.status === 'Vago' || leito.status === 'Higienização') {
          const compatibilidade =
            leito.status === 'Vago'
              ? formatarMensagemRestricaoCoorte(leito.restricaoCoorte) || 'Livre'
              : 'N/A';
          dadosPlantao.leitosVagos.push({
            id: leito.id,
            codigoLeito: leito.codigoLeito,
            status: leito.status,
            compatibilidade,
          });
        }

        if (leito.status === 'Reservado' && leito.regulacaoEmAndamento) {
          const infoReg = leito.regulacaoEmAndamento;
          const tempo = infoReg.iniciadoEm?.toDate
            ? format(infoReg.iniciadoEm.toDate(), 'dd/MM HH:mm')
            : '';
          dadosPlantao.leitosRegulados.push(
            `${leito.codigoLeito} ${infoReg.pacienteNome} / VEM DE ${infoReg.leitoParceiroSetorNome} ${infoReg.leitoParceiroCodigo} (${tempo})`,
          );
        }

        if (!paciente) {
          return;
        }

        if (paciente.provavelAlta) {
          dadosPlantao.provaveisAltas.push(
            `${leito.codigoLeito} ${paciente.nomePaciente}`,
          );
        }

        if (paciente.altaNoLeito) {
          const motivo = paciente.altaNoLeito.motivo
            ? ` - Motivo: ${paciente.altaNoLeito.motivo}`
            : '';
          dadosPlantao.altasNoLeito.push(
            `${leito.codigoLeito} ${paciente.nomePaciente}${motivo}`,
          );
        }

        if (paciente.isolamentos?.length > 0) {
          const nomesIsolamentos = paciente.isolamentos
            .map((iso) => {
              const infeccao = infeccoesMap.get(iso.infeccaoId);
              return (
                infeccao?.siglaInfeccao ||
                infeccao?.sigla ||
                iso.sigla ||
                'Desconhecido'
              );
            })
            .join(', ');
          dadosPlantao.isolamentos.push(
            `${leito.codigoLeito} ${paciente.nomePaciente}: ${nomesIsolamentos}`,
          );
        }

        if (paciente.pedidoUTI) {
          dadosPlantao.pedidosUTI.push(
            `${leito.codigoLeito} ${paciente.nomePaciente}`,
          );
        }

        if (paciente.pedidoTransferenciaExterna) {
          const ped = paciente.pedidoTransferenciaExterna;
          const ultimoStatus = ped.historicoStatus?.slice(-1)[0];
          const ultimaAtualizacao = ultimoStatus
            ? ` | Última Info: ${ultimoStatus.texto}`
            : '';
          dadosPlantao.transferencias.push(
            `${leito.codigoLeito} ${paciente.nomePaciente} | Motivo: ${ped.motivo} | Destino: ${ped.destino}${ultimaAtualizacao}`,
          );
        }

        if (Array.isArray(paciente.observacoes) && paciente.observacoes.length > 0) {
          const obsMaisRecente = [...paciente.observacoes]
            .sort((a, b) => {
              const tempoA = a.timestamp?.toMillis?.() || 0;
              const tempoB = b.timestamp?.toMillis?.() || 0;
              return tempoB - tempoA;
            })[0];
          if (obsMaisRecente?.texto) {
            dadosPlantao.observacoes.push(
              `${leito.codigoLeito} ${paciente.nomePaciente}: ${obsMaisRecente.texto}`,
            );
          }
        }
      });

      reservasExternas.forEach((reserva) => {
        if (reserva.status === 'Reservado' && reserva.leitoReservadoId) {
          const leitoDaReserva = leitosMap.get(reserva.leitoReservadoId);
          if (leitoDaReserva && leitoDaReserva.setorId === setor.id) {
            dadosPlantao.reservasExternas.push(
              `${leitoDaReserva.codigoLeito} ${reserva.nomeCompleto}`,
            );
          }
        }
      });

      if (setor.nomeSetor === 'UNID. ONCOLOGIA') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        dadosPlantao.listaEsperaOncologia = reservasExternas
          .filter(
            (r) => r.origem === 'ONCOLOGIA' && r.status === 'Aguardando Leito',
          )
          .sort((a, b) => {
            const dataA = a.dataPrevistaInternacao?.toDate
              ? a.dataPrevistaInternacao.toDate()
              : null;
            const dataB = b.dataPrevistaInternacao?.toDate
              ? b.dataPrevistaInternacao.toDate()
              : null;
            if (!dataA && !dataB) return 0;
            if (!dataA) return 1;
            if (!dataB) return -1;
            return dataA - dataB;
          })
          .map((r) => {
            const dataPrevista = r.dataPrevistaInternacao?.toDate
              ? r.dataPrevistaInternacao.toDate()
              : null;
            const isAtrasado = dataPrevista ? dataPrevista < hoje : false;
            return {
              id: r.id,
              texto: `${r.nomeCompleto} (${r.especialidadeOncologia}) - Previsto para: ${
                dataPrevista ? format(dataPrevista, 'dd/MM/yyyy') : 'Sem data'
              }`,
              atrasado: isAtrasado,
            };
          });
      }

      return { ...setor, dadosPlantao };
    });

    const tiposConhecidos = new Set([
      'Enfermaria',
      'UTI',
      'Centro Cirúrgico',
      'Emergência',
    ]);

    const outros = Object.entries(estrutura)
      .filter(([tipo]) => !tiposConhecidos.has(tipo))
      .map(([tipo, setores = []]) => ({
        tipo,
        setores: setores.map((setor) => ({
          id: obterIdSetor(setor),
          nome: setor?.nomeSetor || 'Setor sem nome',
        })),
      }));

    return {
      uti,
      centroCirurgico,
      emergencia,
      enfermaria,
      outros,
    };
  }, [estrutura, infeccoesDados, reservasExternas]);

  const { uti, centroCirurgico, emergencia, enfermaria, outros } = relatorioPorTipo;

  const nenhumDadoDisponivel =
    uti.length === 0 &&
    enfermaria.length === 0 &&
    outros.every((grupo) => (grupo.setores || []).length === 0) &&
    !centroCirurgico?.recuperacao?.existe &&
    !centroCirurgico?.salasCirurgicas?.existe &&
    Object.values(emergencia || {}).every((bloco) => !bloco?.existe);

  const pdfData = useMemo(
    () => ({
      uti,
      centroCirurgico,
      emergencia,
      enfermaria,
      outros,
      observacoesGerais: observacoes,
    }),
    [uti, centroCirurgico, emergencia, enfermaria, outros, observacoes],
  );

  const isPdfInfoValid =
    pdfInfo.enfermeiro.trim().length > 0 &&
    pdfInfo.medico.trim().length > 0 &&
    pdfInfo.turno &&
    pdfInfo.data instanceof Date &&
    !Number.isNaN(pdfInfo.data.getTime());

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Relatório de Passagem de Plantão</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Gerando relatório de passagem de plantão...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {nenhumDadoDisponivel ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum setor disponível no momento.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full space-y-4">
                  {uti.length > 0 && (
                    <AccordionItem value="uti">
                      <AccordionTrigger className="text-xl font-semibold">
                        Unidades de Terapia Intensiva (UTI)
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-3 pt-2">
                          {uti.map((setor) => {
                            const setorKey = setor?.id || setor?.nome;
                            const pendenciasVazias =
                              setor.provaveisAltas.length === 0 &&
                              setor.regulacoes.length === 0 &&
                              setor.remanejamentos.length === 0 &&
                              setor.transferencias.length === 0 &&
                              setor.observacoes.length === 0;

                            return (
                              <div key={setorKey} className="border rounded-md p-4">
                                <h4 className="font-medium text-md mb-3">{setor.nome}</h4>
                                <div className="space-y-3 text-sm">
                                  <PendenciaLista
                                    titulo="Prováveis Altas"
                                    itens={setor.provaveisAltas}
                                  />
                                  <PendenciaLista
                                    titulo="Regulações em Andamento"
                                    itens={setor.regulacoes}
                                  />
                                  <PendenciaLista
                                    titulo="Pedidos de Remanejamento"
                                    itens={setor.remanejamentos}
                                  />
                                  <PendenciaLista
                                    titulo="Transferências Externas"
                                    itens={setor.transferencias}
                                  />
                                  <PendenciaLista
                                    titulo="Observações Relevantes"
                                    itens={setor.observacoes}
                                  />
                                  {pendenciasVazias && (
                                    <p className="text-sm text-muted-foreground italic">
                                      Nenhuma pendência registrada.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {(centroCirurgico?.recuperacao || centroCirurgico?.salasCirurgicas) && (
                    <AccordionItem value="centro-cirurgico">
                      <AccordionTrigger className="text-xl font-semibold">
                        Centro Cirúrgico
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-3 pt-2">
                          {[centroCirurgico?.recuperacao, centroCirurgico?.salasCirurgicas]
                            .filter(Boolean)
                            .map((bloco) => {
                              const pendenciasVazias =
                                (bloco.aguardandoUti?.length ?? 0) === 0 &&
                                bloco.regulacoes.length === 0 &&
                                bloco.transferencias.length === 0 &&
                                bloco.observacoes.length === 0;

                              return (
                                <div key={bloco.nome} className="border rounded-md p-4">
                                  <h4 className="font-medium text-md mb-3">{bloco.nome}</h4>
                                  {bloco.existe ? (
                                    <div className="space-y-3 text-sm">
                                      <p className="text-sm text-gray-700">
                                        <span className="font-semibold">Pacientes Internados:</span>{' '}
                                        {bloco.pacientesInternados}
                                      </p>
                                      {bloco.nome === 'CC - SALAS CIRURGICAS' && (
                                        <PendenciaLista
                                          titulo="Aguardando UTI"
                                          itens={bloco.aguardandoUti}
                                        />
                                      )}
                                      <PendenciaLista
                                        titulo="Regulações em Andamento"
                                        itens={bloco.regulacoes}
                                      />
                                      <PendenciaLista
                                        titulo="Transferências Externas"
                                        itens={bloco.transferencias}
                                      />
                                      <PendenciaLista
                                        titulo="Observações"
                                        itens={bloco.observacoes}
                                      />
                                      {pendenciasVazias && (
                                        <p className="text-sm text-muted-foreground italic">
                                          Nenhuma pendência registrada.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                      Setor não disponível no momento.
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {Object.values(emergencia || {}).some((bloco) => bloco) && (
                    <AccordionItem value="emergencia">
                      <AccordionTrigger className="text-xl font-semibold">
                        Emergência
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-3 pt-2">
                          {[emergencia?.avcAgudo, emergencia?.salaEmergencia, emergencia?.salaLaranja, emergencia?.psDecisaoCirurgica, emergencia?.psDecisaoClinica]
                            .filter(Boolean)
                            .map((bloco) => {
                              const pendenciasVazias =
                                bloco.aguardandoUti.length === 0 &&
                                bloco.remanejamentos.length === 0 &&
                                bloco.isolamentos.length === 0 &&
                                bloco.transferencias.length === 0 &&
                                bloco.observacoes.length === 0;

                              return (
                                <div key={bloco.nome} className="border rounded-md p-4">
                                  <h4 className="font-medium text-md mb-3">{bloco.nome}</h4>
                                  {bloco.existe ? (
                                    <div className="space-y-3 text-sm">
                                      <p className="text-sm text-gray-700">
                                        <span className="font-semibold">Pacientes Internados:</span>{' '}
                                        {bloco.pacientesInternados}
                                      </p>
                                      <PendenciaLista
                                        titulo="Aguardando UTI"
                                        itens={bloco.aguardandoUti}
                                      />
                                      <PendenciaLista
                                        titulo="Pedidos de Remanejamento"
                                        itens={bloco.remanejamentos}
                                      />
                                      <PendenciaLista
                                        titulo="Pacientes em Isolamento"
                                        itens={bloco.isolamentos}
                                      />
                                      <PendenciaLista
                                        titulo="Transferências Externas"
                                        itens={bloco.transferencias}
                                      />
                                      <PendenciaLista
                                        titulo="Observações"
                                        itens={bloco.observacoes}
                                      />
                                      {pendenciasVazias && (
                                        <p className="text-sm text-muted-foreground italic">
                                          Nenhuma pendência registrada.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                      Setor não disponível no momento.
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {enfermaria.length > 0 && (
                    <AccordionItem value="enfermaria">
                      <AccordionTrigger className="text-xl font-semibold">
                        Enfermaria
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-2 pt-2">
                          {enfermaria.map((setor) => {
                            const setorKey = setor?.id ?? setor?.idSetor ?? setor?.nomeSetor;
                            return (
                              <div key={setorKey} className="p-4 border rounded-md">
                                <h4 className="font-medium text-md mb-3">{setor.nomeSetor}</h4>
                                {setor.dadosPlantao ? (
                                  <div className="space-y-4 text-sm">
                                    {setor.dadosPlantao.isolamentos.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Isolamentos:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.isolamentos.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.leitosRegulados.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Leitos Regulados (Reservados):</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.leitosRegulados.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.pedidosUTI.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-destructive mb-1">Pedidos de UTI:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-destructive">
                                          {setor.dadosPlantao.pedidosUTI.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.transferencias.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Transferências Externas:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.transferencias.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.provaveisAltas.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Prováveis Altas:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.provaveisAltas.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.altasNoLeito.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Altas no Leito:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.altasNoLeito.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.reservasExternas.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-blue-700 mb-1">Reservas Externas:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-blue-600">
                                          {setor.dadosPlantao.reservasExternas.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.observacoes.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Observações Relevantes:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.observacoes.map((item, index) => (
                                            <li key={index}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.leitosVagos.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-green-700 mb-1">Leitos Vagos:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-green-600">
                                          {setor.dadosPlantao.leitosVagos.map((leito) => (
                                            <li key={leito.id}>
                                              {leito.codigoLeito} ({leito.status})
                                              {leito.compatibilidade !== 'Livre' && ` - ${leito.compatibilidade}`}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.nomeSetor === 'UNID. ONCOLOGIA' &&
                                      setor.dadosPlantao.listaEsperaOncologia.length > 0 && (
                                        <div>
                                          <h5 className="font-semibold text-blue-700 mb-1">
                                            Lista de Espera (Oncologia):
                                          </h5>
                                          <ul className="list-disc list-inside space-y-1 pl-2 text-blue-600">
                                            {setor.dadosPlantao.listaEsperaOncologia.map((item) => (
                                              <li
                                                key={item.id}
                                                className={item.atrasado ? 'font-bold text-red-600' : ''}
                                              >
                                                {item.texto}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    Dados não aplicáveis para este tipo de setor.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {outros
                    .filter((grupo) => (grupo.setores || []).length > 0)
                    .map((grupo) => (
                      <AccordionItem key={grupo.tipo} value={grupo.tipo}>
                        <AccordionTrigger className="text-xl font-semibold">
                          {grupo.tipo}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-col space-y-2 pt-2">
                            {grupo.setores.map((setor) => (
                              <div key={setor.id} className="p-4 border rounded-md">
                                <h4 className="font-medium text-md mb-2">{setor.nome}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Informações específicas não configuradas para este tipo de setor.
                                </p>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t">
          <h3 className="text-lg font-semibold mb-3">Observações Gerais</h3>
          <div className="space-y-2">
            <Label htmlFor="observacoes-gerais">
              Anotações da equipe de regulação:
            </Label>
            <Textarea
              id="observacoes-gerais"
              placeholder="Digite aqui anotações, pendências ou informações importantes para a próxima equipe..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={5}
              disabled={observacoesLoading}
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="outline"
              onClick={handleLimparObservacoes}
              disabled={observacoesLoading || !observacoes}
            >
              Limpar
            </Button>
            <Button onClick={handleSalvarObservacoes} disabled={observacoesLoading}>
              {observacoesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Salvar Observações'
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            onClick={() => setIsPdfInfoModalOpen(true)}
            disabled={loading || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={isPdfInfoModalOpen}
      onOpenChange={(open) => {
        if (!isGeneratingPdf) {
          setIsPdfInfoModalOpen(open);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Informações para o Relatório</AlertDialogTitle>
          <AlertDialogDescription>
            Preencha os dados do plantão para gerar o PDF.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="enfermeiro-nome">Nome do(a) Enfermeiro(a)</Label>
            <Input
              id="enfermeiro-nome"
              value={pdfInfo.enfermeiro}
              onChange={(e) =>
                setPdfInfo((prev) => ({ ...prev, enfermeiro: e.target.value }))
              }
              disabled={isGeneratingPdf}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medico-nome">Nome do(a) Médico(a)</Label>
            <Input
              id="medico-nome"
              value={pdfInfo.medico}
              onChange={(e) =>
                setPdfInfo((prev) => ({ ...prev, medico: e.target.value }))
              }
              disabled={isGeneratingPdf}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data do Plantão</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start ${
                      pdfInfo.data instanceof Date ? '' : 'text-muted-foreground'
                    }`}
                    disabled={isGeneratingPdf}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pdfInfo.data instanceof Date
                      ? format(pdfInfo.data, 'dd/MM/yyyy')
                      : 'Selecione uma data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={pdfInfo.data instanceof Date ? pdfInfo.data : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setPdfInfo((prev) => ({ ...prev, data: date }));
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select
                value={pdfInfo.turno}
                onValueChange={(value) =>
                  setPdfInfo((prev) => ({ ...prev, turno: value }))
                }
                disabled={isGeneratingPdf}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o turno" />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map((turno) => (
                    <SelectItem key={turno.value} value={turno.value}>
                      {turno.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isGeneratingPdf}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isGeneratingPdf || !isPdfInfoValid}
            onClick={(event) => {
              event.preventDefault();
              handleGeneratePdf();
            }}
          >
            {isGeneratingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isGeneratingPdf ? 'Gerando...' : 'Confirmar e Gerar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
      <div id="pdf-layout" ref={pdfLayoutRef}>
        <PassagemPlantaoPDFLayout data={pdfData} pdfInfo={pdfInfo} />
      </div>
    </div>
    </>
  );
};

export default PassagemPlantaoModal;
