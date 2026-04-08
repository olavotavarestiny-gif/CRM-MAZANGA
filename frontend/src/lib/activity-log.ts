import type { ActivityLogEntry } from './types';

const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });

const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  nome: 'nome',
  email: 'email',
  phone: 'telefone',
  tags: 'tags',
  assigned_to: 'responsável',
  done: 'estado',
  document_status: 'estado',
  stage: 'etapa',
  customerName: 'nome',
  customerTaxID: 'NIF',
  customerAddress: 'morada',
  customerPhone: 'telefone',
  customerEmail: 'email',
  contactId: 'contacto ligado',
  productDescription: 'descrição',
  unitPrice: 'preço de venda',
  cost: 'custo',
  productType: 'tipo de produto',
  sku: 'SKU',
  unitOfMeasure: 'unidade',
  taxPercentage: 'IVA',
  stock: 'stock',
  stockMinimo: 'stock mínimo',
  categoriaId: 'categoria',
  active: 'estado',
  cor: 'cor',
  seriesStatus: 'estado',
  nifEmpresa: 'NIF da empresa',
  nomeEmpresa: 'nome da empresa',
  moradaEmpresa: 'morada da empresa',
  telefoneEmpresa: 'telefone da empresa',
  emailEmpresa: 'email da empresa',
  websiteEmpresa: 'website da empresa',
  iban: 'IBAN',
  logoUrl: 'logótipo',
  agtMockMode: 'modo AGT',
  agtCertNumber: 'certificado AGT',
  defaultSerieId: 'série padrão',
  defaultEstabelecimentoId: 'ponto de venda padrão',
};

const FIELD_CHANGE_PHRASES: Record<string, string> = {
  name: 'alterou o nome',
  nome: 'alterou o nome',
  email: 'alterou o email',
  phone: 'alterou o telefone',
  tags: 'alterou as tags',
  assigned_to: 'alterou o responsável',
  done: 'alterou o estado',
  document_status: 'alterou o estado',
  stage: 'alterou a etapa',
  customerName: 'alterou o nome do cliente de faturação',
  customerTaxID: 'alterou o NIF do cliente de faturação',
  customerAddress: 'alterou a morada do cliente de faturação',
  customerPhone: 'alterou o telefone do cliente de faturação',
  customerEmail: 'alterou o email do cliente de faturação',
  contactId: 'alterou o contacto ligado',
  productDescription: 'alterou a descrição do produto',
  unitPrice: 'alterou o preço de venda',
  cost: 'alterou o custo',
  productType: 'alterou o tipo de produto',
  sku: 'alterou o SKU',
  unitOfMeasure: 'alterou a unidade',
  taxPercentage: 'alterou o IVA',
  stockMinimo: 'alterou o stock mínimo',
  categoriaId: 'alterou a categoria',
  active: 'alterou o estado do produto',
  cor: 'alterou a cor',
  seriesStatus: 'alterou o estado da série',
  nifEmpresa: 'alterou o NIF da empresa',
  nomeEmpresa: 'alterou o nome da empresa',
  moradaEmpresa: 'alterou a morada da empresa',
  telefoneEmpresa: 'alterou o telefone da empresa',
  emailEmpresa: 'alterou o email da empresa',
  websiteEmpresa: 'alterou o website da empresa',
  iban: 'alterou o IBAN',
  logoUrl: 'alterou o logótipo',
  agtMockMode: 'alterou o modo AGT',
  agtCertNumber: 'alterou o certificado AGT',
  defaultSerieId: 'alterou a série padrão',
  defaultEstabelecimentoId: 'alterou o ponto de venda padrão',
};

const SERIES_STATUS_LABELS: Record<string, string> = {
  A: 'Ativa',
  U: 'Em uso',
  F: 'Fechada',
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  P: 'Produto',
  S: 'Serviço',
  O: 'Outro',
};

function formatUnit(value: number, unit: Intl.RelativeTimeFormatUnit) {
  return relativeTimeFormatter.format(value, unit);
}

function formatCurrency(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return `${parsed.toFixed(2)} Kz`;
}

