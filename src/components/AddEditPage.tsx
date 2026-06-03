/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, AlertTriangle, Clock, MapPin, Globe, Sparkles, PlusCircle, Camera, Upload, Trash2, Loader2, Calendar, RefreshCw } from 'lucide-react';
import { DayOfWeek, ActivityCategory, Activity, Deadline, Announcement } from '../types';

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type.includes('gif')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Ultra-Efficient limits: max width/height of 500px to keep aspect ratio but shrink document size
        const maxDim = 500;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.55 // 55% JPEG quality achieves major compression (typically < 15-25 KB) while retaining great visual readability
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

interface AddEditPageProps {
  type: 'schedule' | 'deadline' | 'announcement';
  editActivity?: Activity | null; // If editing a schedule activity
  daySelected: DayOfWeek;
  currentUserMatric: string;
  initialDate?: string; // e.g. "2026-06-03" (YYYY-MM-DD)
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdBy'> & { departmentId?: string }) => void;
  onUpdateActivity: (id: string, updated: Omit<Activity, 'id' | 'createdBy'> & { departmentId?: string }) => void;
  onAddDeadline: (deadline: Omit<Deadline, 'id' | 'isCompleted' | 'createdBy'> & { departmentId?: string }) => void;
  onAddAnnouncement: (announcement: Omit<Announcement, 'id' | 'date' | 'author'> & { departmentId?: string }) => void;
  onCancel: () => void;
  departments?: any[];
}

