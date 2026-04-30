# Regulafacil 2 - Motor de Regulação Clínica

## Sobre
O Motor de Regulação Inteligente calcula scores de urgência e mapeia pacientes eletivos e de urgência para leitos de enfermaria e UTI disponíveis.

## Arquitetura Limpa
- **Domain**: Contém a lógica clínica agnóstica de framework (React/Vue). Classes como `ScoreRegulacaoService` e `CompatibilidadeLeitoService`.
- **Adapters**: O `fhirMapper.ts` encapsula a transformação dos dados do backend legado para a semântica moderna (HL7/FHIR).
- **Config**: Pesos e critérios do motor de score em formato parametrizável `scoreRegulacao.json`.

## Governança
Veja [GOVERNANCE.md](GOVERNANCE.md) para princípios de auditoria e escalabilidade.
Veja [SECURITY.md](SECURITY.md) para regras de manipulação de dados PHI.

## Testes e CI/CD
Com a abstração, todos os serviços agora contam com testes baseados em Vitest (`npm test`). O pipeline do Agent Manager engloba build, lint, teste e mock-deploy automático.
