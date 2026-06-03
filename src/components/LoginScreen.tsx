/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, KeyRound, User, Users, GraduationCap, ArrowRight, ShieldCheck, Info, Eye, EyeOff, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import GlassCard from './GlassCard';
import { DEFAULT_COURSE_REP_MATRIC } from '../data/defaultData';
import { db, getSafeDocId } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

const getUsersDB = () => {
  try {
    const db = localStorage.getItem('ich100l_users_db');
    if (db) return JSON.parse(db);
    // Seed with Course Rep password to 123456 as requested
    const defaultDB = {
      [DEFAULT_COURSE_REP_MATRIC]: {
        email: 'daveimagodei@gmail.com',
        matricNumber: DEFAULT_COURSE_REP_MATRIC,
        name: 'David Adebayo',
        password: '123456',
      },
      '2026/ps/ich/0034': {
        email: 'admin@gmail.com',
        matricNumber: '2026/ps/ich/0034',
        name: 'System Admin',
        password: '123456',
        isAdmin: true,
      }
    };
    localStorage.setItem('ich100l_users_db', JSON.stringify(defaultDB));
    return defaultDB;
  } catch {
    return {};
  }
};

const saveUserToDB = (user: any) => {
  try {
    const db = getUsersDB();
    db[user.matricNumber] = user;
    localStorage.setItem('ich100l_users_db', JSON.stringify(db));
  } catch (err) {
    console.error(err);
  }
};

