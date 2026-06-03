/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Bell, Clock, Megaphone, Trash2, Check, Sparkles, Inbox, 
  BellRing, Megaphone as PushIcon
} from 'lucide-react';
import { Deadline, Announcement, Activity } from '../types';
import GlassCard from './GlassCard';

export interface NotificationItem {
  id: string;
  type: 'deadline' | 'announcement' | 'schedule';
  title: string;
  body: string;
  time: string; // e.g., "1 hour ago"
  isRead: boolean;
  priority: 'high' | 'medium' | 'info';
  referenceTab: 'schedule' | 'deadlines' | 'announcements' | 'modules';
}

interface NotificationsPageProps {
  deadlines: Deadline[];
  announcements: Announcement[];
  activities: Activity[];
  onBack: () => void;
  onNavigateToTab: (tab: any) => void;
  notifications: NotificationItem[];
  isCourseRep?: boolean;
  onMarkAllAsRead: () => void;
  onToggleRead: (id: string) => void;
  onClearNotifications: () => void;
}

export default function NotificationsPage({
  onBack,
  onNavigateToTab,
  notifications,
  isCourseRep = false,
  onMarkAllAsRead,
  onToggleRead,
  onClearNotifications
}: NotificationsPageProps) {
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Automatically mark all notifications as received and read when the user views the page
  useEffect(() => {
    if (unreadCount > 0) {
      onMarkAllAsRead();
    }
  }, [unreadCount]);

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
              <Bell className="w-5 h-5 text-indigo-400" />
              <span>Inbox & Messages</span>
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Live notifications and system platform alerts
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-full animate-pulse">
            {unreadCount} Unread
          </span>
        )}
      </div>

      {/* Button to Nav to Push Configuration Console for Course Rep */}
      {isCourseRep && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="pb-2"
        >
          <GlassCard className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping shrink-0 mt-1" />
              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">Representative Push Console</h4>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">Configure background push alerts, target audience filters, and analyze active student devices.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('push-config')}
              className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-extrabold text-2xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer border border-amber-400/20 whitespace-nowrap text-center"
            >
              Open Push Config &rarr;
            </button>
          </GlassCard>
        </motion.div>
      )}

      {/* Control Actions toolbar */}
      {notifications.length > 0 && (
        <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-slate-900">
          <button
            onClick={onMarkAllAsRead}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-505/10 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>

          <button
            onClick={onClearNotifications}
            className="text-xs font-semibold text-slate-500 hover:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear archives</span>
          </button>
        </div>
      )}

      {/* Main Stream Stack */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-rich-black/10 pb-2">
          <BellRing className="w-4 h-4 text-indigo-400 shrink-0" />
          <h3 className="text-sm font-display font-black text-slate-200">Alert History</h3>
        </div>

        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 text-center"
            >
              <GlassCard className="py-12 border-dashed border-slate-850 max-w-sm mx-auto flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-slate-850 text-indigo-400 mb-4 shadow-inner">
                  <Inbox className="w-5 h-5" />
                </div>
                <h4 className="text-base font-display font-bold text-slate-200">Your tray is empty</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans px-4">
                  All caught up! No recent course reschedules, deadlines, or announcements published by representatives.
                </p>
              </GlassCard>
            </motion.div>
          ) : (
            notifications.map((item, idx) => {
              const Icon = 
                item.type === 'deadline' ? Clock : 
                item.type === 'announcement' ? Megaphone : Bell;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  <GlassCard
                    onClick={() => onToggleRead(item.id)}
                    className={`glassmorphism-hover relative transition-all duration-300 border-l-[3px] cursor-pointer ${
                      item.isRead 
                        ? 'opacity-65 bg-slate-900/10 border-slate-905/20 h-auto' 
                        : item.priority === 'high' 
                        ? 'border-rose-500 bg-rose-500/5 shadow-[0_4px_16px_rgba(244,63,94,0.06)]' 
                        : 'border-indigo-500 bg-indigo-500/2 shadow-[0_4px_16px_rgba(99,102,241,0.06)]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Sub-type icon container */}
                      <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                        item.isRead 
                          ? 'bg-slate-950 border-slate-850 text-slate-500' 
                          : item.priority === 'high' 
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Info payload */}
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-mono uppercase font-bold tracking-wider ${
                            item.priority === 'high' ? 'text-rose-400' : 'text-indigo-400'
                          }`}>
                            {item.type} {item.priority === 'high' && '• ALERT'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">{item.time}</span>
                        </div>

                        <h3 className={`text-sm font-display font-semibold ${
                          item.isRead ? 'text-slate-400' : 'text-slate-100'
                        }`}>
                          {item.title}
                        </h3>

                        <p className={`text-xs font-sans ${
                          item.isRead ? 'text-slate-500' : 'text-slate-300'
                        } leading-relaxed`}>
                          {item.body}
                        </p>

                        {/* Quick action redirect shortcut buttons */}
                        <div className="pt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleRead(item.id);
                            }}
                            className={`text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
                              item.isRead ? 'text-slate-500' : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                          >
                            {item.isRead ? 'Checked' : 'Mark Read'}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleRead(item.id); // auto read
                              onNavigateToTab(item.referenceTab);
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 cursor-pointer"
                          >
                            Open Details &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Ambient tip board */}
      <GlassCard className="p-3.5 bg-slate-950/20 border-slate-900 flex items-start gap-2 max-w-sc">
        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
          Notifications are dynamically compiled whenever Course Representatives push class reschedules, assignment sheets or handouts. Read items are saved locally on this student device.
        </p>
      </GlassCard>
    </div>
  );
}
