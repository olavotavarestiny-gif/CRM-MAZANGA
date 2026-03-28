'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createClientAccount,
  createUser,
  deleteSuperAdminOrg,
  deleteUser,
  getClientAccounts,
  getCurrentUser,
  getLoginLogs,
  getSuperAdminOrgs,
  getSuperAdminStorage,
  getSuperAdminUsage,
  getUsers,
  impersonateUser,
  updateClientAccount,
  updateSuperAdminOrg,
  updateUser,
} from '@/lib/api';
import type {
  LoginLog,
  PlanName,
  SuperAdminOrg,
  SuperAdminStorageStat,
  SuperAdminUsageStat,
  User,
} from '@/lib/api';
import type { ClientAccount } from '@/lib/types';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  HardDrive,
  History,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';

const ADMIN_SECTIONS = [
  { id: 'users', label: 'Utilizadores', icon: Users },
  { id: 'accounts', label: 'Contas', icon: Building2 },
  { id: 'logins', label: 'Logins', icon: History },
] as const;

const SUPERADMIN_SECTIONS = [
  { id: 'organizations', label: 'Organizações', icon: ShieldCheck },
  { id: 'usage', label: 'Utilização', icon: BarChart3 },
  { id: 'storage', label: 'Armazenamento', icon: HardDrive },
] as const;

type SectionId =
  | (typeof ADMIN_SECTIONS)[number]['id']
  | (typeof SUPERADMIN_SECTIONS)[number]['id'];

