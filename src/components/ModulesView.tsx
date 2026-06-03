/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db, cleanData } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  ArrowLeft, 
  ExternalLink, 
  FileText, 
  Sparkles,
  Loader2,
  Calendar,
  AlertCircle,
  BookMarked,
  Download,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  Menu,
  Columns
} from 'lucide-react';
import GlassCard from './GlassCard';
import { motion, AnimatePresence } from 'motion/react';

export interface Course {
  id: string;
  courseCode: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface PdfModule {
  id: string;
  title: string;
  pdfUrl: string;
  description?: string;
  uploadedAt: string;
  createdBy: string;
  fileSize?: string;
}

interface ModulesViewProps {
  isCourseRep: boolean;
  userMatric: string;
}

// Automatically convert common file hosting sharing links (like Google Drive, Dropbox) to direct raw PDF download endpoints
export function cleanUrlToDirectDownload(url: string): string {
  if (!url) return '';
  let clean = url.trim();

  // 1. Google Drive Sharing Link
  // Supports formats: https://drive.google.com/file/d/FILE_ID/view?usp=sharing, /preview, /edit, etc.
  // Supports open?id=FILE_ID
  const googleDriveMatch = clean.match(/https?:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=)([^/?#\s&]+)/);
  if (googleDriveMatch && googleDriveMatch[1]) {
    const fileId = googleDriveMatch[1];
    return `https://docs.google.com/uc?export=download&id=${fileId}`;
  }

  // 2. Dropbox Sharing Link
  // Supports converting standard sharing links to direct raw download links via dl.dropboxusercontent.com
  if (clean.includes('dropbox.com')) {
    let direct = clean;
    direct = direct.replace('//www.dropbox.com', '//dl.dropboxusercontent.com');
    direct = direct.replace('//dropbox.com', '//dl.dropboxusercontent.com');
    if (direct.includes('?')) {
      if (!direct.includes('dl=1')) {
        direct = direct.replace(/dl=[0-9]/, 'dl=1');
      }
    } else {
      direct += '?dl=1';
    }
    return direct;
  }

  // 3. OneDrive
  // If sharing with redir?, we change redir to download
  if (clean.includes('onedrive.live.com') && clean.includes('redir')) {
    return clean.replace('redir', 'download');
  }

  return clean;
}

export default function ModulesView({ isCourseRep, userMatric }: ModulesViewProps) {
  // Realtime lists
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentModules, setCurrentModules] = useState<PdfModule[]>([]);

  // Search & Loading
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingModules, setIsLoadingModules] = useState(false);

  // Modal States
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isAddingModule, setIsAddingModule] = useState(false);

  // Custom Delete Confirmations & Fallbacks
  const [deleteConfirmModId, setDeleteConfirmModId] = useState<string | null>(null);
  const [deleteConfirmCourseId, setDeleteConfirmCourseId] = useState<string | null>(null);
  const [fallbackIndicator, setFallbackIndicator] = useState<string>('');



  // Source tab choice for creating a PDF ('file' vs 'url')
  const [addModuleSource, setAddModuleSource] = useState<'file' | 'url'>('file');

  // New Course Inputs
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [courseError, setCourseError] = useState('');

  // New Module Inputs
  const [newModTitle, setNewModTitle] = useState('');
  const [newModUrl, setNewModUrl] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [newModSize, setNewModSize] = useState('');
  const [moduleError, setModuleError] = useState('');

  // Local PDF Device Upload State
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState('');

  // 1. Fetch all courses in real-time
  useEffect(() => {
    setIsLoadingCourses(true);
    const q = query(collection(db, 'courses'), orderBy('courseCode', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Course[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Course);
      });
      setCourses(list);
      setIsLoadingCourses(false);
    }, (err) => {
      console.error('Error listening to courses:', err);
      setIsLoadingCourses(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch modules for selected course
  useEffect(() => {
    if (!selectedCourse) {
      setCurrentModules([]);
      return;
    }

    setIsLoadingModules(true);
    const subColRef = collection(db, 'courses', selectedCourse.id, 'pdf-modules');
    const q = query(subColRef, orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: PdfModule[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as PdfModule);
      });
      setCurrentModules(list);
      setIsLoadingModules(false);
    }, (err) => {
      console.error('Error listening to PDF modules:', err);
      setIsLoadingModules(false);
    });

    return () => unsubscribe();
  }, [selectedCourse]);

  // 3. Handle Add Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseError('');

