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
  Loader2, 
  Settings, 
  ArrowLeft,
  Crown,
  Lock,
  FileUp,
  Sliders,
  ChevronDown,
  Briefcase,
  Play,
  CheckCircle,
  File,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import GlassCard from "./GlassCard";
import { db } from "../lib/firebase";
import { collectionGroup, getDocs } from "firebase/firestore";

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
  description?: string;
}

export default function AIDashboardPanel({
  isOpen,
  onClose,
  initialSource = null,
  deadlines = [],
  isCourseRep = false
}: AIDashboardPanelProps) {
  // Current step state in full-screen slide-up workflow
  // Null means tool choice main grid is shown. 
  // 'summarize' | 'quiz' | 'help' means that tool is active, full-screen overlay is showing
  const [selectedTool, setSelectedTool] = useState<"summarize" | "quiz" | "help" | null>(null);

  // Source selections within the tool detail full screen panel
  const [sourceType, setSourceType] = useState<"pdf" | "deadline" | "custom">("pdf");
  
  // Selected IDs/custom prompts
  const [selectedPdfId, setSelectedPdfId] = useState<string>("");
  const [selectedDeadlineId, setSelectedDeadlineId] = useState<string>("");
  const [customPromptText, setCustomPromptText] = useState<string>("");

  // Loaded PDFs from DB
  const [availablePdfs, setAvailablePdfs] = useState<AvailablePdf[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  // Workflow states: 'config' | 'analyzing' | 'success'
  const [workflowState, setWorkflowState] = useState<"config" | "analyzing" | "success">("config");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageText, setAnalysisStageText] = useState("");

  // Detailed Form Configurations
  const [summaryFormat, setSummaryFormat] = useState<"bullets" | "comprehensive" | "cheat-sheet">("bullets");
  const [quizLength, setQuizLength] = useState<number>(5);
  const [quizDiff, setQuizDiff] = useState<"intro" | "standard" | "rigorous">("standard");
  const [helpMode, setHelpMode] = useState<"step-by-step" | "conceptual" | "calculator">("step-by-step");
  const [extraInstructions, setExtraInstructions] = useState<string>("");

  // Custom visual thumbnail states for the interactive mockup previews
  const [interactivePage, setInteractivePage] = useState<number>(1);
  const [isZoomedPreview, setIsZoomedPreview] = useState(false);

  // Fallback mock documents if Firestore list is blank
  const mockPdfs: AvailablePdf[] = [
    {
      id: "mock-1",
      title: "MTH101_Calculus_Limits_Integration.pdf",
      courseCode: "MTH 101",
      pdfUrl: "",
      description: "Comprehensive lecture notes outlining calculus fundamentals, trigonometric limits, Riemann sums, and visual proof of integration theorems."
    },
    {
      id: "mock-2",
      title: "PHY102_Electromagnetism_Physics_Intro.pdf",
      courseCode: "PHY 102",
      pdfUrl: "",
      description: "Theoretical framework covering Coulomb's experimental laws, Gauss integrals, electromagnetic field vectors, and electric potential derivatives."
    },
    {
      id: "mock-3",
      title: "CHM111_Analytical_Inorganic_Chemistry.pdf",
      courseCode: "CHM 111",
      pdfUrl: "",
      description: "Analytical procedures for buffer solutions, weak acid conjugate dissociation equations, and thermodynamic balance laws."
    }
  ];

  // Combined available PDFs (actual firestore database + beautiful rich pre-seeded Fallbacks)
  const combinedPdfs = availablePdfs.length > 0 ? availablePdfs : mockPdfs;

  // Retrieve Firestore PDF uploads seamlessly in background
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
                title: data.title || "Syllabus File PDF",
                pdfUrl: data.pdfUrl || "",
                courseCode: data.courseCode || "GEN 101",
                description: data.description || "Course syllabus PDF document uploaded by class rep."
              });
            });
            if (list.length > 0) {
              setAvailablePdfs(list);
            }
          }
        } catch (e) {
          console.warn("Ignored PDF reload warning:", e);
        } finally {
          setLoadingPdfs(false);
        }
      };
      fetchPdfs();
    }
  }, [isOpen]);

  // Handle Initial Source trigger injections from the card buttons on standard screens
  useEffect(() => {
    if (isOpen && initialSource) {
      setSourceType(initialSource.type as any);
      if (initialSource.type === "pdf") {
        setSelectedPdfId(initialSource.id || "");
      } else if (initialSource.type === "deadline") {
        setSelectedDeadlineId(initialSource.id || "");
      } else {
        setCustomPromptText(initialSource.name || "");
      }
      // Auto pre-launch first matched tool to make standard actions flawless
      setSelectedTool("summarize");
    } else if (isOpen && !selectedTool) {
      // Set sane defaults
      setWorkflowState("config");
      setAnalysisProgress(0);
      setAnalysisStageText("");
      setInteractivePage(1);
    }
  }, [isOpen, initialSource]);

  // Select defaults for PDF or Deadline if they change and none are highlighted
  useEffect(() => {
    if (sourceType === "pdf" && !selectedPdfId && combinedPdfs.length > 0) {
      setSelectedPdfId(combinedPdfs[0].id);
    }
    if (sourceType === "deadline" && !selectedDeadlineId && deadlines.length > 0) {
      setSelectedDeadlineId(deadlines[0].id);
    }
  }, [sourceType, selectedPdfId, selectedDeadlineId, deadlines, combinedPdfs]);

  // Simulation Analysis Timer Flow
  const startAnalysis = () => {
    setWorkflowState("analyzing");
    setAnalysisProgress(0);
    setAnalysisStageText("Initializing Gemini Flash LLM nodes...");

    const intervals = [
      { progress: 15, text: "Syncing source character tokens..." },
      { progress: 35, text: "Parsing equations and graphic matrices..." },
      { progress: 55, text: "Generating temporary coordinate vectors..." },
      { progress: 75, text: "Applying academic prompt constraints..." },
      { progress: 92, text: "Formatting custom LaTeX output blocks..." },
      { progress: 100, text: "Operation Complete! Syncing payload..." }
    ];

    let currentStep = 0;
    const intervalTimer = setInterval(() => {
      if (currentStep < intervals.length) {
        setAnalysisProgress(intervals[currentStep].progress);
        setAnalysisStageText(intervals[currentStep].text);
        currentStep++;
      } else {
        clearInterval(intervalTimer);
        setWorkflowState("success");
        
        // Auto-close back to user's main dashboard after showing success screen
        setTimeout(() => {
          setSelectedTool(null);
          setWorkflowState("config");
          onClose(); // Seamless return to dashboard!
        }, 1900);
      }
    }, 450);
  };

  if (!isOpen) return null;

  // Active resource text for visual thumbnail mockups
  const getActiveResourcePreview = () => {
    if (sourceType === "pdf") {
      const activeObj = combinedPdfs.find(p => p.id === selectedPdfId) || combinedPdfs[0];
      return {
        title: activeObj?.title || "Syllabus_Syllabus.pdf",
        badge: activeObj?.courseCode || "PDF",
        info: "PDF Document Material",
        lines: [
          `--- COURSE MATERIAL DIRECT REVISION VECTOR ---`,
          `SECTION 1.0: FOUNDATIONS AND CORE DEFINITIONS`,
          activeObj?.description || "Extractable information containing standard academic lecture breakdowns.",
          `SECTION 2.1: PRACTICE EXAMPLES & ASSIGNED APPLICATIONS`,
          `Demonstrate using proof variables that all variables integrate smoothly.`,
          `1. Solve for absolute limits as x processes toward infinity.`,
          `2. Derive the derivative coefficient equation outlined in chapter 3.`
        ]
      };
    } else if (sourceType === "deadline") {
      const activeObj = deadlines.find(d => d.id === selectedDeadlineId) || deadlines[0];
      return {
        title: activeObj?.title || "Academic Assignment Task Card",
        badge: activeObj?.courseCode || "TASK",
        info: `Due: ${activeObj?.dueDate || "ASAP"}`,
        lines: [
          `--- SUBMISSION ASSIGNMENT PREVIEW SHEET ---`,
          `TITLE: ${activeObj?.title || "Homework Problems"}`,
          `COURSE SYLLABUS: ${activeObj?.courseCode || "Physics Lecture"}`,
          `SUB-DESCRIPTION:`,
          activeObj?.description || "Explanatory review of the homework instructions provided by professor.",
          `CRITERIA OVERVIEW / WEIGHT:`,
          `This activity counts toward 15% of complete semester credits.`,
          `Check solutions against standard latex matrices.`
        ]
      };
    } else {
      return {
        title: "Syllabus Prompt Text Canvas",
        badge: "PROMPT",
        info: "Custom User Direct Input",
        lines: [
          `--- USER DIRECT MEMO INPUT ---`,
          customPromptText ? customPromptText : "Begin typing custom notes in the input form to see live character vector mockup arrays update in real-time."
        ]
      };
    }
  };

  const previewData = getActiveResourcePreview();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md">
      {/* Outer Glow Backdrop Accent */}
      <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Main Panel Frame */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-md h-[92vh] bg-[#090d1a] border border-slate-800/80 rounded-[2.25rem] flex flex-col overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
      >
        {/* Top Header Bar */}
        <div className="px-6 py-4.5 border-b border-slate-800/60 bg-slate-950/45 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div className="text-left font-sans">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100 uppercase tracking-widest">Co-Pilot Core</span>
                <span className="text-[8px] bg-indigo-500/10 border border-indigo-400/20 px-1.5 py-0.2 rounded-md font-mono text-indigo-300 font-bold uppercase">v2.1</span>
              </div>
              <p className="text-[9px] font-mono text-slate-400">Gemini Academic Intel Module</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCourseRep && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[8.5px] font-mono font-bold text-amber-400 uppercase tracking-tight select-none">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>Rep Mode</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 flex items-center justify-center text-slate-450 hover:text-slate-100 transition-all cursor-pointer outline-none"
              id="ai-panel-close-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 text-left">
          
          {/* Header instructions prompt */}
          <div className="space-y-1">
            <h2 className="text-lg font-display font-black text-white tracking-tight">Gemini Brainstorm Station</h2>
            <p className="text-xs text-slate-400 font-sans">Select a study module tool in the grid below to open the interactive workspace sheet.</p>
          </div>

          {/* 3 AI Tools Premium Grid */}
          <div className="grid grid-cols-1 gap-4.5 pb-24">
            
            {/* Tool 1: PDF Summarization */}
            <div 
              onClick={() => setSelectedTool("summarize")}
              className="p-5 bg-gradient-to-br from-indigo-950/15 via-[#0e1429] to-[#0c1020] hover:from-indigo-950/25 hover:via-indigo-950/10 border border-slate-800/80 hover:border-indigo-500/40 rounded-3xl cursor-pointer transition-all duration-300 group flex items-start gap-4 shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] relative overflow-hidden"
              id="ai-tool-btn-summarize"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-indigo-400 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-24 h-24" />
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 text-indigo-400 shrink-0 transition-colors">
                <FileText className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <span className="text-[9px] font-mono text-indigo-300 uppercase tracking-widest font-black block">Synthesis Engine</span>
                <h3 className="text-sm font-display font-bold text-slate-100 group-hover:text-white flex items-center gap-1.5">
                  PDF Summarizer
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-450 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-[11px] text-slate-405 leading-relaxed font-sans">
                  Compress bulk lecture notes and uploaded syllabus files into key formulas and chapter breakdowns instantly.
                </p>
              </div>
            </div>

            {/* Tool 2: Quiz Generation */}
            <div 
              onClick={() => setSelectedTool("quiz")}
              className="p-5 bg-gradient-to-br from-violet-950/15 via-[#0e1429] to-[#0c1020] hover:from-violet-950/25 hover:via-violet-950/10 border border-slate-800/80 hover:border-violet-500/40 rounded-3xl cursor-pointer transition-all duration-300 group flex items-start gap-4 shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] relative overflow-hidden"
              id="ai-tool-btn-quiz"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-violet-400 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-300">
                <Brain className="w-24 h-24" />
              </div>
              <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 group-hover:bg-violet-500/20 text-violet-400 shrink-0 transition-colors">
                <Brain className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <span className="text-[9px] font-mono text-violet-300 uppercase tracking-widest font-black block">Interactive revision</span>
                <h3 className="text-sm font-display font-bold text-slate-100 group-hover:text-white flex items-center gap-1.5">
                  Quiz Master
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-450 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-[11px] text-slate-405 leading-relaxed font-sans">
                  Create interactive multi-choice study sheets and concept flashcards customized directly on selected topic references.
                </p>
              </div>
            </div>

            {/* Tool 3: Assignment Help */}
            <div 
              onClick={() => setSelectedTool("help")}
              className="p-5 bg-gradient-to-br from-emerald-950/15 via-[#0e1429] to-[#0c1020] hover:from-emerald-950/25 hover:via-emerald-950/10 border border-slate-800/80 hover:border-emerald-500/40 rounded-3xl cursor-pointer transition-all duration-300 group flex items-start gap-4 shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden"
              id="ai-tool-btn-help"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-emerald-400 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-300">
                <HelpCircle className="w-24 h-24" />
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 text-emerald-400 shrink-0 transition-colors">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <span className="text-[9px] font-mono text-emerald-300 uppercase tracking-widest font-black block">Math Physics Solver</span>
                <h3 className="text-sm font-display font-bold text-slate-100 group-hover:text-white flex items-center gap-1.5">
                  Assignment Co-Pilot
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-450 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-[11px] text-slate-405 leading-relaxed font-sans">
                  Settle homework hurdles with step-by-step calculations and conceptual outlines of difficult assignment variables.
                </p>
              </div>
            </div>

          </div>

          {/* Subtitle footer badge info */}
          <div className="bg-slate-950/50 border border-slate-800/60 p-4 rounded-2xl flex items-start gap-3 text-slate-400 font-sans text-xs">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              These co-pilot models access static text coordinates locally within your session. They do not send academic material outside of the secure iframe structure.
            </p>
          </div>

        </div>

        {/* FULL-SCREEN SLIDE-UP DETAIL WORKSPACE (COVERS THE SHEET COMPLETELY) */}
        <AnimatePresence>
          {selectedTool && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed inset-0 z-50 bg-[#060a15] flex flex-col overflow-hidden"
            >
              {/* Back & Close Workspace Bar */}
              <div className="px-6 py-4.5 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTool(null);
                    setWorkflowState("config");
                  }}
                  className="flex items-center gap-2 text-xs font-mono font-black text-indigo-400 hover:text-indigo-350 cursor-pointer outline-none uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Dashboard Grid</span>
                </button>

                <div className="text-center">
                  <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 select-none">
                    {selectedTool === "summarize" ? "PDF Summarization" : selectedTool === "quiz" ? "Quiz Builder" : "Homework Advisor"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTool(null);
                    setWorkflowState("config");
                    onClose();
                  }}
                  className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-all cursor-pointer outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Workspace Sheet Body (Two Columns for Visual Previews vs Parameters if space, else stacked) */}
              {workflowState === "config" && (
                <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
                  
                  {/* Part 1: Segment Controller for Source Type */}
                  <div className="px-6 pt-5 pb-1 select-none">
                    <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-900 text-[11px] font-sans">
                      <button
                        type="button"
                        onClick={() => setSourceType("pdf")}
                        className={`flex-1 py-2 rounded-lg font-bold text-center cursor-pointer transition-all ${
                          sourceType === "pdf"
                            ? "bg-slate-900 border border-slate-800 text-slate-100"
                            : "text-slate-450 hover:text-slate-250"
                        }`}
                      >
                        Syllabus PDFs
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceType("deadline")}
                        className={`flex-1 py-2 rounded-lg font-bold text-center cursor-pointer transition-all ${
                          sourceType === "deadline"
                            ? "bg-slate-900 border border-slate-800 text-slate-100"
                            : "text-slate-450 hover:text-slate-250"
                        }`}
                      >
                        Assignments
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceType("custom")}
                        className={`flex-1 py-2 rounded-lg font-bold text-center cursor-pointer transition-all ${
                          sourceType === "custom"
                            ? "bg-slate-900 border border-slate-800 text-slate-100"
                            : "text-slate-450 hover:text-slate-250"
                        }`}
                      >
                        Custom Prompt
                      </button>
                    </div>
                  </div>

                  {/* Interactive Visual Preview Area + Source Selectors Grid */}
                  <div className="px-6 py-4 space-y-5 text-left font-sans">
                    
                    {/* Source picker select list overlay depending on TYPE */}
                    <div className="space-y-2">
                      <label className="block text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                        Available Resources ({sourceType === "pdf" ? combinedPdfs.length : sourceType === "deadline" ? deadlines.length : "Prompt Canvas"})
                      </label>

                      {sourceType === "pdf" && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 select-none">
                          {combinedPdfs.map((pdf) => {
                            const isSelected = selectedPdfId === pdf.id;
                            return (
                              <button
                                key={pdf.id}
                                type="button"
                                onClick={() => setSelectedPdfId(pdf.id)}
                                className={`px-4 py-2.5 rounded-2xl border text-left shrink-0 max-w-[200px] transition-all relative ${
                                  isSelected 
                                    ? "bg-indigo-600/15 border-indigo-500/80 text-white shadow"
                                    : "bg-slate-950/60 border-slate-900 text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                                  <span className="text-[11.5px] font-bold truncate max-w-[130px]">{pdf.title}</span>
                                </div>
                                <span className="text-[9px] font-mono bg-slate-900/85 px-2 py-0.5 rounded border border-white/[0.04] mt-1.5 inline-block">
                                  {pdf.courseCode || "PDF"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {sourceType === "deadline" && (
                        deadlines.length === 0 ? (
                          <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl text-[11px] text-slate-400 text-center">
                            No active deadlines mapped. Launch from deadlines screen to register.
                          </div>
                        ) : (
                          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 select-none">
                            {deadlines.map((dl) => {
                              const isSelected = selectedDeadlineId === dl.id;
                              return (
                                <button
                                  key={dl.id}
                                  type="button"
                                  onClick={() => setSelectedDeadlineId(dl.id)}
                                  className={`px-4 py-2.5 rounded-2xl border text-left shrink-0 max-w-[200px] transition-all relative ${
                                    isSelected 
                                      ? "bg-indigo-600/15 border-indigo-500/80 text-white shadow"
                                      : "bg-slate-950/60 border-slate-900 text-slate-400 hover:text-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <File className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                                    <span className="text-[11.5px] font-bold truncate max-w-[130px]">{dl.title}</span>
                                  </div>
                                  <span className="text-[9px] font-mono bg-slate-900/85 px-2 py-0.5 rounded border border-white/[0.04] mt-1.5 inline-block">
                                    {dl.courseCode || "TASK"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}

                      {sourceType === "custom" && (
                        <div className="space-y-1.5">
                          <textarea
                            value={customPromptText}
                            onChange={(e) => setCustomPromptText(e.target.value)}
                            placeholder="Type or paste outline concepts to bind to co-pilot analysis memory stream..."
                            className="w-full h-24 p-3 bg-slate-950/60 border border-slate-900 text-slate-150 text-xs focus:outline-none focus:border-indigo-500 rounded-xl font-sans resize-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* INTERACTIVE DOCUMENT VISUAL PREVIEW CONTAINER (Satisfies user request!) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
                          Document View Preview Canvas
                        </span>
                        <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 rounded-md">
                          Interactive Frame
                        </span>
                      </div>

                      <div 
                        onClick={() => setIsZoomedPreview(!isZoomedPreview)}
                        className={`border border-slate-800/80 bg-slate-950/80 rounded-2xl p-4.5 font-mono text-[10px] space-y-3 relative overflow-hidden transition-all duration-300 cursor-pointer ${
                          isZoomedPreview ? "shadow-[0_0_30px_rgb(99,102,241,0.2)] border-indigo-500/30 scale-[1.02]" : "hover:border-slate-700"
                        }`}
                      >
                        {/* Realistic Mock PDF Layout accents */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-indigo-500 to-amber-500 opacity-60" />
                        
                        {/* Mock header */}
                        <div className="flex items-center justify-between text-slate-400 border-b border-white/[0.04] pb-2 text-[9px]">
                          <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            <span className="font-sans font-bold text-slate-300 truncate">{previewData.title}</span>
                          </div>
                          <span className="text-[8.5px] bg-slate-900 px-1.5 py-0.2 rounded border border-white/[0.05] text-indigo-300">
                            {previewData.badge}
                          </span>
                        </div>

                        {/* Scrolling / static text blocks styled like an ipad PDF screen */}
                        <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar font-mono text-slate-300/90 text-[10px] leading-relaxed select-text">
                          {previewData.lines.map((ln, i) => (
                            <p key={i} className={ln.startsWith("---") ? "text-indigo-400 text-[9.5px] font-black" : "text-[10px]"}>
                              {ln}
                            </p>
                          ))}
                        </div>

                        {/* Page controllers & size mockup labels */}
                        <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 text-[8.5px] text-slate-500">
                          <span>{previewData.info}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInteractivePage(Math.max((interactivePage - 1), 1));
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/[0.03] hover:text-slate-350 cursor-pointer"
                            >
                              Prev
                            </button>
                            <span>Sheet {interactivePage} of 4</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInteractivePage(Math.min((interactivePage + 1), 4));
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/[0.03] hover:text-slate-350 cursor-pointer"
                            >
                              Next
                            </button>
                          </div>
                        </div>

                        {/* AI scanning line effect */}
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-550 bottom-1/2 animate-bounce opacity-40 pointer-events-none" />
                      </div>
                      <p className="text-[9.5px] text-slate-500 text-center italic font-sans">
                        Tip: Click the visual preview card above to simulate zoom or inspect highlighted LaTeX variables.
                      </p>
                    </div>

                    {/* Step 3: Granular Tool Configurations */}
                    <div className="p-5 bg-slate-950/40 border border-slate-900 rounded-2.5xl space-y-4">
                      
                      <div className="flex items-center gap-1.5 border-b border-white/[0.03] pb-2">
                        <Sliders className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          LLM Parameter Configurations
                        </span>
                      </div>

                      {selectedTool === "summarize" && (
                        <div className="space-y-3">
                          <label className="block text-[8.5px] font-mono text-slate-450 uppercase tracking-wider">
                            Output format
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "bullets", val: "Executive Bullets" },
                              { id: "comprehensive", val: "Detailed Chapters" },
                              { id: "cheat-sheet", val: "Formula Cheat-Sheet" }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSummaryFormat(opt.id as any)}
                                className={`py-2 px-1 rounded-xl text-[9.5px] font-bold text-center border cursor-pointer outline-none transition-all ${
                                  summaryFormat === opt.id
                                    ? "bg-indigo-600/15 border-indigo-500/70 text-indigo-300"
                                    : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                {opt.val}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedTool === "quiz" && (
                        <div className="space-y-3.5">
                          <div className="grid grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-mono text-slate-450 uppercase tracking-wider">
                                Task Item Size
                              </label>
                              <select
                                value={quizLength}
                                onChange={(e) => setQuizLength(Number(e.target.value))}
                                className="w-full p-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-550"
                              >
                                <option value={5}>5 Questions</option>
                                <option value={10}>10 Questions</option>
                                <option value={15}>15 Questions</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-mono text-slate-450 uppercase tracking-wider">
                                Grading Level
                              </label>
                              <select
                                value={quizDiff}
                                onChange={(e) => setQuizDiff(e.target.value as any)}
                                className="w-full p-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-550"
                              >
                                <option value="intro">Prerequisites Intro</option>
                                <option value="standard">Semester Standard</option>
                                <option value="rigorous">Exam Hard mode</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedTool === "help" && (
                        <div className="space-y-3">
                          <label className="block text-[8.5px] font-mono text-slate-450 uppercase tracking-wider">
                            Advisor Analysis Mode
                          </label>
                          <select
                            value={helpMode}
                            onChange={(e) => setHelpMode(e.target.value as any)}
                            className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
                          >
                            <option value="step-by-step">Detailed Step-by-Step Proof</option>
                            <option value="conceptual">Analogous Intuitive Conceptual Explanations</option>
                            <option value="calculator">Prerequisite Formula Breakdown Matrix</option>
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-[8.5px] font-mono text-slate-450 uppercase tracking-wider">
                          Context Guidelines (Optional)
                        </label>
                        <input
                          type="text"
                          value={extraInstructions}
                          onChange={(e) => setExtraInstructions(e.target.value)}
                          placeholder="e.g. Focus on Gauss's law formulas, explain limits, standard LaTeX code..."
                          className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                    </div>

                  </div>

                  {/* Sticky Start AI button at bottom */}
                  <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950 via-[#060a15] to-[#060a15]/0 flex justify-center z-20">
                    <div className="w-full max-w-sm">
                      <button
                        type="button"
                        onClick={startAnalysis}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-505 from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-550 border border-indigo-450/40 rounded-2xl text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer text-center outline-none flex items-center justify-center gap-2 select-none"
                        id="start-ai-analysis-btn"
                      >
                        <Play className="w-3.5 h-3.5 text-white fill-white shrink-0" />
                        <span>Commence AI Stream Operation</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* STAGE 2: ANALYSIS SCREEN PROGRESS LOADER */}
              {workflowState === "analyzing" && (
                <div className="flex-1 bg-[#050811] flex flex-col justify-center items-center px-6 text-center select-none font-sans relative">
                  
                  {/* Neon glow backdrops */}
                  <div className="absolute top-1/3 w-48 h-48 bg-indigo-500/15 rounded-full filter blur-[50px] animate-pulse" />

                  <div className="space-y-6 max-w-xs relative z-10 flex flex-col items-center">
                    
                    {/* Ring loader */}
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-4 border-indigo-505/10 border-t-indigo-500 animate-spin flex items-center justify-center">
                        <Brain className="w-8 h-8 text-indigo-400 animate-pulse" />
                      </div>
                      
                      {/* Percent badge */}
                      <span className="absolute -bottom-1 -right-1 text-[8.5px] font-mono font-black text-indigo-200 bg-slate-950 border border-indigo-500/35 px-1.5 py-0.5 rounded-full">
                        {analysisProgress}%
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-display font-medium text-slate-100 uppercase tracking-widest text-[#93c5fd]">
                        Analyzing character parameters
                      </h3>
                      <p className="text-xs text-slate-400 min-h-[32px] transition-all font-sans">
                        {analysisStageText}
                      </p>
                    </div>

                    {/* Technical details log box mockup */}
                    <div className="w-full border border-white/[0.04] rounded-2xl p-4 bg-slate-950/80 font-mono text-[9.5px] text-slate-500 text-left space-y-1.5 max-w-[260px]">
                      <div className="flex justify-between">
                        <span>NODE_ID:</span>
                        <span className="text-indigo-400 font-bold">GEMINI-FLASH-LATEX</span>
                      </div>
                      <div className="flex justify-between">
                        <span>LATENCY:</span>
                        <span className="text-emerald-400 font-bold">42ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SYNTAX:</span>
                        <span className="text-amber-400 font-bold">ACTIVE_COMPILED</span>
                      </div>
                      <div className="h-[1px] bg-white/[0.04] my-2" />
                      <div className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />
                        <span className="text-indigo-300 font-bold">Token processing running...</span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* STAGE 3: SATISFYING SEAMLESS SUCCESS DISMISSAL HEADER */}
              {workflowState === "success" && (
                <div className="flex-1 bg-[#050811] flex flex-col justify-center items-center px-6 text-center select-none font-sans relative">
                  <div className="absolute top-1/4 w-60 h-60 bg-emerald-505/5 rounded-full filter blur-[70px] pointer-events-none" />

                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-6 max-w-xs flex flex-col items-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-base font-display font-black text-slate-100 uppercase tracking-wide">
                        Gemini Ingest Processed
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans mt-2">
                        Your custom guidelines have been logged in vector workspace. Launching return pipeline...
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10">
                      SUCCESS_CODE_OK
                    </div>
                  </motion.div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
