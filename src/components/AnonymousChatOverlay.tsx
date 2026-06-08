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

// Helper to determine deterministic alias based on student matriculation identifier
export function getOrGenerateAlias(matricNumber: string) {
  if (!matricNumber) return { name: "Anonymous Student", color: "text-indigo-400", bgGlow: ALIAS_BG_GLOWS[7], gradient: BALLOON_GRADIENTS[0] };
  
  const savedKey = `ich100l_anon_alias_${matricNumber}`;
  const stored = localStorage.getItem(savedKey);
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
  
  localStorage.setItem(savedKey, JSON.stringify(aliasData));
  return aliasData;
}

// Low-overhead synthesizer dual chord sound notifier
export const playNotificationSound = () => {
  const soundPref = localStorage.getItem('ich100l_chat_sound_enabled') !== 'false';
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
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('ich100l_chat_sound_enabled') !== 'false');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPaidAccess = subStatus === 'active' || isCourseRep;
  const isEligible = chatConfig.enabled && (chatConfig.visibility === 'all' || isPaidAccess);

  const localAlias = getOrGenerateAlias(currentUser?.matricNumber || 'GUEST');

  // Load and subscribe to real-time chat messages
  useEffect(() => {
    if (!db || !isEligible) return;

    const qMessages = query(collection(db, 'anonymous_chat_messages'), limit(80));
    const unsub = onSnapshot(qMessages, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id });
      });
      // Sort chronologically client side
      list.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

      // Trigger notification audio and update unread count if eligible
      setMessages((prev) => {
        if (prev.length > 0 && list.length > prev.length) {
          const lastMsg = list[list.length - 1];
          // If message is from someone else, chime
          if (lastMsg.alias !== localAlias.name) {
            playNotificationSound();
            
            // Increment unviewed if currently closed
            if (!isOpen) {
              setUnviewedCount((c) => c + 1);
            }
          }
        }
        return list;
      });
    }, (err) => {
      console.warn('[Chat] Messages fetch failure:', err);
    });

    return () => unsub();
  }, [db, isEligible, localAlias.name, isOpen]);

  // Keep track of unread count and reset once opened
  useEffect(() => {
    if (isOpen) {
      setUnviewedCount(0);
      localStorage.setItem('ich100l_last_viewed_chat_timestamp', new Date().toISOString());
      
      // Auto scroll to latest on load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [isOpen]);

  // Submit active presence viewer heartbeat inside Firestore
  useEffect(() => {
    if (!db || !currentUser?.matricNumber || !isEligible) return;

    const docReference = doc(db, 'anonymous_chat_viewers', currentUser.matricNumber);
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
        timestamp: new Date().toISOString(),
        alias: localAlias.name,
        color: localAlias.color
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
    localStorage.setItem('ich100l_chat_sound_enabled', String(nextSound));
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

      {/* Full-Screen Glassmorphic Anonymous Chat Room Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-[#020617]/90 backdrop-blur-xl flex justify-center items-stretch"
          >
            {/* Ambient Background Glow Decors */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full mx-auto flex flex-col h-full bg-[#030712]/40 relative border-x border-slate-950/80">
              
              {/* Header Panel */}
              <header className="p-4 bg-slate-950/60 backdrop-blur-md border-b border-slate-900/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.1)]">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-205">Anonymous Lounge</h2>
                    <div className="flex items-center gap-1.5 mt-0.5 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-slate-400 font-medium">
                        {activeViewersCount === 1 ? '1 student active' : `${activeViewersCount} live students reading`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* WhatsApp style unread notifier bar indicator */}
                  {unviewedCount > 0 && (
                    <span className="text-[8px] font-mono uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold px-2 py-1 rounded">
                      New
                    </span>
                  )}
                  
                  {/* Sound Notifier toggle button */}
                  <button
                    onClick={toggleSound}
                    className="p-2 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition-all cursor-pointer outline-none"
                    title={soundEnabled ? "Mute New Messages" : "Unmute New Messages"}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    )}
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition-all cursor-pointer outline-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* Chat Sub-Notice Banner */}
              <div className="bg-indigo-500/5 border-b border-indigo-500/10 p-2 px-4 flex items-center gap-2 select-none">
                <AlertTriangle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <p className="text-[9.5px] text-slate-400 font-sans leading-normal text-left">
                  Your stable handle is <strong className={`${localAlias.color} font-mono font-bold`}>{localAlias.name}</strong>. Real student matrices and emails are strictly hidden. Stay civil!
                </p>
              </div>

              {/* Messages Body */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-3.5 select-none">
                    <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-850/80 text-slate-600 flex items-center justify-center animate-pulse">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-black text-slate-350 tracking-wider">SECURE ROOM LIVE</h4>
                      <p className="text-[10px] text-slate-500 font-sans mt-1 max-w-[240px] leading-relaxed">
                        Nothing matches your screen identity. Drop a friendly message or ask a chemistry homework query on the fly.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center select-none pt-1">
                      <span className="bg-slate-900/60 border border-slate-850/80 text-[8px] font-mono text-slate-500 uppercase tracking-widest px-3 py-1 rounded">
                        🔒 CHAT ENCRYPTED & ANONYMIZED
                      </span>
                    </div>

                    {messages.map((msg, index) => {
                      const isOwner = msg.alias === localAlias.name;
                      const msgDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
                      
                      const displayTime = msgDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      // Deterministic selection of bubble styles
                      const msgAliasInfo = getOrGenerateAlias(msg.alias);
                      const balloonStyle = isOwner 
                        ? 'bg-indigo-600/20 border-indigo-500/30 text-white rounded-br-none ml-auto' 
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-100 rounded-bl-none';

                      return (
                        <div 
                          key={msg.id || index}
                          className={`flex flex-col max-w-[82%] ${isOwner ? 'items-end ml-auto' : 'items-start'}`}
                        >
                          {/* Sender alias header */}
                          {!isOwner && (
                            <span className={`text-[9px] font-mono font-black mb-1 px-1.5 py-0.5 rounded ${msgAliasInfo.bgGlow} ${msgAliasInfo.color}`}>
                              {msg.alias}
                            </span>
                          )}

                          {/* Message Balloon */}
                          <div className={`p-3 rounded-2xl border text-left leading-relaxed text-xs shadow-md transition-all duration-300 font-sans break-words w-full ${balloonStyle}`}>
                            <span>{msg.content}</span>
                            
                            {/* Balloon Timestamp */}
                            <p className="text-[8px] font-mono text-slate-500 mt-1 select-none text-right leading-none">
                              {displayTime}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Float Fixed Glassy Bottom Input Bar */}
              <footer className="p-4 shrink-0 bg-gradient-to-t from-slate-950 via-[#030712]/50 to-transparent">
                <form 
                  onSubmit={handleSendMessage}
                  className="glassmorphism p-1 rounded-full border border-slate-800/80 bg-slate-950/40 backdrop-blur-md flex items-center gap-2 pl-4 focus-within:border-indigo-500/60 transition-colors shadow-lg"
                >
                  <input
                    type="text"
                    required
                    value={inputText}
                    disabled={isSending}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ask anonymously..."
                    className="flex-1 bg-transparent text-xs text-white border-none outline-none focus:ring-0 placeholder:text-slate-600 font-sans outline-0 py-2"
                  />
                  
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 cursor-pointer outline-none border-0"
                  >
                    <Send className="w-3.5 h-3.5 mr-0.5" />
                  </button>
                </form>
              </footer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
