export type LoginErrorCode =
  | 'LOGIN_NETWORK_ERROR'
  | 'LOGIN_TIMEOUT'
  | 'LOGIN_CORS_ERROR'
  | 'LOGIN_BACKEND_UNAVAILABLE'
  | 'LOGIN_AUTH_PROVIDER_UNAVAILABLE'
  | 'LOGIN_PROFILE_LOAD_FAILED'
  | 'LOGIN_SESSION_CREATED_BUT_PROFILE_FAILED'
  | 'LOGIN_REDIRECT_LOOP'
  | 'LOGIN_INVALID_CREDENTIALS'
  | 'LOGIN_CONFIG_ERROR'
  | 'LOGIN_UNAUTHENTICATED'
  | 'LOGIN_UNKNOWN_ERROR';

export type LoginTechnicalError = {
  code: LoginErrorCode;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export function getLoginUserMessage(code?: string) {
  switch (code) {
    case 'LOGIN_INVALID_CREDENTIALS':
      return 'Email ou password incorretos.';
    case 'LOGIN_TIMEOUT':
      return 'A ligação demorou demasiado. Tente novamente.';
    case 'LOGIN_BACKEND_UNAVAILABLE':
      return 'O servidor está temporariamente indisponível. Tente novamente.';
    case 'LOGIN_AUTH_PROVIDER_UNAVAILABLE':
      return 'O serviço de autenticação está temporariamente indisponível.';
    case 'LOGIN_PROFILE_LOAD_FAILED':
    case 'LOGIN_SESSION_CREATED_BUT_PROFILE_FAILED':
      return 'A sessão foi criada, mas não conseguimos carregar a sua conta.';
    case 'LOGIN_CONFIG_ERROR':
      return 'Existe um erro de configuração no ambiente.';
    case 'LOGIN_CORS_ERROR':
      return 'O servidor recusou a ligação desta origem.';
    case 'LOGIN_NETWORK_ERROR':
      return 'Falha de rede ao ligar ao serviço.';
    case 'LOGIN_REDIRECT_LOOP':
      return 'Foi detetado um redirecionamento inválido.';
    default:
      return 'Não foi possível concluir o login. Tente novamente.';
  }
}

export function isRetryableLoginCode(code?: string) {
  return (
    code === 'LOGIN_NETWORK_ERROR' ||
    code === 'LOGIN_TIMEOUT' ||
    code === 'LOGIN_BACKEND_UNAVAILABLE' ||
    code === 'LOGIN_AUTH_PROVIDER_UNAVAILABLE' ||
    code === 'LOGIN_PROFILE_LOAD_FAILED' ||
    code === 'LOGIN_SESSION_CREATED_BUT_PROFILE_FAILED'
  );
}
