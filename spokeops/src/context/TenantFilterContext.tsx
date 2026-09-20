import React, { createContext, useContext, useState, useEffect } from 'react';
import { DateRangeOption, TenantRegistryDoc } from '../types/telemetry';
import { telemetryService } from '../services/firebase';

interface TenantFilterContextType {
  selectedTenant: string; // 'all' or specific appId
  setSelectedTenant: (appId: string) => void;
  dateRange: DateRangeOption;
  setDateRange: (range: DateRangeOption) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tenants: TenantRegistryDoc[];
  isLoadingTenants: boolean;
  selectedTenantMeta?: TenantRegistryDoc;
}

const TenantFilterContext = createContext<TenantFilterContextType | undefined>(undefined);

export const TenantFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('24h');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tenants, setTenants] = useState<TenantRegistryDoc[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    telemetryService
      .getTenants()
      .then((data) => {
        if (isMounted) {
          setTenants(data);
          setIsLoadingTenants(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load tenant list:', err);
        if (isMounted) setIsLoadingTenants(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTenantMeta = tenants.find((t) => t.appId === selectedTenant);

  return (
    <TenantFilterContext.Provider
      value={{
        selectedTenant,
        setSelectedTenant,
        dateRange,
        setDateRange,
        searchQuery,
        setSearchQuery,
        tenants,
        isLoadingTenants,
        selectedTenantMeta
      }}
    >
      {children}
    </TenantFilterContext.Provider>
  );
};

export const useTenantFilter = (): TenantFilterContextType => {
  const context = useContext(TenantFilterContext);
  if (!context) {
    throw new Error('useTenantFilter must be used within a TenantFilterProvider');
  }
  return context;
};
