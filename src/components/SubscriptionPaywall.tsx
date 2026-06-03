/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Lock, 
  ShieldCheck, 
  CreditCard, 
  ChevronRight, 
  Check, 
  Loader2, 
  Sparkles, 
  HelpCircle,
  Calendar,
  Clock,
  CheckCircle,
  Award,
  BookOpen
} from 'lucide-react';
import GlassCard from './GlassCard';
import { db, getSafeDocId } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// Helper to load Paystack Inline SDK dynamically on demand
const loadPaystack = (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).PaystackPop) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack checkout portal. Please check your internet connection.'));
    document.body.appendChild(script);
  });
};

interface SubscriptionPaywallProps {
  user: { email: string; matricNumber: string; name: string; createdAt?: string };
  subStatus: 'loading' | 'active' | 'inactive';
  isCourseRep: boolean;
  subscriptionDetails: any;
  onSuccessVerification: () => void;
}

export default function SubscriptionPaywall({ 
  user, 
  subStatus, 
  isCourseRep, 
  subscriptionDetails, 
  onSuccessVerification 
}: SubscriptionPaywallProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Countdown clock state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  // Countdown effect loop
  useEffect(() => {
    if (!subscriptionDetails?.expiryDate || isCourseRep || subStatus !== 'active') {
      setTimeLeft(null);
      return;
    }

    const calculateTime = () => {
      const now = new Date().getTime();
      const expiry = new Date(subscriptionDetails.expiryDate).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [subscriptionDetails?.expiryDate, isCourseRep, subStatus]);

  const verifyPaymentOnServer = async (ref: string) => {
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('Verifying payment secure token...');

    try {
      const verifyRes = await fetch('/api/paystack-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference: ref })
      });

      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        const now = new Date();
        let expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // 30-day billing pass

        if (user.createdAt) {
          const regTime = new Date(user.createdAt).getTime();
          const trialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days (1 week)
          const trialEndTime = regTime + trialDuration;
          if (now.getTime() < trialEndTime) {
            // Subscription starts from after the 7-day trial ends
            expiryDate = new Date(trialEndTime + 30 * 24 * 60 * 60 * 1000);
          }
        }

        const subData = {
          status: 'active',
          matricNumber: user.matricNumber,
          email: user.email || `${user.matricNumber.replace(/\//g, '_')}@ich100l.edu`,
          name: user.name,
          lastPaymentDate: new Date().toISOString(),
          expiryDate: expiryDate.toISOString(),
          reference: ref,
          amountPaid: 200,
        };

        // Write directly to firebase subscriptions collection
        await setDoc(doc(db, 'subscriptions', getSafeDocId(user.matricNumber)), subData);

        // Add payment transaction record to the payments collection for audit logs
        await setDoc(doc(db, 'payments', ref), {
          reference: ref,
          matricNumber: user.matricNumber,
          email: user.email || `${user.matricNumber.replace(/\//g, '_')}@ich100l.edu`,
          name: user.name,
          amount: 200,
          paidAt: new Date().toISOString(),
          status: 'success'
        });

        // Update local cache
        localStorage.setItem(`ich100l_sub_${user.matricNumber}`, JSON.stringify({
          status: 'active',
          expiryDate: expiryDate.toISOString(),
          lastPaymentDate: subData.lastPaymentDate,
          reference: subData.reference
        }));

        setSuccessMessage('Payment verified successfully! Account upgraded live. ⚡');
        setTimeout(() => {
          onSuccessVerification();
        }, 1500);
      } else {
        setErrorMessage(verifyData.message || 'Payment verification failed on server.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Verify error: ', err);
      setErrorMessage('Verification failed. Please contact your Course Rep if money was deducted.');
      setIsProcessing(false);
    }
  };

  const handlePaystackPayment = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsProcessing(true);

    try {
      // 1. Ensure the Paystack SDK script tag is injected and available
      await loadPaystack();

      // 2. Fetch the correct Public API Key
      const publicKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY || "";
      if (!publicKey) {
        setErrorMessage("Payment portal is unavailable as VITE_PAYSTACK_PUBLIC_KEY is not defined.");
        setIsProcessing(false);
        return;
      }
      const reference = `sub-${user.matricNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
      const email = user.email || `${user.matricNumber.replace(/\//g, '_')}@ich100l.edu`;

      let hasOpenedPopup = false;

      // Try modern Paystack constructor (works smoothly, mobile friendly, handles verification on complete)
      try {
        if ((window as any).PaystackPop) {
          const paystack = new (window as any).PaystackPop();
          paystack.newTransaction({
            key: publicKey,
            email: email,
            amount: 200 * 100, // ₦200 in kobo
            currency: 'NGN',
            ref: reference,
            metadata: {
              custom_fields: [
                {
                  display_name: "Student Name",
                  variable_name: "student_name",
                  value: user.name
                },
                {
                  display_name: "Matriculation Number",
                  variable_name: "matric_number",
                  value: user.matricNumber
                }
              ]
            },
            onSuccess: (transaction: any) => {
              const trRef = transaction.reference || reference;
              verifyPaymentOnServer(trRef);
            },
            onCancel: () => {
              setIsProcessing(false);
              setErrorMessage('Payment process cancelled.');
            }
          });
          hasOpenedPopup = true;
          // Keep isProcessing representing handoff to Paystack POP
          setIsProcessing(false);
        }
      } catch (err) {
        console.warn("PaystackPop constructor syntax failed, trying setup: ", err);
      }

      if (!hasOpenedPopup) {
        // Fallback to legacy setup handler
        const handler = (window as any).PaystackPop.setup({
          key: publicKey,
          email: email,
          amount: 200 * 100,
          currency: 'NGN',
          ref: reference,
          callback: function (response: any) {
            verifyPaymentOnServer(response.reference || reference);
          },
          onClose: () => {
            setIsProcessing(false);
            setErrorMessage('Payment process cancelled.');
          }
        });
        handler.openIframe();
        setIsProcessing(false);
      }

    } catch (err: any) {
      console.error('Initialize Paystack portal error: ', err);
      setErrorMessage(err.message || 'Could not launch secure payment handler. Please check your internet connection.');
      setIsProcessing(false);
    }
  };

  // Switch structure if standard page view for pre-existing subscription
  if (subStatus === 'active' || isCourseRep) {
    return (
      <div className="py-2 animate-fadeIn space-y-4">
        {/* Active Premium Subscription Details Page */}
        <GlassCard className="relative overflow-hidden border border-slate-800 p-6 text-center">
          {/* Ambient high-tech background glow */}
          <div className="absolute left-1/2 -top-12 -translate-x-1/2 w-48 h-48 rounded-full bg-indigo-500/10 blur-[50px] pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Crown or check circle */}
            <div className="mb-5 flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              {isCourseRep ? (
                <Award className="w-6 h-6 text-amber-400" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              )}
            </div>

            <h2 className="text-xl font-display font-extrabold text-slate-100 tracking-tight leading-none mb-1">
              {isCourseRep ? 'Executive Exemption Logged' : 'Access Passport Active'}
            </h2>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">
              {isCourseRep ? 'Lifetime Admin Account' : 'Student Billing Verified'}
            </p>

            {/* Countdown Clock Display logic */}
            {timeLeft && (
              <div className="w-full mt-6">
                <p className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  ⏳ Access countdown time remaining:
                </p>
                
                <div className="grid grid-cols-4 gap-2 px-1 max-w-sm mx-auto">
                  <div className="bg-slate-950/70 border border-slate-900 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-lg font-display font-extrabold text-indigo-400 tabular-nums">{timeLeft.days}</span>
                    <span className="text-[8px] uppercase font-mono text-slate-500 tracking-wider">Days</span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-lg font-display font-extrabold text-indigo-400 tabular-nums">{timeLeft.hours}</span>
                    <span className="text-[8px] uppercase font-mono text-slate-500 tracking-wider">Hrs</span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-lg font-display font-extrabold text-indigo-400 tabular-nums">{timeLeft.minutes}</span>
                    <span className="text-[8px] uppercase font-mono text-slate-500 tracking-wider">Mins</span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-900 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-lg font-display font-extrabold text-[#f43f5e] tabular-nums animate-pulse">{timeLeft.seconds}</span>
                    <span className="text-[8px] uppercase font-mono text-slate-500 tracking-wider">Secs</span>
                  </div>
                </div>

                {timeLeft.isExpired && (
                  <div className="mt-3 text-xs font-semibold text-rose-400 bg-rose-500/15 p-2 rounded-xl border border-rose-500/20">
                    Expiry term reached. Extended access requested below.
                  </div>
                )}
              </div>
            )}

            {isCourseRep && (
              <div className="w-full mt-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-200/90 leading-relaxed font-sans max-w-sm mx-auto">
                ⭐ <strong>Exempt Admin Status:</strong> You are the registered Course Representative (Matric: 2025/ps/ich/0034). Standard monthly subscription charges are waived permanently on this account.
              </div>
            )}

            {/* Audit Logs / details collection */}
            {!isCourseRep && (
              <div className="w-full my-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-900 text-left space-y-2.5 max-w-sm mx-auto text-xs">
                <h4 className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider mb-1">
                  Subscription Dossier / Logs:
                </h4>
                
                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-400">Class Resource Pass:</span>
                  <span className="text-slate-200 font-semibold">Active Pack</span>
                </div>
                
                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-400">Monthly Contribution:</span>
                  <span className="text-slate-200 font-mono">₦200.00 NGN</span>
                </div>

                {subscriptionDetails?.lastPaymentDate && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">Last Charged:</span>
                    <span className="font-mono text-slate-300">
                      {new Date(subscriptionDetails.lastPaymentDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}

                {subscriptionDetails?.expiryDate && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">Expiry Threshold:</span>
                    <span className="font-mono text-slate-300">
                      {new Date(subscriptionDetails.expiryDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}

                {subscriptionDetails?.reference && (
                  <div className="flex flex-col gap-0.5 pt-1">
                    <span className="text-slate-400">Audit Transaction Ref:</span>
                    <span className="font-mono text-[9px] text-[#818cf8] break-all">{subscriptionDetails.reference}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notifications and feedback block */}
            {errorMessage && (
              <div className="w-full mb-4.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs text-left">
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="w-full mb-4.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs text-left">
                <span>{successMessage}</span>
              </div>
            )}

            {/* Action tool to extend / top-up subscription */}
            {!isCourseRep && (
              <button
                onClick={handlePaystackPayment}
                disabled={isProcessing}
                type="button"
                className="w-full py-3 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 max-w-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing extension...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Extend Subscription Pass (₦200)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  // Fallback: Inactive Paywall View
  return (
    <div className="py-2 animate-fadeIn space-y-4">
      {/* Visual Paywall Card */}
      <GlassCard className="relative overflow-hidden border border-slate-800 p-6 text-center">
        {/* Glow backdrop decorative layout element */}
        <div className="absolute left-1/2 -top-12 -translate-x-1/2 w-48 h-48 rounded-full bg-indigo-500/10 blur-[50px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Animated Lock Circle */}
          <div className="mb-5 flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>

          <h2 className="text-xl font-display font-extrabold text-slate-100 tracking-tight leading-none mb-1">
            Access Restrained
          </h2>
          <p className="text-xs text-slate-400 font-mono">CHEMISTRY RESOURCES BOARD PASSWORD LOCK</p>

          <div className="my-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-900 text-left space-y-3.5 max-w-sm mx-auto">
            <h4 className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider">Included in Month Pass:</h4>
            
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <div className="p-0.5 rounded bg-indigo-500/15 text-indigo-400 shrink-0 mt-0.5">
                <Check className="w-3 h-3" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Interactive Weekly Schedule</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Full access to dynamic lectures, practical laboratory slots, coordinates, and team tuts.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <div className="p-0.5 rounded bg-indigo-500/15 text-indigo-400 shrink-0 mt-0.5">
                <Check className="w-3 h-3" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Assignments & Worksheets</p>
                <p className="text-[10px] text-slate-400 mt-0.5">View and download all uploaded salt checklists, practical manuals, and photo sheets.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <div className="p-0.5 rounded bg-indigo-500/15 text-indigo-400 shrink-0 mt-0.5">
                <Check className="w-3 h-3" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Urgent Board Broadcasts</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Get notified instantly about rescheduling, exam rooms, or test announcements.</p>
              </div>
            </div>
          </div>

          {/* Premium Pricing Tier Row */}
          <div className="mb-6 flex flex-col items-center">
            <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              Monthly Syllabus Subscription
            </span>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-4xl font-display font-black text-slate-100">₦200</span>
              <span className="text-slate-400 text-xs font-semibold font-sans">/ month</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[280px]">
              Charged monthly to help manage file allocations, host reference sheets, and operate real-time broadcast servers. Only Course Reps are exempt.
            </p>
          </div>

          {/* Feedback logs */}
          {errorMessage && (
            <div className="w-full mb-4.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs text-left flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="w-full mb-4.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs text-left flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Checkout triggers */}
          <div className="w-full space-y-2.5">
            <button
              onClick={handlePaystackPayment}
              disabled={isProcessing}
              type="button"
              className="w-full py-3.5 bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-xs font-bold transition-all shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_24px_rgba(99,102,241,0.45)] cursor-pointer outline-none flex items-center justify-center gap-2 active:scale-95 disabled:scale-100 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing secure checkout...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay ₦200.00 secure via Paystack</span>
                  <ChevronRight className="w-4 h-4 text-indigo-200" />
                </>
              )}
            </button>
          </div>

          <p className="text-[9px] text-slate-500 mt-3 font-mono">
            🛡️ Secured by Paystack. Card, Bank Transfer, USSD available.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
