import type { ActivityLogEntry } from './types';

const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });

const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  email: 'email',
  phone: 'telefone',
  tags: 'tags',
  assigned_to: 'responsável',
  done: 'estado',
  document_status: 'estado',
  stage: 'etapa',
};

const FIELD_CHANGE_PHRASES: Record<string, string> = {
  name: 'alterou o nome',
  email: 'alterou o email',
  phone: 'alterou o telefone',
  tags: 'alterou as tags',
  assigned_to: 'alterou o responsável',
  done: 'alterou o estado',
  document_status: 'alterou o estado',
  stage: 'alterou a etapa',
};

function formatUnit(value: number, unit: Intl.RelativeTimeFormatUnit) {
  return relativeTimeFormatter.format(value, unit);
}

export function formatRelativeTime(value: string) {
  const now = Date.now();
  const target = new Date(value).getTime();
  const diffSeconds = Math.round((target - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return formatUnit(diffSeconds, 'second');
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return formatUnit(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatUnit(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return formatUnit(diffDays, 'day');
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return formatUnit(diffMonths, 'month');
  return formatUnit(Math.round(diffDays / 365), 'year');
}

export function formatActivityMessage(entry: ActivityLogEntry) {
  const actor = entry.user_name || 'Sistema';

  if (entry.entity_type === 'contact') {
    if (entry.action === 'created') return `${actor} criou o contacto`;
    if (entry.action === 'deleted') return `${actor} eliminou o contacto`;
    if (entry.action === 'stage_changed') {
      const stageName = entry.new_value || String(entry.metadata?.new_stage_name || 'etapa seguinte');
      return `${actor} moveu para ${stageName}`;
    }
    if (entry.action === 'updated') {
      const phrase = FIELD_CHANGE_PHRASES[entry.field_changed || ''] || 'alterou um campo';
      return `${actor} ${phrase}`;
    }
  }

  if (entry.entity_type === 'task') {
    if (entry.action === 'created') return `${actor} criou a tarefa`;
    if (entry.action === 'deleted') return `${actor} eliminou a tarefa`;
    if (entry.action === 'status_changed' && entry.field_changed === 'done') {
      return entry.new_value === 'Concluída'
        ? `${actor} marcou a tarefa como concluída`
        : `${actor} reabriu a tarefa`;
    }
    if (entry.action === 'updated' && entry.field_changed === 'assigned_to') {
      return `${actor} alterou o responsável da tarefa`;
    }
  }

  if (entry.entity_type === 'invoice') {
    if (entry.action === 'created') return `${actor} criou a fatura`;
    if (entry.action === 'status_changed') {
      return `${actor} alterou o estado da fatura`;
    }
  }

  if (entry.action === 'created') return `${actor} criou um registo`;
  if (entry.action === 'deleted') return `${actor} eliminou um registo`;
  if (entry.action === 'updated') {
    const field = FIELD_LABELS[entry.field_changed || ''];
    return field ? `${actor} alterou ${field}` : `${actor} fez uma alteração`;
  }
  return `${actor} fez uma alteração`;
}

export function formatActivityDetail(entry: ActivityLogEntry) {
  if (entry.action === 'stage_changed') {
    const from = entry.old_value || String(entry.metadata?.old_stage_name || '—');
    const to = entry.new_value || String(entry.metadata?.new_stage_name || '—');
    return `${from} → ${to}`;
  }

  if (entry.field_changed && (entry.old_value || entry.new_value)) {
    const from = entry.old_value || '—';
    const to = entry.new_value || '—';
    return `${from} → ${to}`;
  }

  if (entry.entity_type === 'invoice' && entry.metadata?.document_no) {
    return String(entry.metadata.document_no);
  }

  return entry.entity_label;
}
