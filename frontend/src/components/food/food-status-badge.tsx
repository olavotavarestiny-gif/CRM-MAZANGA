import type { FoodOrderStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const LABELS: Record<FoodOrderStatus, string> = {
  draft: 'Rascunho',
  pending_confirmation: 'A confirmar',
  confirmed: 'Confirmado',
  sent_to_kitchen: 'Na cozinha',
  kitchen_accepted: 'Aceite',
  preparing: 'Em preparação',
  ready: 'Pronto',
  awaiting_handoff: 'A aguardar entrega',
  out_for_delivery: 'Em entrega',
  delivered: 'Entregue',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export function FoodStatusBadge({ status, label }: { status: FoodOrderStatus; label?: string }) {
  const variant = status === 'cancelled'
    ? 'destructive'
    : ['ready', 'delivered', 'completed'].includes(status) ? 'success' : 'secondary';
  return <Badge variant={variant}>{label || LABELS[status]}</Badge>;
}
