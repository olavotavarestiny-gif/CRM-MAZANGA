import type { DriveStep } from 'driver.js';

export type FoodTourId = 'workspace' | 'help';

export interface FoodTourDefinition {
  id: FoodTourId;
  title: string;
  steps: DriveStep[];
}

export const FOOD_TOUR_VERSION = '1.0.0';

export const FOOD_TOURS: Record<FoodTourId, FoodTourDefinition> = {
  workspace: {
    id: 'workspace',
    title: 'Conhecer os ambientes',
    steps: [
      {
        element: '[data-food-tour="workspace-header"]',
        popover: {
          title: 'Ambientes Food',
          description: 'Este é o ponto de entrada da operação. As opções apresentadas respeitam as funções activas da conta.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-food-tour="workspace-environments"]',
        popover: {
          title: 'Escolha o posto de trabalho',
          description: 'Gestão, Caixa, Cozinha, Delivery, Entregador e CRM têm ferramentas e regras próprias.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-food-tour="workspace-guide"]',
        popover: {
          title: 'Ajuda sempre disponível',
          description: 'Abra o guia para pesquisar uma tarefa, filtrar por função ou descarregar o manual completo.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-food-tour="food-nav"]',
        popover: {
          title: 'Navegação Food',
          description: 'O menu lateral mantém os ambientes e áreas de gestão disponíveis durante toda a operação.',
          side: 'right',
          align: 'start',
        },
      },
    ],
  },
  help: {
    id: 'help',
    title: 'Usar a Central de Ajuda',
    steps: [
      {
        element: '[data-food-tour="help-header"]',
        popover: {
          title: 'Central de Ajuda',
          description: 'Consulte a versão actual do guia, repita esta visita ou abra o manual PDF.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-food-tour="help-flow"]',
        popover: {
          title: 'Ordem recomendada',
          description: 'Este fluxo organiza o primeiro teste desde a configuração até à reconciliação e análise.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-food-tour="help-filters"]',
        popover: {
          title: 'Encontre uma tarefa',
          description: 'Pesquise por uma palavra ou filtre o conteúdo pela função do colaborador.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-food-tour="help-topics"]',
        popover: {
          title: 'Tópicos disponíveis',
          description: 'Escolha uma área para ver o resultado esperado, o passo a passo, dicas e alertas.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-food-tour="help-article"]',
        popover: {
          title: 'Aprenda e execute',
          description: 'Depois de ler, use “Abrir esta área” para continuar directamente na aplicação.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
};

function progressKey(userId: number) {
  return `kukugest:food-tours:${FOOD_TOUR_VERSION}:${userId}`;
}

export function getCompletedFoodTours(userId: number): FoodTourId[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(progressKey(userId)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is FoodTourId => item === 'workspace' || item === 'help');
  } catch {
    return [];
  }
}

export function markFoodTourCompleted(userId: number, tourId: FoodTourId) {
  if (typeof window === 'undefined') return;
  const completed = new Set(getCompletedFoodTours(userId));
  completed.add(tourId);
  window.localStorage.setItem(progressKey(userId), JSON.stringify(Array.from(completed)));
}

export async function startFoodTour(
  tourId: FoodTourId,
  userId: number,
  onComplete?: () => void,
) {
  const definition = FOOD_TOURS[tourId];
  const availableSteps = definition.steps.filter((step) => {
    if (typeof step.element !== 'string') return true;
    return Boolean(document.querySelector(step.element));
  });
  if (!availableSteps.length) return;

  const { driver } = await import('driver.js');
  let completed = false;
  const tour = driver({
    animate: true,
    allowClose: true,
    allowKeyboardControl: true,
    disableActiveInteraction: true,
    overlayColor: '#102A43',
    overlayOpacity: 0.62,
    popoverClass: 'kukugest-food-tour',
    progressText: '{{current}} de {{total}}',
    showProgress: true,
    smoothScroll: true,
    stagePadding: 8,
    stageRadius: 8,
    nextBtnText: 'Seguinte',
    prevBtnText: 'Anterior',
    doneBtnText: 'Concluir',
    steps: availableSteps,
    onNextClick: (_element, _step, { driver: activeTour }) => {
      if (activeTour.isLastStep()) {
        completed = true;
        activeTour.destroy();
        return;
      }
      activeTour.moveNext();
    },
    onDestroyed: () => {
      if (!completed) return;
      markFoodTourCompleted(userId, tourId);
      onComplete?.();
    },
  });
  tour.drive();
}
