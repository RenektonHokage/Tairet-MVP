import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isOwner: boolean;
  login: (asOwner?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const login = (asOwner = false) => {
    setIsAuthenticated(true);
    setIsOwner(asOwner);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsOwner(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isOwner, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};