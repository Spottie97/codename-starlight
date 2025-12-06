import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'starlight_auth_token';

// Get API base URL
const getApiBase = () => {
  if (typeof window === 'undefined') return '';
  return window.location.port === '8080' 
    ? 'http://localhost:4000'
    : '';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      // Verify the token is still valid
      verifyToken(storedToken).then(valid => {
        if (valid) {
          setToken(storedToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Verify token with backend
  const verifyToken = async (tokenToVerify: string): Promise<boolean> => {
    try {
      const response = await fetch(`${getApiBase()}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.valid === true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Login function
  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${getApiBase()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        setToken(data.token);
        localStorage.setItem(TOKEN_KEY, data.token);
        return { success: true };
      }

      return { 
        success: false, 
        error: data.message || 'Invalid password' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to connect to server' 
      };
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  // Get token function for API calls
  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  const value: AuthContextType = {
    isAuthenticated: !!token,
    isLoading,
    token,
    login,
    logout,
    getToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export token getter for use in API service
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Export function to clear auth (for 401 handling)
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  // Trigger a page reload to show login
  window.location.reload();
}
