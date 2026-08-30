# KukuGest Food - Estado de Implementacao

Actualizado em: 2026-08-24

## Fase actual

**Fase 8 - Testes integrados, seguranca, desempenho e piloto iniciada localmente.**

Estado: Fases 0 a 7 concluidas localmente. A Fase 8 possui agora o primeiro fluxo operacional integrado e deterministico. A cadeia de migracoes continua reproduzivel, com base exclusiva de testes e todos os testes PostgreSQL activos.

Fatia concluida: ensaios deterministicos, matriz HTTP/SSE, perfil SQL reproduzivel, preflight documental do piloto Materia Preta, Central de Ajuda Food, manual PDF e primeiras visitas guiadas.

## Concluido e reutilizavel

### Fundacao organizacional

- Workspace `food` no backend e frontend.
- `OrganizationModule` para modulos simultaneos por organizacao.
- `effectiveUserId` como tenant canonico compativel com o CRM.
- `/api/auth/me` com `availableWorkspaces` e contexto Food.
- Activacao dupla por modulo e `FoodSettings.isEnabled`.
- Funcoes acumulaveis: gestor, Caixa, cozinha, gestor de Delivery, entregador e CRM/Marketing.
- Escopo global ou por unidade e validacao no backend.
- Correcao local para reconhecer colaboradores internos e convidados na equipa Food.

### Catalogo e configuracao

- Marca, logotipo responsivo, configuracoes, unidades e vinculo fiscal opcional.
- Categorias, produtos, imagens, disponibilidade, extras e associacoes produto-extra.
- Catalogo Food separado do catalogo fiscal/comercial.

### Pedidos, Caixa e cozinha

- Criacao de pedidos com totais calculados no backend e snapshots dos itens/extras.
- Idempotencia na criacao e comandos versionados.
- Projeccoes independentes de pedido, cozinha, Delivery e pagamento.
- Eventos imutaveis, historico de estado, tickets e estados por item.
- Sessao de Caixa local, pagamentos separados da emissao fiscal e vinculo fiscal nao obrigatorio para operar.
- KDS com Novos, Em preparacao e Prontos.
- Alertas derivados por ticket para novo, alteracao, proximo do limite, atrasado, critico e pronto nao recolhido.
- Reconhecimento separado da aceitacao, repeticao e volume configuraveis e aviso persistente quando o navegador bloqueia audio.
- Escalamento visual para o Caixa apos o limite configurado e encerramento interno do ticket quando o pedido e recolhido.
- SSE com cursor e polling de recuperacao.
- Fluxo local validado: criar pedido, enviar, aceitar, preparar e marcar pronto.
- Criacao v1 com lock sequencial, idempotencia concorrente, validacao de tenant/unidade, auditoria inicial, stock e ticket no mesmo agregado.
- A rota legada de criacao delega no mesmo servico durante a transicao, sem manter duas regras de negocio.

### Delivery

- Entrega separada do pedido, atribuicao, transicoes, PIN, prova privada, falha e devolucao basicas.
- Lista de entregadores por funcao/unidade.
- Interface de gestor e interface movel inicial do entregador.
- Entregador ficticio local `Manuel Entregador` disponivel para testes; nao migrar para outros ambientes.
- Perfil Delivery separado por organizacao e pessoa, sem acrescentar regras operacionais a `User` ou `Contact`.
- Estado operacional derivado do turno, disponibilidade e entrega activa; historico de alteracoes imutavel.
- Gestor ve disponibilidade e elegibilidade na atribuicao; perfis configurados exigem turno e estado disponivel.
- Compatibilidade transitoria mantem entregadores antigos sem perfil atribuiveis ate serem configurados.
- Telefone deixou de ser enviado na listagem do entregador; ligar e WhatsApp usam comando auditado sem copiar o numero para a auditoria.
- Nome, contacto, morada e referencia sao redigidos na API do entregador apos entrega ou devolucao.
- PIN so pode ser gerado na chegada para pedido totalmente pago; pagamento local nao aceita PIN e exige fotografia autorizada nesta etapa.
- Cobranca local usa agregado e eventos proprios nos estados `pending_collection`, `with_courier`, `handed_to_cashier`, `reconciled`, `not_received`, `discrepancy` e `returned`.
- O entregador confirma apenas o metodo; o montante e fixado pelo saldo do pedido no backend e nao pode ser alterado no dispositivo.
- O pagamento confirma o pedido sem entrar numa sessao de Caixa; Caixa, totais e valor esperado so mudam depois da reconciliacao.
- Entregador e gestor possuem accoes visiveis para valor nao recebido, entrega ao Caixa, diferenca contada e resolucao da divergencia.

### CRM, stock e gestao iniciais

- `Contact` reutilizado como identidade do cliente e perfil Food complementar.
- Moradas, preferencias, consentimentos e metricas Food basicas.
- Ingredientes, fichas tecnicas, fornecedores, compras, recepcao e movimentos de stock Food.
- Baixa atomica de stock no envio a cozinha e reposicao no cancelamento em fila.
- Segmentos, cupoes e campanhas Food basicos.
- Visao geral de gestao e paginas iniciais de compras/fichas.
- Adaptador fiscal explicito e idempotente, sem bloquear pedido pago.

### Ambiente local

- PostgreSQL 16 por Docker Compose na porta 5433.
- Supervisor local para frontend, backend e base de dados.
- Health checks locais e autenticacao de desenvolvimento restrita ao modo local.
- Base vazia criada integralmente por `prisma migrate deploy`, sem `db push`.
- Papel local `kukugest_app` sem privilegios especiais para validar RLS real.

## Parcial - adaptar, nao recriar

