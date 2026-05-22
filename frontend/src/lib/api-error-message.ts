export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  const status = (error as { response?: { status?: number } } | null)?.response?.status;

  if (status === 403) {
    return `${message || 'Sem permissão para carregar esta área.'} Verifique plano, permissões e workspace da conta.`;
  }

  if (status === 402) {
    return `${message || 'Acesso suspenso.'} Renove a conta para voltar a usar esta área.`;
  }

  if (status && status >= 500) {
    return `${message || 'O backend não conseguiu responder.'} Tente novamente; se persistir, valide Render, base de dados e logs da API.`;
  }

  return message || fallback;
}
