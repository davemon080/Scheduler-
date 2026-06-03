/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Trash2, 
  Clock, 
  User, 
  Mail, 
  Sparkles, 
  ChevronRight, 
  AlertCircle, 
  ArrowLeft, 
  Loader2, 
  Star, 
  Check, 
  Inbox, 
  Filter,
  MessageCircle
} from 'lucide-react';
import GlassCard from './GlassCard';
import { db, getSafeDocId, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';

interface FeedbackItem {
  id: string;
  matricNumber: string;
  studentName: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'unread' | 'read' | 'replied';
  rating?: number;
  adminReply?: string;
  repliedAt?: string;
}

interface FeedbackPageProps {
  user: {
    email: string;
    matricNumber: string;
    name: string;
    isAdmin?: boolean;
  };
  isAdminMode?: boolean;
  onBack?: () => void;
}

export default function FeedbackPage({
  user,
  isAdminMode = false,
  onBack
}: FeedbackPageProps) {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Student form states
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Admin and filtering states
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read' | 'replied'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replySuccess, setReplySuccess] = useState('');
  const [replyError, setReplyError] = useState('');

  const subjectOptions = [
    'General Inquiry',
    'Assignment / Test Query',
    'Faculty / Lecture Complaint',
    'Software Bug / Technical Issue',
    'Syllabus Suggestion',
    'Course Representative Review',
    'Other'
  ];

  // Fetch feedbacks and listen to live changes
  useEffect(() => {
    setIsLoading(true);
    let unsubscribe = () => {};

    try {
      const cached = localStorage.getItem('ich100l_feedbacks_db');
      if (cached) {
        setFeedbacks(JSON.parse(cached));
      }

      if (db) {
        unsubscribe = onSnapshot(collection(db, 'feedbacks'), (snapshot) => {
          const fetched: FeedbackItem[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as FeedbackItem));

          fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setFeedbacks(fetched);
          localStorage.setItem('ich100l_feedbacks_db', JSON.stringify(fetched));
          setIsLoading(false);
        }, (err) => {
          console.warn('[Feedback] Real-time listener offline fallback:', err);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      console.error('[Feedback] Initialization failed:', e);
      setIsLoading(false);
    }

    return () => unsubscribe();
  }, []);

  // Update selected feedback if snapshot updates it
  useEffect(() => {
    if (selectedFeedback) {
      const updated = feedbacks.find(f => f.id === selectedFeedback.id);
      if (updated) {
        setSelectedFeedback(updated);
      }
    }
  }, [feedbacks]);

  // Handle student feedback submission
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess('');
    setSubmitError('');
    setIsSubmitting(true);

    const finalSubject = subject === 'Other' ? (customSubject.trim() || 'Other') : subject;
    if (!finalSubject || !message.trim()) {
      setSubmitError('Please complete both the subject and your message details.');
      setIsSubmitting(false);
      return;
    }

    const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newFeedback: FeedbackItem = {
      id: feedbackId,
      matricNumber: user.matricNumber || 'Guest',
      studentName: user.name || 'Chemistry Student',
      email: user.email || 'guest@ich100l.edu',
      subject: finalSubject,
      message: message.trim(),
      rating,
      createdAt: new Date().toISOString(),
      status: 'unread'
    };

    try {
      if (db) {
        const docRef = doc(db, 'feedbacks', feedbackId);
        await setDoc(docRef, newFeedback);
      }

      const updatedFeedbacks = [newFeedback, ...feedbacks];
      setFeedbacks(updatedFeedbacks);
      localStorage.setItem('ich100l_feedbacks_db', JSON.stringify(updatedFeedbacks));

      setSubmitSuccess('Your feedback has been delivered securely to the Course Administrators.');
      setSubject('');
      setCustomSubject('');
      setMessage('');
      setRating(5);
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'feedbacks');
      } catch (e: any) {
        setSubmitError(`Could not submit feedback online: ${e.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle admin reply to feedback
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback) return;

    setReplySuccess('');
    setReplyError('');
    setIsReplying(true);

    if (!adminReplyText.trim()) {
      setReplyError('Reply message cannot be empty.');
      setIsReplying(false);
      return;
    }

    const updatedFeedback: Partial<FeedbackItem> = {
      status: 'replied',
      adminReply: adminReplyText.trim(),
      repliedAt: new Date().toISOString()
    };

    try {
      if (db) {
        const feedbackRef = doc(db, 'feedbacks', selectedFeedback.id);
        const completeUpdated = { ...selectedFeedback, ...updatedFeedback };
        await setDoc(feedbackRef, completeUpdated);
      }

      const finalFeedbacks = feedbacks.map(f => f.id === selectedFeedback.id ? { ...f, ...updatedFeedback } as FeedbackItem : f);
      setFeedbacks(finalFeedbacks);
      localStorage.setItem('ich100l_feedbacks_db', JSON.stringify(finalFeedbacks));

      setReplySuccess('Reply saved and message state updated to: Replied.');
      setAdminReplyText('');
    } catch (err: any) {
      console.error(err);
      setReplyError(err.message || 'Failed to update feedback reply states.');
    } finally {
      setIsReplying(false);
    }
  };

  // Mark a feedback item as read
  const handleMarkAsRead = async (item: FeedbackItem) => {
    if (item.status !== 'unread') return;
    
    try {
      const updatedItem: Partial<FeedbackItem> = { status: 'read' };
      if (db) {
        const docRef = doc(db, 'feedbacks', item.id);
        await updateDoc(docRef, updatedItem);
      }

      const finalFeedbacks = feedbacks.map(f => f.id === item.id ? { ...f, ...updatedItem } as FeedbackItem : f);
      setFeedbacks(finalFeedbacks);
      localStorage.setItem('ich100l_feedbacks_db', JSON.stringify(finalFeedbacks));
    } catch (err) {
      console.warn('Failed to mark as read:', err);
    }
  };

  // Handle delete feedback record
  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback item? This is an irreversible operation.')) return;

    try {
      if (db) {
        await deleteDoc(doc(db, 'feedbacks', id));
      }

      const remainder = feedbacks.filter(f => f.id !== id);
      setFeedbacks(remainder);
      localStorage.setItem('ich100l_feedbacks_db', JSON.stringify(remainder));

      if (selectedFeedback && selectedFeedback.id === id) {
        setSelectedFeedback(null);
      }
    } catch (err) {
      console.error(err);
      alert('Could not delete feedback item online.');
    }
  };

  // Filter feedbacks
  const studentFeedbacks = feedbacks.filter(f => f.matricNumber?.toLowerCase() === user.matricNumber?.toLowerCase());
  const activeFeedbacksList = isAdminMode 
    ? feedbacks.filter(f => filterStatus === 'all' ? true : f.status === filterStatus)
    : studentFeedbacks;

  const totalReceived = feedbacks.length;
  const unreadCount = feedbacks.filter(f => f.status === 'unread').length;
  const repliedCount = feedbacks.filter(f => f.status === 'replied').length;

  return (
    <div className="space-y-6 pb-28">
      {/* Upper header navigation row */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-900/60 pb-2.5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900/80 border border-slate-900 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[10px] font-mono uppercase"
              title="Go Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <div>
            <h2 className="text-xs font-display font-black text-slate-200 uppercase tracking-wide flex items-center gap-1.5 line-clamp-1">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{isAdminMode ? 'Student Feedbacks Workspace' : 'Student Feedback Desk'}</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 tracking-tight lowercase">
              {isAdminMode 
                ? 'Review chemistry class inquiries, suggestions, and assign replies' 
                : 'Direct communication desk for help & reviews to administrators'}
            </p>
          </div>
        </div>
      </div>

      {isAdminMode ? (
        /* ADMIN HUB WORKSPACE VIEW */
        <div className="space-y-6">
          {/* Dashboard Metrics Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Total Submissions Received</span>
              <p className="text-3xl font-display font-black text-slate-100 mt-2">{totalReceived}</p>
              <div className="absolute right-4 bottom-4 text-indigo-500/10"><Inbox className="w-8 h-8" /></div>
            </div>
            
            <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Unread &amp; Pending Review</span>
              <p className={`text-3xl font-display font-black mt-2 ${unreadCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{unreadCount}</p>
              <div className="absolute right-4 bottom-4 text-amber-500/10">
                <Clock className={`w-8 h-8 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Operational Reply Rate</span>
              <p className="text-3xl font-display font-black text-emerald-400 mt-2">
                {totalReceived > 0 ? `${Math.round((repliedCount / totalReceived) * 100)}%` : '100%'}
              </p>
              <div className="absolute right-4 bottom-4 text-emerald-500/10"><CheckCircle2 className="w-8 h-8" /></div>
            </div>
          </div>

          {/* Interactive Split layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Feedbacks stream list section */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  Inboxes &amp; Filter Pipelines ({activeFeedbacksList.length})
                </span>
                
                {/* Visual filter options row */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900 overflow-x-auto scrollbar-none">
                  {(['all', 'unread', 'read', 'replied'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setFilterStatus(tab)}
                      className={`py-1 px-2.5 rounded-md text-[10px] font-mono font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                        filterStatus === tab 
                          ? 'bg-indigo-600/95 text-white shadow-sm font-black' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-500 mb-2" />
                    <span className="text-xs font-mono">Syncing Database Desks...</span>
                  </div>
                ) : activeFeedbacksList.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/10">
                    <Inbox className="w-9 h-9 text-slate-700 mx-auto mb-2" />
                    <h3 className="text-xs font-mono font-bold uppercase text-slate-400">Pipeline empty</h3>
                    <p className="text-2xs text-slate-500 mt-1 max-w-xs mx-auto">
                      There are no student inputs matching the active filter stream pipeline.
                    </p>
                  </div>
                ) : (
                  activeFeedbacksList.map(item => (
                    <div
                      key={item.id}
                      onClick={async () => {
                        setSelectedFeedback(item);
                        setReplySuccess('');
                        setReplyError('');
                        if (item.status === 'unread') {
                          await handleMarkAsRead(item);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                        selectedFeedback?.id === item.id
                          ? 'border-indigo-500 bg-indigo-950/15 shadow-[0_4px_20px_rgba(99,102,241,0.08)]'
                          : 'border-slate-900 bg-slate-955/30 hover:bg-slate-950/45 hover:border-slate-800'
                      }`}
                    >
                      {/* Left indicator bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        item.status === 'unread' 
                          ? 'bg-amber-500' 
                          : item.status === 'replied' 
                            ? 'bg-emerald-500' 
                            : 'bg-indigo-500'
                      }`} />

                      <div className="pl-2 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs font-bold text-slate-100 font-sans truncate pr-4">
                            {item.subject}
                          </h4>
                          <span className={`text-[8px] font-mono tracking-wider px-2 py-0.5 rounded-md border uppercase shrink-0 font-bold ${
                            item.status === 'unread'
                              ? 'bg-amber-500/15 border-amber-500/20 text-amber-400 animate-pulse'
                              : item.status === 'replied'
                                ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400'
                                : 'bg-slate-950 border-slate-900 text-slate-450'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <p className="text-11px text-slate-400 font-sans line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-950 pt-2 text-[10px] font-mono text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-600 shrink-0" />
                            <span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div>
                            <span className="text-slate-300 font-bold">{item.studentName}</span> &bull; <span>{item.matricNumber}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected feedback detail and replies panel */}
            <div className="lg:col-span-5">
              {selectedFeedback ? (
                <GlassCard className="border border-slate-900 space-y-4 relative sticky top-6 text-left">
                  <div className="flex items-center justify-between border-b border-slate-950 pb-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Feedback Inspector
                    </span>
                    <button
                      onClick={() => setSelectedFeedback(null)}
                      className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Close Inspector
                    </button>
                  </div>

                  {/* Profile metadata info block */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="font-mono text-[10px]">Student:</span>
                      <strong className="text-slate-200">{selectedFeedback.studentName}</strong>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="font-mono text-[10px]">Email:</span>
                      <span className="text-slate-350 select-all font-sans">{selectedFeedback.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="font-mono text-[10px]">Matric No:</span>
                      <span className="text-indigo-400 font-mono font-bold select-all uppercase">{selectedFeedback.matricNumber}</span>
                    </div>
                    {selectedFeedback.rating !== undefined && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Star className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="font-mono text-[10px]">Rating:</span>
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= (selectedFeedback.rating || 5)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">Topic Theme</span>
                    <div className="p-2.5 bg-indigo-950/15 border border-indigo-500/10 rounded-lg text-indigo-200 text-2xs font-bold uppercase tracking-wider">
                      {selectedFeedback.subject}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">Submitted Body</span>
                    <div className="p-3 bg-slate-950/40 border border-slate-905 rounded-xl text-slate-300 text-xs leading-relaxed font-sans whitespace-pre-wrap select-text">
                      {selectedFeedback.message}
                    </div>
                  </div>

                  {/* Pre-existing replies */}
                  {selectedFeedback.adminReply && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/10 border border-emerald-500/15 text-left space-y-1">
                      <h5 className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/5" />
                        Administrator Clarification
                      </h5>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                        {selectedFeedback.adminReply}
                      </p>
                      {selectedFeedback.repliedAt && (
                        <div className="text-[9px] text-slate-500 font-mono text-right mt-1.5">
                          Synced: {new Date(selectedFeedback.repliedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Write comment response form */}
                  <form onSubmit={handleSendReply} className="space-y-3 pt-3 border-t border-slate-950">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                        Response Message
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Draft reply to stream to student inbox..."
                        className="w-full p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {replySuccess && (
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-2xs">
                        {replySuccess}
                      </div>
                    )}
                    
                    {replyError && (
                      <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-2xs">
                        {replyError}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isReplying || !adminReplyText.trim()}
                        className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all border-none font-sans"
                      >
                        {isReplying ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Dispatch Reply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteFeedback(selectedFeedback.id)}
                        className="p-2 bg-slate-950 hover:bg-rose-950/30 text-slate-500 hover:text-rose-450 border border-slate-900 hover:border-rose-500/20 rounded-xl transition-all cursor-pointer"
                        title="Delete query record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </GlassCard>
              ) : (
                <div className="p-10 border-2 border-dashed border-slate-900 rounded-2xl bg-slate-955/10 flex flex-col items-center justify-center text-center h-48">
                  <Inbox className="w-7 h-7 text-slate-700 mb-2" />
                  <span className="text-xs font-mono font-bold text-slate-400">Select Feedback Item</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">
                    Click on any user feedback entry in the streaming feed to read, authorize clarifications, or purge the record.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* STANDARD STUDENT WORKSPACE VIEW */
        <div className="max-w-2xl mx-auto">
          <GlassCard className="border border-slate-900/80 p-5 sm:p-6 space-y-5 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-indigo-505/5 blur-[50px] pointer-events-none" />
            
            <div className="border-b border-slate-950 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-500/10 shrink-0">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                  Report Software Issue or Suggest Feature
                </h3>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Spotted a bug? Have an elegant idea? Submit this card to report technical problems or request new features.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              {submitSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-2xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-2xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Category block */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  Feedback Theme Category
                </label>
                <select
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-colors"
                >
                  <option value="">-- Select Feedback Theme --</option>
                  <option value="Technical Bug / Software Issue">Technical Bug / Software Issue</option>
                  <option value="Suggested Feature / Idea">Suggested Feature / Idea</option>
                  <option value="General Assistance / Help">General Assistance / Help</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {subject === 'Other' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Custom Theme Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="E.g. Calendar Integration, Payment Flow query..."
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700"
                  />
                </div>
              )}

              {/* Star rating selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  Portal Satisfaction Rating
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      type="button"
                      key={starVal}
                      onClick={() => setRating(starVal)}
                      className="p-1 focus:outline-none cursor-pointer group"
                    >
                      <Star
                        className={`w-4.5 h-4.5 transition-all ${
                          starVal <= rating
                            ? 'text-amber-400 fill-amber-400 scale-105'
                            : 'text-slate-800 hover:text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-2xs text-slate-550 font-mono ml-2">
                    ({rating}/5)
                  </span>
                </div>
              </div>

              {/* Main feedback body text area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Inquiry Narrative / Feature Description
                  </label>
                  <span className="text-[9px] text-slate-600 font-mono uppercase">
                    {message.length}/1000 Max
                  </span>
                </div>
                <textarea
                  rows={6}
                  required
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue you're facing or your suggested feature in detail..."
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-750 font-sans leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !subject || !message.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 text-white font-sans font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSubmitting ? 'Transmitting...' : 'Submit Transmission'}</span>
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