export default function SuperAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const isSuperAdmin = !!currentUser?.isSuperAdmin;
  const hasAdminAccess = !!(isSuperAdmin || currentUser?.role === 'admin');

  const requestedSection = searchParams?.get('section');
  const allowedSections = useMemo(
    () => [
      ...ADMIN_SECTIONS.map((section) => section.id),
      ...(isSuperAdmin ? SUPERADMIN_SECTIONS.map((section) => section.id) : []),
    ],
    [isSuperAdmin]
  );

  const fallbackSection: SectionId = isSuperAdmin ? 'organizations' : 'users';
  const currentSection: SectionId =
    requestedSection && allowedSections.includes(requestedSection as SectionId)
      ? (requestedSection as SectionId)
      : fallbackSection;

  useEffect(() => {
    if (userLoading) return;
    if (!hasAdminAccess) {
      router.replace('/');
      return;
    }
    if (requestedSection !== currentSection) {
      router.replace(`${pathname}?section=${currentSection}`);
    }
  }, [currentSection, hasAdminAccess, pathname, requestedSection, router, userLoading]);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [userError, setUserError] = useState('');
  const [orgError, setOrgError] = useState('');
  const [createAccountForm, setCreateAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    plan: 'essencial' as PlanName,
  });
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    accountOwnerId: '',
  });

  const { data: users = [], isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: hasAdminAccess && currentSection === 'users',
  });

  const { data: accounts = [], isLoading: accountsLoading, isError: accountsError, refetch: refetchAccounts } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: getClientAccounts,
    enabled: hasAdminAccess && currentSection === 'accounts',
  });

  const { data: loginLogs = [], isLoading: loginLogsLoading, isError: loginLogsError, refetch: refetchLoginLogs } = useQuery({
    queryKey: ['admin-logins'],
    queryFn: getLoginLogs,
    enabled: hasAdminAccess && currentSection === 'logins',
  });

  const { data: orgs = [], isLoading: orgsLoading, isError: orgsError, refetch: refetchOrgs } = useQuery({
    queryKey: ['superadmin-orgs'],
    queryFn: getSuperAdminOrgs,
    enabled: isSuperAdmin && currentSection === 'organizations',
  });

  const { data: usage = [], isLoading: usageLoading, isError: usageError, refetch: refetchUsage } = useQuery({
    queryKey: ['superadmin-usage'],
    queryFn: getSuperAdminUsage,
    enabled: isSuperAdmin && currentSection === 'usage',
  });

  const { data: storage = [], isLoading: storageLoading, isError: storageError, refetch: refetchStorage } = useQuery({
    queryKey: ['superadmin-storage'],
    queryFn: getSuperAdminStorage,
    enabled: isSuperAdmin && currentSection === 'storage',
  });

  const createUserMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: createUserForm.name,
        email: createUserForm.email,
        password: createUserForm.password,
        role: createUserForm.role,
      };
      if (createUserForm.accountOwnerId) {
        payload.accountOwnerId = createUserForm.accountOwnerId;
      }
      return createUser(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateUser(false);
      setCreateUserForm({ name: '', email: '', password: '', role: 'user', accountOwnerId: '' });
      setUserError('');
      toast({
        variant: 'success',
        title: 'Utilizador criado',
        description: 'O novo utilizador já está disponível na administração.',
      });
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao criar utilizador';
      setUserError(message);
      toast({
        variant: 'error',
        title: 'Falha ao criar utilizador',
        description: message,
      });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: createClientAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-accounts'] });
      qc.invalidateQueries({ queryKey: ['superadmin-orgs'] });
      setShowCreateAccount(false);
      setCreateAccountForm({ name: '', email: '', password: '', plan: 'essencial' });
      setAccountError('');
      toast({
        variant: 'success',
        title: 'Conta criada',
        description: 'A nova conta cliente foi criada com sucesso.',
      });
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao criar conta';
      setAccountError(message);
      toast({
        variant: 'error',
        title: 'Falha ao criar conta',
        description: message,
      });
    },
  });

  const orgUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateSuperAdminOrg>[1] }) =>
      updateSuperAdminOrg(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-orgs'] });
      qc.invalidateQueries({ queryKey: ['admin-accounts'] });
      setOrgError('');
      toast({
        variant: 'success',
        title: 'Organização atualizada',
        description: 'As alterações foram aplicadas.',
      });
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao atualizar organização';
      setOrgError(message);
      toast({
        variant: 'error',
        title: 'Falha ao atualizar organização',
        description: message,
      });
    },
  });

  const orgDeleteMutation = useMutation({
    mutationFn: deleteSuperAdminOrg,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-orgs'] });
      qc.invalidateQueries({ queryKey: ['admin-accounts'] });
      qc.invalidateQueries({ queryKey: ['superadmin-usage'] });
      qc.invalidateQueries({ queryKey: ['superadmin-storage'] });
      setOrgError('');
      toast({
        variant: 'success',
        title: 'Organização eliminada',
        description: 'A organização foi removida com sucesso.',
      });
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao eliminar organização';
      setOrgError(message);
      toast({
        variant: 'error',
        title: 'Falha ao eliminar organização',
        description: message,
      });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: impersonateUser,
    onSuccess: ({ token }) => {
      localStorage.setItem('impersonation_token', token);
      window.location.href = '/';
    },
    onError: (err: Error) => {
      const message = err.message || 'Erro ao entrar como utilizador';
      setOrgError(message);
      toast({
        variant: 'error',
        title: 'Falha na impersonação',
        description: message,
      });
    },
  });

  const goToSection = (section: SectionId) => {
    router.replace(`${pathname}?section=${section}`);
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredOrgs = useMemo(
    () =>
      orgs.filter(
        (org) =>
          org.name.toLowerCase().includes(search.toLowerCase()) ||
          org.email.toLowerCase().includes(search.toLowerCase()) ||
          (org.accountMembers || []).some(
            (member) =>
              member.name.toLowerCase().includes(search.toLowerCase()) ||
              member.email.toLowerCase().includes(search.toLowerCase())
          )
      ),
    [orgs, search]
  );

  const totalUsers = orgs.reduce((sum, org) => sum + 1 + (org._count?.accountMembers ?? 0), 0);

  const currentSectionError =
    currentSection === 'users' ? usersError :
    currentSection === 'accounts' ? accountsError :
    currentSection === 'logins' ? loginLogsError :
    currentSection === 'organizations' ? orgsError :
    currentSection === 'usage' ? usageError :
    currentSection === 'storage' ? storageError :
    false;

  const retryCurrentSection = () => {
    if (currentSection === 'users') {
      refetchUsers();
      return;
    }
    if (currentSection === 'accounts') {
      refetchAccounts();
      return;
    }
    if (currentSection === 'logins') {
      refetchLoginLogs();
      return;
    }
    if (currentSection === 'organizations') {
      refetchOrgs();
      return;
    }
    if (currentSection === 'usage') {
      refetchUsage();
      return;
    }
    if (currentSection === 'storage') {
      refetchStorage();
    }
  };

  if (userLoading || !currentUser) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-2">
          <div className="h-10 w-72 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-4 w-[32rem] animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-10 w-32 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="h-[28rem] animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  if (!hasAdminAccess) {
    return null;
  }

  const sectionTitle = isSuperAdmin ? 'Administração da Plataforma' : 'Administração';
  const sectionDescription = isSuperAdmin
    ? 'Superfície canónica para utilizadores, contas, organizações, utilização e impersonation.'
    : 'Superfície canónica para utilizadores, contas e histórico de logins.';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
            <Shield className="h-5 w-5 text-[#0A2540]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">{sectionTitle}</h1>
            <p className="mt-1 text-sm text-[#6b7e9a]">{sectionDescription}</p>
          </div>
        </div>

        {isSuperAdmin && (currentSection === 'organizations' || currentSection === 'accounts') && (
          <Button onClick={() => setShowCreateAccount(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Conta
          </Button>
        )}

        {currentSection === 'users' && (
          <Button onClick={() => setShowCreateUser(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Utilizador
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => goToSection(id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  currentSection === id
                    ? 'bg-[#0A2540] text-white'
                    : 'bg-slate-50 text-[#516173] hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {isSuperAdmin && (
            <>
              <div className="my-4 border-t border-slate-100" />
              <div className="flex flex-wrap gap-2">
                {SUPERADMIN_SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => goToSection(id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      currentSection === id
                        ? 'bg-[#0A2540] text-white'
                        : 'bg-slate-50 text-[#516173] hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {currentSectionError && (
          <ErrorState
            title="Não foi possível carregar esta área"
            message="Os dados desta secção não responderam como esperado."
            onRetry={retryCurrentSection}
            secondaryAction={{ label: 'Ir para Painel', href: '/' }}
          />
        )}

        {currentSection === 'users' && !currentSectionError && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              {usersLoading ? (
                <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  A carregar utilizadores...
                </div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nome</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Função</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Conta</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Último Login</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded px-2 py-1 text-xs font-medium ${user.role === 'admin' ? 'bg-red-50 text-[#0A2540]' : 'bg-zinc-500/20 text-gray-600'}`}>
                              {user.role === 'admin' ? 'Admin' : 'Utilizador'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {user.accountOwnerId ? user.accountOwnerName || 'Membro' : <span className="text-gray-400">Independente</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={async () => {
                                try {
                                  await updateUser(user.id, { active: !user.active });
                                  qc.invalidateQueries({ queryKey: ['admin-users'] });
                                  toast({
                                    variant: 'success',
                                    title: 'Utilizador atualizado',
                                    description: 'O estado do utilizador foi alterado.',
                                  });
                                } catch (err: any) {
                                  const message = err.message || 'Erro ao atualizar utilizador';
                                  setUserError(message);
                                  toast({
                                    variant: 'error',
                                    title: 'Falha ao atualizar utilizador',
                                    description: message,
                                  });
                                }
                              }}
                              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                                user.active
                                  ? 'bg-green-50 text-green-700 hover:bg-green-500/30'
                                  : 'bg-red-50 text-red-600 hover:bg-red-500/30'
                              }`}
                            >
                              {user.active ? <><Eye className="h-3 w-3" /> Ativo</> : <><EyeOff className="h-3 w-3" /> Inativo</>}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-PT') : 'Nunca'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={async () => {
                                if (!confirm('Tem a certeza que quer eliminar este utilizador?')) return;
                                try {
                                  await deleteUser(user.id);
                                  qc.invalidateQueries({ queryKey: ['admin-users'] });
                                  toast({
                                    variant: 'success',
                                    title: 'Utilizador eliminado',
                                    description: 'O utilizador foi removido com sucesso.',
                                  });
                                } catch (err: any) {
                                  const message = err.message || 'Erro ao eliminar utilizador';
                                  setUserError(message);
                                  toast({
                                    variant: 'error',
                                    title: 'Falha ao eliminar utilizador',
                                    description: message,
                                  });
                                }
                              }}
                              className="text-red-400 hover:text-red-600 transition"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-400">Nenhum utilizador encontrado.</div>
                  )}
                </>
              )}
            </div>
          </Card>
        )}

        {currentSection === 'accounts' && !currentSectionError && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              {accountsLoading ? (
                <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  A carregar contas...
                </div>
              ) : (
                <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nome</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Plano</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Membros</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {(accounts as ClientAccount[]).map((account) => (
                    <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{account.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={account.plan}
                          onChange={async (event) => {
                            try {
                              await updateClientAccount(account.id, { plan: event.target.value as PlanName });
                              qc.invalidateQueries({ queryKey: ['admin-accounts'] });
                              qc.invalidateQueries({ queryKey: ['superadmin-orgs'] });
                              toast({
                                variant: 'success',
                                title: 'Plano atualizado',
                                description: 'O plano da conta foi alterado.',
                              });
                            } catch (err: any) {
                              const message = err.message || 'Erro ao atualizar conta';
                              setAccountError(message);
                              toast({
                                variant: 'error',
                                title: 'Falha ao atualizar conta',
                                description: message,
                              });
                            }
                          }}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-[#0A2540]"
                        >
                          <option value="essencial">Essencial</option>
                          <option value="profissional">Profissional</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {account._count.accountMembers} membro{account._count.accountMembers !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(account.createdAt).toLocaleDateString('pt-PT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {accounts.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Nenhuma conta de cliente criada ainda.</div>
              )}
                </>
              )}
            </div>
          </Card>
        )}

        {currentSection === 'logins' && !currentSectionError && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              {loginLogsLoading ? (
                <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  A carregar histórico...
                </div>
              ) : (
                <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Utilizador</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Data/Hora</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(loginLogs as LoginLog[]).map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-900">{log.user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{log.user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(log.createdAt).toLocaleString('pt-PT')}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.ip || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loginLogs.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Sem registos de login.</div>
              )}
                </>
              )}
            </div>
          </Card>
        )}

        {currentSection === 'organizations' && isSuperAdmin && !currentSectionError && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#0A2540]">Organizações</h2>
                  <p className="text-sm text-[#6b7e9a]">
                    {orgs.length} organizações · {totalUsers} utilizadores no total
                  </p>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7e9a]" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Pesquisar organizações ou utilizadores..."
                    className="pl-9"
                  />
                </div>
              </div>

              {orgError && (
                <div className="mb-4">
                  <ErrorState
                    compact
                    title="Não foi possível concluir a ação"
                    message={orgError}
                    onRetry={retryCurrentSection}
                    secondaryAction={{ label: 'Fechar', onClick: () => setOrgError('') }}
                  />
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-[#dde3ec]">
                {orgsLoading ? (
                  <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    A carregar...
                  </div>
                ) : filteredOrgs.length === 0 ? (
                  <div className="py-16 text-center text-[#6b7e9a]">Nenhuma organização encontrada</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#dde3ec] bg-[#f8fafc]">
                        <th className="w-8 px-4 py-3 text-left font-semibold text-[#0A2540]" />
                        <th className="px-4 py-3 text-left font-semibold text-[#0A2540]">Organização / Utilizador</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#0A2540]">Plano</th>
                        <th className="px-4 py-3 text-center font-semibold text-[#0A2540]">Membros</th>
                        <th className="px-4 py-3 text-center font-semibold text-[#0A2540]">Estado</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#0A2540]">Criado</th>
                        <th className="px-4 py-3 text-center font-semibold text-[#0A2540]">Acções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrgs.map((org) => {
                        const members = org.accountMembers || [];
                        const isOpen = expanded.has(org.id);
                        return (
                          <Fragment key={org.id}>
                            <tr
                              className="cursor-pointer border-b border-[#dde3ec] transition-colors hover:bg-[#f8fafc]"
                              onClick={() => members.length > 0 && toggleExpand(org.id)}
                            >
                              <td className="px-4 py-3 text-[#6b7e9a]">
                                {members.length > 0 ? (
                                  isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-[#0A2540]">{org.name}</div>
                                <div className="text-xs text-[#6b7e9a]">{org.email}</div>
                              </td>
                              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                                <div className="relative inline-block">
                                  <select
                                    value={org.plan || 'essencial'}
                                    onChange={(event) =>
                                      orgUpdateMutation.mutate({ id: org.id, data: { plan: event.target.value as PlanName } })
                                    }
                                    className="appearance-none rounded-lg border border-[#dde3ec] bg-white py-1 pl-2 pr-6 text-xs font-medium text-[#0A2540] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="essencial">Essencial</option>
                                    <option value="profissional">Profissional</option>
                                    <option value="enterprise">Enterprise</option>
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6b7e9a]" />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-[#6b7e9a]">
                                  <Users className="h-3.5 w-3.5" />
                                  <span>{org._count.accountMembers}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                                <button
                                  onClick={() => orgUpdateMutation.mutate({ id: org.id, data: { active: !org.active } })}
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
                                    org.active
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                                  }`}
                                >
                                  {org.active ? 'Activo' : 'Inactivo'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-xs text-[#6b7e9a]">
                                {new Date(org.createdAt).toLocaleDateString('pt-PT')}
                              </td>
                              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => impersonateMutation.mutate(org.id)}
                                    disabled={impersonateMutation.isPending}
                                    title="Entrar como este utilizador"
                                    className="rounded-lg p-1.5 text-[#6b7e9a] transition-colors hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!confirm(`Apagar organização "${org.name}" e todos os seus dados? Esta ação é irreversível.`)) return;
                                      orgDeleteMutation.mutate(org.id);
                                    }}
                                    disabled={orgDeleteMutation.isPending}
                                    title="Apagar organização"
                                    className="rounded-lg p-1.5 text-[#6b7e9a] transition-colors hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isOpen &&
                              members.map((member) => (
                                <tr key={`member-${member.id}`} className="border-b border-[#dde3ec] bg-[#f8fafc] last:border-0">
                                  <td className="px-4 py-2" />
                                  <td className="px-4 py-2 pl-8">
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="h-3.5 w-3.5 shrink-0 text-[#6b7e9a]" />
                                      <div>
                                        <div className="text-sm text-[#0A2540]">{member.name}</div>
                                        <div className="text-xs text-[#6b7e9a]">{member.email}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-[#6b7e9a]">Membro</td>
                                  <td className="px-4 py-2" />
                                  <td className="px-4 py-2 text-center">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      member.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                    }`}>
                                      {member.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2" />
                                  <td className="px-4 py-2 text-center">
                                    <button
                                      onClick={() => impersonateMutation.mutate(member.id)}
                                      disabled={impersonateMutation.isPending}
                                      title="Entrar como este utilizador"
                                      className="rounded-lg p-1.5 text-[#6b7e9a] transition-colors hover:bg-blue-50 hover:text-blue-600"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {currentSection === 'usage' && isSuperAdmin && !currentSectionError && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              {usageLoading ? (
                <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  A carregar utilização...
                </div>
              ) : (
                <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Conta</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Logins (7d)</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Logins (30d)</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Último Acesso</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Atividade (7d)</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage as SuperAdminUsageStat[]).map((stat) => (
                    <tr key={stat.orgId} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.orgName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{stat.logins7d}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{stat.logins30d}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {stat.lastLogin ? new Date(stat.lastLogin).toLocaleString('pt-PT') : <span className="text-gray-300">Nunca</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex h-6 items-end gap-0.5">
                          {stat.sparkline.map((day) => {
                            const max = Math.max(...stat.sparkline.map((entry) => entry.count), 1);
                            const pct = Math.round((day.count / max) * 100);
                            return (
                              <div
                                key={day.date}
                                title={`${day.date}: ${day.count}`}
                                style={{ height: `${Math.max(pct, 8)}%` }}
                                className={`w-3 flex-shrink-0 rounded-sm ${day.count > 0 ? 'bg-[#0A2540]' : 'bg-gray-100'}`}
                              />
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usage.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Sem dados de utilização.</div>
              )}
                </>
              )}
            </div>
          </Card>
        )}

        {currentSection === 'storage' && isSuperAdmin && !currentSectionError && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              {storageLoading ? (
                <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  A carregar armazenamento...
                </div>
              ) : (
                <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Conta</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Clientes</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tarefas</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Transações</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Notas</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Ficheiros</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Armazenamento</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {(storage as SuperAdminStorageStat[]).map((stat) => {
                    const totalRecords = stat.contacts + stat.tasks + stat.transactions + stat.notes;
                    const storageMb = (stat.fileSizeBytes / (1024 * 1024)).toFixed(1);
                    const barPct = Math.min((stat.fileSizeBytes / (100 * 1024 * 1024)) * 100, 100);
                    return (
                      <tr key={stat.orgId} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.orgName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.contacts}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.tasks}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.transactions}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.notes}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.fileCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{storageMb} MB</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-[#0A2540]" style={{ width: `${barPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{totalRecords} reg.</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {storage.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Sem dados de armazenamento.</div>
              )}
                </>
              )}
            </div>
          </Card>
        )}
      </div>

      <Dialog open={showCreateAccount} onOpenChange={(open) => { setShowCreateAccount(open); if (!open) setAccountError(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {accountError && (
              <ErrorState
                compact
                title="Não foi possível criar a conta"
                message={accountError}
                onRetry={() => createAccountMutation.mutate(createAccountForm)}
                secondaryAction={{ label: 'Fechar', onClick: () => setAccountError('') }}
              />
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Nome</label>
              <Input
                value={createAccountForm.name}
                onChange={(event) => setCreateAccountForm({ ...createAccountForm, name: event.target.value })}
                placeholder="Nome da empresa ou pessoa"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Email</label>
              <Input
                type="email"
                value={createAccountForm.email}
                onChange={(event) => setCreateAccountForm({ ...createAccountForm, email: event.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Password inicial</label>
              <Input
                type="password"
                value={createAccountForm.password}
                onChange={(event) => setCreateAccountForm({ ...createAccountForm, password: event.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Plano</label>
              <select
                value={createAccountForm.plan}
                onChange={(event) => setCreateAccountForm({ ...createAccountForm, plan: event.target.value as PlanName })}
                className="w-full rounded-lg border border-[#dde3ec] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="essencial">Essencial</option>
                <option value="profissional">Profissional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccount(false)}>Cancelar</Button>
            <LoadingButton
              onClick={() => createAccountMutation.mutate(createAccountForm)}
              disabled={
                createAccountMutation.isPending ||
                !createAccountForm.name ||
                !createAccountForm.email ||
                !createAccountForm.password
              }
              loading={createAccountMutation.isPending}
              loadingLabel="A criar..."
            >
              Criar Conta
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateUser} onOpenChange={(open) => { setShowCreateUser(open); if (!open) setUserError(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Utilizador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {userError && (
              <ErrorState
                compact
                title="Não foi possível criar o utilizador"
                message={userError}
                onRetry={() => createUserMutation.mutate()}
                secondaryAction={{ label: 'Fechar', onClick: () => setUserError('') }}
              />
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Nome</label>
              <Input
                value={createUserForm.name}
                onChange={(event) => setCreateUserForm({ ...createUserForm, name: event.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Email</label>
              <Input
                type="email"
                value={createUserForm.email}
                onChange={(event) => setCreateUserForm({ ...createUserForm, email: event.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Password</label>
              <Input
                type="password"
                value={createUserForm.password}
                onChange={(event) => setCreateUserForm({ ...createUserForm, password: event.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A2540]">Role</label>
              <select
                value={createUserForm.role}
                onChange={(event) => setCreateUserForm({ ...createUserForm, role: event.target.value })}
                className="w-full rounded-lg border border-[#dde3ec] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="user">Utilizador</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
            {isSuperAdmin && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A2540]">Atribuir a Conta (Opcional)</label>
                <select
                  value={createUserForm.accountOwnerId}
                  onChange={(event) => setCreateUserForm({ ...createUserForm, accountOwnerId: event.target.value })}
                  className="w-full rounded-lg border border-[#dde3ec] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nenhuma (Independente)</option>
                  {users
                    .filter((user) => !user.accountOwnerId && user.role !== 'admin')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>Cancelar</Button>
            <LoadingButton
              onClick={() => createUserMutation.mutate()}
              disabled={
                createUserMutation.isPending ||
                !createUserForm.name ||
                !createUserForm.email ||
                !createUserForm.password
              }
              loading={createUserMutation.isPending}
              loadingLabel="A criar..."
            >
              Criar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
