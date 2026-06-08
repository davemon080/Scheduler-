import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Users, 
  ChevronDown, 
  BellRing,
  Volume2,
  VolumeX,
  AlertTriangle
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  setDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  query, 
  limit, 
  orderBy 
} from 'firebase/firestore';
import { getSafeDocId } from '../lib/firebase';

interface AnonymousChatOverlayProps {
  db: any;
  currentUser: any;
  subStatus: string;
  isCourseRep: boolean;
  chatConfig: {
    enabled: boolean;
    visibility: 'paid' | 'all';
  };
}

const ANIMALS = [
  "Cheetah", "Jaguar", "Leopard", "Panther", "Tiger", "Lion", "Fox", "Wolf",
  "Hawk", "Eagle", "Falcon", "Owl", "Panda", "Koala", "Otter", "Badger",
  "Dolphin", "Orca", "Seal", "Penguin", "Phoenix", "Dragon", "Griffin"
];

const ADJECTIVES = [
  "Silent", "Swift", "Mystic", "Clever", "Sly", "Bold", "Gentle", "Fierce",
  "Golden", "Cosmic", "Wild", "Calm", "Shadow", "Bright", "Sharp", "Agile"
];

const ALIAS_COLORS = [
  "text-red-400", "text-orange-400", "text-amber-400", "text-emerald-400",
  "text-teal-400", "text-cyan-400", "text-sky-400", "text-indigo-400",
  "text-violet-400", "text-fuchsia-400", "text-pink-400", "text-rose-400"
];

const BALLOON_GRADIENTS = [
  "bg-indigo-650/30 border-indigo-500/25 text-white shadow-[0_4px_12px_rgba(99,102,241,0.1)]",
  "bg-violet-650/30 border-violet-500/25 text-white shadow-[0_4px_12px_rgba(139,92,246,0.1)]",
  "bg-emerald-650/30 border-emerald-500/25 text-white shadow-[0_4px_12px_rgba(16,185,129,0.1)]",
  "bg-cyan-650/30 border-cyan-500/25 text-white shadow-[0_4px_12px_rgba(6,182,212,0.1)]",
  "bg-purple-650/30 border-purple-500/25 text-white shadow-[0_4px_12px_rgba(168,85,247,0.1)]",
  "bg-pink-650/30 border-pink-500/25 text-white shadow-[0_4px_12px_rgba(236,72,153,0.1)]"
];

const ALIAS_BG_GLOWS = [
  "bg-red-500/10 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.15)]",
  "bg-orange-500/10 border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]",
  "bg-amber-500/10 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]",
  "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
  "bg-teal-500/10 border-teal-500/20 shadow-[0_0_8px_rgba(20,184,166,0.15)]",
  "bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]",
  "bg-sky-500/10 border-sky-500/20 shadow-[0_0_8px_rgba(14,165,233,0.15)]",
  "bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.15)]",
  "bg-violet-500/10 border-violet-500/20 shadow-[0_0_8px_rgba(139,92,246,0.15)]",
  "bg-fuchsia-500/10 border-fuchsia-500/20 shadow-[0_0_8px_rgba(217,70,239,0.15)]",
  "bg-pink-500/10 border-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.15)]",
  "bg-rose-500/10 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.15)]"
];

const memoryStorage: Record<string, string> = {};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      memoryStorage[key] = value;
    }
  }
};

