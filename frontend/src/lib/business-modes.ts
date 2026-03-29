export type WorkspaceMode = 'servicos' | 'comercio';

export function isComercio(mode?: WorkspaceMode | string | null): boolean {
  return mode === 'comercio';
}

export function getLandingRoute(mode?: WorkspaceMode | string | null): string {
  return '/';
}