- Toda a API Food consumida pela aplicacao esta organizada em `/api/food/v1`; o router monolitico e o seu mount foram removidos.
- Pagamentos e Caixa cobrem turno, fecho, totais, diferenca, motivo, aprovacao e reconciliacao de valores recebidos por entregadores.
- KDS cumpre timers, reconhecimento, sons, limites e escalamento; estacoes avancadas permanecem fora da V1 conforme o plano.
- Delivery possui perfil operacional, disponibilidade, turno, contacto auditado, privacidade, cobranca fixa, posse do valor, entrega ao Caixa e reconciliacao financeira.
- Stock e compras possuem politica minimo/ideal, pendente derivado, alertas deduplicados, conversao de embalagem, fornecedor preferencial, comparacao, sugestao, ciclo completo, recepcao parcial, WhatsApp assistido e relatorio operacional essencial.
- CRM Food possui perfil avancado, criacao, edicao, arquivo logico, consentimentos, moradas, etiquetas, filtros, consolidacao, CSV, agenda de aniversarios, ocorrencias e timeline individual. Atribuicao de campanha e mostrada apenas quando comprovada pelo cupao resgatado; activacao futura dos canais permanece pendente.
- Marketing ainda nao executa automacoes reais nem atribuicao completa de receita.
- Gestao possui relatorio operacional, pre-validacao, fecho mensal, reabertura, revisoes e exportacao/impressao CSV/PDF; relatorios analiticos avancados permanecem para validacao no piloto.
- Auditoria comum cobre fundacao, catalogo, clientes, equipa e comandos operacionais principais; as novas fases devem instrumentar cada mutacao adicional no mesmo contrato.
- Varios ecras Food sao demasiado grandes (`produtos`, `novo-pedido`, `configuracoes`, `pedidos`) e devem ser divididos apenas quando cada fluxo for trabalhado.

## Pendentes por fase

### Fase 0 - concluida

- Baseline historica e fundacao B2B reconstruidas a partir do historico Git.
- Todas as 35 migracoes aplicadas com sucesso numa base `kukugest_test` vazia.
- Testes Food de tenant/unidade/idempotencia executados com PostgreSQL real.
- RLS Gestão/KPI validado com papel nao-superutilizador.
- Estrategia de retirada das rotas legadas definida: pedidos e comandos migram primeiro para `/api/food/v1`; catalogo/configuracoes permanecem temporariamente na API antiga.

### Fase 1 - Fundacao concluida

- Colunas legadas `userId` mantidas por compatibilidade e `organizationId` exposto em todas as respostas Food v1.
- Contrato append-only `FoodAuditEvent` com organizacao, unidade, actor, funcao, origem, dispositivo, motivo, IP, user-agent, payload e idempotencia.
- Auditoria instrumentada em configuracoes, unidades, catalogo, clientes, equipa, pedidos, Caixa, pagamentos, fiscal e Delivery base.
- Consulta protegida de auditoria por tenant e unidades autorizadas.
- Matriz negativa base das seis funcoes concluida; falta expandir a cobertura HTTP por rota sensivel nas proximas fatias.
- Criacao, listagem, detalhe e comandos do frontend migrados para `/api/food/v1`; handlers legados de listagem, detalhe e estado retirados.
- Configuracoes, unidades, categorias, produtos e extras migrados para `/api/food/v1`; handlers legados correspondentes retirados.
- Edicao e arquivo de produtos por colaboradores agora respeitam as unidades atribuidas, alem do tenant.
- Visao geral respeita as unidades autorizadas para unidades, produtos e pedidos.
- Pesquisa rapida de clientes usa `Contact`, devolve metricas Food e exclui cancelamentos dos totais.
- Listagem CRM continua separada da pesquisa operacional, com `FoodCustomerProfile` complementar.
- Componentes comuns para estados, confirmacoes, erros e seleccao de unidade concluidos e aplicados nos fluxos Food iniciais.

### Fases 2 a 8

- Seguir `docs/kukugest-food-spec.md`, uma fatia funcional e testada por vez.

### Fase 2 - CRM Food concluida

- `Contact` permanece como identidade comum; `FoodCustomerProfile` concentra preferencias, consentimentos, metricas e unidade preferida.
- Detalhe e edicao completa protegidos por tenant e permissao `customers.edit`.
- Telefone normalizado para E.164 e conflito com outro contacto da mesma organizacao devolve erro explicito.
- Moradas podem ser criadas, editadas e arquivadas logicamente; a primeira torna-se principal e outra e promovida quando necessario.
- Arquivar cliente preserva pedidos e historico e retira cliente/moradas dos fluxos activos.
- Interface CRM permite criar, abrir, editar e arquivar clientes e gerir moradas no mesmo dialogo operacional.
- Auditoria cobre cliente e moradas em todas as novas mutacoes.
- Filtros cobrem novos, recorrentes, VIP, inactivos, em risco, zona, etiqueta, consentimento, minimo de compras e valor gasto.
- Duplicados sao sugeridos apenas por telefone normalizado, email exacto ou nome com contexto coincidente.
- Consolidacao exige escolha explicita do contacto principal, transfere relacoes CRM/Food numa transaccao, recalcula metricas e arquiva a origem.
- Uniao preserva pedidos, notas, tarefas, mensagens, eventos, transaccoes, formularios, campanhas, facturacao, moradas e stakeholders sem duplicar a mesma relacao num negocio.
- Contactos arquivados deixam de contar nos totais e consentimentos do resumo de Marketing.
- CSV aceita nome, telefone, email, empresa, zona, nascimento, etiquetas, notas e consentimento com mapeamento manual ou automatico.
- Pre-visualizacao classifica linhas validas, invalidas, repetidas no ficheiro, existentes e existentes arquivadas sem gravar dados.
- Confirmacao repete a validacao no servidor e permite ignorar ou actualizar contactos existentes.
- Importacao respeita limite de linhas, limite de contactos do plano, tenant e permissao `customers.edit`.
- Resultado devolve criados, actualizados, ignorados, invalidos, erros por linha e identificador auditavel da importacao.
- Perfil guarda alergias, restricoes alimentares, canal preferido, tipo de pedido preferido e notas de preferencia no JSON isolado `preferences`.
- Produtos mais pedidos sao derivados dos itens historicos e nao duplicados como estado manual.
- Agenda calcula o proximo aniversario, idade, dias restantes e elegibilidade, incluindo mudanca de ano e regra para 29 de Fevereiro.
- Contactos inactivos e de outro tenant nao aparecem; elegibilidade exige consentimento de Marketing e destino compativel com o canal preferido.
- Configuracao organizacional guarda antecedencia, horario, canal, template, beneficio, cupao, validade, pedido minimo e segmento.
- Envio automatico permanece explicitamente desligado ate existir canal tenant-aware; a configuracao ja e persistida e auditada.
- Ocorrencias registam tipo, prioridade, unidade, descricao, autoria e data sem duplicar pedidos ou auditoria.
- Uma ocorrencia aberta so pode ser resolvida com nota de resolucao; o registo permanece preservado e auditado.
- Timeline individual agrega pedidos, resgates de cupao, campanha comprovadamente ligada ao cupao, ocorrencias e alteracoes auditadas.
- Filtros da timeline permitem isolar pedidos, cupoes, ocorrencias e alteracoes, sempre dentro da organizacao.
- Isolamento negativo por organizacao e unidade, resolucao concorrente e validacao da nota estao cobertos em PostgreSQL real.

