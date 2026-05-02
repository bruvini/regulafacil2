// src/pages/ConfiguracoesPage.jsx
// Módulo de Configurações Dinâmicas de Regulação
// Acesso restrito a Administradores (tipoUsuario === 'Administrador')
// Regras são persistidas em: Firestore > configuracoes/regras_regulacao

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRegrasConfig, REGRAS_DEFAULT } from "@/hooks/useRegrasConfig";
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
import {
  Settings,
  ShieldAlert,
  Plus,
  X,
  Save,
  RotateCcw,
  Info,
  Hospital,
  Stethoscope,
  Clock,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// ============================================================
// COMPONENTE DE TAGS EDITÁVEIS
// ============================================================
const TagsEditaveis = ({ tags = [], onChange, placeholder = "Adicionar...", corBadge = "secondary" }) => {
  const [novoItem, setNovoItem] = useState("");

  const adicionar = () => {
    const valor = novoItem.trim().toUpperCase();
    if (!valor || tags.includes(valor)) return;
    onChange([...tags, valor]);
    setNovoItem("");
  };

  const remover = (item) => {
    onChange(tags.filter((t) => t !== item));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant={corBadge}
            className="gap-1 pr-1 text-xs font-medium cursor-default"
          >
            {tag}
            <button
              type="button"
              onClick={() => remover(tag)}
              className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Nenhum item cadastrado</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={novoItem}
          onChange={(e) => setNovoItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionar())}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={adicionar} className="h-8 px-3">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const ConfiguracoesPage = () => {
  const { currentUser } = useAuth();
  const { regras, loading, salvando, salvarRegras } = useRegrasConfig();

  // Estado local das configurações (editável antes de salvar)
  const [pcpLocal, setPcpLocal] = useState(REGRAS_DEFAULT.pcp);
  const [perfisLocal, setPerfisLocal] = useState(REGRAS_DEFAULT.perfisSetor);
  const [novoSetor, setNovoSetor] = useState("");
  const [alterado, setAlterado] = useState(false);

  // Sincroniza com os dados do Firebase ao carregar
  useEffect(() => {
    if (!loading && regras) {
      setPcpLocal(regras.pcp ?? REGRAS_DEFAULT.pcp);
      setPerfisLocal(regras.perfisSetor ?? REGRAS_DEFAULT.perfisSetor);
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

  // ── Handlers Perfis de Setor ───────────────────────────────
  const adicionarSetor = () => {
    const nome = novoSetor.trim().toUpperCase();
    if (!nome || perfisLocal[nome]) return;
    setPerfisLocal((prev) => ({ ...prev, [nome]: [] }));
    setNovoSetor("");
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

  // ── Salvar ─────────────────────────────────────────────────
  const handleSalvar = async () => {
    const novasRegras = {
      pcp: {
        idadeMinima: Number(pcpLocal.idadeMinima) || 18,
        idadeMaxima: Number(pcpLocal.idadeMaxima) || 60,
        origensBloqueadas: pcpLocal.origensBloqueadas,
      },
      perfisSetor: perfisLocal,
    };

    const resultado = await salvarRegras(novasRegras);
    if (resultado.sucesso) {
      toast({ title: "✅ Configurações salvas", description: "As regras foram atualizadas no Firestore com sucesso." });
      setAlterado(false);
    } else {
      toast({ title: "❌ Erro ao salvar", description: resultado.erro, variant: "destructive" });
    }
  };

  // ── Resetar ────────────────────────────────────────────────
  const handleReset = () => {
    setPcpLocal(REGRAS_DEFAULT.pcp);
    setPerfisLocal(REGRAS_DEFAULT.perfisSetor);
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
            <Save className="h-3.5 w-3.5" />
            {salvando ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {alterado && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>Você tem alterações não salvas. Clique em <strong>Salvar Configurações</strong> para persistir no Firestore.</span>
        </div>
      )}

      {/* ────────────────────────────────────────────────────── */}
      {/* BLOCO 1 — Regras de Cuidados Prolongados (PCP)        */}
      {/* ────────────────────────────────────────────────────── */}
      <Card className="border-blue-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Regras de Cuidados Prolongados (PCP)</CardTitle>
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

          {/* Origens Bloqueadas */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Origens Bloqueadas</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pacientes procedentes de setores com estes termos no nome são bloqueados.
                {/* TODO (HL7 v3.0): Estes termos serão mapeados para segmentos ADT/EVN do padrão HL7 */}
              </p>
            </div>
            <TagsEditaveis
              tags={pcpLocal.origensBloqueadas ?? []}
              onChange={(novas) => handlePcpChange("origensBloqueadas", novas)}
              placeholder="Ex: RPA, RECUPERACAO, UTI..."
              corBadge="destructive"
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
              <CardTitle className="text-base">Mapeamento de Especialidades por Setor</CardTitle>
              <CardDescription className="text-xs">
                Define quais especialidades clínicas são elegíveis para cada setor de internação.
              </CardDescription>
            </div>
          </div>
          {/* Nota FHIR */}
          <div className="flex items-start gap-2 mt-2 text-xs text-blue-600 bg-blue-500/5 border border-blue-500/15 rounded-md px-3 py-2">
            <Stethoscope className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>
              <strong>Alinhamento FHIR (v3.0):</strong> Estas especialidades serão cruzadas futuramente com o campo{" "}
              <code className="bg-muted px-1 rounded">Patient.generalPractitioner</code> e o recurso{" "}
              <code className="bg-muted px-1 rounded">Organization.type</code> do padrão HL7 FHIR R4,
              garantindo interoperabilidade semântica com sistemas externos.
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adicionar novo setor */}
          <div className="flex gap-2">
            <Input
              value={novoSetor}
              onChange={(e) => setNovoSetor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarSetor())}
              placeholder="Nome do novo setor (ex: UNID. NEUROLOGIA)..."
              className="h-9 text-xs"
            />
            <Button type="button" size="sm" variant="outline" onClick={adicionarSetor} className="h-9 shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" /> Setor
            </Button>
          </div>

          {/* Setores existentes */}
          <div className="space-y-4">
            {Object.entries(perfisLocal).map(([setor, especialidades]) => (
              <div key={setor} className="rounded-lg border bg-card/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{setor}</span>
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
                <TagsEditaveis
                  tags={especialidades}
                  onChange={(novas) => atualizarEspecialidades(setor, novas)}
                  placeholder="Adicionar especialidade..."
                  corBadge="secondary"
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
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar no Firestore"}
        </Button>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
