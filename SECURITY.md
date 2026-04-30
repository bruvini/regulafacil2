# Políticas de Segurança e Privacidade em Saúde

Este módulo manipula dados clínicos sensíveis (PHI - Protected Health Information).

## Regras
1. **Anonimização em Logs**: NUNCA logar nomes completos ou prontuários nos logs de servidor ou de front-end em produção, exceto no serviço de auditoria encriptado (AuditService).
2. **Armazenamento**: Nenhuma informação clínica deve ser persistida localmente (LocalStorage/SessionStorage) sem encriptação estrita.
3. **Auditoria Obrigatória**: Todas as ações de sugestão aceitas (bind Leito <-> Paciente) devem registrar timestamp, ID do leito, ID do paciente e ID do usuário que aprovou a transação.
4. **Isolamentos e Doenças Infecciosas**: O transporte do campo "isolamento" (ou `Flag` do FHIR) deve ser exposto de modo explícito aos usuários autorizados apenas, evitando vazamento visual indevido fora do modal de regulação.