### Fase 3 - Stock Food concluida

- Ingredientes guardam stock minimo, nivel ideal, unidade de compra, quantidade interna por embalagem e fornecedor preferencial.
- Quantidade pendente e derivada das compras abertas, sem contador duplicado que possa ficar dessincronizado.
- Reposicao usa `max(0, nivel ideal - stock actual - quantidade pendente)` e converte a necessidade em embalagens inteiras.
- Stock minimo zero desactiva o alerta; stock abaixo do minimo abre alerta e stock zero eleva a criticidade.
- Existe apenas um alerta por ingrediente; novas avaliacoes actualizam, resolvem ou reabrem o mesmo registo.
- Fornecedor preferencial e validado por organizacao e unidade.
- Gestao Food mostra stock actual/minimo/ideal, pendente, recomendacao, embalagens, ultimo custo e fornecedor.
- Politica pode ser editada sem alterar directamente o stock; ajustes continuam registados como movimentos.
- Criacao de ingrediente, politica, ajuste, ficha tecnica, fornecedor, compra e recepcao passam pela auditoria Food.
- Cada fornecedor pode guardar uma condicao por ingrediente com embalagem, conteudo, preco, minimo, prazo, qualidade e pagamento.
- Comparacao usa custo normalizado por unidade interna, permitindo comparar embalagens diferentes sem distorcer o preco.
- Guardar novamente a mesma relacao actualiza a condicao existente em vez de criar duplicados.
- Sugestoes escolhem o fornecedor preferencial quando possui condicao activa; caso contrario usam o menor custo normalizado.
- Quantidade sugerida respeita embalagens inteiras e o minimo comercial do fornecedor.
- Sugestoes sao agrupadas por fornecedor e preenchem o formulario de compra existente para revisao do operador, sem confirmar automaticamente.
- Compras seguem `draft -> awaiting_confirmation -> confirmed -> in_delivery -> partial/received`, com cancelamento controlado antes da primeira recepcao.
- Cada comando exige versao actual e `Idempotency-Key`; repeticoes devolvem o mesmo resultado sem repetir efeitos.
- `FoodPurchaseEvent` preserva criacao, comandos e recepcoes com actor, versao, estado anterior/seguinte e payload estruturado.
- Recepcao parcial e registada por item e actualiza apenas a quantidade confirmada, o custo medio e o movimento correspondente.
- Quantidade pendente apos recepcao parcial usa `encomendado - recebido` por item.
- Uma compra parcialmente recebida permanece aberta ate todos os itens atingirem a quantidade encomendada.
- A interface mostra versao, progresso recebido/encomendado e apenas as accoes permitidas no estado actual.
- Cada sugestao com telefone valido prepara uma mensagem WhatsApp editavel; o sistema nunca envia automaticamente e apenas abre a conversa por comando explicito do operador.
- A preparacao da mensagem valida organizacao, unidade e telefone e fica registada na auditoria Food.
- O historico versionado da compra pode ser consultado por perfis com leitura, sem expor comandos de alteracao.
- O historico de stock permite filtrar periodo, unidade, ingrediente e tipo de movimento.
- O relatorio essencial apresenta valor de inventario, alertas, entradas, saidas e compras abertas/recebidas, sempre limitado ao tenant e as unidades autorizadas.

### Fase 4 - Equipa, turnos e Caixa concluida

- Cada colaborador pode ter um codigo pessoal de 4 a 6 digitos, guardado apenas como hash bcrypt e nunca devolvido pela API.
- O gestor pode definir ou substituir o codigo a partir da Equipa Food; o proprio operador pode configura-lo no primeiro acesso ao Caixa.
- Cinco tentativas incorrectas bloqueiam a credencial durante 15 minutos; a contagem e o bloqueio persistem mesmo quando a validacao falha.
- O operador inicia e termina o proprio turno com codigo, unidade e identificador local do dispositivo.
- Existe apenas um turno aberto por pessoa na organizacao; um turno noutra unidade bloqueia nova abertura.
- O turno nao pode terminar enquanto possuir sessao de Caixa aberta.
- Novas sessoes de Caixa exigem turno aberto na mesma unidade e confirmacao do codigo pessoal.
- A sessao guarda turno, dispositivo de abertura/fecho, totais por metodo, valor esperado, contado e diferenca.
- Fechos com diferenca exigem motivo; aprovacao do gestor sera acrescentada na proxima fatia.
- Codigo, turno e Caixa respeitam tenant, pessoa, funcao e unidades autorizadas e geram auditoria sem guardar o codigo.
- Horarios planeados guardam colaborador, unidade, data, entrada, saida e nota e podem ser actualizados sem duplicar pessoa/data.
- O painel do gestor mostra pessoas em trabalho, Caixas abertos, horas, pedidos, valor dos pedidos, vendas por Caixa e diferencas.
- Produtividade e derivada de turnos, pedidos e sessoes reais, sem contadores manuais ou metas automaticas.
- O historico de Caixas apresenta esperado, contado, diferenca, motivo e estado da analise.
- Diferencas sao migradas e criadas como pendentes; o gestor pode aprovar ou rejeitar uma unica vez, com nota obrigatoria na rejeicao.
- Horarios, painel e aprovacoes respeitam tenant e unidades autorizadas e geram auditoria.
- Valores recebidos por entregadores permanecem separados do Caixa ate entrega e reconciliacao confirmadas.

