export type WorkspaceMode = 'servicos' | 'comercio';

export function isComercio(mode?: WorkspaceMode | string | null): boolean {
  return mode === 'comercio';
}
