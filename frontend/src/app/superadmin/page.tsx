'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSuperAdminOrgs, updateSuperAdminOrg, deleteSuperAdminOrg,
  impersonateUser, createClientAccount,
} from '@/lib/api';
import type { SuperAdminOrg, UserPermissions } from '@/lib/api';
import {
  Users, Trash2, Eye, Plus, Search, ChevronDown, ChevronRight,
  Shield, RefreshCw, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const PLANS = ['essencial', 'profissional', 'enterprise'];
const PLAN_LABELS: Record<string, string> = {
  essencial: 'Essencial',
  profissional: 'Profissional',
  enterprise: 'Enterprise',
};

export default function SuperAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', plan: 'essencial' });
  const [createError, setCreateError] = useState('');

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['superadmin-orgs'],
    queryFn: getSuperAdminOrgs,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateSuperAdminOrg>[1] }) =>
      updateSuperAdminOrg(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-orgs'] }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteSuperAdminOrg,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-orgs'] }),
  });

  const impersonateMut = useMutation({
    mutationFn: impersonateUser,
    onSuccess: ({ token }) => {
      localStorage.setItem('impersonation_token', token);
      window.location.href = '/';
    },
  });

  const createMut = useMutation({
    mutationFn: createClientAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-orgs'] });
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', plan: 'essencial' });
      setCreateError('');
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase()) ||
      (o.accountMembers || []).some(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
  );

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = (org: SuperAdminOrg) => {
    if (!confirm(`Apagar organização "${org.name}" e todos os seus dados? Esta ação é irreversível.`)) return;
    deleteMut.mutate(org.id);
  };

  // total users across all orgs
  const totalUsers = orgs.reduce((sum, o) => sum + 1 + (o._count?.accountMembers ?? 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0A2540]">SuperAdmin</h1>
            <p className="text-sm text-[#6b7e9a]">
              {orgs.length} organizações · {totalUsers} utilizadores no total
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Conta
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7e9a]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar organizações ou utilizadores..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#dde3ec] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            A carregar...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#6b7e9a]">Nenhuma organização encontrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dde3ec] bg-[#f8fafc]">
                <th className="text-left px-4 py-3 font-semibold text-[#0A2540] w-8"></th>
                <th className="text-left px-4 py-3 font-semibold text-[#0A2540]">Organização / Utilizador</th>
                <th className="text-left px-4 py-3 font-semibold text-[#0A2540]">Plano</th>
                <th className="text-center px-4 py-3 font-semibold text-[#0A2540]">Membros</th>
                <th className="text-center px-4 py-3 font-semibold text-[#0A2540]">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-[#0A2540]">Criado</th>
                <th className="text-center px-4 py-3 font-semibold text-[#0A2540]">Acções</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => {
                const isOpen = expanded.has(org.id);
                const members = org.accountMembers || [];
                return (
                  <>
                    {/* Org row */}
                    <tr
                      key={org.id}
                      className="border-b border-[#dde3ec] hover:bg-[#f8fafc] transition-colors cursor-pointer"
                      onClick={() => members.length > 0 && toggleExpand(org.id)}
                    >
                      <td className="px-4 py-3 text-[#6b7e9a]">
                        {members.length > 0 ? (
                          isOpen
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0A2540]">{org.name}</div>
                        <div className="text-xs text-[#6b7e9a]">{org.email}</div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <select
                            value={org.plan || 'essencial'}
                            onChange={(e) => updateMut.mutate({ id: org.id, data: { plan: e.target.value } })}
                            className="appearance-none pl-2 pr-6 py-1 text-xs border border-[#dde3ec] rounded-lg bg-white text-[#0A2540] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            {PLANS.map((p) => (
                              <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6b7e9a] pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#6b7e9a]">
                          <Users className="w-3.5 h-3.5" />
                          <span>{org._count.accountMembers}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => updateMut.mutate({ id: org.id, data: { active: !org.active } })}
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                            org.active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          {org.active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[#6b7e9a] text-xs">
                        {new Date(org.createdAt).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => impersonateMut.mutate(org.id)}
                            disabled={impersonateMut.isPending}
                            title="Login como este utilizador"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#6b7e9a] hover:text-blue-600 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(org)}
                            disabled={deleteMut.isPending}
                            title="Apagar organização"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#6b7e9a] hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Members rows (expanded) */}
                    {isOpen && members.map((member) => (
                      <tr
                        key={`member-${member.id}`}
                        className="border-b border-[#dde3ec] bg-[#f8fafc] last:border-0"
                      >
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 pl-8">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-[#6b7e9a] shrink-0" />
                            <div>
                              <div className="text-sm text-[#0A2540]">{member.name}</div>
                              <div className="text-xs text-[#6b7e9a]">{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-[#6b7e9a]">Membro</td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            member.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {member.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => impersonateMut.mutate(member.id)}
                            disabled={impersonateMut.isPending}
                            title="Login como este utilizador"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#6b7e9a] hover:text-blue-600 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Account Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>
            )}
            <div>
              <label className="text-sm font-medium text-[#0A2540] mb-1 block">Nome</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Nome da empresa ou pessoa"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#0A2540] mb-1 block">Email</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#0A2540] mb-1 block">Password inicial</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#0A2540] mb-1 block">Plano</label>
              <select
                value={createForm.plan}
                onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}
                className="w-full px-3 py-2 border border-[#dde3ec] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMut.mutate(createForm)}
              disabled={createMut.isPending || !createForm.name || !createForm.email || !createForm.password}
            >
              {createMut.isPending ? 'A criar...' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
