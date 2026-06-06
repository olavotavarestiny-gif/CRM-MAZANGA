'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addStakeholder,
  updateStakeholder,
  removeStakeholder,
  searchContacts,
} from '@/lib/api';
import {
  Deal,
  DealStakeholder,
  StakeholderRole,
  StakeholderInfluence,
} from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Trash2, Star, UserPlus } from 'lucide-react';

const ROLE_LABELS: Record<StakeholderRole, string> = {
  tecnico: 'Técnico',
  decisor: 'Decisor',
  financeiro: 'Financeiro',
  influenciador: 'Influenciador',
  outro: 'Outro',
};

const INFLUENCE_LABELS: Record<StakeholderInfluence, string> = {
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as StakeholderRole[];
const INFLUENCE_OPTIONS = Object.keys(INFLUENCE_LABELS) as StakeholderInfluence[];

const NO_INFLUENCE = '__none__';

function influenceVariant(influence: StakeholderInfluence) {
  if (influence === 'alto') return 'destructive' as const;
  if (influence === 'medio') return 'default' as const;
  return 'secondary' as const;
}

function StakeholderRow({ deal, stakeholder }: { deal: Deal; stakeholder: DealStakeholder }) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Pick<DealStakeholder, 'role' | 'influence' | 'isPrimary'>>) =>
      updateStakeholder(deal.id, stakeholder.id, data),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeStakeholder(deal.id, stakeholder.id),
    onSuccess: invalidate,
  });

  const mutationError = updateMutation.error || removeMutation.error;

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[#0A2540]">
          {stakeholder.contact?.name ?? 'Contacto'}
        </span>
        {stakeholder.isPrimary && (
          <Badge variant="solid" className="gap-1">
            <Star className="h-3 w-3" /> Principal
          </Badge>
        )}
        <Badge variant="outline">{ROLE_LABELS[stakeholder.role]}</Badge>
        {stakeholder.influence && (
          <Badge variant={influenceVariant(stakeholder.influence)}>
            {INFLUENCE_LABELS[stakeholder.influence]}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 w-7 p-0 text-[#6b7e9a] hover:text-red-500"
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          title="Remover pessoa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label className="mb-1 block text-xs text-[#6b7e9a]">Papel</Label>
          <Select
            value={stakeholder.role}
            onValueChange={(value) =>
              updateMutation.mutate({ role: value as StakeholderRole })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-xs text-[#6b7e9a]">Influência</Label>
          <Select
            value={stakeholder.influence ?? NO_INFLUENCE}
            onValueChange={(value) =>
              updateMutation.mutate({
                influence: value === NO_INFLUENCE ? null : (value as StakeholderInfluence),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_INFLUENCE}>Sem influência</SelectItem>
              {INFLUENCE_OPTIONS.map((influence) => (
                <SelectItem key={influence} value={influence}>
                  {INFLUENCE_LABELS[influence]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0A2540]">
            <Checkbox
              checked={stakeholder.isPrimary}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ isPrimary: checked === true })
              }
            />
            Principal
          </label>
        </div>
      </div>

      {mutationError && (
        <p className="mt-2 text-xs text-red-500">
          {getApiErrorMessage(mutationError, 'Não foi possível atualizar a pessoa.')}
        </p>
      )}
    </div>
  );
}

function AddStakeholderForm({ deal, onDone }: { deal: Deal; onDone: () => void }) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [contactId, setContactId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [role, setRole] = useState<StakeholderRole>('outro');
  const [influence, setInfluence] = useState<string>(NO_INFLUENCE);
  const [isPrimary, setIsPrimary] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ['stakeholderContactSearch', search],
    queryFn: () => searchContacts({ search: search.trim() || undefined, limit: 20 }),
    enabled: mode === 'existing',
  });

  const addMutation = useMutation({
    mutationFn: () => {
      const resolvedInfluence =
        influence === NO_INFLUENCE ? null : (influence as StakeholderInfluence);
      if (mode === 'existing') {
        return addStakeholder(deal.id, {
          contactId: Number(contactId),
          role,
          influence: resolvedInfluence,
          isPrimary,
        });
      }
      return addStakeholder(deal.id, {
        newContact: {
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
        },
        role,
        influence: resolvedInfluence,
        isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      onDone();
    },
  });

  const isValid =
    mode === 'existing' ? contactId.length > 0 : newName.trim().length > 0;

  return (
    <div className="space-y-4 rounded-lg border border-[#E2E8F0] bg-[#f9fafc] p-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'existing' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('existing')}
        >
          Selecionar existente
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('new')}
        >
          Criar na hora
        </Button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-2">
          <div>
            <Label className="mb-1 block text-sm font-medium text-[#0A2540]">
              Procurar contacto
            </Label>
            <Input
              placeholder="Nome, email ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-[#0A2540]">
              Contacto <span className="text-red-500">*</span>
            </Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleciona um contacto" />
              </SelectTrigger>
              <SelectContent>
                {contacts.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-[#6b7e9a]">
                    Sem resultados.
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact.id} value={String(contact.id)}>
                      {contact.name}
                      {contact.phone ? ` · ${contact.phone}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <Label className="mb-1 block text-sm font-medium text-[#0A2540]">
              Nome <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Nome da pessoa"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-[#0A2540]">
              Telefone
            </Label>
            <Input
              placeholder="Telefone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-[#0A2540]">
              Email
            </Label>
            <Input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label className="mb-1 block text-sm font-medium text-[#0A2540]">Papel</Label>
          <Select value={role} onValueChange={(value) => setRole(value as StakeholderRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-sm font-medium text-[#0A2540]">
            Influência
          </Label>
          <Select value={influence} onValueChange={setInfluence}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_INFLUENCE}>Sem influência</SelectItem>
              {INFLUENCE_OPTIONS.map((i) => (
                <SelectItem key={i} value={i}>
                  {INFLUENCE_LABELS[i]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0A2540]">
        <Checkbox
          checked={isPrimary}
          onCheckedChange={(checked) => setIsPrimary(checked === true)}
        />
        Marcar como contacto principal
      </label>

      {addMutation.isError && (
        <p className="text-sm text-red-500">
          {getApiErrorMessage(addMutation.error, 'Não foi possível adicionar a pessoa.')}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onDone} disabled={addMutation.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!isValid || addMutation.isPending}
        >
          {addMutation.isPending ? 'A adicionar...' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}

export default function DealStakeholdersPanel({ deal }: { deal: Deal }) {
  const [isAdding, setIsAdding] = useState(false);
  const stakeholders = deal.stakeholders ?? [];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0A2540]">Pessoas envolvidas</h2>
          <p className="text-sm text-[#6b7e9a]">
            Stakeholders desta negociação e o seu papel.
          </p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar pessoa
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {stakeholders.length === 0 && !isAdding ? (
          <p className="rounded-lg border border-dashed border-[#E2E8F0] p-6 text-center text-sm text-[#6b7e9a]">
            Ainda não há pessoas associadas. Adiciona a primeira para mapear quem decide.
          </p>
        ) : (
          stakeholders.map((stakeholder) => (
            <StakeholderRow key={stakeholder.id} deal={deal} stakeholder={stakeholder} />
          ))
        )}

        {isAdding && (
          <AddStakeholderForm deal={deal} onDone={() => setIsAdding(false)} />
        )}
      </div>
    </div>
  );
}
