/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, 
  LogOut, 
  CheckCircle2, 
  Award, 
  Calendar, 
  RefreshCcw, 
  Bell, 
  BellOff, 
  Lock, 
  BookMarked, 
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  CreditCard,
  Sparkles,
  HelpCircle,
  Smartphone,
  Share,
  MessageSquare,
  MessageCircle
} from 'lucide-react';
import GlassCard from './GlassCard';
import { DEFAULT_COURSE_REP_MATRIC } from '../data/defaultData';
import { db, getSafeDocId } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// Helper to load Paystack Inline SDK dynamically on demand
const loadPaystackInProfile = (): Promise<void> => {
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

const getInitials = (nm: string) => {
  if (!nm) return 'ST';
  const parts = nm.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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

const urlBase64ToUint8Array = (base64String: string) => {
  // Deep clean base64 string to handle any strange JSON formatting, extra quotes, whitespaces, or line breaks
  const cleanBase64String = base64String
    .trim()
    .replace(/["']/g, '') // strip potential quotes from JSON responses
    .replace(/\s/g, '')   // strip any whitespaces or line breaks
    .replace(/=/g, '');   // strip existing padding characters to recalculate they are correct

  const padding = '='.repeat((4 - cleanBase64String.length % 4) % 4);
  const base64 = (cleanBase64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  // Strictly enforce 65 bytes for uncompressed VAPID public keys to prevent browser-specific parsing errors
  if (outputArray.length > 65 && outputArray[0] === 0x04) {
    console.log('[WebPush Debug] Truncating public key to exactly 65 bytes for strict browser compatibility.');
    return outputArray.slice(0, 65);
  }

  return outputArray;
};

interface ProfileViewProps {
  user: { email: string; matricNumber: string; name: string; createdAt?: string };
  onLogout: () => void;
  onResetData: () => void;
  stats: {
    totalActivities: number;
    pendingDeadlines: number;
    completedDeadlines: number;
    announcementCount: number;
  };
  subStatus: 'loading' | 'active' | 'inactive';
  subscriptionDetails: any;
  onUpdateSubStatus: () => void;
  onChangeTab: (tab: any) => void;
  deferredPrompt?: any;
  onClearDeferredPrompt?: () => void;
}

export default function ProfileView({ 
  user, 
  onLogout, 
  onResetData, 
  stats,
  subStatus,
  subscriptionDetails,
  onUpdateSubStatus,
  onChangeTab,
  deferredPrompt,
  onClearDeferredPrompt
}: ProfileViewProps) {
  const isRep = user.matricNumber === DEFAULT_COURSE_REP_MATRIC;

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Paystack state within Profile View
  const [isPayingSub, setIsPayingSub] = useState(false);
  const [profileCheckoutUrl, setProfileCheckoutUrl] = useState('');
  const [subPayError, setSubPayError] = useState('');
  const [subPaySuccess, setSubPaySuccess] = useState('');

  // OTA Update States
  const [updateStep, setUpdateStep] = useState<'idle' | 'checking' | 'available' | 'updating' | 'success'>('available');
  const [updatePercent, setUpdatePercent] = useState(0);
  const [updateStatusText, setUpdateStatusText] = useState('New version available (v1.3.5)');

  // Notification capabilities checking & iOS alignment handler
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [isRegisteringPush, setIsRegisteringPush] = useState<boolean>(false);
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isPWA, setIsPWA] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [notificationToggleExpanded, setNotificationToggleExpanded] = useState<boolean>(false);

  useEffect(() => {
    // Detect iOS (including iPadOS simulating Macintosh desktop Safari)
    const userAgent = window.navigator.userAgent || window.navigator.vendor || (window as any).opera;
    const iOSDetected = (/iPad|iPhone|iPod/.test(userAgent) || (window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 2 && /Macintosh/.test(userAgent))) && !(window as any).MSStream;
    setIsIOS(iOSDetected);

    // Detect standalone PWA status
    const standalonePWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsPWA(standalonePWA);

    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
    } else {
      setPermissionStatus(Notification.permission);
    }

    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

    // Check active service worker push subscription
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsPushSubscribed(!!sub);
          // Auto-sync existing subscription to server so it is never lost or pruned by other logins/resets
          if (sub && user?.matricNumber) {
            fetch('/api/push-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: sub,
                matricNumber: user.matricNumber
              })
            }).catch((err) => {
              console.warn('[ProfileView] Auto-sync silent push setup failure:', err);
            });
          }
        }).catch((err) => {
          console.warn('[ProfileView] Could not fetch current push subscription status:', err);
        });
      }).catch((e) => {
        console.warn('[ProfileView] SW ready failed for sub check:', e);
      });
    }
  }, []);

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Your browser or platform does not support browser-level notifications. On iOS/iPhone, please add this app to your Home Screen first!');
      return;
    }

    setIsRegisteringPush(true);
    try {
      let result: NotificationPermission;
      try {
        result = await Notification.requestPermission();
      } catch (err) {
        console.log('[WebPush Debug] standard requestPermission Promise failed, executing legacy callback fallback...', err);
        result = await new Promise<NotificationPermission>((resolve) => {
          Notification.requestPermission(resolve);
        });
      }
      setPermissionStatus(result);
      
      if (result === 'granted') {
        const title = 'Alerts Active! 🔔';
        const options = {
          body: 'Popup alerts are now set up. You will receive notifications of new schedules, broadcasts, and module uploads from the Course Rep!',
          icon: '/logo-192.png',
          badge: '/logo-192.png'
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(async (reg) => {
              console.log('[WebPush Debug] Core Service Worker is ready for notification dispatch.');
              
              // Trigger showNotification by the serviceWorker instance explicitly for high-fidelity iOS PWA support
              try {
                await reg.showNotification(title, options);
                console.log('[WebPush Debug] Success: Triggered showNotification via Service Worker registration instance.');
              } catch (notifErr) {
                console.warn('[WebPush Debug] Direct SW registration showNotification failed:', notifErr);
                // Fallback to standard constructor
                try {
                  new Notification(title, options);
                } catch (constructorErr) {
                  console.error('[WebPush Debug] Standard constructor fallback failed too:', constructorErr);
                }
              }
              
              // Call background subscription setup
              try {
                const FALLBACK_VAPID_PUBLIC_KEY = 'BCSfqxfrAVW0QUx5UfxnoN_Dmqi6VASv24QkYUEv5-1F1WTmPCwBuyQWkJsqMYsUb5cNpcjuRHqDQ-fc_giWydw';
                let vapidPublicKey = FALLBACK_VAPID_PUBLIC_KEY;
                
                try {
                  console.log('[WebPush Debug] Fetching stable VAPID public key from backend...');
                  const keyRes = await fetch('/api/vapid-public-key');
                  if (keyRes.ok) {
                    const contentType = keyRes.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                      const keyData = await keyRes.json();
                      if (keyData?.publicKey) {
                        vapidPublicKey = keyData.publicKey;
                        console.log('[WebPush Debug] Successfully loaded public key from backend:', vapidPublicKey);
                      }
                    } else {
                      console.warn('[WebPush Debug] Non-JSON content returned from /api/vapid-public-key. Falling back to hardcoded VAPID public key.');
                    }
                  } else {
                    console.warn(`[WebPush Debug] Failed to fetch /api/vapid-public-key. Status: ${keyRes.status}. Falling back to hardcoded VAPID public key.`);
                  }
                } catch (fetchErr) {
                  console.warn('[WebPush Debug] Error during VAPID public key fetch. Falling back to hardcoded public key:', fetchErr);
                }

                console.log('[WebPush Debug] Parsing base64 VAPID Key into Uint8Array...');
                const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
                
                // Resilient check: always clear any old, stale, or key-mismatched registration in this browser first to avoid registration key clash exceptions
                try {
                  const existingSub = await reg.pushManager.getSubscription();
                  if (existingSub) {
                    console.log('[WebPush Debug] Clean state reset: unsubscribing existing client registration before registering new keys:', existingSub.endpoint);
                    await existingSub.unsubscribe();
                  }
                } catch (eSub) {
                  console.warn('[WebPush Debug] Warning clearing existing pre-subscription:', eSub);
                }

                console.log('[WebPush Debug] Registering a fresh PushManager subscription...');
                let sub;
                try {
                  sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                  });
                  console.log('[WebPush Debug] Subscription established with standard Uint8Array.');
                } catch (subErr: any) {
                  console.warn('[WebPush Debug] Standard Uint8Array subscription attempt failed, retrying with raw ArrayBuffer fallback for Safari:', subErr);
                  
                  if (applicationServerKey.buffer) {
                    try {
                      sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: applicationServerKey.buffer
                      });
                      console.log('[WebPush Debug] Subscription established with Safari-specific underlying raw ArrayBuffer.');
                    } catch (safariErrObj: any) {
                      console.error('[WebPush Debug] All subscription parameter typing formats failed:', safariErrObj);
                      throw safariErrObj;
                    }
                  } else {
                    throw subErr;
                  }
                }

                console.log('[WebPush Debug] Subscription established successfully! Raw endpoint:', sub.endpoint);
                
                const rawSubJSON = sub.toJSON();

                // Extremely robust key parsing fallback for some specific WebKit/Blink versions
                let p256dhVal = rawSubJSON.keys?.p256dh || '';
                let authVal = rawSubJSON.keys?.auth || '';

                if (!p256dhVal && typeof sub.getKey === 'function') {
                  try {
                    const p256dhBuffer = sub.getKey('p256dh');
                    if (p256dhBuffer) {
                      p256dhVal = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhBuffer))))
                        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    }
                  } catch (errKey) {
                    console.warn('[WebPush] getKey p256dh error:', errKey);
                  }
                }

                if (!authVal && typeof sub.getKey === 'function') {
                  try {
                    const authBuffer = sub.getKey('auth');
                    if (authBuffer) {
                      authVal = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authBuffer))))
                        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    }
                  } catch (errKey) {
                    console.warn('[WebPush] getKey auth error:', errKey);
                  }
                }

                const serializedSub = {
                  endpoint: sub.endpoint || rawSubJSON.endpoint,
                  expirationTime: sub.expirationTime || rawSubJSON.expirationTime || null,
                  keys: {
                    p256dh: p256dhVal,
                    auth: authVal
                  }
                };
                console.log('[WebPush Debug] Explicitly Serialized JSON:', JSON.stringify(serializedSub));

                // 1. Direct cloud sync to Firestore client-side first for extreme PWA reliability
                const endpointSuffix = (serializedSub.endpoint || '').slice(-50);
                const subDocId = getSafeDocId(`${user?.matricNumber || 'Guest'}_${endpointSuffix}`);
                
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                                     (navigator as any).standalone === true;
                const userAgent = navigator.userAgent || '';
                let platform = 'Web';
                const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 2 && /Macintosh/.test(userAgent));
                if (isIOSDevice) {
                  platform = 'iOS';
                } else if (/Android/.test(userAgent)) {
                  platform = 'Android';
                } else if (/Macintosh/.test(userAgent)) {
                  platform = 'macOS';
                } else if (/Windows/.test(userAgent)) {
                  platform = 'Windows';
                }

                console.log('[WebPush Debug] Writing subscription directly to Firestore:', subDocId);
                try {
                  await setDoc(doc(db, 'push-subscriptions', subDocId), {
                    subscription: serializedSub,
                    matricNumber: user?.matricNumber || 'Guest',
                    name: user?.name || 'Guest',
                    endpoint: serializedSub.endpoint,
                    isStandalone,
                    platform,
                    createdAt: new Date().toISOString()
                  });
                  console.log('[WebPush Debug] Direct Firestore write successful!');
                  setIsPushSubscribed(true);
                } catch (fireStoreErr) {
                  console.error('[WebPush Debug] Direct client-side Firestore subscription write failed:', fireStoreErr);
                }

                // 2. Secondary backend sync to keep API structures aligned
                try {
                  const registerRes = await fetch('/api/push-subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      subscription: serializedSub,
                      matricNumber: user?.matricNumber || 'Guest',
                      name: user?.name || 'Guest',
                      isStandalone,
                      platform
                    })
                  });
                  
                  if (registerRes.ok) {
                    const registerResult = await registerRes.json();
                    console.log('[WebPush Debug] Backend synchronized successfully. Response:', registerResult);
                  } else {
                    console.warn('[WebPush Debug] Backend subscription synchronization code run warning, status:', registerRes.status);
                  }
                } catch (apiErr) {
                  console.warn('[WebPush Debug] Secondary server API sync failed (relying primarily on direct Firestore subscription sync now):', apiErr);
                }
                
                setIsPushSubscribed(true);
                console.log('[WebPush Debug] iOS/Android push notification registration fully complete.');
              } catch (pushErr: any) {
                console.error('[WebPush Debug] Push registration process failed with error:', pushErr);
                alert(`Web Push Setup Error: ${pushErr.message || pushErr}. On iOS Safari, make sure to add this app to your Home Screen first!`);
              } finally {
                setIsRegisteringPush(false);
              }
            })
            .catch((err) => {
              console.warn('[WebPush Debug] Service worker was not ready:', err);
              try {
                new Notification(title, options);
              } catch (e) {
                console.error('[WebPush Debug] Standard constructor direct fallback failed:', e);
              }
              setIsRegisteringPush(false);
            });
        } else {
          try {
            new Notification(title, options);
          } catch (e) {
            console.error('Standard constructor failed:', e);
          }
          setIsRegisteringPush(false);
        }
      } else {
        alert('Notification permission was denied. Please allow notifications in your browser settings to receive alerts.');
        setIsRegisteringPush(false);
      }
    } catch (err) {
      console.error('Failed to request permission:', err);
      setIsRegisteringPush(false);
    }
  };

  const handleDisableNotifications = async () => {
    if ('serviceWorker' in navigator) {
      setIsRegisteringPush(true);
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // 1. Direct client-side Firestore unsubscribe
          const endpointSuffix = (sub.endpoint || '').slice(-50);
          const subDocId = getSafeDocId(`${user?.matricNumber || 'Guest'}_${endpointSuffix}`);
          try {
            await deleteDoc(doc(db, 'push-subscriptions', subDocId));
            console.log('[WebPush Debug] Deleted push subscription doc directly from Firestore on client:', subDocId);
          } catch (fireStoreErr) {
            console.warn('[WebPush Debug] Failed to delete push subscription doc from Firestore client-side:', fireStoreErr);
          }

          // 2. Secondary backend POST sync
          try {
            await fetch('/api/push-unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: sub,
                matricNumber: user?.matricNumber || 'Guest'
              })
            });
          } catch (backendErr) {
            console.warn('[WebPush] Silent backend unsubscribe request failed:', backendErr);
          }

          await sub.unsubscribe();
          setIsPushSubscribed(false);
          console.log('[WebPush] Unsubscribed active subscription.');
        } else {
          setIsPushSubscribed(false);
        }
        alert('Device alerts disabled successfully. You will no longer receive background popups unless you enable them again.');
      } catch (err) {
        console.error('[WebPush] Action to unsubscribe failed:', err);
      } finally {
        setIsRegisteringPush(false);
      }
    } else {
      setIsPushSubscribed(false);
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] Student accepted native Android install prompt.');
      } else {
        console.log('[PWA] Student dismissed native Android install prompt.');
      }
      if (onClearDeferredPrompt) {
        onClearDeferredPrompt();
      }
    } catch (err) {
      console.warn('[PWA] Native prompt execution failed:', err);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all security fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match confirmation.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    let isSuccess = false;
    let fallbackToLocal = false;

    try {
      // 1. Update online Firestore
      const docRef = doc(db, 'users', getSafeDocId(user.matricNumber));
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.password !== currentPassword) {
          setPasswordError('Current password entered is incorrect.');
          return;
        }

        userData.password = newPassword;
        await setDoc(docRef, userData);
        saveUserToDB(userData);
        isSuccess = true;
      } else {
        fallbackToLocal = true;
      }
    } catch (err) {
      console.warn('Online password update failed, checking offline cache:', err);
      fallbackToLocal = true;
    }

    if (fallbackToLocal) {
      const cacheDB = getUsersDB();
      const currentUserData = cacheDB[user.matricNumber];

      if (!currentUserData) {
        // Create user records if missing from DB caches
        const mockUserData = {
          email: user.email,
          name: user.name,
          matricNumber: user.matricNumber,
          password: newPassword
        };
        saveUserToDB(mockUserData);
        isSuccess = true;
      } else {
        if (currentUserData.password !== currentPassword) {
          setPasswordError('Current password entered is incorrect.');
          return;
        }
        currentUserData.password = newPassword;
        saveUserToDB(currentUserData);
        isSuccess = true;
      }
    }

    if (isSuccess) {
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess('');
      }, 2000);
    }
  };

  const verifySubOnServer = async (ref: string) => {
    setIsPayingSub(true);
    setSubPayError('');
    setSubPaySuccess('Verifying payment secure token...');

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
        expiryDate.setDate(expiryDate.getDate() + 30);

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

        // Record payment transaction in payments collection for audit logs
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

        setSubPaySuccess('Subscription updated successfully! Month pass extends for 30 days.');
        onUpdateSubStatus();
        setTimeout(() => {
          setIsPayingSub(false);
          setSubPaySuccess('');
        }, 2000);
      } else {
        setSubPayError(verifyData.message || 'Verification failed on server.');
        setIsPayingSub(false);
      }
    } catch (err: any) {
      console.error('Verify error: ', err);
      setSubPayError('Could not verify transaction with server.');
      setIsPayingSub(false);
    }
  };

  const paySubscriptionViaProfile = async () => {
    setSubPayError('');
    setSubPaySuccess('');
    setIsPayingSub(true);

    try {
      // 1. Load the Paystack JS file
      await loadPaystackInProfile();

      // 2. Fetch public key & variables
      const publicKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY || "";
      if (!publicKey) {
        setSubPayError("Payment portal is unavailable as VITE_PAYSTACK_PUBLIC_KEY is not defined.");
        setIsPayingSub(false);
        return;
      }
      const reference = `sub-${user.matricNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
      const email = user.email || `${user.matricNumber.replace(/\//g, '_')}@ich100l.edu`;

      let hasOpenedPopup = false;

      // Try modern Paystack constructor (excellent for modern browsers, responsive dialog)
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
              verifySubOnServer(trRef);
            },
            onCancel: () => {
              setIsPayingSub(false);
              setSubPayError('Payment process cancelled.');
            }
          });
          hasOpenedPopup = true;
          setIsPayingSub(false);
        }
      } catch (err) {
        console.warn("PaystackPop modern constructor failed in profile: ", err);
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
            verifySubOnServer(response.reference || reference);
          },
          onClose: () => {
            setIsPayingSub(false);
            setSubPayError('Payment process cancelled.');
          }
        });
        handler.openIframe();
        setIsPayingSub(false);
      }

    } catch (err: any) {
      console.error(err);
      setSubPayError(err.message || 'Can not trigger direct checkouts at this moment.');
      setIsPayingSub(false);
    }
  };

  const runOTAUpdate = () => {
    setUpdateStep('updating');
    setUpdatePercent(5);
    setUpdateStatusText('Connecting to Chemistry OTA Update Server...');

    let currentPct = 5;
    const interval = setInterval(() => {
      currentPct += Math.floor(Math.random() * 15) + 5;
      if (currentPct >= 100) {
        currentPct = 100;
        clearInterval(interval);
        setUpdatePercent(100);
        setUpdateStep('success');
        setUpdateStatusText('Update installed successfully! Restarting runtime...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setUpdatePercent(currentPct);
        if (currentPct < 25) {
          setUpdateStatusText('Downloading Android/iOS optimization package (2.4MB)...');
        } else if (currentPct < 55) {
          setUpdateStatusText('Clearing legacy local caches & mapping indexes...');
        } else if (currentPct < 85) {
          setUpdateStatusText('Registering dynamic Service Worker asset bundles...');
        } else {
          setUpdateStatusText('Verifying client build checksum signature...');
        }
      }
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Header element */}
      <div className="px-1">
        <h2 className="text-2xl font-display font-bold text-slate-100 tracking-tight">
          Student Dashboard
        </h2>
        <p className="text-xs text-slate-400 font-sans mt-0.5">
          Access your ICH100L student credentials and statistics
        </p>
      </div>

      {/* Main GlassCard representing profile details */}
      <GlassCard className="relative overflow-hidden border border-slate-800">
        {/* Glow backdrop behind profile badge */}
        <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[40px] ${
          isRep ? 'bg-amber-500/20' : 'bg-indigo-500/10'
        }`} />

        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left relative z-10">
          {/* Swapped visual initials avatar logo */}
          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-xl font-display font-black tracking-tighter shrink-0 border border-slate-700/50 shadow-lg ${
            isRep 
              ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)]' 
              : 'bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]'
          }`}>
            <span>{getInitials(user.name)}</span>
            <span className="text-[7px] uppercase font-mono tracking-widest font-extrabold opacity-80 -mt-0.5">
              {isRep ? 'REP' : 'STUD'}
            </span>
          </div>

          <div className="space-y-1.5 flex-1 p-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-xl font-display font-extrabold text-slate-100">{user.name}</h3>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                isRep 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' 
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                {isRep ? 'Course Rep 👑' : 'Regular Student'}
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono select-all">
              ID matric: <strong className="text-indigo-300">{user.matricNumber}</strong>
            </p>
            <p className="text-xs text-slate-400 font-sans">
              Email: <span className="text-slate-300 font-medium">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Rep badge description info */}
        {isRep && (
          <div className="mt-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed font-sans">
            🌟 <span className="font-semibold text-amber-300">ADMIN PRIVILEGE ENABLED:</span> You are authenticated as the Course Representative. You have special authorizations to create classes, set upcoming test deadlines, and broadcast course announcements.
          </div>
        )}
      </GlassCard>

      {/* Statistics board grid representation */}
      <div>
        <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3 px-1">
          Syllabus Metrics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="glassmorphism p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-xs font-sans">Total Classes</span>
            </div>
            <p className="text-2xl font-display font-bold text-slate-100">
              {stats.totalActivities}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">scheduled this week</p>
          </div>

          <div className="glassmorphism p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <BookMarked className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-sans">Active Tasks</span>
            </div>
            <p className="text-2xl font-display font-bold text-slate-100">
              {stats.pendingDeadlines}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {stats.completedDeadlines} task{stats.completedDeadlines === 1 ? '' : 's'} completed
            </p>
          </div>

          <div className="glassmorphism p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Bell className="w-4 h-4 text-pink-400 shrink-0" />
              <span className="text-xs font-sans">Announcements</span>
            </div>
            <p className="text-2xl font-display font-bold text-slate-100">
              {stats.announcementCount}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">faculty updates active</p>
          </div>

          <div className="glassmorphism p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-sans">Role Level</span>
            </div>
            <p className="text-sm font-display font-extrabold text-slate-100 select-none">
              {isRep ? 'Privileged' : 'Student Access'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {isRep ? 'Read/Write Level' : 'ReadOnly Access'}
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard interactive tools / action list */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider px-1">
          Settings & Preferences
        </h3>

        {/* PWA App Installer Banner / Advice */}
        {deferredPrompt ? (
          <div className="p-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/25 to-slate-900/40 space-y-3 shadow-[0_4px_24px_rgba(99,102,241,0.15)]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-550/20">
                <Smartphone className="w-5 h-5 text-indigo-400 shrink-0" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-sans font-semibold text-slate-100">Install Standalone Android Web App 📲</h4>
                <p className="text-xs text-slate-400 font-sans leading-normal">
                  Install Chemistry 100L directly to your phone's Home Screen for deep locked-screen push alerts, instant response times, and true offline capability.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleInstallApp}
                className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-slate-950 bg-white hover:bg-slate-100 transition-all font-sans cursor-pointer text-center border-none outline-none select-none shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
              >
                Install App Now
              </button>
              <button
                type="button"
                onClick={() => onClearDeferredPrompt?.()}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-900 transition-all font-sans cursor-pointer text-center border-none outline-none select-none"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          !isPWA && !isIOS && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/20 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-sans font-semibold text-slate-200">How to Install on Android Phone 📲</h4>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    If you haven't installed the app as a true standalone application yet, you can do so manually:
                  </p>
                  <ol className="list-decimal list-inside text-[11px] text-slate-400 font-sans space-y-1 mt-1.5 pl-0.5 leading-relaxed">
                    <li>Tap the standard <strong className="text-slate-200">three-dot menu</strong> icon in the top right of Chrome.</li>
                    <li>Select <strong className="text-emerald-400">Install app</strong> (or <strong className="text-emerald-400">Add to Home screen</strong>).</li>
                    <li>Confirm the install popup to have a high-performance app (not just a shortcut).</li>
                  </ol>
                </div>
              </div>
            </div>
          )
        )}

        {/* Device Popup Alerts Preferences Panel */}
        <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setNotificationToggleExpanded(!notificationToggleExpanded)}
            className="w-full p-4 hover:bg-slate-900/40 text-left flex items-center justify-between pointer-events-auto cursor-pointer outline-none group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-950 text-indigo-400 group-hover:text-indigo-300 transition-colors">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-slate-200">Device Popup Notifications</p>
                <p className="text-xs text-slate-500 font-sans">Toggle lockscreen notification alerts for assignments & announcements</p>
              </div>
            </div>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 group-hover:text-white px-2.5 py-1 rounded bg-slate-950 text-center transition-colors">
              {notificationToggleExpanded ? 'Hide' : 'Configure'}
            </span>
          </button>

          {notificationToggleExpanded && (
            <div className="p-4 border-t border-slate-900/60 bg-slate-950/20 space-y-4">
              {/* If user is on an iOS device and not running as PWA (e.g., standard Safari tab) */}
              {isIOS && !isPWA ? (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed font-sans flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-300">iPhone/iPad Notification Requirement 📲</p>
                      <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                        Apple iOS requires you to install or add websites to your Home Screen before it allows standard popup alerts. Follow these quick steps to get alerts:
                      </p>
                      <ol className="list-decimal list-inside mt-2 space-y-1 text-[11px] opacity-90 pl-1 font-sans">
                        <li>Tap the <span className="inline-flex items-center bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800"><Share className="w-3 h-3 text-slate-300 shrink-0 inline mr-1" /> Share</span> icon at the bottom or top of Safari.</li>
                        <li>Scroll down and select <strong className="text-white">Add to Home Screen</strong>.</li>
                        <li>Launch this app from your iPhone Home Screen icon.</li>
                        <li>Navigate back to this Profile tab and enable your notifications seamlessly!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              ) : isIframe ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-xs text-slate-300 flex items-start gap-2.5 leading-relaxed">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                    <div>
                      <strong className="text-indigo-300 block mb-0.5">Iframe Sandbox Limitation</strong>
                      Instant device popups require the application to run within its native tab instead of an iframe layout wrapper.
                    </div>
                  </div>
                  <button
                    onClick={handleOpenNewTab}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)] border-none outline-none"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open in New Tab to Enable Alerts</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-sans text-slate-300 font-medium">Push Notification Toggle</p>
                        <p className="text-[11px] text-slate-500 font-sans leading-relaxed">Turn background and lockscreen alerts on/off</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {isRegisteringPush ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : null}
                        
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isPushSubscribed && permissionStatus === 'granted'}
                          disabled={permissionStatus === 'unsupported' || isRegisteringPush}
                          onClick={
                            isPushSubscribed && permissionStatus === 'granted'
                              ? handleDisableNotifications
                              : handleRequestPermission
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                            isPushSubscribed && permissionStatus === 'granted' ? 'bg-indigo-600' : 'bg-slate-800'
                          } ${(permissionStatus === 'unsupported' || isRegisteringPush) ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isPushSubscribed && permissionStatus === 'granted' ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-slate-900" />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-sans text-slate-500">Current Status:</span>
                      
                      {permissionStatus === 'granted' ? (
                        isPushSubscribed ? (
                          <div className="text-emerald-400 text-[10px] font-mono tracking-wide font-bold uppercase flex items-center gap-1.5 bg-emerald-950/45 border border-emerald-500/20 px-2.5 py-0.5 rounded-full animate-fade-in">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Enabled</span>
                          </div>
                        ) : (
                          <div className="text-amber-400 text-[10px] font-mono tracking-wide font-bold uppercase flex items-center gap-1.5 bg-amber-950/45 border border-amber-500/20 px-2.5 py-0.5 rounded-full animate-fade-in">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Disabled</span>
                          </div>
                        )
                      ) : permissionStatus === 'denied' ? (
                        <div className="text-rose-400 text-[10px] font-mono tracking-wide font-bold uppercase flex items-center gap-1.5 bg-rose-950/45 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                          <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>Blocked by Browser</span>
                        </div>
                      ) : permissionStatus === 'unsupported' ? (
                        <div className="text-amber-400 text-[10px] font-mono tracking-wide font-bold uppercase flex items-center gap-1.5 bg-amber-950/45 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                          <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>Unsupported on Device</span>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px] font-mono tracking-wide font-bold uppercase flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>Disabled (Pending)</span>
                        </div>
                      )}
                    </div>
                    
                    {permissionStatus === 'denied' && (
                      <span className="text-[10px] text-rose-300 font-sans leading-relaxed bg-rose-950/15 border border-rose-950/50 rounded-lg p-2.5">
                        ⚠️ <strong>Permissions blocked.</strong> Please click on the lock icon 🔒 next to the web address at the top or bottom of your browser, and toggle "Notifications" to "Allow", then click the switch again.
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-sans text-slate-500 leading-normal">
                    💡 No spam policy in place. You can safely switch notifications off and on as you like. You will only receive background or lockscreen announcements created by your Course Representative.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manage Course Subscription Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => {
              setIsManagingSubscription(!isManagingSubscription);
              setSubPayError('');
              setSubPaySuccess('');
            }}
            className="w-full p-4 hover:bg-slate-900/40 text-left flex items-center justify-between pointer-events-auto cursor-pointer outline-none group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-950 text-indigo-400 group-hover:text-indigo-300 transition-colors">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-slate-200">Manage Course Subscription</p>
                <p className="text-xs text-slate-500 font-sans">View billing term, renewal dates, and status</p>
              </div>
            </div>
            <span className={`text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 group-hover:text-white px-2.5 py-1 rounded bg-slate-950 text-center transition-colors`}>
              {isManagingSubscription ? 'Hide' : 'Manage'}
            </span>
          </button>

          {isManagingSubscription && (
            <div className="p-4 border-t border-slate-900/60 bg-slate-950/20 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-900 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-sans">Subscription Level:</span>
                  <span className="text-xs text-slate-200 font-bold font-sans">₦200.00 / month</span>
                </div>
                <div className="h-px bg-slate-900" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-sans">Current Status:</span>
                  <span className={`text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                    isRep 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : subStatus === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {isRep 
                      ? 'Exempt Admin👑' 
                      : subStatus === 'active' 
                        ? 'Active month pass⚡' 
                        : 'Deactivated⛔'
                    }
                  </span>
                </div>
                {/* Expiry line */}
                {!isRep && subscriptionDetails && subscriptionDetails.expiryDate && (
                  <>
                    <div className="h-px bg-slate-900" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-sans">Renews on:</span>
                      <span className="text-xs text-slate-300 font-mono">
                        {new Date(subscriptionDetails.expiryDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </>
                )}
                {/* Reference line */}
                {!isRep && subscriptionDetails && subscriptionDetails.reference && (
                  <>
                    <div className="h-px bg-slate-900" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-sans">Reference code:</span>
                      <span className="text-[10px] text-slate-500 font-mono select-all truncate max-w-[150px]">
                        {subscriptionDetails.reference}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Action for non-reps to renew or extend payment */}
              {!isRep && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => onChangeTab('subscription')}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/25 cursor-pointer outline-none flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <CreditCard className="w-4 h-4 text-indigo-200" />
                      <span>Configure Access & Payments (₦200)</span>
                    </button>
                  </div>
                </div>
              )}
              
              {isRep && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-300/80 leading-relaxed font-sans">
                  ℹ️ Your Course Representative profile is automatically cleared and bypasses standard billing processes. There is no requirement for physical or electronic subscription payments on this account.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Support & Feedback Helpdesk Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => onChangeTab('feedback')}
            className="w-full p-4 hover:bg-slate-900/40 text-left flex items-center justify-between pointer-events-auto cursor-pointer outline-none group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-950 text-slate-450 group-hover:text-indigo-400 transition-colors">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-slate-200 animate-none">Helpdesk & Feedback</p>
                <p className="text-xs text-slate-500 font-sans">Send inquiries and suggestions to course administrators</p>
              </div>
            </div>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 group-hover:text-white px-2.5 py-1 rounded bg-slate-950 text-center transition-colors">
              Access
            </span>
          </button>
        </div>

        {/* Change Password Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => {
              setIsChangingPassword(!isChangingPassword);
              setPasswordError('');
              setPasswordSuccess('');
            }}
            className="w-full p-4 hover:bg-slate-900/40 text-left flex items-center justify-between pointer-events-auto cursor-pointer outline-none group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-950 text-slate-400 group-hover:text-indigo-400 transition-colors">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-slate-200 animate-none">Change Portal Password</p>
                <p className="text-xs text-slate-500 font-sans">Update security credentials for your account</p>
              </div>
            </div>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 group-hover:text-white px-2.5 py-1 rounded bg-slate-950 text-center transition-colors">
              {isChangingPassword ? 'Cancel' : 'Change'}
            </span>
          </button>

          {isChangingPassword && (
            <form onSubmit={handleUpdatePassword} className="p-4 border-t border-slate-900/60 bg-slate-950/20 space-y-4">
              {passwordError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Current Password Field */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Current Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">New Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Confirm New Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Save New Credentials</span>
              </button>
            </form>
          )}
        </div>

        {/* App Version & OTA Update Hub */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-all duration-300">
          <div className="p-4 bg-slate-900/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-950 text-indigo-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-sans font-medium text-slate-200">App Version & Update Hub</h4>
                  <p className="text-xs text-slate-500 font-sans">Current: v1.2.0 • Latest: v1.3.5</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase select-none animate-pulse">
                Update Available
              </span>
            </div>

            {updateStep === 'available' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/10 text-xs text-slate-300 font-sans leading-relaxed">
                  🚀 A new optimized software package <strong className="text-indigo-400">v1.3.5</strong> is ready for download! This resolves performance bottlenecks on both <strong className="text-white">Android</strong> and <strong className="text-white">iOS</strong> device layouts while enabling faster push loading cycles.
                </div>
                <button
                  type="button"
                  onClick={runOTAUpdate}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border-0 text-xs font-bold font-sans flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/30 transition-all select-none outline-none"
                >
                  <RefreshCcw className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                  <span>Update to v1.3.5 (Instant Over-The-Air)</span>
                </button>
              </div>
            )}

            {updateStep === 'updating' && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-900 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-indigo-300 font-sans font-medium">Installing Upgrades...</span>
                  <span className="text-slate-100 font-bold">{updatePercent}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${updatePercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-sans leading-normal animate-pulse">
                  ⚡ {updateStatusText}
                </p>
              </div>
            )}

            {updateStep === 'success' && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 animate-bounce">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-300 font-sans font-medium">{updateStatusText}</span>
              </div>
            )}
          </div>
        </div>

        {/* LOGOUT Button */}
        <button
          onClick={() => {
            setIsLoggingOut(true);
            setTimeout(() => {
              onLogout();
            }, 1000);
          }}
          disabled={isLoggingOut}
          className="w-full p-4 rounded-xl glassmorphism bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-left flex items-center justify-between pointer-events-auto cursor-pointer outline-none group disabled:opacity-60 disabled:cursor-wait"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-950/40 text-rose-400">
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="text-sm font-sans font-medium text-rose-300">
                {isLoggingOut ? 'Signing out...' : 'Sign-out from ICH100L'}
              </p>
              <p className="text-xs text-rose-500 font-sans">
                {isLoggingOut ? 'Clearing secure login state...' : 'Clears credentials from active browser memory'}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
