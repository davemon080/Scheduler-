/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, Tag, User, Trash2, BookOpen, AlertCircle, PlusCircle, Pencil, Globe, ExternalLink, Sparkles } from 'lucide-react';
import { DayOfWeek, Activity } from '../types';
import GlassCard from './GlassCard';

interface SchedulerProps {
  activities: Activity[];
  currentUserMatric: string;
  isCourseRep: boolean;
  onDeleteActivity: (id: string) => void;
  onEditActivity: (activity: Activity) => void;
  daySelected: DayOfWeek;
  setDaySelected: (day: DayOfWeek) => void;
  onOpenCalendar: () => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export default function Scheduler({
  activities,
  currentUserMatric,
  isCourseRep,
  onDeleteActivity,
  onEditActivity,
  daySelected,
  setDaySelected,
  onOpenCalendar
}: SchedulerProps) {
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

  // Trigger time updates so Live indicators light up instantly on the minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000); // 10s checks
    return () => clearInterval(interval);
  }, []);

  // Smooth scroll active day button into view safely without shifting outer page layout
  useEffect(() => {
    const container = document.getElementById('day-buttons-container');
    const selectedBtn = document.getElementById(`day-btn-${daySelected}`);
    if (container && selectedBtn) {
      const containerWidth = container.offsetWidth;
      const btnOffsetLeft = selectedBtn.offsetLeft;
      const btnWidth = selectedBtn.offsetWidth;
      
      // Calculate scroll position to center the button within the container
      const targetScrollLeft = btnOffsetLeft - (containerWidth / 2) + (btnWidth / 2);
      
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    }
  }, [daySelected]);

  const getDateForDay = (day: DayOfWeek) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    const currentDayOfWeek = now.getDay();
    const currentMondayOffset = (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1);
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - currentMondayOffset + dayIndex);
    return targetDate.getDate();
  };

  const getMonthForDay = (day: DayOfWeek) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    const currentDayOfWeek = now.getDay();
    const currentMondayOffset = (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1);
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - currentMondayOffset + dayIndex);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[targetDate.getMonth()].toUpperCase();
  };

  const checkIfLive = (activity: Activity) => {
    try {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];

      if (activity.day !== currentDay) return false;

      const curHours = now.getHours();
      const curMins = now.getMinutes();
      const curTotal = curHours * 60 + curMins;

      const [startH, startM] = activity.timeStart.split(':').map(Number);
      const startTotal = startH * 60 + startM;

      const [endH, endM] = activity.timeEnd.split(':').map(Number);
      const endTotal = endH * 60 + endM;

      return curTotal >= startTotal && curTotal < endTotal;
    } catch {
      return false;
    }
  };

  const getYYYYMMDDForDay = (day: DayOfWeek) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(day);
    const currentDayOfWeek = now.getDay();
    const currentMondayOffset = (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1);
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - currentMondayOffset + dayIndex);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Filter activities based on selection and sort:
  // 1. Live classes are pinned to the absolute top of the day
  // 2. Followed by newest added/latest schedules descending by ID
  const activeDayActivities = activities
    .filter((act) => {
      if (act.date) {
        return act.date === getYYYYMMDDForDay(daySelected);
      }
      return act.day === daySelected;
    })
    .sort((a, b) => {
      const aLive = checkIfLive(a);
      const bLive = checkIfLive(b);

      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      // Normal schedules: Sort by newest added (e.g., ID descending)
      return b.id.localeCompare(a.id);
    });

  // Count activities for each day to render beautiful markers
  const getCountForDay = (day: DayOfWeek) => {
    return activities.filter((act) => {
      if (act.date) {
        return act.date === getYYYYMMDDForDay(day);
      }
      return act.day === day;
    }).length;
  };

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

  return (
    <div className="space-y-6">
      {/* Horizontally aligned weekdays at the top */}
      <div>
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-semibold">
            Select Day Timeline
          </h3>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-750 px-3 py-1.5 rounded-xl pointer-events-auto shadow-sm outline-none"
            id="scheduler-calendar-link"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
        </div>
        
        <div id="day-buttons-container" className="flex gap-2.5 overflow-x-auto pb-3 pt-1 no-scrollbar -mx-4 px-4 snap-x">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = daySelected === day;
            const count = getCountForDay(day);
            const shortName = day.substring(0, 3);

            return (
              <button
                key={day}
                id={`day-btn-${day}`}
                onClick={() => setDaySelected(day)}
                className={`snap-center shrink-0 min-w-[76px] py-2.5 px-3 rounded-2xl flex flex-col items-center justify-between transition-all duration-300 pointer-events-auto cursor-pointer focus:outline-none relative ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-[0_8px_24px_-4px_rgba(99,102,241,0.6)] border border-indigo-500'
                    : 'glassmorphism border border-slate-800/40 text-slate-300 hover:text-slate-100 hover:border-slate-700/80 bg-slate-950/40'
                }`}
              >
                <span className="text-[10px] font-mono font-bold tracking-tight opacity-70">
                  {shortName.toUpperCase()}
                </span>
                
                <span className="text-xl font-display font-black tracking-tight mt-0.5">
                  {getDateForDay(day)}
                </span>

                <span className="text-[9px] font-mono tracking-wider opacity-60 mb-1.5 font-bold">
                  {getMonthForDay(day)}
                </span>

                {count > 0 ? (
                  <span
                    className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                      isSelected
                        ? 'bg-slate-950/30 text-indigo-100'
                        : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    }`}
                  >
                    {count} {count === 1 ? 'act' : 'acts'}
                  </span>
                ) : (
                  <span className="text-[8px] font-mono text-slate-500 opacity-60 px-1 py-0.5">
                    Free
                  </span>
                )}

                {/* Subtle active underline glow */}
                {isSelected && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activities Feed Header */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-100 tracking-tight">
            {daySelected} Activities
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            {activeDayActivities.length} scheduled event{activeDayActivities.length === 1 ? '' : 's'} today
          </p>
        </div>
        <div className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 text-indigo-400 uppercase tracking-wider font-semibold">
          ICH100L
        </div>
      </div>

      {/* Activities Vertical Feed */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeDayActivities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="py-12 px-6"
            >
              <GlassCard className="py-10 px-6 text-center border-dashed border-slate-800/80 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-500 mb-3 animate-pulse">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                </div>
                <h4 className="text-base font-display font-bold text-slate-200">No events scheduled</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed font-sans">
                  Enjoy your day! There are no lectures, practical labs, or tutorials on {daySelected}.
                </p>
                {isCourseRep && (
                  <div className="mt-4">
                    <span className="text-[10px] text-indigo-400 bg-indigo-505/10 border border-indigo-500/20 px-2.5 py-1.5 rounded-xl font-medium font-sans animate-bounce inline-block">
                      Tap the "+" hovering icon on the bottom right to schedule a new class.
                    </span>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ) : (
            activeDayActivities.map((activity, index) => {
              const isLive = checkIfLive(activity);
              const isOnline = activity.deliveryType === 'online';

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <GlassCard
                    id={`activity-card-${activity.id}`}
                    accent={isLive || activity.category === 'Exam' || activity.courseCode === 'ICH 100L'}
                    className={`relative group transition-all duration-300 border-l-2 ${
                      isLive
                        ? 'border-l-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-950/10 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                        : activity.category === 'Exam'
                        ? 'border-l-rose-500'
                        : 'border-l-indigo-500'
                    }`}
                    onClick={() => {}}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3 flex-1 min-w-0">
                        {/* Top labels */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-mono font-black tracking-wide text-indigo-400 bg-slate-950/60 px-2.5 py-0.5 rounded border border-indigo-500/30 uppercase">
                            {activity.courseCode}
                          </span>
                          
                          <span
                            className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(
                              activity.category
                            )}`}
                          >
                            {activity.category}
                          </span>

                          {/* Delivery Type mode labels */}
                          {isOnline ? (
                            <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 flex items-center gap-1 shrink-0">
                              <Globe className="w-3 h-3 text-emerald-400" />
                              <span>ONLINE CLASS</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full border border-slate-850 text-slate-400 bg-slate-950 flex items-center gap-1 shrink-0">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>PHYSICAL CLASS</span>
                            </span>
                          )}

                          {isLive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                              <span>LIVE NOW 🟢</span>
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-display font-extrabold text-slate-100 group-hover:text-white transition-colors leading-tight">
                          {activity.title}
                        </h3>

                        {/* Description */}
                        {activity.description && (
                          <p className="text-xs text-slate-300 leading-relaxed max-w-lg font-sans">
                            {activity.description}
                          </p>
                        )}

                        {/* Info Pills Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-900/40">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
                            <span className="text-xs font-mono font-medium text-slate-300">
                              {activity.timeStart} - {activity.timeEnd}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-400 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-rose-400/80 shrink-0" />
                            <span className="text-xs text-slate-300 truncate font-sans">
                              {activity.location}
                            </span>
                          </div>
                        </div>

                        {/* Online Direct Class Action Button */}
                        {isOnline && activity.classLink && (
                          <div className="mt-4 pt-1">
                            <a
                              href={activity.classLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all active:scale-95 cursor-pointer ${
                                isLive
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400'
                                  : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Join Class</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Course Rep Administrative controls */}
                      {isCourseRep && (
                        <div className="flex items-center gap-0.5 shrink-0 self-start">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditActivity(activity);
                            }}
                            className="text-slate-400 hover:text-indigo-400 p-2 hover:bg-indigo-500/10 rounded-xl transition-all cursor-pointer"
                            title="Edit Schedule Activity"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivityToDelete(activity);
                            }}
                            className="text-slate-400 hover:text-rose-400 p-2 hover:bg-rose-500/10 rounded-xl transition-all shrink-0 cursor-pointer"
                            title="Delete Schedule Activity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Indicator showing who created it if customized */}
                    {activity.createdBy !== 'system' && activity.createdBy !== currentUserMatric && (
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-900/20 pt-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>Added by Rep</span>
                        </span>
                        <span className="font-mono text-slate-600">{activity.createdBy}</span>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>



      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {activityToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setActivityToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="w-full max-w-sm glassmorphism border border-slate-800/80 rounded-3xl p-6 bg-[#0f172a]/95 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto mb-4 animate-bounce">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h3 className="text-center text-lg font-display font-black text-slate-100 tracking-tight">
                Delete Class Schedule?
              </h3>
              
              <p className="text-center text-xs text-slate-400 leading-relaxed font-sans mt-2">
                Are you sure you want to delete <span className="font-semibold text-slate-200">"{activityToDelete.title}"</span> from the <span className="font-semibold text-indigo-300">{activityToDelete.day}</span> timeline? This action is irreversible and will update all students instantly.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setActivityToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  No, Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteActivity(activityToDelete.id);
                    setActivityToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-[0_4px_12px_rgba(244,63,94,0.25)] transition-all cursor-pointer text-center"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
