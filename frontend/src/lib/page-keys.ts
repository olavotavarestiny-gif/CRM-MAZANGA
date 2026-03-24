export const PAGE_KEYS = [
  { key: 'painel',      label: 'Painel',       href: '/' },
  { key: 'pipeline',    label: 'Negociações',   href: '/pipeline' },
  { key: 'contacts',    label: 'Contactos',     href: '/contacts' },
  { key: 'tasks',       label: 'Tarefas',       href: '/tasks' },
  { key: 'calendario',  label: 'Calendário',    href: '/calendario' },
  { key: 'chat',        label: 'Conversas',     href: '/chat' },
  { key: 'automations', label: 'Automações',    href: '/automations' },
  { key: 'forms',       label: 'Formulários',   href: '/forms' },
  { key: 'finances',    label: 'Finanças',      href: '/finances' },
  { key: 'produtos',    label: 'Produtos',      href: '/produtos' },
] as const;

export type PageKey = typeof PAGE_KEYS[number]['key'];

export function hrefToKey(href: string): PageKey | null {
  // Normalise to first path segment (e.g. /contacts/123 → /contacts)
  const normalised = href === '/' ? '/' : '/' + href.replace(/^\//, '').split('/')[0];
  const match = PAGE_KEYS.find(p => p.href === normalised);
  return (match?.key ?? null) as PageKey | null;
}
