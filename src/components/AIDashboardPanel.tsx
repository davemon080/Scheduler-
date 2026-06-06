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
  ArrowLeft,
  Crown,
  Play,
  File,
  Sliders,
  RotateCw,
  Eye,
  Notebook,
  Compass,
  Zap,
  Flame,
  CheckCircle2,
  Bookmark
} from "lucide-react";
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

// Pages of text representing simulated PDFs
const pdfPagesContent: Record<string, string[]> = {
  "mock-1": [
    `CALCULUS I: INTEGRATION LIMITS AND RIEMANN SUMS
Section 1.1: Standard Limits and the Squeeze Theorem
The squeeze theorem (or sandwich theorem) is a critical proof tool in mathematical analysis.
Case Proof: Let f(x), g(x), and h(x) be functions such that for all x in an open interval containing c (except possibly at c):
                 g(x) ≤ f(x) ≤ h(x)
If the limit of g(x) and h(x) as x approaches c is L, then:
                 lim [x → c] f(x) = L.

Practice Equation: Prove that lim [x → 0] (x² sin(1/x)) = 0.
Since -1 ≤ sin(1/x) ≤ 1 for all x ≠ 0, we can multiply the entire inequality by x² (since x² ≥ 0):
                 -x² ≤ x² sin(1/x) ≤ x²
Taking the outer limits: lim [x → 0] (-x²) = 0 and lim [x → 0] (x²) = 0.
By basic squeeze parameters, the inner function must converge to exactly 0.`,
    `Section 1.2: Riemann Integrals and Continuous Sums
Let f be a continuous function defined on the interval [a, b]. 
We partition the interval [a, b] into n subintervals of equal width:
                 Δx = (b - a) / n
Let x_i* be any sample point in the ith subinterval [x_{i-1}, x_i].
The Riemann sum is defined as:
                 S_n = Σ [i=1 to n] f(x_i*) Δx

As n approaches infinity, the partition width approaches zero. If the limit exists, we define the definite integral:
                 ∫ [a to b] f(x) dx = lim [n → ∞] Σ [i=1 to n] f(x_i*) Δx
Theorem 1.2.1: Any function that is continuous on [a, b] is Riemann integrable on that interval.`,
    `Section 1.3: The Fundamental Theorem of Calculus (FTC)
The FTC bridges the gap between differential calculus and integral calculus.
Part 1: If g(x) = ∫ [a to x] f(t) dt, where f is continuous on [a, b], then:
                 g'(x) = f(x)
This states that integration and differentiation are inverse processes.

Part 2: If f is continuous on [a, b], then:
                 ∫ [a to b] f(x) dx = F(b) - F(a)
where F is any antiderivative of f, meaning F'(x) = f(x).
Example Calculation: Evaluate the area under the curve y = 3x² from x=1 to x=3.
Antiderivative F(x) = x³. 
Thus: F(3) - F(1) = 3³ - 1³ = 27 - 1 = 26.`,
    `Section 1.4: Special Integration by Substitution
For compositions, we apply the chain rule in reverse. Let u = g(x). Then du = g'(x) dx.
Example: ∫ 2x cos(x²) dx.
Let u = x², so du = 2x dx.
Substitute into integral: ∫ cos(u) du = sin(u) + C.
Re-substituting u: sin(x²) + C.

Exercise 1.4-A: Determine the antiderivative coefficient of:
                 ∫ x² e^(x³) dx
Set u = x³. Then du = 3x² dx, so x² dx = 1/3 du.
Result: (1/3) e^(x³) + C. Verify by taking the derivative.`
  ],
  "mock-2": [
    `PHYSICS II: CLASSICAL COULOMB INTERACTIONS & ELECTROSTATICS
Section 2.1: Electrostatic Vectors & Coulomb's Law
Coulomb's Law quantifies the static electrical force between two isolated point charges.
The vector force F_12 exerted by charge q1 on charge q2 is expressed as:
                 F_12 = k_e * (q1 * q2 / r²) * r_hat
where:
  - k_e is Coulomb's constant ≈ 8.987 × 10⁹ N·m²/C²
  - r is the absolute distance separating charges
  - r_hat is the unit vector pointing from q1 to q2

Superposition Ideal: The total electrostatic force exerted on a charge q by a system of N discrete point charges is the vector sum:
                 F_total = Σ [i=1 to N] k_e * (q * q_i / r_i²) * r_i_hat`,
    `Section 2.2: Gauss's Law and Integral Space Fields
Gauss's Law states that the net electric flux through any closed geometric boundary (a Gaussian surface) is proportional to the enclosed electric charge.
Mathematical Flux:
                 Φ_E = ∮ E · dA = Q_enclosed / ε_0
where:
  - E is the electric field vector
  - dA is the differential area vector directed outward
  - ε_0 is the permittivity of free space ≈ 8.854 × 10⁻¹² C²/(N·m²)

Differential Form (Maxwell's First Equation):
                 ∇ · E = ρ / ε_0
where ∇ · E represents the volumetric field divergence, and ρ is the volumetric charge density. This relates local charge density to spatial variation.`,
    `Section 2.3: Conservative Fields and Electric Potential
Since electrostatic forces are conservative, the work done in moving a test charge q0 along a closed path is zero. We define electric potential V as:
                 ΔV = V_b - V_a = - ∫ [a to b] E · ds
Potential difference represents potential energy change per unit charge.

For a point charge q, the potential V at a radial distance r is given by:
                 V = k_e * q / r
The electric field vector can be recovered as the negative spatial gradient of the electric potential:
                 E = - ∇V
In one dimension: E_x = - dV/dx.`,
    `Section 2.4: Capacitance and Energy Storing Matrices
A capacitor consists of two conductors carrying charges of equal magnitude Q but opposite sign.
Capacitance (C) measures the charge storing capacity per volt:
                 C = Q / V
Parallel-Plate Capacitors: Dual plates of equal area A separated by distance d have:
                 C = ε_0 * A / d
The potential energy loaded in a charged capacitor matches the work done to partition charges:
                 U = (1/2) * Q² / C = (1/2) * C * V² = (1/2) * Q * V
Inserting a dielectric material multiplies capacitance by the dielectric constant κ.`
  ],
  "mock-3": [
    `ANALYTICAL INORGANIC CHEMISTRY: EQUILIBRIUM & BUFFER KINETICS
Section 3.1: Weak Acids and Concordant Dissociation
Weak acids do not fully ionize in aqueous dilutions. The equilibrium reaction is:
                 HA (aq) + H₂O (l) ⇌ H₃O⁺ (aq) + A⁻ (aq)
The acid dissociation constant (Ka) defines the equilibrium ratio:
                 Ka = [H₃O⁺][A⁻] / [HA]

The pKa value is the logarithmic scaling expression:
                 pKa = - log (Ka)
Stronger acids have larger Ka variables and consequently lower pKa limits.
Percent Ionization:
                 % Ionization = ([H₃O⁺]_equilibrium / [HA]_initial) × 100%
For concentrated weak solutions, ionization % declines as HA concentration climbs.`,
    `Section 3.2: The Henderson-Hasselbalch Buffer Equation
A buffer solution resists pH fluctuations upon small additions of strong acids/bases.
Buffers are synthesized by mixing weak acids with their conjugate bases.
Taking the log of the Ka expression:
                 pH = pKa + log ( [Conjugate Base] / [Weak Acid] )
                 pH = pKa + log ( [A⁻] / [HA] )

The Henderson-Hasselbalch equation enables direct pH pre-calculation.
Buffer Capacity: Represents the quantity of acid or base a buffer absorbs before pH shifts significantly.
Optimal buffering occurs when [A⁻] ≈ [HA], which means pH ≈ pKa.`,
    `Section 3.3: Precipitants & Solubility Products (Ksp)
Slightly soluble ionic compounds reach chemical equilibrium with their dissolved ions.
For the ionic solid AgCl (Silver Chloride):
                 AgCl (s) ⇌ Ag⁺ (aq) + Cl⁻ (aq)
The equilibrium constant is the solubility product:
                 Ksp = [Ag⁺][Cl⁻]

If we mix solutions such that the ion product Q_sp exceeds the Ksp threshold:
  - If Q_sp > Ksp: Precipitate forms until Q_sp decreases to Ksp.
  - If Q_sp < Ksp: Solution is unsaturated; no precipitate forms.
Common Ion Effect: The solubility of an inorganic salt dramatically decreases in the presence of a common dissolved ion.`,
    `Section 3.4: Thermo-dynamic Equilibria and Gibbs Energy
The equilibrium constant (K) has a mathematical relationship to Gibbs Free Energy change:
                 ΔG° = - R * T * ln(K)
where:
  - R is the ideal gas constant = 8.314 J/(mol·K)
  - T is the absolute temperature in Kelvin
Le Chatelier's Principle: If a dynamic chemical system in equilibrium is subjected to stress, the system shifts its balances to counteract that stress.`
  ]
};

