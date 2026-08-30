'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bike,
  ChefHat,
  CircleHelp,
  LayoutDashboard,
  Megaphone,
  Package,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCurrentUser, getFoodContext, getFoodSettings, getFoodTeam, updateFoodSettings } from '@/lib/api';
import { hasFoodPermission, hasFoodRole } from '@/lib/permissions';
import type { FoodRole } from '@/lib/permissions';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FoodPageHeader, RestaurantMark, getFoodBrand, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodTourButton } from '@/components/food/food-tour-button';
import { isClientDevAuthBypassEnabled, setDevAuthPersonId } from '@/lib/dev-auth';

const ENVIRONMENTS: Array<{
  href: string;
  title: string;
  description: string;
  permission: string;
  role?: FoodRole;
  icon: LucideIcon;
  tone: string;
}> = [
  { href: '/food/gestao', title: 'Gestão', description: 'Operação, stock, custos e desempenho.', permission: 'overview.view', icon: LayoutDashboard, tone: 'bg-emerald-50 text-emerald-700' },
  { href: '/food/caixa', title: 'Caixa', description: 'Atendimento, pedidos, pagamentos e fecho.', permission: 'orders.create', icon: ShoppingCart, tone: 'bg-blue-50 text-blue-700' },
  { href: '/food/cozinha', title: 'KukuGest Cozinha', description: 'Fila de produção e controlo por item.', permission: 'kitchen.view', icon: ChefHat, tone: 'bg-amber-50 text-amber-700' },
  { href: '/food/delivery', title: 'Delivery', description: 'Despacho, entregadores e ocorrências.', permission: 'delivery.view', icon: Truck, tone: 'bg-cyan-50 text-cyan-700' },
  { href: '/food/entregador', title: 'Entregador', description: 'Tarefas móveis e prova de entrega.', permission: 'delivery.view_own', role: 'courier', icon: Bike, tone: 'bg-orange-50 text-orange-700' },
  { href: '/food/crm', title: 'CRM & Marketing', description: 'Clientes, consentimentos e campanhas.', permission: 'crm.view', icon: Megaphone, tone: 'bg-rose-50 text-rose-700' },
];

export default function FoodWorkspacePage() {
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser, retry: false });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext, retry: false });
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings, retry: false });
  const localPreview = isClientDevAuthBypassEnabled() && userQuery.data?.foodAccess?.roles.includes('manager') === true;
  const teamQuery = useQuery({ queryKey: ['food-team'], queryFn: getFoodTeam, enabled: localPreview });
  const activateMutation = useMutation({
    mutationFn: () => updateFoodSettings({ isEnabled: true }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-context'] }),
        queryClient.invalidateQueries({ queryKey: ['food-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
      ]);
    },
  });

  if (userQuery.isLoading || contextQuery.isLoading || settingsQuery.isLoading) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><div className="h-72 animate-pulse rounded-lg bg-white" /></div>;
  }

  const error = userQuery.error || contextQuery.error || settingsQuery.error;
  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <ErrorState
          title="Não foi possível abrir o KukuGest Food"
          message={getApiErrorMessage(error, 'Confirme que o módulo Food está atribuído à organização.')}
          onRetry={() => Promise.all([userQuery.refetch(), contextQuery.refetch(), settingsQuery.refetch()])}
        />
      </div>
    );
  }

  const user = userQuery.data!;
  const context = contextQuery.data!;
  const settings = settingsQuery.data;
  const brand = getFoodBrand(settings);
  const previewCourier = teamQuery.data?.assignments.find((assignment) => assignment.active && assignment.role === 'courier' && assignment.person.active);
  const environments = ENVIRONMENTS.filter((environment) => (
    hasFoodPermission(user, environment.permission)
    && (!environment.role || hasFoodRole(user, environment.role) || (localPreview && environment.role === 'courier' && Boolean(previewCourier)))
  ));
  const canActivate = hasFoodPermission(user, 'settings.edit');

  if (!context.enabled || !settings?.isEnabled) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6" style={getFoodBrandStyle(settings)}>
        <Card className="border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <RestaurantMark settings={settings} size="xl" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--workspace-primary)]">KukuGest Food</p>
                <h1 className="mt-1 text-2xl font-black text-slate-950">Activar operação do restaurante</h1>
                <p className="mt-2 max-w-xl text-sm text-slate-500">O módulo pertence à organização, mas a operação Food ainda está desligada.</p>
              </div>
            </div>
            {canActivate ? (
              <Button size="lg" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate()}>
                {activateMutation.isPending ? 'A activar...' : 'Activar KukuGest Food'}
              </Button>
            ) : (
              <p className="max-w-xs text-sm font-medium text-slate-600">Peça a um gestor para activar a operação Food.</p>
            )}
          </div>
          {activateMutation.isError ? <p className="mt-5 text-sm font-semibold text-red-600">{getApiErrorMessage(activateMutation.error, 'Não foi possível activar o módulo.')}</p> : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settings)}>
      <div data-food-tour="workspace-header">
      <FoodPageHeader eyebrow={brand.name} title="Escolha o ambiente" description="Cada ambiente apresenta apenas as ferramentas autorizadas para a sua função.">
        <FoodTourButton tourId="workspace" userId={user.id} />
        <Button asChild variant="outline"><Link href="/food/ajuda" data-food-tour="workspace-guide"><CircleHelp className="mr-2 h-4 w-4" />Guia de utilização</Link></Button>
        {hasFoodPermission(user, 'catalog.view') ? (
          <Button asChild variant="outline"><Link href="/food/produtos"><Package className="mr-2 h-4 w-4" />Menu</Link></Button>
        ) : null}
      </FoodPageHeader>
      </div>

      <div data-food-tour="workspace-environments" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {environments.map(({ href, title, description, icon: Icon, tone, role }) => (
          <Link key={href} href={href} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-primary)]" onClick={(event) => {
            if (role === 'courier' && localPreview && previewCourier) {
              event.preventDefault();
              setDevAuthPersonId(previewCourier.personId);
              window.location.href = href;
            }
          }}>
            <Card className="h-full border-slate-200 bg-white p-5 shadow-sm transition hover:border-[var(--workspace-primary-border)] hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-6 w-6" /></div>
                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[var(--workspace-primary)]" />
              </div>
              <h2 className="mt-5 text-lg font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            </Card>
          </Link>
        ))}
      </div>

      {environments.length === 0 ? (
        <Card className="border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">A conta tem acesso ao Food, mas ainda não possui uma função operacional. Um gestor deve atribuir a função e a unidade.</Card>
      ) : null}
    </div>
  );
}
