import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { TenantFilterProvider } from './context/TenantFilterContext';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './pages/Dashboard';
import { Sessions } from './pages/Sessions';
import { AuditExplorer } from './pages/AuditExplorer';
import { Tenants } from './pages/Tenants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1
    }
  }
});

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('/');

  const renderContent = () => {
    switch (currentPath) {
      case '/':
        return <Dashboard onNavigate={setCurrentPath} />;
      case '/sessions':
        return <Sessions />;
      case '/audit':
        return <AuditExplorer />;
      case '/tenants':
        return <Tenants />;
      default:
        return <Dashboard onNavigate={setCurrentPath} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantFilterProvider>
          <Shell currentPath={currentPath} onNavigate={setCurrentPath}>
            {renderContent()}
          </Shell>
        </TenantFilterProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
