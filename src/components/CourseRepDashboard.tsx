import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  Tag, 
  Megaphone, 
  Plus, 
  Trash2, 
  PlusCircle, 
  PlusSquare, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Info,
  ChevronDown,
  UserCheck,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp 
} from "firebase/firestore";
import { UserRecord } from "../types";

// Dynamic types for Course Representative operations
export interface ScheduleItem {
  id: string;
  courseCode: string;
  courseTitle: string;
  day: string;
  time: string;
  venue: string;
  addedBy: string;
  createdAt: string;
}

export interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string;
  category: "Assignment" | "Exam" | "Lab" | "Project";
  priority: "High" | "Medium" | "Low";
  notes?: string;
  addedBy: string;
  createdAt: string;
}

export interface BroadcastItem {
  id: string;
  title: string;
  content: string;
  priority: "Normal" | "Urgent";
  addedBy: string;
  createdAt: string;
}

interface CourseRepDashboardProps {
  currentUser: any;
  users: UserRecord[];
  logActivity: (action: string, category: string, severity: string, details?: string) => Promise<void>;
}

export default function CourseRepDashboard({
  currentUser,
  users,
  logActivity
}: CourseRepDashboardProps) {
  // Determine if the active logged-in user is officially recognized as a Course Representative
  const loggedInProfile = users.find(u => u.email?.toLowerCase() === currentUser?.email?.toLowerCase());
  const isDocRep = loggedInProfile?.isCourseRep || loggedInProfile?.role === "course_rep";
  
  // Interactive Simulator toggle (unlocked for developers / admins to test the different views instantly)
  const [forceRepView, setForceRepView] = useState<boolean>(false);
  const activeCourseRepAccess = isDocRep || forceRepView;

  // Real-time states
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);

  // Local form states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Syncing states
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);
  const [broadcastsLoading, setBroadcastsLoading] = useState(true);

  // Create Form Fields
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [scheduleDay, setScheduleDay] = useState("Monday");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleVenue, setScheduleVenue] = useState("");

  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineCategory, setDeadlineCategory] = useState<"Assignment" | "Exam" | "Lab" | "Project">("Assignment");
  const [deadlinePriority, setDeadlinePriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [deadlineNotes, setDeadlineNotes] = useState("");

  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState<"Normal" | "Urgent">("Normal");

  // Error/Success local status indicators
  const [formError, setFormError] = useState("");

  // Set up Firebase Real-Time snapshot listeners for Course Rep specific databases
  useEffect(() => {
    // 1. Listen to schedules database
    const unsubscribeSchedules = onSnapshot(collection(db, "schedules"), (snapshot) => {
      const liveSchedules: ScheduleItem[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        liveSchedules.push({
          id: docSnap.id,
          courseCode: d.courseCode || d.code || "CSC 311",
          courseTitle: d.courseTitle || d.title || "No Title",
          day: d.day || "Monday",
          time: d.time || "10:00 AM",
          venue: d.venue || "Lecture Theatre 1",
          addedBy: d.addedBy || "rep",
          createdAt: d.createdAt || new Date().toISOString()
        });
      });
      // Sort days of week
      const dayWeights: Record<string, number> = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
      liveSchedules.sort((a, b) => (dayWeights[a.day] || 10) - (dayWeights[b.day] || 10));
      setSchedules(liveSchedules);
      setSchedulesLoading(false);
    }, (error) => {
      console.warn("Failed schedules snap:", error);
      setSchedulesLoading(false);
    });

    // 2. Listen to deadlines database
    const unsubscribeDeadlines = onSnapshot(collection(db, "deadlines"), (snapshot) => {
      const liveDeadlines: DeadlineItem[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        liveDeadlines.push({
          id: docSnap.id,
          title: d.title || "Assignment",
          dueDate: d.dueDate || d.due || new Date().toISOString(),
          category: d.category || "Assignment",
          priority: d.priority || "Medium",
          notes: d.notes || "",
          addedBy: d.addedBy || "rep",
          createdAt: d.createdAt || new Date().toISOString()
        });
      });
      // Sort by due date ASC
      liveDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setDeadlines(liveDeadlines);
      setDeadlinesLoading(false);
    }, (error) => {
      console.warn("Failed deadlines snap:", error);
      setDeadlinesLoading(false);
    });

    // 3. Listen to broadcasts database
    const unsubscribeBroadcasts = onSnapshot(collection(db, "broadcasts"), (snapshot) => {
      const liveBroadcasts: BroadcastItem[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        liveBroadcasts.push({
          id: docSnap.id,
          title: d.title || "Class Update",
          content: d.content || "",
          priority: d.priority || "Normal",
          addedBy: d.addedBy || "rep",
          createdAt: d.createdAt || new Date().toISOString()
        });
      });
      // Sort reverse chronological
      liveBroadcasts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBroadcasts(liveBroadcasts);
      setBroadcastsLoading(false);
    }, (error) => {
      console.warn("Failed broadcasts snap:", error);
      setBroadcastsLoading(false);
    });

    return () => {
      unsubscribeSchedules();
      unsubscribeDeadlines();
      unsubscribeBroadcasts();
    };
  }, []);

  // Operation Handlers
  const handleAddNewSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim() || !scheduleTime.trim() || !scheduleVenue.trim()) {
      setFormError("All schedule specifications are required properties.");
      return;
    }
    setFormError("");

    try {
      const colRef = collection(db, "schedules");
      const payload = {
        courseCode: courseCode.trim().toUpperCase(),
        courseTitle: courseTitle.trim(),
        day: scheduleDay,
        time: scheduleTime.trim(),
        venue: scheduleVenue.trim(),
        addedBy: currentUser?.email || "faculty_rep",
        createdAt: new Date().toISOString()
      };

      await addDoc(colRef, payload);
      await logActivity(
        `Added class schedule: ${payload.courseCode}`,
        "interaction",
        "success",
        `Created new real-time course instruction session scheduled on ${payload.day} at ${payload.time}.`
      );

      // Clean form state
      setCourseCode("");
      setCourseTitle("");
      setScheduleTime("");
      setScheduleVenue("");
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to commit cloud schedule.");
    }
  };

  const handleAddNewDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlineTitle.trim() || !deadlineDate.trim()) {
      setFormError("Deadline Title and Target Due Date are required fields.");
      return;
    }
    setFormError("");

    try {
      const colRef = collection(db, "deadlines");
      const payload = {
        title: deadlineTitle.trim(),
        category: deadlineCategory,
        dueDate: deadlineDate,
        priority: deadlinePriority,
        notes: deadlineNotes.trim(),
        addedBy: currentUser?.email || "faculty_rep",
        createdAt: new Date().toISOString()
      };

      await addDoc(colRef, payload);
      await logActivity(
        `Issued ${payload.category} deadline: "${payload.title}"`,
        "interaction",
        "success",
        `Created academic tracker target. Category: ${payload.category}, Due: ${new Date(payload.dueDate).toLocaleString()}`
      );

      // Clean
      setDeadlineTitle("");
      setDeadlineDate("");
      setDeadlineNotes("");
      setIsDeadlineModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to catalog cloud deadline.");
    }
  };

  const handleAddNewBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastContent.trim()) {
      setFormError("Broadcast Title and announcement content text cannot be empty.");
      return;
    }
    setFormError("");

    try {
      const colRef = collection(db, "broadcasts");
      const payload = {
        title: broadcastTitle.trim(),
        content: broadcastContent.trim(),
        priority: broadcastPriority,
        addedBy: currentUser?.email || "faculty_rep",
        createdAt: new Date().toISOString()
      };

      await addDoc(colRef, payload);
      await logActivity(
        `Broadcast announcement: "${payload.title}"`,
        "interaction",
        "info",
        `Posted class-wide notifications message. Severity: ${payload.priority.toUpperCase()}`
      );

      setBroadcastTitle("");
      setBroadcastContent("");
      setIsBroadcastModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to dispatch cloud broadcast.");
    }
  };

  const handleDeleteSchedule = async (id: string, code: string) => {
    try {
      await deleteDoc(doc(db, "schedules", id));
      await logActivity(
        `Removed class schedule: ${code}`,
        "interaction",
        "warning",
        "Successfully deleted schedule item from Cloud Firestore database repository."
      );
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleDeleteDeadline = async (id: string, title: string) => {
    try {
      await deleteDoc(doc(db, "deadlines", id));
      await logActivity(
        `Retired deadline: "${title}"`,
        "interaction",
        "warning",
        "Flagged academic activity deadline completed and purged from data stream."
      );
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleDeleteBroadcast = async (id: string, title: string) => {
    try {
      await deleteDoc(doc(db, "broadcasts", id));
      await logActivity(
        `Archived broadcast announcement: "${title}"`,
        "interaction",
        "info",
        "Removed expired broadcast notification card from class stream."
      );
    } catch (err: any) {
      console.warn(err);
    }
  };

  // Seeder to quickly initialize interactive data if the dashboard views are currently empty
  const handleSeedCourseRepData = async () => {
    try {
      // Seed Class Schedules
      const sampleSchedules = [
        { courseCode: "CSC 311", courseTitle: "Distributed Systems & Cloud Networks", day: "Monday", time: "09:00 AM - 11:30 AM", venue: "Engineering Amphitheatre B" },
        { courseCode: "MAT 305", courseTitle: "Numerical Analysis & Computations", day: "Tuesday", time: "12:00 PM - 02:00 PM", venue: "Mathematics Block Lab 1" },
        { courseCode: "CSC 315", courseTitle: "Artificial Intelligence & Heuristics", day: "Wednesday", time: "08:30 AM - 11:00 AM", venue: "New Computer Science Dome" },
        { courseCode: "CSC 319", courseTitle: "Software Architecture & System Design", day: "Thursday", time: "02:30 PM - 05:00 PM", venue: "Hall of Scholars II" }
      ];

      for (const item of sampleSchedules) {
        await addDoc(collection(db, "schedules"), {
          ...item,
          addedBy: currentUser?.email || "seeded@course.rep",
          createdAt: new Date().toISOString()
        });
      }

      // Seed Deadlines
      const sampleDeadlines = [
        { title: "Distributed Systems Lab Report 3", category: "Lab", dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0], priority: "High", notes: "Submit PDF via LMS; must contain proof-of-work container charts." },
        { title: "Midterm Comprehensive Examination", category: "Exam", dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0], priority: "High", notes: "Will cover chapters 1 to 5. Bring scientific calculators." },
        { title: "AI Pacman Agent Script Project", category: "Project", dueDate: new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0], priority: "Medium", notes: "Group work upload. Max 3 members per project folder." }
      ];

      for (const item of sampleDeadlines) {
        await addDoc(collection(db, "deadlines"), {
          ...item,
          addedBy: currentUser?.email || "seeded@course.rep",
          createdAt: new Date().toISOString()
        });
      }

      // Seed Broadcast
      await addDoc(collection(db, "broadcasts"), {
        title: "Urgent Venue Update for AI Lectures",
        content: "Please note that tomorrow's CSC 315 guest lecture has been shifted to the Main Senate Hall because the CS Dome is undergoing physical networking maintenance. Be seated by 08:15 AM sharp.",
        priority: "Urgent",
        addedBy: currentUser?.email || "seeded@course.rep",
        createdAt: new Date().toISOString()
      });

      await logActivity(
        "Seeded representative coordinates",
        "system",
        "success",
        "Initialized schedules, deadlines, and announcement broadcasts in standard formats."
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Status Header */}
      <div className="bg-[#111322]/80 backdrop-blur-md border border-white/[0.06] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Profile Info */}
        <div className="flex items-center gap-3 text-left">
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-400/20 select-none">
            <ShieldCheck className={`h-6 w-6 ${activeCourseRepAccess ? "text-amber-400 rotate-0" : "text-slate-400"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-white uppercase font-sans">Student Portal Directory View</h2>
              {activeCourseRepAccess ? (
                <span className="bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full select-none animate-pulse">
                  Course Coordinator Enabled
                </span>
              ) : (
                <span className="bg-slate-800 border border-slate-700 text-slate-400 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full select-none">
                  Student Tier
                </span>
              )}
            </div>

            <p className="text-[11.5px] text-slate-400 leading-relaxed font-sans mt-0.5 max-w-xl">
              {activeCourseRepAccess 
                ? "Automatic live link established. As a certified Course Representative, your controls are primed to manage academic timelines, class timetables, and send urgent notification broadcasts."
                : "You are logged in with student privilege. Class lectures, upcoming task timelines, and broadcasts are presented read-only. Course reps hold full edit permissions."
              }
            </p>
          </div>
        </div>

        {/* Sandbox Dev Toggles (Very convenient to test!) */}
        <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-white/[0.05] shrink-0">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block font-sans">Sandbox Rep Override:</span>
          <button
            onClick={() => setForceRepView(!forceRepView)}
            className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-[10px] tracking-wide transition-all uppercase border cursor-pointer ${
              forceRepView 
                ? "bg-amber-400/20 text-amber-300 border-amber-400/40 hover:bg-amber-400/30" 
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600"
            }`}
            title="Convenient override button to simulate being a Course Rep instantly"
          >
            {forceRepView ? "★ FORCED ACTIVE" : "☆ OVERRIDE"}
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN LEFT: Live Class Timetable / Schedules (Span 7) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="bg-[#111322]/80 backdrop-blur-md rounded-2xl border border-white/[0.06] p-5 space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-blue-400" />
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block font-sans">Lecture Timetables</span>
              </div>
              
              {/* Dynamic Plus Button displayed conditionally if authorized */}
              {activeCourseRepAccess && (
                <button
                  id="add-schedule-btn"
                  onClick={() => { setFormError(""); setIsScheduleModalOpen(true); }}
                  className="flex items-center gap-1 bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Class</span>
                </button>
              )}
            </div>

            {schedulesLoading ? (
              <div className="py-8 text-center text-slate-500 font-mono text-[10.5px]">
                Syncing schedules with cloud store...
              </div>
            ) : schedules.length === 0 ? (
              <div className="py-12 border border-dashed border-white/[0.05] rounded-xl text-center space-y-3">
                <Layers className="h-8 w-8 text-slate-600 mx-auto" />
                <div className="text-xs font-semibold text-slate-400">Class timetable is currently empty.</div>
                {activeCourseRepAccess ? (
                  <button
                    onClick={handleSeedCourseRepData}
                    className="text-[10px] font-bold text-indigo-400 hover:text-white underline cursor-pointer"
                  >
                    Load Sample Schedule & Lectures
                  </button>
                ) : (
                  <p className="text-[10px] text-slate-500">Wait for your assigned Course Rep to write class registers.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {schedules.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[#181a2e]/60 border border-white/[0.04] hover:border-blue-500/30 rounded-xl p-4 flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-start gap-3 text-left">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-bold font-mono h-11 w-11 flex items-center justify-center shrink-0">
                          {item.day.slice(0,3).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-blue-300">{item.courseCode}</span>
                            <span className="h-1 w-1 bg-white/20 rounded-full" />
                            <span className="font-semibold text-xs text-white max-w-[200px] sm:max-w-xs truncate">{item.courseTitle}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-500" />
                              <span>{item.time}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-500" />
                              <span>{item.venue}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Display Delete Button only if they are Course Reps */}
                      {activeCourseRepAccess && (
                        <button
                          onClick={() => handleDeleteSchedule(item.id, item.courseCode)}
                          className="p-1 px-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer select-none"
                          title="Purge Class Timing"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Class Broadcast banner */}
          <div className="bg-[#111322]/80 backdrop-blur-md rounded-2xl border border-white/[0.06] p-5 space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4.5 w-4.5 text-rose-400" />
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block font-sans">Classroom Broadcasting Channels</span>
              </div>
              
              {/* Add Broadcast option button */}
              {activeCourseRepAccess && (
                <button
                  id="add-broadcast-btn"
                  onClick={() => { setFormError(""); setIsBroadcastModalOpen(true); }}
                  className="flex items-center gap-1 bg-rose-500/10 border border-rose-450/30 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Post broadcast</span>
                </button>
              )}
            </div>

            {broadcastsLoading ? (
              <div className="py-6 text-center text-slate-500 font-mono text-[10px]">
                Listening to broadcasts...
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] text-xs text-slate-400 text-left">
                No active announcements found. All classes are proceeding according to schedules.
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {broadcasts.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className={`rounded-xl border p-4 text-left ${
                        item.priority === "Urgent" 
                          ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                          : "bg-[#181a2e]/60 border-white/[0.04] text-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-2">
                            {item.priority === "Urgent" && (
                              <span className="bg-rose-500 text-white font-bold font-mono text-[8.5px] uppercase tracking-wider leading-none px-1.5 py-0.5 rounded shrink-0">
                                Urgent
                              </span>
                            )}
                            <h4 className="text-white font-bold text-xs font-sans tracking-tight leading-snug">{item.title}</h4>
                          </div>
                          
                          <p className="text-[11px] leading-relaxed text-slate-300">{item.content}</p>
                          
                          <div className="text-[9px] font-mono text-slate-500 pt-1 flex items-center gap-2">
                            <span>Author: {item.addedBy.split("@")[0]}</span>
                            <span>•</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {activeCourseRepAccess && (
                          <button
                            onClick={() => handleDeleteBroadcast(item.id, item.title)}
                            className="p-1 px-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Archived Announcement"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN RIGHT: Deadlines, Lab Tests, & Exams (Span 5) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-[#111322]/80 backdrop-blur-md rounded-2xl border border-white/[0.06] p-5 space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block font-sans">Due Task Metrics & Exams</span>
              </div>

              {/* Dynamic Plus Button for Deadlines */}
              {activeCourseRepAccess && (
                <button
                  id="add-deadline-btn"
                  onClick={() => { setFormError(""); setIsDeadlineModalOpen(true); }}
                  className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-450/30 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Task</span>
                </button>
              )}
            </div>

            {deadlinesLoading ? (
              <div className="py-6 text-center text-slate-500 font-mono text-[10px]">
                Cataloging course schedules...
              </div>
            ) : deadlines.length === 0 ? (
              <div className="p-6 border border-dashed border-white/[0.05] rounded-xl text-center text-slate-400 text-xs">
                Excellent! All submissions successfully processed.
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {deadlines.map((item) => {
                    const daysLeft = Math.ceil((new Date(item.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysLeft < 0;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-[#181a2e]/60 border border-white/[0.04] p-3 rounded-xl flex items-start justify-between gap-3 text-left relative overflow-hidden"
                      >
                        {/* High priority danger banner */}
                        {item.priority === "High" && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                        )}

                        <div className="space-y-1.5 flex-1 pl-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-wider ${
                              item.category === "Exam" ? "bg-purple-500/10 text-purple-400 border border-purple-500/25" :
                              item.category === "Lab" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25" :
                              item.category === "Project" ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" :
                              "bg-blue-500/10 text-blue-400 border border-blue-500/25"
                            }`}>
                              {item.category}
                            </span>
                            
                            <span className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-semibold uppercase tracking-wider ${
                              item.priority === "High" ? "text-red-400 font-bold" :
                              item.priority === "Low" ? "text-slate-500" : "text-amber-400"
                            }`}>
                              {item.priority} Pri
                            </span>
                          </div>

                          <h4 className="font-bold text-xs text-white leading-tight font-sans text-left">{item.title}</h4>
                          
                          {item.notes && (
                            <p className="text-[10.5px] leading-relaxed text-slate-400 italic font-sans">{item.notes}</p>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[9.5px] font-mono text-slate-500">
                              Due: {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                            <span className="text-slate-600 text-[10px] select-none">•</span>
                            
                            {isOverdue ? (
                              <span className="text-rose-400 font-bold font-mono text-[9px] uppercase tracking-wide">
                                Overdue
                              </span>
                            ) : daysLeft === 0 ? (
                              <span className="text-amber-400 font-bold font-mono text-[9px] uppercase tracking-wider animate-pulse">
                                Due Today!
                              </span>
                            ) : (
                              <span className={`font-mono text-[9.5px] font-semibold ${daysLeft <= 3 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                                {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Complete Task Option for Reps */}
                        {activeCourseRepAccess && (
                          <button
                            onClick={() => handleDeleteDeadline(item.id, item.title)}
                            className="p-1 px-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Mark as Completed"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS ENGINES SECTION */}

      {/* 1. Schedule Addition Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111322] border border-white/[0.08] rounded-3xl p-6.5 max-w-md w-full shadow-2xl text-left space-y-4">
            
            <div className="flex justify-between items-center bg-white/[0.01] border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-400" />
                <h3 className="text-white font-bold text-sm uppercase tracking-tight font-sans">Add Class Register</h3>
              </div>
              <button 
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewSchedule} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-950/40 text-red-300 border border-red-500/20 text-[11px] rounded-lg text-left">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    placeholder="CSC 311"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Database Management Systems"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Weekday</label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
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
                
                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Lecture Time</label>
                  <input
                    type="text"
                    required
                    placeholder="09:00 AM - 11:30 AM"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Venue / Physical / Online</label>
                <input
                  type="text"
                  required
                  placeholder="Engineering Lecture Hall B"
                  value={scheduleVenue}
                  onChange={(e) => setScheduleVenue(e.target.value)}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold hover:bg-white/[0.04] text-slate-400 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all"
                >
                  Commit Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Deadlines/Tasks Addition Modal */}
      {isDeadlineModalOpen && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111322] border border-white/[0.08] rounded-3xl p-6.5 max-w-md w-full shadow-2xl text-left space-y-4">
            
            <div className="flex justify-between items-center bg-white/[0.01] border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-400" />
                <h3 className="text-white font-bold text-sm uppercase tracking-tight font-sans">Issue Academic Deadline</h3>
              </div>
              <button 
                onClick={() => setIsDeadlineModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewDeadline} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-950/40 text-red-300 border border-red-500/20 text-[11px] rounded-lg text-left">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Title / Target Assignment</label>
                <input
                  type="text"
                  required
                  placeholder="Distributed Networks Lab 3 Report"
                  value={deadlineTitle}
                  onChange={(e) => setDeadlineTitle(e.target.value)}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={deadlineCategory}
                    onChange={(e: any) => setDeadlineCategory(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="Exam">Exam</option>
                    <option value="Lab">Lab Test</option>
                    <option value="Project">Project submission</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                  <select
                    value={deadlinePriority}
                    onChange={(e: any) => setDeadlinePriority(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Target Submission Due Date</label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Submission instructions / Notes</label>
                <textarea
                  placeholder="Bring physical printouts to the department locker, or submit PDF to class drive folder link..."
                  value={deadlineNotes}
                  onChange={(e) => setDeadlineNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsDeadlineModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold hover:bg-white/[0.04] text-slate-400 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] transition-all"
                >
                  Issue Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Class Broadcast Announcement Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111322] border border-white/[0.08] rounded-3xl p-6.5 max-w-md w-full shadow-2xl text-left space-y-4">
            
            <div className="flex justify-between items-center bg-white/[0.01] border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-rose-400" />
                <h3 className="text-white font-bold text-sm uppercase tracking-tight font-sans">Class Dispatch Broadcast</h3>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewBroadcast} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-950/40 text-red-300 border border-red-500/20 text-[11px] rounded-lg text-left">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Notification Title</label>
                <input
                  type="text"
                  required
                  placeholder="Lecture shift notification / Class event cancelation"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Broadcasting Severity</label>
                <select
                  value={broadcastPriority}
                  onChange={(e: any) => setBroadcastPriority(e.target.value)}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="Normal">Normal update</option>
                  <option value="Urgent">⚠️ Urgent class broadcase</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Content / Message</label>
                <textarea
                  required
                  placeholder="Write message content for all students following this cohort stream..."
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  rows={4}
                  className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold hover:bg-white/[0.04] text-slate-400 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:from-rose-600 hover:to-pink-700 active:scale-[0.98] transition-all"
                >
                  Publish Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