// Simulated mock quizzes based on course
const mockQuizzes: Record<string, Array<{ q: string; o: string[]; a: number }>> = {
  "mock-1": [
    {
      q: "Compute the limit of x sin(1/x) as x approaches 0 using Squeeze parameters:",
      o: ["Undefined", "Exactly 0", "Exactly 1", "Infinity"],
      a: 1
    },
    {
      q: "If F(x) is an antiderivative of f(x) and f is continuous, what is ∫ [a to b] f(x) dx?",
      o: ["F'(b) - F'(a)", "F(a) - F(b)", "F(b) - F(a)", "F(b) * F(a)"],
      a: 2
    },
    {
      q: "Determine the derivative of the integration g(x) = ∫ [2 to x] dt / (1 + t³):",
      o: ["1 / (1 + x³)", "-1 / (1 + x³)", "3x² / (1 + x³)", "x / (1 + x³)"],
      a: 0
    }
  ],
  "mock-2": [
    {
      q: "What does Maxwell's first equation (∇ · E = ρ / ε_0) structurally represent?",
      o: ["Gauss's law in differential form", "Ampere's law of circular loops", "Faraday's chemical induction", "Newton's force projection"],
      a: 0
    },
    {
      q: "Inside a parallel-plate capacitor, what occurs to capacitance if plate spacing d is cut in half?",
      o: ["Inverted to 1/4th", "Decreases by 50%", "Remains constant", "Doubles in capacity"],
      a: 3
    },
    {
      q: "If the electric potential is given by V(x) = 3x² - 5x, evaluate the electric field E_x at x=2:",
      o: ["7 N/C", "-7 N/C", "12 N/C", "0 N/C"],
      a: 1
    }
  ],
  "mock-3": [
    {
      q: "Calculate the theoretical pH of an acetic acid conjugate buffer where [A⁻] is 10 times larger than [HA]:",
      o: ["pH = pKa + 10", "pH = pKa - 1", "pH = pKa + 1", "pH = pKa * 10"],
      a: 2
    },
    {
      q: "What physical result occurs to chemical salt solubility when a common ion is injected?",
      o: ["Solubility expands", "Solubility decreases", "Reaction reaches boiling point", "No kinetic shift"],
      a: 1
    },
    {
      q: "Given ΔG° is a highly negative value, what represents the thermodynamic equilibrium constant K?",
      o: ["K is extremely small", "K is positive and > 1", "K equals exactly zero", "K is negative"],
      a: 1
    }
  ]
};