### Fase 7 - Gestao e relatorios concluida

- Relatorio protegido por `reports.view`, tenant e unidades autorizadas em `/api/food/v1/management/reports/operational`.
- Periodo personalizado ate 366 dias e comparacao automatica com periodo anterior de igual duracao.
- Pedidos activos, cancelamentos, valor, descontos, ticket medio, recebido, pendente e entregas sao derivados dos registos de origem.
- Pagamento recebido pelo entregador usa `paidAt`; entrada no Caixa usa `reconciledAt`, permitindo que os dois eventos aparecam em dias diferentes.
- Valores recebidos, reconciliados e em custodia de entregadores permanecem separados em toda a resposta.
- Resumos por metodo e unidade, historico diario, inventario, movimentos, compras, diferencas de Caixa e cobrancas Delivery pendentes.
- A pagina `/food/gestao/relatorios` oferece filtros, estados vazios, erros, retry e tabelas de origem responsivas.
- Isolamento negativo por organizacao e unidade e custodia financeira estao cobertos em PostgreSQL real.
- Pre-validacao mensal protegida por `reports.view` informa `ready` apenas quando todos os bloqueios forem resolvidos.
- Bloqueiam o fecho: Caixas abertos, cobrancas Delivery pendentes, compras abertas, diferencas sem decisao, pagamentos incoerentes, stock negativo e turnos abertos.
- Stock abaixo do minimo e falha fiscal sao avisos; a sede fiscal e a emissao de documento continuam opcionais para operar e fechar.
- Cada verificacao devolve quantidade, valor, amostras dos registos e ligacao para corrigir a origem.

### Fase 8 - Testes integrados e piloto em curso