    const codeClean = newCode.trim().toUpperCase();
    const titleClean = newTitle.trim();
    if (!codeClean || !titleClean) {
      setCourseError('Course abbreviation and title are mandatory.');
      return;
    }

    try {
      const courseId = `course-${codeClean.replace(/[^A-Za-z0-9]/g, '-').toLowerCase()}-${Date.now().toString(36)}`;
      const newCourse: Course = {
        id: courseId,
        courseCode: codeClean,
        title: titleClean,
        description: newDesc.trim() || undefined,
        createdBy: userMatric,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'courses', courseId), cleanData(newCourse));
      
      // Reset inputs
      setNewCode('');
      setNewTitle('');
      setNewDesc('');
      setIsAddingCourse(false);
    } catch (err: any) {
      console.error('Save course error:', err);
      setCourseError('Firestore security policies rejected record write.');
    }
  };

  // 4. Handle Delete Course
  const handleDeleteCourse = (courseId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isCourseRep) return;
    setDeleteConfirmCourseId(courseId);
  };

  // 5. PDF File Selection Change (with 100MB constraint)
  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfUploadError('');
    setIsUploadingPdf(true);

    const maxBytes = 100 * 1024 * 1024; // 100MB strictly enforced boundary
    if (file.size > maxBytes) {
      setPdfUploadError('The selected PDF file exceeds the 100MB class syllabus storage boundary limit.');
      setIsUploadingPdf(false);
      return;
    }

    // Capture and format file size
    const sizeInBytes = file.size;
    const formattedSize = sizeInBytes > 1024 * 1024 
      ? `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB` 
      : `${(sizeInBytes / 1024).toFixed(0)} KB`;
    setNewModSize(formattedSize);

    // Append standard form body
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const resp = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setNewModUrl(data.url);
        if (!newModTitle) {
          const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          setNewModTitle(rawName);
        }
      } else {
        // Fallback or detailed error message for serverless environments
        let errorMsg = data.error || 'Failed to upload syllabus PDF to server.';
        if (file.size > 4.5 * 1024 * 1024 && window.location.hostname.includes('vercel')) {
          errorMsg = 'This Vercel serverless environment limits API dynamic uploads to 4.5MB. For files larger than 4.5MB, please use the "Provide Web URL" tab to easily paste any Google Drive, OneDrive, or Dropbox link, which fully bypasses hosting constraints up to 100MB!';
        }
        setPdfUploadError(errorMsg);
      }
    } catch (err) {
      console.error('Syllabus PDF file upload process failed: ', err);
      let errorMsg = 'Upload pipeline failure. Please retry.';
      if (file.size > 4.5 * 1024 * 1024) {
        errorMsg = 'Upload failed because serverless API routers (like Vercel) limit total direct body sizes to 4.5MB. For sizes up to 100MB, please upload to Google Drive or Dropbox and paste the link in the "Provide Web URL" tab!';
      }
      setPdfUploadError(errorMsg);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // 6. Handle Add PDF Module (combining file url or manual url)
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setModuleError('');

    if (!selectedCourse) return;

    const titleClean = newModTitle.trim();
    const urlClean = cleanUrlToDirectDownload(newModUrl);
    
    if (!titleClean || !newModUrl.trim()) {
      setModuleError('Syllabus Title and a valid PDF link or file upload is required.');
      return;
    }

    // Try basic URL verification
    if (!urlClean.startsWith('http://') && !urlClean.startsWith('https://') && !urlClean.startsWith('/')) {
      setModuleError('Please provide a secure absolute link starting with https:// or finish the file upload.');
      return;
    }

    try {
      const moduleId = `mod-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const newModule: PdfModule = {
        id: moduleId,
        title: titleClean,
        pdfUrl: urlClean,
        description: newModDesc.trim() || undefined,
        uploadedAt: new Date().toISOString(),
        createdBy: userMatric,
        fileSize: newModSize || 'Direct Link'
      };

      await setDoc(doc(db, 'courses', selectedCourse.id, 'pdf-modules', moduleId), cleanData(newModule));

      // Trigger background push notification for new PDF
      try {
        await fetch('/api/send-broadcast-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'New PDF Handbook Uploaded 📚',
            body: `Resource Available: "${titleClean}" has been successfully distributed by the Course Rep.`,
            category: 'modules'
          })
        });
      } catch (pushErr) {
        console.warn('Failed to dispatch module push:', pushErr);
      }

      // Reset fields
      setNewModTitle('');
      setNewModUrl('');
      setNewModDesc('');
      setNewModSize('');
      setIsAddingModule(false);
    } catch (err) {
      console.error('Save module error:', err);
      setModuleError('Firestore database rule blocks unauthorized additions.');
    }
  };

  // 7. Handle Delete PDF Module
  const handleDeleteModule = (moduleId: string) => {
    if (!selectedCourse || !isCourseRep) return;
    setDeleteConfirmModId(moduleId);
  };

  // Filter courses by searchable query
  const filteredCourses = courses.filter(c => 
    c.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-1 animate-fadeIn flex flex-col h-full relative" id="modules-view-container">
      <AnimatePresence mode="wait">
        {!selectedCourse ? (
          // ----------------- LIST VIEW (COURSES) -----------------
          <motion.div
            key="courses-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 flex flex-col"
          >
            {/* Curriculum Hub Header */}
            <div className="flex justify-between items-center bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl">
              <div>
                <h2 className="text-base font-display font-extrabold text-slate-100 flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-indigo-400" />
                  <span>Syllabus Modules</span>
                </h2>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5 font-sans leading-none">Explore peer references, handouts and notes archive</p>
              </div>
              
              {isCourseRep && (
                <button
                  onClick={() => setIsAddingCourse(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-bold text-white transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 cursor-pointer outline-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Course</span>
                </button>
              )}
            </div>

            {/* Live Interactive Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search course abbreviation or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950/40 border border-slate-800/70 rounded-2xl text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Courses Grid */}
            {isLoadingCourses ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-500 mb-2" />
                <span className="text-xs font-sans">Connecting syllabus repository...</span>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="text-center py-12 p-6 bg-slate-900/20 border border-slate-800/40 rounded-2xl text-slate-500 space-y-2">
                <AlertCircle className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold">No course records indexed</p>
                <p className="text-[10px] text-slate-500 max-w-[220px] mx-auto leading-normal">
                  {searchQuery ? 'Try adjusting search term filters' : 'Course Representative has not uploaded any curriculum index points yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 max-h-[500px] overflow-y-auto no-scrollbar pb-10">
                {filteredCourses.map((course) => (
                  <div key={course.id}>
                    <GlassCard
                      onClick={() => setSelectedCourse(course)}
                      className="p-4 border border-slate-850 hover:border-slate-800 transition-all cursor-pointer group hover:bg-slate-900/10 pointer-events-auto"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1 text-left flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-sm font-mono font-black text-indigo-400 uppercase">
                              {course.courseCode}
                            </span>
                          </div>
                          <h3 className="text-xs font-display font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                            {course.title}
                          </h3>
                          {course.description && (
                            <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                              {course.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCourseRep && (
                            <button
                              onClick={(e) => handleDeleteCourse(course.id, e)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 rounded-lg text-rose-400 transition-colors cursor-pointer outline-none"
                              title="Delete Course Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[10px] bg-slate-950 font-sans text-slate-400 group-hover:text-white px-2.5 py-1 rounded-xl border border-slate-800 font-bold transition-all">
                            Open Folder
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                ))}
              </div>
            )}

            {/* Float Plus Button for adding a Course (Bottom Right FAB) */}
            {isCourseRep && (
              <div className="fixed bottom-24 right-5 sm:right-1/2 sm:translate-x-48 z-40">
                <button
                  onClick={() => setIsAddingCourse(true)}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-750 hover:from-indigo-500 hover:to-indigo-650 border border-indigo-500/30 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer outline-none"
                  title="Create Course Entry"
                  id="add-course-fab"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          // ----------------- DETAIL VIEW (Syllabus Files for selected Course) -----------------
          <motion.div
            key="course-details"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Top Back Utility Navigation */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <button
                onClick={() => setSelectedCourse(null)}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors duration-200 cursor-pointer p-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Courses</span>
              </button>
              
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                CURRICULUM ARCHIVE
              </span>
            </div>

            {/* Core Course Specs Cover Card */}
            <GlassCard className="p-4 bg-gradient-to-tr from-slate-900/60 to-indigo-950/20 border-slate-850 text-left relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />
              <div className="space-y-1.5">
                <span className="px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-sm font-mono font-black text-indigo-400 uppercase inline-block">
                  {selectedCourse.courseCode}
                </span>
                <h2 className="text-sm font-display font-extrabold text-slate-100">{selectedCourse.title}</h2>
                {selectedCourse.description && (
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">{selectedCourse.description}</p>
                )}
              </div>
            </GlassCard>

            {/* Modules Section Header */}
            <div className="flex justify-between items-center bg-slate-900/40 border border-slate-850 p-3 rounded-xl">
              <div>
                <h4 className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider font-bold">
                  Available Files ({currentModules.length})
                </h4>
              </div>
              
              {isCourseRep && (
                <button
                  onClick={() => setIsAddingModule(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 rounded-xl text-[10px] font-bold text-amber-400 transition-all cursor-pointer outline-none"
                >
                  <Plus className="w-3 h-3" />
                  <span>Upload PDF</span>
                </button>
              )}
            </div>

            {/* Files catalog list */}
            {isLoadingModules ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                <span className="text-[10px] font-sans">Connecting secure file indexes...</span>
              </div>
            ) : currentModules.length === 0 ? (
              <div className="text-center py-14 p-6 bg-slate-900/20 border border-slate-800/40 rounded-2xl text-slate-500 space-y-1.5">
                <FileText className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold">Folder is empty</p>
                <p className="text-[9px] text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                  Course representatives upload direct peer PDF materials or relevant course notes.
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-0.5 max-h-[380px] overflow-y-auto no-scrollbar pb-16">
                {currentModules.map((mod) => (
                  <div
                    key={mod.id}
                    className="p-3 bg-slate-900/30 hover:bg-slate-900/50 border border-slate-850 hover:border-slate-800 rounded-xl transition-all text-left flex items-start gap-3 relative group"
                  >
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/15 text-rose-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-xs font-display font-bold text-slate-200 truncate pr-2">
                          {mod.title}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] font-mono font-bold text-amber-400 shrink-0 animate-pulse-slow" title="PDF direct catalog size">
                          {mod.fileSize || 'Est. 1.2 MB'}
                        </span>
                      </div>
                      
                      {mod.description && (
                        <p className="text-[10px] text-slate-400 font-sans leading-relaxed line-clamp-2">
                          {mod.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-1 text-[8px] font-mono text-slate-500">
                        <Calendar className="w-2.5 h-2.5 text-slate-600" />
                        <span>Uploaded {new Date(mod.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      {isCourseRep && (
                        <button
                          onClick={() => handleDeleteModule(mod.id)}
                          className="p-1.5 bg-rose-500/15 hover:bg-rose-500/30 rounded-lg text-rose-400 transition-colors cursor-pointer outline-none"
                          title="Delete PDF Module"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      
                      {/* FILE VIEWER LINK (EXTERNAL WEB VIEWER, NEW TAB) */}
                      <a
                        href={cleanUrlToDirectDownload(mod.pdfUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 rounded-lg text-indigo-400 transition-all flex items-center justify-center cursor-pointer pointer-events-auto outline-none"
                        title="View PDF in a new browser tab"
                        id={`view-pdf-btn-${mod.id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>

                      {/* DOWNLOAD BUTTON */}
                      <a
                        href={mod.pdfUrl}
                        download={`${mod.title}.pdf`}
                        className="p-1.5 bg-amber-500/10 hover:bg-amber-505/25 border border-amber-500/20 rounded-lg text-amber-400 transition-all flex items-center justify-center cursor-pointer pointer-events-auto"
                        title="Download Syllabus PDF"
                        id={`download-pdf-btn-${mod.id}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Float Plus Button for adding a Syllabus Note PDF (Bottom Right FAB) */}
            {isCourseRep && (
              <div className="fixed bottom-24 right-5 sm:right-1/2 sm:translate-x-48 z-40">
                <button
                  onClick={() => setIsAddingModule(true)}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 border border-amber-500/30 text-white shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer outline-none"
                  title="Upload Syllabus PDF"
                  id="add-pdf-fab"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL Overlay: Add Course ----------------- */}
      {isAddingCourse && (
        <div className="fixed inset-0 bg-slate-950/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2.5 text-left">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-display font-extrabold text-slate-100">Index New Curriculum Course</h3>
            </div>

            {courseError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[10px] leading-relaxed flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{courseError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-3 text-left">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Course Abbr Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICH 101, CHM 111"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Course Title Heading</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inorganic Chemistry Practice"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Core Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Basic stoichiometry theories, salt tests worksheets..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCourse(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-705 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-550 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Save Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL Overlay: Add PDF Module (With Local storage selection) ----------------- */}
      {isAddingModule && selectedCourse && (
        <div className="fixed inset-0 bg-slate-950/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 max-w-sm w-full shadow-2xl text-left">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2.5">
              <FileText className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-display font-extrabold text-slate-100">Upload Syllabus PDF</h3>
                <span className="text-[9px] font-mono text-slate-400 leading-none">Binding to {selectedCourse.courseCode}</span>
              </div>
            </div>

            {/* Input Selection Source Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/60">
              <button
                type="button"
                onClick={() => setAddModuleSource('file')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                  addModuleSource === 'file' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload PDF File
              </button>
              <button
                type="button"
                onClick={() => setAddModuleSource('url')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                  addModuleSource === 'url' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Provide Web URL
              </button>
            </div>

            {moduleError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[10px] leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{moduleError}</span>
              </div>
            )}

            <form onSubmit={handleCreateModule} className="space-y-3">
              {addModuleSource === 'file' ? (
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Choose PDF file (Max 100MB)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileChange}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-mono file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 cursor-pointer"
                  />
                  {isUploadingPdf && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-indigo-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading document file...</span>
                    </div>
                  )}
                  {pdfUploadError && (
                    <p className="text-[10px] text-rose-400 font-medium mt-1">⚠️ {pdfUploadError}</p>
                  )}
                  {newModUrl && (
                    <div className="flex items-center gap-1 text-[9px] text-emerald-400 mt-1 pointer-events-none">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>PDF successfully uploaded of size up to 100MB!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Secure PDF URL / Link</label>
                  <input
                    type="text"
                    required
                    placeholder="https://drive.google.com/file/d/.../view"
                    value={newModUrl}
                    onChange={(e) => setNewModUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/50 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-[8px] text-slate-500 block">
                    Paste Google Drive, Dropbox shared file link, or public web URL.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Volumetric Analysis Notes"
                  value={newModTitle}
                  onChange={(e) => setNewModTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/50 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Summary Description</label>
                <textarea
                  rows={2}
                  placeholder="Covers pipetting methods, indicator options, and molar calculations..."
                  value={newModDesc}
                  onChange={(e) => setNewModDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-955 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingModule(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-705 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingPdf}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl text-xs font-bold text-slate-900 transition-colors cursor-pointer text-center"
                >
                  Confirm Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ----------------- CUSTOM DELETE MODULE CONFIRMATION MODAL ----------------- */}
      {deleteConfirmModId && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100000] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-850 space-y-4 max-w-md w-full shadow-2xl text-left font-sans">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3 text-red-500">
              <Trash2 className="w-5 h-5 animate-pulse" />
              <h3 className="text-sm font-display font-extrabold text-slate-100">Confirm Document Deletion</h3>
            </div>
            
            <p className="text-xs text-slate-350 leading-relaxed font-sans mt-1">
              Are you sure you want to permanently delete this syllabus document resource? This action cannot be undone and will remove the file from everyone's class board device list.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer outline-none text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'courses', selectedCourse!.id, 'pdf-modules', deleteConfirmModId));
                  } catch (err) {
                    console.error('Delete module error:', err);
                  } finally {
                    setDeleteConfirmModId(null);
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer outline-none text-center shadow-md shadow-rose-600/10"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- CUSTOM DELETE COURSE CONFIRMATION MODAL ----------------- */}
      {deleteConfirmCourseId && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100000] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-850 space-y-4 max-w-md w-full shadow-2xl text-left font-sans">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3 text-red-500">
              <Trash2 className="w-5 h-5 animate-pulse" />
              <h3 className="text-sm font-display font-extrabold text-slate-100">Confirm Course Folder Deletion</h3>
            </div>
            
            <p className="text-xs text-slate-355 leading-relaxed font-sans mt-1">
              Are you absolutely certain you want to delete this course folder and all its uploaded PDF resource syllabus notes? This action is permanent and cannot be undone.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCourseId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-755 border border-slate-800 rounded-xl text-xs font-bold text-slate-305 transition-colors cursor-pointer outline-none text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'courses', deleteConfirmCourseId));
                    if (selectedCourse?.id === deleteConfirmCourseId) {
                      setSelectedCourse(null);
                    }
                  } catch (err) {
                    console.error('Delete course error:', err);
                  } finally {
                    setDeleteConfirmCourseId(null);
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-503 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer outline-none text-center shadow-md shadow-rose-600/10"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
