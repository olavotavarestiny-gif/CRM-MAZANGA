# KukuGest Food - Roteiro de Aceitacao Local Matéria Preta

## 1. Estado e limites

Este roteiro valida a V1 local antes de qualquer staging, publicação ou migração. A execução deste documento não autoriza deploy, alteração de DNS, acesso ao Render nem utilização de dados pessoais reais.

Preencher antes da sessão:

| Campo | Valor |
|---|---|
| Data | |
| Versão/commit local | |
| Organização local | |
| Unidade piloto | |
| Gestor responsável | |
| Facilitador técnico | |
| Início/fim | |
| Resultado | `PENDENTE` |

## 2. Responsabilidades

| Papel | Responsabilidade na sessão |
|---|---|
| Gestor Matéria Preta | Confirma regras, catálogo, unidade, totais e decisão final. |
| Operador de Caixa | Executa turno, Caixa, pedidos, pagamentos e entrega de valores. |
| Operador de Cozinha | Usa apenas o KDS e confirma alertas, itens e tempos. |
| Gestor de Delivery | Atribui, reatribui e trata incidentes/devoluções. |
| Entregador | Usa o ecrã móvel, contacto auditado, estados e prova permitida. |
| CRM & Marketing | Confirma cliente, consentimentos, segmentos e histórico. |
| Facilitador técnico | Prepara ambiente, regista evidências e interrompe em critério de paragem. |

Uma pessoa pode acumular papéis, mas deve terminar sessão e entrar com a função seguinte. Não validar permissões alternando apenas menus numa conta de Gestor.

## 3. Dados permitidos

Permitido:

- Marca, logótipo, cores, unidade, categorias, produtos, preços e extras aprovados para o ensaio.
- Ingredientes e fichas técnicas com quantidades de teste identificadas.
- Clientes sintéticos `PILOTO LOCAL 001...`, telefones reservados `+244900000001...` e emails `pilot+001@example.test`.
- Moradas fictícias sem coordenadas de residências reais.
- Fotografias de um objecto neutro, apenas se o armazenamento privado estiver configurado.
- Valores AOA de teste definidos neste roteiro.

Proibido:

- Pedidos históricos, contactos reais, credenciais, fotografias de clientes ou documentos fiscais reais.
- Tokens Ziett, chaves de produção, base Render, storage público ou envio efectivo de campanhas.
- Emissão fiscal real. A ligação ao estabelecimento continua opcional para esta aceitação.
- Copiar dados do piloto local para staging/produção.

Todos os pedidos devem incluir `PILOTO LOCAL` no nome do cliente ou nas notas para permitir reconciliação posterior.

## 4. Dispositivos e preparação

| Ambiente | Dispositivo mínimo | Verificação |
|---|---|---|
| Gestão | Portátil, viewport >= 1280 px | [ ] |
| Caixa | Portátil ou tablet, viewport >= 1024 px | [ ] |
| Cozinha | Ecrã dedicado, áudio activo | [ ] |
| Delivery | Portátil ou tablet | [ ] |
| Entregador | Android/iPhone, largura 360-430 px | [ ] |
| CRM & Marketing | Portátil | [ ] |

Antes da sessão:

1. Executar `npm run dev:status` e guardar o resultado.
2. Definir `FOOD_PILOT_ORG_ID` ou `FOOD_PILOT_ORG_EMAIL`.
3. Se existir mais de uma unidade, definir `FOOD_PILOT_BRANCH_ID`.
4. Executar `npm run pilot:food:preflight`.
5. Não iniciar com qualquer bloqueio. Avisos devem ser aceites por escrito pelo Gestor.
6. Confirmar hora/fuso `Africa/Luanda`, moeda AOA e relógios dos dispositivos.
7. Confirmar uma rede local estável e um segundo acesso para simular reconexão.
8. Registar os utilizadores e funções sem anotar códigos pessoais.

## 5. Evidência mínima

Para cada cenário guardar:

- Identificador do cenário, hora inicial/final e operador.
- Número do pedido, unidade e dispositivo quando aplicável.
- Resultado `PASSOU`, `FALHOU` ou `BLOQUEADO`.
- Screenshot apenas sem telefone, morada, PIN, código pessoal ou imagem de cliente.
- Código do erro visível e pedido HTTP correlacionado quando houver falha.
- IDs de auditoria/eventos para comandos críticos.
- Observação curta sobre confusão, atraso ou passo desnecessário.

