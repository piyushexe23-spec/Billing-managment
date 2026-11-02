export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: {
    username: string;
    role: string;
    displayName: string;
  } | null;
  isLoading: boolean;
  error: string | null;
}