interface LoginScreenProps {
  onLoginSuccess: (user: { 
    email: string; 
    matricNumber: string; 
    name: string; 
    createdAt?: string; 
    activeSessionId?: string;
    isAdmin?: boolean;
    isCourseRep?: boolean;
  }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check for reset password parameters on mount
  const [resetToken, setResetToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('reset_token') || '';
    } catch {
      return '';
    }
  });

  const [resetMatric, setResetMatric] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('reset_matric') || '';
    } catch {
      return '';
    }
  });

  // Active view management
  const [activeView, setActiveView] = useState<'login' | 'forgot' | 'reset'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset_token') && params.get('reset_matric')) {
        return 'reset';
      }
    } catch {}
    return 'login';
  });

  // Forgot password form states
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMatric, setForgotMatric] = useState('');
  
  // Reset password form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status indicators
  const [successMessage, setSuccessMessage] = useState('');
  const [simulatedLink, setSimulatedLink] = useState('');

  const validateMatric = (nm: string) => {
    return nm.trim();
  };

  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSimulatedLink('');
    setIsAuthenticating(true);

    if (!forgotEmail || !forgotMatric) {
      setError('Please provide both matriculation number and institutional email.');
      setIsAuthenticating(false);
      return;
    }

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          matricNumber: forgotMatric.trim()
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        setError(resData.error || 'Failed to request password reset.');
        setIsAuthenticating(false);
        return;
      }

      setSuccessMessage(resData.message);
      if (resData.simulated && resData.resetLink) {
        setSimulatedLink(resData.resetLink);
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred connecting to the security server.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsAuthenticating(true);

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      setIsAuthenticating(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setIsAuthenticating(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The passwords entered do not match.');
      setIsAuthenticating(false);
      return;
    }

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: resetToken,
          matricNumber: resetMatric,
          newPassword
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        setError(resData.error || 'Failed to reset password.');
        setIsAuthenticating(false);
        return;
      }

      setSuccessMessage('Password reset successfully! Redirecting you to login...');
      
      // Keep displaying success for 3 seconds, then navigate to login view and clear query params
      setTimeout(() => {
        try {
          // Clear query parameters from URL
          const url = new URL(window.location.href);
          url.searchParams.delete('reset_token');
          url.searchParams.delete('reset_matric');
          window.history.replaceState({}, document.title, url.pathname);
        } catch (urlErr) {
          console.warn('URL address cleanup avoided:', urlErr);
        }
        
        // Return to normal login
        setResetToken('');
        setResetMatric('');
        setActiveView('login');
        setSuccessMessage('');
        setError('');
        setPassword('');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError('Network error occurred during password reset.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);

    if (!email || !matricNumber || !password) {
      setError('Please fill in all requested credentials.');
      setIsAuthenticating(false);
      return;
    }

    const cleanedMatric = validateMatric(matricNumber);

    // Ensure we have a persistent local device/session ID to check concurrency
    let sessionId = localStorage.getItem('ich100l_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('ich100l_session_id', sessionId);
    }

    // Explicit Admin Sign-in Bypass / Initial Setup
    if (cleanedMatric.toLowerCase() === '2026/ps/ich/0034') {
      if (email.trim().toLowerCase() !== 'admin@gmail.com' || password !== '123456') {
        setError('Incorrect email or password for admin access.');
        setIsAuthenticating(false);
        return;
      }

      const adminUser = {
        email: 'admin@gmail.com',
        matricNumber: '2026/ps/ich/0034',
        name: 'System Admin',
        password: '123456',
        createdAt: new Date().toISOString(),
        activeSessionId: sessionId,
        isAdmin: true,
      };

      try {
        await setDoc(doc(db, 'users', getSafeDocId(cleanedMatric)), adminUser, { merge: true });
      } catch (errSync) {
        console.warn('[Session] Silent background admin document setup missed:', errSync);
      }

      saveUserToDB(adminUser);
      onLoginSuccess(adminUser);
      setIsAuthenticating(false);
      return;
    }

    try {
      // 1. Check online Firestore DB by testing lowercase, uppercase, and original formats
      const safeIdLower = getSafeDocId(cleanedMatric.toLowerCase());
      const safeIdUpper = getSafeDocId(cleanedMatric.toUpperCase());
      const safeIdOriginal = getSafeDocId(cleanedMatric);

      let docSnap = await getDoc(doc(db, 'users', safeIdLower));
      if (!docSnap.exists() && safeIdUpper !== safeIdLower) {
        docSnap = await getDoc(doc(db, 'users', safeIdUpper));
      }
      if (!docSnap.exists() && safeIdOriginal !== safeIdLower && safeIdOriginal !== safeIdUpper) {
        docSnap = await getDoc(doc(db, 'users', safeIdOriginal));
      }

      let userData: any = null;
      let matchedRef: any = null;

      if (docSnap.exists()) {
        userData = docSnap.data();
        matchedRef = docSnap.ref;
      } else {
        // Double-check: scan with stripping to accept any capitalization or format
        try {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          const inputNormalize = cleanedMatric.toLowerCase().replace(/[\/-]/g, '').trim();
          const found = allUsersSnap.docs.find(d => {
            const m = d.data().matricNumber || d.id || '';
            const dbNormalize = m.toLowerCase().replace(/[\/-]/g, '').trim();
            return dbNormalize === inputNormalize || m.toLowerCase().trim() === cleanedMatric.toLowerCase().trim();
          });
          if (found) {
            userData = found.data();
            matchedRef = found.ref;
          }
        } catch (err) {
          console.warn('Fallback querying all users failed:', err);
        }
      }

      if (userData && matchedRef) {
        if (userData.password !== password) {
          setError('Incorrect password for this matriculation number.');
          setIsAuthenticating(false);
          return;
        }

        // Overwrite the online session ID so only this active device is authenticated
        await setDoc(matchedRef, { activeSessionId: sessionId }, { merge: true });

        const finalUser = {
          email: userData.email,
          matricNumber: userData.matricNumber || cleanedMatric,
          name: userData.name,
          createdAt: userData.createdAt,
          activeSessionId: sessionId,
          isAdmin: userData.isAdmin || false,
          isCourseRep: userData.isCourseRep || false,
        };

        // Sync cache
        saveUserToDB(finalUser);
        onLoginSuccess(finalUser);
        setIsAuthenticating(false);
        return;
      }
    } catch (err) {
      console.warn('Fallback to LocalStorage cache due to error:', err);
    }

    // 2. Cache Fallback check
    const localDB = getUsersDB();
    const inputNormalizeLocal = cleanedMatric.toLowerCase().replace(/[\/-]/g, '').trim();
    const existingKey = Object.keys(localDB).find(k => {
      const keyNormalize = k.toLowerCase().replace(/[\/-]/g, '').trim();
      return keyNormalize === inputNormalizeLocal || k.toLowerCase().trim() === cleanedMatric.toLowerCase().trim();
    });
    const existingUser = existingKey ? localDB[existingKey] : null;

    if (existingUser) {
      if (existingUser.password !== password) {
        setError('Incorrect password for this matriculation number.');
        setIsAuthenticating(false);
        return;
      }

      const matchMatric = existingUser.matricNumber || existingKey || cleanedMatric;

      // Try syncing online session id in background even if login initially loaded offline
      try {
        const safeIdLower = getSafeDocId(matchMatric.toLowerCase());
        const safeIdUpper = getSafeDocId(matchMatric.toUpperCase());
        const safeIdOriginal = getSafeDocId(matchMatric);

        let docRef = doc(db, 'users', safeIdLower);
        let docSnap = await getDoc(docRef);
        if (!docSnap.exists() && safeIdUpper !== safeIdLower) {
          docRef = doc(db, 'users', safeIdUpper);
          docSnap = await getDoc(docRef);
        }
        if (!docSnap.exists() && safeIdOriginal !== safeIdLower && safeIdOriginal !== safeIdUpper) {
          docRef = doc(db, 'users', safeIdOriginal);
          docSnap = await getDoc(docRef);
        }

        await setDoc(docRef, { activeSessionId: sessionId }, { merge: true });
      } catch (errSync) {
        console.warn('[Session] Silent background session ID sync missed:', errSync);
      }

      onLoginSuccess({
        email: existingUser.email,
        matricNumber: existingUser.matricNumber || matchMatric,
        name: existingUser.name,
        createdAt: existingUser.createdAt,
        activeSessionId: sessionId,
        isAdmin: existingUser.isAdmin || false,
        isCourseRep: existingUser.isCourseRep || false,
      });
      setIsAuthenticating(false);
    } else {
      // Setup dynamic account if they use course rep matric representing fresh first login
      if (cleanedMatric.toLowerCase() === DEFAULT_COURSE_REP_MATRIC.toLowerCase()) {
        const defaultRep = {
          email: email.trim() || 'daveimagodei@gmail.com',
          matricNumber: DEFAULT_COURSE_REP_MATRIC,
          name: 'David Adebayo',
          password: password,
          createdAt: new Date().toISOString(),
          activeSessionId: sessionId,
          isCourseRep: true,
        };
        try {
          await setDoc(doc(db, 'users', getSafeDocId(DEFAULT_COURSE_REP_MATRIC)), defaultRep);
        } catch (err) {
          console.error(err);
        }
        saveUserToDB(defaultRep);
        onLoginSuccess({
          email: defaultRep.email,
          matricNumber: defaultRep.matricNumber,
          name: defaultRep.name,
          createdAt: defaultRep.createdAt,
          activeSessionId: sessionId,
          isCourseRep: true,
        });
        setIsAuthenticating(false);
      } else {
        setError('Matric number is not registered on this system. Please contact the administrator to register your credentials.');
        setIsAuthenticating(false);
      }
    }
  };

  return (
    <div className="min-h-screen grid items-center justify-center p-4 bg-[#0f172a] relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-violet-500/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        {/* Brand Logo and Title */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative mb-3 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-[0_0_24px_rgba(99,102,241,0.4)]">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-violet-300 bg-clip-text text-transparent">
            ICH100L
          </h1>
          <p className="text-sm font-mono text-slate-400 mt-1">Chemistry Activities & Broadcasts Portal</p>
        </div>

        <GlassCard className="border border-slate-800/80 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display font-bold text-slate-100">
              {activeView === 'login' && 'Portal Access Sign-in'}
              {activeView === 'forgot' && 'Password Retrieval Hub'}
              {activeView === 'reset' && 'Formulate New Password'}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-405 font-bold font-sans">!</span>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-sans font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
              {simulatedLink && (
                <div className="mt-2 p-3 bg-slate-950/80 rounded-lg border border-slate-900">
                  <p className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-400" />
                    <span>AI Studio Dev/Preview Bypass:</span>
                  </p>
                  <p className="text-[10.5px] mt-1 text-slate-400 font-sans leading-relaxed">
                    No SMTP mail server is configured. You can reset your password immediately by clicking the simulated link below:
                  </p>
                  <a
                    href={simulatedLink}
                    className="block mt-2 font-mono text-center text-xs font-bold text-white bg-indigo-600/40 hover:bg-indigo-600/60 p-2 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all"
                  >
                    Reset Password Now &rarr;
                  </a>
                </div>
              )}
            </div>
          )}

          {/* VIEW 1: Standard Credentials Sign-in */}
          {activeView === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-sans">Institutional Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    disabled={isAuthenticating}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. student@ich100l.edu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-sans flex justify-between items-center">
                  <span>Matriculation Number</span>
                  <span className="text-[10px] font-mono text-slate-500">Format: YYYY/ps/ich/XXXX</span>
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={isAuthenticating}
                    value={matricNumber}
                    onChange={(e) => setMatricNumber(e.target.value)}
                    placeholder="e.g. 2025/ps/ich/1000"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ">
                  <label className="block text-xs font-medium text-slate-300 font-sans">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setSuccessMessage('');
                      setSimulatedLink('');
                      setForgotEmail('');
                      setForgotMatric('');
                      setActiveView('forgot');
                    }}
                    className="text-xs font-sans text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none cursor-pointer bg-transparent border-none p-0 inline-block outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isAuthenticating}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer disabled:opacity-50"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 mt-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50"
              >
                <span>{isAuthenticating ? 'Authenticating...' : 'Authenticate Credentials'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* VIEW 2: Forgot Password Recovery */}
          {activeView === 'forgot' && (
            <form onSubmit={handleRequestResetLink} className="space-y-4">
              <p className="text-xs font-sans text-slate-400 leading-relaxed mb-4">
                Please formulate your registration details. A secure, time-sensitive reset link will be sent to the university database register email.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-sans">Institutional Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    disabled={isAuthenticating}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. student@ich100l.edu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-sans">Matriculation Number</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={isAuthenticating}
                    value={forgotMatric}
                    onChange={(e) => setForgotMatric(e.target.value)}
                    placeholder="e.g. 2025/ps/ich/1000"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-805 text-slate-100 text-base font-mono placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isAuthenticating || !forgotEmail || !forgotMatric}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)] transition-all disabled:opacity-50"
                >
                  <span>{isAuthenticating ? 'Requesting link...' : 'Request Reset Link'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMessage('');
                    setSimulatedLink('');
                    setActiveView('login');
                  }}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Portal Access</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: Formulate/Reset Password */}
          {activeView === 'reset' && (
            <form onSubmit={handlePerformReset} className="space-y-4">
              <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 mb-4 font-sans">
                <p className="text-[11px] text-indigo-300 leading-relaxed font-sans">
                  Account Verified: Changing password for student matric <span className="font-mono text-white font-bold">{resetMatric}</span>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-sans">New Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    disabled={isAuthenticating}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    {showNewPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-sans">Confirm New Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    disabled={isAuthenticating}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Verify new password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isAuthenticating || !newPassword || !confirmPassword}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)] transition-all disabled:opacity-50"
                >
                  <span>{isAuthenticating ? 'Compiling system update...' : 'Update Secure Credentials'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMessage('');
                    setSimulatedLink('');
                    setResetToken('');
                    setResetMatric('');
                    setActiveView('login');
                  }}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cancel reset & return to sign-in</span>
                </button>
              </div>
            </form>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
