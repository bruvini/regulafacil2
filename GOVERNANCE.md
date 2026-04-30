# Governança de Regulação Clínica

## Princípios
1. **Auditoria e Transparência**: Todo cálculo de score e sugestão de leito deve ser rastreável. A decisão final pertence ao Regulador Humano (Enfermeiro/Médico), e a máquina apenas sugere.
2. **Padrão FHIR**: Dados de interoperabilidade devem convergir para o modelo HL7 FHIR (Patient, Encounter, Location, Flag/Condition).
3. **Escalabilidade**: Regras clínicas (PCP, Coorte, Isolamento, Tempo) são isoladas em Domain Services para permitir cobertura de testes automatizados sem acoplamento à UI.

## Fluxo de Mudança de Regra Clínica
- A mudança do Score ou dos Pesos deve ser feita via edição do arquivo `src/config/scoreRegulacao.json`.
- A criação de uma nova especialidade num setor deve ser feita via edição de configurações centrais na classe `CompatibilidadeLeitoService`.
- Todo PR envolvendo `src/domain/regulacao` precisa de revisão obrigatória por um Lead Técnico ou Clinical Informaticist.
