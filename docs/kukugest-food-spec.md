# KukuGest Food - Especificacao de Implementacao

Fonte de verdade funcional para a evolucao do KukuGest Food existente. O produto continua integrado no CRM KukuGest, mas com dominio operacional, permissoes, dados e navegacao Food isolados.

## Principios

- Nao recriar o projecto nem substituir fluxos funcionais sem necessidade.
- Preservar a stack, os padroes e alteracoes nao relacionadas do monorepo.
- Construir uma fase e uma fatia funcional completa de cada vez, sempre com dados reais.
- Nao usar mocks ou `localStorage` como persistencia de negocio.
- Usar organizacao como tenant canonico e unidade em todas as entidades operacionais aplicaveis.
- Validar autorizacao no servidor e na interface.
- Manter autenticacao activa fora do modo local de desenvolvimento.
- Usar uma maquina de estados partilhada entre os ambientes.
- Tornar comandos criticos idempotentes e resistentes a repeticao/concorrrencia.
- Auditar actor, funcao, unidade, data/hora, origem, dispositivo e motivo.
- Nao apagar operacoes financeiras ou concluidas; correccoes geram ajustes.
- Normalizar telefones e manter segredos/Ziett apenas no servidor.
- Usar tempo real para pedidos, alertas, Delivery e Caixa, com recuperacao por polling.

## Ambientes por funcao

### Gestor

- Visao geral e operacao actual.
- Historico e relatorios.
- Menu, stock, compras, fornecedores e financeiro.
- Equipa, turnos, produtividade e configuracoes.

### Caixa

- Novo pedido e pedidos.
- Abertura/fecho de Caixa.
- Pagamentos e valores com entregadores.

### Cozinha

- Novos, em preparacao e prontos.
- Interface KDS sem telefone, morada, precos ou pagamentos.

### Gestor de Delivery

- Despacho, entregadores, ocorrencias e historico.

### Entregador

- Entrega actual, historico e perfil.

### CRM e Marketing

- Visao geral, contactos, segmentos, campanhas, cupoes, mensagens e automacoes.

A interface deve ter pouca escrita, botoes grandes, estados visiveis, uma accao principal por ecra e identidade configuravel por restaurante.

## CRM, contactos e marketing

- Consolidar os contactos Food em CRM e Marketing, reutilizando `Contact` como identidade comum ao Caixa e CRM.
- Criar, pesquisar, editar e arquivar por nome, telefone, email ou morada.
- Suportar etiquetas, notas, campos personalizados, deteccao e uniao de duplicados.
- Filtrar por novo, recorrente, VIP, inactivo, em risco, zona, compras e valor gasto.
- Perfil Food: nome, telefone/WhatsApp normalizado, email, nascimento, moradas, localizacao, preferencias, restricoes, alergias, notas, etiquetas, consentimentos, canal preferido, metricas, produtos preferidos, cupoes, campanhas e ocorrencias.
- Importacao CSV em dez passos: upload, pre-visualizacao, mapeamento, validacao, normalizacao, duplicados, estrategia de conflito, resumo, erros e auditoria.
- Automacao de aniversario configuravel por periodo, horario, canal, template, beneficio, validade, valor minimo e segmentos.
- Marketing exige consentimento e deve registar envio, utilizacao, recompra e receita atribuida.

## Stock, compras e fornecedores

- Cada ingrediente/item tem stock actual, unidade interna, stock minimo, nivel ideal, quantidade pendente, unidade de compra, conversao e fornecedor preferencial.
- Reposicao recomendada: `max(0, nivel_ideal - stock_disponivel - quantidade_pendente)`.
- Stock no minimo cria alerta deduplicado; stock zero e critico; alerta encerra apos reposicao.
- Alertas mostram quantidade recomendada, fornecedor, ultimo preco e compras pendentes.
- Notificacao interna e obrigatoria; Ziett/WhatsApp/SMS apenas quando configurado.
- Fornecedor: contactos, morada, produtos/categorias, unidades, minimo, precos, prazo, pagamento, avaliacao, estado, metricas, historico, divergencias e pendencias.
- Comparar fornecedores por preco/unidade, minimo, prazo, qualidade e pagamento.
- WhatsApp do fornecedor gera mensagem editavel e abre a conversa; nunca envia automaticamente.
- Registar separadamente `WhatsApp aberto` e confirmacao manual `Pedido enviado`.
- Agrupar produtos por fornecedor e converter necessidade interna em embalagens de compra.
- Pedido de compra: `RASCUNHO -> AGUARDA_CONFIRMACAO -> CONFIRMADO -> EM_ENTREGA -> PARCIAL -> RECEBIDO -> CANCELADO`.
- Guardar sugestao, confirmacao, precos, datas, actor, mensagem, comprovativo e divergencias.
- Actualizar stock somente na recepcao confirmada.

## Equipa, turnos e Caixa

