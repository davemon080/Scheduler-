/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, Search, ShieldAlert, Pin, Calendar, User, Trash2, Tag, Volume2, Eye, X, Image, ExternalLink, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Announcement } from '../types';
import GlassCard from './GlassCard';
import ImageViewer from './ImageViewer';

interface AnnouncementsProps {
  announcements: Announcement[];
  isCourseRep: boolean;
  onDeleteAnnouncement: (id: string) => void;
}

export default function Announcements({
  announcements,
  isCourseRep,
  onDeleteAnnouncement
}: AnnouncementsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeImageSet, setActiveImageSet] = useState<{ urls: string[]; index: number; title: string } | null>(null);
  const [closedPreviews, setClosedPreviews] = useState<Record<string, boolean>>({});
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  // Custom smart date-based and priority filter states
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Helper: get today's date in YYYY-MM-DD
  const getTodayDateStr = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Helper: format YYYY-MM-DD to "Jun 5"
  const formatToShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  };

  // Helper: format YYYY-MM-DD to "Today, Jun 5, 2026" or "Yesterday, Jun 4, 2026" or "Jun 3, 2026"
  const getRelativeDateGroupLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const targetDate = new Date(year, month, day);
      
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const formattedDatePart = targetDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      if (isSameDay(targetDate, today)) {
        return `Today, ${formattedDatePart}`;
      } else if (isSameDay(targetDate, yesterday)) {
        return `Yesterday, ${formattedDatePart}`;
      } else {
        return formattedDatePart;
      }
    }
    return dateStr;
  };

  // Compute all available dates dynamically from loaded broadcasts for the timeline
  const uniqueDates = Array.from(new Set(announcements.map((ann) => ann.date)))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  // Multi-tier filter matching
  const filteredAnnouncements = announcements.filter((ann) => {
    // 1. Keyword search (title / message / author)
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      ann.title.toLowerCase().includes(q) ||
      ann.content.toLowerCase().includes(q) ||
      ann.author.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // 2. Timeline Selected Date
    if (selectedDate && ann.date !== selectedDate) {
      return false;
    }

    // 3. Dropdown Menu Filter
    if (activeFilter === 'today') {
      if (ann.date !== getTodayDateStr()) return false;
    } else if (activeFilter !== 'all') {
      if (ann.priority !== activeFilter) return false;
    }

    return true;
  });

  // Sort broadcasts newest first and map them by date
  const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.id.localeCompare(a.id);
  });

  // Grouped collection mapping
  const groups: Record<string, Announcement[]> = {};
  sortedAnnouncements.forEach((ann) => {
    const k = ann.date || 'Unspecified';
    if (!groups[k]) {
      groups[k] = [];
    }
    groups[k].push(ann);
  });

  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          banner: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20 border-rose-500/40'
        };
      case 'medium':
        return {
          banner: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
          glow: 'border-amber-500/30'
        };
      default:
        return {
          banner: 'bg-indigo-500/10 border-indigo-505/20 text-indigo-400',
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/20',
          glow: 'border-slate-800'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header element */}
      <div className="flex justify-between items-end px-1">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-100 tracking-tight">
            Class Broadcasts
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Important announcements from lecturers and course reps
          </p>
        </div>
        <Volume2 className="w-5 h-5 text-indigo-400 shrink-0" />
      </div>

      {/* Search Bar Input & Filter Option Trigger */}
      <div className="flex gap-2.5 relative z-20">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements by keyword, lecturer..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-sans"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold cursor-pointer select-none transition-all active:scale-95 duration-200 ${
              activeFilter !== 'all'
                ? 'bg-indigo-600 border-indigo-500/80 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>
              {activeFilter === 'all'
                ? 'Filter'
                : activeFilter === 'today'
                ? 'Today'
                : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
          
          <AnimatePresence>
            {isFilterDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsFilterDropdownOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-800 bg-[#0f172a]/95 backdrop-blur-md shadow-2xl p-1.5 z-40 space-y-0.5"
                >
                  {[
                    { id: 'all', label: 'All Broadcasts' },
                    { id: 'today', label: 'Today Only' },
                    { id: 'high', label: 'High Priority' },
                    { id: 'medium', label: 'Medium Priority' },
                    { id: 'info', label: 'Info Priority' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setActiveFilter(opt.id);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none ${
                        activeFilter === opt.id
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-505/30'
                          : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Horizontal Scrollable Date Selector */}
      {uniqueDates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 scroll-smooth select-none">
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider shrink-0 transition-all duration-200 cursor-pointer outline-none border ${
              selectedDate === null
                ? 'bg-indigo-600/25 border-indigo-500/80 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
          >
            All Dates
          </button>

          {uniqueDates.map((dateStr) => {
            const isSelected = selectedDate === dateStr;
            const shortLabel = formatToShortDate(dateStr);
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider shrink-0 transition-all duration-200 cursor-pointer outline-none border ${
                  isSelected
                    ? 'bg-indigo-600/25 border-indigo-500/80 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Bulletin Grid */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredAnnouncements.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-12 text-center"
            >
              <GlassCard className="py-10 border-dashed border-slate-800 text-slate-400 max-w-md mx-auto flex flex-col items-center">
                <Megaphone className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
                <h4 className="text-sm font-display font-bold text-slate-300">
                  {selectedDate ? 'No broadcasts' : 'No broadcasts found'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs font-sans text-center">
                  {selectedDate 
                    ? 'No broadcasts available for this date.' 
                    : searchQuery 
                    ? `We couldn't find any announcements matching "${searchQuery}". Try revising your keyword search.`
                    : 'No announcements have been broadcasted yet.'}
                </p>
              </GlassCard>
            </motion.div>
          ) : (
            (() => {
              let globalIndex = 0;
              return groupKeys.map((dateStr) => {
                const groupAnnouncements = groups[dateStr];
                const relativeLabel = getRelativeDateGroupLabel(dateStr);
                const countLabel = groupAnnouncements.length === 1 
                  ? '1 Broadcast' 
                  : `${groupAnnouncements.length} Broadcasts`;

                return (
                  <div key={dateStr} className="space-y-3 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
                        {relativeLabel}
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950/60 border border-slate-900 px-2 py-0.5 rounded-md select-none shrink-0">
                        {countLabel}
                      </span>
                    </div>
                    {/* Visual Section Divider Line */}
                    <div className="h-[1px] bg-gradient-to-r from-indigo-500/10 via-slate-800/80 to-indigo-500/10 mb-4 opacity-50" />

                    <div className="space-y-4">
                      {groupAnnouncements.map((ann) => {
                        const currentIdx = globalIndex++;
                        const styles = getPriorityStyles(ann.priority);
                        
                        return (
                          <motion.div
                            key={ann.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, delay: currentIdx * 0.04 }}
                          >
                            <GlassCard
                              className={`relative overflow-hidden transition-all duration-300 border ${styles.glow}`}
                            >
                              {/* Top priority banner strips */}
                              {ann.priority === 'high' && (
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500" />
                              )}

                              <div className="space-y-4">
                                {/* Announcement Upper line */}
                                <div className="flex items-center justify-between gap-2.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border border-opacity-40 select-none ${styles.badge}`}
                                    >
                                      {ann.priority} Priority
                                    </span>
                                    {ann.priority === 'high' && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-rose-400 font-mono animate-pulse font-semibold">
                                        <Pin className="w-3 h-3 text-rose-400 rotate-45 shrink-0" />
                                        <span>Pinned</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Date indicator */}
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                                    <span>{ann.date}</span>
                                  </div>
                                </div>


                      {/* Header Title */}
                      <h3 className="text-lg font-display font-bold text-slate-100 leading-tight">
                        {ann.title}
                      </h3>

                      {/* Plain content details */}
                      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line font-sans">
                        {ann.content}
                      </p>

                      {/* Call to action target link */}
                      {ann.linkUrl && (
                        <div className="mt-3.5 flex">
                          <a
                            href={ann.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl border border-indigo-500/30 hover:border-indigo-400/50 shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.45)] transition-all transform active:scale-95 duration-200 cursor-pointer group/btn"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                            <span>{ann.linkText || 'Join Now'}</span>
                            <span className="relative flex h-1.5 w-1.5 ml-0.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                          </a>
                        </div>
                      )}

                      {/* Attached Broadcast Preview Images */}
                      {(() => {
                        const images = ann.imageUrls || (ann.imageUrl ? [ann.imageUrl] : []);
                        if (images.length === 0) return null;

                        if (closedPreviews[ann.id]) {
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setClosedPreviews((prev) => ({ ...prev, [ann.id]: false }));
                              }}
                              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-505/10 text-indigo-300 hover:text-indigo-200 text-xs font-semibold cursor-pointer outline-none transition-all active:scale-95"
                            >
                              <Image className="w-3.5 h-3.5" />
                              <span>Show Schematic Attachment ({images.length})</span>
                            </button>
                          );
                        }

                        return (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-slate-400">Schematic Attachments ({images.length})</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClosedPreviews((prev) => ({ ...prev, [ann.id]: true }));
                                }}
                                className="text-[10px] font-sans font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer outline-none flex items-center gap-0.5"
                              >
                                <X className="w-3 h-3" />
                                <span>Hide Images</span>
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {images.map((img, idx) => (
                                <div 
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveImageSet({ urls: images, index: idx, title: ann.title });
                                  }}
                                  className="relative group/img rounded-xl overflow-hidden border border-slate-800 bg-slate-950/50 p-1 min-w-[120px] max-w-[160px] aspect-video cursor-pointer hover:border-indigo-500/55 transition-all shadow-md"
                                >
                                  <div className="relative overflow-hidden rounded-lg w-full h-full aspect-video bg-slate-900/40">
                                    <img 
                                      src={img} 
                                      alt={`${ann.title} preview ${idx + 1}`} 
                                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/40 group-hover/img:bg-slate-950/15 transition-colors flex items-center justify-center">
                                      <span className="text-[8px] font-mono font-bold text-white px-1.5 py-0.5 bg-slate-950/85 border border-slate-800 rounded shadow-lg flex items-center gap-1 opacity-90">
                                        <Eye className="w-2.5 h-2.5 text-indigo-400" />
                                        <span>View #{idx + 1}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Footer containing author & delete key for rep */}
                      <div className="flex items-center justify-between border-t border-slate-900/40 pt-3 mt-4 text-xs">
                        <div className="flex items-center gap-4 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="font-medium text-slate-300 font-sans">
                              Author: <span className="text-indigo-300">{ann.author}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono" title="Unique views">
                            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{ann.viewedBy?.length || 0} views</span>
                          </div>
                        </div>

                        {/* Rep action deletion tool */}
                        {isCourseRep && (
                          <button
                            onClick={() => {
                              setAnnouncementToDelete(ann);
                            }}
                            className="text-slate-500 hover:text-red-400 p-2 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer shrink-0"
                            title="Delete Announcement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    });
  })()
)}
        </AnimatePresence>
      </div>

      {/* Fullscreen interactive Inbuilt App Image Viewer */}
      {activeImageSet && (
        <ImageViewer 
          imageUrls={activeImageSet.urls} 
          initialIndex={activeImageSet.index} 
          title={activeImageSet.title} 
          onClose={() => setActiveImageSet(null)} 
        />
      )}

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {announcementToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setAnnouncementToDelete(null)}
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
                <ShieldAlert className="w-6 h-6" />
              </div>

              <h3 className="text-center text-lg font-display font-black text-slate-100 tracking-tight">
                Delete Class Broadcast?
              </h3>
              
              <p className="text-center text-xs text-slate-400 leading-relaxed font-sans mt-2">
                Are you sure you want to delete <span className="font-semibold text-slate-200">"{announcementToDelete.title}"</span>? This broadcast details collection will disappear from every student's dashboard immediately.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setAnnouncementToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  No, Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAnnouncement(announcementToDelete.id);
                    setAnnouncementToDelete(null);
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
