import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserPersona } from '../types/telemetry';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserPersona;
}

interface AuthContextType {
  currentUser: UserProfile;
  persona: UserPersona;
  setPersona: (persona: UserPersona) => void;
  isOpsAdmin: boolean;
  isHelpDesk: boolean;
  maskIpAddress: (ip: string) => string;
}

const DEFAULT_USER: UserProfile = {
  uid: 'usr_ops_01',
  email: 'admin.operator@spokeops.corp',
  displayName: 'Operations Lead',
  role: 'ops_admin'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persona, setPersonaState] = useState<UserPersona>(() => {
    const saved = localStorage.getItem('spokeops_persona');
    return (saved as UserPersona) || 'ops_admin';
  });

  const setPersona = (p: UserPersona) => {
    setPersonaState(p);
    localStorage.setItem('spokeops_persona', p);
  };

  const isOpsAdmin = persona === 'ops_admin';
  const isHelpDesk = persona === 'helpdesk_viewer';

  /**
   * Automatically masks IP addresses for Help Desk persona according to AES v3 privacy standard
   * e.g., '192.168.1.104' -> '192.168.***.***'
   * or '10.240.12.88' -> '10.240.***.***'
   */
  const maskIpAddress = (ip: string): string => {
    if (isOpsAdmin) return ip;

    if (!ip) return '***.***.***.***';

    // IPv4 standard masking: preserve first 2 octets, mask last 2
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }

    // IPv6 masking: preserve first 2 segments
    const v6Parts = ip.split(':');
    if (v6Parts.length > 2) {
      return `${v6Parts[0]}:${v6Parts[1]}:****:****`;
    }

    return '***.***.***.***';
  };

  const currentUser: UserProfile = {
    ...DEFAULT_USER,
    role: persona,
    displayName: isOpsAdmin ? 'Operations Administrator' : 'Tier-1 Help Desk Agent'
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        persona,
        setPersona,
        isOpsAdmin,
        isHelpDesk,
        maskIpAddress
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
