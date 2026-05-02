# Governança do Projeto

## CI/CD
Rollback Executado: Retorno à versão 268db88360896763dc729d962757702a824c0788 devido a conflitos de tipagem estrita na camada FHIR/SNOMED CT. Regra estabelecida: Futuras migrações de interoperabilidade devem ser desenvolvidas e homologadas em branches isoladas antes de atingirem o fluxo de Regulação.

## Padrões de Desenvolvimento
- Padrão de Commits: Todos os commits devem seguir o formato Conventional Commits e ser escritos EXCLUSIVAMENTE em Português do Brasil. Obrigatório o uso de numeração sequencial nos commits a partir deste ponto. Formato: "[Número Sequencial] - [tipo]: [mensagem em PT-BR]". Exemplo: "1 - fix: corrige scroll".
- Padrão Clínico: Lógicas de isolamento e bloqueio de leitos devem prever a futura adoção de Terminologia SNOMED CT e estrutura HL7/FHIR.