Nome recomendado: `F8-<cenario>-<data>-<sequencia>`. Não guardar evidências na pasta de uploads públicos.

## 6. Cenários obrigatórios

### F8-01 - Acesso e isolamento

- [ ] Gestor vê os seis ambientes e a unidade piloto.
- [ ] Caixa não abre Gestão, Cozinha, Delivery gestor ou Marketing.
- [ ] Cozinha não vê preços, pagamentos, telefone ou morada.
- [ ] Gestor de Delivery não cria pedidos nem altera catálogo.
- [ ] Entregador vê apenas tarefas próprias e dados apenas durante a entrega.
- [ ] CRM & Marketing não abre Caixa, Cozinha ou despacho.
- [ ] Operador não acede a outra unidade por URL directo.

Aceitação: todas as negações devolvem mensagem compreensível e nenhum dado da outra unidade.

### F8-02 - Marca, unidade e menu

- [ ] Logótipo adapta-se sem corte ou deformação em desktop e móvel.
- [ ] Unidade piloto aparece pelo nome correcto; sede fiscal vazia não bloqueia.
- [ ] Categorias, produtos, preços, disponibilidade e extras correspondem à folha aprovada.
- [ ] Um extra é criado, associado, editado e arquivado sem afectar pedidos anteriores.

### F8-03 - Turno e Caixa

- [ ] Código errado incrementa tentativa e não revela o código correcto.
- [ ] Operador inicia turno e abre Caixa com saldo inicial `10.000 AOA`.
- [ ] Segundo Caixa/turno incoerente é bloqueado.
- [ ] Sessão mostra operador, unidade, dispositivo e hora correctos.

### F8-04 - Dez pedidos Caixa -> Cozinha

Criar dez pedidos consecutivos: quatro levantamento, três consumo local e três Delivery. Pelo menos cinco usam extras e dois possuem observação de cozinha.

- [ ] Numeração é única e crescente.
- [ ] Duplo clique/reenvio não duplica pedido nem ticket.
- [ ] Totais são calculados no backend e conferem manualmente.
- [ ] Todos chegam ao KDS da unidade correcta.
- [ ] Caixa continua utilizável durante a sequência.

### F8-05 - KDS, áudio e reconexão

- [ ] Pedido novo alerta até ser reconhecido.
- [ ] Reconhecer não equivale a aceitar.
- [ ] Fluxo `Novo -> Aceite -> Em preparação -> Pronto` funciona por item/pedido.
- [ ] Alteração ou indisponibilidade exige confirmação e permanece no histórico.
- [ ] Desligar/religar a rede recupera eventos sem duplicar ou perder ticket.
- [ ] Áudio bloqueado pelo navegador produz aviso visual persistente.
- [ ] Pedido pronto recolhido sai da coluna operacional.

### F8-06 - Produto indisponível e stock

- [ ] Produto indisponível não entra num novo pedido.
- [ ] Enviar à Cozinha baixa uma única vez os ingredientes da ficha.
- [ ] Cancelar ainda em fila repõe exactamente o consumo.
- [ ] Stock insuficiente bloqueia envio sem criar movimento parcial.
- [ ] Compra/recepção parcial actualiza somente a quantidade confirmada.

### F8-07 - Pagamentos

- [ ] Pagamento parcial mantém saldo pendente.
- [ ] Pagamento total muda apenas `paymentState` e não conclui Cozinha/Delivery.
- [ ] Repetir confirmação não duplica pagamento ou Caixa.
- [ ] Emissão fiscal permanece comando separado e falha fiscal não desfaz pagamento.
- [ ] Não existe obrigação de sede fiscal para criar, preparar ou pagar pedido.

### F8-08 - Cinco fluxos Delivery

Executar cinco tarefas terminais:

1. Pedido pago, entrega normal com PIN.
2. Pedido pago, chegada e nova geração controlada de PIN.
3. Falha do primeiro entregador, reatribuição e entrega pelo segundo.
4. Pagamento local, confirmação do valor fixado, entrega ao Caixa e reconciliação. Fotografia apenas se o preflight confirmar storage privado.
5. Problema, contacto auditado e devolução documentada.