export default function AIDashboardPanel({
  isOpen,
  onClose,
  initialSource = null,
  deadlines = [],
  isCourseRep = false
}: AIDashboardPanelProps) {
  // Currently active tool in full-screen workspace sheet:
  // Null means main tool portal selection is shown
  // "summarize" | "quiz" | "help"
  const [selectedTool, setSelectedTool] = useState<"summarize" | "quiz" | "help" | null>(null);

  // Loaded PDFs from DB
  const [availablePdfs, setAvailablePdfs] = useState<AvailablePdf[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  // Selected object tracker IDs
  const [selectedPdfId, setSelectedPdfId] = useState<string>("mock-1");
  const [selectedDeadlineId, setSelectedDeadlineId] = useState<string>("");
  const [customPromptText, setCustomPromptText] = useState<string>("");

  // Workflow loader state: "config" | "analyzing" | "success"
  const [workflowState, setWorkflowState] = useState<"config" | "analyzing" | "success" | any>("config");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageText, setAnalysisStageText] = useState("");

  // Parameter adjustments for each tool
  const [summaryFormat, setSummaryFormat] = useState<"bullets" | "comprehensive" | "cheat-sheet">("bullets");
  const [quizLength, setQuizLength] = useState<number>(5);
  const [quizDiff, setQuizDiff] = useState<"intro" | "standard" | "rigorous">("standard");
  const [helpMode, setHelpMode] = useState<"step-by-step" | "conceptual" | "calculator">("step-by-step");
  const [extraInstructions, setExtraInstructions] = useState<string>("");

  // Interactive PDF view elements
  const [activePdfPage, setActivePdfPage] = useState<number>(1);
  const [isZoomed, setIsZoomed] = useState(false);

  // Quiz helper tracker state
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, number>>({});

  // Fallback mock document libraries 
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

  const combinedPdfs = availablePdfs.length > 0 ? availablePdfs : mockPdfs;

  // Retrieve Firestore uploaded resources
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
                title: data.title || "Uploaded Study Doc.pdf",
                pdfUrl: data.pdfUrl || "",
                courseCode: data.courseCode || "GEN 101",
                description: data.description || "Interactive syllabus file material."
              });
            });
            if (list.length > 0) {
              setAvailablePdfs(list);
            }
          }
        } catch (e) {
          console.warn("PDF retrieval warning ignored:", e);
        } finally {
          setLoadingPdfs(false);
        }
      };
      fetchPdfs();
    }
  }, [isOpen]);

  // Handle Initial Source trigger injections from original dashboards
  useEffect(() => {
    if (isOpen && initialSource) {
      if (initialSource.type === "pdf") {
        const found = combinedPdfs.find(p => p.id === initialSource.id || p.title === initialSource.name);
        if (found) {
          setSelectedPdfId(found.id);
        } else if (initialSource.id) {
          setSelectedPdfId(initialSource.id);
        }
        setSelectedTool("summarize");
      } else if (initialSource.type === "deadline") {
        setSelectedDeadlineId(initialSource.id || "");
        setSelectedTool("help");
      } else {
        setCustomPromptText(initialSource.name || "");
        setSelectedTool("help");
      }
    } else if (isOpen && !selectedTool) {
      setWorkflowState("config");
      setAnalysisProgress(0);
      setAnalysisStageText("");
      setActivePdfPage(1);
    }
  }, [isOpen, initialSource]);

  // Handle selectors fallback defaults
  useEffect(() => {
    if (!selectedPdfId && combinedPdfs.length > 0) {
      setSelectedPdfId(combinedPdfs[0].id);
    }
    if (!selectedDeadlineId && deadlines.length > 0) {
      setSelectedDeadlineId(deadlines[0].id);
    }
  }, [selectedPdfId, selectedDeadlineId, deadlines, combinedPdfs]);

  // Run Simulated GenAI Flash Analysis loading screen transitions 
  const executeAISpinner = () => {
    setWorkflowState("analyzing");
    setAnalysisProgress(0);
    setAnalysisStageText("Booting high-performance Gemini LLM node...");

    const steps = [
      { p: 18, t: "Parsing mathematical LaTeX structures..." },
      { p: 38, t: "Rendering visual coordinate mapping vectors..." },
      { p: 58, t: "Applying class guideline constraints..." },
      { p: 78, t: "Reviewing formulas in selected preview canvas..." },
      { p: 94, t: "Compiling responsive homework sheet payload..." },
      { p: 100, t: "Sync completed successfully!" }
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setAnalysisProgress(steps[stepIndex].p);
        setAnalysisStageText(steps[stepIndex].t);
        stepIndex++;
      } else {
        clearInterval(interval);
        setWorkflowState("success");
        
        // Return gracefully back to main dashboard
        setTimeout(() => {
          setSelectedTool(null);
          setWorkflowState("config");
          onClose();
        }, 1800);
      }
    }, 450);
  };

  if (!isOpen) return null;

  // Selected PDF document object
  const activePdfObj = combinedPdfs.find(p => p.id === selectedPdfId) || combinedPdfs[0];

  // Specific pages for text PDF summaries
  const pdfStringPages = pdfPagesContent[selectedPdfId] || pdfPagesContent["mock-1"] || ["Page Content Empty"];

  // Selected Deadline object
  const activeDeadlineObj = deadlines.find(d => d.id === selectedDeadlineId) || deadlines[0] || {
    title: "MTH101 Problem Set 3 - Trigonometric Integrals",
    courseCode: "MTH 101",
    dueDate: "June 12, 2026",
    description: "Please complete all odd-numbered exercises in Calculus Chapter 4 directly on graph paper. Provide full Riemann limits."
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
      {/* Immersive backdrop graphics */}
      <div className="absolute top-[10%] left-[25%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Main Panel Core Container */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="w-full max-w-md h-[94vh] bg-[#070b17] border border-slate-800/90 rounded-[2.5rem] flex flex-col overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
      >
        {/* Main Panel Header Frame */}
        <div className="px-6 py-5 border-b border-slate-800/75 bg-slate-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-left font-sans">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-100 uppercase tracking-widest">Co-Pilot Station</span>
                <span className="text-[8px] bg-indigo-500/15 border border-indigo-400/30 px-1.5 py-0.2 rounded-md font-mono text-indigo-300 font-bold uppercase">Pro v2.2</span>
              </div>
              <p className="text-[9px] font-mono text-slate-400">Class Representative Intel Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCourseRep && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-[8.5px] font-mono font-black text-amber-400 uppercase tracking-normal select-none">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>REP</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-705 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer outline-none"
              id="ai-panel-close-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Centerpiece Choice Portal */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 text-left">
          
          <div className="space-y-1.5">
            <h2 className="text-xl font-display font-black text-white tracking-tight flex items-center gap-2">
              Gemini Co-Pilot Portal
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Launch dedicated, visual-first interactive study sheets built from your uploaded materials.
            </p>
          </div>

          {/* 3 AI Tools Premium Grid */}
          <div className="grid grid-cols-1 gap-4 pb-20">
            
            {/* Tool 1: PDF Summarization Card */}
            <div 
              onClick={() => setSelectedTool("summarize")}
              className="p-5 bg-[#0a0f21] border border-slate-800 hover:border-indigo-500/50 rounded-3xl cursor-pointer transition-all duration-300 group flex items-start gap-4 relative overflow-hidden shadow-lg"
              id="ai-tool-btn-summarize"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-indigo-400 transform translate-x-2 -translate-y-2 group-hover:scale-105 transition-transform duration-300">
                <FileText className="w-24 h-24" />
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 text-indigo-400 shrink-0 transition-colors">
                <FileText className="w-5.5 h-5.5" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <span className="text-[9px] font-mono text-indigo-300 uppercase tracking-widest font-black block">PDF Core Engine</span>
                <h3 className="text-base font-sans font-black text-slate-100 group-hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  Syllabus PDF Summarizer
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-0.5">
                  Generate beautiful executive briefs & cheat sheets from uploaded lecture syllabus PDFs.
                </p>
              </div>
            </div>

            {/* Tool 2: Quiz Generation Card */}
            <div 
              onClick={() => setSelectedTool("quiz")}
              className="p-5 bg-[#0a0f21] border border-slate-800 hover:border-indigo-500/50 rounded-3xl cursor-pointer transition-all duration-300 group flex items-start gap-4 relative overflow-hidden shadow-lg"
              id="ai-tool-btn-quiz"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-indigo-400 transform translate-x-2 -translate-y-2 group-hover:scale-105 transition-transform duration-300">
                <Brain className="w-24 h-24" />
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 text-indigo-400 shrink-0 transition-colors">
                <Brain className="w-5.5 h-5.5" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <span className="text-[9px] font-mono text-indigo-300 uppercase tracking-widest font-black block">Diagnostic Tools</span>
                <h3 className="text-base font-sans font-black text-slate-100 group-hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  Topic Revision Quiz Master
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-0.5">
                  Construct interactive mock quizzes directly testing core concepts inside syllabus documents.
                </p>
              </div>
            </div>

            {/* Tool 3: Assignment Help Card */}
            <div 
              onClick={() => setSelectedTool("help")}
              className="p-5 bg-[#0a0f21] border border-slate-800 hover:border-indigo-500/50 rounded-3xl cursor-pointer transition-all duration-300 group flex items-start gap-4 relative overflow-hidden shadow-lg"
              id="ai-tool-btn-help"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-indigo-400 transform translate-x-2 -translate-y-2 group-hover:scale-105 transition-transform duration-300">
                <HelpCircle className="w-24 h-24" />
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 text-indigo-400 shrink-0 transition-colors">
                <HelpCircle className="w-5.5 h-5.5" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <span className="text-[9px] font-mono text-indigo-300 uppercase tracking-widest font-black block">Active Assistant</span>
                <h3 className="text-base font-sans font-black text-slate-100 group-hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  Assignment Solver Co-Pilot
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-0.5">
                  Settle homework questions with pristine step-by-step calculus proofs and guidelines.
                </p>
              </div>
            </div>

          </div>

          {/* Aesthetic Footer Note */}
          <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl flex items-start gap-3 text-[11px] text-slate-400 leading-relaxed">
            <Sparkles className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
            <span>
              All document scanning operates in an offline, local preview workspace node inside this browser window.
            </span>
          </div>

        </div>

        {/* FULL-SCREEN SLIDE-UP DETAIL WORKSPACE */}
        <AnimatePresence>
          {selectedTool && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed inset-0 z-50 bg-[#050812] flex flex-col overflow-hidden"
              style={{ height: "94vh", top: "6vh" }}
            >
              
              {/* Back & Close Sheet Header */}
              <div className="px-6 py-4.5 border-b border-slate-900 bg-slate-950/70 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTool(null);
                    setWorkflowState("config");
                  }}
                  className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400 hover:text-indigo-350 cursor-pointer outline-none uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                  <span>Grid Dashboard</span>
                </button>

                <div className="text-center">
                  <span className="text-[9px] font-mono font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-widest space-x-1 select-none">
                    {selectedTool === "summarize" ? "Syllabus Summarizer" : selectedTool === "quiz" ? "Revision Quiz Builder" : "Homework Advisor"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTool(null);
                    setWorkflowState("config");
                    onClose();
                  }}
                  className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer outline-none"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {!isCourseRep ? (
                /* GORGEOUS FULL-SCREEN placeholder message for non-course representatives */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050812] text-center space-y-6 select-none relative">
                  <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none" />
                  
                  <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-pulse relative z-10">
                    <Sparkles className="w-12 h-12" />
                  </div>

                  <div className="space-y-3.5 max-w-sm relative z-10">
                    <h3 className="text-2xl font-sans font-black text-white tracking-tight uppercase">
                      AI Feature Coming Soon
                    </h3>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      This premium generative AI model is currently being integrated by your Class Representatives. Stay tuned for automatic synthesis, mock exam prep, and homework advisor support!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTool(null);
                      setWorkflowState("config");
                    }}
                    className="relative z-10 px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-450 hover:to-indigo-550 border border-indigo-400/30 rounded-2xl text-white font-mono font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    Return to Grid Dashboard
                  </button>
                </div>
              ) : (
                /* 1. CONFIGURATION WORKSPACE: CLEAN MINIMAL TASK-SPECIFIC SCREENS & VISUAL PREVIEWS */
                workflowState === "config" && (
                  <div className="flex-1 flex flex-col overflow-hidden relative">
                  
                  {/* SWITCH TO SPECIFIC TOOL SCREEN MODULES */}
                  
                  {/* MODULE A: SYLLABUS PDF SUMMARIZER WORKSPACE */}
                  {selectedTool === "summarize" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Course Catalog Horizontal Row */}
                      <div className="px-6 py-4.5 bg-slate-950/40 border-b border-slate-905 flex flex-col gap-2 shrink-0">
                        <span className="text-[9.5px] font-mono font-bold text-slate-450 uppercase tracking-widest text-left">
                          Confirm Syllabus PDF File Material
                        </span>
                        
                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 select-none">
                          {combinedPdfs.map((pdf) => {
                            const isSelected = selectedPdfId === pdf.id;
                            return (
                              <button
                                key={pdf.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPdfId(pdf.id);
                                  setActivePdfPage(1);
                                }}
                                className={`px-4 py-3 rounded-2xl border text-left shrink-0 max-w-[210px] transition-all relative ${
                                  isSelected 
                                    ? "bg-indigo-600/15 border-indigo-500/80 text-white shadow-md shadow-indigo-650/10"
                                    : "bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                                  <span className="text-[11.5px] font-black truncate max-w-[130px]">{pdf.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="text-[8.5px] font-mono bg-slate-900/90 px-1.5 py-0.2 rounded border border-white/[0.04]">
                                    {pdf.courseCode || "PDF"}
                                  </span>
                                  <span className="text-[8.5px] font-sans text-slate-500 font-bold">1.2 MB</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Large Scrollable Real PDF Viewer (The visual core requested!) */}
                      <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-slate-950 text-left space-y-4">
                        <div className="max-w-lg mx-auto space-y-4">
                          
                          <div className="flex items-center justify-between text-[10px] text-slate-405 font-sans">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Live Scrollable PDF Document Buffer</span>
                            </span>
                            <span className="font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md text-indigo-300">
                              PAGE {activePdfPage} OF {pdfStringPages.length}
                            </span>
                          </div>

                          {/* Beautiful mock high-fidelity continuous paper sheet document */}
                          <div 
                            onClick={() => setIsZoomed(!isZoomed)}
                            className={`bg-white text-slate-900 border border-slate-200 rounded-3xl p-6.5 font-mono text-xs dark:text-slate-850 space-y-4 shadow-2xl relative transition-all duration-300 cursor-pointer ${
                              isZoomed ? "scale-[1.01] border-indigo-500 ring-2 ring-indigo-500/20" : "hover:border-slate-350"
                            }`}
                          >
                            {/* PDF binding stripe accent */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 rounded-t-3xl" />
                            
                            {/* Lighter paper background shading effects */}
                            <div className="absolute top-0 bottom-0 right-3 w-[1px] bg-red-100/60 pointer-events-none" />
                            
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 font-sans">
                              <div>
                                <h4 className="font-black text-slate-900 text-sm tracking-tight">{activePdfObj?.title}</h4>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
                                  Authorized Syllabus Materials — Department Academic Archives
                                </p>
                              </div>
                              <span className="text-[9px] font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded font-black uppercase">
                                PDF DOCUMENT
                              </span>
                            </div>

                            {/* Active page text body */}
                            <div className="min-h-[160px] max-h-[220px] overflow-y-auto no-scrollbar font-mono text-[10.5px] leading-relaxed text-slate-800 space-y-3 whitespace-pre-wrap select-text">
                              {pdfStringPages[activePdfPage - 1]}
                            </div>

                            {/* Simulated margins watermarks */}
                            <div className="flex justify-between items-center text-[9px] text-slate-400 font-sans border-t border-slate-100 pt-3">
                              <span>Syllabus Chapter System • Class Representative Node</span>
                              <span>PAGE {activePdfPage}</span>
                            </div>

                            {/* Scanning pulse line effect */}
                            <div className="absolute left-0 right-0 h-0.5 bg-indigo-500/25 bottom-1/3 animate-pulse pointer-events-none" />
                          </div>

                          {/* Page Flip Action Controls */}
                          <div className="flex justify-center items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setActivePdfPage(prev => Math.max(prev - 1, 1))}
                              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl text-[11px] text-slate-305 font-bold cursor-pointer"
                            >
                              Previous Page
                            </button>
                            <span className="text-[11px] font-mono text-slate-400 px-2 bg-slate-900/60 py-1.5 rounded-xl border border-slate-900">
                              {activePdfPage} / {pdfStringPages.length} Pages
                            </span>
                            <button
                              type="button"
                              onClick={() => setActivePdfPage(prev => Math.min(prev + 1, pdfStringPages.length))}
                              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl text-[11px] text-slate-305 font-bold cursor-pointer"
                            >
                              Next Page
                            </button>
                          </div>

                          {/* Parameter configs card */}
                          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                            <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                              Synthesis Configuration Options
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: "bullets", tag: "Executive Bullets" },
                                { id: "comprehensive", tag: "Detailed Chapters" },
                                { id: "cheat-sheet", tag: "Formula Guide" }
                              ].map(f => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setSummaryFormat(f.id as any)}
                                  className={`py-2 px-1 rounded-xl text-[9.5px] font-bold text-center border cursor-pointer outline-none transition-all ${
                                    summaryFormat === f.id
                                      ? "bg-indigo-600/20 border-indigo-500/80 text-white"
                                      : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
                                  }`}
                                >
                                  {f.tag}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-1.5 pt-1.5">
                              <label className="block text-[8.5px] font-mono text-slate-500 uppercase tracking-widest">
                                Custom Scope Focus guidelines (Optional)
                              </label>
                              <input
                                type="text"
                                value={extraInstructions}
                                onChange={(e) => setExtraInstructions(e.target.value)}
                                placeholder="e.g. Focus on Gauss flux vectors, emphasize homework 3 proofs..."
                                className="w-full p-2.5 bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  )}

                  {/* MODULE B: TOPIC REVISION QUIZ WORKSPACE */}
                  {selectedTool === "quiz" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Topic Selector Badges */}
                      <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-905 flex flex-col gap-2 shrink-0 text-left">
                        <span className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                          Target Topic Blueprint Selection
                        </span>
                        
                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 select-none">
                          {combinedPdfs.map((pdf) => {
                            const isSelected = selectedPdfId === pdf.id;
                            return (
                              <button
                                key={pdf.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPdfId(pdf.id);
                                  setSelectedQuizAnswers({});
                                }}
                                className={`px-4 py-2.5 rounded-2xl border text-left shrink-0 transition-all ${
                                  isSelected 
                                    ? "bg-indigo-600/15 border-indigo-500/80 text-white"
                                    : "bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-250"
                                }`}
                              >
                                <span className="text-xs font-bold block">{pdf.courseCode || "MTH 101"}</span>
                                <span className="text-[9.5px] text-slate-500 block font-mono truncate max-w-[130px]">{pdf.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quiz Sheets Live Preview (Visual preview of quiz) */}
                      <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-slate-950 text-left space-y-4">
                        <div className="max-w-md mx-auto space-y-4">
                          
                          <div className="flex items-center justify-between text-[10px] text-slate-450 font-sans">
                            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#93c5fd]">
                              <Notebook className="w-4 h-4 text-indigo-400" />
                              <span>Live Draft Exam Quiz Blueprint</span>
                            </span>
                            <span className="text-[9px] font-mono bg-indigo-500/10 border border-indigo-455/30 px-2 py-0.5 rounded text-indigo-300 font-bold uppercase">
                              {activePdfObj?.courseCode || "MTH 101"} PROMPT SYSTEM
                            </span>
                          </div>

                          {/* Render Quiz Worksheet Preview */}
                          <div className="bg-[#121625]/90 border border-slate-800 rounded-3xl p-5.5 space-y-4 shadow-xl select-none relative">
                            
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 opacity-60" />
                            
                            <div className="border-b border-white/[0.04] pb-2.5">
                              <span className="text-[9px] font-mono text-indigo-400 font-black uppercase tracking-wider block">Question Practice Sandbox</span>
                              <h4 className="text-[12px] font-sans font-bold text-slate-200 mt-0.5">
                                Select sample radio choices below to preview interactively
                              </h4>
                            </div>

                            {/* Loop mock quiz questions */}
                            <div className="space-y-4">
                              {(mockQuizzes[selectedPdfId] || mockQuizzes["mock-1"]).map((quiz, qIdx) => (
                                <div key={qIdx} className="space-y-2 border-b border-white/[0.02] pb-3 last:border-0 last:pb-0">
                                  <div className="flex items-start gap-1.5 font-sans">
                                    <span className="text-xs font-mono font-bold text-indigo-400 mt-0.5">{qIdx + 1}.</span>
                                    <p className="text-xs font-bold text-slate-100 leading-normal">{quiz.q}</p>
                                  </div>

                                  <div className="grid grid-cols-1 gap-1.5 pl-4 font-sans text-xs">
                                    {quiz.o.map((option, optIdx) => {
                                      const isSelected = selectedQuizAnswers[qIdx] === optIdx;
                                      const isCorrect = optIdx === quiz.a;
                                      return (
                                        <button
                                          key={optIdx}
                                          type="button"
                                          onClick={() => {
                                            setSelectedQuizAnswers(prev => ({
                                              ...prev,
                                              [qIdx]: optIdx
                                            }));
                                          }}
                                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            isSelected
                                              ? isCorrect
                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                                                : "bg-red-500/10 border-red-500/50 text-red-300"
                                              : "bg-slate-950/40 border-slate-900 text-slate-400 hover:text-slate-200"
                                          }`}
                                        >
                                          <span className="truncate max-w-[280px]">{option}</span>
                                          {isSelected && (
                                            isCorrect 
                                              ? <span className="text-[8px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/25">CORRECT</span>
                                              : <span className="text-[8px] font-mono font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/25">INCORRECT</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>

                          </div>

                          {/* Quiz configurations */}
                          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3.5">
                            <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                              Quiz Building Controls
                            </span>

                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-mono text-slate-450 uppercase tracking-wider">
                                  Task Item Size
                                </label>
                                <select
                                  value={quizLength}
                                  onChange={(e) => setQuizLength(Number(e.target.value))}
                                  className="w-full p-2 bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-550"
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
                                  className="w-full p-2 bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-550"
                                >
                                  <option value="intro">Prerequisites Intro</option>
                                  <option value="standard">Semester Standard</option>
                                  <option value="rigorous">Exam Hard Mode</option>
                                </select>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  )}

                  {/* MODULE C: ASSIGNMENT CO-PILOT WORKSPACE (CLEAN NO-CLUTTER LARGE WORKSTATION) */}
                  {selectedTool === "help" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Sub-header list of due assignments */}
                      <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-905 flex flex-col gap-2 shrink-0 text-left">
                        <span className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                          Target active homework assignment
                        </span>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 select-none">
                          {deadlines.length === 0 ? (
                            <div className="text-[11px] text-indigo-400 italic font-medium">
                              No active syllabus milestones found. Displaying standard proof workbook sheet...
                            </div>
                          ) : (
                            deadlines.slice(0, 5).map((dl) => {
                              const isSelected = selectedDeadlineId === dl.id;
                              return (
                                <button
                                  key={dl.id}
                                  type="button"
                                  onClick={() => setSelectedDeadlineId(dl.id)}
                                  className={`px-4 py-2.5 rounded-2xl border text-left shrink-0 max-w-[210px] transition-all relative ${
                                    isSelected 
                                      ? "bg-indigo-600/15 border-indigo-505/80 text-white"
                                      : "bg-slate-950 border-slate-900 text-slate-405 hover:text-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    <File className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="text-[11.5px] font-bold truncate max-w-[130px]">{dl.title}</span>
                                  </div>
                                  <div className="flex justify-between items-center mt-1 text-[8.5px] font-mono text-slate-505">
                                    <span>{dl.courseCode || "TASK"}</span>
                                    <span className="text-amber-400 font-bold">{dl.dueDate || "Due"}</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* CLEAR LARGE NO-CLUTTER VISUAL PREVIEW OF THE WORKSHEET (Satisfies user request!) */}
                      <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-slate-950 text-left space-y-4">
                        <div className="max-w-md mx-auto space-y-4">
                          
                          <div className="flex items-center justify-between text-[10px] text-slate-450 font-sans">
                            <span className="font-bold flex items-center gap-1 uppercase tracking-wide text-[#fbbf24]">
                              <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                              <span>Large Visual Homework Worksheet Document Preview</span>
                            </span>
                          </div>

                          {/* Premium Immersive Graph-Paper Worksheet Mockup */}
                          <div className="bg-[#0f1422] border border-slate-805 rounded-3xl p-6 relative overflow-hidden shadow-2xl space-y-5">
                            {/* Blue grid paper math line overlay */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(51,65,85,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(51,65,85,0.06)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                            
                            {/* Visual checkmark status tag */}
                            <div className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/25 text-amber-400 px-3 py-1 rounded-full font-mono text-[9px] font-black uppercase flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                              <span>Awaiting AI Solver</span>
                            </div>

                            <div className="border-b border-white/[0.04] pb-3 text-left">
                              <span className="text-[8px] font-mono text-indigo-400 font-black tracking-widest uppercase">WORKSHEET INGEST</span>
                              <h3 className="text-sm font-sans font-black text-slate-100 mt-0.5 leading-snug">
                                {activeDeadlineObj?.title}
                              </h3>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">
                                Course Track: {activeDeadlineObj?.courseCode || "CORE PHYSICS"} • Scheduled Milestone
                              </p>
                            </div>

                            {/* Inner worksheet equations and draft drawings (No clutter, clear visual!) */}
                            <div className="p-4 bg-slate-950/70 border border-slate-900 rounded-2xl relative font-mono text-[11px] space-y-3.5 text-slate-300 leading-relaxed">
                              
                              <div className="space-y-1 border-b border-white/[0.03] pb-2.5 text-[10px] text-slate-450">
                                <span className="font-bold text-indigo-305 uppercase">Problem Description:</span>
                                <p className="italic leading-normal select-text">
                                  {activeDeadlineObj?.description || "State Gauss's formula, verify limits, or evaluate derivative solutions outlined."}
                                </p>
                              </div>

                              {/* Realistic handwritten style notes mockups */}
                              <div className="space-y-2">
                                <span className="font-bold text-amber-400 text-[10px] uppercase block tracking-wider font-sans select-none">
                                  ★ Detected Problem Area & Formula Matrices:
                                </span>
                                
                                <div className="p-3 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl space-y-1 text-[11px] text-slate-302 relative">
                                  <div className="text-right text-[8px] text-slate-500 font-mono scale-90">SCHEMATIC FRAME v1</div>
                                  <div>
                                    <span className="text-indigo-400 font-bold">Equation Integral A:</span>
                                    <p className="pl-4 text-slate-200 font-black mt-0.5 select-all">∫ [1 to e] (ln(x) / x) dx = [ (1/2) * (ln(x))² ] evaluated from 1 to e</p>
                                  </div>
                                  <div className="h-[1px] bg-white/[0.03] my-2" />
                                  <div>
                                    <span className="text-indigo-400 font-bold">Limit Expansion B:</span>
                                    <p className="pl-4 text-slate-220 font-black mt-0.5 select-all">lim [x → 3] (x² - 9) / (x - 3) = lim [x → 3] (x + 3) = 6</p>
                                  </div>
                                </div>
                              </div>

                              {/* Hologram visual indicator element */}
                              <div className="flex justify-between items-center text-[8.5px] text-slate-500 pt-1">
                                <span>Preview Resolution status: 150 DPI</span>
                                <span className="text-emerald-400 font-black flex items-center gap-1 select-none">
                                  ● PARSING COMPLETE
                                </span>
                              </div>

                              {/* Highlight box mockup annotations */}
                              <div className="absolute bottom-1 right-2 animate-pulse pr-2 pb-0.5">
                                <span className="text-[8.5px] text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-sans italic">
                                  AI Focus Triggered
                                </span>
                              </div>
                            </div>

                          </div>

                          {/* Options control */}
                          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                            <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                              Advisor Ingestion Strategy
                            </span>
                            
                            <select
                              value={helpMode}
                              onChange={(e) => setHelpMode(e.target.value as any)}
                              className="w-full p-2.5 bg-slate-950 border border-slate-850 text-slate-220 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
                            >
                              <option value="step-by-step">Detailed Step-by-Step Proof</option>
                              <option value="conceptual">Analogous Intuitive Explanations only</option>
                              <option value="calculator">Mathematical Formula Breakdown matrix</option>
                            </select>
                          </div>

                        </div>
                      </div>

                    </div>
                  )}

                  {/* STICKY COMMENCE AI SUBMISSION FLOATER AT THE BOTTOM */}
                  <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950 via-[#050812] to-[#050812]/0 flex justify-center z-20 shrink-0 select-none">
                    <div className="w-full max-w-sm">
                      <button
                        type="button"
                        onClick={executeAISpinner}
                        className="w-full py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-450 hover:to-indigo-550 border border-indigo-455/40 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl hover:shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer text-center outline-none flex items-center justify-center gap-2"
                        id="start-ai-analysis-btn"
                      >
                        <Play className="w-3.5 h-3.5 text-white fill-white shrink-0" />
                        <span>Commence AI Stream Operation</span>
                      </button>
                    </div>
                  </div>

                </div>
              )
            )}

              {/* 2. PROGRESS ANALYSIS LOADER */}
              {workflowState === "analyzing" && (
                <div className="flex-1 bg-[#050811] flex flex-col justify-center items-center px-6 text-center select-none font-sans relative">
                  
                  {/* Glowing backdrops */}
                  <div className="absolute top-1/3 w-52 h-52 bg-indigo-505/10 rounded-full filter blur-[60px] animate-pulse" />

                  <div className="space-y-6 max-w-xs relative z-10 flex flex-col items-center">
                    
                    {/* Spinners */}
                    <div className="relative">
                      <div className="w-22 h-22 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin flex items-center justify-center">
                        <Brain className="w-9 h-9 text-indigo-400 animate-pulse" />
                      </div>
                      
                      {/* Percent badge */}
                      <span className="absolute -bottom-1 -right-1 text-[8.5px] font-mono font-black text-indigo-100 bg-slate-950 border border-indigo-505/30 px-1.5 py-0.5 rounded-full">
                        {analysisProgress}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-xs font-mono font-black text-indigo-300 uppercase tracking-widest">
                        Performing Parameter Analysis
                      </h3>
                      <p className="text-xs text-slate-350 min-h-[32px] font-sans leading-relaxed">
                        {analysisStageText}
                      </p>
                    </div>

                    {/* Console Logger box mockup */}
                    <div className="w-full border border-white/[0.04] rounded-2xl p-4 bg-slate-950/80 font-mono text-[9.5px] text-slate-500 text-left space-y-1.5 max-w-[270px]">
                      <div className="flex justify-between">
                        <span>NODE_ID:</span>
                        <span className="text-indigo-400 font-bold">GEMINI-FLASH-STUDY-COPILOT</span>
                      </div>
                      <div className="flex justify-between">
                        <span>LATENCY:</span>
                        <span className="text-[#10b981] font-bold">38ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ACTIVE MODEL:</span>
                        <span className="text-[#eab308] font-bold">FLASH-EXP-v2_1</span>
                      </div>
                      <div className="h-[1px] bg-white/[0.04] my-1.5" />
                      <div className="flex items-center gap-1.5 font-sans">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400 shrink-0" />
                        <span className="text-indigo-300">Syncing guidelines...</span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 3. CONVENIENT SEAMLESS RETURN STATUS SUCCESS PAGE */}
              {workflowState === "success" && (
                <div className="flex-1 bg-[#050811] flex flex-col justify-center items-center px-6 text-center select-none font-sans relative animate-fade-in">
                  
                  {/* Soft green glow */}
                  <div className="absolute top-1/4 w-56 h-56 bg-emerald-500/5 rounded-full filter blur-[80px] pointer-events-none" />

                  <motion.div 
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-6 max-w-xs flex flex-col items-center"
                  >
                    <div className="w-18 h-18 rounded-full bg-emerald-500/15 border border-emerald-505/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                      <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-mono font-black text-slate-100 uppercase tracking-widest text-[#10b981]">
                        AI Processing Complete
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans">
                        Dynamic revision preview processed and logged to workspace. Redirecting back to dashboard...
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-emerald-405 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-505/15 uppercase">
                      READY_RETURN_OK
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
