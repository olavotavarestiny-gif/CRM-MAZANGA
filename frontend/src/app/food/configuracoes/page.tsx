'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, CreditCard, Eye, KeyRound, Mail, MapPin, Phone, Plus, Save, Search, Settings, Store, UserPlus, UserRoundCog, Utensils, Volume2 } from 'lucide-react';
import {
  addTeamMember,
  assignFoodRole,
  configureFoodStaffPin,
  createFoodBranch,
  getEstabelecimentos,
  getFoodBranches,
  getFoodSettings,
  getFoodTeam,
  getTeamMembers,
  updateFoodBranch,
  updateFoodRoleAssignment,
  updateFoodSettings,
} from '@/lib/api';
import type { FoodRoleAssignment } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type { FoodBranch } from '@/lib/types';
import { playKitchenAlert } from '@/lib/food-kitchen-audio';
import { isClientDevAuthBypassEnabled, setDevAuthPersonId } from '@/lib/dev-auth';
import {
  FoodImagePicker,
  FoodPageHeader,
  RestaurantMark,
  SuccessNote,
  getFoodBrand,
  getFoodBrandStyle,
} from '@/components/food/food-ui';

type SettingsSection = 'identity' | 'operation' | 'orders' | 'locations' | 'team';
type BranchStatusFilter = 'all' | 'active' | 'inactive';

const ORDER_TYPE_OPTIONS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup', label: 'Levantamento' },
  { value: 'dine_in', label: 'Consumo no local' },
] as const;

const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'MULTICAIXA', label: 'Multicaixa Express' },
  { value: 'TPA', label: 'TPA' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'OTHER', label: 'Outro' },
] as const;

const BRANCH_STATUS_FILTERS: Array<{ value: BranchStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
];

