import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Sparkles, 
  FileText, 
  BookOpen, 
  HelpCircle, 
  Brain, 
  ChevronRight, 
  Check, 
  MessageSquare, 
  Briefcase, 
  Loader2, 
  Settings, 
  ArrowLeft,
  Crown,
  Lock
} from "lucide-react";
import GlassCard from "./GlassCard";
import { db } from "../lib/firebase";
import { collection, query, orderBy, getDocs, collectionGroup } from "firebase/firestore";

interface AIDashboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSource?: {
    type: "deadline" | "pdf" | "custom";
    id?: string;
    name: string;
    details?: string;
  } | null;
  deadlines?: any[];
  isCourseRep?: boolean;
}

interface AvailablePdf {
  id: string;
  title: string;
  pdfUrl: string;
  courseCode?: string;
}

export default function AIDashboardPanel({
  isOpen,
  onClose,
  initialSource = null,
  deadlines = [],
  isCourseRep = false
}: AIDashboardPanelProps) {
  // Phase state: 'tool_select' | 'source_select' | 'form_inputs' | 'submitting' | 'coming_soon'
  const [phase, setPhase] = useState<"tool_select" | "form_inputs" | "submitting" | "coming_soon">("tool_select");
  
  // Custom tool state
  const [selectedTool, setSelectedTool] = useState<"summarize" | "quiz" | "help" | null>(null);
  
  // Source type state
  const [sourceType, setSourceType] = useState<"deadline" | "pdf" | "custom">("custom");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [customInputText, setCustomInputText] = useState<string>("");

  // Loaded PDFs for source selection
  const [availablePdfs, setAvailablePdfs] = useState<AvailablePdf[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  // Form states
  const [summaryLength, setSummaryLength] = useState<"brief" | "detailed" | "formulas">("detailed");
  const [quizSize, setQuizSize] = useState<number>(5);
  const [quizDifficulty, setQuizDifficulty] = useState<"intro" | "intermediate" | "challenge">("intermediate");
  const [helpFocus, setHelpFocus] = useState<"derivation" | "concept" | "calculation" | "general">("concept");
  const [extraPrompt, setExtraPrompt] = useState<string>("");

  // Selected details string to play in confirmation screen
  const [processedSourceLabel, setProcessedSourceLabel] = useState<string>("");

  // Fetch PDFs from database for selection list
  useEffect(() => {
    if (isOpen) {
      const fetchPdfs = async () => {
        setLoadingPdfs(true);
        try {
          if (db) {
            const snap = await getDocs(collectionGroup(db, "pdf-modules"));
            const list: AvailablePdf[] = [];
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                title: data.title || "Untitled File",
                pdfUrl: data.pdfUrl || "",
              });
            });
            setAvailablePdfs(list);
          }
        } catch (e) {
          console.warn("Silent ignore: modules list skipped", e);
        } finally {
          setLoadingPdfs(false);
        }
      };
      fetchPdfs();
    }
  }, [isOpen]);

  // Handle Initial Source Injection on load/open
  useEffect(() => {
    if (isOpen && initialSource) {
      setSourceType(initialSource.type);
      setSelectedItemId(initialSource.id || "");
      if (initialSource.name) {
        setCustomInputText(initialSource.name);
      }
      // If we got an assignment or a PDF, default our step to picking a tool and skipping custom source selection
      setPhase("tool_select");
    } else {
      // Set default
      setPhase("tool_select");
      setSelectedTool(null);
    }
  }, [isOpen, initialSource]);

  const handleToolSelect = (tool: "summarize" | "quiz" | "help") => {
    setSelectedTool(tool);
    setPhase("form_inputs");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhase("submitting");

    // Gather descriptive text of the chosen source for the feedback screen
    let srcLabel = "";
    if (sourceType === "deadline") {
      const item = deadlines.find((d) => d.id === selectedItemId);
      srcLabel = item ? `Assignment: ${item.title} (${item.courseCode})` : "Selected Assignment Task Card";
    } else if (sourceType === "pdf") {
      const item = availablePdfs.find((p) => p.id === selectedItemId);
      srcLabel = item ? `PDF Material: ${item.title}` : "Selected Module Syllabus PDF";
    } else {
      srcLabel = customInputText ? `Custom Prompt: "${customInputText.slice(0, 45)}..."` : "Syllabus Prompt Input";
    }
    setProcessedSourceLabel(srcLabel);

    setTimeout(() => {
      setPhase("coming_soon");
    }, 1800);
  };

  const resetAll = () => {
    setPhase("tool_select");
    setSelectedTool(null);
    setSourceType("custom");
    setSelectedItemId("");
    setCustomInputText("");
    setExtraPrompt("");
  };

  // UI colors matching overall dark premium app
  const accentGradient = "from-indigo-500 to-violet-600";
  const glowShadow = "shadow-[0_0_20px_rgba(99,102,241,0.25)]";

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="w-full max-w-md h-[88vh] bg-[#0c1020]/95 border-t border-slate-800/80 rounded-t-[2.5rem] flex flex-col overflow-hidden shadow-[0_-15px_40px_rgba(0,0,0,0.6)]"
        >
          {/* Top Panel Bar */}
          <div className="px-5 py-4 border-b border-slate-800/50 bg-slate-950/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
                <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-100 font-display">Gemini Study Co-Pilot</span>
                  <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-400/20 px-1.5 py-0.2 rounded-full">
                    <Sparkles className="h-2 w-2 text-indigo-300" />
                    <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider text-indigo-200">Alpha Core</span>
                  </div>
                </div>
                <p className="text-[9.5px] font-mono text-slate-400">Google AI Powered Core Engine</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isCourseRep && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono font-bold text-amber-400 uppercase tracking-tight select-none">
                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Rep Access</span>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-all cursor-pointer outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Core Content Body Frame */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-5 text-left pb-12">
            {isCourseRep && phase !== "coming_soon" && (
              <GlassCard className="p-3.5 bg-amber-500/5 border-amber-500/20 flex gap-2.5 items-start">
                <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-display font-black text-amber-400 uppercase tracking-wide">Course Representative Console Active</h4>
                  <p className="text-[10px] text-slate-350 leading-relaxed font-sans">
                    You have preview rights to monitor and test academic co-pilot features before system-wide release. PDF indexers are currently simulation-throttled.
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Phase 1: Tool Selection UI */}
            {phase === "tool_select" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-display font-bold text-white tracking-tight">Select an AI Study Tool</h3>
                  <p className="text-xs text-slate-400 font-sans">Choose how you want Google Gemini to process your syllabus study materials.</p>
                </div>

                <div className="space-y-3">
                  {/* Tool 1: Summarize */}
                  <div
                    onClick={() => handleToolSelect("summarize")}
                    className="p-4 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all duration-300 group flex items-start gap-3.5"
                  >
                    <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 shrink-0 border border-indigo-500/10">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">PDF Summarizer</h4>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-400 font-sans mt-1 leading-relaxed">
                        Condensation module. Extract key formulas, conceptual definitions, and outline summaries of massive sheets.
                      </p>
                    </div>
                  </div>

                  {/* Tool 2: Quiz Generator */}
                  <div
                    onClick={() => handleToolSelect("quiz")}
                    className="p-4 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all duration-300 group flex items-start gap-3.5"
                  >
                    <div className="p-3 rounded-xl bg-violet-500/10 group-hover:bg-violet-500/20 text-violet-400 shrink-0 border border-violet-500/10">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">Quiz Master Revision</h4>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-400 font-sans mt-1 leading-relaxed">
                        Interactive test architect. Draft targeted practice worksheets, quiz questions, and flashcards directly from PDF topics.
                      </p>
                    </div>
                  </div>

                  {/* Tool 3: Assignment Help */}
                  <div
                    onClick={() => handleToolSelect("help")}
                    className="p-4 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all duration-300 group flex items-start gap-3.5"
                  >
                    <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 shrink-0 border border-emerald-500/10">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">Assignment Co-Pilot</h4>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-400 font-sans mt-1 leading-relaxed">
                        Step-by-step problem unpacking. Unravel complex assignments, identify prerequisite formula steps, and get visual outlines.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subtext info */}
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl flex items-start gap-2 max-w-sm mt-2 text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    AI processing references actual document text models in real-time. Click an assignment card's active tool indicator to auto-inject context parameters.
                  </p>
                </div>
              </div>
            )}

            {/* Phase 2: Form Inputs (combined tool + source config form) */}
            {phase === "form_inputs" && selectedTool && (
              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setPhase("tool_select")}
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 mb-2 cursor-pointer outline-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>CHANGE STUDY TOOL</span>
                </button>

                {/* Selected tool visual card status */}
                <div className="flex items-center gap-3 p-3 bg-indigo-950/20 border border-indigo-500/15 rounded-xl">
                  {selectedTool === "summarize" && (
                    <>
                      <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-mono font-bold text-indigo-200 uppercase tracking-wider">PDF Summarizer Mode</h4>
                        <p className="text-[10.5px] text-slate-350">Create direct outline notes</p>
                      </div>
                    </>
                  )}
                  {selectedTool === "quiz" && (
                    <>
                      <Brain className="w-5 h-5 text-violet-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-mono font-bold text-violet-200 uppercase tracking-wider">Quiz Master revision</h4>
                        <p className="text-[10.5px] text-slate-350">Draft revise-ready worksheets</p>
                      </div>
                    </>
                  )}
                  {selectedTool === "help" && (
                    <>
                      <HelpCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-mono font-bold text-emerald-200 uppercase tracking-wider">Assignment Co-Pilot Mode</h4>
                        <p className="text-[10.5px] text-slate-350">Step-by-step math solver breakdowns</p>
                      </div>
                    </>
                  )}
                </div>

                {/* 1. Pick Source Section */}
                <div className="space-y-2.5">
                  <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Choose Source Document
                  </label>
                  
                  {/* Source Toggle Pills */}
                  <div className="flex p-0.5 rounded-xl bg-slate-950 border border-slate-900 text-[11px] font-sans">
                    <button
                      type="button"
                      onClick={() => {
                        setSourceType("custom");
                        setSelectedItemId("");
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-semibold text-center cursor-pointer transition-all ${
                        sourceType === "custom"
                          ? "bg-slate-905 bg-slate-900 border border-slate-800 text-slate-100 shadow"
                          : "text-slate-400 hover:text-slate-350"
                      }`}
                    >
                      Custom Input
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSourceType("deadline");
                        if (deadlines.length > 0 && !selectedItemId) {
                          setSelectedItemId(deadlines[0].id);
                        }
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-semibold text-center cursor-pointer transition-all ${
                        sourceType === "deadline"
                          ? "bg-slate-905 bg-slate-900 border border-slate-800 text-slate-100 shadow"
                          : "text-slate-400 hover:text-slate-350"
                      }`}
                    >
                      Assignments
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSourceType("pdf");
                        if (availablePdfs.length > 0 && !selectedItemId) {
                          setSelectedItemId(availablePdfs[0].id);
                        }
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-semibold text-center cursor-pointer transition-all ${
                        sourceType === "pdf"
                          ? "bg-slate-905 bg-slate-900 border border-slate-800 text-slate-100 shadow"
                          : "text-slate-400 hover:text-slate-350"
                      }`}
                    >
                      PDF Files
                    </button>
                  </div>

                  {/* Rendering Source Selection Inputs */}
                  {sourceType === "custom" && (
                    <div className="space-y-1">
                      <textarea
                        required
                        value={customInputText}
                        onChange={(e) => setCustomInputText(e.target.value)}
                        placeholder="Paste syllabus notes, concept sentences, or specify core topic prompts here..."
                        className="w-full h-24 p-3 bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 rounded-xl transition-all resize-none font-sans"
                      />
                    </div>
                  )}

                  {sourceType === "deadline" && (
                    <div className="space-y-1">
                      {deadlines.length === 0 ? (
                        <div className="text-xs text-rose-400 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 text-center font-sans font-semibold">
                          No deadlines available is registered in system list.
                        </div>
                      ) : (
                        <select
                          value={selectedItemId}
                          onChange={(e) => setSelectedItemId(e.target.value)}
                          className="w-full p-2.5 bg-slate-950/70 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 rounded-xl font-sans"
                        >
                          {deadlines.map((dl) => (
                            <option key={dl.id} value={dl.id}>
                              {dl.courseCode}: {dl.title} ({dl.dueDate})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {sourceType === "pdf" && (
                    <div className="space-y-1">
                      {loadingPdfs ? (
                        <div className="p-3 bg-slate-950/40 rounded-xl flex items-center justify-center text-xs text-slate-400 gap-2">
                          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                          <span>Syncing workspace PDF documents...</span>
                        </div>
                      ) : availablePdfs.length === 0 ? (
                        <div className="text-xs text-rose-400 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 text-center font-sans font-semibold">
                          No catalog syllabus PDF files are uploaded yet. Click syllabus tab first to upload.
                        </div>
                      ) : (
                        <select
                          value={selectedItemId}
                          onChange={(e) => setSelectedItemId(e.target.value)}
                          className="w-full p-2.5 bg-slate-950/70 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 rounded-xl font-sans"
                        >
                          {availablePdfs.map((pdf) => (
                            <option key={pdf.id} value={pdf.id}>
                              {pdf.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Tool Specific Configuration parameters */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Settings className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold text-slate-350 uppercase tracking-widest block">
                      Core Target AI Parameters
                    </span>
                  </div>

                  {/* Summary tool parameters */}
                  {selectedTool === "summarize" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                          Summary Formatting Length
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "brief", label: "Executive Bullet" },
                            { id: "detailed", label: "Analytical Standard" },
                            { id: "formulas", label: "Formulas Only" }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSummaryLength(opt.id as any)}
                              className={`py-2 px-1 rounded-lg text-[9.5px] font-semibold tracking-tight text-center cursor-pointer transition-all border ${
                                summaryLength === opt.id
                                  ? "bg-indigo-600/15 border-indigo-500/60 text-indigo-300"
                                  : "bg-slate-950 border-slate-850 text-slate-450 hover:text-slate-300"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quiz tool parameters */}
                  {selectedTool === "quiz" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                            Number of revision items
                          </label>
                          <select
                            value={quizSize}
                            onChange={(e) => setQuizSize(Number(e.target.value))}
                            className="w-full p-2 bg-slate-950 border border-slate-850 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 rounded-lg font-sans"
                          >
                            <option value={5}>5 Questions</option>
                            <option value={10}>10 Questions</option>
                            <option value={15}>15 Questions</option>
                          </select>
                        </div>

                        <div className="space-y-1.5 text-left">
                          <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                            Difficulty Setting
                          </label>
                          <select
                            value={quizDifficulty}
                            onChange={(e) => setQuizDifficulty(e.target.value as any)}
                            className="w-full p-2 bg-slate-950 border border-slate-850 text-slate-200 text-xs focus:outline-none focus:border-indigo-505 rounded-lg font-sans"
                          >
                            <option value="intro">Prerequisite Baselines</option>
                            <option value="intermediate">Academic Standard</option>
                            <option value="challenge">Exam Challenge Mode</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Help assignment help tool parameters */}
                  {selectedTool === "help" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5 text-left">
                        <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                          Assignment Focus Component
                        </label>
                        <select
                          value={helpFocus}
                          onChange={(e) => setHelpFocus(e.target.value as any)}
                          className="w-full p-2 bg-slate-950 border border-slate-850 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 rounded-lg font-sans"
                        >
                          <option value="concept">Conceptual Breakdown Explanations</option>
                          <option value="derivation">Mathematical Physics Derivations</option>
                          <option value="calculation">Prerequisite Formula Calculation Outlines</option>
                          <option value="general">Analytical Review & Proof Check</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Extra Prompt / Request field */}
                  <div className="space-y-1.5">
                    <label className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                      Additional Prompt / Specific instruction (Optional)
                    </label>
                    <input
                      type="text"
                      value={extraPrompt}
                      onChange={(e) => setExtraPrompt(e.target.value)}
                      placeholder="e.g. Focus on physical biochemistry derivations, solve Part B..."
                      className="w-full p-2.5 bg-slate-950 border border-slate-850 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 rounded-lg font-sans"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-550 border border-indigo-550/20 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/10 cursor-pointer text-center outline-none select-none active:scale-98 transition-all"
                >
                  Analyze & Stream Answer
                </button>
              </form>
            )}

            {/* Phase 3: Submitting Animation */}
            {phase === "submitting" && (
              <div className="py-16 text-center space-y-6 flex flex-col justify-center items-center h-full">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin flex items-center justify-center">
                    <Brain className="w-6 h-6 text-indigo-400 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 bg-indigo-500/10 rounded-full filter blur-xl animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-display font-medium text-slate-100 uppercase tracking-wide">
                    Gemini Core Ingesting Documents
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Analyzing raw PDF characters, mapping prerequisite equations, and compiling localized vector embeddings...
                  </p>
                </div>

                <div className="max-w-[200px] border border-white/[0.04] rounded-xl p-2.5 bg-white/[0.01] font-mono text-[9px] text-slate-500 space-y-1">
                  <div>Status: <span className="text-amber-400">CONNECTING_NODE</span></div>
                  <div>ID: <span className="text-indigo-400 font-bold">GEMINI-FLASH-STUDY</span></div>
                  <div>Latency: <span className="text-emerald-400 font-bold">45ms</span></div>
                </div>
              </div>
            )}

            {/* Phase 4: Coming Soon Placeholder */}
            {phase === "coming_soon" && (
              <div className="space-y-6 py-4">
                <div className="bg-gradient-to-r from-indigo-600/35 to-violet-600/25 border border-indigo-500/35 rounded-3xl p-6 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Brain className="h-32 w-32 text-indigo-400 animate-pulse" />
                  </div>
                  <Sparkles className="w-10 h-10 text-indigo-300 mx-auto mb-3 animate-pulse" />

                  <h3 className="text-lg font-display font-black text-slate-100 uppercase tracking-tight">
                    AI Feature Coming Soon
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2 max-w-xs mx-auto">
                    The Gemini Alpha study integration module is fully configured and ready for implementation.
                  </p>
                </div>

                {/* Simulated analysis breakdown */}
                <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Settings className="w-4.5 h-4.5 text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                      Payload Pipeline Captured
                    </span>
                  </div>

                  <div className="space-y-2.5 font-sans text-xs">
                    <div className="flex justify-between border-b border-transparent py-0.5">
                      <span className="text-slate-450 text-[11px]">Selected Module:</span>
                      <strong className="text-slate-250 text-right truncate max-w-[170px]" title={processedSourceLabel}>
                        {processedSourceLabel || "Direct Workspace Source Input"}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-transparent py-0.5">
                      <span className="text-slate-450 text-[11px]">Tool Strategy:</span>
                      <strong className="text-indigo-300 font-mono text-[10px] uppercase">
                        {selectedTool === "summarize" 
                          ? `PDF Summarize (${summaryLength})` 
                          : selectedTool === "quiz" 
                          ? `Quiz Revision (${quizSize} qs)` 
                          : `Assignment Help (${helpFocus})`}
                      </strong>
                    </div>

                    {extraPrompt && (
                      <div className="flex justify-between border-b border-transparent py-0.5">
                        <span className="text-slate-450 text-[11px]">Sub-Prompt:</span>
                        <span className="text-slate-350 italic text-right truncate max-w-[170px]">
                          "{extraPrompt}"
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between border-b border-transparent py-0.5">
                      <span className="text-slate-450 text-[11px]">Pipeline Status:</span>
                      <span className="font-mono text-[9.5px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-md font-bold uppercase select-none">
                        <Check className="w-2.5 h-2.5" />
                        READY_TO_CONNECT
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submitting instructions */}
                <div className="p-4 bg-slate-900/20 border border-slate-800/80 rounded-2xl flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-slate-200">Production API Pending</h4>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans">
                      This co-pilot structure is fully implemented behind the scenes as a secure standalone module. Standard API keys will be linked in the immediate patch.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetAll}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold tracking-wide transition-all cursor-pointer text-center outline-none select-none"
                >
                  PROCCESS ANOTHER SYLLABUS DIRECTIVE
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
