export const PAGE_KEYS = [
  { key: 'painel',      label: 'Painel',       href: '/' },
  { key: 'contacts',    label: 'Clientes',      href: '/contacts' },
  { key: 'pipeline',    label: 'Processos de Venda', href: '/pipeline' },
  { key: 'tasks',       label: 'Tarefas',       href: '/tasks' },
  { key: 'vendas',      label: 'Vendas',        href: '/vendas' },
  { key: 'calendario',  label: 'Calendário',    href: '/calendario' },
  { key: 'chat',        label: 'Conversas',     href: '/chat' },
  { key: 'automations', label: 'Automações',    href: '/automations' },
  { key: 'forms',       label: 'Formulários',   href: '/forms' },
  { key: 'finances',    label: 'Finanças',      href: '/finances' },
] as const;

export type PageKey = typeof PAGE_KEYS[number]['key'];

export function hrefToKey(href: string): PageKey | null {
  // Normalise to first path segment (e.g. /contacts/123 → /contacts)
  const normalised = href === '/' ? '/' : '/' + href.replace(/^\//, '').split('/')[0];
  const match = PAGE_KEYS.find(p => p.href === normalised);
  return (match?.key ?? null) as PageKey | null;
}