- O roteiro `docs/food-pilot-materia-preta-acceptance.md` define funcoes, dispositivos, dados sinteticos permitidos, 11 cenarios, evidencias, criterios de paragem, decisao Go/No-Go e limpeza posterior.
- O mapa canonico `docs/food-workspace-map.md` organiza os seis ambientes Food, as rotas actuais, as responsabilidades por funcao e o fluxo operacional completo.
- A Central de Ajuda em `/food/ajuda` reutiliza uma fonte estruturada unica, com pesquisa, filtros por funcao, 27 topicos, 133 passos, resultados esperados, alertas e ligacoes directas para cada area.
- O conteudo do guia fica separado da interface em `frontend/src/content/food-guide.json`, preparando a geracao posterior do manual PDF e dos roteiros de video sem duplicar instrucoes.
- `npm run guide:food:pdf` gera um manual A4 versionado directamente da fonte canonica; a versao actual possui 30 paginas, marcadores, cabecalhos, rodapes e todos os 27 topicos.
- A Central de Ajuda disponibiliza o manual em `/food/ajuda/manual`, com `application/pdf`, nome estavel e sem depender de servico externo.
- Um botao contextual de ajuda acompanha cada pagina Food e resolve o topico exacto a partir da rota e da aba activa; o modal apresenta resultado, passos, dicas, alertas e ligacao ao guia completo.
- Configuracoes, Menu, Pedidos e CRM preservam a aba na URL, permitindo recarregar, partilhar e abrir directamente a orientacao correcta.
- O painel de Gestao separa indicadores do dia, prioridades accionaveis, areas de trabalho e stock, evitando misturar navegacao e criacao de ingredientes no cabecalho.
- As paginas Ambientes e Ajuda possuem visitas guiadas voluntarias com `driver.js`, navegacao por teclado, progresso visivel e conclusao guardada localmente por utilizador e versao.
- Fechar uma visita antes do ultimo passo nao a marca como concluida; uma visita concluida pode ser repetida a qualquer momento.
- O comando read-only `npm run pilot:food:preflight` recusa bases remotas e exige organizacao e unidade explicitas antes de aprovar uma sessao humana.
- A sede fiscal continua opcional no piloto operacional; ausencia de armazenamento privado limita a prova de entrega a PIN e nao bloqueia Caixa, Cozinha ou Delivery.
- Um unico cenario PostgreSQL percorre o fluxo completo com operadores `cashier`, `kitchen`, `delivery_manager`, `courier` e `manager` resolvidos pelas atribuicoes reais da organizacao.
- O pedido nasce numa sessao de Caixa aberta, consome a ficha tecnica uma unica vez, passa por reconhecimento e estados da Cozinha, cria entrega e cobranca local e termina concluido.
- Repeticoes da criacao, envio a Cozinha, reconhecimento, atribuicao, confirmacao da cobranca e reconciliacao nao duplicam pedidos, tickets, movimentos, cobrancas, pagamentos ou totais de Caixa.
- A prova de entrega usa media privada da organizacao; a cobranca permanece fora do Caixa ate entrega ao operador e reconciliacao explicita.
- O ensaio valida a sequencia continua dos eventos, actor por funcao, isolamento negativo da segunda unidade e tenant sem dados.
- O relatorio final reconcilia 6.500 AOA em pedido, pagamento e Caixa, sem valor pendente ou em custodia do entregador.
- Dez pedidos consecutivos percorrem Caixa -> Cozinha -> concluido sem colisao de numeracao, duplicacao de ticket ou baixa repetida de stock.
- Cinco fluxos Delivery terminam com quatro entregas comprovadas e uma devolucao; um deles valida falha operacional, troca de entregador e conclusao posterior.
- Os 15 pedidos produzem exactamente 15 movimentos de consumo e preservam versoes continuas e chaves idempotentes unicas por organizacao.
- Os cinco pagamentos incrementam a sessao de Caixa uma unica vez cada e o relatorio final reconcilia 5.500 AOA, quatro sucessos e uma devolucao.
- O ensaio repetido concluiu localmente em cerca de 1,9 segundos, usado apenas como referencia inicial e nao como limite fragil de CI.
- A cadeia HTTP real cobre autenticacao, subscricao, modulo Food e as seis funcoes sem depender do servidor de desenvolvimento ou de bibliotecas adicionais.
- Pedidos e comandos repetidos pela API preservam os codigos HTTP esperados e nao duplicam pedido, ticket, evento ou auditoria.
- Eventos JSON retomam pelo cursor persistido, excluem a segunda unidade e o stream SSE responde com `text/event-stream`, cursor `Last-Event-ID` e politica de retry.
- O teste fecha sockets SSE e HTTP de forma deterministica tambem quando executado em paralelo com toda a suite.
- A desactivacao de `FoodSettings.isEnabled` bloqueia rotas operacionais, mantendo apenas o contexto necessario para orientar a reactivacao.
- O profiler protegido recusa qualquer base diferente de `kukugest_test`, cria 5.000 pedidos, 15.000 eventos, 1.500 tickets e 1.000 entregas e remove toda a fixture no fim.
- O plano inicial de pedidos por unidade lia 3.000 linhas, descartava 1.000 e ordenava para devolver 100; o indice tenant/unidade/data passou a ler apenas 134 sem sort.
- O plano SSE inicial lia 12.000 eventos, descartava 9.000 e ordenava para devolver 200; cursor por tuplo e indice tenant/unidade/cursor passaram a `Index Only Scan` de 200 linhas, sem sort.
- Na medicao final, pedidos raw ficaram em p95 0,67 ms, recuperacao SSE em p95 0,68 ms, lista agregada em p95 20,61 ms e relatorio operacional em p95 41,17 ms.
- KDS e Delivery permaneceram sem nova indexacao: os planos existentes nao fazem scan sequencial e ficaram em p95 1,04 ms e 0,90 ms; nao havia gargalo comprovado.
- Colaboradores recebem eventos somente das unidades atribuidas; o gestor global continua a receber eventos de todas as unidades da organizacao.
- O painel de relatorios permite escolher o mes e mostra estado `OK`, `Aviso` ou `Bloqueia` sem executar o fecho automaticamente.
- `FoodMonthlyClose` preserva relatorio e validacao como JSON imutavel, com organizacao, unidade/ambito, actor, data e versao.
- O comando exige `reports.close`, `Idempotency-Key`, `ready=true` e uma unidade explicita quando o gestor possui acesso restrito.
- Existe apenas um snapshot por organizacao, mes e ambito; repeticao idempotente devolve o mesmo registo e outra chave recebe conflito.
- `FoodMonthlyCloseEvent` regista a criacao versionada e prepara reabertura futura sem sobrescrever o snapshot original.
- CRM/Marketing mantem `reports.view`, mas nao recebe `reports.close`; o fecho fica limitado ao gestor.
- A interface exige confirmacao, desactiva o comando com bloqueios e lista os snapshots preservados.
- Reabertura exige `reports.reopen`, motivo, versao actual e `Idempotency-Key`; apenas o gestor possui esta permissao.
- Reabrir muda o estado para `reopened`, incrementa a versao e guarda actor, data, motivo e evento `monthly_close.reopened`.
- `snapshot` e `validationSnapshot` permanecem inalterados; movimentos posteriores nunca reescrevem o fecho original.
- Repeticao idempotente devolve a mesma reabertura; segunda chave, versao antiga, outro tenant ou unidade externa sao rejeitados.
- A interface mostra Fechado/Reaberto, motivo preservado e exige confirmacao destrutiva com texto obrigatorio.
- Cada fecho pode ser exportado por `reports.view` em CSV UTF-8 com BOM e separador por ponto e virgula, adequado a folhas de calculo locais.
- O CSV e construido apenas a partir de `snapshot` e `validationSnapshot`; pedidos ou movimentos posteriores nao alteram o ficheiro historico.
- Metadados, resumo, metodos de pagamento, unidades, historico diario e validacao do fecho sao apresentados em seccoes independentes.
- Todas as celulas sao citadas e valores iniciados por formula sao neutralizados para impedir execucao ao abrir o ficheiro.
- O download respeita tenant e unidade, usa `no-store` e gera um evento de auditoria sem recalcular o relatorio operacional.
- Um mes reaberto pode ser fechado novamente apenas com `reports.close`, pre-validacao verde, motivo, versao actual e `Idempotency-Key`.
- `FoodMonthlyCloseRevision` guarda cada novo snapshot e validacao sem alterar o snapshot original nem revisoes anteriores.
- Cada revisao possui numero sequencial, versao do agregado, autor, motivo e data; o evento `monthly_close.reclosed` referencia a revisao criada.
- O agregado pode repetir o ciclo reabrir/re-fechar, alternando estado e versao sob lock transaccional e controlo optimista.
- Comandos concorrentes de re-fecho produzem apenas uma revisao; repeticao da mesma chave devolve o resultado original.
- A interface mostra a revisao actual, permite exportar o CSV actual e conserva um download separado do original.
- Original e revisoes podem ser exportados em PDF por `reports.view`, sempre a partir do JSON imutavel ja guardado.
- O PDF usa nome, cor e moeda da configuracao Food sem depender de sede fiscal, logotipo remoto ou servicos externos.
- O documento A4 inclui metadados, motivo da revisao, resumo executivo, controlo financeiro, metodos, unidades, validacoes e historico diario.
- Tabelas paginam automaticamente, repetem cabecalhos e mantem rodape numerado sem cortar linhas.
- Downloads PDF possuem nome seguro, `application/pdf`, `no-store`, isolamento por tenant/unidade e auditoria separada para original e revisao.
- Uma amostra com 31 dias foi renderizada e inspeccionada visualmente em tres paginas, sem sobreposicao, paginas vazias ou texto cortado.
- A accao de impressao abre o mesmo PDF num modal interno, sem pop-up, documento paralelo ou recalculo do relatorio.
- Original e todas as revisoes podem ser alternados por controlo segmentado antes de imprimir.
- O comando de impressao so e activado depois do PDF carregar e oferece retry explicito em caso de erro.
- Endpoints inline usam `Content-Disposition: inline`, `no-store`, `reports.view`, tenant/unidade e eventos de auditoria proprios.

