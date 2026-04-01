import { getClientesFaturacao, getContacts } from '@/lib/api';
import type { ClienteFaturacao, Contact } from '@/lib/types';

export interface CommercialCustomerLookupItem {
  id: string;
  source: 'crm' | 'faturacao';
  label: string;
  customerName: string;
  customerTaxID: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  company?: string;
  contactId?: number;
  clienteType?: Contact['clienteType'];
  requiresContactFix?: boolean;
}

export interface CommercialCustomerLookupGroup {
  id: string;
  label: string;
  items: CommercialCustomerLookupItem[];
}

function normalizeLookupValue(value: string | undefined | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getContactDisplayName(contact: Contact) {
  return contact.company?.trim() || contact.name;
}

function rankCustomerOption(option: CommercialCustomerLookupItem, query: string) {
  const normalizedQuery = normalizeLookupValue(query);
  const fields = [
    option.customerName,
    option.customerTaxID,
    option.customerPhone,
    option.company,
    option.customerEmail,
  ].map(normalizeLookupValue);

  if (fields.some((field) => field === normalizedQuery)) {
    return 0;
  }

  if (fields.some((field) => field.startsWith(normalizedQuery))) {
    return 1;
  }

  return 2;
}

export function buildFieldsFromLookupCustomer(customer: CommercialCustomerLookupItem) {
  return {
    taxId: customer.customerTaxID || '',
    name: customer.customerName || '',
    address: customer.customerAddress || '',
    phone: customer.customerPhone || '',
    email: customer.customerEmail || '',
  };
}

function mapBillingClient(cliente: ClienteFaturacao): CommercialCustomerLookupItem {
  return {
    id: cliente.id,
    source: 'faturacao',
    label: 'Faturação',
    customerName: cliente.customerName,
    customerTaxID: cliente.customerTaxID,
    customerAddress: cliente.customerAddress,
    customerPhone: cliente.customerPhone,
    customerEmail: cliente.customerEmail,
    contactId: cliente.contactId,
  };
}

function mapCrmContact(contact: Contact): CommercialCustomerLookupItem {
  const customerTaxID = (contact.nif || '').trim();
  const isEmpresaWithoutNif = contact.clienteType === 'empresa' && !customerTaxID;

  return {
    id: String(contact.id),
    source: 'crm',
    label: 'CRM',
    customerName: getContactDisplayName(contact),
    customerTaxID,
    customerPhone: contact.phone,
    customerEmail: contact.email,
    company: contact.company,
    contactId: contact.id,
    clienteType: contact.clienteType,
    requiresContactFix: isEmpresaWithoutNif,
  };
}

export async function searchCommercialCustomers(query: string): Promise<CommercialCustomerLookupGroup[]> {
  const [billingData, contacts] = await Promise.all([
    getClientesFaturacao({ search: query }),
    getContacts({ search: query }),
  ]);

  const billingClients = billingData.clientes
    .map((cliente) => mapBillingClient(cliente))
    .sort((a, b) => {
      const rankDiff = rankCustomerOption(a, query) - rankCustomerOption(b, query);
      return rankDiff || a.customerName.localeCompare(b.customerName);
    });

  const crmContacts = contacts
    .map((contact) => mapCrmContact(contact))
    .sort((a, b) => {
      const rankDiff = rankCustomerOption(a, query) - rankCustomerOption(b, query);
      return rankDiff || a.customerName.localeCompare(b.customerName);
    });

  return [
    {
      id: 'billing',
      label: 'Clientes de faturação',
      items: billingClients,
    },
    {
      id: 'crm',
      label: 'Contactos CRM',
      items: crmContacts,
    },
  ]
    .filter((group) => group.items.length > 0)
    .sort((a, b) => {
      const aRank = a.items.length > 0 ? rankCustomerOption(a.items[0], query) : Number.MAX_SAFE_INTEGER;
      const bRank = b.items.length > 0 ? rankCustomerOption(b.items[0], query) : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.id === 'billing' ? -1 : 1;
    });
}