function splitList(value: string[]) {
  return value.filter(Boolean);
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function getBranchLocation(branch: FoodBranch) {
  return [branch.address, branch.neighborhood].filter(Boolean).join(', ') || 'Morada por definir';
}

function getBranchSearchText(branch: FoodBranch) {
  return [
    branch.name,
    branch.address,
    branch.neighborhood,
    branch.phone,
    branch.email,
    branch.estabelecimento?.nome,
    branch.estabelecimento?.nif,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function ChipOption({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={selected
        ? 'inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--workspace-primary)] px-4 text-sm font-semibold text-[var(--workspace-on-primary)]'
        : 'inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50'}
    >
      {selected ? <Check className="h-4 w-4" /> : null}
      {label}
    </button>
  );
}

export default function FoodSettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<SettingsSection>('identity');
  const [successMessage, setSuccessMessage] = useState('');
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [branchStatusFilter, setBranchStatusFilter] = useState<BranchStatusFilter>('all');
  const [settingsForm, setSettingsForm] = useState({
    isEnabled: false,
    restaurantName: '',
    logoUrl: '',
    primaryColor: '#0f766e',
    secondaryColor: '',
    restaurantPhone: '',
    restaurantEmail: '',
    restaurantAddress: '',
    currency: 'AOA',
    timezone: 'Africa/Luanda',
    defaultPreparationMinutes: '20',
    kdsGreenMinutes: '15',
    kdsYellowMinutes: '25',
    kdsRedMinutes: '35',
    orderTypes: ['delivery', 'pickup', 'dine_in'],
    paymentMethods: ['CASH', 'MULTICAIXA', 'TPA', 'TRANSFER'],
    kitchenSoundEnabled: true,
    kitchenSoundVolume: '0.7',
    kitchenSoundRepeatSeconds: '20',
    kdsUnacceptedWarningSeconds: '60',
    kdsUnacceptedEscalationSeconds: '120',
    kdsReadyReminderMinutes: '5',
  });
  const [branchForm, setBranchForm] = useState({
    name: '',
    estabelecimentoId: '',
    phone: '',
    email: '',
    address: '',
    neighborhood: '',
    isMain: false,
  });
  const [roleForm, setRoleForm] = useState<{
    personId: string;
    role: FoodRoleAssignment['role'];
    branchId: string;
    isPrimary: boolean;
  }>({ personId: '', role: 'cashier', branchId: '', isPrimary: false });
  const [credentialTarget, setCredentialTarget] = useState<FoodRoleAssignment | null>(null);
  const [credentialPin, setCredentialPin] = useState('');
  const [credentialPinConfirm, setCredentialPinConfirm] = useState('');
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '' });

  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings, retry: 2 });
  const branchesQuery = useQuery({ queryKey: ['food-branches'], queryFn: getFoodBranches, retry: 2 });
  const estabelecimentosQuery = useQuery({ queryKey: ['estabelecimentos'], queryFn: getEstabelecimentos, retry: 2 });
  const membersQuery = useQuery({ queryKey: ['team-members'], queryFn: getTeamMembers, enabled: activeSection === 'team' });
  const foodTeamQuery = useQuery({ queryKey: ['food-team'], queryFn: getFoodTeam, enabled: activeSection === 'team' });

  useEffect(() => {
    const requestedSection = searchParams.get('section');
    if (['identity', 'operation', 'orders', 'locations', 'team'].includes(requestedSection || '')) {
      setActiveSection(requestedSection as SettingsSection);
    }
  }, [searchParams]);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) return;
    setSettingsForm({
      isEnabled: settings.isEnabled,
      restaurantName: settings.restaurantName || '',
      logoUrl: settings.logoUrl || '',
      primaryColor: settings.primaryColor || '#0f766e',
      secondaryColor: settings.secondaryColor || '',
      restaurantPhone: settings.restaurantPhone || '',
      restaurantEmail: settings.restaurantEmail || '',
      restaurantAddress: settings.restaurantAddress || '',
      currency: settings.currency || 'AOA',
      timezone: settings.timezone || 'Africa/Luanda',
      defaultPreparationMinutes: String(settings.defaultPreparationMinutes ?? 20),
      kdsGreenMinutes: String(settings.kdsGreenMinutes ?? 15),
      kdsYellowMinutes: String(settings.kdsYellowMinutes ?? 25),
      kdsRedMinutes: String(settings.kdsRedMinutes ?? 35),
      orderTypes: settings.orderTypes || ['delivery', 'pickup', 'dine_in'],
      paymentMethods: settings.paymentMethods || ['CASH', 'MULTICAIXA', 'TPA', 'TRANSFER'],
      kitchenSoundEnabled: settings.kitchenSoundEnabled,
      kitchenSoundVolume: String(settings.kitchenSoundVolume ?? 0.7),
      kitchenSoundRepeatSeconds: String(settings.kitchenSoundRepeatSeconds ?? 20),
      kdsUnacceptedWarningSeconds: String(settings.kdsUnacceptedWarningSeconds ?? 60),
      kdsUnacceptedEscalationSeconds: String(settings.kdsUnacceptedEscalationSeconds ?? 120),
      kdsReadyReminderMinutes: String(settings.kdsReadyReminderMinutes ?? 5),
    });
  }, [settingsQuery.data]);

  const invalidateSettings = () => {
    queryClient.invalidateQueries({ queryKey: ['food-settings'] });
    queryClient.invalidateQueries({ queryKey: ['food-overview'] });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 3000);
  };

  const settingsMutation = useMutation({
    mutationFn: () => updateFoodSettings({
      isEnabled: settingsForm.isEnabled,
      restaurantName: settingsForm.restaurantName || null,
      logoUrl: settingsForm.logoUrl || null,
      primaryColor: settingsForm.primaryColor,
      secondaryColor: settingsForm.secondaryColor || null,
      restaurantPhone: settingsForm.restaurantPhone || null,
      restaurantEmail: settingsForm.restaurantEmail || null,
      restaurantAddress: settingsForm.restaurantAddress || null,
      currency: settingsForm.currency,
      timezone: settingsForm.timezone,
      defaultPreparationMinutes: Number(settingsForm.defaultPreparationMinutes || 20),
      kdsGreenMinutes: Number(settingsForm.kdsGreenMinutes || 15),
      kdsYellowMinutes: Number(settingsForm.kdsYellowMinutes || 25),
      kdsRedMinutes: Number(settingsForm.kdsRedMinutes || 35),
      orderTypes: splitList(settingsForm.orderTypes),
      paymentMethods: splitList(settingsForm.paymentMethods),
      kitchenSoundEnabled: settingsForm.kitchenSoundEnabled,
      kitchenSoundVolume: Number(settingsForm.kitchenSoundVolume || 0.7),
      kitchenSoundRepeatSeconds: Number(settingsForm.kitchenSoundRepeatSeconds || 20),
      kdsUnacceptedWarningSeconds: Number(settingsForm.kdsUnacceptedWarningSeconds || 60),
      kdsUnacceptedEscalationSeconds: Number(settingsForm.kdsUnacceptedEscalationSeconds || 120),
      kdsReadyReminderMinutes: Number(settingsForm.kdsReadyReminderMinutes || 5),
    }),
    onSuccess: () => {
      invalidateSettings();
      showSuccess('Alterações guardadas.');
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: () => createFoodBranch({
      name: branchForm.name,
      estabelecimentoId: branchForm.estabelecimentoId || null,
      phone: branchForm.phone || null,
      email: branchForm.email || null,
      address: branchForm.address || null,
      neighborhood: branchForm.neighborhood || null,
      isMain: branchForm.isMain,
    }),
    onSuccess: () => {
      setBranchForm({ name: '', estabelecimentoId: '', phone: '', email: '', address: '', neighborhood: '', isMain: false });
      setUnitDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['food-branches'] });
      queryClient.invalidateQueries({ queryKey: ['food-overview'] });
      showSuccess('Local guardado.');
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isMain?: boolean; active?: boolean } }) => updateFoodBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-branches'] });
      queryClient.invalidateQueries({ queryKey: ['food-overview'] });
    },
  });
  const assignRoleMutation = useMutation({
    mutationFn: () => assignFoodRole({
      personId: Number(roleForm.personId),
      role: roleForm.role,
      branchId: roleForm.branchId || null,
      isPrimary: roleForm.isPrimary,
    }),
    onSuccess: () => {
      setRoleForm({ personId: '', role: 'cashier', branchId: '', isPrimary: false });
      queryClient.invalidateQueries({ queryKey: ['food-team'] });
      showSuccess('Função Food atribuída.');
    },
  });
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateFoodRoleAssignment(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['food-team'] }),
  });
  const credentialMutation = useMutation({
    mutationFn: () => configureFoodStaffPin({ personId: credentialTarget!.personId, pin: credentialPin, reason: 'Código configurado na equipa Food' }),
    onSuccess: () => {
      setCredentialTarget(null);
      setCredentialPin('');
      setCredentialPinConfirm('');
      queryClient.invalidateQueries({ queryKey: ['food-team'] });
      showSuccess('Código pessoal configurado.');
    },
  });
  const addMemberMutation = useMutation({
    mutationFn: () => addTeamMember(memberForm),
    onSuccess: (member) => {
      setMemberDialogOpen(false);
      setMemberForm({ name: '', email: '', password: '' });
      setRoleForm((current) => ({ ...current, personId: String(member.id) }));
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      showSuccess('Colaborador adicionado. Escolha agora a função Food.');
    },
  });

  const handleSettingsSubmit = (event: FormEvent) => {
    event.preventDefault();
    settingsMutation.mutate();
  };

  const handleBranchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!branchForm.name.trim()) return;
    createBranchMutation.mutate();
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="h-56 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <ErrorState
          title="Não foi possível abrir configurações"
          message={getApiErrorMessage(settingsQuery.error, 'Verifique a ligação e tente novamente.')}
          onRetry={() => settingsQuery.refetch()}
        />
      </div>
    );
  }

  const settings = settingsQuery.data;
  const brand = getFoodBrand({
    restaurantName: settingsForm.restaurantName || settings?.restaurantName,
    logoUrl: settingsForm.logoUrl || settings?.logoUrl,
    primaryColor: settingsForm.primaryColor,
    secondaryColor: settingsForm.secondaryColor || settings?.secondaryColor,
  });
  const sections: Array<{ value: SettingsSection; label: string; icon: typeof Settings }> = [
    { value: 'identity', label: 'Identidade', icon: Utensils },
    { value: 'operation', label: 'Operação', icon: Settings },
    { value: 'orders', label: 'Pedidos e pagamentos', icon: CreditCard },
    { value: 'locations', label: 'Locais', icon: Store },
    { value: 'team', label: 'Equipa Food', icon: UserRoundCog },
  ];
  const branches = [...(branchesQuery.data ?? [])].sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt');
  });
  const activeBranchCount = branches.filter((branch) => branch.active).length;
  const inactiveBranchCount = branches.length - activeBranchCount;
  const primaryBranch = branches.find((branch) => branch.isMain);
  const normalizedBranchSearch = branchSearch.trim().toLowerCase();
  const filteredBranches = branches.filter((branch) => {
    const matchesStatus =
      branchStatusFilter === 'all' ||
      (branchStatusFilter === 'active' && branch.active) ||
      (branchStatusFilter === 'inactive' && !branch.active);
    const matchesSearch = !normalizedBranchSearch || getBranchSearchText(branch).includes(normalizedBranchSearch);
    return matchesStatus && matchesSearch;
  });
  const branchFilterCounts: Record<BranchStatusFilter, number> = {
    all: branches.length,
    active: activeBranchCount,
    inactive: inactiveBranchCount,
  };
  const selectSection = (section: SettingsSection) => {
    setActiveSection(section);
    router.replace(`/food/configuracoes?section=${section}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6" style={getFoodBrandStyle({
      restaurantName: settingsForm.restaurantName,
      logoUrl: settingsForm.logoUrl,
      primaryColor: settingsForm.primaryColor,
      secondaryColor: settingsForm.secondaryColor,
    })}>
      <FoodPageHeader title="Configurações">
        <Button type="button" onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {settingsMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
        </Button>
      </FoodPageHeader>

      {successMessage ? <SuccessNote onClose={() => setSuccessMessage('')}>{successMessage}</SuccessNote> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit rounded-2xl border-slate-200 bg-white p-2 shadow-sm">
          {sections.map(({ value, label, icon: Icon }) => {
            const active = activeSection === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectSection(value)}
                className={active
                  ? 'flex w-full items-center gap-3 rounded-xl bg-[var(--workspace-primary)] px-3 py-3 text-left text-sm font-bold text-[var(--workspace-on-primary)]'
                  : 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </Card>

        <form onSubmit={handleSettingsSubmit} className={activeSection === 'locations' || activeSection === 'team' ? 'hidden' : 'min-w-0'}>
          {activeSection === 'identity' ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <FoodImagePicker
                      label="Logótipo"
                      value={settingsForm.logoUrl}
                      onChange={(logoUrl) => setSettingsForm((prev) => ({ ...prev, logoUrl: logoUrl || '' }))}
                      compact
                      fit="contain"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="restaurant-name">Nome do restaurante</Label>
                    <Input id="restaurant-name" value={settingsForm.restaurantName} onChange={(event) => setSettingsForm((prev) => ({ ...prev, restaurantName: event.target.value }))} placeholder="Nome do restaurante" />
                  </div>
                  <div>
                    <Label htmlFor="restaurant-primary-color">Cor principal</Label>
                    <Input id="restaurant-primary-color" type="color" value={settingsForm.primaryColor} onChange={(event) => setSettingsForm((prev) => ({ ...prev, primaryColor: event.target.value }))} className="h-11" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="restaurant-secondary-color">Cor secundária</Label>
                      {settingsForm.secondaryColor ? (
                        <button type="button" onClick={() => setSettingsForm((prev) => ({ ...prev, secondaryColor: '' }))} className="text-xs font-semibold text-slate-500 hover:text-red-600">
                          Remover
                        </button>
                      ) : null}
                    </div>
                    <Input id="restaurant-secondary-color" type="color" value={settingsForm.secondaryColor || settingsForm.primaryColor} onChange={(event) => setSettingsForm((prev) => ({ ...prev, secondaryColor: event.target.value }))} className="h-11" />
                  </div>
                  <div>
                    <Label htmlFor="restaurant-phone">Telefone</Label>
                    <Input id="restaurant-phone" value={settingsForm.restaurantPhone} onChange={(event) => setSettingsForm((prev) => ({ ...prev, restaurantPhone: event.target.value }))} placeholder="+244 923 000 000" />
                  </div>
                  <div>
                    <Label htmlFor="restaurant-email">Email</Label>
                    <Input id="restaurant-email" type="email" value={settingsForm.restaurantEmail} onChange={(event) => setSettingsForm((prev) => ({ ...prev, restaurantEmail: event.target.value }))} placeholder="restaurante@email.com" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="restaurant-address">Morada</Label>
                    <Input id="restaurant-address" value={settingsForm.restaurantAddress} onChange={(event) => setSettingsForm((prev) => ({ ...prev, restaurantAddress: event.target.value }))} placeholder="Rua, bairro, cidade" />
                  </div>
                </div>
                <Button type="submit" className="mt-5" disabled={settingsMutation.isPending}>
                  {settingsMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
                </Button>
              </Card>

              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-black text-slate-950">Pré-visualização</p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <RestaurantMark settings={{ restaurantName: brand.name, logoUrl: settingsForm.logoUrl, primaryColor: brand.primary, secondaryColor: brand.secondary }} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{brand.name}</p>
                      <p className="text-xs font-medium text-slate-500">Activo</p>
                    </div>
                  </div>
                  <button type="button" className="mt-5 h-10 w-full rounded-xl bg-[var(--workspace-primary)] text-sm font-bold text-[var(--workspace-on-primary)]">
                    Botão principal
                  </button>
                  <div className="mt-3 rounded-xl bg-[var(--workspace-primary-soft)] px-3 py-2 text-sm font-bold text-[var(--workspace-primary)]">
                    Item activo do menu
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {activeSection === 'operation' ? (
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:col-span-2">
                  <div>
                    <p className="text-sm font-black text-slate-950">Restaurante activo</p>
                    <p className="mt-1 text-xs text-slate-500">A equipa pode aceder ao menu quando activo.</p>
                  </div>
                  <Switch checked={settingsForm.isEnabled} onCheckedChange={(isEnabled) => setSettingsForm((prev) => ({ ...prev, isEnabled }))} />
                </div>
                <div>
                  <Label htmlFor="default-prep">Tempo normal de preparação</Label>
                  <div className="flex items-center gap-2">
                    <Input id="default-prep" type="number" min="1" value={settingsForm.defaultPreparationMinutes} onChange={(event) => setSettingsForm((prev) => ({ ...prev, defaultPreparationMinutes: event.target.value }))} />
                    <span className="text-sm font-medium text-slate-500">minutos</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="timezone">Fuso horário</Label>
                  <Input id="timezone" value={settingsForm.timezone} onChange={(event) => setSettingsForm((prev) => ({ ...prev, timezone: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="currency">Moeda</Label>
                  <Input id="currency" value={settingsForm.currency} onChange={(event) => setSettingsForm((prev) => ({ ...prev, currency: event.target.value }))} />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-4">
                  <div>
                    <p className="text-sm font-black text-slate-950">Som de novos pedidos</p>
                    <p className="mt-1 text-xs text-slate-500">Preparado para a cozinha.</p>
                  </div>
                  <Switch checked={settingsForm.kitchenSoundEnabled} onCheckedChange={(kitchenSoundEnabled) => setSettingsForm((prev) => ({ ...prev, kitchenSoundEnabled }))} />
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-4 md:col-span-2">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1"><Label htmlFor="kitchen-volume">Volume</Label><Input id="kitchen-volume" type="range" min="0" max="1" step="0.1" value={settingsForm.kitchenSoundVolume} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kitchenSoundVolume: event.target.value }))} className="mt-2" /></div>
                    <div className="w-full sm:w-44"><Label htmlFor="kitchen-repeat">Repetir a cada</Label><div className="mt-2 flex items-center gap-2"><Input id="kitchen-repeat" type="number" min="5" max="300" value={settingsForm.kitchenSoundRepeatSeconds} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kitchenSoundRepeatSeconds: event.target.value }))} /><span className="text-sm text-slate-500">seg</span></div></div>
                    <Button type="button" variant="outline" onClick={() => void playKitchenAlert('new', Number(settingsForm.kitchenSoundVolume || 0.7))}><Volume2 className="mr-2 h-4 w-4" />Testar</Button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-black text-slate-950">Tempo dos pedidos</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <Label htmlFor="kds-green" className="text-emerald-800">Normal</Label>
                    <Input id="kds-green" type="number" min="1" value={settingsForm.kdsGreenMinutes} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kdsGreenMinutes: event.target.value }))} className="mt-2 bg-white" />
                    <p className="mt-2 text-xs font-medium text-emerald-700">Até {settingsForm.kdsGreenMinutes || 0} min</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <Label htmlFor="kds-yellow" className="text-amber-800">Atenção</Label>
                    <Input id="kds-yellow" type="number" min="1" value={settingsForm.kdsYellowMinutes} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kdsYellowMinutes: event.target.value }))} className="mt-2 bg-white" />
                    <p className="mt-2 text-xs font-medium text-amber-700">De {Number(settingsForm.kdsGreenMinutes || 0) + 1} a {settingsForm.kdsYellowMinutes || 0} min</p>
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <Label htmlFor="kds-red" className="text-red-800">Atrasado</Label>
                    <Input id="kds-red" type="number" min="1" value={settingsForm.kdsRedMinutes} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kdsRedMinutes: event.target.value }))} className="mt-2 bg-white" />
                    <p className="mt-2 text-xs font-medium text-red-700">Mais de {settingsForm.kdsYellowMinutes || 0} min</p>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm font-black text-slate-950">Resposta e recolha</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div><Label htmlFor="kds-unaccepted-warning">Avisar cozinha</Label><div className="mt-2 flex items-center gap-2"><Input id="kds-unaccepted-warning" type="number" min="10" value={settingsForm.kdsUnacceptedWarningSeconds} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kdsUnacceptedWarningSeconds: event.target.value }))} /><span className="text-sm text-slate-500">seg</span></div></div>
                  <div><Label htmlFor="kds-unaccepted-escalation">Alertar Caixa</Label><div className="mt-2 flex items-center gap-2"><Input id="kds-unaccepted-escalation" type="number" min="20" value={settingsForm.kdsUnacceptedEscalationSeconds} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kdsUnacceptedEscalationSeconds: event.target.value }))} /><span className="text-sm text-slate-500">seg</span></div></div>
                  <div><Label htmlFor="kds-ready-reminder">Pedido pronto</Label><div className="mt-2 flex items-center gap-2"><Input id="kds-ready-reminder" type="number" min="1" value={settingsForm.kdsReadyReminderMinutes} onChange={(event) => setSettingsForm((prev) => ({ ...prev, kdsReadyReminderMinutes: event.target.value }))} /><span className="text-sm text-slate-500">min</span></div></div>
                </div>
              </div>
              <Button type="submit" className="mt-6" disabled={settingsMutation.isPending}>
                {settingsMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
              </Button>
            </Card>
          ) : null}

          {activeSection === 'orders' ? (
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm font-black text-slate-950">Tipos de pedido</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ORDER_TYPE_OPTIONS.map((option) => (
                    <ChipOption
                      key={option.value}
                      label={option.label}
                      selected={settingsForm.orderTypes.includes(option.value)}
                      onClick={() => setSettingsForm((prev) => ({ ...prev, orderTypes: toggleValue(prev.orderTypes, option.value) }))}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-7">
                <p className="text-sm font-black text-slate-950">Métodos de pagamento</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PAYMENT_OPTIONS.map((option) => (
                    <ChipOption
                      key={option.value}
                      label={option.label}
                      selected={settingsForm.paymentMethods.includes(option.value)}
                      onClick={() => setSettingsForm((prev) => ({ ...prev, paymentMethods: toggleValue(prev.paymentMethods, option.value) }))}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" className="mt-7" disabled={settingsMutation.isPending}>
                {settingsMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
              </Button>
            </Card>
          ) : null}
        </form>

        {activeSection === 'locations' ? (
          <div className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">Locais</p>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Organize as unidades onde a operação acontece. O vínculo fiscal é opcional e só será usado quando emitir factura.
                  </p>
                </div>
                <Button type="button" className="w-full sm:w-auto" onClick={() => setUnitDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar local
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-slate-500">Total</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{branches.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-emerald-700">Activos</p>
                  <p className="mt-2 text-2xl font-black text-emerald-900">{activeBranchCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-slate-500">Principal</p>
                  <p className="mt-2 truncate text-base font-black text-slate-950">{primaryBranch?.name || 'Por definir'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={branchSearch}
                    onChange={(event) => setBranchSearch(event.target.value)}
                    placeholder="Pesquisar por nome, morada, telefone ou vínculo fiscal"
                    className="pl-9"
                  />
                </div>
                <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {BRANCH_STATUS_FILTERS.map((filter) => {
                    const active = branchStatusFilter === filter.value;
                    return (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setBranchStatusFilter(filter.value)}
                        className={active
                          ? 'inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-white px-3 text-sm font-bold text-slate-950 shadow-sm'
                          : 'inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold text-slate-500 hover:text-slate-900'}
                      >
                        {filter.label}
                        <span className={active ? 'text-[var(--workspace-primary)]' : 'text-slate-400'}>{branchFilterCounts[filter.value]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {branchesQuery.isError ? (
              <ErrorState compact title="Não foi possível carregar locais" message={getApiErrorMessage(branchesQuery.error, 'Tente novamente.')} onRetry={() => branchesQuery.refetch()} />
            ) : null}

            {branchesQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="h-52 animate-pulse rounded-2xl bg-white shadow-sm" />
                <div className="h-52 animate-pulse rounded-2xl bg-white shadow-sm" />
              </div>
            ) : branches.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]">
                  <MapPin className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-black text-slate-950">Adicione o primeiro local do restaurante.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Use locais para separar balcões, cozinhas, filiais ou unidades. O vínculo fiscal pode ficar em branco.
                </p>
                <Button type="button" className="mt-5" onClick={() => setUnitDialogOpen(true)}>
                  Adicionar primeiro local
                </Button>
              </Card>
            ) : filteredBranches.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
                <Search className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-4 text-base font-black text-slate-950">Nenhum local encontrado.</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Ajuste a pesquisa ou altere o filtro de estado.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredBranches.map((branch) => (
                  <Card
                    key={branch.id}
                    className={branch.isMain
                      ? 'rounded-2xl border-[var(--workspace-primary-border)] bg-white p-5 shadow-sm ring-1 ring-[var(--workspace-primary-border)]'
                      : 'rounded-2xl border-slate-200 bg-white p-5 shadow-sm'}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black text-slate-950">{branch.name}</p>
                          {branch.isMain ? (
                            <Badge variant="success">
                              <Check className="mr-1 h-3 w-3" />
                              Principal
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={branch.active ? 'success' : 'secondary'}>{branch.active ? 'Activo' : 'Inactivo'}</Badge>
                          {branch.estabelecimento ? <Badge variant="secondary">Fiscal vinculado</Badge> : <Badge variant="secondary">Sem vínculo fiscal</Badge>}
                        </div>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]">
                        <Store className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-slate-600">
                      <div className="flex gap-3">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 break-words">{getBranchLocation(branch)}</span>
                      </div>
                      {branch.phone ? (
                        <div className="flex gap-3">
                          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-words">{branch.phone}</span>
                        </div>
                      ) : null}
                      {branch.email ? (
                        <div className="flex gap-3">
                          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-words">{branch.email}</span>
                        </div>
                      ) : null}
                    </div>

                    {branch.estabelecimento ? (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex gap-3 text-sm">
                          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-800">{branch.estabelecimento.nome}</p>
                            {branch.estabelecimento.nif ? <p className="mt-0.5 text-xs font-medium text-slate-500">NIF {branch.estabelecimento.nif}</p> : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={branch.isMain || updateBranchMutation.isPending}
                        onClick={() => updateBranchMutation.mutate({ id: branch.id, data: { isMain: true } })}
                      >
                        {branch.isMain ? 'Principal definido' : 'Tornar principal'}
                      </Button>
                      <Button
                        type="button"
                        variant={branch.active ? 'secondary' : 'outline'}
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={updateBranchMutation.isPending}
                        onClick={() => updateBranchMutation.mutate({ id: branch.id, data: { active: !branch.active } })}
                      >
                        {branch.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeSection === 'team' ? (
          <div className="min-w-0 space-y-5">
            <Card className="border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="text-lg font-black text-slate-950">Funções Food</h2><p className="mt-1 text-sm text-slate-500">Cada colaborador pode acumular funções e receber acesso global ou limitado a uma unidade.</p></div>
                <Button type="button" variant="outline" onClick={() => setMemberDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />Novo colaborador
                </Button>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div><Label>Colaborador</Label><select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={roleForm.personId} onChange={(event) => setRoleForm((current) => ({ ...current, personId: event.target.value }))}><option value="">Seleccionar</option>{(membersQuery.data ?? []).filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
                <div><Label>Função</Label><select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={roleForm.role} onChange={(event) => setRoleForm((current) => ({ ...current, role: event.target.value as FoodRoleAssignment['role'] }))}>{(foodTeamQuery.data?.roles ?? []).map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>
                <div><Label>Unidade</Label><select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={roleForm.branchId} onChange={(event) => setRoleForm((current) => ({ ...current, branchId: event.target.value }))}><option value="">Todas as unidades</option>{branches.filter((branch) => branch.active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                <div className="flex items-end"><Button type="button" className="w-full" disabled={!roleForm.personId || assignRoleMutation.isPending} onClick={() => assignRoleMutation.mutate()}><Plus className="mr-2 h-4 w-4" />Atribuir</Button></div>
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={roleForm.isPrimary} onChange={(event) => setRoleForm((current) => ({ ...current, isPrimary: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />Definir como função principal</label>
              {assignRoleMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(assignRoleMutation.error)}</p> : null}
            </Card>

            {foodTeamQuery.isLoading || membersQuery.isLoading ? <div className="h-44 animate-pulse rounded-2xl bg-white" /> : foodTeamQuery.isError || membersQuery.isError ? <ErrorState compact title="Não foi possível carregar a equipa Food" message={getApiErrorMessage(foodTeamQuery.error || membersQuery.error)} onRetry={() => Promise.all([foodTeamQuery.refetch(), membersQuery.refetch()])} /> : (foodTeamQuery.data?.assignments ?? []).length === 0 ? <Card className="border-dashed border-slate-200 bg-white p-8 text-center shadow-sm"><UserRoundCog className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-950">Sem funções atribuídas</p><p className="mt-1 text-sm text-slate-500">O proprietário mantém acesso de gestor por predefinição.</p></Card> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Função</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acção</th></tr></thead><tbody className="divide-y divide-slate-100">{(foodTeamQuery.data?.assignments ?? []).map((assignment) => <tr key={assignment.id}><td className="px-4 py-3"><p className="font-bold text-slate-950">{assignment.person.name}</p><p className="text-xs text-slate-500">{assignment.person.email}</p></td><td className="px-4 py-3"><span className="font-semibold text-slate-800">{assignment.roleLabel}</span>{assignment.isPrimary ? <Badge variant="secondary" className="ml-2">Principal</Badge> : null}</td><td className="px-4 py-3 text-slate-600">{assignment.branch?.name || 'Todas'}</td><td className="px-4 py-3"><Badge variant={assignment.credentialConfigured ? 'success' : 'secondary'}>{assignment.credentialConfigured ? 'Configurado' : 'Pendente'}</Badge></td><td className="px-4 py-3"><Badge variant={assignment.active ? 'success' : 'secondary'}>{assignment.active ? 'Activo' : 'Inactivo'}</Badge></td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{isClientDevAuthBypassEnabled() && assignment.active ? <Button type="button" size="icon" variant="ghost" title={`Testar como ${assignment.person.name}`} onClick={() => { setDevAuthPersonId(assignment.personId); window.location.href = assignment.role === 'courier' ? '/food/entregador' : '/food'; }}><Eye className="h-4 w-4 text-blue-700" /></Button> : null}<Button type="button" size="icon" variant="ghost" title="Configurar código pessoal" onClick={() => { setCredentialTarget(assignment); setCredentialPin(''); setCredentialPinConfirm(''); }}><KeyRound className="h-4 w-4" /></Button><Button type="button" size="sm" variant="outline" disabled={updateRoleMutation.isPending} onClick={() => updateRoleMutation.mutate({ id: assignment.id, active: !assignment.active })}>{assignment.active ? 'Desactivar' : 'Activar'}</Button></div></td></tr>)}</tbody></table></div></div>}
          </div>
        ) : null}
      </div>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input className="mt-1" value={memberForm.name} onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div><Label>Email</Label><Input className="mt-1" type="email" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} /></div>
            <div><Label>Password inicial</Label><Input className="mt-1" type="password" minLength={6} value={memberForm.password} onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))} /><p className="mt-1 text-xs text-slate-500">Mínimo de 6 caracteres. No modo local serve apenas para completar a identidade de teste.</p></div>
          </div>
          {addMemberMutation.isError ? <p className="text-sm font-semibold text-red-600">{getApiErrorMessage(addMemberMutation.error)}</p> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancelar</Button><Button type="button" disabled={!memberForm.name.trim() || !memberForm.email.trim() || memberForm.password.length < 6 || addMemberMutation.isPending} onClick={() => addMemberMutation.mutate()}><UserPlus className="mr-2 h-4 w-4" />Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialTarget !== null} onOpenChange={(open) => { if (!open) setCredentialTarget(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Configurar código pessoal</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">{credentialTarget?.person.name}. O código não será mostrado novamente.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label>Novo código</Label><Input className="mt-1" type="password" inputMode="numeric" maxLength={6} value={credentialPin} onChange={(event) => setCredentialPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div><div><Label>Confirmar</Label><Input className="mt-1" type="password" inputMode="numeric" maxLength={6} value={credentialPinConfirm} onChange={(event) => setCredentialPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div></div>
          {credentialMutation.isError ? <p className="text-sm font-semibold text-red-600">{getApiErrorMessage(credentialMutation.error)}</p> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCredentialTarget(null)}>Cancelar</Button><Button type="button" disabled={credentialPin.length < 4 || credentialPin !== credentialPinConfirm || credentialMutation.isPending} onClick={() => credentialMutation.mutate()}><KeyRound className="mr-2 h-4 w-4" />Guardar código</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar local</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBranchSubmit} className="space-y-4">
            <div>
              <Label htmlFor="branch-name">Nome</Label>
              <Input id="branch-name" value={branchForm.name} onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Local principal" />
            </div>
            <div>
              <Label htmlFor="branch-estabelecimento">Vínculo fiscal opcional</Label>
              <select id="branch-estabelecimento" value={branchForm.estabelecimentoId} onChange={(event) => setBranchForm((prev) => ({ ...prev, estabelecimentoId: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="">Sem vínculo fiscal</option>
                {(estabelecimentosQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="branch-phone">Telefone</Label>
                <Input id="branch-phone" value={branchForm.phone} onChange={(event) => setBranchForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </div>
              <div>
                <Label htmlFor="branch-email">Email opcional</Label>
                <Input id="branch-email" type="email" value={branchForm.email} onChange={(event) => setBranchForm((prev) => ({ ...prev, email: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="branch-address">Morada</Label>
              <Input id="branch-address" value={branchForm.address} onChange={(event) => setBranchForm((prev) => ({ ...prev, address: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="branch-neighborhood">Bairro/zona</Label>
              <Input id="branch-neighborhood" value={branchForm.neighborhood} onChange={(event) => setBranchForm((prev) => ({ ...prev, neighborhood: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Definir como principal</span>
              <Switch checked={branchForm.isMain} onCheckedChange={(isMain) => setBranchForm((prev) => ({ ...prev, isMain }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createBranchMutation.isPending || !branchForm.name.trim()}>
                {createBranchMutation.isPending ? 'A guardar...' : 'Guardar local'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
