'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  CheckCircle2, Plus, Building2, Settings, User as UserIcon,
  Users, Shield, Trash2, Pencil, ArrowRight,
} from 'lucide-react';
import {
  getFaturacaoConfig, updateFaturacaoConfig, getEstabelecimentos, createEstabelecimento,
  getCurrentUser, updateCurrentUserProfile, changePassword,
  getTeamMembers, addTeamMember, removeTeamMember,
} from '@/lib/api';
import { isComercio } from '@/lib/business-modes';
import type { PlanName, User } from '@/lib/api';
import type { IBANEntry } from '@/lib/types';
import MemberPermissionsModal from '@/components/configuracoes/member-permissions-modal';
import { PlanComparisonGrid } from '@/components/plans/plan-comparison-grid';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';
import {
  PLAN_FEATURE_LABELS,
  buildWhatsAppPlanLink,
  formatLimitValue,
  getPlanBadgeClasses,
  getPlanBillingOptions,
  getSortedPlanEntries,
} from '@/lib/plan-utils';

function ConfiguracoesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  type TabId = 'perfil' | 'plano' | 'empresa' | 'equipa';
  type RedirectTabId = TabId | 'admin' | 'superadmin';
  const requestedTab = searchParams?.get('tab') as RedirectTabId | null;
  const requestedSection = searchParams?.get('section');
  const isConfigTab = (tab: string | null): tab is TabId =>
    tab === 'perfil' || tab === 'plano' || tab === 'empresa' || tab === 'equipa';
  const [activeTab, setActiveTab] = useState<TabId>(
    requestedSection === 'faturacao' ? 'empresa' : isConfigTab(requestedTab) ? requestedTab : 'perfil'
  );
  const faturacaoSectionRef = useRef<HTMLDivElement | null>(null);

  // ── Current User ─────────────────────────────────────────
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const isOwner = currentUser && !currentUser.accountOwnerId;
  const isSuperAdmin = !!currentUser?.isSuperAdmin;
  const isComercioWorkspace = currentUser?.workspaceMode === 'comercio';
  const platformAdminHref = isSuperAdmin ? '/superadmin?section=organizations' : null;
  const currentPlan = (currentUser?.plan || 'essencial') as PlanName;
  const currentPlanCatalog = currentUser?.availablePlans?.[currentPlan];
  const planEntries = getSortedPlanEntries(currentUser?.availablePlans);
  const [selectedBilling, setSelectedBilling] = useState<Record<PlanName, string>>({
    essencial: 'Mensal',
    profissional: '6 meses',
    enterprise: 'Personalizado',
  });

  useEffect(() => {
    if (requestedSection === 'faturacao') {
      setActiveTab('empresa');
      return;
    }
    if (isConfigTab(requestedTab)) {
      setActiveTab(requestedTab);
      return;
    }
    setActiveTab('perfil');
  }, [requestedSection, requestedTab]);

  useEffect(() => {
    if (requestedTab === 'admin' && isSuperAdmin) {
      router.replace('/superadmin?section=users');
      return;
    }
    if (requestedTab === 'superadmin' && isSuperAdmin) {
      router.replace('/superadmin?section=organizations');
    }
  }, [isSuperAdmin, requestedTab, router]);

  // ── Perfil ───────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({ jobTitle: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setProfileForm({ jobTitle: currentUser.jobTitle || '' });
  }, [currentUser]);

  const profileMutation = useMutation({
    mutationFn: () => updateCurrentUserProfile({
      jobTitle: profileForm.jobTitle.trim() || null,
    }),
    onSuccess: (updatedUser) => {
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      setProfileError('');
      setProfileSaved(true);
      toast({
        variant: 'success',
        title: 'Perfil guardado',
        description: 'As alterações do teu perfil já estão ativas.',
      });
      window.dispatchEvent(new CustomEvent('kukugest:user-updated', { detail: updatedUser }));
      setTimeout(() => setProfileSaved(false), 2500);
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao guardar o perfil. Tente novamente.';
      setProfileError(message);
      toast({
        variant: 'error',
        title: 'Falha ao guardar perfil',
        description: message,
      });
    },
  });

  const submitPasswordChange = async () => {
    setPwError('');
    setPwSuccess('');
    if (pwForm.new !== pwForm.confirm) { setPwError('As passwords não correspondem'); return false; }
    if (pwForm.new.length < 6) { setPwError('A password deve ter pelo menos 6 caracteres'); return false; }
    setPwSubmitting(true);
    try {
      await changePassword(pwForm.new);
      setPwSuccess('Password alterada com sucesso!');
      setPwForm({ current: '', new: '', confirm: '' });
      toast({
        variant: 'success',
        title: 'Password atualizada',
        description: 'A tua password foi alterada com sucesso.',
      });
      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao alterar a password. Tente novamente.';
      setPwError(message);
      toast({
        variant: 'error',
        title: 'Falha ao alterar password',
        description: message,
      });
      return false;
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPasswordChange();
  };

  // ── Empresa & AGT ────────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    nifEmpresa: '',
    nomeEmpresa: '',
    moradaEmpresa: '',
    telefoneEmpresa: '',
    emailEmpresa: '',
    websiteEmpresa: '',
    agtCertNumber: '',
    agtMockMode: true,
  });
  const [ibans, setIbans] = useState<IBANEntry[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState('');
  const [showEstab, setShowEstab] = useState(false);
  const [estabError, setEstabError] = useState('');
  const [estabForm, setEstabForm] = useState({ nome: '', morada: '', telefone: '', email: '', isPrincipal: false });
  const companyNameForPlan =
    (isOwner ? configForm.nomeEmpresa : currentUser?.accountOwnerName) || currentUser?.accountOwnerName || null;

  const { data: config } = useQuery({
    queryKey: ['faturacao-config'],
    queryFn: getFaturacaoConfig,
    enabled: (activeTab === 'empresa' || activeTab === 'plano') && !!isOwner,
  });

  const {
    data: estabs = [],
    isLoading: estabsLoading,
    isError: estabsIsError,
    refetch: refetchEstabs,
    error: estabsQueryError,
  } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: getEstabelecimentos,
    enabled: activeTab === 'empresa' && !!isOwner,
  });

  useEffect(() => {
    if (config) {
      setConfigForm({
        nifEmpresa: config.nifEmpresa,
        nomeEmpresa: config.nomeEmpresa,
        moradaEmpresa: config.moradaEmpresa,
        telefoneEmpresa: config.telefoneEmpresa || '',
        emailEmpresa: config.emailEmpresa || '',
        websiteEmpresa: config.websiteEmpresa || '',
        agtCertNumber: config.agtCertNumber,
        agtMockMode: config.agtMockMode,
      });
      setLogoUrl(config.logoUrl || '');
      try {
        const parsed = config.iban ? JSON.parse(config.iban) : [];
        setIbans(Array.isArray(parsed) ? parsed : config.iban ? [{ label: 'Principal', iban: config.iban }] : []);
      } catch {
        setIbans(config.iban ? [{ label: 'Principal', iban: config.iban }] : []);
      }
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => updateFaturacaoConfig({ ...configForm, iban: JSON.stringify(ibans), logoUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faturacao-config'] });
      setConfigError('');
      setConfigSaved(true);
      toast({
        variant: 'success',
        title: 'Configurações guardadas',
        description: 'Os dados da empresa foram atualizados.',
      });
      setTimeout(() => setConfigSaved(false), 2500);
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao guardar as configurações. Tente novamente.';
      setConfigError(message);
      toast({
        variant: 'error',
        title: 'Falha ao guardar configurações',
        description: message,
      });
    },
  });

  const estabMutation = useMutation({
    mutationFn: () => createEstabelecimento(estabForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estabelecimentos'] });
      setShowEstab(false);
      setEstabError('');
      setEstabForm({ nome: '', morada: '', telefone: '', email: '', isPrincipal: false });
      toast({
        variant: 'success',
        title: isComercioWorkspace ? 'Ponto de venda criado' : 'Estabelecimento criado',
        description: isComercioWorkspace
          ? 'O novo ponto de venda já está disponível com a série padrão criada automaticamente.'
          : 'O novo estabelecimento já está disponível com a série padrão criada automaticamente.',
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || 'Erro ao criar estabelecimento.';
      setEstabError(message);
      toast({
        variant: 'error',
        title: isComercioWorkspace ? 'Falha ao criar ponto de venda' : 'Falha ao criar estabelecimento',
        description: message,
      });
    },
  });

  useEffect(() => {
    if (activeTab !== 'empresa' || requestedSection !== 'faturacao') return;
    const timer = setTimeout(() => {
      faturacaoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [activeTab, requestedSection]);

  // ── Equipa ───────────────────────────────────────────────
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '' });
  const [memberError, setMemberError] = useState('');

  const { data: teamMembers = [], refetch: refetchTeam } = useQuery({
    queryKey: ['team-members'],
    queryFn: getTeamMembers,
    enabled: activeTab === 'equipa' && !!isOwner,
  });

  const addMemberMutation = useMutation({
    mutationFn: () => addTeamMember(memberForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members'] });
      setShowAddMember(false);
      setMemberForm({ name: '', email: '', password: '' });
      setMemberError('');
      toast({
        variant: 'success',
        title: 'Membro adicionado',
        description: 'O novo membro já faz parte da equipa.',
      });
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || 'Erro ao adicionar membro';
      setMemberError(message);
      toast({
        variant: 'error',
        title: 'Falha ao adicionar membro',
        description: message,
      });
    },
  });

  const removeMember = async (memberId: number) => {
    if (!confirm('Tem a certeza que quer remover este membro?')) return;
    try {
      await removeTeamMember(memberId);
      qc.invalidateQueries({ queryKey: ['team-members'] });
      toast({
        variant: 'success',
        title: 'Membro removido',
        description: 'A equipa foi atualizada.',
      });
    } catch (err: any) {
      const message = err.response?.data?.error || 'Erro ao remover membro';
      setMemberError(message);
      toast({
        variant: 'error',
        title: 'Falha ao remover membro',
        description: message,
      });
    }
  };

  // ── Equipa: member permissions modal ──────────────────────
  const [permMember, setPermMember] = useState<User | null>(null);

  // ── Tab config ───────────────────────────────────────────
  const tabs = [
    { id: 'perfil' as TabId, label: 'Perfil', icon: UserIcon, show: true },
    { id: 'plano' as TabId, label: 'Plano', icon: Shield, show: true },
    { id: 'empresa' as TabId, label: 'Empresa', icon: Building2, show: !!isOwner },
    { id: 'equipa' as TabId, label: 'Equipa', icon: Users, show: !!isOwner },
  ].filter(t => t.show);

  const activeBtnBg = isComercioWorkspace ? 'bg-[#B84D0E]' : 'bg-[#0A2540]';
  const activeBtnText = isComercioWorkspace ? 'hover:text-[#B84D0E]' : 'hover:text-[#0A2540]';

  const tabBtn = (id: TabId) =>
    `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
      activeTab === id
        ? `${activeBtnBg} text-white shadow-sm`
        : `text-gray-500 hover:bg-slate-50 ${activeBtnText}`
    }`;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">Perfil, plano, empresa, equipa e administração de conta.</p>
      </div>

      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={tabBtn(id)}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {platformAdminHref && (
        <Card className="mb-6 border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-[#0A2540]">
                <Shield className="h-4 w-4" />
                Administração da Plataforma
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Utilizadores, contas, organizações e ferramentas globais passaram para uma superfície única.
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href={platformAdminHref}>Abrir Administração</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* ── PERFIL ──────────────────────────────────────────── */}
      {activeTab === 'perfil' && (
        <div className="space-y-4 max-w-lg">
          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-500" />
                Informações Pessoais
              </h2>
              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Nome</Label>
                <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm">
                  {currentUser?.name || '—'}
                </div>
              </div>
              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Email</Label>
                <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm">
                  {currentUser?.email || '—'}
                </div>
              </div>
              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Função na Empresa</Label>
                <Input
                  value={profileForm.jobTitle}
                  onChange={e => setProfileForm({ jobTitle: e.target.value })}
                  placeholder="Ex: Diretora Comercial"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-gray-400">Este campo aparece no widget do utilizador no topo da aplicação.</p>
              </div>
              {profileError && (
                <ErrorState
                  compact
                  title="Não foi possível guardar o perfil"
                  message={profileError}
                  onRetry={() => { setProfileError(''); profileMutation.mutate(); }}
                  secondaryAction={{ label: 'Fechar', onClick: () => setProfileError('') }}
                />
              )}
              <LoadingButton
                onClick={() => { setProfileError(''); profileMutation.mutate(); }}
                disabled={profileMutation.isPending}
                loading={profileMutation.isPending}
                loadingLabel="A guardar..."
                className={`w-full text-white ${isComercioWorkspace ? 'bg-[#B84D0E] hover:bg-[#9a3d0a]' : 'bg-[#0A2540] hover:bg-[#0d3060]'}`}
              >
                {profileSaved ? 'Perfil guardado' : 'Guardar Perfil'}
              </LoadingButton>
              {(currentUser?.role === 'admin' || currentUser?.isSuperAdmin) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <Shield className="w-3 h-3" /> {currentUser?.isSuperAdmin ? 'Super Admin' : 'Administrador'}
                </span>
              )}
            </div>
          </Card>

          {isOwner && (
            <Card className="border-slate-200 shadow-sm">
              <div className="p-6 space-y-4">
                <h2 className="text-base font-semibold text-[#0A2540]">Modo de Trabalho</h2>
                <p className="text-sm text-gray-500">
                  O workspace da organização é definido pela KukuGest e só pode ser alterado no painel de superadmin.
                </p>
                <div className={`rounded-xl border p-4 ${
                  isComercioWorkspace
                    ? 'border-[#B84D0E] bg-[#FDF2EA]'
                    : 'border-[#0A2540] bg-[#EEF5FC]'
                }`}>
                  <p className={`text-sm font-semibold ${
                    isComercioWorkspace ? 'text-[#B84D0E]' : 'text-[#0A2540]'
                  }`}>
                    Workspace ativo: {isComercioWorkspace ? 'Comércio' : 'Serviços'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Esta definição é aplicada à organização autenticada e não pode ser alterada nas configurações da conta.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#0A2540]">Alterar Password</h2>
              {pwError && (
                <ErrorState
                  compact
                  title="Não foi possível alterar a password"
                  message={pwError}
                  onRetry={() => void submitPasswordChange()}
                  secondaryAction={{ label: 'Fechar', onClick: () => setPwError('') }}
                />
              )}
              {pwSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{pwSuccess}</div>}
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <Label className="text-gray-700">Password Actual</Label>
                  <Input type="password" placeholder="••••••••" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-700">Nova Password</Label>
                  <Input type="password" placeholder="••••••••" value={pwForm.new} onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-700">Confirmar Password</Label>
                  <Input type="password" placeholder="••••••••" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required className="mt-1" />
                </div>
                <LoadingButton type="submit" disabled={pwSubmitting} loading={pwSubmitting} loadingLabel="A alterar..." className={`w-full text-white ${isComercioWorkspace ? 'bg-[#B84D0E] hover:bg-[#9a3d0a]' : 'bg-[#0A2540] hover:bg-[#0d3060]'}`}>
                  Alterar Password
                </LoadingButton>
              </form>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'plano' && currentPlanCatalog && (
        <div className="space-y-4 max-w-4xl">
          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Plano Atual</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#0A2540]">{currentPlanCatalog.label}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-gray-500">{currentPlanCatalog.description}</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getPlanBadgeClasses(currentPlan)}`}>
                  {currentPlan.toUpperCase()}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { key: 'users', label: 'Utilizadores' },
                  { key: 'contacts', label: 'Contactos' },
                  { key: 'tasks', label: 'Tarefas' },
                  { key: 'automations', label: 'Automações' },
                ].map(({ key, label }) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="mt-2 text-lg font-bold text-[#0A2540]">
                      {formatLimitValue(currentPlanCatalog.limits[key as keyof typeof currentPlanCatalog.limits])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#0A2540]">Funcionalidades incluídas</h2>
                  <p className="mt-1 text-sm text-gray-500">O acesso final na aplicação cruza plano e permissões da conta.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(currentPlanCatalog.features).map(([feature, enabled]) => (
                  <div
                    key={feature}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      enabled
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-[#0A2540]">
                      {PLAN_FEATURE_LABELS[feature as keyof typeof PLAN_FEATURE_LABELS]}
                    </span>
                    <span className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {enabled ? 'Ativo' : 'Indisponível'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#0A2540]">Upgrade e ativação</h2>
                <p className="mt-1 text-sm text-gray-500">Ativação manual via WhatsApp. Escolhe a modalidade pretendida e fala connosco.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {getPlanBillingOptions(currentPlan).map((billing) => (
                  <button
                    key={billing}
                    type="button"
                    onClick={() => setSelectedBilling((prev) => ({ ...prev, [currentPlan]: billing }))}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      (selectedBilling[currentPlan] || getPlanBillingOptions(currentPlan)[0]) === billing
                        ? isComercioWorkspace ? 'border-[#B84D0E] bg-[#B84D0E] text-white' : 'border-[#0A2540] bg-[#0A2540] text-white'
                        : isComercioWorkspace ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#B84D0E]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#0A2540]'
                    }`}
                  >
                    {billing}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-gray-500">
                  Pedido preparado para <strong>{currentPlanCatalog.label}</strong> ({selectedBilling[currentPlan] || getPlanBillingOptions(currentPlan)[0]}).
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button asChild className="gap-2">
                    <a
                      href={buildWhatsAppPlanLink({
                        plan: currentPlan,
                        billing: selectedBilling[currentPlan] || getPlanBillingOptions(currentPlan)[0],
                        name: currentUser?.name,
                        company: companyNameForPlan,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Falar no WhatsApp
                    </a>
                  </Button>
                  <p className="text-xs text-gray-400">Ativação manual via WhatsApp</p>
                </div>
              </div>
            </div>
          </Card>

          {planEntries.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-[#0A2540]">Comparar planos</h2>
                <p className="mt-1 text-sm text-gray-500">
                  A mesma grelha de comparação usada em <Link href="/planos" className="font-medium text-[#0A2540] hover:underline">/planos</Link>, com ativação manual via WhatsApp.
                </p>
              </div>

              <PlanComparisonGrid
                planEntries={planEntries}
                currentPlan={currentPlan}
                selectedBilling={selectedBilling}
                onBillingChange={(plan, billing) =>
                  setSelectedBilling((prev) => ({ ...prev, [plan]: billing }))
                }
                name={currentUser?.name}
                company={companyNameForPlan}
              />
            </div>
          )}
        </div>
      )}

      {/* ── EMPRESA & AGT ───────────────────────────────────── */}
      {activeTab === 'empresa' && (
        <div className="space-y-4 max-w-3xl">
          <Card
            ref={faturacaoSectionRef}
            className={`border-slate-200 shadow-sm ${requestedSection === 'faturacao' ? 'ring-2 ring-[#0A2540]/20 border-[#0A2540]/30' : ''}`}
          >
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                Configuração Fiscal e AGT
              </h2>
              <p className="text-sm text-gray-500">
                Define os dados fiscais da conta, a emissão documental e a base usada pela faturação e pela Venda Rápida.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-[#0A2540]">Estrutura desta área</p>
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="font-semibold text-slate-900">Empresa</span>
                    <p className="mt-1">Guarda o NIF fiscal central, morada, IBANs e dados AGT.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="font-semibold text-slate-900">{isComercioWorkspace ? 'Pontos de venda' : 'Estabelecimentos'}</span>
                    <p className="mt-1">Definem a origem operacional da emissão, como loja, balcão ou unidade.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="font-semibold text-slate-900">Séries</span>
                    <p className="mt-1">São criadas automaticamente e só precisam de gestão manual em casos avançados.</p>
                  </div>
                </div>
              </div>
              {/* Logo upload */}
              <div>
                <Label className="text-gray-700">Logotipo da Empresa</Label>
                <div className="mt-2 flex items-center gap-4">
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoUrl} alt="Logo" className="h-16 w-auto max-w-[120px] object-contain rounded border border-gray-200 bg-white p-1" />
                  ) : (
                    <div className="h-16 w-24 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-xs text-center">Sem logo</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50 font-medium">
                        {logoUrl ? 'Trocar logo' : 'Carregar logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { setConfigError('Ficheiro demasiado grande. Use uma imagem com menos de 2 MB.'); return; }
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const src = ev.target?.result as string;
                            if (!src) return;
                            // Compress via canvas to max 200px height, JPEG quality 0.85
                            const img = new Image();
                            img.onload = () => {
                              const MAX_H = 200;
                              const scale = img.height > MAX_H ? MAX_H / img.height : 1;
                              const canvas = document.createElement('canvas');
                              canvas.width = Math.round(img.width * scale);
                              canvas.height = Math.round(img.height * scale);
                              const ctx = canvas.getContext('2d')!;
                              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                              const mimeOut = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                              setLogoUrl(canvas.toDataURL(mimeOut, 0.85));
                              setConfigError('');
                            };
                            img.src = src;
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {logoUrl && (
                      <button type="button" onClick={() => setLogoUrl('')} className="text-xs text-red-500 hover:text-red-700 text-left">Remover</button>
                    )}
                    <p className="text-xs text-gray-400">PNG, JPG ou WebP · máx. 800 KB (SVG não suportado em PDF)</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-gray-700">NIF da Empresa</Label>
                  <Input value={configForm.nifEmpresa} onChange={e => setConfigForm(p => ({ ...p, nifEmpresa: e.target.value }))} placeholder="5000123456" className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-700">Nome da Empresa</Label>
                  <Input value={configForm.nomeEmpresa} onChange={e => setConfigForm(p => ({ ...p, nomeEmpresa: e.target.value }))} placeholder="Empresa Lda" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-gray-700">Morada</Label>
                <Input value={configForm.moradaEmpresa} onChange={e => setConfigForm(p => ({ ...p, moradaEmpresa: e.target.value }))} placeholder="Luanda, Angola" className="mt-1" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-gray-700">Telefone</Label>
                  <Input value={configForm.telefoneEmpresa} onChange={e => setConfigForm(p => ({ ...p, telefoneEmpresa: e.target.value }))} placeholder="+244 923 000 000" className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-700">Email</Label>
                  <Input value={configForm.emailEmpresa} onChange={e => setConfigForm(p => ({ ...p, emailEmpresa: e.target.value }))} placeholder="financeiro@empresa.ao" className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-700">Website</Label>
                  <Input value={configForm.websiteEmpresa} onChange={e => setConfigForm(p => ({ ...p, websiteEmpresa: e.target.value }))} placeholder="www.empresa.ao" className="mt-1" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-gray-700">IBANs</Label>
                  <button
                    type="button"
                    onClick={() => setIbans(p => [...p, { label: '', iban: '' }])}
                    className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
                {ibans.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhum IBAN adicionado. Os IBANs aparecem nas facturas para pagamento por transferência.</p>
                )}
                <div className="space-y-2 mt-1">
                  {ibans.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={entry.label}
                        onChange={e => setIbans(p => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                        placeholder="Banco / Label"
                        className="w-36 text-sm"
                      />
                      <Input
                        value={entry.iban}
                        onChange={e => setIbans(p => p.map((x, idx) => idx === i ? { ...x, iban: e.target.value } : x))}
                        placeholder="AO06.0040.0000.0000.0000.1015.4"
                        className="flex-1 text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setIbans(p => p.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-gray-700">Nº Certificado AGT</Label>
                <Input value={configForm.agtCertNumber} onChange={e => setConfigForm(p => ({ ...p, agtCertNumber: e.target.value }))} placeholder="PENDING" className="mt-1" />
                <p className="text-xs text-gray-400 mt-1">Atribuído pela AGT após certificação do software</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <input type="checkbox" id="mockMode" checked={configForm.agtMockMode} onChange={e => setConfigForm(p => ({ ...p, agtMockMode: e.target.checked }))} className="w-4 h-4 accent-[#0A2540]" />
                <div className="flex-1">
                  <label htmlFor="mockMode" className="text-[#0A2540] text-sm font-medium cursor-pointer">Modo Mock AGT</label>
                  <p className="text-xs text-gray-400">Simula comunicação com a AGT (sem credenciais reais)</p>
                </div>
                {configForm.agtMockMode && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-200">ATIVO</span>}
              </div>
              {configError && (
                <ErrorState
                  compact
                  title="Não foi possível guardar as configurações"
                  message={configError}
                  onRetry={() => { setConfigError(''); saveMutation.mutate(); }}
                  secondaryAction={{ label: 'Fechar', onClick: () => setConfigError('') }}
                />
              )}
              <LoadingButton onClick={() => { setConfigError(''); saveMutation.mutate(); }} disabled={saveMutation.isPending} loading={saveMutation.isPending} loadingLabel="A guardar..." className={`w-full text-white ${isComercioWorkspace ? 'bg-[#B84D0E] hover:bg-[#9a3d0a]' : 'bg-[#0A2540] hover:bg-[#0d3060]'}`}>
                {configSaved ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Guardado!</> : 'Guardar Configurações'}
              </LoadingButton>
            </div>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  {isComercioWorkspace ? 'Pontos de Venda' : 'Estabelecimentos'}
                </h2>
                <Button size="sm" variant="outline" onClick={() => { setEstabError(''); setShowEstab(true); }} className="border-gray-200 text-gray-600 hover:bg-gray-50 gap-1">
                  <Plus className="w-3.5 h-3.5" /> Novo
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                {isComercioWorkspace
                  ? 'Lojas, balcões e locais de operação. Todos assumem automaticamente o NIF da empresa.'
                  : 'Locais de emissão associados à faturação da conta.'}
              </p>
              <p className="text-xs text-slate-500">
                Ao criar o estabelecimento, o sistema gera automaticamente a série padrão inicial.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-[#0A2540]">Fluxo recomendado</p>
                <p className="mt-1 text-xs text-slate-600">
                  Cria o {isComercioWorkspace ? 'ponto de venda' : 'estabelecimento'}, deixa a série inicial ser criada automaticamente e começa logo a emitir. A gestão manual de séries fica reservada para casos mais avançados.
                </p>
              </div>
              {estabsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : estabsIsError ? (
                <ErrorState
                  compact
                  title={isComercioWorkspace ? 'Não foi possível carregar os pontos de venda' : 'Não foi possível carregar os estabelecimentos'}
                  message={(estabsQueryError as Error | undefined)?.message || 'Tente novamente para carregar a lista.'}
                  onRetry={() => refetchEstabs()}
                  secondaryAction={{ label: 'Criar novo', onClick: () => { setEstabError(''); setShowEstab(true); } }}
                />
              ) : estabs.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{isComercioWorkspace ? 'Ainda não existem pontos de venda' : 'Ainda não existem estabelecimentos'}</p>
                  <p className="text-xs mt-1">
                    {isComercioWorkspace
                      ? 'Crie o primeiro ponto de venda para começar a emitir.'
                      : 'Crie o primeiro estabelecimento para começar a emitir facturas.'}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => { setEstabError(''); setShowEstab(true); }} className="mt-3 border-gray-200 text-gray-600 hover:bg-gray-50 gap-1">
                    <Plus className="w-3.5 h-3.5" /> Criar primeiro
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(estabs as any[]).map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div>
                        <p className="text-[#0A2540] text-sm font-medium">{e.nome}</p>
                        <p className="text-gray-500 text-xs">
                          {isComercioWorkspace
                            ? e.morada || 'Usa o NIF da empresa'
                            : `NIF: ${e.nif}${e.morada ? ` · ${e.morada}` : ''}`}
                        </p>
                        {e.defaultSerie && (
                          <p className="mt-1 text-xs text-slate-500">
                            Série padrão: <span className="font-medium text-slate-700">{e.defaultSerie.seriesCode}/{e.defaultSerie.seriesYear}</span>
                          </p>
                        )}
                      </div>
                      {e.isPrincipal && <span className={`px-2 py-0.5 rounded-full text-xs border ${isComercioWorkspace ? 'bg-[#FDF2EA] text-[#B84D0E] border-[#FAC775]' : 'bg-[#EEF5FC] text-[#1A6FD4] border-[#B5D4F4]'}`}>{isComercioWorkspace ? 'Padrão' : 'Principal'}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    Gestão Avançada de Séries
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Usa esta área só quando precisares de séries adicionais, outros tipos de documento ou separação operacional mais fina.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50 gap-1.5">
                  <Link href="/produtos">
                    Abrir gestão
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Uso diário</p>
                  <p className="mt-2 text-sm text-slate-700">A emissão normal, recorrente e a venda rápida usam a série padrão do ponto de venda.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Quando abrir</p>
                  <p className="mt-2 text-sm text-slate-700">Quando precisares de uma série extra, outro tipo documental ou um fluxo separado.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Setup inicial</p>
                  <p className="mt-2 text-sm text-slate-700">Não é obrigatório passar por esta gestão avançada para começar a faturar.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── EQUIPA ──────────────────────────────────────────── */}
      {activeTab === 'equipa' && (
        <div className="space-y-4">
          {memberError && (
            <ErrorState
              compact
              title="Falha na gestão da equipa"
              message={memberError}
              onRetry={() => refetchTeam()}
              secondaryAction={{ label: 'Fechar', onClick: () => setMemberError('') }}
            />
          )}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0A2540]">Membros da Equipa</h2>
              <p className="text-gray-500 text-sm">Gerencie os membros da sua conta</p>
            </div>
            <Button onClick={() => { setMemberError(''); setShowAddMember(true); }} className="gap-1.5">
              <Plus className="w-4 h-4" /> Adicionar Membro
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Nome</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Email</th>
                    {isComercioWorkspace ? (
                      <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Ponto de venda</th>
                    ) : null}
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Páginas</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Último Login</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {(teamMembers as User[]).map(member => {
                    const hasRestrictions = member.permissions !== null && member.permissions !== undefined;
                    const pagesLabel = hasRestrictions ? 'Personalizado' : 'Acesso total';
                    return (
                    <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="py-3 px-4 text-gray-900 text-sm">{member.name}</td>
                      <td className="py-3 px-4 text-gray-500 text-sm">{member.email}</td>
                      {isComercioWorkspace ? (
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {member.assignedEstabelecimento?.nome || 'Sem atribuição'}
                        </td>
                      ) : null}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setPermMember(member)}
                          className="flex items-center gap-1 text-xs text-[#0A2540] hover:text-[#0A2540] transition"
                          title="Editar permissões"
                        >
                          <span className="font-mono">{pagesLabel}</span>
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${member.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {member.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">
                        {member.lastLogin ? new Date(member.lastLogin).toLocaleString('pt-PT') : 'Nunca'}
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => removeMember(member.id)} className="text-red-400 hover:text-red-600 transition" title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {(teamMembers as User[]).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhum membro na sua conta ainda.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {permMember && (
        <MemberPermissionsModal
          member={permMember}
          workspaceMode={currentUser?.workspaceMode}
          onClose={() => setPermMember(null)}
          onSaved={() => { refetchTeam(); setPermMember(null); }}
        />
      )}

      {/* ── DIALOGS ─────────────────────────────────────────── */}

      <Dialog open={showEstab} onOpenChange={(open) => { setShowEstab(open); if (!open) setEstabError(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isComercioWorkspace ? 'Novo Ponto de Venda' : 'Novo Estabelecimento'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {estabError && (
              <ErrorState
                compact
                title={isComercioWorkspace ? 'Não foi possível criar o ponto de venda' : 'Não foi possível criar o estabelecimento'}
                message={estabError}
                onRetry={() => estabMutation.mutate()}
                secondaryAction={{ label: 'Fechar', onClick: () => setEstabError('') }}
              />
            )}
            <div>
              <Label className="text-sm">Nome *</Label>
              <Input value={estabForm.nome} onChange={e => setEstabForm(p => ({ ...p, nome: e.target.value }))} placeholder={isComercioWorkspace ? 'Loja Central' : 'Sede'} className="mt-1" />
            </div>
            {isComercioWorkspace && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Este ponto de venda vai usar automaticamente o NIF da empresa definido na Configuração Fiscal.
              </p>
            )}
            <p className="text-xs text-slate-500">
              A série padrão será criada automaticamente com base no nome e/ou localização deste estabelecimento.
            </p>
            <div>
              <Label className="text-sm">Morada</Label>
              <Input value={estabForm.morada} onChange={e => setEstabForm(p => ({ ...p, morada: e.target.value }))} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPrincipal" checked={estabForm.isPrincipal} onChange={e => setEstabForm(p => ({ ...p, isPrincipal: e.target.checked }))} className="w-4 h-4 accent-[#0A2540]" />
              <label htmlFor="isPrincipal" className="text-sm cursor-pointer">{isComercioWorkspace ? 'Ponto de venda padrão' : 'Estabelecimento principal'}</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEstab(false)}>Cancelar</Button>
            <LoadingButton onClick={() => estabMutation.mutate()} disabled={estabMutation.isPending} loading={estabMutation.isPending} loadingLabel="A criar..." className={`text-white ${isComercioWorkspace ? 'bg-[#B84D0E] hover:bg-[#9a3d0a]' : 'bg-[#0A2540] hover:bg-[#0d3060]'}`}>
              Criar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAddMember && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Adicionar Membro</h2>
              {memberError && (
                <div className="mb-3">
                  <ErrorState
                    compact
                    title="Não foi possível adicionar o membro"
                    message={memberError}
                    onRetry={() => addMemberMutation.mutate()}
                    secondaryAction={{ label: 'Fechar', onClick: () => setMemberError('') }}
                  />
                </div>
              )}
              <form onSubmit={e => { e.preventDefault(); addMemberMutation.mutate(); }} className="space-y-4">
                <div>
                  <Label className="text-gray-600">Nome</Label>
                  <Input type="text" placeholder="Nome completo" value={memberForm.name} onChange={e => setMemberForm(p => ({ ...p, name: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Email</Label>
                  <Input type="email" placeholder="email@example.com" value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Password Inicial</Label>
                  <Input type="password" placeholder="Mínimo 6 caracteres" value={memberForm.password} onChange={e => setMemberForm(p => ({ ...p, password: e.target.value }))} required minLength={6} className="mt-1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddMember(false)} className="flex-1">Cancelar</Button>
                  <LoadingButton type="submit" disabled={addMemberMutation.isPending} loading={addMemberMutation.isPending} loadingLabel="A criar..." className={`flex-1 text-white ${isComercioWorkspace ? 'bg-[#B84D0E] hover:bg-[#9a3d0a]' : 'bg-[#0A2540] hover:bg-[#0d3060]'}`}>
                    Adicionar
                  </LoadingButton>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense>
      <ConfiguracoesContent />
    </Suspense>
  );
}
