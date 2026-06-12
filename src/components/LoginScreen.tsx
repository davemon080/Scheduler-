/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, KeyRound, User, Users, GraduationCap, ArrowRight, ShieldCheck, Info, Eye, EyeOff, ArrowLeft, CheckCircle2, Sparkles, Fingerprint, Loader2 } from 'lucide-react';
import GlassCard from './GlassCard';
import { DEFAULT_COURSE_REP_MATRIC } from '../data/defaultData';
import { db, getSafeDocId } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

const getUsersDB = () => {
  try {
    const db = localStorage.getItem('ich100l_users_db');
    let parsed = db ? JSON.parse(db) : null;
    if (!parsed) {
      parsed = {
        [DEFAULT_COURSE_REP_MATRIC]: {
          email: 'daveimagodei@gmail.com',
          matricNumber: DEFAULT_COURSE_REP_MATRIC,
          name: 'David Adebayo',
          password: '123456',
          isCourseRep: true,
        },
        '2026/ps/ich/0034': {
          email: 'admin@gmail.com',
          matricNumber: '2026/ps/ich/0034',
          name: 'System Admin',
          password: 'eroll@12',
          isAdmin: true,
        }
      };
    } else {
      // Force admin password to be updated as requested
      if (parsed['2026/ps/ich/0034']) {
        parsed['2026/ps/ich/0034'].password = 'eroll@12';
      } else {
        parsed['2026/ps/ich/0034'] = {
          email: 'admin@gmail.com',
          matricNumber: '2026/ps/ich/0034',
          name: 'System Admin',
          password: 'eroll@12',
          isAdmin: true,
        };
      }
      // Force default course rep to have isCourseRep: true if not already set
      if (parsed[DEFAULT_COURSE_REP_MATRIC] && parsed[DEFAULT_COURSE_REP_MATRIC].isCourseRep === undefined) {
        parsed[DEFAULT_COURSE_REP_MATRIC].isCourseRep = true;
      }
    }
    localStorage.setItem('ich100l_users_db', JSON.stringify(parsed));
    return parsed;
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

  // Biometric sign-in states
  const [enrolledBiometric, setEnrolledBiometric] = useState<any>(null);
  const [isVerifyingBiometric, setIsVerifyingBiometric] = useState(false);
  const [bioProgress, setBioProgress] = useState(0);
  const [bioError, setBioError] = useState('');
  const [bioSuccess, setBioSuccess] = useState(false);
  const [showBioVerification, setShowBioVerification] = useState(false);

  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ich100l_biometric_reg');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.enabled) {
          setEnrolledBiometric(parsed);
          // Auto-trigger biometric sign-in block on first load
          if (!hasAutoTriggered) {
            setHasAutoTriggered(true);
            setTimeout(() => {
              handleBiometricSignIn();
            }, 600);
          }
        }
      }
    } catch (e) {
      console.warn('[Biometric] Failed to read enrollment status:', e);
    }
  }, [hasAutoTriggered]);

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

  const handleBiometricSignIn = async (forceMatch: 'match' | 'mismatch' | 'none' = 'none') => {
    if (!enrolledBiometric) return;
    
    setBioError('');
    setBioSuccess(false);
    setShowBioVerification(true);

    // If native Auth is enrolled and we are checking physical device keys directly (no simulation controls clicked yet)
    if (enrolledBiometric.nativeAuth && window.PublicKeyCredential && forceMatch === 'none') {
      setIsVerifyingBiometric(true);
      setBioProgress(35);
      try {
        console.log('[Biometric] Prompting client-side secure WebAuthn gesture...');
        const challenge = new Uint8Array(16);
        window.crypto.getRandomValues(challenge);

        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: 'required',
            timeout: 15000
          }
        });

        if (!assertion) {
          throw new Error('Biometric user verification returned empty credential assertion.');
        }

        // Native hardware authorization succeeded!
        setBioProgress(100);
        setBioSuccess(true);
        setIsVerifyingBiometric(false);
        
        // Log user in
        const dbUsers = getUsersDB();
        const userMatric = enrolledBiometric.matricNumber;
        const normalizedQuery = userMatric.toLowerCase().replace(/[\/-]/g, '').trim();
        const matchedKey = Object.keys(dbUsers).find(k => k.toLowerCase().replace(/[\/-]/g, '').trim() === normalizedQuery);
        const targetUser = matchedKey ? dbUsers[matchedKey] : null;
        if (!targetUser) throw new Error('Biometric account record details missing on this device.');

        let sessionId = localStorage.getItem('ich100l_session_id') || 'sess_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('ich100l_session_id', sessionId);
        const verifiedUser = {
          email: targetUser.email,
          matricNumber: targetUser.matricNumber || matchedKey || userMatric,
          name: targetUser.name,
          createdAt: targetUser.createdAt,
          activeSessionId: sessionId,
          isAdmin: !!targetUser.isAdmin,
          isCourseRep: !!targetUser.isCourseRep,
        };

        setTimeout(async () => {
          setShowBioVerification(false);
          try {
            await setDoc(doc(db, 'users', getSafeDocId(verifiedUser.matricNumber.toLowerCase())), { activeSessionId: sessionId }, { merge: true });
          } catch {}
          onLoginSuccess(verifiedUser);
        }, 1100);
        return;
      } catch (assertionErr: any) {
        console.warn('[Biometric] Physical biometric validation failed:', assertionErr);
        // CRITICAL SECURE DISCIPLINE: STRICTLY Block access if hardware verification fails!
        setBioProgress(100);
        setBioError('Secure Authorization Failed: Biometric verification was cancelled or fingerprint did not match.');
        setBioSuccess(false);
        setIsVerifyingBiometric(false);
        return;
      }
    }

    // Otherwise, handle manual simulator choices or showcase
    if (forceMatch === 'none') {
      // Keep it in idle ready state with 0 progress so the user is prompted to tap a simulate button
      setIsVerifyingBiometric(false);
      setBioProgress(0);
      return;
    }

    // If simulating Match or Mismatch:
    setIsVerifyingBiometric(true);
    setBioProgress(0);
    
    // Simulate animated scanning cycles
    const progressSteps = [15, 38, 62, 85, 100];
    for (const step of progressSteps) {
      await new Promise(r => setTimeout(r, 150));
      setBioProgress(step);
    }
    
    if (forceMatch === 'mismatch') {
      // STRICT BLOCK: Simulated Mismatch blocks the user immediately and does NOT log them in!
      setBioProgress(100);
      setBioError('Cryptographic Mismatch Failure: Touch sensor scanner detected unmatched fingerprint signature keys.');
      setBioSuccess(false);
      setIsVerifyingBiometric(false);
      return;
    }

    // Successful match simulation!
    try {
      const dbUsers = getUsersDB();
      const userMatric = enrolledBiometric.matricNumber;
      
      const normalizedQuery = userMatric.toLowerCase().replace(/[\/-]/g, '').trim();
      const matchedKey = Object.keys(dbUsers).find(k => {
        const normKey = k.toLowerCase().replace(/[\/-]/g, '').trim();
        return normKey === normalizedQuery || k.toLowerCase().trim() === userMatric.toLowerCase().trim();
      });
      
      const targetUser = matchedKey ? dbUsers[matchedKey] : null;

      if (!targetUser) {
        throw new Error('Associated student biometric record has been deleted or expired on this device.');
      }

      setBioSuccess(true);
      
      // Ensure we have a persistent local device/session ID to check concurrency
      let sessionId = localStorage.getItem('ich100l_session_id');
      if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        localStorage.setItem('ich100l_session_id', sessionId);
      }

      const verifiedUser = {
        email: targetUser.email,
        matricNumber: targetUser.matricNumber || matchedKey || userMatric,
        name: targetUser.name,
        createdAt: targetUser.createdAt,
        activeSessionId: sessionId,
        isAdmin: targetUser.isAdmin || false,
        isCourseRep: targetUser.isCourseRep || false,
      };

      setTimeout(async () => {
        setShowBioVerification(false);
        try {
          const safeIdLower = getSafeDocId(verifiedUser.matricNumber.toLowerCase());
          await setDoc(doc(db, 'users', safeIdLower), { activeSessionId: sessionId }, { merge: true });
        } catch (e) {
          console.warn('[Session] Background biometrics session sync bypassed:', e);
        }
        onLoginSuccess(verifiedUser);
      }, 1000);

    } catch (err: any) {
      setBioError(err?.message || 'Biometric authentication failed.');
      setBioSuccess(false);
    } finally {
      setIsVerifyingBiometric(false);
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
      if (email.trim().toLowerCase() !== 'admin@gmail.com' || password !== 'eroll@12') {
        setError('Incorrect email or password for admin access.');
        setIsAuthenticating(false);
        return;
      }

      const adminUser = {
        email: 'admin@gmail.com',
        matricNumber: '2026/ps/ich/0034',
        name: 'System Admin',
        password: 'eroll@12',
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

    // 1. FAST-PATH: Instant Cache Verification (for users logging in again on same browser)
    const localDB = getUsersDB();
    const inputNormalizeLocal = cleanedMatric.toLowerCase().replace(/[\/-]/g, '').trim();
    const existingKey = Object.keys(localDB).find(k => {
      const keyNormalize = k.toLowerCase().replace(/[\/-]/g, '').trim();
      return keyNormalize === inputNormalizeLocal || k.toLowerCase().trim() === cleanedMatric.toLowerCase().trim();
    });
    const existingUser = existingKey ? localDB[existingKey] : null;

    if (existingUser && existingUser.password === password) {
      if (existingUser.email && existingUser.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        setError('The provided email does not match the registered institutional email for this matriculation number.');
        setIsAuthenticating(false);
        return;
      }

      const matchMatric = existingUser.matricNumber || existingKey || cleanedMatric;
      const finalUser = {
        email: existingUser.email,
        matricNumber: matchMatric,
        name: existingUser.name,
        createdAt: existingUser.createdAt,
        activeSessionId: sessionId,
        isAdmin: existingUser.isAdmin || false,
        isCourseRep: existingUser.isCourseRep || false,
      };

      // Complete login instantly with cache!
      saveUserToDB(finalUser);
      onLoginSuccess(finalUser);
      setIsAuthenticating(false);

      // Silently sync session ID online in the background without blocking the user
      (async () => {
        try {
          const safeIdLower = getSafeDocId(matchMatric.toLowerCase());
          await setDoc(doc(db, 'users', safeIdLower), { activeSessionId: sessionId }, { merge: true });
        } catch (e) {
          console.warn('[Session] Background silent session ID sync bypassed:', e);
        }
      })();
      return;
    }

    // 2. SLOW-PATH: Online Firestore lookup (First login or cache missing)
    try {
      // Check online Firestore DB by testing lowercase, uppercase, and original formats IN PARALLEL
      const safeIdLower = getSafeDocId(cleanedMatric.toLowerCase());
      const safeIdUpper = getSafeDocId(cleanedMatric.toUpperCase());
      const safeIdOriginal = getSafeDocId(cleanedMatric);

      const [snapLower, snapUpper, snapOriginal] = await Promise.all([
        getDoc(doc(db, 'users', safeIdLower)),
        safeIdUpper !== safeIdLower ? getDoc(doc(db, 'users', safeIdUpper)) : Promise.resolve(null),
        (safeIdOriginal !== safeIdLower && safeIdOriginal !== safeIdUpper) ? getDoc(doc(db, 'users', safeIdOriginal)) : Promise.resolve(null),
      ]);

      let docSnap = snapLower.exists() ? snapLower : (snapUpper && snapUpper.exists() ? snapUpper : (snapOriginal && snapOriginal.exists() ? snapOriginal : null));

      let userData: any = null;
      let matchedRef: any = null;

      if (docSnap) {
        userData = docSnap.data();
        matchedRef = docSnap.ref;
      } else {
        // Double-check fallback: scan with stripping (only if direct lookups fail)
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
        if (userData.email && userData.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
          setError('The provided email does not match the registered institutional email for this matriculation number.');
          setIsAuthenticating(false);
          return;
        }

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

        // Sync cache and complete login
        saveUserToDB(finalUser);
        onLoginSuccess(finalUser);
        setIsAuthenticating(false);
        return;
      }
    } catch (err) {
      console.warn('Online Firestore call failed, checking cache:', err);
    }

    // 3. Setup dynamic account if they use course rep matric representing fresh first login
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
            Scheduler
          </h1>
          <p className="text-sm font-mono text-slate-400 mt-1">Activities & Forecast Scheduler Portal</p>
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
            <div className="space-y-4">
              {enrolledBiometric && (
                <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 flex flex-col items-center text-center space-y-3.5 animate-fade-in">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400 relative">
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-md scale-95" />
                    <Fingerprint className="w-6 h-6 animate-pulse relative z-10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-400 font-sans">Enrolled Biometric Account</p>
                    <p className="text-sm font-sans font-extrabold text-slate-100">{enrolledBiometric.name}</p>
                    <p className="text-[10px] font-mono text-slate-500 tracking-wider uppercase font-semibold">
                      {enrolledBiometric.matricNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBiometricSignIn}
                    disabled={isAuthenticating || isVerifyingBiometric}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_16px_rgba(99,102,241,0.25)] border-none outline-none"
                  >
                    <Fingerprint className="w-4 h-4 shrink-0" />
                    <span>One-Tap Biometric Unlock</span>
                  </button>
                  <div className="flex items-center gap-2.5 w-full">
                    <div className="h-px bg-slate-900 flex-1" />
                    <span className="text-[10px] text-slate-500 font-sans tracking-wide">OR SIGN-IN WITH CREDENTIALS</span>
                    <div className="h-px bg-slate-900 flex-1" />
                  </div>
                </div>
              )}

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
                    placeholder="e.g. student@scheduler.edu"
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
          </div>
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
                    placeholder="e.g. student@scheduler.edu"
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

      {/* Premium Biometric Verification Dialog Overlay */}
      {showBioVerification && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in text-center">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl relative space-y-6 overflow-hidden">
            {isVerifyingBiometric && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />
            )}

            <div className="space-y-2">
              <h4 className="text-base font-sans font-bold text-slate-100">Biometric Verification</h4>
              <p className="text-xs text-slate-400 px-2 leading-relaxed">
                Unlock Chemistry 100L scheduler secure database via device Touch ID / Face ID sensor.
              </p>
            </div>

            {/* Glowing biometric reader visualizer */}
            <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
              {/* Outer glowing pulsing circles */}
              <div className={`absolute inset-0 rounded-full border-2 border-indigo-500/20 transition-all duration-1000 ${
                isVerifyingBiometric ? 'scale-110 opacity-100 animate-ping' : 'scale-100 opacity-40'
              }`} />
              
              <div className={`absolute inset-4 rounded-full border border-indigo-500/30 bg-indigo-950/20 flex items-center justify-center transition-all ${
                bioSuccess ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_24px_rgba(16,185,129,0.35)]' : ''
              }`}>
                {bioSuccess ? (
                  <ShieldCheck className="w-12 h-12 text-emerald-400 animate-scale-up" />
                ) : (
                  <Fingerprint className={`w-14 h-14 transition-colors duration-300 ${
                    isVerifyingBiometric ? 'text-indigo-400 animate-pulse' : 'text-slate-400'
                  }`} />
                )}
              </div>

              {/* Progress Sweep Light Circle */}
              {isVerifyingBiometric && (
                <svg className="absolute inset-0 -rotate-90 w-32 h-32 pointer-events-none">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="4"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    fill="transparent"
                    stroke="#6366f1"
                    strokeWidth="4"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * bioProgress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-150 ease-out"
                  />
                </svg>
              )}
            </div>

            <div className="space-y-4">
              {/* Progress/Success Status */}
              {isVerifyingBiometric ? (
                <div className="space-y-1 animate-fade-in">
                  <div className="text-sm font-mono text-indigo-400 font-bold">{bioProgress}%</div>
                  <div className="text-[11px] font-sans text-indigo-300">Reading biometric secure key matrix...</div>
                </div>
              ) : bioSuccess ? (
                <div className="space-y-1 text-emerald-400 animate-scale-up">
                  <div className="text-sm font-sans font-bold">Identity Verified!</div>
                  <div className="text-[11px] opacity-80">Granting secure credentials access portal...</div>
                </div>
              ) : bioError ? (
                <div className="space-y-1.5">
                  <div className="text-rose-400 text-xs font-sans p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/15 text-left leading-relaxed">
                    {bioError}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-sans">Ready to scan fingerprint...</div>
              )}

              {/* Secure interactive testing options for the simulator */}
              {!isVerifyingBiometric && !bioSuccess && (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-900 space-y-2.5 text-center animate-fade-in">
                  <p className="text-[10px] text-slate-500 font-mono font-bold tracking-wider uppercase">Simulator Terminal</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleBiometricSignIn('match')}
                      className="py-2.5 px-3 rounded-lg text-xs font-bold bg-emerald-950/50 hover:bg-emerald-900/40 text-emerald-400 hover:text-emerald-300 border border-emerald-500/15 hover:border-emerald-500/30 transition-all cursor-pointer outline-none"
                    >
                      👍 Match Finger
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBiometricSignIn('mismatch')}
                      className="py-2.5 px-3 rounded-lg text-xs font-bold bg-rose-950/50 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 border border-rose-500/15 hover:border-rose-500/30 transition-all cursor-pointer outline-none"
                    >
                      ❌ Mismatch Finger
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-1">
                {bioError && !isVerifyingBiometric && (
                  <button
                    type="button"
                    onClick={() => handleBiometricSignIn('none')}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer border-none outline-none font-sans"
                  >
                    🔄 Retry Scan Attempt
                  </button>
                )}

                {!bioSuccess && (
                  <button
                    type="button"
                    onClick={() => setShowBioVerification(false)}
                    className="w-full py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-755 text-slate-300 transition-colors cursor-pointer border-none outline-none"
                  >
                    Cancel & Use Password
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