## Ficheiros alterados nesta fase

- `docs/kukugest-food-spec.md` - fonte de verdade funcional.
- `docs/implementation-status.md` - estado tecnico e continuidade.
- `backend/src/routes/food-v1/team.js` - reconhecimento de colaboradores internos e convidados (alteracao anterior incorporada na auditoria).
- `backend/src/routes/food.js` - correccao do lock de numeracao de pedidos (alteracao anterior incorporada na auditoria).
- `backend/prisma/migrations/20250116000000_baseline_schema/migration.sql` - baseline historica para bases vazias.
- `backend/prisma/migrations/20260606000000_add_b2b_deals_foundation/migration.sql` - delta B2B ausente antes de `DealNote`.
- `infrastructure/postgres/init/02-test-app-role.sql` - papel local sem bypass de RLS.
- `package.json` - preparacao e execucao dos testes PostgreSQL com o papel de aplicacao.
- `backend/src/services/food-order.service.js` - criacao de pedido consolidada no agregado v1.
- `backend/src/routes/food-v1/orders.js` - POST v1 protegido por `orders.create`.
- `backend/src/routes/food.js` - rota de criacao legada delegada no servico v1.
- `backend/src/integration/food-v1-orders.test.js` - criacao idempotente e rejeicao de unidade de outro tenant.
- `frontend/src/lib/api.ts` - Caixa migrado para `POST /api/food/v1/orders`.
- `backend/src/services/food-order.service.js` - listagem v1 com filtros, escopo por unidade e serializacao compativel.
- `backend/src/routes/food-v1/orders.js` - listagem v1 delegada no servico de dominio.
- `backend/src/routes/food.js` - handlers legados de listagem, detalhe e alteracao de estado retirados.
- `backend/src/lib/food-access.test.js` - matriz negativa das funcoes operacionais Food.
- `frontend/src/lib/api.ts` - detalhe e filtros de pedidos apontados exclusivamente para a API v1.
- `backend/src/routes/food-v1/foundation.js` - configuracoes e unidades v1, incluindo sede fiscal opcional.
- `backend/src/routes/food-v1/catalog.js` - CRUD v1 de categorias, produtos, grupos e opcoes de extras.
- `backend/src/lib/food-catalog-access.js` - validacao partilhada de tenant, unidade, categoria e extras.
- `backend/src/lib/food-catalog-access.test.js` - testes negativos do escopo de catalogo.
- `backend/src/integration/food-foundation.test.js` - isolamento real e arquivo logico ampliados.
- `frontend/src/lib/api.ts` - configuracoes e catalogo apontados exclusivamente para a API v1.
- `backend/src/routes/food-v1/overview.js` - visao geral e metadados de estados v1.
- `backend/src/routes/food-v1/customers.js` - pesquisa rapida e perfil CRM no mesmo dominio de cliente.
- `backend/src/services/food-customer.service.js` - pesquisa tenant-aware e metricas operacionais.
- `backend/src/index.js` - mount monolitico `/api/food` retirado.
- `backend/src/routes/food.js` - removido depois da migracao integral dos consumidores.
- `backend/src/lib/food-audit.js` - contrato e persistencia comum de auditoria Food.
- `backend/src/lib/food-serialization.js` - exposicao compativel de `organizationId` na API v1.
- `backend/src/routes/food-v1/foundation.js` - consulta protegida de auditoria e eventos de fundacao.
- `backend/src/routes/food-v1/orders.js`, `payments.js`, `delivery.js`, `team.js`, `catalog.js` e `customers.js` - mutacoes sensiveis auditadas.
- `frontend/src/components/food/food-branch-select.tsx` - seleccao comum de unidade.
- `frontend/src/components/food/food-status-badge.tsx` - estado operacional comum.
- `frontend/src/components/food/food-confirm-dialog.tsx` - confirmacao comum para accoes sensiveis.
- `backend/src/services/food-customer.service.js` - regras transaccionais de detalhe, edicao, tenant, telefone, moradas e arquivo.
- `backend/src/routes/food-v1/customers.js` - endpoints v1 completos e auditoria do perfil Food.
- `backend/src/integration/food-customers.test.js` - isolamento, normalizacao, unidade externa, morada principal e preservacao de pedidos.
- `frontend/src/components/food/food-customer-dialog.tsx` - criacao, perfil, consentimentos e moradas.
- `frontend/src/app/food/crm/page.tsx` - abertura e criacao de clientes a partir da lista operacional.
- `frontend/src/lib/api.ts` e `frontend/src/lib/types.ts` - contratos tipados do CRM Food v1.
- `frontend/src/components/food/food-customer-duplicates-dialog.tsx` - comparacao e escolha assistida do contacto principal.
- `backend/src/routes/food-v1/marketing.js` - metricas excluem perfis associados a contactos inactivos.
- `frontend/src/components/food/food-customer-import-dialog.tsx` - upload, mapeamento, validacao, conflitos e resultado CSV.
- `backend/src/services/food-birthday.service.js` - datas e agenda tenant-aware.
- `backend/src/routes/food-v1/marketing.js` - agenda e configuracao de aniversario protegidas.
- `frontend/src/components/food/food-birthday-panel.tsx` - agenda, elegibilidade e configuracao preparada.
- `backend/src/services/food-customer-timeline.service.js` - timeline derivada e regras de criacao/resolucao de ocorrencias.
- `backend/src/routes/food-v1/customers.js` - endpoints protegidos de timeline e ocorrencias com auditoria.
- `frontend/src/components/food/food-customer-timeline.tsx` - filtros, actividade real, registo e resolucao no perfil.
- `backend/src/integration/food-customers.test.js` - timeline, campanha por cupao, tenant, unidade e resolucao documentada.
- `backend/src/services/food-stock-replenishment.service.js` - calculo, compras pendentes e ciclo deduplicado dos alertas.
- `backend/src/routes/food-v1/stock.js` - reposicao, politicas e auditoria das mutacoes de stock.
- `frontend/src/components/food/food-stock-replenishment.tsx` - fila de reposicao e edicao da politica.
- `backend/src/integration/food-stock.test.js` - tenant, unidade, fornecedor, deduplicacao, criticidade e resolucao.
- `backend/src/services/food-supplier-catalog.service.js` - condicoes, comparacao normalizada e agrupamento das sugestoes.
- `frontend/src/components/food/food-purchase-planning.tsx` - cadastro comparavel e preparacao assistida da compra.
- `backend/src/lib/food-supplier-catalog.test.js` - normalizacao do custo interno.
- `backend/src/services/food-purchase.service.js` - comandos versionados, idempotencia e recepcao transaccional por item.
- `frontend/src/components/food/food-purchase-lifecycle.tsx` - estados, accoes, recepcao parcial e cancelamento documentado.
- `backend/src/integration/food-purchase-lifecycle.test.js` - versao, tenant, idempotencia, saldo pendente e stock exacto.
- `backend/src/services/food-stock-report.service.js` - rascunho WhatsApp, historico e resumo operacional tenant-aware.
- `backend/src/lib/food-stock-report.test.js` - telefone e limites seguros dos filtros.
- `backend/src/integration/food-stock-report.test.js` - isolamento real de fornecedor, unidade, movimentos e indicadores.
- `frontend/src/components/food/food-purchase-planning.tsx` - mensagem editavel com abertura explicita do WhatsApp.
- `frontend/src/components/food/food-purchase-lifecycle.tsx` - historico disponivel tambem em modo de leitura.
- `frontend/src/app/food/gestao/stock/page.tsx` - filtros, indicadores e tabela de movimentos.
- `backend/prisma/migrations/20260823030000_add_food_staff_credentials_and_shifts/migration.sql` - credenciais, turnos e vinculo opcional das sessoes historicas.
- `backend/src/services/food-workforce.service.js` - hash, bloqueio, codigo, inicio/fim de turno e validacao do Caixa.
- `backend/src/routes/food-v1/team.js` - configuracao protegida, estado actual e historico base de turnos.
- `backend/src/routes/food-v1/payments.js` - abertura/fecho ligados ao turno, dispositivo e motivo de diferenca.
- `backend/src/integration/food-workforce.test.js` - hash, bloqueio persistente, tenant, unidade, turno unico e Caixa aberto.
- `frontend/src/app/food/configuracoes/page.tsx` - configuracao administrativa do codigo sem reexibicao.
- `frontend/src/app/food/caixa/page.tsx` - primeiro acesso, turno e comandos de Caixa confirmados por codigo.
- `backend/prisma/migrations/20260823031000_add_food_schedules_and_cash_approvals/migration.sql` - horarios e estado de aprovacao das diferencas.
- `backend/src/services/food-workforce-management.service.js` - agenda, produtividade derivada, painel e decisao concorrente.
- `backend/src/integration/food-workforce-management.test.js` - actualizacao, tenant, unidade, produtividade e aprovacao unica.
- `frontend/src/app/food/gestao/equipa/page.tsx` - supervisao, horarios, produtividade e historico de Caixas.
- `backend/src/services/food-operational-report.service.js` - calculos historicos e financeiros sem contadores paralelos.
- `backend/src/routes/food-v1/management.js` - endpoint protegido do relatorio operacional.
- `backend/src/integration/food-operational-report.test.js` - tenant, unidade e custodia do entregador em PostgreSQL.
- `frontend/src/app/food/gestao/relatorios/page.tsx` - filtros, comparacao, reconciliacao e registos de origem.
- `backend/src/services/food-month-close.service.js` - regras explicaveis de prontidao mensal.
- `backend/src/integration/food-month-close.test.js` - bloqueios, avisos, tenant e unidade em PostgreSQL.
- `backend/prisma/migrations/20260824012000_add_food_monthly_closes/migration.sql` - snapshots e eventos mensais.
- `backend/prisma/migrations/20260824013000_add_food_monthly_close_reopening/migration.sql` - autoria, data e motivo da reabertura.
- `backend/src/lib/food-month-close-csv.js` - serializacao segura do snapshot mensal em CSV.
- `backend/src/lib/food-month-close-csv.test.js` - BOM, estrutura, nome do ficheiro e neutralizacao de formulas.
- `backend/src/services/food-month-close.service.js` - leitura protegida de um fecho preservado por tenant e unidade.
- `backend/src/routes/food-v1/management.js` - download CSV protegido e auditado.
- `backend/src/integration/food-month-close.test.js` - imutabilidade do CSV e isolamento negativo em PostgreSQL.
- `frontend/src/lib/api.ts` - download tipado como `Blob` e nome derivado do cabecalho HTTP.
- `frontend/src/app/food/gestao/relatorios/page.tsx` - accao de exportacao em cada snapshot mensal.
- `backend/prisma/migrations/20260824014000_add_food_monthly_close_revisions/migration.sql` - snapshots append-only das revisoes.
- `backend/prisma/schema.prisma` - relacao entre o fecho mensal e as suas revisoes imutaveis.
- `backend/src/services/food-month-close.service.js` - re-fecho transaccional, concorrencia e leitura protegida de revisoes.
- `backend/src/routes/food-v1/management.js` - comando de re-fecho e exportacao CSV por revisao.
- `frontend/src/lib/types.ts` e `frontend/src/lib/api.ts` - contratos e comandos tipados de revisao.
- `backend/src/lib/food-month-close-pdf.js` - documento A4 deterministico, paginado e baseado no snapshot.
- `backend/src/lib/food-month-close-pdf.test.js` - assinatura, tamanho, moeda e nome de original/revisao.
- `backend/scripts/render-food-month-close-pdf-sample.js` - amostra longa para regressao visual local.
- `output/pdf/kukugest-food-fecho-exemplo.pdf` - amostra de QA renderizada e inspeccionada.
- `backend/src/integration/food-operational-flow.test.js` - aceitacao deterministica Caixa, Cozinha, Delivery, reconciliacao e relatorio por funcao.
- `backend/src/integration/food-pilot-repetition.test.js` - repeticao de 10 pedidos e 5 entregas com idempotencia, reatribuicao e devolucao.
- `backend/src/integration/food-http-access.test.js` - matriz HTTP das seis funcoes, unidade, modulo, comandos repetidos e recuperacao SSE.
- `backend/scripts/profile-food-operational.js` - carga temporaria, percentis e `EXPLAIN ANALYZE` seguro para operacao Food.
- `backend/prisma/migrations/20260824180000_optimize_food_operational_indexes/migration.sql` - indices comprovados para pedidos por unidade e cursor SSE.

