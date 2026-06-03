/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, Tag, User, BookOpen, AlertCircle, ArrowLeft, RefreshCw, Info } from 'lucide-react';
import { DayOfWeek, Activity } from '../types';
import GlassCard from './GlassCard';

interface CalendarViewProps {
  activities: Activity[];
  currentUserMatric: string;
  onBack: () => void;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_MAPPING: Record<number, DayOfWeek> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

export default function CalendarView({ activities, currentUserMatric, onBack, onSelectDate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [deletedActivities, setDeletedActivities] = useState<Activity[]>([]);

  // Periodically reload locally archived/deleted activities
  const loadDeletedActivities = () => {
    try {
      const stored = localStorage.getItem('ich100l_deleted_activities');
      if (stored) {
        setDeletedActivities(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse deleted activities from local storage:', e);
    }
  };

  useEffect(() => {
    loadDeletedActivities();

    // Catch local state updates from deleted activities handler
    const handleUpdate = () => {
      loadDeletedActivities();
    };
    window.addEventListener('ich100l_deleted_activities_updated', handleUpdate);
    return () => window.removeEventListener('ich100l_deleted_activities_updated', handleUpdate);
  }, []);

  // Calendar month math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0-6 Sunday to Saturday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create grid cells
  const dayCells: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    dayCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(new Date(year, month, d));
  }

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

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

  // Resolve matching schedules for a given date
  const getSchedulesForDate = (date: Date) => {
    const dayOfWeek = WEEKDAY_MAPPING[date.getDay()];
    const dateStr = getLocalYYYYMMDD(date);
    
    const mondayOfCell = getMondayOfWeekDate(date);
    const mondayOfCurrent = getMondayOfWeekDate(new Date());

    let active: Activity[] = [];
    let deleted: Activity[] = [];

    if (mondayOfCell < mondayOfCurrent) {
      // PAST WEEK! Load from archived bin local cache
      deleted = deletedActivities.filter(act => {
        if (act.date) {
          return act.date === dateStr;
        }
        return act.day === dayOfWeek;
      });
    } else {
      // CURRENT WEEK or FUTURE WEEK! All schedules ahead are live
      active = activities.filter(act => {
        if (act.date) {
          return act.date === dateStr;
        }
        return act.day === dayOfWeek;
      });
    }

    return {
      active,
      deleted,
      totalCount: active.length + deleted.length
    };
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Page navigation header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer outline-none transition-colors"
          id="btn-back-to-schedule"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-400" />
          <span>Timeline Grid</span>
        </button>

        <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Full Interactive Calendar
        </span>
      </div>

      {/* Main Calendar Card layout */}
      <GlassCard className="p-4 border-slate-800 bg-slate-950/40 relative overflow-hidden" id="calendar-board-container">
        {/* Month Selector header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-900/40">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-10 h-10 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700/80 rounded-xl transition-all cursor-pointer outline-none text-slate-300 hover:text-white"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5 text-indigo-400" />
          </button>

          <div className="text-center">
            <h2 className="text-lg font-display font-black text-slate-100 tracking-tight leading-none">
              {MONTHS[month]} {year}
            </h2>
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase font-black">
              Schedules Archive Active
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="w-10 h-10 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700/80 rounded-xl transition-all cursor-pointer outline-none text-slate-300 hover:text-white"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5 text-indigo-400" />
          </button>
        </div>

        {/* Days of week header line */}
        <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
          {WEEKDAYS.map(wd => (
            <div key={wd} className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar Grid cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {dayCells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="aspect-square opacity-0 pointer-events-none" />;
            }

            const { totalCount } = getSchedulesForDate(cell);
            const activeToday = isToday(cell);
            const activeSelected = isSelected(cell);

            return (
              <button
                key={`day-${cell.getDate()}-${cell.getMonth()}`}
                type="button"
                onClick={() => onSelectDate(cell)}
                className={`aspect-square rounded-xl p-1.5 flex flex-col justify-between items-center transition-all duration-200 outline-none relative cursor-pointer border ${
                  activeToday
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-850 text-slate-300 hover:text-slate-100'
                }`}
                id={`calendar-date-cell-${year}-${month + 1}-${cell.getDate()}`}
              >
                {/* Date numeral */}
                <span className={`text-xs font-display font-black tracking-tight ${activeSelected ? 'text-white' : 'text-slate-200'}`}>
                  {cell.getDate()}
                </span>

                {/* Amount indicating schedules counts */}
                {totalCount > 0 ? (
                  <span
                    className={`text-[8px] font-mono leading-none rounded-md px-1 py-0.5 font-bold ${
                      activeSelected
                        ? 'bg-slate-950/40 text-indigo-100'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20'
                    }`}
                    title={`${totalCount} schedule events`}
                  >
                    {totalCount}
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                )}

                {/* Highlight background dot for today */}
                {activeToday && !activeSelected && (
                  <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Small legend metadata */}
        <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono mt-4 pt-3 border-t border-slate-900/40">
          <span className="flex items-center gap-1.5 flex-1 justify-center sm:justify-start">
            <span className="w-2 h-2 rounded bg-indigo-500/20 border border-indigo-500/20 inline-block" />
            <span>Represents class scheduled days</span>
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
