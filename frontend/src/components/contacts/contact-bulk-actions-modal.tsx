'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';
import type { BulkUpdateContactsInput, ContactGroup, PipelineStage } from '@/lib/types';

const UNCHANGED_VALUE = '__UNCHANGED__';
const UNGROUPED_VALUE = '__UNGROUPED__';

interface ContactBulkActionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  contactGroups: ContactGroup[];
  pipelineStages: PipelineStage[];
  canEditStage: boolean;
  canEditContactType: boolean;
  loading?: boolean;
  onSubmit: (changes: BulkUpdateContactsInput['changes']) => Promise<void>;
}

export default function ContactBulkActionsModal({
  open,
  onOpenChange,
  selectedCount,
  contactGroups,
  pipelineStages,
  canEditStage,
  canEditContactType,
  loading = false,
  onSubmit,
}: ContactBulkActionsModalProps) {
  const { toast } = useToast();
  const [groupValue, setGroupValue] = useState(UNCHANGED_VALUE);
  const [statusValue, setStatusValue] = useState(UNCHANGED_VALUE);
  const [stageValue, setStageValue] = useState(UNCHANGED_VALUE);
  const [contactTypeValue, setContactTypeValue] = useState(UNCHANGED_VALUE);
  const safeContactGroups = Array.isArray(contactGroups)
    ? contactGroups.filter((group) => group && typeof group.id === 'string' && group.id.trim().length > 0)
    : [];
  const safePipelineStages = Array.isArray(pipelineStages)
    ? pipelineStages.filter((stage) => stage && typeof stage.id === 'string' && typeof stage.name === 'string' && stage.name.trim().length > 0)
    : [];

  const hasChanges = useMemo(() => (
    groupValue !== UNCHANGED_VALUE ||
    statusValue !== UNCHANGED_VALUE ||
    (canEditStage && stageValue !== UNCHANGED_VALUE) ||
    (canEditContactType && contactTypeValue !== UNCHANGED_VALUE)
  ), [canEditContactType, canEditStage, contactTypeValue, groupValue, stageValue, statusValue]);

  useEffect(() => {
    if (!open) {
      setGroupValue(UNCHANGED_VALUE);
      setStatusValue(UNCHANGED_VALUE);
      setStageValue(UNCHANGED_VALUE);
      setContactTypeValue(UNCHANGED_VALUE);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (selectedCount <= 0) {
      toast({
        variant: 'info',
        title: 'Sem contactos selecionados',
        description: 'Seleciona pelo menos um contacto antes de aplicar ações em massa.',
      });
      return;
    }

    if (!hasChanges) {
      toast({
        variant: 'info',
        title: 'Nada para aplicar',
        description: 'Seleciona pelo menos uma alteração antes de confirmar.',
      });
      return;
    }

    const changes: BulkUpdateContactsInput['changes'] = {};

    if (groupValue !== UNCHANGED_VALUE) {
      changes.contactGroupId = groupValue === UNGROUPED_VALUE ? null : groupValue;
    }

    if (statusValue !== UNCHANGED_VALUE) {
      changes.status = statusValue as 'ativo' | 'inativo';
    }

    if (canEditStage && stageValue !== UNCHANGED_VALUE) {
      changes.stage = stageValue;
    }

    if (canEditContactType && contactTypeValue !== UNCHANGED_VALUE) {
      changes.contactType = contactTypeValue as 'interessado' | 'cliente';
    }

    await onSubmit(changes);
  };

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Ações em massa"
      description={`Aplicar alterações aos ${selectedCount} contacto(s) selecionado(s). Os campos deixados em “Sem alteração” ficam intactos.`}
      size="md"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <LoadingButton type="button" onClick={handleSubmit} loading={loading} loadingLabel="A aplicar...">
            Aplicar alterações
          </LoadingButton>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <Label>Grupo</Label>
          <Select value={groupValue} onValueChange={setGroupValue}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Sem alteração" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCHANGED_VALUE}>Sem alteração</SelectItem>
              <SelectItem value={UNGROUPED_VALUE}>Sem grupo</SelectItem>
              {safeContactGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Estado</Label>
          <Select value={statusValue} onValueChange={setStatusValue}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Sem alteração" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCHANGED_VALUE}>Sem alteração</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canEditStage ? (
          <div>
            <Label>Etapa</Label>
            <Select value={stageValue} onValueChange={setStageValue}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sem alteração" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED_VALUE}>Sem alteração</SelectItem>
                {safePipelineStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.name}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {canEditContactType ? (
          <div>
            <Label>Tipo de contacto</Label>
            <Select value={contactTypeValue} onValueChange={setContactTypeValue}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sem alteração" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED_VALUE}>Sem alteração</SelectItem>
                <SelectItem value="interessado">Interessado</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
