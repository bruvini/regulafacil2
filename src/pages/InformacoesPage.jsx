import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Info,
  FileText,
  Lock,
  Server,
  Activity,
  Users,
  AlertTriangle,
  Trophy,
} from "lucide-react";

const InformacoesPage = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Informações e Políticas
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Documentação institucional do sistema RegulaFacil — NIR/HMSJ.
          Transparência sobre arquitetura, conformidade legal e licenciamento.
        </p>
      </div>

      {/* BLOCO 1 — Sobre o RegulaFacil e Premiação */}
      <Card className="border-primary/20 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Prêmio InovACIJ 2025</CardTitle>
              <CardDescription>
                Vencedor do "Oscar da Inovação" em Joinville
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                O <strong className="text-foreground">RegulaFacil</strong> foi o grande vencedor da 1ª edição do <strong className="text-foreground">Prêmio InovACIJ 2025</strong>, reconhecido como um marco na transformação digital da saúde em Joinville.
              </p>
              <p>
                Desenvolvido no <strong className="text-foreground">Núcleo Interno de Regulação (NIR)</strong> pelo Enfermeiro e Data Scientist Bruno Vinicius da Silva, o sistema foi premiado por sua capacidade de otimizar a gestão de leitos, ampliar a segurança clínica e elevar drasticamente a eficiência operacional do Hospital Municipal São José.
              </p>
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 py-1">
                🏆 Destaque em Inovação Tecnológica
              </Badge>
            </div>
            <div className="rounded-xl overflow-hidden border shadow-lg">
              <img 
                src="/premiacao_inovacij.jpg" 
                alt="Premiação InovACIJ 2025" 
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full mt-6">
            <AccordionItem value="origem" className="border-none">
              <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-2 bg-muted/30 px-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Origem e Propósito do Sistema
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pt-3">
                <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    Criado para resolver a complexidade da regulação hospitalar, o RegulaFacil automatiza o fluxo de pacientes desde a porta de entrada até a alta, garantindo que o leito certo seja destinado ao paciente certo no tempo adequado.
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Mapa de Leitos dinâmico com visibilidade total do NIR",
                      "Score Clínico inteligente para priorização de vagas",
                      "Monitoramento em tempo real de gargalos (RPA, PS, Decisão)",
                      "Gestão de indicadores de permanência (TMP) e eficiência",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* BLOCO 2 — Segurança da Informação */}
      <Card className="border-blue-500/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Server className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Segurança da Informação</CardTitle>
              <CardDescription>
                Arquitetura moderna com interoperabilidade FHIR e HL7
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              A arquitetura do RegulaFacil utiliza infraestrutura de nuvem segura com criptografia TLS 1.3 em trânsito e AES-256 em repouso. O sistema foi projetado para ser o elo de comunicação entre diferentes plataformas de saúde.
            </p>
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="fhir">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                    Padrão FHIR R4 (Fast Healthcare Interoperability Resources)
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs leading-relaxed">
                    O sistema modela seus recursos clínicos seguindo o padrão <strong className="text-foreground">HL7 FHIR R4</strong>, garantindo que a regulação possa ser integrada a qualquer prontuário eletrônico moderno ou rede nacional de dados (RNDS), facilitando a continuidade do cuidado.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="hl7">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    Mensageria HL7 v2.x
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs leading-relaxed">
                    Suporte técnico para integração via protocolos de mensageria <strong className="text-foreground">HL7</strong>, permitindo o recebimento automático de eventos de admissão, transferência e alta (ADT) dos sistemas legados do hospital.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 3 — Conformidade LGPD */}
      <Card className="border-emerald-500/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Conformidade com a LGPD</CardTitle>
              <CardDescription>
                Lei nº 13.709/2018 — Tratamento Ético e Legal
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              O tratamento de dados pessoais sensíveis de saúde no RegulaFacil é fundamentado nos pilares éticos e legais da Lei Geral de Proteção de Dados.
            </p>
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="bases-legais">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                  Bases Legais de Tratamento
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-xs leading-relaxed">
                    <p>O processamento das informações ocorre sob as seguintes condições:</p>
                    <ul className="space-y-1 ml-3 list-disc">
                      <li><strong className="text-foreground">Tutela da Saúde:</strong> Realizada por profissionais de saúde no NIR.</li>
                      <li><strong className="text-foreground">Legítimo Interesse:</strong> Otimização da fila de espera por leitos críticos.</li>
                      <li><strong className="text-foreground">Obrigação Legal:</strong> Registros sanitários e fluxos regulatórios obrigatórios.</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="snomed">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                  Mapeamento Clínico SNOMED CT
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs leading-relaxed">
                    O sistema utiliza a terminologia <strong className="text-foreground">SNOMED CT</strong> para o mapeamento semântico de condições clínicas e isolamentos, garantindo que a informação seja precisa, auditável e livre de ambiguidades textuais durante a jornada do paciente.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 4 — Política de Uso e Licença */}
      <Card className="border-amber-500/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Política de Uso e Licenciamento</CardTitle>
              <CardDescription>
                Regras de utilização e Código Aberto
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs italic">
                Acesso restrito a profissionais de saúde autorizados do Hospital Municipal São José. O uso indevido está sujeito a sanções administrativas e legais.
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-foreground" />
                <span className="text-sm font-semibold text-foreground">Licença GPLv3</span>
              </div>
              <p className="text-xs leading-relaxed">
                Este software é livre e licenciado sob a <strong className="text-foreground">GNU General Public License v3.0</strong>. Isso garante a liberdade de usar, estudar e compartilhar as melhorias do sistema, promovendo a inovação aberta na gestão pública de saúde.
              </p>
            </div>

            <div className="text-xs space-y-1 pt-2">
              <p><strong className="text-foreground">Responsável Técnico:</strong> Enf. Bruno Vinícius da Silva (NIR/HMSJ)</p>
              <p><strong className="text-foreground">Contato:</strong> bruvini.silva12@gmail.com</p>
              <p className="text-muted-foreground italic">Versão: RegulaFacil v2.5-NIR · © {new Date().getFullYear()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InformacoesPage;
