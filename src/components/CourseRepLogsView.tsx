import React, { useState } from 'react';
import { 
  ArrowLeft, Search, Calendar, FileText, Video, AlertTriangle, 
  Trash2, PlusCircle, Edit, Shield, Filter, RefreshCw
} from 'lucide-react';
import GlassCard from './GlassCard';

interface CourseRepLogsViewProps {
  logs: any[];
  onBack: () => void;
  departments: any[];
}

export default function CourseRepLogsView({
  logs,
  onBack,
  departments
}: CourseRepLogsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'schedule' | 'deadline' | 'announcement' | 'course' | 'pdf' | 'video'>('all');

  // Filter logs based on search and target type selection
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (log.repName || '').toLowerCase().includes(term) ||
      (log.repMatric || '').toLowerCase().includes(term) ||
      (log.targetName || '').toLowerCase().includes(term) ||
      (log.details || '').toLowerCase().includes(term) ||
      (log.targetType || '').toLowerCase().includes(term) ||
      (log.action || '').toLowerCase().includes(term);

    const matchesType = typeFilter === 'all' || log.targetType === typeFilter;

    return matchesSearch && matchesType;
  });

  // Helper to format date
  const formatLogDate = (isoString?: string) => {
    if (!isoString) return 'Unknown date';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoString;
    }
  };

  // Icon depending on the action type
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add':
        return <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'edit':
        return <Edit className="w-3.5 h-3.5 text-amber-400" />;
      case 'delete':
        return <Trash2 className="w-3.5 h-3.5 text-rose-450 text-rose-400" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Badges styling depending on action type
  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'add':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'edit':
        return 'bg-amber-500/10 text-amber-405 text-amber-400 border border-amber-500/20';
      case 'delete':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  // Icon based on target type
  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'schedule':
        return <Calendar className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'deadline':
        return <AlertTriangle className="w-4 h-4 text-amber-450 text-amber-400 shrink-0" />;
      case 'announcement':
        return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'course':
        return <Shield className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'video':
        return <Video className="w-4 h-4 text-red-500 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const getDeptPrefix = (deptId?: string) => {
    if (!deptId) return 'All';
    const dept = departments?.find(d => d.id === deptId);
    return dept ? dept.prefix.toUpperCase() : 'Custom';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 font-sans text-left">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/60 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 h-9 w-9 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer outline-none shadow-md"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-display font-extrabold text-slate-100 uppercase tracking-wide">
              Course Representatives Audit Logs
            </h3>
            <p className="text-[10.5px] text-slate-500 mt-0.5 leading-normal">
              Chronological surveillance logs monitoring addition, removal, and editing entries by all certified Course Representatives.
            </p>
          </div>
        </div>

        {/* Diagnostic Metadata */}
        <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-900 rounded-xl px-3.5 py-1.5 self-start sm:self-center font-mono text-[9px] text-slate-400 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span>Surveillance Engine State: </span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
            ONLINE
          </span>
        </div>
      </div>

      {/* 2. Controls Ribbon: Search + Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Search Field */}
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Representative Name, Matric Number, Target, Actions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans shadow-inner"
          />
        </div>

        {/* Filter Selection Tab Strip */}
        <div className="md:col-span-6 flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <div className="flex items-center gap-1 px-2.5 text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 shrink-0">
            <Filter className="w-3 h-3 text-slate-500" />
            <span>Target:</span>
          </div>
          {(['all', 'schedule', 'deadline', 'announcement', 'course', 'pdf', 'video'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTypeFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-sans transition-all cursor-pointer border shrink-0 ${
                typeFilter === filter
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                  : 'bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-450 hover:text-slate-200'
              }`}
            >
              {filter.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Activity Feed List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <GlassCard className="p-12 text-center bg-slate-950/20 border-slate-900/60 flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 text-slate-650 mb-3 animate-spin duration-3000 text-slate-600" />
            <h4 className="text-xs font-display font-semibold text-slate-400">No Representative Actions Tracked</h4>
            <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-relaxed">
              Either there are no logs saved inside the database yet, or your search string does not match any logged entries in the network indices.
            </p>
          </GlassCard>
        ) : (
          filteredLogs.slice(0, 150).map((log) => (
            <div key={log.id}>
              <GlassCard 
                className="p-4 bg-slate-955/40 hover:bg-slate-950/60 border-slate-900 hover:border-slate-850/80 transition-all shadow-md relative overflow-hidden"
                id={`log-card-${log.id}`}
              >
                {/* Colored left strip indicating action type */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  log.action === 'add' ? 'bg-emerald-500' : log.action === 'edit' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-2">
                  {/* Rep info + main action descriptor */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Representative Name badge */}
                      <span className="text-xs font-extrabold text-slate-250 font-sans tracking-wide">
                        {log.repName}
                      </span>
                      {/* Matric number representation */}
                      <span className="text-[9.5px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 rounded px-1.5 py-0.5 leading-none shadow-sm">
                        {log.repMatric}
                      </span>
                      {/* Department badge if specified */}
                      <span className="text-[8.5px] font-mono font-bold text-teal-400 bg-teal-500/5 border border-teal-500/10 rounded px-1.5 py-0.5 leading-none">
                        DEPT: {getDeptPrefix(log.departmentId)}
                      </span>
                    </div>

                    {/* Concrete edit descriptor detailed outline */}
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {getTargetIcon(log.targetType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 mt-0.5 font-sans font-medium line-clamp-1 leading-relaxed">
                          <span className="text-slate-450 text-[10px] tracking-wider uppercase font-mono font-bold mr-1.5">
                            [{log.targetType}]
                          </span>
                          {log.targetName}
                        </p>
                        {log.details && (
                          <p className="text-[10px] text-slate-400 font-sans mt-0.5 italic leading-relaxed">
                            &ldquo;{log.details}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side status values (Action badge + Date timestamp) */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-none border-slate-900/60 pt-2.5 md:pt-0">
                    <span className={`text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 leading-none shadow-sm ${getActionBadgeClass(log.action)}`}>
                      {getActionIcon(log.action)}
                      {log.action}
                    </span>
                    <span className="text-[9.5px] font-mono text-slate-500 text-right">
                      {formatLogDate(log.timestamp)}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