O repositorio ja continha muitas alteracoes locais nao publicadas. Nao foram revertidas nem publicadas.

## Migracoes

Adicionadas na Fase 0 para reparar a cadeia historica:

- `20250116000000_baseline_schema`
- `20260606000000_add_b2b_deals_foundation`

Migracoes Food existentes:

- `20260815090000_add_kukugest_food_foundation`
- `20260815101000_add_food_identity_fields`
- `20260815113000_add_food_orders`
- `20260816120000_food_v1_isolated_architecture`
- `20260823010000_add_food_audit_events`
- `20260823011000_add_food_audit_idempotency`
- `20260823020000_add_food_birthday_settings`
- `20260823021000_add_food_birthday_org_fk`
- `20260823022000_add_food_customer_occurrences`
- `20260823023000_add_food_stock_policies`
- `20260823024000_add_food_supplier_products`
- `20260823025000_add_food_purchase_lifecycle`
- `20260823030000_add_food_staff_credentials_and_shifts`
- `20260823031000_add_food_schedules_and_cash_approvals`
- `20260823032000_add_food_kitchen_alerts`
- `20260823033000_close_collected_kitchen_tickets`
- `20260824010000_add_food_courier_profiles`
- `20260824011000_add_food_delivery_collections`
- `20260824012000_add_food_monthly_closes`
- `20260824013000_add_food_monthly_close_reopening`
- `20260824014000_add_food_monthly_close_revisions`
- `20260824180000_optimize_food_operational_indexes`

