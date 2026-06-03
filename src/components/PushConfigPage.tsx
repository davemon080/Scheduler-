/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Bell, Clock, Megaphone, Smartphone, BellRing, Laptop, 
  Apple, Users, Send, Loader2, RefreshCw, GraduationCap, CheckCircle2, Sparkles
} from 'lucide-react';
import GlassCard from './GlassCard';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PushConfigPageProps {
  onBack: () => void;
  isCourseRep?: boolean;
}

export default function PushConfigPage({
  onBack,
  isCourseRep = false
}: PushConfigPageProps) {
  // Rep telemetry & command state
  const [devices, setDevices] = useState<any[]>([]);
  const [pushSubs, setPushSubs] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Broadcaster states
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushCategory, setPushCategory] = useState<'schedule' | 'deadlines' | 'announcements' | 'modules'>('announcements');
  const [targetGroup, setTargetGroup] = useState<'all' | 'standalone' | 'platform' | 'matric'>('all');
  const [targetPlatform, setTargetPlatform] = useState<'ios' | 'android' | 'web' | 'macos' | 'windows'>('ios');
  const [targetMatric, setTargetMatric] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; matched?: number } | null>(null);

  const fetchStats = async () => {
    if (!db || !isCourseRep) return;
    setLoadingStats(true);
    try {
      // 1. Fetch registered devices (for hardware stats)
      const devDocs = await getDocs(collection(db, 'devices'));
      const listDevs = devDocs.docs.map(d => ({ id: d.id, ...d.data() }));
      setDevices(listDevs);

      // 2. Fetch active push subscriptions (for target reach stats)
      const subDocs = await getDocs(collection(db, 'push-subscriptions'));
      const listSubs = subDocs.docs.map(d => ({ id: d.id, ...d.data() }));
      setPushSubs(listSubs);
    } catch (err) {
      console.error('Failed fetching device stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isCourseRep) {
      fetchStats();
    }
  }, [isCourseRep]);

  const handleSendTargetedPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) return;
    setIsSending(true);
    setSendResult(null);

    let finalVal = '';
    if (targetGroup === 'platform') {
      finalVal = targetPlatform;
    } else if (targetGroup === 'matric') {
      finalVal = targetMatric.trim();
    }

    try {
      const res = await fetch('/api/send-broadcast-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushTitle.trim(),
          body: pushBody.trim(),
          category: pushCategory,
          targetGroup,
          targetValue: finalVal
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSendResult({
          success: true,
          message: `Targeted notification discharged successfully to both direct channels.`,
          matched: data.count
        });
        setPushBody('');
        fetchStats();
      } else {
        const errData = await res.json();
        setSendResult({
          success: false,
          message: errData.error || 'Failed to dispatch notification.'
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'An error occurred.'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Stats calculation
  const totalDevices = devices.length;
  const pwaDevicesCount = devices.filter(d => d.isStandalone || d.isInstalled === true).length;
  const pushSubsCount = pushSubs.length;

  const iOSCount = devices.filter(d => d.platform === 'iOS').length || pushSubs.filter(s => s.platform === 'iOS').length;
  const androidCount = devices.filter(d => d.platform === 'Android').length || pushSubs.filter(s => s.platform === 'Android').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-slate-900/40 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-display font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-400" />
              <span>Push Notification System</span>
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Command console for broadcasting live alerts and analyzing student device statistics
            </p>
          </div>
        </div>
      </div>

      {isCourseRep ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header Tag */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">Representative Dispatch Desk</span>
            </div>
            <button
              onClick={fetchStats}
              disabled={loadingStats}
              className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-900/50 rounded-lg transition-all"
              title="Refresh device parameters"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
              <Smartphone className="w-8 h-8 text-amber-400/20 absolute right-4 top-4" />
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Registered Devices</h4>
              <p className="text-3xl font-display font-black text-slate-100 mt-1">{totalDevices || pushSubsCount || 0}</p>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Active hardware profiles recorded</span>
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
              <BellRing className="w-8 h-8 text-indigo-400/20 absolute right-4 top-4" />
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Push Subscribers</h4>
              <p className="text-3xl font-display font-black text-indigo-400 mt-1">{pushSubsCount}</p>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Subscribed targets (ready for offline alarms)</span>
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
              <Laptop className="w-8 h-8 text-indigo-400/20 absolute right-4 top-4" />
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">App Installs (PWA)</h4>
              <p className="text-3xl font-display font-black text-slate-100 mt-1">{pwaDevicesCount || pushSubs.filter(s => s.isStandalone).length || 0}</p>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Launched on Home Screen (Standalone mode)</span>
              </div>
            </GlassCard>
          </div>

          {/* Platform breakdown */}
          <GlassCard className="p-4 bg-slate-950/20 border-slate-900/80">
            <h4 className="text-xs font-display font-bold text-slate-200 uppercase tracking-widest mb-3">Audience Operating Systems</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="flex items-center gap-1 text-slate-400"><Apple className="w-3.5 h-3.5" /> iOS Users (Safari PWA)</span>
                  <span className="text-slate-200 font-bold">{iOSCount}</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-400 h-1.5 rounded-full transition-all" 
                    style={{ width: `${totalDevices > 0 ? (iOSCount / totalDevices) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="flex items-center gap-1 text-slate-400"><Smartphone className="w-3.5 h-3.5" /> Android Users (Chrome PWA)</span>
                  <span className="text-slate-200 font-bold">{androidCount}</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-400 h-1.5 rounded-full transition-all" 
                    style={{ width: `${totalDevices > 0 ? (androidCount / totalDevices) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Form container: Targeted Dispatch Desk */}
          <GlassCard className="p-5 bg-slate-950/60 border-slate-900">
            <div className="flex items-center gap-2.5 border-b border-rich-black/30 pb-3 mb-4">
              <Megaphone className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-display font-black text-slate-100">Broadcast Targeted Push Alerts</h3>
                <p className="text-[10px] text-slate-400">Offline devices and general push subscribers will receive these alerts directly</p>
              </div>
            </div>

            <form onSubmit={handleSendTargetedPush} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Alert Title</label>
                  <input
                    type="text"
                    required
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="e.g. Rescheduled Lab Practical 🧪"
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-505 placeholder:text-slate-600 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">System Category Mapping</label>
                  <select
                    value={pushCategory}
                    onChange={(e: any) => setPushCategory(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-indigo-300 focus:outline-none focus:border-indigo-505 font-mono cursor-pointer"
                  >
                    <option value="announcements">Notice / Bulletin boards</option>
                    <option value="schedule">Schedule & Timetables</option>
                    <option value="deadlines">Coursework & Deadlines</option>
                    <option value="modules">Study Materials / Handouts</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Detailed Message Body</label>
                <textarea
                  required
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="Enter specific instructions here..."
                  rows={3}
                  className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-505 placeholder:text-slate-600 font-sans resize-none"
                />
              </div>

              {/* Target Filtering Options Grid */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Select Target Audience Group</label>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetGroup('all')}
                    className={`py-2 px-3 text-2xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all border flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      targetGroup === 'all' 
                        ? 'bg-indigo-505/10 border-indigo-400 text-indigo-400 shadow-md' 
                        : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>All Devices</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetGroup('standalone')}
                    className={`py-2 px-3 text-2xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all border flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      targetGroup === 'standalone' 
                        ? 'bg-indigo-505/10 border-indigo-400 text-indigo-400 shadow-md' 
                        : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>PWA App Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetGroup('platform');
                      setTargetPlatform('ios');
                    }}
                    className={`py-2 px-3 text-2xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all border flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      targetGroup === 'platform' && targetPlatform === 'ios'
                        ? 'bg-indigo-505/10 border-indigo-400 text-indigo-400 shadow-md' 
                        : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Apple className="w-4 h-4" />
                    <span>iOS Standalone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetGroup('platform');
                      setTargetPlatform('android');
                    }}
                    className={`py-2 px-3 text-2xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all border flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      targetGroup === 'platform' && targetPlatform === 'android'
                        ? 'bg-indigo-505/10 border-indigo-400 text-indigo-400 shadow-md' 
                        : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Android App</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetGroup('matric')}
                    className={`py-2 px-3 text-2xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all border flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      targetGroup === 'matric' 
                        ? 'bg-indigo-505/10 border-indigo-400 text-indigo-400 shadow-md' 
                        : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Single Student</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Target Arguments Context */}
              <AnimatePresence mode="popLayout">
                {targetGroup === 'matric' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1 block"
                  >
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">Filter Student Matriculation Number</label>
                    <input
                      type="text"
                      required
                      value={targetMatric}
                      onChange={(e) => setTargetMatric(e.target.value)}
                      placeholder="e.g. CHM/2026/0993"
                      className="w-full md:w-1/2 bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-505 placeholder:text-slate-600 font-mono"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons and send outcomes */}
              <div className="pt-2 flex flex-col md:flex-row justify-between items-center gap-3">
                <button
                  type="submit"
                  disabled={isSending || !pushTitle.trim() || !pushBody.trim()}
                  className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-tr from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-sans font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-amber-300/10"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Send className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{isSending ? 'Sending Wave...' : 'Fire Targeted Push'}</span>
                </button>

                {sendResult && (
                  <div className={`p-2 px-3.5 rounded-xl border text-2xs font-mono font-bold max-w-md ${
                    sendResult.success 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-505/10 border-rose-505/20 text-rose-400'
                  }`}>
                    {sendResult.message} {sendResult.matched !== undefined && `(Sent to ${sendResult.matched} matching devices)`}
                  </div>
                )}
              </div>
            </form>
          </GlassCard>
        </motion.div>
      ) : (
        <GlassCard className="p-8 text-center bg-slate-950/40 border-slate-900 max-w-sm mx-auto">
          <p className="text-slate-400 text-sm">You must be logged in as a Course Representative to access the push configuration console.</p>
        </GlassCard>
      )}
    </div>
  );
}