// Helper to determine deterministic alias based on student matriculation identifier
export function getOrGenerateAlias(matricNumber: string) {
  if (!matricNumber) return { name: "Anonymous Student", color: "text-indigo-400", bgGlow: ALIAS_BG_GLOWS[7], gradient: BALLOON_GRADIENTS[0] };
  
  const savedKey = `ich100l_anon_alias_${matricNumber}`;
  const stored = safeLocalStorage.getItem(savedKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }
  
  // Deterministic identifier hash generator
  let hash = 0;
  for (let i = 0; i < matricNumber.length; i++) {
    hash = matricNumber.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  const adjIndex = hash % ADJECTIVES.length;
  const animIndex = (hash >> 3) % ANIMALS.length;
  const colorIndex = (hash >> 5) % ALIAS_COLORS.length;
  const balloonIndex = (hash >> 2) % BALLOON_GRADIENTS.length;
  
  const aliasData = {
    name: `${ADJECTIVES[adjIndex]} ${ANIMALS[animIndex]}`,
    color: ALIAS_COLORS[colorIndex],
    bgGlow: ALIAS_BG_GLOWS[colorIndex],
    gradient: BALLOON_GRADIENTS[balloonIndex]
  };
  
  safeLocalStorage.setItem(savedKey, JSON.stringify(aliasData));
  return aliasData;
}

// Low-overhead synthesizer dual chord sound notifier
export const playNotificationSound = () => {
  const soundPref = safeLocalStorage.getItem('ich100l_chat_sound_enabled') !== 'false';
  if (!soundPref) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Smooth dual tone Whatsapp style chirp notification sound chord E5 -> A5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn('[Audio] Dual chirp synth audio failure:', err);
  }
};

