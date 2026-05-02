// src/pages/ConfiguracoesPage.jsx
// Módulo de Configurações Dinâmicas de Regulação
// Acesso restrito a Administradores (tipoUsuario === 'Administrador')
// Regras são persistidas em: Firestore > configuracoes/regras_regulacao

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRegrasConfig, REGRAS_DEFAULT } from "@/hooks/useRegrasConfig";
import { useSetores } from "@/hooks/useCollections";
import {
  ESPECIALIDADES_MEDICAS,
  ESPECIALIDADES_CIRURGICAS,
  ESPECIALIDADES_CLINICAS,
} from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  ShieldAlert,
  X,
  Save,
  RotateCcw,
  Info,
  Hospital,
  Stethoscope,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Link,
  Database,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// ============================================================
// LISTA MESTRE DE ESPECIALIDADES — Deduplicated + Sorted
// Combina ESPECIALIDADES_MEDICAS + CIRURGICAS + CLINICAS sem duplicatas
// ============================================================
const TODAS_ESPECIALIDADES = [
  ...new Set([
    ...ESPECIALIDADES_MEDICAS,
    ...ESPECIALIDADES_CIRURGICAS,
    ...ESPECIALIDADES_CLINICAS,
  ]),
].sort((a, b) => a.localeCompare(b, "pt-BR"));

