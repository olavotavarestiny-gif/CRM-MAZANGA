const OWNER_LIBRARY_SIZE = 250;
const TEAM_LIBRARY_SIZE = 250;

function buildLibrary({ workspace, audience, titleTemplates, openingTemplates, actionTemplates, outcomeTemplates, categoryTemplates, limit }) {
  const tips = [];
  let index = 0;

  for (const category of categoryTemplates) {
    for (const opening of openingTemplates) {
      for (const action of actionTemplates) {
        for (const outcome of outcomeTemplates) {
          if (tips.length >= limit) {
            return tips;
          }

          index += 1;
          tips.push({
            id: `${workspace}-${audience}-${String(index).padStart(3, '0')}`,
            workspace,
            audience,
            title: titleTemplates[(index - 1) % titleTemplates.length].replace('{category}', category),
            message: `${opening} ${action} ${outcome}`,
            category,
          });
        }
      }
    }
  }

  return tips;
}

const SERVICOS_OWNER = buildLibrary({
  workspace: 'servicos',
  audience: 'owner',
  limit: OWNER_LIBRARY_SIZE,
  titleTemplates: [
    'Prioridade de {category}',
    'Gestão de {category}',
    'Foco do dia em {category}',
    'Disciplina de {category}',
    'Execução forte em {category}',
  ],
  categoryTemplates: [
    'pipeline',
    'clientes',
    'propostas',
    'rentabilidade',
    'equipa',
    'seguimento',
    'retenção',
    'agenda',
    'cobrança',
    'processos',
  ],
  openingTemplates: [
    'Hoje, olhe primeiro para os negócios que estão mais perto de fechar.',
    'Antes de abrir novas frentes, confirme onde a operação está a perder ritmo.',
    'Reserve os primeiros minutos do dia para decidir o que realmente move receita.',
    'Evite dispersão e escolha uma prioridade comercial clara para hoje.',
    'Comece o dia a rever os sinais que mostram onde a empresa precisa de atenção.',
  ],
  actionTemplates: [
    'Confirme se cada proposta activa tem próximo passo marcado.',
    'Garanta que os clientes com maior potencial recebem contacto proactivo.',
    'Revise pendências da equipa e desbloqueie o que está parado.',
    'Olhe para a margem antes de aceitar descontos ou urgências.',
    'Valide se as tarefas críticas estão alinhadas com os objectivos desta semana.',
  ],
  outcomeTemplates: [
    'para manter a empresa previsível e orientada a resultado.',
    'para aumentar controlo sem tornar a operação pesada.',
    'para transformar esforço em avanço real no pipeline.',
    'para proteger receita e reduzir improviso.',
    'para liderar com clareza e consistência.',
  ],
});

const SERVICOS_TEAM = buildLibrary({
  workspace: 'servicos',
  audience: 'equipa',
  limit: TEAM_LIBRARY_SIZE,
  titleTemplates: [
    'Rotina de {category}',
    'Execução diária em {category}',
    'Boa prática de {category}',
    'Melhoria rápida em {category}',
    'Passo forte em {category}',
  ],
  categoryTemplates: [
    'seguimento',
    'atendimento',
    'organização',
    'tarefas',
    'contactos',
    'propostas',
    'agenda',
    'resposta ao cliente',
    'pipeline',
    'disciplina',
  ],
  openingTemplates: [
    'Comece o dia pelas tarefas que estavam prometidas ao cliente.',
    'Hoje, responda primeiro a quem já demonstrou intenção real de avançar.',
    'Evite acumular pequenos atrasos que depois travam o resto da semana.',
    'Antes de criar mais trabalho, feche o que já está em andamento.',
    'Use o início do dia para organizar prioridades e reduzir retrabalho.',
  ],
  actionTemplates: [
    'Actualize o estado de cada contacto logo após cada interação.',
    'Deixe sempre o próximo passo claro depois de uma chamada ou reunião.',
    'Confirme que nenhuma tarefa urgente ficou sem responsável.',
    'Registe informação útil enquanto ela ainda está fresca.',
    'Faça seguimento com objectivo e prazo, não apenas para “marcar presença”.',
  ],
  outcomeTemplates: [
    'para trabalhar com mais confiança e menos confusão.',
    'para dar uma experiência mais profissional ao cliente.',
    'para ganhar ritmo sem perder qualidade.',
    'para manter o pipeline limpo e accionável.',
    'para ajudar a equipa a fechar melhor.',
  ],
});

