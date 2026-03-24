'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  CheckCircle2, Plus, Building2, Settings, User as UserIcon,
  Users, Shield, Eye, EyeOff, Trash2, Pencil,
} from 'lucide-react';
import {
  getFaturacaoConfig, updateFaturacaoConfig, getEstabelecimentos, createEstabelecimento,
  getCurrentUser, changePassword,
  getTeamMembers, addTeamMember, removeTeamMember,
  getUsers, createUser, updateUser, deleteUser, getLoginLogs,
  getClientAccounts, updateClientAccount, createClientAccount,
} from '@/lib/api';
import type { User, LoginLog } from '@/lib/api';
import type { IBANEntry, ClientAccount } from '@/lib/types';
import MemberPermissionsModal from '@/components/configuracoes/member-permissions-modal';

function ConfiguracoesContent() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  type TabId = 'perfil' | 'empresa' | 'equipa' | 'admin';
  const [activeTab, setActiveTab] = useState<TabId>(
    (searchParams?.get('tab') as TabId) || 'perfil'
  );

  // ── Current User ─────────────────────────────────────────
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const isOwner = currentUser && !currentUser.accountOwnerId;
  const isAdmin = currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.email === 'olavo@mazanga.digital';

  // ── Perfil ───────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.new !== pwForm.confirm) { setPwError('As passwords não correspondem'); return; }
    if (pwForm.new.length < 6) { setPwError('A password deve ter pelo menos 6 caracteres'); return; }
    setPwSubmitting(true);
    try {
      await changePassword(pwForm.new);
      setPwSuccess('Password alterada com sucesso!');
      setPwForm({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.message || 'Erro ao alterar a password. Tente novamente.');
    } finally {
      setPwSubmitting(false);
    }
  };

  // ── Empresa & AGT ────────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    nifEmpresa: '', nomeEmpresa: '', moradaEmpresa: '', agtCertNumber: '', agtMockMode: true,
  });
  const [ibans, setIbans] = useState<IBANEntry[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState('');
  const [showEstab, setShowEstab] = useState(false);
  const [estabForm, setEstabForm] = useState({ nome: '', nif: '', morada: '', telefone: '', email: '', isPrincipal: false });

  const { data: config } = useQuery({
    queryKey: ['faturacao-config'],
    queryFn: getFaturacaoConfig,
    enabled: activeTab === 'empresa' && !!isOwner,
  });

  const { data: estabs = [] } = useQuery({
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
      setTimeout(() => setConfigSaved(false), 2500);
    },
    onError: (err: Error) => {
      setConfigError(err.message || 'Erro ao guardar as configurações. Tente novamente.');
    },
  });

  const estabMutation = useMutation({
    mutationFn: () => createEstabelecimento(estabForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estabelecimentos'] });
      setShowEstab(false);
      setEstabForm({ nome: '', nif: '', morada: '', telefone: '', email: '', isPrincipal: false });
    },
  });

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
      refetchTeam();
      setShowAddMember(false);
      setMemberForm({ name: '', email: '', password: '' });
      setMemberError('');
    },
    onError: (err: any) => setMemberError(err.response?.data?.error || 'Erro ao adicionar membro'),
  });

  const removeMember = async (memberId: number) => {
    if (!confirm('Tem a certeza que quer remover este membro?')) return;
    try {
      await removeTeamMember(memberId);
      refetchTeam();
    } catch (err: any) {
      setMemberError(err.response?.data?.error || 'Erro ao remover membro');
    }
  };

  // ── Equipa: member permissions modal ──────────────────────
  const [permMember, setPermMember] = useState<User | null>(null);

  // ── Admin ────────────────────────────────────────────────
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'accounts' | 'logins'>('users');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user', accountOwnerId: '' });
  const [userError, setUserError] = useState('');

  const { data: allUsers = [], refetch: refetchUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: getUsers,
    enabled: activeTab === 'admin' && !!isAdmin,
  });

  const { data: loginLogs = [] } = useQuery({
    queryKey: ['login-logs'],
    queryFn: getLoginLogs,
    enabled: activeTab === 'admin' && !!isAdmin && adminSubTab === 'logins',
  });

  const { data: clientAccounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: ['client-accounts'],
    queryFn: getClientAccounts,
    enabled: activeTab === 'admin' && !!isAdmin && adminSubTab === 'accounts',
  });

  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', email: '', password: '', plan: 'essencial' });
  const [accountError, setAccountError] = useState('');

  const createAccountMutation = useMutation({
    mutationFn: () => createClientAccount({ ...accountForm }),
    onSuccess: () => {
      refetchAccounts();
      setShowCreateAccount(false);
      setAccountForm({ name: '', email: '', password: '', plan: 'essencial' });
      setAccountError('');
    },
    onError: (err: any) => setAccountError(err.response?.data?.error || 'Erro ao criar conta'),
  });

  const updateAccountPlan = async (accountId: number, plan: string) => {
    try {
      await updateClientAccount(accountId, { plan });
      refetchAccounts();
    } catch { /* ignore */ }
  };

  const createUserMutation = useMutation({
    mutationFn: () => {
      const data: any = { name: userForm.name, email: userForm.email, password: userForm.password };
      if (userForm.role) data.role = userForm.role;
      if (userForm.accountOwnerId) data.accountOwnerId = userForm.accountOwnerId;
      return createUser(data);
    },
    onSuccess: () => {
      refetchUsers();
      setShowCreateUser(false);
      setUserForm({ name: '', email: '', password: '', role: 'user', accountOwnerId: '' });
      setUserError('');
    },
    onError: (err: any) => setUserError(err.response?.data?.error || 'Erro ao criar utilizador'),
  });

  const toggleUserActive = async (userId: number, currentActive: boolean) => {
    try {
      await updateUser(userId, { active: !currentActive });
      refetchUsers();
    } catch (err: any) {
      setUserError(err.response?.data?.error || 'Erro ao atualizar utilizador');
    }
  };

  const deleteUserAccount = async (userId: number) => {
    if (!confirm('Tem a certeza que quer eliminar este utilizador?')) return;
    try {
      await deleteUser(userId);
      refetchUsers();
    } catch (err: any) {
      setUserError(err.response?.data?.error || 'Erro ao eliminar utilizador');
    }
  };

  // ── Tab config ───────────────────────────────────────────
  const tabs = [
    { id: 'perfil' as TabId, label: 'Perfil', icon: UserIcon, show: true },
    { id: 'empresa' as TabId, label: 'Empresa & AGT', icon: Building2, show: !!isOwner },
    { id: 'equipa' as TabId, label: 'Equipa', icon: Users, show: !!isOwner },
    { id: 'admin' as TabId, label: 'Admin', icon: Shield, show: !!isAdmin },
  ].filter(t => t.show);

  const tabBtn = (id: TabId) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
      activeTab === id
        ? 'text-[#0A2540] border-[#0A2540]'
        : 'text-gray-500 border-transparent hover:text-[#0A2540]'
    }`;

  const subTabBtn = (id: string, current: string) =>
    `pb-2 px-1 text-sm font-medium transition border-b-2 -mb-px ${
      current === id ? 'text-[#0A2540] border-[#0A2540]' : 'text-gray-500 border-transparent hover:text-[#0A2540]'
    }`;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A2540]">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Perfil, empresa, equipa e administração</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={tabBtn(id)}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PERFIL ──────────────────────────────────────────── */}
      {activeTab === 'perfil' && (
        <div className="space-y-4 max-w-lg">
          <Card>
            <div className="p-6 space-y-3">
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
              {currentUser?.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <Shield className="w-3 h-3" /> Administrador
                </span>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#0A2540]">Alterar Password</h2>
              {pwError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{pwError}</div>}
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
                <Button type="submit" disabled={pwSubmitting} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                  {pwSubmitting ? 'A alterar...' : 'Alterar Password'}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* ── EMPRESA & AGT ───────────────────────────────────── */}
      {activeTab === 'empresa' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                Dados da Empresa & AGT
              </h2>
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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {configError}
                </div>
              )}
              <Button onClick={() => { setConfigError(''); saveMutation.mutate(); }} disabled={saveMutation.isPending} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                {configSaved ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Guardado!</> : saveMutation.isPending ? 'A guardar...' : 'Guardar Configurações'}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0A2540] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  Estabelecimentos
                </h2>
                <Button size="sm" variant="outline" onClick={() => setShowEstab(true)} className="border-gray-200 text-gray-600 hover:bg-gray-50 gap-1">
                  <Plus className="w-3.5 h-3.5" /> Novo
                </Button>
              </div>
              {estabs.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum estabelecimento criado</p>
                  <p className="text-xs mt-1">Crie pelo menos um para poder emitir facturas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(estabs as any[]).map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div>
                        <p className="text-[#0A2540] text-sm font-medium">{e.nome}</p>
                        <p className="text-gray-500 text-xs">NIF: {e.nif}{e.morada ? ` · ${e.morada}` : ''}</p>
                      </div>
                      {e.isPrincipal && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">Principal</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── EQUIPA ──────────────────────────────────────────── */}
      {activeTab === 'equipa' && (
        <div className="space-y-4">
          {memberError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{memberError}</div>}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0A2540]">Membros da Equipa</h2>
              <p className="text-gray-500 text-sm">Gerencie os membros da sua conta</p>
            </div>
            <Button onClick={() => setShowAddMember(true)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 gap-1.5">
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
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setPermMember(member)}
                          className="flex items-center gap-1 text-xs text-[#0A2540] hover:text-blue-600 transition"
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
          onClose={() => setPermMember(null)}
          onSaved={() => { refetchTeam(); setPermMember(null); }}
        />
      )}

      {/* ── ADMIN ───────────────────────────────────────────── */}
      {activeTab === 'admin' && (
        <div className="space-y-4">
          {userError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{userError}</div>}

          <div className="flex gap-4 border-b border-gray-200">
            <button onClick={() => setAdminSubTab('users')} className={subTabBtn('users', adminSubTab)}>
              Utilizadores ({(allUsers as User[]).length})
            </button>
            <button onClick={() => setAdminSubTab('accounts')} className={subTabBtn('accounts', adminSubTab)}>
              Contas
            </button>
            <button onClick={() => setAdminSubTab('logins')} className={subTabBtn('logins', adminSubTab)}>
              Histórico de Logins
            </button>
          </div>

          {adminSubTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowCreateUser(true)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 gap-1.5">
                  <Plus className="w-4 h-4" /> Novo Utilizador
                </Button>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Nome</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Email</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Função</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Conta</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Estado</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Último Login</th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {(allUsers as User[]).map(user => (
                        <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-3 px-4 text-gray-900 text-sm">{user.name}</td>
                          <td className="py-3 px-4 text-gray-500 text-sm">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-red-50 text-[#0A2540]' : 'bg-zinc-500/20 text-gray-600'}`}>
                              {user.role === 'admin' ? 'Admin' : 'Utilizador'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {user.accountOwnerId ? (user.accountOwnerName || 'Membro') : <span className="text-gray-400">Independente</span>}
                          </td>
                          <td className="py-3 px-4">
                            <button onClick={() => toggleUserActive(user.id, user.active)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${user.active ? 'bg-green-50 text-green-700 hover:bg-green-500/30' : 'bg-red-50 text-red-600 hover:bg-red-500/30'}`}>
                              {user.active ? <><Eye className="w-3 h-3" /> Ativo</> : <><EyeOff className="w-3 h-3" /> Inativo</>}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-PT') : 'Nunca'}
                          </td>
                          <td className="py-3 px-4">
                            <button onClick={() => deleteUserAccount(user.id)} className="text-red-400 hover:text-red-600 transition" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {adminSubTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowCreateAccount(true)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 gap-1.5">
                  <Plus className="w-4 h-4" /> Nova Conta
                </Button>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Nome</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Email</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Plano</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Membros</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Criado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clientAccounts as ClientAccount[]).map(account => (
                        <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-3 px-4 text-gray-900 text-sm font-medium">{account.name}</td>
                          <td className="py-3 px-4 text-gray-500 text-sm">{account.email}</td>
                          <td className="py-3 px-4">
                            <select
                              value={account.plan}
                              onChange={e => updateAccountPlan(account.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-[#0A2540]"
                            >
                              <option value="essencial">Essencial</option>
                              <option value="profissional">Profissional</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {account._count.accountMembers} membro{account._count.accountMembers !== 1 ? 's' : ''}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {new Date(account.createdAt).toLocaleDateString('pt-PT')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(clientAccounts as ClientAccount[]).length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">Nenhuma conta de cliente criada ainda.</div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {adminSubTab === 'logins' && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Utilizador</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Email</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Data/Hora</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loginLogs as LoginLog[]).map(log => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-3 px-4 text-gray-900 text-sm">{log.user.name}</td>
                        <td className="py-3 px-4 text-gray-500 text-sm">{log.user.email}</td>
                        <td className="py-3 px-4 text-gray-500 text-sm">{new Date(log.createdAt).toLocaleString('pt-PT')}</td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-xs">{log.ip || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── DIALOGS ─────────────────────────────────────────── */}

      <Dialog open={showEstab} onOpenChange={setShowEstab}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Estabelecimento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Nome *</Label>
                <Input value={estabForm.nome} onChange={e => setEstabForm(p => ({ ...p, nome: e.target.value }))} placeholder="Sede" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">NIF *</Label>
                <Input value={estabForm.nif} onChange={e => setEstabForm(p => ({ ...p, nif: e.target.value }))} placeholder="NIF do estabelecimento" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Morada</Label>
              <Input value={estabForm.morada} onChange={e => setEstabForm(p => ({ ...p, morada: e.target.value }))} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPrincipal" checked={estabForm.isPrincipal} onChange={e => setEstabForm(p => ({ ...p, isPrincipal: e.target.checked }))} className="w-4 h-4 accent-[#0A2540]" />
              <label htmlFor="isPrincipal" className="text-sm cursor-pointer">Estabelecimento principal</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEstab(false)}>Cancelar</Button>
            <Button onClick={() => estabMutation.mutate()} disabled={estabMutation.isPending} className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
              {estabMutation.isPending ? 'A criar...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAddMember && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Adicionar Membro</h2>
              {memberError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{memberError}</div>}
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
                  <Button type="submit" disabled={addMemberMutation.isPending} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                    {addMemberMutation.isPending ? 'A criar...' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {showCreateAccount && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Nova Conta Cliente</h2>
              {accountError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{accountError}</div>}
              <form onSubmit={e => { e.preventDefault(); createAccountMutation.mutate(); }} className="space-y-4">
                <div>
                  <Label className="text-gray-600">Nome</Label>
                  <Input type="text" placeholder="Nome da empresa ou pessoa" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Email</Label>
                  <Input type="email" placeholder="email@example.com" value={accountForm.email} onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Password Inicial</Label>
                  <Input type="password" placeholder="Mínimo 6 caracteres" value={accountForm.password} onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} required minLength={6} className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Plano</Label>
                  <select value={accountForm.plan} onChange={e => setAccountForm(p => ({ ...p, plan: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]">
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateAccount(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" disabled={createAccountMutation.isPending} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                    {createAccountMutation.isPending ? 'A criar...' : 'Criar Conta'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {showCreateUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Novo Utilizador</h2>
              {userError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{userError}</div>}
              <form onSubmit={e => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-4">
                <div>
                  <Label className="text-gray-600">Nome</Label>
                  <Input type="text" placeholder="Nome completo" value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Email</Label>
                  <Input type="email" placeholder="email@example.com" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Password</Label>
                  <Input type="password" placeholder="Mínimo 6 caracteres" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} required minLength={6} className="mt-1" />
                </div>
                <div>
                  <Label className="text-gray-600">Role</Label>
                  <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]">
                    <option value="user">Utilizador</option>
                    {isSuperAdmin && <option value="admin">Admin</option>}
                  </select>
                </div>
                {isSuperAdmin && (
                  <div>
                    <Label className="text-gray-600">Atribuir a Conta (Opcional)</Label>
                    <select value={userForm.accountOwnerId} onChange={e => setUserForm(p => ({ ...p, accountOwnerId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]">
                      <option value="">Nenhuma (Independente)</option>
                      {(allUsers as User[]).filter(u => !u.accountOwnerId && u.role !== 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateUser(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" disabled={createUserMutation.isPending} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                    {createUserMutation.isPending ? 'A criar...' : 'Criar'}
                  </Button>
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
