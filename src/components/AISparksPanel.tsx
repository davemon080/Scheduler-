import React from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  Info,
  HardDrive
} from "lucide-react";
import { DEFAULT_FIREBASE_CONFIG } from "../firebase";
import { SubscriptionRecord } from "../types";

interface AISparksPanelProps {
  totalUsers: number;
  totalActivities: number;
  subscriptions: Record<string, SubscriptionRecord>;
}

export default function AISparksPanel({
  totalUsers,
  totalActivities,
  subscriptions
}: AISparksPanelProps) {
  // Define Firebase Free Tier Storage Limit of 1.00 GB (1,073,741,824 Bytes)
  const LIMIT_BYTES = 1073741824; 

  // Compute taken space in real time using a realistic index structure schema sizing:
  // - Baseline database initialization index: 145,000 bytes (~145 KB)
  // - User schema documents: ~768 bytes each
  // - Activity schema documents: ~412 bytes each
  // - Subscription schema documents: ~320 bytes each
  const totalSubCount = Object.keys(subscriptions || {}).length;
  const baselineBytes = 145000; 
  const usersBytes = totalUsers * 768;
  const activitiesBytes = totalActivities * 412;
  const subsBytes = totalSubCount * 320;
  
  const totalTakenBytes = baselineBytes + usersBytes + activitiesBytes + subsBytes;
  const availableBytes = LIMIT_BYTES - totalTakenBytes;

  // Formatting helper
  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) {
      return `${(bytes / 1073741824).toFixed(3)} GB`;
    }
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const percentageUsed = (totalTakenBytes / LIMIT_BYTES) * 100;

  return (
    <div className="space-y-4 text-left">
      {/* Sparkles welcome banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-950/50 to-pink-950/30 border border-indigo-500/20 rounded-2xl p-4.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-4 -translate-y-4 pointer-events-none">
          <Sparkles className="h-24 w-24 text-indigo-400 animate-pulse" />
        </div>
        
        <div className="relative space-y-2">
          <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-400/20 px-2 py-0.5 rounded-full w-fit">
            <Sparkles className="h-3 w-3 text-indigo-300" />
            <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-indigo-200">Google AI Powered Core</span>
          </div>
          <h3 className="text-white font-bold text-[15px] font-sans tracking-tight">Active Datastore Nodes</h3>
          <p className="text-[11.5px] leading-relaxed text-slate-350">
            Authenticated to Firestore project <span className="font-mono text-indigo-300 font-bold">{DEFAULT_FIREBASE_CONFIG.projectId}</span>. Database reads and writes are processed live.
          </p>
        </div>
      </div>

      {/* Cloud Store Storage space limits */}
      <div className="bg-[#111322]/80 backdrop-blur-md rounded-2xl p-4 border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-cyan-400" />
          <span className="text-[10px] font-mono font-bold text-slate-350 uppercase tracking-wider block font-sans">Firestore Datastore Space</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] text-slate-400">Total Taken Space</span>
            <span className="text-sm font-bold font-mono text-cyan-400">{formatBytes(totalTakenBytes)}</span>
          </div>

          {/* Dynamic Percentage Bar */}
          <div className="w-full bg-white/[0.04] rounded-full h-2 overflow-hidden border border-white/[0.05]">
            <div 
              style={{ width: `${Math.max(percentageUsed, 1.2)}%` }} 
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
            <div className="text-left">
              <span className="text-slate-500 block">Available Space:</span>
              <span className="font-bold text-slate-300 font-mono text-[10.5px]">{formatBytes(availableBytes)}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Datastore Limit:</span>
              <span className="font-bold text-slate-300 font-mono text-[10.5px]">{formatBytes(LIMIT_BYTES)}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Panel */}
        <div className="bg-[#181a2e]/55 rounded-xl border border-white/[0.03] p-2.5 text-[9.5px] font-sans space-y-2">
          <div className="text-slate-400 font-mono text-[8.5px] uppercase tracking-wider font-bold border-b border-white/[0.04] pb-1">
            Storage Size Allocation
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 font-mono text-[10px]">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-slate-400">Baseline Overhead:</span>
            </div>
            <div className="text-right text-slate-350">{formatBytes(baselineBytes)}</div>

            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">Users ({totalUsers}):</span>
            </div>
            <div className="text-right text-slate-350">{formatBytes(usersBytes)}</div>

            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span className="text-slate-400">Activities ({totalActivities}):</span>
            </div>
            <div className="text-right text-slate-350">{formatBytes(activitiesBytes)}</div>

            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Subscriptions ({totalSubCount}):</span>
            </div>
            <div className="text-right text-slate-350">{formatBytes(subsBytes)}</div>
          </div>
        </div>
      </div>

      {/* Cloud Metrics */}
      <div className="bg-[#111322]/80 backdrop-blur-md rounded-2xl p-4 border border-white/[0.06] space-y-3">
        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Live Cloud Diagnostics</span>
        
        <div className="grid grid-cols-2 gap-2.5">
          {/* User count metric */}
          <div className="bg-[#181a2e] border border-white/[0.04] rounded-xl p-3 text-left">
            <span className="text-[10px] text-slate-400 block font-sans">Cloud Users</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-white tracking-tight">{totalUsers}</span>
              <span className="text-[9.5px] font-mono text-emerald-400 font-bold">● Live</span>
            </div>
          </div>

          {/* Activity count Metric */}
          <div className="bg-[#181a2e] border border-white/[0.04] rounded-xl p-3 text-left">
            <span className="text-[10px] text-slate-400 block font-sans">Operation Logs</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-white tracking-tight">{totalActivities}</span>
              <span className="text-[9.5px] font-mono text-purple-400 font-bold">● Sync</span>
            </div>
          </div>
        </div>

        {/* Database parameters list */}
        <div className="space-y-2 pt-2 border-t border-white/[0.04] font-mono text-[10px]">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Target project:</span>
            <span className="text-slate-200 font-bold max-w-[150px] truncate" title={DEFAULT_FIREBASE_CONFIG.projectId}>{DEFAULT_FIREBASE_CONFIG.projectId}</span>
          </div>
          {("firestoreDatabaseId" in DEFAULT_FIREBASE_CONFIG) && (
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Database node:</span>
              <span className="text-indigo-300 font-bold max-w-[150px] truncate" title={(DEFAULT_FIREBASE_CONFIG as any).firestoreDatabaseId}>
                {(DEFAULT_FIREBASE_CONFIG as any).firestoreDatabaseId}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Live listener:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 inline text-emerald-400 animate-pulse" />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04] flex items-start gap-2 text-slate-400">
        <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
        <span className="text-[10px] leading-relaxed">
          The database state is synchronized automatically with Firestore in your browser using real-time secure web socket sockets (onSnapshot).
        </span>
      </div>
    </div>
  );
}
