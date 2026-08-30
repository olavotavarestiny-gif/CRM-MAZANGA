# KukuGest Food - Mapa do Workspace

Versao do guia: `1.0.0-local`
Fonte canonica: `frontend/src/content/food-guide.json`

## Ambientes e responsabilidades

| Ambiente | Funcao principal | Responsabilidade |
|---|---|---|
| Gestao | Gestor | Configuracao, equipa, menu, stock, compras, desempenho e fecho. |
| Caixa | Caixa | Turno, Caixa, atendimento, pedido, pagamento e alteracoes. |
| KukuGest Cozinha | Cozinha | Reconhecimento, preparacao, itens, problemas e conclusao. |
| Delivery | Gestor de Delivery | Despacho, atribuicao, incidentes, devolucao e reconciliacao. |
| Entregador | Entregador | Recolha, deslocacao, contacto, prova e entrega de valores. |
| CRM & Marketing | CRM & Marketing | Cliente Food, consentimento, segmentos, retencao e actividade. |

## Paginas actuais

| Rota | Finalidade |
|---|---|
| `/food` | Selector de ambientes autorizados. |
| `/food/configuracoes` | Identidade, operacao, pedidos, locais e equipa. |
| `/food/produtos` | Categorias, produtos, imagens, disponibilidade e extras. |
| `/food/gestao` | Visao operacional do Gestor. |
| `/food/gestao/stock` | Ingredientes, alertas e movimentos. |
| `/food/gestao/fichas` | Fichas tecnicas por produto. |
| `/food/gestao/compras` | Fornecedores, reposicao e compras. |
| `/food/gestao/equipa` | Turnos, horarios, produtividade e diferencas de Caixa. |
| `/food/gestao/relatorios` | Relatorio, pre-validacao, fecho e exportacao. |
| `/food/caixa` | Turno, sessao de Caixa, pedidos e pagamentos. |
| `/food/novo-pedido` | Montagem do pedido, cliente, produtos e extras. |
| `/food/pedidos` | Pesquisa, estados e historico dos pedidos. |
| `/food/cozinha` | KDS em tres colunas e estados por item. |
| `/food/delivery` | Despacho, incidentes e cobrancas. |
| `/food/entregador` | Tarefas moveis e prova de entrega. |
| `/food/crm` | Clientes, segmentos, importacao e marketing. |
| `/food/ajuda` | Guia pesquisavel e mapa operacional. |

## Fluxo principal

1. Configurar restaurante.
2. Criar local e equipa.
3. Montar menu, ingredientes e fichas.
4. Abrir o Caixa; o turno do operador inicia automaticamente.
5. Criar pedido e enviar para Cozinha.
6. Preparar e marcar como pronto.
7. Levantar, consumir no local ou atribuir Delivery.
8. Confirmar pagamento/prova e reconciliar valores.
9. Corrigir pendencias, analisar e fechar o periodo.

## Regras de separacao

- Food partilha autenticacao, organizacao e identidade do cliente com o CRM.
- Catalogo, stock, pedidos, cozinha, Delivery e Caixa usam regras e tabelas Food.
- Sede fiscal nao e requisito para operacao; emissao fiscal e uma accao separada.
- Online, cada pessoa ve somente funcoes e unidades autorizadas.
- Localmente, o Gestor pode pre-visualizar todas as funcoes com personas sinteticas.
- Nenhum guia de teste deve usar clientes, fotografias, credenciais ou documentos fiscais reais.