- Colaboradores, presencas, turnos, sessoes de Caixa, produtividade e historico.
- Cada colaborador tem funcoes acumulaveis, unidade, horario, permissoes e codigo pessoal de 4 a 6 digitos.
- Guardar codigo apenas como hash, bloquear tentativas falhadas e nunca voltar a exibi-lo.
- O codigo abre/fecha turno e Caixa, confirma accoes sensiveis e gera auditoria.
- Abertura do Caixa regista colaborador, unidade, hora, dispositivo e valor inicial.
- Fecho regista totais por metodo, valor contado, diferenca, motivo, valores com entregadores e aprovacao quando aplicavel.
- Gestor ve pessoas em trabalho, horas, Caixas, pedidos, produtividade e diferencas.

## Cozinha

- KDS em tempo real nas colunas Novos, Em preparacao e Prontos.
- Sons distintos para novo, alteracao, proximo do limite, atrasado, critico e pronto nao recolhido.
- Configurar volume, som, teste, repeticao e limites.
- Novo pedido alerta ate reconhecimento; atraso continua visivel mesmo reconhecido.
- Se audio estiver bloqueado, mostrar aviso persistente e manter alerta visual.
- Apos um minuto sem aceitar, estado amarelo; apos dois minutos, alertar o Caixa.

## Delivery e entregadores

- Entregador: nome, contactos, morada, transporte, matricula, unidade, turno, disponibilidade, estado, ultima localizacao, metricas, valores em posse, historico e ocorrencias.
- Estados: `DISPONIVEL`, `INDISPONIVEL`, `ATRIBUIDO`, `A_RECOLHER`, `NO_RESTAURANTE`, `EM_ENTREGA`, `SEM_GPS`, `PROBLEMA`, `FORA_DO_TURNO`.
- Durante entrega activa, mostrar ligar e WhatsApp com mensagem preenchida; ocultar dados depois da conclusao/devolucao e auditar apenas o clique.
- Pedido totalmente pago mostra PIN somente na chegada; pagamento no local nao mostra PIN.
- Entregador nao altera valor; confirma valor e metodo efectivamente recebidos.
- Dinheiro recebido fica em posse do entregador ate reconciliacao.
- Reconciliacao: `POR_COBRAR -> COM_ENTREGADOR -> ENTREGUE_AO_CAIXA -> RECONCILIADO`.
- Excepcoes: `NAO_RECEBIDO`, `DIVERGENCIA`, `DEVOLVIDO`.
- Estado financeiro e estado do pedido permanecem independentes.

## Historico, relatorios e fecho

- Separar estado actual de analise historica.
- Periodos: hoje/ontem, semana, mes, ano, intervalo e comparacao anterior/entre unidades.
- Filtros por unidade, turno, colaborador, pedido, canal, categoria, produto, pagamento, fornecedor, entregador, campanha e cupao.
- Resumo: receita, pedidos, ticket, cancelamentos, reembolsos, descontos, recebimentos, pendencias, valores com entregadores, compras, custo, margem, desperdicio, diferencas de Caixa e clientes.
- Todo KPI abre os registos de origem e compara o periodo anterior.
- Relatorios de vendas/produtos, stock, compras, Caixa, cozinha, Delivery, equipa e CRM.
- Exportar PDF/CSV e imprimir.
- Antes do fecho validar Caixas, pagamentos, entregadores, compras, inventario e diferencas.
- Fecho guarda snapshot mensal; reabertura somente por administrador e correccoes por ajustes.

## Entidades de referencia

Adaptar as entidades existentes antes de criar novas: `Contact`, `Address`, `Consent`, `Segment`, `Campaign`, `Coupon`, `Supplier`, `SupplierProduct`, `StockPolicy`, `StockMovement`, `PurchaseOrder`, `PurchaseItem`, `Employee`, `Shift`, `CashSession`, `Driver`, `Delivery`, `PaymentReconciliation`, `Notification`, `Occurrence`, `AuditEvent` e `MonthlyClose`.

## Ordem de implementacao

0. Auditoria do codigo, arquitectura, dados, autenticacao e divida tecnica.
1. Fundacao: tenant/unidade, permissoes, eventos, auditoria e componentes comuns.
2. CRM: contactos, perfil, CSV e aniversario.
3. Stock: fornecedores, reposicao, WhatsApp e compras.
4. Equipa: turnos, codigos e sessoes de Caixa.
5. Cozinha: timers, sons e alertas.
6. Delivery: entregadores, PIN, pagamentos e reconciliacao.
7. Gestao: historico, relatorios e fecho mensal.
8. Testes integrados, seguranca, desempenho e piloto Materia Preta.

## Definition of Done

Cada funcionalidade exige:

- Fluxo principal e pelo menos duas excepcoes.
- Permissao no frontend e servidor.
- Persistencia e auditoria.
- Loading, vazio, erro, retry e confirmacao.
- Responsividade adequada a funcao.
- Testes do dominio e do fluxo critico.
- Build, lint/typecheck e testes relevantes sem erros.
- Sem regressao nos modulos existentes.
- Texto em portugues revisto.
- Aceitacao com utilizador real do Materia Preta antes do piloto.

## Regra de continuidade

Depois de cada fase, actualizar `docs/implementation-status.md` com concluido, pendente, ficheiros, migracoes, testes e bloqueadores. As proximas sessoes devem iniciar pela leitura destes dois documentos.