## Testes executados recentemente

- `npm run test:backend:postgres`: 69 passaram, 0 falharam, 0 cancelados, 0 ignorados.
- Cadeia completa de 53 migracoes: passou, incluindo indices operacionais comprovados por `EXPLAIN ANALYZE`.
- `npm --prefix backend run build`: passou.
- `npm --prefix frontend run typecheck`: passou.
- `npm --prefix frontend run build`: passou, 90 paginas geradas, incluindo `/food/ajuda` e a rota dinamica `/food/ajuda/manual`.
- Manual PDF: 30 paginas A4 renderizadas e inspeccionadas; extraccao confirmou os 27 topicos e 133 passos sem ausencias e o download local respondeu HTTP 200.
- Health local: frontend, backend e PostgreSQL responderam HTTP 200.
- `FOOD_PILOT_ORG_EMAIL=dev@local.test FOOD_PILOT_BRANCH_ID=cmt4xmxln007bz79l5vaoaz42 npm run pilot:food:preflight`: executou em modo local/read-only e identificou quatro bloqueios operacionais.
- Fluxo real local Caixa -> Cozinha: passou ate `Pronto`.
- API de entregadores: `Manuel Entregador` retornado activo e com acesso global.
- Pedido local `#0004` criado pela API v1; repeticao devolveu o mesmo pedido sem duplicar evento ou ticket.
- Listagem HTTP v1 validada localmente com rótulos, histórico estruturado, criador e projeções independentes.
- Endpoints v1 de configuracoes, unidades, categorias, extras e produtos validados localmente com dados reais.
- Visao geral, estados, pesquisa rapida e perfil CRM validados por HTTP local; `/api/food/overview` devolve 404 e `/api/food/v1/overview` devolve 200.
- Auditoria validada por HTTP local com actor, funcao, origem, dispositivo, motivo e payload; resposta v1 confirmou `organizationId`.

## Bloqueadores e cuidados

1. **Staging/producao existentes:** antes de publicar as novas baselines, executar `prisma migrate resolve --applied` para `20250116000000_baseline_schema` e `20260606000000_add_b2b_deals_foundation`. Nao executar o SQL das baselines sobre bases existentes.
2. **Publicacao futura:** as migrations de auditoria foram aplicadas apenas nas bases locais. Staging e producao continuam intocados ate aprovacao explicita.
3. **Piloto local Materia Preta:** faltam operadores para `cashier`, `kitchen`, `delivery_manager` e `crm_marketing`; o entregador Manuel ainda nao possui credencial Food activa.
4. **Catalogo e baseline:** a unidade tem um produto disponivel, mas nenhuma categoria activa; existem um pedido, um ticket, uma sessao de Caixa e um turno ainda abertos.
5. **Avisos nao bloqueantes:** a unidade nao possui sede fiscal ligada e o ambiente nao possui armazenamento privado para fotografias; usar PIN na entrega durante o piloto local.

## Proxima fatia

Preparar os dados sinteticos minimos da unidade `MATERIA PRETA` e repetir o preflight ate zero bloqueios antes da aceitacao humana. Depois dessa validacao, ligar tours contextuais aos fluxos operacionais prioritarios de Caixa e Cozinha e preparar o roteiro de gravacao; staging e producao permanecem fora de escopo.