function formatActivityValue(entry: ActivityLogEntry, value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';

  if (value === 'true') return 'Sim';
  if (value === 'false') return 'Não';

  if (entry.field_changed === 'seriesStatus') {
    return SERIES_STATUS_LABELS[value] || value;
  }

  if (entry.field_changed === 'productType') {
    return PRODUCT_TYPE_LABELS[value] || value;
  }

  if (entry.field_changed === 'unitPrice' || entry.field_changed === 'cost') {
    return formatCurrency(value) || value;
  }

  if (entry.field_changed === 'taxPercentage') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed}%` : value;
  }

  return value;
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

  if (entry.entity_type === 'cash_session') {
    if (entry.action === 'opened') return `${actor} abriu sessão de caixa`;
    if (entry.action === 'closed') return `${actor} fechou sessão de caixa`;
  }

  if (entry.entity_type === 'billing_customer') {
    if (entry.action === 'created') return `${actor} criou o cliente de faturação`;
    if (entry.action === 'updated') {
      const phrase = FIELD_CHANGE_PHRASES[entry.field_changed || ''] || 'alterou o cliente de faturação';
      return `${actor} ${phrase}`;
    }
  }

  if (entry.entity_type === 'product') {
    if (entry.action === 'created') return `${actor} criou o produto`;
    if (entry.action === 'deactivated') return `${actor} desativou o produto`;
    if (entry.action === 'stock_adjusted') {
      const direction = entry.metadata?.direction === 'entry' ? 'entrada' : 'saída';
      return `${actor} registou ${direction} de stock`;
    }
    if (entry.action === 'updated') {
      const phrase = FIELD_CHANGE_PHRASES[entry.field_changed || ''] || 'alterou o produto';
      return `${actor} ${phrase}`;
    }
  }

  if (entry.entity_type === 'product_category') {
    if (entry.action === 'created') return `${actor} criou a categoria`;
    if (entry.action === 'deleted') return `${actor} eliminou a categoria`;
    if (entry.action === 'updated') {
      const phrase = FIELD_CHANGE_PHRASES[entry.field_changed || ''] || 'alterou a categoria';
      return `${actor} ${phrase}`;
    }
  }

  if (entry.entity_type === 'serie') {
    if (entry.action === 'created') return `${actor} criou a série`;
    if (entry.action === 'deleted') return `${actor} eliminou a série`;
    if (entry.action === 'updated') {
      const phrase = FIELD_CHANGE_PHRASES[entry.field_changed || ''] || 'alterou a série';
      return `${actor} ${phrase}`;
    }
  }

  if (entry.entity_type === 'store') {
    if (entry.action === 'created') return `${actor} criou o ponto de venda`;
  }

  if (entry.entity_type === 'billing_config') {
    if (entry.action === 'updated') {
      const phrase = FIELD_CHANGE_PHRASES[entry.field_changed || ''] || 'alterou a configuração fiscal';
      return `${actor} ${phrase}`;
    }
  }

  if (entry.action === 'created') return `${actor} criou um registo`;
  if (entry.action === 'deleted') return `${actor} eliminou um registo`;
  if (entry.action === 'deactivated') return `${actor} desativou um registo`;
  if (entry.action === 'updated') {
    const field = FIELD_LABELS[entry.field_changed || ''];
    return field ? `${actor} alterou ${field}` : `${actor} fez uma alteração`;
  }
  return `${actor} fez uma alteração`;
}

export function formatActivityDetail(entry: ActivityLogEntry) {
  if (entry.entity_type === 'cash_session' && entry.action === 'opened') {
    const storeName = String(entry.metadata?.establishment_name || entry.entity_label);
    const openingBalance = formatCurrency(entry.metadata?.opening_balance) || '0.00 Kz';
    return `${storeName} • saldo inicial ${openingBalance}`;
  }

  if (entry.entity_type === 'cash_session' && entry.action === 'closed') {
    const storeName = String(entry.metadata?.establishment_name || entry.entity_label);
    const expected = formatCurrency(entry.metadata?.expected_closing_amount) || '—';
    const counted = formatCurrency(entry.metadata?.closing_counted_amount) || '—';
    const difference = formatCurrency(entry.metadata?.difference_amount) || '—';
    return `${storeName} • esperado ${expected} • contado ${counted} • diferença ${difference}`;
  }

  if (entry.entity_type === 'product' && entry.action === 'stock_adjusted') {
    const from = formatActivityValue(entry, entry.old_value);
    const to = formatActivityValue(entry, entry.new_value);
    const quantity = Number(entry.metadata?.quantity);
    const signedQuantity = Number.isFinite(quantity)
      ? `${entry.metadata?.direction === 'entry' ? '+' : '-'}${quantity}`
      : null;
    const reason = entry.metadata?.reason ? String(entry.metadata.reason) : null;
    return `${from} → ${to}${signedQuantity ? ` (${signedQuantity})` : ''}${reason ? ` • ${reason}` : ''}`;
  }

  if (entry.action === 'stage_changed') {
    const from = entry.old_value || String(entry.metadata?.old_stage_name || '—');
    const to = entry.new_value || String(entry.metadata?.new_stage_name || '—');
    return `${from} → ${to}`;
  }

  if (entry.field_changed && (entry.old_value || entry.new_value)) {
    const from = formatActivityValue(entry, entry.old_value);
    const to = formatActivityValue(entry, entry.new_value);
    return `${from} → ${to}`;
  }

  if (entry.entity_type === 'invoice' && entry.metadata?.document_no) {
    return String(entry.metadata.document_no);
  }

  return entry.entity_label;
}
