'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Building2, CheckCircle2, Stethoscope, Store, Wrench } from 'lucide-react';
import {
  applyStartupTemplate,
  getStartupTemplateStatus,
  getStartupTemplates,
  type StartupTemplate,
  type User,
} from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';

const ICONS: Record<string, React.ElementType> = {
  marketing_agency: BriefcaseBusiness,
  accounting_office: Building2,
  technical_services: Wrench,
  retail_store: Store,
  clinic: Stethoscope,
};

function isEligible(user: User | null | undefined): boolean {
  if (!user) return false;
  return !!(user.isSuperAdmin || user.role === 'admin' || !user.accountOwnerId);
}

function ModelCard({
  model,
  selected,
  onSelect,
}: {
  model: StartupTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[model.key] || BriefcaseBusiness;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        selected
          ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[var(--workspace-primary)] shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#2c2f31]">{model.label}</p>
            {selected ? <CheckCircle2 className="h-4 w-4 text-[var(--workspace-primary)]" /> : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{model.description}</p>
          {model.goals.length > 0 ? (
            <p className="mt-2 text-xs font-medium text-slate-600">{model.goals.slice(0, 2).join(' • ')}</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function StartupModelSelector({ currentUser }: { currentUser: User | null | undefined }) {
  const queryClient = useQueryClient();
  const eligible = isEligible(currentUser);
  const statusQuery = useQuery({
    queryKey: ['startup-template-status', currentUser?.workspaceMode],
    queryFn: getStartupTemplateStatus,
    enabled: eligible,
    staleTime: 60_000,
  });
  const templatesQuery = useQuery({
    queryKey: ['startup-templates', currentUser?.workspaceMode],
    queryFn: getStartupTemplates,
    enabled: eligible && statusQuery.data?.applied === false,
    staleTime: 60_000,
  });

  const models = templatesQuery.data?.templates || [];
  const defaultKey = models[0]?.key || '';
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    if (!defaultKey) return;
    const stored = window.sessionStorage.getItem('kukugest_startup_model_selected');
    setSelectedKey(stored || defaultKey);
  }, [defaultKey]);

  const applyMutation = useMutation({
    mutationFn: applyStartupTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['startup-template-status'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
    },
  });

  if (!eligible || statusQuery.isLoading || statusQuery.data?.applied !== false || models.length === 0) {
    return null;
  }

  const activeKey = models.some((model) => model.key === selectedKey) ? selectedKey : defaultKey;

  return (
    <Dialog open>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle className="text-xl font-bold text-[#2c2f31]">Escolha um modelo para começar</DialogTitle>
          <p className="mt-1 text-sm text-slate-500">Modelos Inteligentes de Arranque</p>
        </DialogHeader>
        <div className="max-h-[62vh] overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-2">
            {models.map((model) => (
              <ModelCard
                key={model.key}
                model={model}
                selected={model.key === activeKey}
                onSelect={() => {
                  window.sessionStorage.setItem('kukugest_startup_model_selected', model.key);
                  setSelectedKey(model.key);
                }}
              />
            ))}
          </div>
          {applyMutation.error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {applyMutation.error.message || 'Não foi possível aplicar o modelo.'}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <LoadingButton
            loading={applyMutation.isPending}
            loadingLabel="A preparar..."
            onClick={() => applyMutation.mutate(activeKey)}
            disabled={!activeKey || applyMutation.isPending}
          >
            Começar
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
