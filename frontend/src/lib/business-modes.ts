export type WorkspaceMode = 'servicos' | 'comercio' | 'gestao_kpi' | 'food';

export function isComercio(mode?: WorkspaceMode | string | null): boolean {
  return mode === 'comercio';
}

export function isGestaoKpi(mode?: WorkspaceMode | string | null): boolean {
  return mode === 'gestao_kpi';
}

export function isFood(mode?: WorkspaceMode | string | null): boolean {
  return mode === 'food';
}
