import React from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import { useTenantFilter } from '../../context/TenantFilterContext';

export const TenantPicker: React.FC = () => {
  const { selectedTenant, setSelectedTenant, tenants, isLoadingTenants } = useTenantFilter();

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-700 transition-colors">
        <Layers className="w-3.5 h-3.5 text-brand-400" />
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          disabled={isLoadingTenants}
          aria-label="Select Spoke Tenant"
          className="bg-transparent appearance-none pr-6 font-medium text-slate-200 focus:outline-none cursor-pointer"
        >
          <option value="all" className="bg-slate-900 text-slate-200">
            All Applications
          </option>
          {tenants.map((t) => (
            <option key={t.appId} value={t.appId} className="bg-slate-900 text-slate-200">
              {t.appName} {t.environment !== 'production' ? `(${t.environment})` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 pointer-events-none" />
      </div>
    </div>
  );
};