export default function AnonymousChatOverlay({
  db,
  currentUser,
  subStatus,
  isCourseRep,
  chatConfig
}: AnonymousChatOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeViewersCount, setActiveViewersCount] = useState(1);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => safeLocalStorage.getItem('ich100l_chat_sound_enabled') !== 'false');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPaidAccess = subStatus === 'active' || isCourseRep;
  const isEligible = chatConfig.enabled && (chatConfig.visibility === 'all' || isPaidAccess);

  // Load and subscribe to real-time chat messages
  useEffect(() => {
    if (!db || !isEligible) return;

    const qMessages = query(
      collection(db, 'anonymous_chat_messages'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(qMessages, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id });
      });
      // Sort chronologically client side
      list.sort((a, b) => {
        const timeA = a.timestamp ? Date.parse(a.timestamp) : 0;
        const timeB = b.timestamp ? Date.parse(b.timestamp) : 0;
        return timeA - timeB;
      });

      setMessages(list);
    }, (err) => {
      console.warn('[Chat] Messages fetch failure:', err);
    });

    return () => unsub();
  }, [db, isEligible]);

  const lastMsgCountRef = useRef(0);

  // Monitor incoming real-time messages safely to trigger notification sound/badge
  useEffect(() => {
    if (!isEligible) return;
    
    if (messages.length > lastMsgCountRef.current) {
      if (lastMsgCountRef.current > 0) {
        playNotificationSound();
        if (!isOpen) {
          setUnviewedCount((c) => c + 1);
        }
      }
    }
    lastMsgCountRef.current = messages.length;
  }, [messages, isOpen, isEligible]);

  // Keep track of unread count and reset once opened
  useEffect(() => {
    if (isOpen) {
      setUnviewedCount(0);
      safeLocalStorage.setItem('ich100l_last_viewed_chat_timestamp', new Date().toISOString());
      
      // Auto scroll to latest on load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [isOpen]);

  // Submit active presence viewer heartbeat inside Firestore
  useEffect(() => {
    if (!db || !currentUser?.matricNumber || !isEligible) return;

    const docReference = doc(db, 'anonymous_chat_viewers', getSafeDocId(currentUser.matricNumber));
    const writeHeartbeat = async () => {
      try {
        await setDoc(docReference, {
          id: currentUser.matricNumber,
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.warn('[Heartbeat] Connection check issue:', err);
      }
    };

    writeHeartbeat();
    const timer = setInterval(writeHeartbeat, 12000); // 12 seconds loop heartbeat

    return () => {
      clearInterval(timer);
      try {
        deleteDoc(docReference);
      } catch (e) {}
    };
  }, [db, currentUser, isEligible]);

  // Count active viewers inside the online pool
  useEffect(() => {
    if (!db || !isEligible) return;

    const unsubViewers = onSnapshot(collection(db, 'anonymous_chat_viewers'), (snap) => {
      const now = Date.now();
      let activeCount = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.lastActive) {
          const diff = now - Date.parse(data.lastActive);
          if (!isNaN(diff) && diff < 30000) { // Considered active if heartbeat within last 30 seconds
            activeCount++;
          }
        }
      });
      setActiveViewersCount(activeCount || 1);
    }, (err) => {
      console.warn('[Chat] Fetch active viewers count issue:', err);
    });

    return () => unsubViewers();
  }, [db, isEligible]);

  // Scroll downwards when new messages arrive and panel is open
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isEligible) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !db) return;

    setIsSending(true);
    const sendingText = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'anonymous_chat_messages'), {
        content: sendingText,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Chat] Publish message database failure:', err);
    } finally {
      setIsSending(false);
    }
  };

  const toggleSound = () => {
    const nextSound = !soundEnabled;
    setSoundEnabled(nextSound);
    safeLocalStorage.setItem('ich100l_chat_sound_enabled', String(nextSound));
  };

  // Deterministic classy soft gradient choices for our bold cards
  const getCardStyle = (index: number) => {
    const glassPresets = [
      "bg-white/[0.04] hover:bg-white/[0.06] border-white/10 shadow-[0_8px_32px_0_rgba(255,255,255,0.02)]",
      "bg-indigo-500/[0.04] hover:bg-indigo-500/[0.06] border-indigo-500/20 shadow-[0_8px_32px_0_rgba(99,102,241,0.05)]",
      "bg-violet-500/[0.04] hover:bg-violet-500/[0.06] border-violet-500/20 shadow-[0_8px_32px_0_rgba(139,92,246,0.05)]",
      "bg-cyan-500/[0.03] hover:bg-cyan-500/[0.05] border-cyan-500/20 shadow-[0_8px_32px_0_rgba(6,182,212,0.05)]",
      "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.05] border-emerald-500/20 shadow-[0_8px_32px_0_rgba(16,185,129,0.04)]",
      "bg-fuchsia-500/[0.03] hover:bg-fuchsia-500/[0.05] border-fuchsia-500/20 shadow-[0_8px_32px_0_rgba(217,70,239,0.04)]"
    ];
    return glassPresets[index % glassPresets.length];
  };

  return (
    <>
      {/* Floating Trigger Button on Every Page */}
      <div 
        id="anonymous-chat-floating-trigger"
        className="fixed bottom-24 left-5 z-40"
      >
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-full bg-slate-950/90 hover:bg-slate-900 text-white flex flex-col items-center justify-center p-0 cursor-pointer outline-none shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_15px_rgba(99,102,241,0.15)] border border-slate-800 transition-all duration-300 hover:scale-105 active:scale-95 group relative"
        >
          {/* Animated active beacon ring */}
          <span className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping group-hover:block" />
          
          <MessageSquare className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />

          {/* New Message WhatsApp style badge */}
          {unviewedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-black text-[9px] font-sans h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.5)] border border-slate-950 animate-bounce">
              {unviewedCount}
            </span>
          )}

          {/* Active online viewers tag */}
          <span className="absolute -bottom-1 inset-x-0 mx-auto max-w-[26px] bg-indigo-500/20 backdrop-blur-md text-indigo-400 border border-indigo-500/30 text-[7.5px] font-mono leading-none rounded-full py-0.5 px-0.5 text-center flex items-center justify-center gap-0.5">
            <Users className="w-2 h-2 shrink-0 text-indigo-400" />
            <span>{activeViewersCount}</span>
          </span>
        </button>
      </div>

      {/* Full-Screen Glassmorphic Anonymous Board Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-slate-950/25 backdrop-blur-[12px] flex flex-col h-screen w-screen text-white relative overflow-hidden"
          >
            {/* Ambient Background Glow Decors */}
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-500/5 blur-[150px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />

            {/* Custom Interactive Tabs Display (No physical header) */}
            <div className="w-full max-w-7xl mx-auto px-6 pt-6 sm:px-8 shrink-0 flex items-center justify-between select-none relative z-10">
              
              {/* Section Brand Card */}
              <div className="p-1 px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-md flex items-center gap-2.5 transition-all">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                </span>
                <span className="text-sm font-black tracking-widest text-indigo-300 font-sans lowercase">anonymous</span>
              </div>

              {/* Stats & Controls Panel */}
              <div className="flex items-center gap-2">
                {/* Number of Active Users Card */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-md flex items-center gap-2 font-mono text-xs text-slate-350">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>{activeViewersCount} active minds</span>
                </div>

                {/* Sound Toggle */}
                <button
                  onClick={toggleSound}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-slate-400 hover:text-slate-200 rounded-2xl transition-all cursor-pointer outline-none backdrop-blur-md shadow-md"
                  title={soundEnabled ? "Mute New Thoughts" : "Unmute New Thoughts"}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-rose-455" />
                  )}
                </button>

                {/* Glass Close Dock */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white rounded-2xl transition-all cursor-pointer outline-none backdrop-blur-md shadow-md"
                  title="Close Anymous Lounge"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Dynamic Board Scroller (Masonry Card feel) */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-6 py-8 sm:px-8 max-w-7xl mx-auto w-full space-y-8 no-scrollbar relative z-10"
            >
              {messages.length === 0 ? (
                <div className="h-[60vh] flex flex-col justify-center items-center text-center p-6 space-y-4 select-none">
                  <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/10 text-slate-500 flex items-center justify-center shadow-lg">
                    <AlertTriangle className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-mono font-bold text-slate-300 tracking-wider">ANONYMOUS THOUGHT BOARD</h4>
                    <p className="text-xs text-slate-400 font-sans mt-2 max-w-sm leading-relaxed">
                      Express freely. Post chemistry questions, questions with total secrecy. No names, no profiling, absolute zero-knowledge privacy.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-stretch pb-10">
                  {messages.map((msg, index) => {
                    const msgDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
                    const displayTime = msgDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const dayLabel = msgDate.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
                        key={msg.id || index}
                        className={`p-5 rounded-2xl border flex flex-col justify-between group transition-all duration-300 backdrop-blur-md ${getCardStyle(index)}`}
                      >
                        {/* Display content dynamically as BOLD */}
                        <div className="text-sm sm:text-base font-bold font-sans tracking-wide leading-relaxed text-slate-100 break-words flex-1 mb-4 select-text">
                          {msg.content}
                        </div>

                        {/* Card metadata (just clean timestamp) */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1 text-[10px] font-mono text-slate-450 select-none">
                          <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full text-[9px] font-sans font-medium">
                            thought
                          </span>
                          <span>
                            {dayLabel}, {displayTime}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Float Fixed Glassy Bottom Input Bar */}
            <footer className="p-6 shrink-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent relative z-10">
              <div className="max-w-xl mx-auto w-full">
                <form 
                  onSubmit={handleSendMessage}
                  className="p-1.5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md flex items-center gap-2 pl-4 focus-within:border-indigo-500/50 transition-colors shadow-2xl"
                >
                  <input
                    type="text"
                    required
                    value={inputText}
                    disabled={isSending}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Post a thought anonymously..."
                    className="flex-1 bg-transparent text-xs sm:text-sm text-white border-none outline-none focus:ring-0 placeholder:text-slate-500 font-sans outline-0 py-2.5"
                  />
                  
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 cursor-pointer outline-none border-0 shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <p className="text-[10px] text-center text-slate-500 font-sans mt-3 tracking-wide">
                  🔒 Zero identifying keys saved. Be polite, share wisdom.
                </p>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
