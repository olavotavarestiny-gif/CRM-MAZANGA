'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import ManagementResourcePage from '@/components/management/management-resource-page';
import { StatusBadge } from '@/components/management/management-ui';
import { managementApi, type ManagementClient } from '@/lib/management-api';
import { formatDate, formatKz } from '@/lib/management-format';

export default function ClientsPage() {
  const bootstrap = useQuery({ queryKey: ['management-bootstrap'], queryFn: managementApi.bootstrap });
  const people = (bootstrap.data?.profiles || []).map((profile) => ({ value: profile.id, label: profile.fullName }));
  const fields = [
    { name: 'companyName', label: 'Nome da empresa', required: true }, { name: 'contactName', label: 'Nome do contacto', required: true },
    { name: 'phone', label: 'Telefone', primary: true }, { name: 'email', label: 'E-mail', type: 'email' as const, primary: true }, { name: 'contractedService', label: 'Serviço contratado', primary: true },
    { name: 'monthlyValue', label: 'Valor mensal (Kz)', type: 'number' as const, primary: true }, { name: 'totalContractValue', label: 'Valor total do contrato (Kz)', type: 'number' as const },
    { name: 'startDate', label: 'Data de início', type: 'date' as const }, { name: 'expectedEndDate', label: 'Término previsto', type: 'date' as const },
    { name: 'contractDurationMonths', label: 'Duração (meses)', type: 'number' as const },
    { name: 'commercialResponsibleId', label: 'Responsável comercial', type: 'select' as const, options: people }, { name: 'operationalResponsibleId', label: 'Responsável operacional', type: 'select' as const, options: people },
    { name: 'status', label: 'Estado', type: 'select' as const, required: true, options: [['lead','Lead'],['em_negociacao','Em negociação'],['ativo','Ativo'],['pausado','Pausado'],['inativo','Inativo'],['cancelado','Cancelado']].map(([value,label]) => ({ value,label })) },
    { name: 'source', label: 'Origem' }, { name: 'notes', label: 'Observações', type: 'textarea' as const },
  ];
  return <ManagementResourcePage<ManagementClient> title="Clientes" description="Clientes, contratos, responsáveis e rentabilidade." queryKey="management-clients" load={() => managementApi.clients()} create={managementApi.createClient} update={managementApi.updateClient} remove={managementApi.deleteClient} archive={managementApi.archiveClient} createLabel="Novo cliente" fields={fields} columns={[
    { label: 'Empresa', render: (row) => <Link href={`/gestao/clientes/${row.id}`} className="font-semibold text-blue-600 hover:underline">{row.companyName}</Link>, searchValue: (row) => `${row.companyName} ${row.contactName} ${row.email}` },
    { label: 'Contacto', render: (row) => <div><p>{row.contactName}</p><p className="text-xs text-slate-500">{row.email || row.phone || '—'}</p></div> },
    { label: 'Serviço', render: (row) => row.contractedService || '—' }, { label: 'Mensalidade', render: (row) => formatKz(row.monthlyValue) },
    { label: 'Estado', render: (row) => <StatusBadge value={row.status} /> }, { label: 'Início', render: (row) => formatDate(row.startDate) },
  ]} toInitialValues={(row) => ({ ...row, startDate: row.startDate?.slice(0,10) || '', expectedEndDate: row.expectedEndDate?.slice(0,10) || '' })} />;
}