// ============================================================
// COMPONENTE: Seletor de Especialidades por Checkboxes
// ============================================================
const SeletorEspecialidades = ({ selecionadas = [], onChange }) => {
  const [expandido, setExpandido] = useState(false);

  const toggle = (esp) => {
    if (selecionadas.includes(esp)) {
      onChange(selecionadas.filter((e) => e !== esp));
    } else {
      onChange([...selecionadas, esp]);
    }
  };

  const limpar = () => onChange([]);

  return (
    <div className="space-y-2">
      {/* Badges das selecionadas */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selecionadas.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            Nenhuma especialidade selecionada
          </span>
        ) : (
          selecionadas.map((esp) => (
            <Badge key={esp} variant="secondary" className="gap-1 pr-1 text-xs">
              {esp}
              <button
                type="button"
                onClick={() => toggle(esp)}
                className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))
        )}
      </div>

      {/* Botão para abrir/fechar lista */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
      >
        {expandido ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {expandido ? "Ocultar lista" : "Selecionar especialidades"}
      </button>

      {expandido && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {selecionadas.length} de {TODAS_ESPECIALIDADES.length} selecionadas
            </span>
            {selecionadas.length > 0 && (
              <button
                type="button"
                onClick={limpar}
                className="text-xs text-destructive hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <ScrollArea className="h-48">
            <div className="space-y-1.5 pr-3">
              {TODAS_ESPECIALIDADES.map((esp) => (
                <div key={esp} className="flex items-center gap-2">
                  <Checkbox
                    id={`esp-${esp}`}
                    checked={selecionadas.includes(esp)}
                    onCheckedChange={() => toggle(esp)}
                    className="h-3.5 w-3.5"
                  />
                  <label
                    htmlFor={`esp-${esp}`}
                    className="text-xs cursor-pointer text-foreground leading-none"
                  >
                    {esp}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMPONENTE: Seletor de Origens Bloqueadas (por setores)
// ============================================================
const SeletorOrigensBloqueadas = ({ selecionadas = [], onChange, setoresDisponiveis = [], loadingSetores }) => {
  const [expandido, setExpandido] = useState(false);

  // Opções fixas essenciais que podem não vir do cadastro
  const OPCOES_FIXAS = ["RPA", "CC - RECUPERAÇÃO", "RECUPERACAO"];

  // Combina setores do banco + opções fixas, sem duplicatas, normalizado
  const todasOpcoes = useMemo(() => {
    const nomesSetores = setoresDisponiveis
      .map((s) => s.nomeSetor || s.nome || s.siglaSetor || "")
      .filter(Boolean);
    return [...new Set([...nomesSetores, ...OPCOES_FIXAS])].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setoresDisponiveis]);

  const toggle = (origem) => {
    if (selecionadas.includes(origem)) {
      onChange(selecionadas.filter((o) => o !== origem));
    } else {
      onChange([...selecionadas, origem]);
    }
  };

  const limpar = () => onChange([]);

  return (
    <div className="space-y-2">
      {/* Badges das selecionadas */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selecionadas.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            Nenhuma origem bloqueada
          </span>
        ) : (
          selecionadas.map((orig) => (
            <Badge key={orig} variant="destructive" className="gap-1 pr-1 text-xs">
              {orig}
              <button
                type="button"
                onClick={() => toggle(orig)}
                className="ml-0.5 rounded-full hover:bg-destructive-foreground/20 p-0.5 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))
        )}
      </div>

      {/* Botão para abrir/fechar lista */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium"
      >
        {expandido ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {expandido ? "Ocultar lista" : "Selecionar origens a bloquear"}
      </button>

      {expandido && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
          {loadingSetores ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando setores do banco...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {selecionadas.length} de {todasOpcoes.length} bloqueadas
                </span>
                {selecionadas.length > 0 && (
                  <button
                    type="button"
                    onClick={limpar}
                    className="text-xs text-destructive hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <ScrollArea className="h-52">
                <div className="space-y-1.5 pr-3">
                  {todasOpcoes.map((orig) => (
                    <div key={orig} className="flex items-center gap-2">
                      <Checkbox
                        id={`orig-${orig}`}
                        checked={selecionadas.includes(orig)}
                        onCheckedChange={() => toggle(orig)}
                        className="h-3.5 w-3.5 border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                      />
                      <label
                        htmlFor={`orig-${orig}`}
                        className="text-xs cursor-pointer text-foreground leading-none"
                      >
                        {orig}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const ConfiguracoesPage = () => {
  const { currentUser } = useAuth();
  const { regras, loading, salvando, salvarRegras } = useRegrasConfig();
  const { data: setoresDB = [], loading: loadingSetores } = useSetores();

  // Estado local das configurações (editável antes de salvar)
  const [pcpLocal, setPcpLocal] = useState(REGRAS_DEFAULT.pcp);
  const [perfisLocal, setPerfisLocal] = useState(REGRAS_DEFAULT.perfisSetor);
  const [importacaoMVLocal, setImportacaoMVLocal] = useState(REGRAS_DEFAULT.importacaoMV);
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [alterado, setAlterado] = useState(false);

  // Sincroniza com os dados do Firebase ao carregar
  useEffect(() => {
    if (!loading && regras) {
      setPcpLocal(regras.pcp ?? REGRAS_DEFAULT.pcp);
      setPerfisLocal(regras.perfisSetor ?? REGRAS_DEFAULT.perfisSetor);
      setImportacaoMVLocal(regras.importacaoMV ?? REGRAS_DEFAULT.importacaoMV);
    }
  }, [loading, regras]);

  // Guard de acesso — apenas Administradores
  const isAdmin = currentUser?.tipoUsuario === "Administrador";

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Acesso Negado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Este módulo é restrito a administradores do sistema.
          </p>
        </div>
      </div>
    );
  }

  // ── Handlers PCP ──────────────────────────────────────────
  const handlePcpChange = (campo, valor) => {
    setPcpLocal((prev) => ({ ...prev, [campo]: valor }));
    setAlterado(true);
  };

  // ── Handlers Importação MV ─────────────────────────────────
  const handleImportacaoMVChange = (campo, valor) => {
    setImportacaoMVLocal((prev) => ({ ...prev, [campo]: valor }));
    setAlterado(true);
  };

  // ── Handlers Perfis de Setor ───────────────────────────────
  const adicionarSetor = () => {
    const nome = setorSelecionado.trim().toUpperCase();
    if (!nome || perfisLocal[nome]) return;
    setPerfisLocal((prev) => ({ ...prev, [nome]: [] }));
    setSetorSelecionado("");
    setAlterado(true);
  };

  const removerSetor = (nome) => {
    const copia = { ...perfisLocal };
    delete copia[nome];
    setPerfisLocal(copia);
    setAlterado(true);
  };

  const atualizarEspecialidades = (setor, especialidades) => {
    setPerfisLocal((prev) => ({ ...prev, [setor]: especialidades }));
    setAlterado(true);
  };

  // Setores disponíveis para adicionar (que ainda não estão configurados)
  const nomesSetoresDB = setoresDB
    .map((s) => (s.nomeSetor || s.nome || s.siglaSetor || "").toUpperCase())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const setoresDisponiveisParaAdicionar = nomesSetoresDB.filter(
    (nome) => !perfisLocal[nome],
  );

  // ── Salvar ─────────────────────────────────────────────────
  const handleSalvar = async () => {
    const novasRegras = {
      pcp: {
        idadeMinima: Number(pcpLocal.idadeMinima) || 18,
        idadeMaxima: Number(pcpLocal.idadeMaxima) || 60,
        origensBloqueadas: pcpLocal.origensBloqueadas,
      },
      perfisSetor: perfisLocal,
      importacaoMV: {
        linkPainel: importacaoMVLocal.linkPainel?.trim() || REGRAS_DEFAULT.importacaoMV.linkPainel,
        login: importacaoMVLocal.login?.trim() || REGRAS_DEFAULT.importacaoMV.login,
        senha: importacaoMVLocal.senha?.trim() || REGRAS_DEFAULT.importacaoMV.senha,
        nomePainel: importacaoMVLocal.nomePainel?.trim() || REGRAS_DEFAULT.importacaoMV.nomePainel,
      },
    };

    const resultado = await salvarRegras(novasRegras);
    if (resultado.sucesso) {
      toast({
        title: "✅ Configurações salvas",
        description: "As regras foram atualizadas no Firestore com sucesso.",
      });
      setAlterado(false);
    } else {
      toast({
        title: "❌ Erro ao salvar",
        description: resultado.erro,
        variant: "destructive",
      });
    }
  };

  // ── Resetar ────────────────────────────────────────────────
  const handleReset = () => {
    setPcpLocal(REGRAS_DEFAULT.pcp);
    setPerfisLocal(REGRAS_DEFAULT.perfisSetor);
    setImportacaoMVLocal(REGRAS_DEFAULT.importacaoMV);
    setAlterado(true);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações de Regulação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Motor de Regras dinâmico — alterações refletem em tempo real no sistema de sugestões.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={salvando}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
          <Button
            onClick={handleSalvar}
            size="sm"
            disabled={salvando || !alterado}
            className="gap-1.5"
          >
            {salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {salvando ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {alterado && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>
            Você tem alterações não salvas. Clique em{" "}
            <strong>Salvar Configurações</strong> para persistir no Firestore.
          </span>
        </div>
      )}

      {/* ────────────────────────────────────────────────────── */}
      {/* BLOCO 1 — Regras do Plano de Capacidade Plena (PCP)   */}
      {/* ────────────────────────────────────────────────────── */}
      <Card className="border-blue-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">
                Regras do Plano de Capacidade Plena (PCP)
              </CardTitle>
              <CardDescription className="text-xs">
                Hard Rules aplicadas a todos os leitos identificados com o código PCP.
                Erros aqui têm impacto clínico direto — altere com responsabilidade.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Faixa Etária */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Faixa Etária Permitida</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="idadeMinima" className="text-xs text-muted-foreground">
                  Idade Mínima (anos)
                </Label>
                <Input
                  id="idadeMinima"
                  type="number"
                  min={0}
                  max={120}
                  value={pcpLocal.idadeMinima}
                  onChange={(e) => handlePcpChange("idadeMinima", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="idadeMaxima" className="text-xs text-muted-foreground">
                  Idade Máxima (anos)
                </Label>
                <Input
                  id="idadeMaxima"
                  type="number"
                  min={0}
                  max={120}
                  value={pcpLocal.idadeMaxima}
                  onChange={(e) => handlePcpChange("idadeMaxima", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pacientes fora desta faixa são automaticamente excluídos das sugestões de leito PCP.
            </p>
          </div>

          <Separator />

          {/* Origens Bloqueadas — Seleção Estruturada por Setores */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Origens Bloqueadas</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pacientes procedentes dos setores selecionados abaixo são
                automaticamente bloqueados para leitos PCP.
                {/* TODO (HL7 v3.0): Mapeamento para segmentos ADT/EVN do padrão HL7 */}
              </p>
            </div>
            <SeletorOrigensBloqueadas
              selecionadas={pcpLocal.origensBloqueadas ?? []}
              onChange={(novas) => handlePcpChange("origensBloqueadas", novas)}
              setoresDisponiveis={setoresDB}
              loadingSetores={loadingSetores}
            />
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────── */}
      {/* BLOCO 2 — Mapeamento de Especialidades por Setor      */}
      {/* ────────────────────────────────────────────────────── */}
      <Card className="border-emerald-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Hospital className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base">
                Mapeamento de Especialidades por Setor
              </CardTitle>
              <CardDescription className="text-xs">
                Define quais especialidades clínicas são elegíveis para cada setor de internação.
              </CardDescription>
            </div>
          </div>
          {/* Nota FHIR */}
          <div className="flex items-start gap-2 mt-2 text-xs text-blue-600 bg-blue-500/5 border border-blue-500/15 rounded-md px-3 py-2">
            <Stethoscope className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>
              <strong>Alinhamento FHIR (v3.0):</strong> Estas especialidades serão
              cruzadas futuramente com o campo{" "}
              <code className="bg-muted px-1 rounded">Patient.generalPractitioner</code>{" "}
              e o recurso{" "}
              <code className="bg-muted px-1 rounded">Organization.type</code> do padrão
              HL7 FHIR R4, garantindo interoperabilidade semântica com sistemas externos.
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Adicionar novo setor — via select dos setores do banco */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Adicionar setor ao mapeamento
            </Label>
            <div className="flex gap-2">
              {loadingSetores ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando setores...
                </div>
              ) : (
                <>
                  <select
                    value={setorSelecionado}
                    onChange={(e) => setSetorSelecionado(e.target.value)}
                    className="flex-1 h-9 text-xs rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Selecione um setor...</option>
                    {setoresDisponiveisParaAdicionar.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={adicionarSetor}
                    disabled={!setorSelecionado}
                    className="h-9 shrink-0"
                  >
                    + Adicionar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Setores configurados */}
          <div className="space-y-4">
            {Object.entries(perfisLocal).map(([setor, especialidades]) => (
              <div key={setor} className="rounded-lg border bg-card/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {setor}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removerSetor(setor)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <SeletorEspecialidades
                  selecionadas={especialidades}
                  onChange={(novas) => {
                    atualizarEspecialidades(setor, novas);
                  }}
                />
              </div>
            ))}
            {Object.keys(perfisLocal).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum setor configurado. Adicione um setor acima.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────── */}
      {/* BLOCO 3 — Configurações de Importação (Soul MV)     */}
      {/* ──────────────────────────────────────────────── */}
      <Card className="border-violet-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Database className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-base">
                Configurações de Importação (Soul MV)
              </CardTitle>
              <CardDescription className="text-xs">
                Parâmetros utilizados nas instruções do modal de importação de pacientes via planilha XLS.
                Altere aqui caso as credenciais ou o painel do Soul MV sejam atualizados.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Link do Painel */}
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="mv-link" className="text-xs text-muted-foreground font-medium">
                Link do Painel (URL)
              </Label>
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  id="mv-link"
                  type="url"
                  value={importacaoMVLocal.linkPainel ?? ""}
                  onChange={(e) => handleImportacaoMVChange("linkPainel", e.target.value)}
                  placeholder="http://..."
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Login */}
            <div className="space-y-1">
              <Label htmlFor="mv-login" className="text-xs text-muted-foreground font-medium">
                Login de Acesso
              </Label>
              <Input
                id="mv-login"
                type="text"
                value={importacaoMVLocal.login ?? ""}
                onChange={(e) => handleImportacaoMVChange("login", e.target.value)}
                placeholder="Ex: nir"
                className="h-9 text-xs"
              />
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <Label htmlFor="mv-senha" className="text-xs text-muted-foreground font-medium">
                Senha de Acesso
              </Label>
              <Input
                id="mv-senha"
                type="text"
                value={importacaoMVLocal.senha ?? ""}
                onChange={(e) => handleImportacaoMVChange("senha", e.target.value)}
                placeholder="Ex: nir"
                className="h-9 text-xs"
              />
            </div>

            {/* Nome do Painel */}
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="mv-painel" className="text-xs text-muted-foreground font-medium">
                Nome do Painel de Indicadores
              </Label>
              <Input
                id="mv-painel"
                type="text"
                value={importacaoMVLocal.nomePainel ?? ""}
                onChange={(e) => handleImportacaoMVChange("nomePainel", e.target.value)}
                placeholder="Ex: NIR - Ocupação Setores"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Estas configurações são exibidas nas instruções do modal “Importar e Sincronizar
            Pacientes do Soul MV” para orientar os usuários no processo de exportação da planilha.
          </p>
        </CardContent>
      </Card>

      {/* Rodapé com ação de salvar */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={salvando}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar padrão
        </Button>
        <Button
          onClick={handleSalvar}
          disabled={salvando || !alterado}
          className="gap-1.5"
        >
          {salvando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {salvando ? "Salvando..." : "Salvar no Firestore"}
        </Button>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