const COMERCIO_OWNER = buildLibrary({
  workspace: 'comercio',
  audience: 'owner',
  limit: OWNER_LIBRARY_SIZE,
  titleTemplates: [
    'Decisão de {category}',
    'Controlo de {category}',
    'Olhar diário sobre {category}',
    'Gestão prática de {category}',
    'Ritmo de {category}',
  ],
  categoryTemplates: [
    'caixa',
    'stock',
    'margem',
    'vendas',
    'equipa',
    'mix de produtos',
    'clientes',
    'reposição',
    'turno',
    'rentabilidade',
  ],
  openingTemplates: [
    'Hoje, confirme primeiro onde a loja pode perder dinheiro sem perceber.',
    'Comece o dia a olhar para os números que mudam a operação rapidamente.',
    'Antes de acelerar vendas, garanta que o controlo está firme.',
    'Use os primeiros minutos para ver onde o negócio precisa de correcção.',
    'Evite decisões só por intuição e valide o pulso do dia com dados simples.',
  ],
  actionTemplates: [
    'Confirme se stock, caixa e preço estão alinhados nos produtos mais sensíveis.',
    'Revise os produtos de maior saída e os de menor margem no mesmo olhar.',
    'Garanta que a equipa sabe o foco comercial do turno.',
    'Valide se há reposição planeada para o que mais roda.',
    'Acompanhe vendas do dia com contexto, não só com volume.',
  ],
  outcomeTemplates: [
    'para vender com mais controlo e menos fuga de margem.',
    'para proteger caixa e evitar ruptura de stock.',
    'para transformar movimento em rentabilidade real.',
    'para liderar a operação com mais precisão.',
    'para manter a equipa alinhada ao resultado.',
  ],
});

const COMERCIO_TEAM = buildLibrary({
  workspace: 'comercio',
  audience: 'equipa',
  limit: TEAM_LIBRARY_SIZE,
  titleTemplates: [
    'Rotina de loja em {category}',
    'Bom hábito de {category}',
    'Execução no balcão: {category}',
    'Atenção de hoje em {category}',
    'Passo diário de {category}',
  ],
  categoryTemplates: [
    'atendimento',
    'caixa',
    'stock',
    'venda',
    'organização',
    'reposição',
    'cliente',
    'turno',
    'produto',
    'disciplina',
  ],
  openingTemplates: [
    'No início do turno, organize o essencial antes de atender com pressa.',
    'Hoje, garanta que cada venda deixa o sistema e o caixa consistentes.',
    'Evite pequenos erros operacionais que depois viram diferenças no fecho.',
    'Atenda com atenção ao detalhe e rapidez, sem perder clareza.',
    'Use o arranque do dia para pôr loja, equipa e informação no mesmo ritmo.',
  ],
  actionTemplates: [
    'Confirme preço, stock e troco antes de acelerar o atendimento.',
    'Mantenha os produtos-chave acessíveis e visíveis para a equipa.',
    'Registe bem cada movimento para evitar dúvidas no fecho.',
    'Observe o que os clientes mais pedem e reporte padrões ao responsável.',
    'Cuide da reposição antes que a ruptura apareça no balcão.',
  ],
  outcomeTemplates: [
    'para trabalhar com mais segurança durante o turno.',
    'para melhorar o atendimento e reduzir falhas.',
    'para ajudar a loja a vender melhor com menos stress.',
    'para manter a operação limpa e previsível.',
    'para apoiar a equipa com consistência.',
  ],
});

const DAILY_TIP_CATALOG = {
  servicos: {
    owner: SERVICOS_OWNER,
    equipa: SERVICOS_TEAM,
  },
  comercio: {
    owner: COMERCIO_OWNER,
    equipa: COMERCIO_TEAM,
  },
};

module.exports = {
  DAILY_TIP_CATALOG,
  DAILY_TIP_LIBRARY_SIZE: {
    servicos_owner: SERVICOS_OWNER.length,
    servicos_equipa: SERVICOS_TEAM.length,
    comercio_owner: COMERCIO_OWNER.length,
    comercio_equipa: COMERCIO_TEAM.length,
  },
};
