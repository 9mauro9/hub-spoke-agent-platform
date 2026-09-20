import React from 'react';
import { Calendar, ShieldAlert, ShieldCheck, UserCheck, Search } from 'lucide-react';
import { TenantPicker } from './TenantPicker';
import { useTenantFilter } from '../../context/TenantFilterContext';
import { useAuth } from '../../context/AuthContext';
import { DateRangeOption, UserPersona } from '../../types/telemetry';
import { Badge } from '../common/Badge';

export const Header: React.FC = () => {
  const { dateRange, setDateRange, searchQuery, setSearchQuery } = useTenantFilter();
  const { persona, setPersona, isOpsAdmin, currentUser } = useAuth();

  const dateOptions: { label: string; value: DateRangeOption }[] = [
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' }
  ];

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Tenant Picker & Global Quick Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <TenantPicker />

        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Global search (email, user ID, resource ID)..."
            className="w-full bg-slate-900 border border-slate-800/90 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
        </div>
      </div>

      {/* Right: Date Range, Persona Switcher & Identity */}
      <div className="flex items-center gap-3">
        {/* Date Range Selector */}
        <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <div className="px-2 py-1 text-slate-400 flex items-center gap-1 border-r border-slate-800/80">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Range</span>
          </div>
          {dateOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                dateRange === opt.value
                  ? 'bg-slate-800 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Persona Switcher Toggle (Help Desk vs Ops Admin) */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setPersona('helpdesk_viewer')}
            title="Help Desk Viewer Mode: Masks IP addresses, disables destructive eviction actions"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              !isOpsAdmin
                ? 'bg-sky-950 text-sky-300 border border-sky-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Help Desk</span>
          </button>
          <button
            onClick={() => setPersona('ops_admin')}
            title="Ops Admin Mode: Unmasked IP view, manual session disconnect, full raw data exports"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              isOpsAdmin
                ? 'bg-purple-950 text-purple-300 border border-purple-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Ops Admin</span>
          </button>
        </div>

        {/* User Identity Info */}
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            {currentUser.displayName.charAt(0)}
          </div>
          <div className="text-left">
            <div className="text-xs font-medium text-slate-200 leading-tight">
              {currentUser.displayName}
            </div>
            <div className="text-[10px] text-slate-500 font-mono leading-tight">
              {currentUser.email}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