- [ ] Entregador não altera montante nem destinatário.
- [ ] Dados pessoais desaparecem depois de entrega/devolução.
- [ ] Valor local não entra no Caixa antes da reconciliação.
- [ ] Reatribuição com valor ainda em posse é bloqueada.
- [ ] Delivery apresenta quatro sucessos e uma devolução no relatório.

### F8-09 - CRM & Marketing

- [ ] Caixa encontra/cria cliente sintético sem duplicar telefone.
- [ ] Perfil mostra pedidos, produtos, métricas e ocorrências correctos.
- [ ] Consentimento desligado exclui o contacto de campanha elegível.
- [ ] Arquivo lógico remove cliente dos fluxos activos sem apagar pedidos.
- [ ] Nenhuma campanha é enviada externamente.

### F8-10 - Gestão, reconciliação e fecho

- [ ] Pedidos, pagamentos, Caixa, entregas e stock reconciliam pelos registos de origem.
- [ ] `Recebido`, `Reconciliado` e `Com entregadores` permanecem separados.
- [ ] Relatório respeita unidade e intervalo.
- [ ] Fecho mensal lista bloqueios enquanto existir Caixa/turno/compra/cobrança aberta.
- [ ] Sede fiscal ausente aparece no máximo como aviso.
- [ ] Exportação CSV/PDF preserva o snapshot sem dados reais.

### F8-11 - Desactivação e recuperação

- [ ] Gestor desactiva Food e rotas operacionais ficam bloqueadas.
- [ ] Contexto continua disponível para orientar reactivação.
- [ ] Reactivar restaura acesso sem alterar catálogo ou histórico.

## 7. Critérios de paragem

Parar imediatamente a sessão se ocorrer:

- **S0 Segurança:** acesso a outro tenant/unidade, exposição de PIN/código/token ou ficheiro privado servido publicamente.
- **S0 Financeiro:** pagamento, Caixa ou reconciliação duplicados; perda de rastreabilidade de valor.
- **S0 Dados:** perda/corrupção de catálogo, pedido, stock, evento ou auditoria.
- **S1 Operação:** dois pedidos consecutivos não chegam à Cozinha, estados ficam impossíveis ou Delivery atribui pessoa não autorizada.
- **S1 Estabilidade:** backend/base cai duas vezes ou não recupera em cinco minutos.

S2 de UX não interrompe automaticamente, mas deve ser registado: texto confuso, clique excessivo, foco, responsividade, áudio ou feedback tardio.

## 8. Decisão Go/No-Go local

Requisitos para `GO LOCAL CONCLUÍDO`:

- [ ] Preflight sem bloqueios.
- [ ] F8-01 a F8-11 executados.
- [ ] Zero S0 e zero S1 abertos.
- [ ] Dez pedidos sem duplicação/perda.
- [ ] Cinco fluxos Delivery reconciliados/explicados.
- [ ] Totais e stock conferidos pelo Gestor.
- [ ] Evidências sem dados pessoais.
- [ ] Gestor e facilitador técnico assinaram o resultado.

| Decisão | Nome | Data | Observação |
|---|---|---|---|
| Gestor Matéria Preta | | | |
| Facilitador técnico | | | |

`GO LOCAL CONCLUÍDO` não equivale a autorização de staging ou produção.

## 9. Limpeza e encerramento

1. Terminar entregas, reconciliar valores, fechar Caixa e terminar turnos.
2. Resolver ou documentar compras, diferenças e ocorrências abertas.
3. Exportar apenas o resumo de aceitação e IDs necessários.
4. Registar todos os contactos e pedidos com prefixo `PILOTO LOCAL`.
5. Não apagar operações financeiras/concluídas manualmente nem alterar snapshots.
6. Preparar limpeza transaccional local separada, revista por tenant e prefixo, somente após assinatura.
7. Executar novamente o preflight; operações abertas devem ser zero.
8. Confirmar `npm run test:backend:postgres`, builds e `npm run dev:status` antes de encerrar.

Qualquer preparação de staging, migração de catálogo ou publicação exige uma autorização explícita posterior.
