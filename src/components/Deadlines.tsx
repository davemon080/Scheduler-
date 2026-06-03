/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Calendar, CheckCircle2, Circle, AlertTriangle, CheckSquare, Square, Trash2, CalendarCheck, HelpCircle, Eye, Image, X } from 'lucide-react';
import { Deadline } from '../types';
import GlassCard from './GlassCard';
import ImageViewer from './ImageViewer';

interface DeadlinesProps {
  deadlines: Deadline[];
  isCourseRep: boolean;
  currentUserMatric: string;
  onToggleComplete: (id: string) => void;
  onDeleteDeadline: (id: string) => void;
}

export default function Deadlines({
  deadlines,
  isCourseRep,
  currentUserMatric,
  onToggleComplete,
  onDeleteDeadline
}: DeadlinesProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [activeImageSet, setActiveImageSet] = useState<{ urls: string[]; index: number; title: string } | null>(null);
  const [closedPreviews, setClosedPreviews] = useState<Record<string, boolean>>({});
  const [deadlineToDelete, setDeadlineToDelete] = useState<Deadline | null>(null);

  // Map deadlines to overwrite isCompleted with user's specific state
  const userDeadlines = deadlines.map(dl => ({
    ...dl,
    isCompleted: dl.completedBy ? !!dl.completedBy[currentUserMatric] : dl.isCompleted
  }));

  const filteredDeadlines = userDeadlines.filter((dl) => {
    if (filter === 'pending') return !dl.isCompleted;
    if (filter === 'completed') return dl.isCompleted;
    return true;
  });

  // Sort deadlines: pending first, then by newest added (ID descending) so new assignments are on top
  const sortedDeadlines = [...filteredDeadlines].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return b.id.localeCompare(a.id);
  });

  const getDaysRemainingLabel = (dueDateStr: string, isCompleted: boolean) => {
    if (isCompleted) {
      return { text: 'Submitted & Checked', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', isLapsed: false };
    }

    const today = new Date();
    // Normalize hours to begin of day for calculation
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        text: `Overdue by ${Math.abs(diffDays)}d`, 
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 font-semibold', 
        isLapsed: true 
      };
    } else if (diffDays === 0) {
      return { 
        text: 'Due Today ⚠️', 
        color: 'text-amber-400 bg-amber-500/20 border-amber-500/40 animate-pulse font-bold', 
        isLapsed: false 
      };
    } else if (diffDays === 1) {
      return { 
        text: 'Due Tomorrow', 
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', 
        isLapsed: false 
      };
    } else if (diffDays < 4) {
      return { 
        text: `${diffDays} days left`, 
        color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20', 
        isLapsed: false 
      };
    } else {
      return { 
        text: `${diffDays} days left`, 
        color: 'text-slate-400 bg-slate-950 border-slate-800', 
        isLapsed: false 
      };
    }
  };

  const pendingCount = userDeadlines.filter(d => !d.isCompleted).length;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-end px-1">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-100 tracking-tight">
            Assignment Deadlines
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Keep track of course worksheets, homeworks, and quizzes
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full font-semibold animate-pulse">
            {pendingCount} Pending
          </div>
        )}
      </div>

      {/* Tabs Filter Header */}
      <div className="flex p-1 rounded-xl bg-slate-950/70 border border-slate-800/80 max-w-sm">
        {(['all', 'pending', 'completed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium font-sans capitalize transition-all duration-300 cursor-pointer ${
              filter === t
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Deadlines Vertical Stack */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {sortedDeadlines.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="py-12 text-center"
            >
              <GlassCard className="py-10 px-6 border-dashed border-slate-800 flex flex-col items-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 text-emerald-400 mb-3">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <h4 className="text-base font-display font-bold text-slate-200">
                  {filter === 'completed' ? 'No completed tasks yet' : 'Incredibly clean slate!'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans">
                  {filter === 'completed'
                    ? "Check tasks here once marked as submitted or complete."
                    : "No pending worksheets. You are fully up to date with your core chemistry deliverables!"}
                </p>
              </GlassCard>
            </motion.div>
          ) : (
            sortedDeadlines.map((dl, idx) => {
              const remaining = getDaysRemainingLabel(dl.dueDate, dl.isCompleted);
              
              return (
                <motion.div
                  key={dl.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <GlassCard
                    onClick={() => onToggleComplete(dl.id)}
                    className={`glassmorphism-hover group transition-all duration-300 relative border-l-2 ${
                      dl.isCompleted 
                        ? 'opacity-65 border-slate-800 bg-slate-900/40' 
                        : remaining.isLapsed
                        ? 'border-rose-500'
                        : 'border-indigo-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox Trigger Indicator */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(dl.id);
                        }}
                        className="mt-1 transition-transform active:scale-95 text-slate-400 hover:text-indigo-400 cursor-pointer outline-none"
                      >
                        {dl.isCompleted ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 hover:text-indigo-400 text-slate-600" />
                        )}
                      </button>

                      <div className="flex-1 space-y-2 min-w-0">
                        {/* Upper line metadata */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-mono font-black tracking-wide text-indigo-400 bg-slate-950/60 px-2.5 py-0.5 rounded border border-indigo-500/30 uppercase">
                            {dl.courseCode}
                          </span>

                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${remaining.color}`}>
                            {remaining.text}
                          </span>
                        </div>

                        {/* Title of assignment */}
                        <h3 className={`text-base font-display font-bold transition-all ${
                          dl.isCompleted ? 'text-slate-500 line-through' : 'text-slate-100 group-hover:text-white'
                        }`}>
                          {dl.title}
                        </h3>

                        {/* Description details */}
                        {dl.description && (
                          <p className={`text-xs leading-relaxed font-sans ${
                            dl.isCompleted ? 'text-slate-600' : 'text-slate-300'
                          }`}>
                            {dl.description}
                          </p>
                        )}

                        {/* Attached Worksheet Preview Images */}
                        {(() => {
                          const images = dl.imageUrls || (dl.imageUrl ? [dl.imageUrl] : []);
                          if (images.length === 0) return null;

                          if (closedPreviews[dl.id]) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClosedPreviews((prev) => ({ ...prev, [dl.id]: false }));
                                }}
                                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-505/10 text-indigo-300 hover:text-indigo-200 text-xs font-semibold cursor-pointer outline-none transition-all active:scale-95"
                              >
                                <Image className="w-3.5 h-3.5" />
                                <span>Show Sheet Attachment ({images.length})</span>
                              </button>
                            );
                          }

                          return (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-slate-400">Sheet Attachments ({images.length})</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setClosedPreviews((prev) => ({ ...prev, [dl.id]: true }));
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
                                      e.stopPropagation(); // Prevent toggling checklist status when clicking preview image
                                      setActiveImageSet({ urls: images, index: idx, title: dl.title });
                                    }}
                                    className="relative group/img rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950/50 p-1 min-w-[110px] max-w-[150px] aspect-video cursor-pointer hover:border-indigo-500/50 transition-all shadow-md"
                                  >
                                    <div className="relative overflow-hidden rounded-lg w-full h-full aspect-video bg-slate-900/40">
                                      <img 
                                        src={img} 
                                        alt={`${dl.title} preview ${idx + 1}`} 
                                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute inset-0 bg-slate-950/40 group-hover/img:bg-slate-950/15 transition-colors flex items-center justify-center">
                                        <span className="text-[8px] font-mono font-bold text-white px-1.5 py-0.5 bg-slate-950/85 border border-slate-800/80 rounded shadow-lg flex items-center gap-1 opacity-90">
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

                        {/* Due date picker calendar label */}
                        <div className="flex items-center gap-1.5 pt-2 text-[11px] text-slate-400 font-sans">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400/80" />
                          <span>Deadline: <strong className="text-slate-300 font-mono">{dl.dueDate}</strong></span>
                        </div>
                      </div>

                      {/* Delete action for Course Representative */}
                      {isCourseRep && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeadlineToDelete(dl);
                          }}
                          className="self-start text-slate-500 hover:text-red-400 p-2 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer shrink-0"
                          title="Delete Assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {/* Fullscreen interactive Inbuilt App Image Viewer */}
        {activeImageSet && (
          <ImageViewer 
            imageUrls={activeImageSet.urls} 
            initialIndex={activeImageSet.index} 
            title={activeImageSet.title} 
            onClose={() => setActiveImageSet(null)} 
          />
        )}
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {deadlineToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setDeadlineToDelete(null)}
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
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-center text-lg font-display font-black text-slate-100 tracking-tight">
                Delete Deadline?
              </h3>
              
              <p className="text-center text-xs text-slate-400 leading-relaxed font-sans mt-2">
                Are you sure you want to delete <span className="font-semibold text-slate-200">"{deadlineToDelete.title}"</span>? This will clear this assignment from all students' task feeds immediately.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setDeadlineToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  No, Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteDeadline(deadlineToDelete.id);
                    setDeadlineToDelete(null);
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
