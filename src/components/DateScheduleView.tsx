/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Clock, MapPin, Trash2, Pencil, Plus, ExternalLink, RefreshCw, Calendar, Tag, AlertTriangle } from 'lucide-react';
import { DayOfWeek, Activity } from '../types';
import GlassCard from './GlassCard';

interface DateScheduleViewProps {
  selectedDate: Date;
  activities: Activity[];
  isCourseRep: boolean;
  onBackToCalendar: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onAddActivityClick: () => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DateScheduleView({
  selectedDate,
  activities,
  isCourseRep,
  onBackToCalendar,
  onEditActivity,
  onDeleteActivity,
  onAddActivityClick
}: DateScheduleViewProps) {
  const [deletedActivities, setDeletedActivities] = useState<Activity[]>([]);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

  // Load deleted activities archive from local storage
  const loadDeletedActivities = () => {
    try {
      const stored = localStorage.getItem('ich100l_deleted_activities');
      if (stored) {
        setDeletedActivities(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse deleted activities:', e);
    }
  };

  useEffect(() => {
    loadDeletedActivities();
    
    const handleUpdate = () => {
      loadDeletedActivities();
    };
    window.addEventListener('ich100l_deleted_activities_updated', handleUpdate);
    return () => window.removeEventListener('ich100l_deleted_activities_updated', handleUpdate);
  }, []);

  const getLocalYYYYMMDD = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getMondayOfWeekDate = (d: Date): string => {
    const dateCopy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = dateCopy.getDay();
    const diff = dateCopy.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dateCopy.setDate(diff));
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const dateStr = getLocalYYYYMMDD(selectedDate);
  const weekdayName = WEEKDAYS[selectedDate.getDay()] as DayOfWeek;

  const mondayOfCell = getMondayOfWeekDate(selectedDate);
  const mondayOfCurrent = getMondayOfWeekDate(new Date());

  let activeSchedules: Activity[] = [];
  let deletedSchedules: Activity[] = [];

  if (mondayOfCell < mondayOfCurrent) {
    // PAST WEEK! Load from archived bin local cache only
    deletedSchedules = deletedActivities.filter(act => {
      if (act.date) {
        return act.date === dateStr;
      }
      return act.day === weekdayName;
    }).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
  } else {
    // CURRENT WEEK or FUTURE WEEK! Load live active schedules only (never in the bin)
    activeSchedules = activities.filter(act => {
      if (act.date) {
        return act.date === dateStr;
      }
      return act.day === weekdayName;
    }).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
  }

  const totalCount = activeSchedules.length + deletedSchedules.length;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Lecture':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
      case 'Lab':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'Tutorial':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'Exam':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  // Restore deleted schedule from archive back to database (re-add is extremely satisfying)
  const handleRestoreActivity = async (activity: Activity) => {
    try {
      // Remove from locally deleted list
      const remaining = deletedActivities.filter(a => a.id !== activity.id);
      localStorage.setItem('ich100l_deleted_activities', JSON.stringify(remaining));
      window.dispatchEvent(new Event('ich100l_deleted_activities_updated'));

      // Dispatch restore signal or trigger onAddActivity in parent
      // Stripping id and createdBy if required, or re-adding
      const cleanToRestore = { ...activity };
      delete (cleanToRestore as any).id;
      
      const response = await fetch('/api/restore-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: cleanToRestore })
      });
      
      // If server route not configured or loaded, trigger onAddActivity directly
      onAddActivityClick();
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6 pb-24 relative min-h-[60vh]">
      {/* Upper navigation headers */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onBackToCalendar}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer outline-none transition-colors"
          id="btn-back-to-calendar"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-400" />
          <span>Back to Calendar</span>
        </button>

        <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Day Timetable
        </span>
      </div>

      {/* Hero display block */}
      <div className="bg-gradient-to-tr from-slate-950/80 to-slate-900/40 border border-slate-850 p-5 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-slate-100 tracking-tight leading-none">
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-1">
              {totalCount} total schedules configured on this date
            </p>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {totalCount === 0 ? (
          <div className="py-12 text-center bg-slate-950/20 border border-slate-850 rounded-3xl p-6">
            <p className="text-sm font-display font-medium text-slate-300">No events scheduled</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto font-sans leading-relaxed">
              There are no regular classes or specific date entries defined for this calendar date.
            </p>
            {isCourseRep && (
              <button
                onClick={onAddActivityClick}
                className="mt-4 px-4 py-2 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all"
              >
                Add Schedule Now
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active section */}
            {activeSchedules.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold px-1">
                  Active Schedules ({activeSchedules.length})
                </h3>
                {activeSchedules.map((activity) => (
                  <div key={`active-${activity.id}`}>
                    <GlassCard className="border-l-2 border-l-indigo-500/80 hover:border-l-indigo-400 transition-all duration-200">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-mono font-black tracking-wide text-indigo-400 bg-slate-950/60 px-2.5 py-0.5 rounded border border-indigo-500/20 uppercase">
                                {activity.courseCode}
                              </span>
                              <span className={`text-[8px] font-sans font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(activity.category)}`}>
                                {activity.category}
                              </span>
                              {activity.date && (
                                <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                                  Single Date Event
                                </span>
                              )}
                              {activity.deliveryType === 'online' ? (
                                <span className="text-[8px] font-sans font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Online
                                </span>
                              ) : (
                                <span className="text-[8px] font-sans font-medium px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-850">
                                  Physical
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-display font-extrabold text-slate-100 leading-tight">
                              {activity.title}
                            </h4>

                            {activity.description && (
                              <p className="text-[11px] text-slate-400 leading-normal font-sans">
                                {activity.description}
                              </p>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 pt-1 text-[10px] text-slate-500 font-sans">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-indigo-400/80" />
                                <span className="font-mono text-slate-300">{activity.timeStart} - {activity.timeEnd}</span>
                              </span>
                              <span className="hidden sm:inline text-slate-700">•</span>
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3.5 h-3.5 text-rose-500/80" />
                                <span className="truncate">{activity.location}</span>
                              </span>
                            </div>
                          </div>

                          {activity.classLink && activity.deliveryType === 'online' && (
                            <a
                              href={activity.classLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 transition-colors"
                              title="Join online class session"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        {/* Edit and Delete Actions for course rep */}
                        {isCourseRep && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900/40">
                            <button
                              onClick={() => onEditActivity(activity)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-[10px] font-bold font-sans flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-indigo-400" />
                              <span>Edit Parameters</span>
                            </button>
                            <button
                              onClick={() => setActivityToDelete(activity)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-[10px] font-bold font-sans flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </div>
                ))}
              </div>
            )}

            {/* Locally deleted registry schedules section */}
            {deletedSchedules.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] uppercase font-mono tracking-widest text-rose-400 font-bold flex items-center gap-1">
                    <span>Recovered Trash Storage ({deletedSchedules.length})</span>
                  </h3>
                  <button
                    onClick={() => {
                      localStorage.removeItem('ich100l_deleted_activities');
                      window.dispatchEvent(new Event('ich100l_deleted_activities_updated'));
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-mono font-bold hover:underline cursor-pointer bg-transparent border-none outline-none"
                  >
                    Clear Trash
                  </button>
                </div>
                {deletedSchedules.map((activity) => (
                  <div key={`deleted-${activity.id}`}>
                    <GlassCard className="border-l-2 border-l-rose-500/40 bg-rose-950/5 hover:bg-rose-950/10 transition-all duration-200">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-mono font-black tracking-wide text-rose-400/80 bg-slate-950/60 px-2.5 py-0.5 rounded border border-rose-500/20 uppercase">
                            🗑️ {activity.courseCode}
                          </span>
                          <span className={`text-[8px] font-sans font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(activity.category)}`}>
                            {activity.category}
                          </span>
                          <span className="text-[8px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-widest leading-none font-bold">
                            Local Cached Bin
                          </span>
                        </div>

                        <h4 className="text-sm font-display font-extrabold text-slate-300 leading-tight line-through opacity-70">
                          {activity.title}
                        </h4>

                        {activity.description && (
                          <p className="text-[11px] text-slate-500 leading-normal font-sans line-through">
                            {activity.description}
                          </p>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 pt-1 text-[10px] text-slate-600 font-sans">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-705" />
                            <span className="font-mono">{activity.timeStart} - {activity.timeEnd}</span>
                          </span>
                          <span className="hidden sm:inline text-slate-800">•</span>
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-705" />
                            <span className="truncate">{activity.location}</span>
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action FAB Plus button on bottom right of the page ONLY for Course Rep */}
      {isCourseRep && (
        <div className="fixed bottom-24 right-5 sm:right-1/2 sm:translate-x-48 z-40">
          <button
            onClick={onAddActivityClick}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white flex items-center justify-center p-0 transition-transform hover:scale-110 active:scale-95 shadow-[0_8px_32px_rgba(99,102,241,0.5)] cursor-pointer outline-none relative group"
            title="Create single date schedule"
          >
            <span className="absolute inset-x-0 inset-y-0 rounded-full bg-indigo-500/30 animate-ping group-hover:block" />
            <Plus className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Single activity deletion dialog panel confirmation */}
      {activityToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center text-xl font-bold mx-auto border border-rose-500/20">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-slate-100 font-display font-bold text-base">Delete Class Schedule?</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Are you sure you want to completely erase "{activityToDelete.title}" from the class timeline? All students will lose realtime visibility.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Keep Event
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteActivity(activityToDelete.id);
                  setActivityToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all hover:shadow-[0_4px_16px_rgba(244,63,94,0.3)] cursor-pointer"
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