export default function AddEditPage({
  type,
  editActivity = null,
  daySelected,
  currentUserMatric,
  initialDate = '',
  onAddActivity,
  onUpdateActivity,
  onAddDeadline,
  onAddAnnouncement,
  onCancel,
  departments = []
}: AddEditPageProps) {
  const isEditing = editActivity !== null;

  // Track selected department
  const [selectedDeptId, setSelectedDeptId] = useState<string>(() => {
    if (type === 'schedule' && editActivity) {
      return (editActivity as any).departmentId || '';
    }
    // Auto-match user's department by matric number pattern
    if (currentUserMatric && departments.length > 0) {
      const userNorm = currentUserMatric.toLowerCase().replace(/[\/\s\-_*]/g, '');
      const matched = departments.find(dept => {
        const deptNorm = dept.prefix.toLowerCase().replace(/[\/\s\-_*]/g, '');
        return deptNorm && userNorm.startsWith(deptNorm);
      });
      if (matched) return matched.id;
    }
    return '';
  });

  // Activity fields state
  const [actTitle, setActTitle] = useState('');
  const [actCourse, setActCourse] = useState('ICH 100L');
  const [actDay, setActDay] = useState<DayOfWeek>(daySelected);
  const [actStart, setActStart] = useState('09:00');
  const [actEnd, setActEnd] = useState('11:00');
  const [actLocation, setActLocation] = useState('');
  const [actCategory, setActCategory] = useState<ActivityCategory>('Lecture');
  const [actDesc, setActDesc] = useState('');
  const [actDelivery, setActDelivery] = useState<'physical' | 'online'>('physical');
  const [actLink, setActLink] = useState('');
  const [actDate, setActDate] = useState(initialDate);
  const [actRepeat, setActRepeat] = useState<'none' | 'weekly'>(() => {
    if (initialDate || (editActivity && editActivity.date)) {
      return 'none';
    }
    return 'weekly';
  });

  // Deadline fields state
  const [dlTitle, setDlTitle] = useState('');
  const [dlCourse, setDlCourse] = useState('ICH 100L');
  const [dlDate, setDlDate] = useState('2026-06-05');
  const [dlDesc, setDlDesc] = useState('');
  const [dlImages, setDlImages] = useState<string[]>([]);

  // Announcement fields state
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<'high' | 'medium' | 'info'>('info');
  const [annImages, setAnnImages] = useState<string[]>([]);

  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'dl' | 'ann') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploadingImg(true);
      setFormError('');
      setSuccessMsg('');

      try {
        const compressedBase64s: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.size > 10 * 1024 * 1024) {
            setFormError(`Image "${file.name}" size exceeds 10MB limit.`);
            continue;
          }

          // Compress image first to ensure it's extremely lightweight (< 25KB)
          const compressedFile = await compressImage(file);
          const base64Url = await fileToBase64(compressedFile);
          compressedBase64s.push(base64Url);
        }

        if (field === 'dl') {
          setDlImages((prev) => [...prev, ...compressedBase64s]);
        } else {
          setAnnImages((prev) => [...prev, ...compressedBase64s]);
        }
        setSuccessMsg(`Processed ${compressedBase64s.length} image(s) and optimized successfully! ⚡ Saved directly in Firebase.`);
      } catch (err: any) {
        console.error('Image compression error: ', err);
        setFormError(`Image preparation failed: ${err.message || 'Please try another file.'}`);
      } finally {
        setIsUploadingImg(false);
      }
    }
  };

  // Hydrate states if we are editing an activity
  useEffect(() => {
    if (type === 'schedule' && editActivity) {
      setActTitle(editActivity.title || '');
      setActCourse(editActivity.courseCode || 'ICH 100L');
      setActDay(editActivity.day || daySelected);
      setActStart(editActivity.timeStart || '09:00');
      setActEnd(editActivity.timeEnd || '11:00');
      setActLocation(editActivity.location || '');
      setActCategory(editActivity.category || 'Lecture');
      setActDesc(editActivity.description || '');
      setActDelivery(editActivity.deliveryType || 'physical');
      setActLink(editActivity.classLink || '');
      setActDate(editActivity.date || '');
    }
  }, [type, editActivity, daySelected]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    if (type === 'schedule') {
      if (!actTitle.trim() || !actLocation.trim() || !actCourse.trim()) {
        setFormError('Please fill in Name, Course Code and Venue Location.');
        setIsSubmitting(false);
        return;
      }

      if (actDelivery === 'online' && actLink.trim() && !actLink.startsWith('http://') && !actLink.startsWith('https://')) {
        setFormError('Online class links must start with http:// or https://');
        setIsSubmitting(false);
        return;
      }

      if (actRepeat === 'none' && !actDate) {
        setFormError('For non-repeating (does not repeat) schedules, a specific Schedule Date is required.');
        setIsSubmitting(false);
        return;
      }

      const finalDate = actRepeat === 'none' ? (actDate || undefined) : undefined;
      let finalDay = actDay;
      if (finalDate) {
        const WEEKDAY_NAMES: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const [year, month, day] = finalDate.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        finalDay = WEEKDAY_NAMES[d.getDay()];
      }

      const activityData = {
        title: actTitle.trim(),
        courseCode: actCourse.trim().toUpperCase(),
        day: finalDay,
        timeStart: actStart,
        timeEnd: actEnd,
        location: actLocation.trim(),
        category: actCategory,
        description: actDesc.trim() || undefined,
        deliveryType: actDelivery,
        classLink: actDelivery === 'online' ? actLink.trim() : undefined,
        date: finalDate,
        departmentId: selectedDeptId || undefined
      };

      if (isEditing && editActivity) {
        onUpdateActivity(editActivity.id, activityData);
        setSuccessMsg('Class schedule updated successfully!');
      } else {
        onAddActivity(activityData);
        setSuccessMsg('New class schedule added successfully!');
      }

      // Briefly wait and redirect
      setTimeout(() => {
        onCancel();
      }, 1000);
    } 
    
    else if (type === 'deadline') {
      if (!dlTitle.trim() || !dlCourse.trim() || !dlDate) {
        setFormError('Please complete all fields (Task Description, Course, and Due Date).');
        setIsSubmitting(false);
        return;
      }

      onAddDeadline({
        title: dlTitle.trim(),
        courseCode: dlCourse.trim().toUpperCase(),
        dueDate: dlDate,
        description: dlDesc.trim() || undefined,
        imageUrl: dlImages[0] || undefined,
        imageUrls: dlImages.length > 0 ? dlImages : undefined,
        departmentId: selectedDeptId || undefined
      } as any);

      setSuccessMsg('Assignment deadline registered successfully!');
      setTimeout(() => {
        onCancel();
      }, 1000);
    } 
    
    else if (type === 'announcement') {
      if (!annTitle.trim() || !annContent.trim()) {
        setFormError('Please fill in both the Subject Title and Broadcast Details.');
        setIsSubmitting(false);
        return;
      }

      onAddAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim(),
        priority: annPriority,
        imageUrl: annImages[0] || undefined,
        imageUrls: annImages.length > 0 ? annImages : undefined,
        departmentId: selectedDeptId || undefined
      } as any);

      setSuccessMsg('Announcement broadcast sent successfully!');
      setTimeout(() => {
        onCancel();
      }, 1000);
    }
  };

  const getPageTitleAndDesc = () => {
    switch (type) {
      case 'schedule':
        return {
          title: isEditing ? 'Edit Class Schedule' : 'Schedule New Class',
          sub: isEditing ? 'Update event parameters and syllabus details' : 'Add lectures, tutorials or safety labs to the student timeline'
        };
      case 'deadline':
        return {
          title: 'Add Assignment Deadline',
          sub: 'Set worksheets, reports or test deliverables to display on student trackers'
        };
      case 'announcement':
        return {
          title: 'Broadcast Announcement',
          sub: 'Publish urgent warnings, rescheduled timetables, or course news'
        };
    }
  };

  const renderDepartmentSelector = () => {
    if (!departments || departments.length === 0) return null;
    return (
      <div id="dept-select-group" className="space-y-1.5 pt-1">
        <label className="block text-xs font-semibold text-slate-300 font-sans">
          Restrict by Department (Optional)
        </label>
        <select
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-sans cursor-pointer"
        >
          <option value="">All Students (General Class) 🌍</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name} ({dept.prefix})
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-400 font-sans font-medium italic select-none">
          If selected, only students with matching matric prefixes can see this and receive push alerts.
        </p>
      </div>
    );
  };

  const info = getPageTitleAndDesc();

  return (
    <div className="min-h-full flex flex-col bg-[#0f172a] overflow-y-auto no-scrollbar">
      {/* Upper navigation header */}
      <div className="flex items-center gap-4 py-4 px-1 border-b border-slate-900/40 shrink-0">
        <button
          onClick={onCancel}
          type="button"
          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-extrabold text-slate-100 tracking-tight">
            {info.title}
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">{info.sub}</p>
        </div>
      </div>

      {/* Main Content Form */}
      <div className="flex-1 py-6">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
          {formError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5 animate-pulse">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form fields conditional based on TYPE */}

          {type === 'schedule' && (
            <div className="space-y-4">
              {/* Activity name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Lecture / Lab Activity Title
                </label>
                <input
                  type="text"
                  required
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder="e.g. Qualitative Analysis Technique"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                />
              </div>

              {renderDepartmentSelector()}

              {/* Course code & category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    value={actCourse}
                    onChange={(e) => setActCourse(e.target.value)}
                    placeholder="e.g. ICH 100L"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                    Category Type
                  </label>
                  <select
                    value={actCategory}
                    onChange={(e) => setActCategory(e.target.value as ActivityCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Lecture">Lecture 📘</option>
                    <option value="Lab">Lab Practical 🧪</option>
                    <option value="Tutorial">Tutorial ✏️</option>
                    <option value="Exam">Exam / Quiz 🚨</option>
                    <option value="Other">Other Event 🎉</option>
                  </select>
                </div>
              </div>

              {/* Delivery mode selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Mode of Delivery
                </label>
                <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActDelivery('physical');
                      if (actLocation === 'Virtual Class link') setActLocation('');
                    }}
                    className={`py-2 rounded-lg text-xs font-medium font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      actDelivery === 'physical'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Physical Class</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActDelivery('online');
                      if (!actLocation) setActLocation('Online Meeting Room');
                    }}
                    className={`py-2 rounded-lg text-xs font-medium font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      actDelivery === 'online'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Online Class</span>
                  </button>
                </div>
              </div>

              {/* Repeat Days / Frequency */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Repeat Days / Frequency
                </label>
                <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActRepeat('none');
                    }}
                    className={`py-2 rounded-lg text-xs font-medium font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer border-none outline-none ${
                      actRepeat === 'none'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Does Not Repeat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActRepeat('weekly');
                      setActDate(''); // Clear date for repeating weekly events
                    }}
                    className={`py-2 rounded-lg text-xs font-medium font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer border-none outline-none ${
                      actRepeat === 'weekly'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Weekly Repeating</span>
                  </button>
                </div>
              </div>

              {/* Date selection field */}
              {actRepeat === 'none' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    required
                    value={actDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setActDate(newDate);
                      if (newDate) {
                        const WEEKDAY_NAMES: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const [year, month, day] = newDate.split('-').map(Number);
                        const d = new Date(year, month - 1, day);
                        setActDay(WEEKDAY_NAMES[d.getDay()]);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              )}

              {/* Target Timetable Days */}
              {actRepeat === 'weekly' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                    Target Weekday
                  </label>
                  <select
                    value={actDay}
                    onChange={(e) => setActDay(e.target.value as DayOfWeek)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
              )}

              {/* Start time & End time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Start Time</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={actStart}
                    onChange={(e) => setActStart(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>End Time</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={actEnd}
                    onChange={(e) => setActEnd(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Venue / Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1">
                  {actDelivery === 'online' ? <Globe className="w-3.5 h-3.5 text-emerald-400" /> : <MapPin className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{actDelivery === 'online' ? 'Virtual Platform Name' : 'Venue Room / Laboratory'}</span>
                </label>
                <input
                  type="text"
                  required
                  value={actLocation}
                  onChange={(e) => setActLocation(e.target.value)}
                  placeholder={actDelivery === 'online' ? 'e.g. Google Meet, Zoom' : 'e.g. Chemistry Lab Hall 1'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                />
              </div>

              {/* Online Class url link (shown if Online) */}
              {actDelivery === 'online' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Live Class Join Link</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={actLink}
                    onChange={(e) => setActLink(e.target.value)}
                    placeholder="e.g. https://meet.google.com/abc-defg-hij"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-505 focus:border-emerald-500 transition-colors font-mono text-emerald-300 text-xs"
                  />
                </div>
              )}

              {/* Remarks / items to bring */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Syllabus details, materials, or prep notes
                </label>
                <textarea
                  rows={4}
                  value={actDesc}
                  onChange={(e) => setActDesc(e.target.value)}
                  placeholder="e.g. Students must attend with lab safety instructions handout and goggles. Pre-read chapter 2."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors font-sans resize-none"
                />
              </div>
            </div>
          )}

          {type === 'deadline' && (
            <div className="space-y-4">
              {/* Deadline title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Assignment or Deliverable Description
                </label>
                <input
                  type="text"
                  required
                  value={dlTitle}
                  onChange={(e) => setDlTitle(e.target.value)}
                  placeholder="e.g. Salt Analysis Practical Sheet Submission"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-505 focus:border-indigo-500 transition-colors font-sans"
                />
              </div>

              {renderDepartmentSelector()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    value={dlCourse}
                    onChange={(e) => setDlCourse(e.target.value)}
                    placeholder="e.g. ICH 100L"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Due Date</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dlDate}
                    onChange={(e) => setDlDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Detailed Guidelines / Submission Tray
                </label>
                <textarea
                  rows={4}
                  value={dlDesc}
                  onChange={(e) => setDlDesc(e.target.value)}
                  placeholder="e.g. Solve worksheets 1-5, bundle and slide in Course Rep pigeon hole box at Faculty center."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors font-sans resize-none"
                />
              </div>

              {/* Deadline image attachment section */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Attach Assignment Reference Images / Lab Sheets (Multiple Optional)</span>
                </label>
                
                {isUploadingImg && (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 bg-slate-950/80 rounded-2xl py-8 px-4 text-center mb-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                    <span className="text-xs font-semibold text-slate-200">Processing & Compressing Images...</span>
                    <span className="text-[10px] text-slate-400 mt-1 font-mono font-bold">Scaling down dimensions for optimized storage...</span>
                  </div>
                )}

                {dlImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl border border-slate-800/80 bg-slate-950/40 mb-4 animate-fadeIn">
                    {dlImages.map((img, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-1 group/thumb">
                        <img 
                          src={img} 
                          alt={`Preview ${idx + 1}`} 
                          className="w-full aspect-video object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setDlImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg cursor-pointer transition-all shrink-0 z-10"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold text-white bg-slate-900/85 px-1.5 py-0.5 rounded border border-slate-800/60 opacity-90 select-none">
                          Image #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl py-6 px-4 text-center cursor-pointer transition-all group">
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                  <span className="text-xs font-semibold text-slate-300">Drag & drop or Click to add photo(s)</span>
                  <span className="text-[10px] text-slate-500 mt-1 font-mono">You can upload multiple files directly</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageFileChange(e, 'dl')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {type === 'announcement' && (
            <div className="space-y-4">
              {/* Broadcast title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Broadcast Subject Title
                </label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. Urgent venue swap for tomorrow's quiz"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                />
              </div>

              {renderDepartmentSelector()}

              {/* Priority select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Attention Level / Priority
                </label>
                <select
                  value={annPriority}
                  onChange={(e) => setAnnPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="info">General Information ℹ️</option>
                  <option value="medium">Medium Handout Notice ⚠️</option>
                  <option value="high">High Class Rescheduling 🚨</option>
                </select>
              </div>

              {/* Details Content Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
                  Broadcast Details Content
                </label>
                <textarea
                  rows={6}
                  required
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Enter detailed announcements. Use paragraph breaks..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors font-sans resize-none"
                />
              </div>

              {/* Announcement image attachment section */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Attach Broadcast Schematics / Dynamic Timetables (Multiple Optional)</span>
                </label>
                
                {isUploadingImg && (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 bg-slate-950/80 rounded-2xl py-8 px-4 text-center mb-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                    <span className="text-xs font-semibold text-slate-200">Processing & Compressing Images...</span>
                    <span className="text-[10px] text-slate-400 mt-1 font-mono font-bold">Scaling down dimensions for optimized storage...</span>
                  </div>
                )}

                {annImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl border border-slate-800/80 bg-slate-950/40 mb-4 animate-fadeIn">
                    {annImages.map((img, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-1 group/thumb">
                        <img 
                          src={img} 
                          alt={`Preview ${idx + 1}`} 
                          className="w-full aspect-video object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setAnnImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg cursor-pointer transition-all shrink-0 z-10"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold text-white bg-slate-900/85 px-1.5 py-0.5 rounded border border-slate-800/60 opacity-90 select-none">
                          Image #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl py-6 px-4 text-center cursor-pointer transition-all group">
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                  <span className="text-xs font-semibold text-slate-300">Drag & drop or Click to add photo(s)</span>
                  <span className="text-[10px] text-slate-500 mt-1 font-mono">You can upload multiple files directly</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageFileChange(e, 'ann')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Action trigger and Cancel options */}
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isUploadingImg}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {type === 'schedule' 
                      ? (isEditing ? 'Saving...' : 'Scheduling...') 
                      : type === 'deadline' 
                        ? 'Registering...' 
                        : 'Publishing...'}
                  </span>
                </>
              ) : (
                <span>
                  {type === 'schedule' 
                    ? (isEditing ? 'Save Changes' : 'Schedule Class') 
                    : type === 'deadline' 
                      ? 'Register Deadline' 
                      : 'Publish Broadcast'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
