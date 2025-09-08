import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  ExternalLink,
  Database,
  ArrowRightLeft,
  UserPlus,
  UserMinus,
  Copy,
  RefreshCw
} from 'lucide-react';
import { 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  arrayUnion,
  db
} from '@/lib/firebase';
import { 
  getSetoresCollection, 
  getLeitosCollection, 
  getPacientesCollection 
} from '@/lib/firebase';
import { writeBatch } from 'firebase/firestore';
import { logAction } from '@/lib/auditoria';
import { toast } from 'sonner';

const ImportarPacientesMVModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState('instructions'); // instructions, processing, validation, confirmation, completed
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [syncSummary, setSyncSummary] = useState({
    altas: 0,
    movimentacoes: 0,
    internacoes: 0,
    novosSetores: 0,
    novosLeitos: 0
  });
  
  // Novos estados para validação
  const [setoresFaltantes, setSetoresFaltantes] = useState([]);
  const [leitosFaltantes, setLeitosFaltantes] = useState([]);
  const [parsedFileData, setParsedFileData] = useState(null); // Para armazenar dados do arquivo já processado

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Pular as primeiras 3 linhas (cabeçalho) e processar a partir da linha 4
          const pacientesData = jsonData.slice(3).filter(row => row[0]).map(row => ({
            nomePaciente: (row[0] || '').toString().toUpperCase().trim(),
            dataNascimento: (row[1] || '').toString(),
            sexo: (row[2] || '').toString().toUpperCase(),
            dataInternacao: (row[3] || '').toString(),
            nomeSetor: (row[4] || '').toString().trim(),
            codigoLeito: (row[6] || '').toString().trim(),
            especialidade: (row[7] || '').toString().toUpperCase().trim()
          })).filter(p => p.nomePaciente && p.codigoLeito);
          
          resolve(pacientesData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const loadFirestoreData = async () => {
    const [setoresSnapshot, leitosSnapshot, pacientesSnapshot] = await Promise.all([
      getDocs(getSetoresCollection()),
      getDocs(getLeitosCollection()),
      getDocs(getPacientesCollection())
    ]);

    const setores = {};
    const leitos = {};
    const pacientes = {};

    setoresSnapshot.forEach(doc => {
      setores[doc.data().nome] = { id: doc.id, ...doc.data() };
    });

    leitosSnapshot.forEach(doc => {
      leitos[doc.data().codigo] = { id: doc.id, ...doc.data() };
    });

    pacientesSnapshot.forEach(doc => {
      pacientes[doc.data().nomePaciente] = { id: doc.id, ...doc.data() };
    });

    return { setores, leitos, pacientes };
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setCurrentStep('processing');

    try {
      // Parse do arquivo Excel
      const pacientesArquivo = await parseExcelFile(selectedFile);
      setParsedFileData(pacientesArquivo); // Armazenar dados do arquivo
      
      // Carregamento dos dados do Firestore
      const { setores, leitos, pacientes } = await loadFirestoreData();

      // Identificar setores e leitos faltantes
      const setoresParaCriar = new Set();
      const leitosParaCriar = [];

      for (const paciente of pacientesArquivo) {
        if (!setores[paciente.nomeSetor]) {
          setoresParaCriar.add(paciente.nomeSetor);
        }
        if (!leitos[paciente.codigoLeito]) {
          leitosParaCriar.push({
            codigo: paciente.codigoLeito,
            nomeSetor: paciente.nomeSetor
          });
        }
      }

      // Verificar se há pendências
      if (setoresParaCriar.size > 0 || leitosParaCriar.length > 0) {
        // Há pendências - pausar processo e mostrar validação
        setSetoresFaltantes(Array.from(setoresParaCriar));
        
        // Organizar leitos faltantes por setor
        const leitosPorSetor = {};
        leitosParaCriar.forEach(leito => {
          if (!leitosPorSetor[leito.nomeSetor]) {
            leitosPorSetor[leito.nomeSetor] = [];
          }
          leitosPorSetor[leito.nomeSetor].push(leito.codigo);
        });
        setLeitosFaltantes(leitosPorSetor);
        
        setCurrentStep('validation');
        setIsProcessing(false);
        return; // Parar aqui - não prosseguir
      }

      // Se chegou aqui, não há pendências - prosseguir com análise
      await analyzeAndProceed(pacientesArquivo, setores, leitos, pacientes);

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo: ' + error.message);
      setIsProcessing(false);
    }
  };

  // Nova função para análise após validação
  const analyzeAndProceed = async (pacientesArquivo, setores, leitos, pacientes) => {
    // Análise de reconciliação
    const altas = [];
    const movimentacoes = [];
    const internacoes = [];

    // Pacientes no arquivo (por nome)
    const pacientesArquivoMap = {};
    pacientesArquivo.forEach(p => {
      pacientesArquivoMap[p.nomePaciente] = p;
    });

    // Regra 1: Altas (no Firestore mas não no arquivo)
    Object.keys(pacientes).forEach(nomePaciente => {
      if (!pacientesArquivoMap[nomePaciente]) {
        altas.push(pacientes[nomePaciente]);
      }
    });

    // Regra 2 e 3: Movimentações e Internações
    Object.keys(pacientesArquivoMap).forEach(nomePaciente => {
      const pacienteArquivo = pacientesArquivoMap[nomePaciente];
      const pacienteFirestore = pacientes[nomePaciente];

      if (pacienteFirestore) {
        // Verificar se mudou de leito
        const leitoAtualId = pacienteFirestore.leitoId;
        const leitoNovoId = leitos[pacienteArquivo.codigoLeito]?.id;
        
        if (leitoAtualId !== leitoNovoId) {
          movimentacoes.push({
            paciente: pacienteFirestore,
            dadosNovos: {
              ...pacienteArquivo,
              leitoId: leitoNovoId,
              setorId: setores[pacienteArquivo.nomeSetor].id
            }
          });
        }
      } else {
        // Nova internação
        internacoes.push({
          ...pacienteArquivo,
          leitoId: leitos[pacienteArquivo.codigoLeito].id,
          setorId: setores[pacienteArquivo.nomeSetor].id
        });
      }
    });

    setProcessedData({
      altas,
      movimentacoes,
      internacoes,
      novosSetores: [],
      novosLeitos: [],
      setores,
      leitos
    });

    setSyncSummary({
      altas: altas.length,
      movimentacoes: movimentacoes.length,
      internacoes: internacoes.length,
      novosSetores: 0,
      novosLeitos: 0
    });

    setCurrentStep('confirmation');
    setIsProcessing(false);
  };

  const executeSynchronization = async () => {
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const leitosParaAtualizar = new Set();

      // Executar altas (deletar pacientes)
      processedData.altas.forEach(paciente => {
        const pacienteRef = doc(db, 'artifacts/regulafacil/public/data/pacientes', paciente.id);
        batch.delete(pacienteRef);
        leitosParaAtualizar.add(paciente.leitoId);
      });

      // Executar movimentações
      processedData.movimentacoes.forEach(({ paciente, dadosNovos }) => {
        const pacienteRef = doc(db, 'artifacts/regulafacil/public/data/pacientes', paciente.id);
        batch.update(pacienteRef, {
          leitoId: dadosNovos.leitoId,
          setorId: dadosNovos.setorId,
          dataInternacao: serverTimestamp(),
          especialidade: dadosNovos.especialidade
        });
        leitosParaAtualizar.add(paciente.leitoId); // Leito antigo
        leitosParaAtualizar.add(dadosNovos.leitoId); // Leito novo
      });

      // Executar internações
      processedData.internacoes.forEach(paciente => {
        const pacienteRef = doc(getPacientesCollection());
        batch.set(pacienteRef, {
          nomePaciente: paciente.nomePaciente,
          dataNascimento: paciente.dataNascimento,
          sexo: paciente.sexo,
          dataInternacao: serverTimestamp(),
          especialidade: paciente.especialidade,
          leitoId: paciente.leitoId,
          setorId: paciente.setorId
        });
        leitosParaAtualizar.add(paciente.leitoId);
      });

      // Atualizar status dos leitos afetados
      const pacientesFinais = {};
      
      // Pacientes que ficaram (não foram dados alta)
      Object.keys(processedData.setores).forEach(nomeSetor => {
        processedData.movimentacoes.forEach(({ dadosNovos }) => {
          pacientesFinais[dadosNovos.leitoId] = true;
        });
      });
      
      processedData.internacoes.forEach(paciente => {
        pacientesFinais[paciente.leitoId] = true;
      });

      // Atualizar status de todos os leitos afetados
      leitosParaAtualizar.forEach(leitoId => {
        const leitoRef = doc(db, 'artifacts/regulafacil/public/data/leitos', leitoId);
        const novoStatus = pacientesFinais[leitoId] ? 'Ocupado' : 'Vago';
        batch.update(leitoRef, { 
          status: novoStatus,
          historico: arrayUnion({
            status: novoStatus,
            timestamp: new Date()
          })
        });
      });

      // Executar batch
      await batch.commit();

      // Log de auditoria
      await logAction(
        'Regulação de Leitos', 
        `Sincronização via MV concluída: ${syncSummary.altas} altas, ${syncSummary.movimentacoes} movimentações, ${syncSummary.internacoes} internações.`
      );

      setCurrentStep('completed');
      toast.success('Sincronização concluída com sucesso!');

    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro na sincronização: ' + error.message);
    }

    setIsProcessing(false);
  };

  // Nova função para revalidar cadastros
  const revalidarCadastros = async () => {
    if (!parsedFileData) return;

    setIsProcessing(true);

    try {
      // Carregamento dos dados atualizados do Firestore
      const { setores, leitos, pacientes } = await loadFirestoreData();

      // Verificar novamente se ainda há pendências
      const setoresParaCriar = new Set();
      const leitosParaCriar = [];

      for (const paciente of parsedFileData) {
        if (!setores[paciente.nomeSetor]) {
          setoresParaCriar.add(paciente.nomeSetor);
        }
        if (!leitos[paciente.codigoLeito]) {
          leitosParaCriar.push({
            codigo: paciente.codigoLeito,
            nomeSetor: paciente.nomeSetor
          });
        }
      }

      if (setoresParaCriar.size > 0 || leitosParaCriar.length > 0) {
        // Ainda há pendências - atualizar listas
        setSetoresFaltantes(Array.from(setoresParaCriar));
        
        const leitosPorSetor = {};
        leitosParaCriar.forEach(leito => {
          if (!leitosPorSetor[leito.nomeSetor]) {
            leitosPorSetor[leito.nomeSetor] = [];
          }
          leitosPorSetor[leito.nomeSetor].push(leito.codigo);
        });
        setLeitosFaltantes(leitosPorSetor);
        
        toast.info('Ainda há pendências. Continue o cadastro.');
      } else {
        // Todas as pendências foram resolvidas!
        setSetoresFaltantes([]);
        setLeitosFaltantes([]);
        
        // Prosseguir com análise
        await analyzeAndProceed(parsedFileData, setores, leitos, pacientes);
        toast.success('Todas as pendências foram resolvidas! Prosseguindo...');
      }

    } catch (error) {
      console.error('Erro ao revalidar:', error);
      toast.error('Erro ao revalidar: ' + error.message);
    }

    setIsProcessing(false);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  const resetModal = () => {
    setCurrentStep('instructions');
    setSelectedFile(null);
    setProcessedData(null);
    setSyncSummary({ altas: 0, movimentacoes: 0, internacoes: 0, novosSetores: 0, novosLeitos: 0 });
    setIsProcessing(false);
    setSetoresFaltantes([]);
    setLeitosFaltantes([]);
    setParsedFileData(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const renderInstructions = () => (
    <div className="space-y-6">
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-3">
            <p className="font-semibold">Orientações: Como Obter o Arquivo</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Acesse o painel do Soul MV:{' '}
                <a 
                  href="http://1495prd.cloudmv.com.br/Painel/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Acessar Painel <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li><strong>Login:</strong> <code>NIR</code>, <strong>Senha:</strong> <code>nir@2025</code></li>
              <li>Em "Indicadores", localize o painel <strong>"NIR - Ocupação Setores"</strong></li>
              <li>Clique no ícone de banco de dados, depois em <strong>"Exportar"</strong></li>
              <li>Selecione o formato <strong>"XLS"</strong> e clique no ícone de disquete para salvar</li>
              <li>Volte para esta tela e selecione o arquivo salvo abaixo</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Selecionar Arquivo XLS
          </label>
          <Input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
        </div>

        <Button 
          onClick={processFile}
          disabled={!selectedFile || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando Arquivo...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Processar Arquivo
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderValidation = () => (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-semibold mb-2">Pré-requisitos pendentes</p>
          <p>
            Foram encontrados setores e/ou leitos no arquivo que não existem no sistema. 
            Por favor, realize o cadastro manual no "Gerenciamento de Leitos" para prosseguir com a sincronização.
          </p>
        </AlertDescription>
      </Alert>

      {setoresFaltantes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Setores que precisam ser cadastrados:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted rounded-md">
              <code className="text-sm">{setoresFaltantes.join(', ')}</code>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => copyToClipboard(setoresFaltantes.join(', '))}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Lista de Setores
            </Button>
          </CardContent>
        </Card>
      )}

      {Object.keys(leitosFaltantes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Leitos que precisam ser cadastrados:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(leitosFaltantes).map(([setor, leitos]) => (
              <div key={setor} className="space-y-2">
                <p className="text-sm font-medium">{setor}:</p>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{leitos.join(', ')}</code>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => copyToClipboard(leitos.join(', '))}
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Leitos do {setor}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={handleClose} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={revalidarCadastros}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Cadastros Novamente
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-red-500" />
              Altas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncSummary.altas}</p>
            <p className="text-xs text-muted-foreground">Leitos a serem liberados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-orange-500" />
              Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncSummary.movimentacoes}</p>
            <p className="text-xs text-muted-foreground">Pacientes mudando de leito</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-500" />
              Internações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncSummary.internacoes}</p>
            <p className="text-xs text-muted-foreground">Novas internações</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleClose} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={executeSynchronization}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sincronizando...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Confirmar e Sincronizar
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderCompleted = () => (
    <div className="text-center space-y-4">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
      <div>
        <h3 className="text-lg font-semibold">Sincronização Concluída!</h3>
        <p className="text-muted-foreground">
          Os dados foram sincronizados com sucesso.
        </p>
      </div>
      <Button onClick={handleClose} className="w-full">
        Fechar
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar e Sincronizar Pacientes do Soul MV</DialogTitle>
          <DialogDescription>
            {currentStep === 'instructions' && 'Siga as orientações para obter e processar o arquivo de ocupação dos leitos.'}
            {currentStep === 'processing' && 'Processando arquivo e analisando diferenças...'}
            {currentStep === 'validation' && 'É necessário cadastrar alguns setores e leitos antes de prosseguir.'}
            {currentStep === 'confirmation' && 'Revise as alterações antes de confirmar a sincronização.'}
            {currentStep === 'completed' && 'Processo concluído com sucesso.'}
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'instructions' && renderInstructions()}
        {currentStep === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Processando arquivo e comparando com dados atuais...</p>
          </div>
        )}
        {currentStep === 'validation' && renderValidation()}
        {currentStep === 'confirmation' && renderConfirmation()}
        {currentStep === 'completed' && renderCompleted()}
      </DialogContent>
    </Dialog>
  );
};

export default ImportarPacientesMVModal;