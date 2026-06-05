/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Award, GraduationCap, Clock, Bell, LogOut, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import { User, DayOfWeek, Activity, Deadline, Announcement } from './types';
import {
  DEFAULT_COURSE_REP_MATRIC,
  DEFAULT_ACTIVITIES,
  DEFAULT_DEADLINES,
  DEFAULT_ANNOUNCEMENTS
} from './data/defaultData';

import { db, cleanData, getSafeDocId } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, getDoc, collectionGroup, query, where } from 'firebase/firestore';

// Custom subcomponents
import GlassCard from './components/GlassCard';
import BottomNav, { TabType } from './components/BottomNav';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import Scheduler from './components/Scheduler';
import Deadlines from './components/Deadlines';
import Announcements from './components/Announcements';
import ProfileView from './components/ProfileView';
import AddEditPage from './components/AddEditPage';
import NotificationsPage, { NotificationItem } from './components/NotificationsPage';
import PushConfigPage from './components/PushConfigPage';
import SubscriptionPaywall from './components/SubscriptionPaywall';
import ModulesView from './components/ModulesView';
import CalendarView from './components/CalendarView';
import FeedbackPage from './components/FeedbackPage';
import DateScheduleView from './components/DateScheduleView';

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Checks if a custom document ID signifies an element created recently (within last 5 minutes)
function isRecentlyCreatedCustomId(id: string): boolean {
  if (!id) return false;
  const parts = id.split('-');
  if (parts.length >= 3 && (parts[0] === 'dl' || parts[0] === 'act' || parts[0] === 'ann') && parts[1] === 'custom') {
    const timestamp = parseInt(parts[2], 10);
    if (!isNaN(timestamp)) {
      const diff = Date.now() - timestamp;
      return diff >= 0 && diff <= 300000; // 5 minutes window
    }
  }
  return false;
}

const triggerPushNotification = async (title: string, body: string, category: string, departmentId?: string) => {
  try {
    await fetch('/api/send-broadcast-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, category, departmentId })
    });
  } catch (err) {
    console.warn('Failed to trigger background push notification:', err);
  }
};

function normalizeMatric(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/[\/\s\-_*]/g, '');
}

function getMondayOfDateString(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getInitials(nm: string) {
  if (!nm) return 'ST';
  const parts = nm.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function registerDeletedActivityLocally(activity: Activity) {
  try {
    const stored = localStorage.getItem('ich100l_deleted_activities');
    const list: Activity[] = stored ? JSON.parse(stored) : [];
    if (!list.some((item) => item.id === activity.id)) {
      list.push(activity);
      localStorage.setItem('ich100l_deleted_activities', JSON.stringify(list));
      window.dispatchEvent(new Event('ich100l_deleted_activities_updated'));
    }
  } catch (e) {
    console.warn('Failed to save deleted activity to local storage:', e);
  }
}

const logAppTraffic = async (user?: User | null) => {
  if (!db) return;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastLoggedDate = localStorage.getItem('ich100l_last_traffic_logged_date');
    const lastLoggedUser = localStorage.getItem('ich100l_last_traffic_logged_user');
    
    const currentUserKey = user?.matricNumber || 'Guest';

    if (lastLoggedDate === todayStr && lastLoggedUser === currentUserKey) {
      return;
    }

    const trafficId = `tr_${getSafeDocId(currentUserKey)}_${todayStr}`;
    await setDoc(doc(db, 'traffic', trafficId), {
      id: trafficId,
      matricNumber: currentUserKey,
      email: user?.email || (currentUserKey === 'Guest' ? 'Guest' : `${currentUserKey.replace(/\//g, '_')}@scheduler.edu`),
      name: user?.name || 'Guest User',
      role: user?.isCourseRep ? 'course_rep' : (user?.matricNumber === 'admin' ? 'admin' : (user ? 'student' : 'guest')),
      timestamp: new Date().toISOString(),
      date: todayStr
    }, { merge: true });

    localStorage.setItem('ich100l_last_traffic_logged_date', todayStr);
    localStorage.setItem('ich100l_last_traffic_logged_user', currentUserKey);
    console.log('[Traffic Tracking] Hit recorded:', trafficId);
  } catch (err) {
    console.warn('[Traffic Tracking] Session logging skipped:', err);
  }
};

const registerDeviceInFirestore = async (user?: User | null, isInstalledEvent = false) => {
  if (!db) return;
  // Trigger traffic hit logging on active status updates
  logAppTraffic(user);
  try {
    let deviceId = localStorage.getItem('ich100l_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('ich100l_device_id', deviceId);
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (navigator as any).standalone === true ||
                         document.referrer.includes('android-app://');

    const userAgent = navigator.userAgent || '';
    let platform = 'Web';
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(userAgent));
    if (isIOSDevice) {
      platform = 'iOS';
    } else if (/Android/.test(userAgent)) {
      platform = 'Android';
    } else if (/Macintosh/.test(userAgent)) {
      platform = 'macOS';
    } else if (/Windows/.test(userAgent)) {
      platform = 'Windows';
    } else if (/Linux/.test(userAgent)) {
      platform = 'Linux';
    }

    const pushPermission = 'Notification' in window ? Notification.permission : 'unsupported';
    
    let subscription: any = null;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const rawSubJSON = sub.toJSON();
            subscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: rawSubJSON.keys?.p256dh || '',
                auth: rawSubJSON.keys?.auth || ''
              }
            };
          }
        }
      } catch (e) {
        console.warn('[Device Registry] Active registration push retrieval skipped:', e);
      }
    }

    const cleanDeviceId = getSafeDocId(deviceId);
    const existingInstalled = localStorage.getItem('ich100l_pwa_installed') === 'true';
    const isInstalled = isInstalledEvent || existingInstalled || isStandalone;

    if (isInstalledEvent) {
      localStorage.setItem('ich100l_pwa_installed', 'true');
    }

    const devicePayload: any = {
      deviceId: cleanDeviceId,
      matricNumber: user?.matricNumber || 'Guest',
      name: user?.name || 'Guest',
      isStandalone,
      platform,
      userAgent: userAgent.slice(0, 250),
      pushPermission,
      isInstalled,
      registeredAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };

    if (subscription) {
      devicePayload.subscription = subscription;
    }

    await setDoc(doc(db, 'devices', cleanDeviceId), devicePayload, { merge: true });
  } catch (err) {
    console.warn('[Device Registry] Failed to record device context:', err);
  }
};

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('ich100l_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Install capability matching
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[PWA App] beforeinstallprompt caught & stored.');
    };

    const handleAppInstalled = () => {
      console.log('[PWA App] appinstalled event caught. The user installed the application.');
      registerDeviceInFirestore(currentUser, true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Initial and periodic registration check
    registerDeviceInFirestore(currentUser);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [currentUser]);

  // OTA App Version Pop-up states and listeners
  const [appLocalVersion, setAppLocalVersion] = useState(() => localStorage.getItem('ich100l_client_app_version') || '1.2.0');
  const [appServerVersion, setAppServerVersion] = useState('');
  const [appReleaseNotes, setAppReleaseNotes] = useState('An over-the-air software package is ready for installation.');
  const [showOtaPopup, setShowOtaPopup] = useState(false);

  useEffect(() => {
    if (!currentUser || !db) return;

    const unsubVersion = onSnapshot(doc(db, 'system-config', 'app-version'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const serverVer = data.latestVersion || '1.2.0';
        setAppServerVersion(serverVer);
        if (data.releaseNotes) {
          setAppReleaseNotes(data.releaseNotes);
        }

        const storedLocalVer = localStorage.getItem('ich100l_client_app_version');
        if (!storedLocalVer) {
          // New device browser context or fresh login, they are already running the latest deployed code
          localStorage.setItem('ich100l_client_app_version', serverVer);
          setAppLocalVersion(serverVer);
        } else {
          setAppLocalVersion(storedLocalVer);
          // Retrieve previously dismissed version from localStorage
          const dismissedVer = localStorage.getItem('ich100l_dismissed_ota_version') || '';

          if (storedLocalVer !== serverVer && dismissedVer !== serverVer) {
            setShowOtaPopup(true);
          } else {
            setShowOtaPopup(false);
          }
        }
      }
    }, (error) => {
      console.warn('[App] Failed to listen to app-version:', error);
    });

    return () => unsubVersion();
  }, [currentUser]);

  // Auto-sync Web Push subscription state on App startup and whenever user logs in
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
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

            fetch('/api/push-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: serializedSub,
                matricNumber: currentUser?.matricNumber || 'Guest',
                name: currentUser?.name || 'Guest',
                isStandalone,
                platform
              })
            }).catch((err) => {
              console.warn('[PWA App] Auto-sync silent push setup failure:', err);
            });
          }
        }).catch((err) => {
          console.warn('[PWA App] Could not get push sub:', err);
        });
      }).catch((e) => {
        console.warn('[PWA App] SW not ready for auto-sync:', e);
      });
    }
  }, [currentUser]);

  // Timetable and announcements databases - dynamic fresh connection
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // In-App manual messaging overlays state
  const [dismissedMessages, setDismissedMessages] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ich100l_dismissed_in_app');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [inAppMessages, setInAppMessages] = useState<any[]>([]);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const stored = localStorage.getItem('ich100l_notifications');
      if (stored) return JSON.parse(stored);
      
      const defaults: NotificationItem[] = [
        {
          id: 'notif-1',
          type: 'announcement',
          title: 'Practical Handbook Distributed',
          body: 'Collect physical guides and worksheets for ICH100L from course assistants at administrative center.',
          time: '2 hours ago',
          isRead: false,
          priority: 'medium',
          referenceTab: 'announcements'
        },
        {
          id: 'notif-2',
          type: 'deadline',
          title: 'Salt Analysis Worksheet Submission',
          body: 'Course Rep posted lab sheet schema submission workspace details. Click details to check prompt guidelines.',
          time: '5 hours ago',
          isRead: false,
          priority: 'high',
          referenceTab: 'deadlines'
        },
        {
          id: 'notif-3',
          type: 'schedule',
          title: 'Introductory Lab Safety Lecture',
          body: 'Syllabus coordinator scheduled physical lecture in main auditorium. Check Monday timeline.',
          time: '1 day ago',
          isRead: true,
          priority: 'info',
          referenceTab: 'schedule'
        }
      ];
      return defaults;
    } catch {
      return [];
    }
  });

  // Listen to subscription status in real-time
  const [subStatus, setSubStatus] = useState<'loading' | 'active' | 'inactive'>('loading');
  const [deletedActivitiesTrigger, setDeletedActivitiesTrigger] = useState<number>(0);

  useEffect(() => {
    const handleDeletedActivitiesUpdated = () => {
      setDeletedActivitiesTrigger(prev => prev + 1);
    };
    window.addEventListener('ich100l_deleted_activities_updated', handleDeletedActivitiesUpdated);
    return () => {
      window.removeEventListener('ich100l_deleted_activities_updated', handleDeletedActivitiesUpdated);
    };
  }, []);

  const deletedActivityIds = useMemo<string[]>(() => {
    const _ = deletedActivitiesTrigger;
    try {
      const stored = localStorage.getItem('ich100l_deleted_activities');
      const list = stored ? JSON.parse(stored) : [];
      return Array.isArray(list)
        ? list.map((a: any) => {
            if (!a) return null;
            if (typeof a === 'string') return a;
            if (typeof a === 'object' && a.id) return a.id;
            return null;
          }).filter(Boolean) as string[]
        : [];
    } catch {
      return [];
    }
  }, [deletedActivitiesTrigger]);

  const matchedDepartment = useMemo(() => {
    if (!currentUser?.matricNumber || departments.length === 0) return null;
    const userNorm = normalizeMatric(currentUser.matricNumber);
    return departments.find((dept) => {
      const deptNorm = normalizeMatric(dept.prefix);
      return deptNorm && userNorm.includes(deptNorm);
    });
  }, [currentUser, departments]);

  const filterItemByDepartment = (item: any) => {
    const deptId = item.departmentId || 'dept-ps-ich';
    return matchedDepartment?.id === deptId;
  };

  const visibleActivities = useMemo<Activity[]>(() => {
    const list = activities.filter(act => filterItemByDepartment(act));
    return list.filter((act) => !deletedActivityIds.includes(act.id));
  }, [activities, deletedActivityIds, matchedDepartment]);

  const visibleDeadlines = useMemo<Deadline[]>(() => {
    return deadlines.filter(dl => filterItemByDepartment(dl));
  }, [deadlines, matchedDepartment]);

  const visibleAnnouncements = useMemo<Announcement[]>(() => {
    return announcements.filter(ann => filterItemByDepartment(ann));
  }, [announcements, matchedDepartment]);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [trialDetails, setTrialDetails] = useState<{ isTrial: boolean; daysRemaining: number } | null>(null);
  
  const [semesterConfig, setSemesterConfig] = useState<{
    semesterActive: boolean;
    semesterStartedAt: string | null;
    amount: number;
  }>({
    semesterActive: true,
    semesterStartedAt: null,
    amount: 1000
  });

  const appTitle = useMemo(() => {
    if (matchedDepartment) {
      const abbrev = (matchedDepartment.prefix || '').split('/').pop()?.toUpperCase() || 'BCH';
      const level = (matchedDepartment.level || '100l').toUpperCase();
      return `${abbrev} ${level}`;
    }
    return 'ICH100L';
  }, [matchedDepartment]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (!matchedDepartment) return false;
      return notif.departmentId === matchedDepartment.id;
    });
  }, [notifications, matchedDepartment]);

  // Synchronize notifications with existing database records on load to make sure they're never empty
  useEffect(() => {
    if (!currentUser || !matchedDepartment) return;
    
    setNotifications((prev) => {
      let changed = false;
      const updated = [...prev];
      
      // Sync activities
      activities.forEach((act) => {
        const deptId = act.departmentId || 'dept-ps-ich';
        if (deptId === matchedDepartment.id) {
          const actNotifId = `notif-act-db-${act.id}`;
          if (!updated.some(n => n.id === actNotifId)) {
            updated.push({
              id: actNotifId,
              type: 'schedule',
              title: 'Class Published 📅',
              body: `${act.courseCode || 'ICH100L'}: "${act.title}" is scheduled on ${act.day} in ${act.location || 'Classroom'}.`,
              time: 'Active Schedule',
              isRead: true,
              priority: 'info',
              referenceTab: 'schedule',
              departmentId: deptId
            });
            changed = true;
          }
        }
      });

      // Sync deadlines
      deadlines.forEach((dl) => {
        const deptId = dl.departmentId || 'dept-ps-ich';
        if (deptId === matchedDepartment.id) {
          const dlNotifId = `notif-dl-db-${dl.id}`;
          if (!updated.some(n => n.id === dlNotifId)) {
            updated.push({
              id: dlNotifId,
              type: 'deadline',
              title: `Assignment Published: ${dl.courseCode} 📣`,
              body: `Deadline poster: "${dl.title}". Due date: ${dl.dueDate}.`,
              time: 'Active Assignment',
              isRead: true,
              priority: 'high',
              referenceTab: 'deadlines',
              departmentId: deptId
            });
            changed = true;
          }
        }
      });

      // Sync announcements
      announcements.forEach((ann) => {
        const deptId = ann.departmentId || 'dept-ps-ich';
        if (deptId === matchedDepartment.id) {
          const annNotifId = `notif-ann-db-${ann.id}`;
          if (!updated.some(n => n.id === annNotifId)) {
            updated.push({
              id: annNotifId,
              type: 'announcement',
              title: `Broadcast: ${ann.title} 🚨`,
              body: ann.content.substring(0, 100) + (ann.content.length > 100 ? '...' : ''),
              time: 'Active Broadcast',
              isRead: true,
              priority: (ann.priority as any) || 'medium',
              referenceTab: 'announcements',
              departmentId: deptId
            });
            changed = true;
          }
        }
      });
      
      if (changed) {
        return updated;
      }
      return prev;
    });
  }, [currentUser, matchedDepartment, activities, deadlines, announcements]);

  // Logo branding status
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [logoInput, setLogoInput] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError('');
    setIsUploadingLogo(true);

    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError('Logo image is too large (max 2MB allowed).');
      setIsUploadingLogo(false);
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
      let finalUrl = '';
      try {
        const resp = await fetch('/api/upload-logo', {
          method: 'POST',
          body: formData,
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.success) {
            finalUrl = data.url;
          }
        }
      } catch (err) {
        console.warn('Backend API logo upload failed, switching to serverless Base64 storage:', err);
      }

      if (!finalUrl) {
        // Fallback for Vercel: Read in-browser as Base64 data URI
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      setLogoInput(finalUrl);
      await setDoc(doc(db, 'system-config', 'app-branding'), { logoUrl: finalUrl }, { merge: true });
      setLogoUrl(finalUrl);
      setIsEditingLogo(false);
    } catch (err) {
      console.error('Logo upload error:', err);
      setLogoUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const [isVerifyingURL, setIsVerifyingURL] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');

  // Listen to branding logo
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system-config', 'app-branding'), (snap) => {
      if (snap.exists()) {
        const url = snap.data().logoUrl || '';
        setLogoUrl(url);
        setLogoInput(url);
      }
    }, (err) => {
      console.warn('Listening app branding logo failed:', err);
    });
    return () => unsub();
  }, []);

  const handleUpdateLogo = async (url: string) => {
    try {
      await setDoc(doc(db, 'system-config', 'app-branding'), { logoUrl: url }, { merge: true });
      setLogoUrl(url);
      setIsEditingLogo(false);
    } catch (err) {
      console.error('Failed to update app branding logo:', err);
    }
  };

  // Handle Paystack callback parameter capture
  useEffect(() => {
    if (!currentUser) return;

    const queryParams = new URLSearchParams(window.location.search);
    const reference = queryParams.get('reference') || queryParams.get('trxref');

    if (reference) {
      const verifyPayment = async () => {
        setIsVerifyingURL(true);
        setVerificationError('');
        setVerificationSuccess('');
        try {
          const res = await fetch('/api/paystack-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, matricNumber: currentUser.matricNumber })
          });
          const data = await res.json();
          if (data.success) {
            const payAmount = semesterConfig.amount || 1000;
            const expiryText = 'Current Semester';

            const subData = {
              status: 'active',
              matricNumber: currentUser.matricNumber,
              email: currentUser.email || `${currentUser.matricNumber.replace(/\//g, '_')}@ich100l.edu`,
              name: currentUser.name,
              lastPaymentDate: new Date().toISOString(),
              expiryDate: expiryText,
              reference: reference,
              amountPaid: payAmount,
            };

            await setDoc(doc(db, 'subscriptions', getSafeDocId(currentUser.matricNumber)), subData);

            // Record chronological log of the success transaction
            await setDoc(doc(db, 'payments', reference), {
              reference: reference,
              matricNumber: currentUser.matricNumber,
              email: currentUser.email || `${currentUser.matricNumber.replace(/\//g, '_')}@ich100l.edu`,
              name: currentUser.name,
              amount: payAmount,
              paidAt: new Date().toISOString(),
              status: 'success'
            });

            setVerificationSuccess('Payment verified successfully! Semester account access granted. ⚡');
            
            // Sync cache
            localStorage.setItem(`ich100l_sub_${currentUser.matricNumber}`, JSON.stringify({
              status: 'active',
              expiryDate: expiryText,
              lastPaymentDate: subData.lastPaymentDate,
              reference: subData.reference
            }));

            // Force visual subscription updates
            setSubscriptionDetails({
              status: 'active',
              expiryDate: expiryText,
              lastPaymentDate: subData.lastPaymentDate,
              reference: subData.reference,
              amountPaid: payAmount
            });
            setSubStatus('active');
          } else {
            setVerificationError(data.message || 'Payment validation failed.');
          }
        } catch (err) {
          console.error("URL-Reference verification error:", err);
          setVerificationError('Unable to connect to transaction verification server.');
        } finally {
          setIsVerifyingURL(false);
          // Clean URL parameters
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('reference');
            url.searchParams.delete('trxref');
            window.history.replaceState({}, document.title, url.pathname + url.search);
          } catch (e) {}
        }
      };

      verifyPayment();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setSubStatus('inactive');
      return;
    }

    if (currentUser.isCourseRep === true) {
      setSubStatus('active');
      setSubscriptionDetails({
        status: 'active',
        expiryDate: '2030-12-31',
        lastPaymentDate: 'Exempt',
        reference: 'ADMIN-BYPASS'
      });
      return;
    }

    // Trial checker helper to evaluate registration and remaining 1 week period
    const checkAndGetTrial = () => {
      // Free trial completely removed as requested
      return { isTrial: false, daysRemaining: 0 };
    };

    const trial = checkAndGetTrial();
    setTrialDetails(trial);

    // Initial cache check
    let hasValidPaidSub = false;
    try {
      const cached = localStorage.getItem(`ich100l_sub_${currentUser.matricNumber}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.expiryDate && parsed.expiryDate > new Date().toISOString()) {
          setSubStatus('active');
          setSubscriptionDetails(parsed);
          hasValidPaidSub = true;
        }
      }
    } catch (e) {
      console.warn('Read cached subscription failed:', e);
    }

    // Fallback if no valid sub but trial is active
    if (!hasValidPaidSub) {
      setSubStatus('inactive');
    }

    // Unified Semester Billing & Subscription Checker
    let unsubscribeSub: () => void = () => {};

    const unsubscribeSemester = onSnapshot(doc(db, 'system-config', 'semester-billing'), (snapBill) => {
      let isSemActive = true;
      let semStartedAt: string | null = null;
      let semAmount = 1000;

      if (snapBill.exists()) {
        const data = snapBill.data();
        isSemActive = data.semesterActive ?? true;
        semStartedAt = data.semesterStartedAt ?? null;
        semAmount = data.amount ?? 1000;
        
        setSemesterConfig({
          semesterActive: isSemActive,
          semesterStartedAt: semStartedAt,
          amount: semAmount
        });
      }

      // Check rep/admin overrides
      const isRepOrAdmin = currentUser.isAdmin || currentUser.isCourseRep || currentUser.matricNumber === '2026/ps/ich/0034';
      if (isRepOrAdmin) {
        setSubStatus('active');
        setSubscriptionDetails({
          status: 'active',
          isTrial: false,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          lastPaymentDate: new Date().toISOString(),
          reference: 'ADMIN-PASS',
          amountPaid: semAmount
        });
        return;
      }

      // If semester is ended, ALL standard students are locked out, and payment is disabled!
      if (!isSemActive) {
        setSubStatus('inactive');
        setSubscriptionDetails({
          status: 'inactive',
          message: 'The current semester has ended. Platform data access is locked until the registration portal is activated.',
          lastPaymentDate: null
        });
        return;
      }

      // Otherwise, check their subscription document in real time!
      // Generate multiple representations of the student's matric number to handle any casing, slash, or dash formatting variations
      const variations = [
        currentUser.matricNumber,
        currentUser.matricNumber.toLowerCase(),
        currentUser.matricNumber.toUpperCase(),
        currentUser.matricNumber.replace(/\//g, '-'),
        currentUser.matricNumber.replace(/\//g, '-').toLowerCase(),
        currentUser.matricNumber.replace(/\//g, '-').toUpperCase(),
        currentUser.matricNumber.replace(/-/g, '/'),
        currentUser.matricNumber.replace(/-/g, '/').toLowerCase(),
        currentUser.matricNumber.replace(/-/g, '/').toUpperCase()
      ];
      const uniqueVariations = Array.from(new Set(variations.map(v => v.trim()).filter(Boolean))).slice(0, 10);

      const subQuery = query(
        collection(db, 'subscriptions'),
        where('matricNumber', 'in', uniqueVariations)
      );
      
      // Clean up previous subscription listener if it was running
      unsubscribeSub();

      unsubscribeSub = onSnapshot(subQuery, (querySnap) => {
        if (!querySnap.empty) {
          // Take the matching subscription document
          const docSnap = querySnap.docs[0];
          const data = docSnap.data();
          
          // Highly resilient evaluation to prevent locking out legitimate paying students:
          // A student is considered active under semester billing if:
          // 1. Their Firestore subscription document status is explicitly 'active'
          // AND AT LEAST ONE OF:
          //   a. They paid after the official semester start date (if set)
          //   b. They paid within the last 120 days (the average length of an academic semester/billing block, so we cover early birds and timezone differences)
          //   c. Their expiryDate is written as 'Current Semester' or is a future date
          const payDateStr = data.lastPaymentDate;
          const isStatusActive = data.status === 'active';
          
          let paidRecently = false;
          try {
            if (payDateStr) {
              const diffMs = Date.now() - Date.parse(payDateStr);
              if (!isNaN(diffMs) && diffMs < 120 * 24 * 60 * 60 * 1000) {
                paidRecently = true;
              }
            }
          } catch (e) {
            console.warn('Error parsing lastPaymentDate:', e);
          }

          const paidAfterSemesterStart = payDateStr && (!semStartedAt || payDateStr >= semStartedAt);
          const isExpiryValid = data.expiryDate && (
            data.expiryDate === 'Current Semester' || 
            data.expiryDate > new Date().toISOString()
          );

          const hasPaidThisSemester = isStatusActive && (paidRecently || paidAfterSemesterStart || isExpiryValid);

          if (hasPaidThisSemester) {
            const details = {
              status: 'active',
              expiryDate: data.expiryDate || new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
              lastPaymentDate: payDateStr,
              reference: data.reference || 'PAYSTACK-OK',
              amountPaid: data.amountPaid || 1000
            };
            setSubscriptionDetails(details);
            setSubStatus('active');
            localStorage.setItem(`ich100l_sub_${currentUser.matricNumber}`, JSON.stringify(details));
          } else {
            // Paid in previous semester but not this one
            const details = {
              status: 'inactive',
              expiryDate: data.expiryDate,
              lastPaymentDate: payDateStr,
              reference: data.reference,
              message: 'Your payment was registered in a previous semester. Please pay ₦1,000 to authorize access for the current semester.'
            };
            setSubscriptionDetails(details);
            setSubStatus('inactive');
            localStorage.setItem(`ich100l_sub_${currentUser.matricNumber}`, JSON.stringify(details));
          }
        } else {
          // Never paid
          setSubscriptionDetails({ status: 'inactive' });
          setSubStatus('inactive');
          localStorage.removeItem(`ich100l_sub_${currentUser.matricNumber}`);
        }
      }, (error) => {
        console.warn('Subscription fetch fallback: ', error);
        setSubStatus('inactive');
      });
    }, (error) => {
      console.warn('Semester config fetch fallback: ', error);
    });

    return () => {
      unsubscribeSemester();
      unsubscribeSub();
    };
  }, [currentUser]);

  // Session concurrency safety: Listen to changes in user profile document on Firestore.
  // If activeSessionId changes online to not match the current device session ID, log the account out.
  useEffect(() => {
    if (!currentUser) return;

    let deviceSessionId = localStorage.getItem('ich100l_session_id');
    if (!deviceSessionId) {
      deviceSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('ich100l_session_id', deviceSessionId);
    }

    const docRef = doc(db, 'users', getSafeDocId(currentUser.matricNumber));
    const unsubscribeSession = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          // 1. Session conflict check
          if (data.activeSessionId && data.activeSessionId !== deviceSessionId) {
            console.warn('[Session] Session conflict detected. Another device signed in. Logging out...');
            alert('This student account has been signed in on a different device. You have been automatically logged out.');
            setCurrentUser(null);
            localStorage.removeItem('ich100l_user');
            return;
          }

          // 2. Real-time Role level updates (isCourseRep, isAdmin, profile changes)
          const isCourseRepChanged = (currentUser.isCourseRep || false) !== (data.isCourseRep || false);
          const isAdminChanged = (currentUser.isAdmin || false) !== (data.isAdmin || false);
          const nameChanged = currentUser.name !== data.name;
          const emailChanged = currentUser.email !== data.email;
          const seenBroadcastsChanged = JSON.stringify(currentUser.seenBroadcasts || []) !== JSON.stringify(data.seenBroadcasts || []);

          if (isCourseRepChanged || isAdminChanged || nameChanged || emailChanged || seenBroadcastsChanged) {
            console.log('[Session] Real-time role, profile or seen broadcasts update received from Firestore, syncing state...');
            const updatedUser = {
              ...currentUser,
              name: data.name || currentUser.name,
              email: data.email || currentUser.email,
              isCourseRep: data.isCourseRep || false,
              isAdmin: data.isAdmin || false,
              seenBroadcasts: data.seenBroadcasts || []
            };
            setCurrentUser(updatedUser);
            localStorage.setItem('ich100l_user', JSON.stringify(updatedUser));
          }
        }
      }
    }, (error) => {
      console.warn('[Session] Concurrency listener lookup skipped:', error);
    });

    return () => unsubscribeSession();
  }, [currentUser]);

  const handleUpdateSubStatus = () => {
    if (!currentUser) return;
    try {
      const cached = localStorage.getItem(`ich100l_sub_${currentUser.matricNumber}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.expiryDate && parsed.expiryDate > new Date().toISOString()) {
          setSubStatus('active');
          setSubscriptionDetails(parsed);
        }
      }
    } catch(err) {}
  };

  // One-time initialization to clear any previously seeded default activities from the archive bin
  useEffect(() => {
    if (!localStorage.getItem('ich100l_bin_cleared_v5')) {
      localStorage.removeItem('ich100l_deleted_activities');
      localStorage.setItem('ich100l_bin_cleared_v5', 'true');
      window.dispatchEvent(new Event('ich100l_deleted_activities_updated'));
    }
  }, []);

  // Wipes all preloaded defaults and enforces automatic weekly rollover (partitioning past/future)
  useEffect(() => {
    if (!currentUser) return;

    // Safety check: ONLY the Course Representative is authorized to execute database rollovers and resets!
    // This absolutely prevents race conditions and timezone mismatches of standard students from wiping other users' data.
    const isRep = currentUser.isCourseRep === true;
    if (!isRep) return;

    const wipeAndSeedIfNewWeek = async () => {
      try {
        const currentMonday = getMondayOfCurrentWeek();
        const configRef = doc(db, 'system-config', 'week-tracker');
        let needsWipe = false;

        const docSnap = await getDoc(configRef);
        if (!docSnap.exists()) {
          await setDoc(configRef, { lastMonday: currentMonday });
        } else {
          const trackerData = docSnap.data();
          if (trackerData.lastMonday !== currentMonday) {
            needsWipe = true;
          }
        }

        if (needsWipe) {
          console.log('entering a new week! wipe all previous week documents...');
          
          // Partition Activities: Only move past week's items to the local bin, keep future ones live
          const actSnap = await getDocs(collection(db, 'activities'));
          for (const d of actSnap.docs) {
            const data = { ...d.data(), id: d.id } as Activity;
            
            let belongsToPast = false;
            if (data.date) {
              const actMonday = getMondayOfDateString(data.date);
              if (actMonday < currentMonday) {
                belongsToPast = true;
              }
            } else {
              // Repeating schedules without custom Date are considered part of the last week's layout, so we roll them to bin
              belongsToPast = true;
            }

            if (belongsToPast) {
              registerDeletedActivityLocally(data);
              await deleteDoc(doc(db, 'activities', d.id));
            }
          }

          // Partition Deadlines: Only delete deadlines from previous weeks
          const dlSnap = await getDocs(collection(db, 'deadlines'));
          for (const d of dlSnap.docs) {
            const data = d.data() as Deadline;
            if (data.dueDate) {
              const dlMonday = getMondayOfDateString(data.dueDate);
              if (dlMonday < currentMonday) {
                await deleteDoc(doc(db, 'deadlines', d.id));
              }
            }
          }

          // Partition Announcements: Only delete old announcements from previous weeks
          const annSnap = await getDocs(collection(db, 'announcements'));
          for (const d of annSnap.docs) {
            const data = d.data() as Announcement;
            if (data.date) {
              const annMonday = getMondayOfDateString(data.date);
              if (annMonday < currentMonday) {
                await deleteDoc(doc(db, 'announcements', d.id));
              }
            }
          }

          await setDoc(configRef, { 
            lastMonday: currentMonday, 
            wipedAt: new Date().toISOString() 
          });
          console.log('Automated week rollover database sweep completed.');
        }

        // Anti-Seeding Rule: Ensure all default seeded mock datas are COMPLETELY wiped from Firestore
        for (const act of DEFAULT_ACTIVITIES) {
          await deleteDoc(doc(db, 'activities', act.id));
        }
        for (const dl of DEFAULT_DEADLINES) {
          await deleteDoc(doc(db, 'deadlines', dl.id));
        }
        for (const ann of DEFAULT_ANNOUNCEMENTS) {
          await deleteDoc(doc(db, 'announcements', ann.id));
        }

      } catch (err) {
        console.warn('Auto-rollover and cleaning failed:', err);
      }
    };

    wipeAndSeedIfNewWeek();
  }, [currentUser]);


  // Listen to Firestore real-time updates for activities
  useEffect(() => {
    if (!currentUser) return;
    const knownIds = new Set<string>();
    let isInitial = true;
    const unsubscribe = onSnapshot(collection(db, 'activities'), (snapshot) => {
      const docs: Activity[] = [];
      snapshot.forEach((doc) => {
        docs.push({ ...doc.data(), id: doc.id } as Activity);
        if (isInitial) {
          knownIds.add(doc.id);
        }
      });

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as Activity;
            const docId = change.doc.id;
            const actDeptId = data.departmentId || 'dept-ps-ich';
            if (!knownIds.has(docId)) {
              knownIds.add(docId);
              // Only trigger visual notifications inside the app if the activity matches the user's department (and was added in real-time)
              if (matchedDepartment?.id === actDeptId && data.createdBy !== currentUser.matricNumber) {
                const notif: NotificationItem = {
                  id: `notif-act-${Date.now()}-${change.doc.id}`,
                  type: 'schedule',
                  title: 'New Class Scheduled 📅',
                  body: `${data.courseCode || 'ICH100L'}: "${data.title}" is scheduled on ${data.day} from ${data.timeStart} to ${data.timeEnd}.`,
                  time: 'Just now',
                  isRead: false,
                  priority: 'info',
                  referenceTab: 'schedule',
                  departmentId: actDeptId
                };
                setNotifications((prev) => {
                  if (prev.some(p => p.id === notif.id)) return prev;
                  return [notif, ...prev];
                });
              }
            }
          } else if (change.type === 'removed') {
            const data = { ...change.doc.data(), id: change.doc.id } as Activity;
            registerDeletedActivityLocally(data);
            const actDeptId = data.departmentId || 'dept-ps-ich';
            if (matchedDepartment?.id === actDeptId && data.createdBy !== currentUser.matricNumber) {
              const notif: NotificationItem = {
                id: `notif-act-rem-${Date.now()}-${change.doc.id}`,
                type: 'schedule',
                title: 'Class Schedule Canceled ❌',
                body: `${data.courseCode || 'ICH100L'}: "${data.title}" has been canceled or removed.`,
                time: 'Just now',
                isRead: false,
                priority: 'high',
                referenceTab: 'schedule',
                departmentId: actDeptId
              };
              setNotifications((prev) => [notif, ...prev]);
            }
          }
        });
      }

      setActivities(docs);
      isInitial = false;
    }, (error) => {
      console.warn('Firestore listening to activities failed:', error);
    });
    return () => unsubscribe();
  }, [currentUser, matchedDepartment]);

  // Listen to Firestore real-time updates for deadlines
  useEffect(() => {
    if (!currentUser) return;
    const knownIds = new Set<string>();
    let isInitial = true;
    const unsubscribe = onSnapshot(collection(db, 'deadlines'), (snapshot) => {
      const docs: Deadline[] = [];
      snapshot.forEach((doc) => {
        docs.push({ ...doc.data(), id: doc.id } as Deadline);
        if (isInitial) {
          knownIds.add(doc.id);
        }
      });

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as Deadline;
            const docId = change.doc.id;
            const dlDeptId = data.departmentId || 'dept-ps-ich';
            if (!knownIds.has(docId)) {
              knownIds.add(docId);
              // Only trigger visual notifications inside the app if the deadline matches the user's department (and was added in real-time)
              if (matchedDepartment?.id === dlDeptId && data.createdBy !== currentUser.matricNumber) {
                const notif: NotificationItem = {
                  id: `notif-dl-${Date.now()}-${change.doc.id}`,
                  type: 'deadline',
                  title: `Assignment Published: ${data.courseCode} 📣`,
                  body: `New deadline: "${data.title}". Due date: ${data.dueDate}.`,
                  time: 'Just now',
                  isRead: false,
                  priority: 'high',
                  referenceTab: 'deadlines',
                  departmentId: dlDeptId
                };
                setNotifications((prev) => {
                  if (prev.some(p => p.id === notif.id)) return prev;
                  return [notif, ...prev];
                });
              }
            }
          }
        });
      }

      setDeadlines(docs);
      isInitial = false;
    }, (error) => {
      console.warn('Firestore listening to deadlines failed:', error);
    });
    return () => unsubscribe();
  }, [currentUser, matchedDepartment]);

  // Listen to Firestore real-time updates for announcements
  useEffect(() => {
    if (!currentUser) return;
    const knownIds = new Set<string>();
    let isInitial = true;
    const unsubscribe = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const docs: Announcement[] = [];
      snapshot.forEach((doc) => {
        docs.push({ ...doc.data(), id: doc.id } as Announcement);
        if (isInitial) {
          knownIds.add(doc.id);
        }
      });

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as Announcement;
            const docId = change.doc.id;
            const annDeptId = data.departmentId || 'dept-ps-ich';
            const isMe = data.author?.includes(currentUser.name);
            if (!knownIds.has(docId)) {
              knownIds.add(docId);
              // Only trigger visual notifications inside the app if the announcement matches the user's department (and was added in real-time)
              if (matchedDepartment?.id === annDeptId && !isMe) {
                const notif: NotificationItem = {
                  id: `notif-ann-${Date.now()}-${change.doc.id}`,
                  type: 'announcement',
                  title: `Urgent Course Broadcaster 🚨`,
                  body: `"${data.title}": ${data.content.substring(0, 70)}${data.content.length > 70 ? '...' : ''}`,
                  time: 'Just now',
                  isRead: false,
                  priority: (data.priority as any) || 'medium',
                  referenceTab: 'announcements',
                  departmentId: annDeptId
                };
                setNotifications((prev) => {
                  if (prev.some(p => p.id === notif.id)) return prev;
                  return [notif, ...prev];
                });
              }
            }
          }
        });
      }

      setAnnouncements(docs);
      isInitial = false;
    }, (error) => {
      console.warn('Firestore listening to announcements failed:', error);
    });
    return () => unsubscribe();
  }, [currentUser, matchedDepartment]);

  // Listen to Firestore real-time updates for departments
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'departments'), async (snapshot) => {
      const depts: any[] = [];
      snapshot.forEach((doc) => {
        depts.push({ ...doc.data(), id: doc.id });
      });
      
      if (depts.length === 0) {
        console.log('Seeding default departments...');
        const defaultDepts = [
          {
            id: 'dept-ps-ich',
            name: 'Industrial Chemistry',
            prefix: 'ps/ich',
            courseRepMatric: '2025/ps/ich/0034',
            level: '100l',
            createdAt: new Date().toISOString()
          },
          {
            id: 'dept-ps-chm',
            name: 'Pure and Applied Chemistry',
            prefix: 'ps/chm',
            courseRepMatric: '2025/ps/chm/0034',
            level: '100l',
            createdAt: new Date().toISOString()
          }
        ];
        for (const dept of defaultDepts) {
          try {
            await setDoc(doc(db, 'departments', dept.id), dept);
            depts.push(dept);
          } catch (err) {
            console.error('Failed to seed default department:', err);
          }
        }
      }
      setDepartments(depts);
    }, (error) => {
      console.warn('Firestore listening to departments failed:', error);
      // Failover fallback departments
      const fallbackDepts = [
        {
          id: 'dept-ps-ich',
          name: 'Industrial Chemistry',
          prefix: 'ps/ich',
          courseRepMatric: '2025/ps/ich/0034',
          level: '100l',
          createdAt: new Date().toISOString()
        },
        {
          id: 'dept-ps-chm',
          name: 'Pure and Applied Chemistry',
          prefix: 'ps/chm',
          courseRepMatric: '2025/ps/chm/0034',
          level: '100l',
          createdAt: new Date().toISOString()
        }
      ];
      setDepartments(fallbackDepts);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Listen to Firestore real-time updates for manual inapp messages
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'in_app_messages'), (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ ...doc.data(), id: doc.id });
      });
      // Sort by createdAt descending
      msgs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setInAppMessages(msgs);
    }, (error) => {
      console.warn('Firestore listening to in_app_messages failed:', error);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Derived active in-app message
  const activeInApp = useMemo(() => {
    if (!currentUser) return null;
    return inAppMessages.find((msg) => {
      if (!msg.active) return false;
      const deptMatch = msg.targetDepartmentId === 'all' || msg.targetDepartmentId === matchedDepartment?.id;
      if (!deptMatch) return false;
      return !dismissedMessages.includes(msg.id);
    });
  }, [inAppMessages, currentUser, matchedDepartment, dismissedMessages]);

  const handleDismissInApp = (id: string) => {
    setDismissedMessages((prev) => {
      const updated = [...prev, id];
      localStorage.setItem('ich100l_dismissed_in_app', JSON.stringify(updated));
      return updated;
    });
  };

  // Periodic background check for live classes, ended classes, and deadline reminders with zero redundant notifications
  useEffect(() => {
    if (!currentUser) return;

    const runChecks = () => {
      const now = new Date();
      const WEEKDAY_NAMES: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = WEEKDAY_NAMES[now.getDay()];
      
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayDateStr = `${yyyy}-${mm}-${dd}`;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // 1. Check for Live Classes and Ended Classes
      activities.forEach((act) => {
        // Must match either today's specific date or today's repeating weekday
        const isToday = act.date ? (act.date === todayDateStr) : (act.day === currentDayName);
        if (!isToday) return;

        const [startH, startM] = act.timeStart.split(':').map(Number);
        const [endH, endM] = act.timeEnd.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        const liveNotifId = `live-${act.id}-${todayDateStr}`;
        const endedNotifId = `ended-${act.id}-${todayDateStr}`;

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          // Class is currently live standard
          const alreadyNotifiedLive = notifications.some(n => n.id === liveNotifId);
          if (!alreadyNotifiedLive) {
            const notif: NotificationItem = {
              id: liveNotifId,
              type: 'schedule',
              title: `Live Class Activated! 🟢`,
              body: `"${act.courseCode}: ${act.title}" is currently live and active in ${act.location}!`,
              time: 'Just now',
              isRead: false,
              priority: 'high',
              referenceTab: 'schedule',
              departmentId: matchedDepartment?.id
            };
            setNotifications(prev => [notif, ...prev]);
          }
        } else if (currentMinutes >= endMinutes) {
          // Class has ended
          const alreadyNotifiedEnded = notifications.some(n => n.id === endedNotifId);
          const wasNotifiedLive = notifications.some(n => n.id === liveNotifId);
          
          if (!alreadyNotifiedEnded && wasNotifiedLive) {
            const notif: NotificationItem = {
              id: endedNotifId,
              type: 'schedule',
              title: `Class Ended 🛑`,
              body: `"${act.courseCode}: ${act.title}" session has officially finished.`,
              time: 'Just now',
              isRead: false,
              priority: 'info',
              referenceTab: 'schedule',
              departmentId: matchedDepartment?.id
            };
            setNotifications(prev => [notif, ...prev]);
          }
        }
      });

      // 2. Check for Near Deadline Reminders
      deadlines.forEach((dl) => {
        // Skip if marked complete by current user
        const isCompleted = dl.completedBy ? !!dl.completedBy[currentUser.matricNumber] : dl.isCompleted;
        if (isCompleted) return;

        const dueTime = new Date(dl.dueDate).getTime();
        const todayTime = new Date(todayDateStr).getTime();
        const diffMs = dueTime - todayTime;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays <= 3) {
          const reminderId = `reminder-${dl.id}-${todayDateStr}-${diffDays}`;
          const alreadyReminded = notifications.some(n => n.id === reminderId);
          if (!alreadyReminded) {
            const notif: NotificationItem = {
              id: reminderId,
              type: 'deadline',
              title: `Upcoming Deadline Notice ⏰`,
              body: `Reminder: "${dl.courseCode}: ${dl.title}" is due in ${diffDays} ${diffDays === 1 ? 'day' : 'days'} (${dl.dueDate}).`,
              time: 'Just now',
              isRead: false,
              priority: 'high',
              referenceTab: 'deadlines',
              departmentId: matchedDepartment?.id
            };
            setNotifications(prev => [notif, ...prev]);
          }
        }
      });
    };

    // Run first check immediately
    runChecks();

    const interval = setInterval(runChecks, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser, activities, deadlines, notifications]);

  // UI state managers
  const [activeTab, setActiveTab] = useState<any>('schedule');

  const unseenAnnouncementsCount = useMemo(() => {
    if (!currentUser) return 0;
    const currentSeen = currentUser.seenBroadcasts || [];
    return visibleAnnouncements.filter(ann => !currentSeen.includes(ann.id)).length;
  }, [visibleAnnouncements, currentUser]);

  const markAnnouncementsAsSeen = async () => {
    if (!currentUser || !visibleAnnouncements.length) return;
    const currentSeen = currentUser.seenBroadcasts || [];
    const newSeenIds = visibleAnnouncements.map(ann => ann.id);
    const hasUnseen = newSeenIds.some(id => !currentSeen.includes(id));
    
    if (hasUnseen) {
      const updatedSeen = Array.from(new Set([...currentSeen, ...newSeenIds]));
      
      const updatedUser = {
        ...currentUser,
        seenBroadcasts: updatedSeen
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('ich100l_user', JSON.stringify(updatedUser));
      
      try {
        const docRef = doc(db, 'users', getSafeDocId(currentUser.matricNumber || ''));
        await setDoc(docRef, { seenBroadcasts: updatedSeen }, { merge: true });
        console.log('[Seen] Announcements marked as seen in backend successfully.');
      } catch (err) {
        console.error('Failed to mark announcements as seen in backend:', err);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'announcements') {
      markAnnouncementsAsSeen();
    }
  }, [activeTab, visibleAnnouncements, currentUser]);

  // Automatically clear unread notifications when relevant tab is selected by user
  useEffect(() => {
    if (activeTab === 'deadlines') {
      setNotifications(prev => {
        const hasUnread = prev.some(n => n.type === 'deadline' && !n.isRead);
        if (!hasUnread) return prev;
        return prev.map(n => n.type === 'deadline' ? { ...n, isRead: true } : n);
      });
    } else if (activeTab === 'announcements') {
      setNotifications(prev => {
        const hasUnread = prev.some(n => n.type === 'announcement' && !n.isRead);
        if (!hasUnread) return prev;
        return prev.map(n => n.type === 'announcement' ? { ...n, isRead: true } : n);
      });
    }
  }, [activeTab]);
  const [daySelected, setDaySelected] = useState<DayOfWeek>(() => {
    const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [addingOrEditing, setAddingOrEditing] = useState<{
    type: 'schedule' | 'deadline' | 'announcement';
    editActivity?: Activity | null;
  } | null>(null);

  // In-App Popup notification banner state
  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    body: string;
    type: string;
  } | null>(null);

  // Programmatically synthesizes an elegant double marimba-like chime for real-time notification arrivals
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = ctx.currentTime;
      // High-fidelity standard App notice double chord chime: E5 followed instantly by A5
      playTone(659.25, now, 0.45);
      playTone(880.00, now + 0.11, 0.55);
    } catch (e) {
      console.warn('Audio synthesis deferred:', e);
    }
  };

  // Auto-dismiss the active sliding popup banner after a few seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const lastNotificationsCountRef = useRef(notifications.length);

  // Sync to localStorage on updates and trigger native lockscreen popups (compatible with standard browsers, Android, and iOS PWA)
  useEffect(() => {
    localStorage.setItem('ich100l_notifications', JSON.stringify(notifications));

    // Only fire alerts if we have a NEW notification (to prevent spam on initial load)
    if (notifications.length > lastNotificationsCountRef.current) {
      const latestNotif = notifications[0];
      if (latestNotif && !latestNotif.isRead) {
        // 1. Trigger the premium, high-fidelity in-app sliding banner
        setActiveToast({
          id: latestNotif.id,
          title: latestNotif.title,
          body: latestNotif.body,
          type: latestNotif.type || 'info'
        });

        // 2. Trigger actual device/native popup notification on iOS and Android devices if permission is granted
        const title = latestNotif.title;
        const options = {
          body: latestNotif.body,
          icon: '/logo-192.png',
          badge: '/logo-192.png',
          tag: latestNotif.id || 'ich-alert',
          data: {
            url: window.location.origin + '/'
          }
        };

        if ('Notification' in window && Notification.permission === 'granted') {
          // Trigger actual device/native system popup notification in any position (foreground or background)
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
              .then(async (reg) => {
                try {
                  await reg.showNotification(title, options);
                  console.log('[AppClient] Successfully served native PWA popup notification on device.');
                } catch (notifErr) {
                  console.warn('[AppClient] SW showNotification failed, using fallback standard Notification API:', notifErr);
                  try {
                    new Notification(title, options);
                  } catch (e) {}
                }
              })
              .catch(() => {
                try {
                  new Notification(title, options);
                } catch (e) {}
              });
          } else {
            try {
              new Notification(title, options);
            } catch (e) {}
          }
        }

        // 2. Play the synthesized mobile notice double chime
        playNotificationSound();

        // 3. Trigger native mobile vibration for tactical feedback on Android
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([80, 50, 80]);
          } catch (vibErr) {}
        }
      }
    }
    lastNotificationsCountRef.current = notifications.length;

    // Sync Home Screen App Badge (iOS Safari and Android compatible Badging API)
    if ('setAppBadge' in navigator) {
      const activeUnreadCount = notifications.filter((notif) => !notif.isRead).length;
      if (activeUnreadCount > 0) {
        navigator.setAppBadge(activeUnreadCount).catch((err) => {
          console.warn('[PWA Client] Failed to set launcher badge count:', err);
        });
      } else {
        navigator.clearAppBadge().catch((err) => {
          console.warn('[PWA Client] Failed to clear launcher badge count:', err);
        });
      }
    }
  }, [notifications]);

  // Sync to localStorage on updates
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ich100l_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ich100l_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('ich100l_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('ich100l_deadlines', JSON.stringify(deadlines));
  }, [deadlines]);

  useEffect(() => {
    localStorage.setItem('ich105l_announcements', JSON.stringify(announcements));
    localStorage.setItem('ich100l_announcements', JSON.stringify(announcements));
  }, [announcements]);

  const isCourseRep = currentUser?.isCourseRep === true;

  const visiblePendingDeadlinesCount = useMemo(() => {
    if (!currentUser) return 0;
    return visibleDeadlines.filter((dl) => {
      const isCompleted = dl.completedBy ? !!dl.completedBy[currentUser.matricNumber] : dl.isCompleted;
      return !isCompleted;
    }).length;
  }, [visibleDeadlines, currentUser]);

  // Sign out handler
  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('schedule');
  };

  // Reset database back to syllabus default starter set in Firestore
  const handleResetData = async () => {
    try {
      // 1. Reset Activities (Empty everything without seeding defaults)
      const actSnap = await getDocs(collection(db, 'activities'));
      for (const d of actSnap.docs) {
        await deleteDoc(doc(db, 'activities', d.id));
      }

      // 2. Reset Deadlines
      const dlSnap = await getDocs(collection(db, 'deadlines'));
      for (const d of dlSnap.docs) {
        await deleteDoc(doc(db, 'deadlines', d.id));
      }
      for (const dl of DEFAULT_DEADLINES) {
        await setDoc(doc(db, 'deadlines', dl.id), cleanData(dl));
      }

      // 3. Reset Announcements
      const annSnap = await getDocs(collection(db, 'announcements'));
      for (const d of annSnap.docs) {
        await deleteDoc(doc(db, 'announcements', d.id));
      }
      for (const ann of DEFAULT_ANNOUNCEMENTS) {
        await setDoc(doc(db, 'announcements', ann.id), cleanData(ann));
      }

      setDaySelected('Monday');
      setActiveTab('schedule');
    } catch (err) {
      console.error('Failed to reset Firestore databases:', err);
    }
  };

  // Activity management actions
  const handleAddActivity = async (newAct: Omit<Activity, 'id' | 'createdBy'> & { departmentId?: string }) => {
    const actId = `act-custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const act: Activity = {
      ...newAct,
      id: actId,
      createdBy: currentUser?.matricNumber || 'Rep'
    } as any;
    try {
      await setDoc(doc(db, 'activities', actId), cleanData(act));
    } catch (err) {
      console.error('Error saving activity:', err);
    }
    setActivities((prev) => {
      if (prev.some((a) => a.id === act.id)) return prev;
      return [...prev, act];
    });

    const notif: NotificationItem = {
      id: `notif-act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'schedule',
      title: 'New Class Scheduled 📅',
      body: `${act.courseCode}: ${act.title} is now scheduled on ${act.day} from ${act.timeStart} to ${act.timeEnd}.`,
      time: 'Just now',
      isRead: false,
      priority: 'info',
      referenceTab: 'schedule',
      departmentId: act.departmentId || matchedDepartment?.id
    };
    setNotifications((prev) => [notif, ...prev]);

    // Async push alert with departmentId constraint
    triggerPushNotification(notif.title, notif.body, 'schedule', act.departmentId);
  };

  const handleUpdateActivity = async (id: string, updatedAct: Omit<Activity, 'id' | 'createdBy'> & { departmentId?: string }) => {
    try {
      const docRef = doc(db, 'activities', id);
      await setDoc(docRef, cleanData({ ...updatedAct, id, createdBy: currentUser?.matricNumber || 'Rep' }), { merge: true });
    } catch (err) {
      console.error('Error updating activity:', err);
    }
    setActivities((prev) =>
      prev.map((act) => (act.id === id ? { ...act, ...updatedAct } : act))
    );
  };

  const handleDeleteActivity = async (id: string) => {
    const actToDelete = activities.find((a) => a.id === id);
    if (actToDelete) {
      registerDeletedActivityLocally(actToDelete);
    }
    try {
      await deleteDoc(doc(db, 'activities', id));
    } catch (err) {
      console.error('Error deleting activity:', err);
    }
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  // Deadline management actions
  const handleToggleDeadline = async (id: string) => {
    const target = deadlines.find((d) => d.id === id);
    if (target && currentUser) {
      const userMatric = currentUser.matricNumber;
      const completedBy = target.completedBy || {};
      const currentCompleted = completedBy[userMatric] ?? target.isCompleted;
      const nextCompleted = !currentCompleted;
      
      const newCompletedBy = { ...completedBy, [userMatric]: nextCompleted };
      try {
        await setDoc(doc(db, 'deadlines', id), { completedBy: newCompletedBy }, { merge: true });
      } catch (err) {
        console.error('Error toggling deadline:', err);
      }
      setDeadlines((prev) =>
        prev.map((d) => (d.id === id ? { ...d, completedBy: newCompletedBy } : d))
      );
    }
  };

  const handleAddDeadline = async (newDl: Omit<Deadline, 'id' | 'isCompleted' | 'createdBy'> & { departmentId?: string }) => {
    const dlId = `dl-custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const dl: Deadline = {
      ...newDl,
      id: dlId,
      isCompleted: false,
      createdBy: currentUser?.matricNumber || 'Rep'
    };
    try {
      await setDoc(doc(db, 'deadlines', dlId), cleanData(dl));
    } catch (err) {
      console.error('Error adding deadline:', err);
    }
    setDeadlines((prev) => {
      if (prev.some((d) => d.id === dl.id)) return prev;
      return [dl, ...prev];
    });

    const notif: NotificationItem = {
      id: `notif-dl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'deadline',
      title: `Assignment Published: ${dl.courseCode} 📣`,
      body: `New deadline posted: "${dl.title}". Due date set for ${dl.dueDate}.`,
      time: 'Just now',
      isRead: false,
      priority: 'high',
      referenceTab: 'deadlines',
      departmentId: dl.departmentId || matchedDepartment?.id
    };
    setNotifications((prev) => [notif, ...prev]);

    // Async push alert with department restriction
    triggerPushNotification(notif.title, notif.body, 'deadlines', dl.departmentId);
  };

  const handleDeleteDeadline = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'deadlines', id));
    } catch (err) {
      console.error('Error deleting deadline:', err);
    }
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
  };

  // Announcement management actions
  const handleAddAnnouncement = async (newAnn: Omit<Announcement, 'id' | 'date' | 'author'> & { departmentId?: string }) => {
    const today = new Date();
    const dateFormatted = today.toISOString().split('T')[0];
    const annId = `ann-custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ann: Announcement = {
      ...newAnn,
      id: annId,
      date: dateFormatted,
      author: currentUser?.name ? `${currentUser.name} (Rep)` : 'Course Rep'
    };
    try {
      await setDoc(doc(db, 'announcements', annId), cleanData(ann));
    } catch (err) {
      console.error('Error adding announcement:', err);
    }
    setAnnouncements((prev) => {
      if (prev.some((a) => a.id === ann.id)) return prev;
      return [ann, ...prev];
    });

    const notif: NotificationItem = {
      id: `notif-ann-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'announcement',
      title: `Urgent Course Broadcaster 🚨`,
      body: `"${ann.title}": ${ann.content.substring(0, 70)}${ann.content.length > 70 ? '...' : ''}`,
      time: 'Just now',
      isRead: false,
      priority: ann.priority,
      referenceTab: 'announcements',
      departmentId: ann.departmentId || matchedDepartment?.id
    };
    setNotifications((prev) => [notif, ...prev]);

    // Async push alert with department constraint
    triggerPushNotification(notif.title, notif.body, 'announcements', ann.departmentId);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      console.error('Error deleting announcement:', err);
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  // View Router mapping
  const renderTabContent = () => {
    // If subscription is loading, show a neat themed loading element on restricted tabs
    if (subStatus === 'loading' && activeTab !== 'profile') {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-sans">Checking student billing registry...</p>
        </div>
      );
    }

    // Paywall blocks access to schedule, deadlines, announcements, and modules
    const isRestrictedTab = ['schedule', 'deadlines', 'announcements', 'modules', 'calendar'].includes(activeTab);
    if (subStatus === 'inactive' && isRestrictedTab) {
      return (
        <SubscriptionPaywall 
          user={{
            email: currentUser?.email || 'student@ich100l.edu',
            matricNumber: currentUser?.matricNumber || '',
            name: currentUser?.name || 'Chemistry Student',
            createdAt: currentUser?.createdAt
          }}
          subStatus={subStatus}
          isCourseRep={isCourseRep}
          subscriptionDetails={subscriptionDetails}
          semesterConfig={semesterConfig}
          onSuccessVerification={() => {
            // Hot trigger reload
            handleUpdateSubStatus();
          }}
        />
      );
    }

    switch (activeTab) {
      case 'subscription':
        return (
          <SubscriptionPaywall
            user={{
              email: currentUser?.email || 'student@ich100l.edu',
              matricNumber: currentUser?.matricNumber || '',
              name: currentUser?.name || 'Chemistry Student',
              createdAt: currentUser?.createdAt
            }}
            subStatus={subStatus}
            isCourseRep={isCourseRep}
            subscriptionDetails={subscriptionDetails}
            semesterConfig={semesterConfig}
            onSuccessVerification={() => {
              handleUpdateSubStatus();
            }}
          />
        );
      case 'modules':
        return (
          <ModulesView
            isCourseRep={isCourseRep}
            userMatric={currentUser?.matricNumber || ''}
            matchedDepartment={matchedDepartment}
            departments={departments}
          />
        );
      case 'schedule':
        return (
          <Scheduler
            activities={visibleActivities}
            currentUserMatric={currentUser?.matricNumber || ''}
            isCourseRep={isCourseRep}
            onDeleteActivity={handleDeleteActivity}
            onEditActivity={(act) => setAddingOrEditing({ type: 'schedule', editActivity: act })}
            daySelected={daySelected}
            setDaySelected={setDaySelected}
            onOpenCalendar={() => setActiveTab('calendar' as any)}
            appTitle={appTitle}
          />
        );
      case 'calendar' as any:
        return (
          <CalendarView
            activities={visibleActivities}
            currentUserMatric={currentUser?.matricNumber || ''}
            onBack={() => setActiveTab('schedule')}
            onSelectDate={(date) => {
              setSelectedCalendarDate(date);
              setActiveTab('date-schedule');
            }}
          />
        );
      case 'date-schedule':
        return (
          <DateScheduleView
            selectedDate={selectedCalendarDate || new Date()}
            activities={visibleActivities}
            isCourseRep={isCourseRep}
            onBackToCalendar={() => {
              setActiveTab('calendar' as any);
            }}
            onEditActivity={(act) => {
              setAddingOrEditing({ type: 'schedule', editActivity: act });
            }}
            onDeleteActivity={handleDeleteActivity}
            onAddActivityClick={() => {
              setAddingOrEditing({ type: 'schedule', editActivity: null });
            }}
          />
        );
      case 'deadlines':
        return (
          <Deadlines
            deadlines={visibleDeadlines}
            isCourseRep={isCourseRep}
            currentUserMatric={currentUser?.matricNumber || ''}
            onToggleComplete={handleToggleDeadline}
            onDeleteDeadline={handleDeleteDeadline}
          />
        );
      case 'announcements':
        return (
          <Announcements
            announcements={visibleAnnouncements}
            isCourseRep={isCourseRep}
            onDeleteAnnouncement={handleDeleteAnnouncement}
          />
        );
      case 'profile':
        return (
          <ProfileView
            user={{
              email: currentUser?.email || '',
              matricNumber: currentUser?.matricNumber || '',
              name: currentUser?.name || 'Student',
              createdAt: currentUser?.createdAt,
              isCourseRep: isCourseRep,
              isAdmin: currentUser?.isAdmin === true
            }}
            onLogout={handleLogout}
            onResetData={handleResetData}
            stats={{
              totalActivities: (() => {
                const now = new Date();
                const getYYYYMMDDForDay = (day: DayOfWeek) => {
                  const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day);
                  const currentDayOfWeek = now.getDay();
                  const currentMondayOffset = (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1);
                  const targetDate = new Date(now);
                  targetDate.setDate(now.getDate() - currentMondayOffset + dayIndex);
                  const yyyy = targetDate.getFullYear();
                  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                  const dd = String(targetDate.getDate()).padStart(2, '0');
                  return `${yyyy}-${mm}-${dd}`;
                };

                return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].reduce((acc, day) => {
                  const count = visibleActivities.filter(act => {
                    if (act.date) {
                      return act.date === getYYYYMMDDForDay(day as DayOfWeek);
                    }
                    return act.day === day;
                  }).length;
                  return acc + count;
                }, 0);
              })(),
              pendingDeadlines: visibleDeadlines.filter((d) => !(d.completedBy?.[currentUser?.matricNumber || ''] ?? d.isCompleted)).length,
              completedDeadlines: visibleDeadlines.filter((d) => (d.completedBy?.[currentUser?.matricNumber || ''] ?? d.isCompleted)).length,
              announcementCount: visibleAnnouncements.length
            }}
            subStatus={subStatus}
            subscriptionDetails={subscriptionDetails}
            onUpdateSubStatus={handleUpdateSubStatus}
            onChangeTab={setActiveTab}
            deferredPrompt={deferredPrompt}
            onClearDeferredPrompt={() => setDeferredPrompt(null)}
            appTitle={appTitle}
            departments={departments}
          />
        );
      case 'notifications' as any:
        return (
          <NotificationsPage
            deadlines={visibleDeadlines}
            announcements={visibleAnnouncements}
            activities={visibleActivities}
            onBack={() => setActiveTab('schedule')}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            notifications={visibleNotifications}
            isCourseRep={isCourseRep}
            onMarkAllAsRead={() => {
              setNotifications((prev) => prev.map((n) => {
                const isUserNotif = !n.departmentId || n.departmentId === matchedDepartment?.id;
                return isUserNotif ? { ...n, isRead: true } : n;
              }));
            }}
            onToggleRead={(id) => {
              setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
              );
            }}
            onClearNotifications={() => {
              setNotifications((prev) => prev.filter((n) => n.departmentId && n.departmentId !== matchedDepartment?.id));
            }}
          />
        );
      case 'feedback' as any:
        return (
          <FeedbackPage
            user={{
              email: currentUser?.email || '',
              matricNumber: currentUser?.matricNumber || '',
              name: currentUser?.name || 'Student',
              isAdmin: isCourseRep || currentUser?.isAdmin
            }}
            isAdminMode={false}
            onBack={() => setActiveTab('profile')}
          />
        );
      case 'push-config' as any:
        return (
          <PushConfigPage
            onBack={() => setActiveTab('notifications' as any)}
            isCourseRep={isCourseRep}
          />
        );
      default:
        return null;
    }
  };

  // If unauthorized, show login overlay
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={setCurrentUser} />;
  }

  // If logged in under admin parameters, bootstrap the whole new Admin Dashboard instead of the student interface
  if (currentUser.isAdmin || currentUser.matricNumber === '2026/ps/ich/0034') {
    return (
      <AdminDashboard
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (addingOrEditing) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0f172a] text-slate-100 flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-500/5 via-[#0f172a]/2 to-[#0f172a]" />
        
        {/* Prime Core Scrollable workspace container */}
        <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full px-4 pt-4 pb-12 z-10 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col"
            >
              <AddEditPage
                type={addingOrEditing.type}
                editActivity={addingOrEditing.editActivity}
                daySelected={daySelected}
                currentUserMatric={currentUser?.matricNumber || ''}
                initialDate={activeTab === 'date-schedule' && selectedCalendarDate ? `${selectedCalendarDate.getFullYear()}-${String(selectedCalendarDate.getMonth() + 1).padStart(2, '0')}-${String(selectedCalendarDate.getDate()).padStart(2, '0')}` : ''}
                onAddActivity={handleAddActivity}
                onUpdateActivity={handleUpdateActivity}
                onAddDeadline={handleAddDeadline}
                onAddAnnouncement={handleAddAnnouncement}
                onCancel={() => setAddingOrEditing(null)}
                departments={departments}
              />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0f172a] text-slate-100 flex flex-col relative">
      {/* Toast Notification Banner - Premium iOS / Android sliding push popup style */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            className="fixed top-4 left-4 right-4 max-w-sm mx-auto z-[999999] pointer-events-auto cursor-pointer"
            onClick={() => {
              setActiveTab('notifications' as any);
              setActiveToast(null);
            }}
          >
            <div className="glassmorphism p-4 rounded-2xl border border-indigo-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.65),0_0_20px_rgba(99,102,241,0.25)] bg-[#0f172a]/95 backdrop-blur-xl flex items-start gap-3.5 relative overflow-hidden group transition-all duration-300 hover:shadow-[0_12px_45px_rgba(0,0,0,0.7),0_0_25px_rgba(99,102,241,0.3)]">
              {/* Pulsing ambient accent gradient glow inside */}
              <div className="absolute inset-x-0 inset-y-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-violet-500/10 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none" />
              
              {/* Premium left side active colorful indicator pin */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 via-indigo-600 to-violet-500 rounded-l-2xl animate-pulse" />

              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5 border border-indigo-500/25 group-hover:scale-105 transition-all shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                <Bell className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pr-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-sans font-bold tracking-wider text-indigo-300 uppercase leading-none">
                    {activeToast.title}
                  </h4>
                  <span className="text-[8px] font-mono font-black text-indigo-200 bg-indigo-500/15 border border-indigo-500/20 px-2.5 py-0.5 rounded-full select-none leading-none animate-pulse">
                    Just Now
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-sans mt-1.5 leading-snug font-medium line-clamp-2">
                  {activeToast.body}
                </p>
                <div className="mt-2 text-[9px] font-mono text-indigo-400 flex items-center gap-1 font-bold group-hover:text-indigo-300 transition-colors">
                  <span>Tap to view noticeboard</span>
                  <span className="text-xs leading-none shrink-0">➔</span>
                </div>
              </div>

              {/* Absolute Close banner button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveToast(null);
                }}
                className="absolute top-3.5 right-3 w-5 h-5 rounded-full bg-slate-950/40 hover:bg-slate-950 text-slate-400 hover:text-white flex items-center justify-center p-0 cursor-pointer text-xs font-bold outline-none border-none transition-all duration-200 hover:scale-110 active:scale-95"
                title="Dismiss Notice"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual In-App Messages System Overlay */}
      <AnimatePresence>
        {activeInApp && (
          activeInApp.style === 'modal' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="relative w-full max-w-sm overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
              >
                {/* Hot vibrant accent gradient bar */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-purple-500" />
                
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400 leading-none">Important Notification</span>
                </div>

                <h3 className="text-base font-display font-black text-slate-100 mb-2 leading-tight">
                  {activeInApp.title}
                </h3>
                
                <div className="text-xs text-slate-300 font-sans leading-relaxed mb-6 whitespace-pre-wrap">
                  {activeInApp.body}
                </div>

                <div className="flex flex-col gap-2">
                  {activeInApp.btnText && activeInApp.btnLink && (
                    <button
                      onClick={() => {
                        handleDismissInApp(activeInApp.id);
                        if (activeInApp.btnLink.startsWith('http')) {
                          window.open(activeInApp.btnLink, '_blank');
                        } else {
                          setActiveTab(activeInApp.btnLink);
                        }
                      }}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold font-sans text-xs uppercase tracking-wider transition-all cursor-pointer text-center outline-none"
                    >
                      {activeInApp.btnText}
                    </button>
                  )}
                  <button
                    onClick={() => handleDismissInApp(activeInApp.id)}
                    className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer text-center outline-none"
                  >
                    Dismiss Message
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 18 }}
              className="fixed top-24 left-4 right-4 max-w-sm mx-auto z-[99999] pointer-events-auto"
            >
              <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex gap-3 text-left">
                {/* Visual left active colorful vertical pin indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-400 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[8px] font-mono font-bold uppercase tracking-wider">Manual Alert</span>
                    </div>
                    <button
                      onClick={() => handleDismissInApp(activeInApp.id)}
                      className="text-slate-500 hover:text-slate-350 cursor-pointer p-0"
                    >
                      ✕
                    </button>
                  </div>
                  <h4 className="text-xs font-bold text-slate-100 leading-tight">{activeInApp.title}</h4>
                  <p className="text-[11px] text-slate-350 leading-relaxed font-sans">{activeInApp.body}</p>
                  {activeInApp.btnText && activeInApp.btnLink && (
                    <button
                      onClick={() => {
                        handleDismissInApp(activeInApp.id);
                        if (activeInApp.btnLink.startsWith('http')) {
                          window.open(activeInApp.btnLink, '_blank');
                        } else {
                          setActiveTab(activeInApp.btnLink);
                        }
                      }}
                      className="mt-2 text-[9px] text-indigo-400 hover:text-indigo-350 font-bold uppercase tracking-wider cursor-pointer flex items-center gap-0.5"
                    >
                      <span>{activeInApp.btnText}</span>
                      <span className="text-xs font-semibold leading-none">&rarr;</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Verification Overlays */}
      {isVerifyingURL && (
        <div className="fixed inset-0 bg-slate-950/90 z-[99999] flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-xs w-full shadow-2xl">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
            <h3 className="text-slate-100 font-display font-bold text-base">Verifying payment...</h3>
            <p className="text-xs text-slate-400 font-sans">Connecting to security servers to activate your account. Please wait...</p>
          </div>
        </div>
      )}

      {verificationError && (
        <div className="fixed inset-0 bg-slate-950/90 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-xs w-full shadow-2xl">
            <div className="shrink-0 w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h3 className="text-slate-100 font-display font-bold text-base">Verification issue</h3>
            <p className="text-xs text-slate-400 font-sans">{verificationError}</p>
            <button onClick={() => setVerificationError('')} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer">
              Acknowledge & Dismiss
            </button>
          </div>
        </div>
      )}

      {verificationSuccess && (
        <div className="fixed inset-0 bg-slate-950/90 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/20 text-center space-y-4 max-w-xs w-full shadow-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-slate-100 font-display font-bold text-base">Payment Verified!</h3>
            <p className="text-xs text-emerald-300 font-sans">{verificationSuccess}</p>
            <button onClick={() => setVerificationSuccess('')} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer">
              Start Exploring Dashboard
            </button>
          </div>
        </div>
      )}

      {isEditingLogo && (
        <div className="fixed inset-0 bg-slate-950/85 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-sm w-full shadow-2xl">
            <h3 className="text-slate-100 font-display font-extrabold text-base">Change Application Logo</h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              As the registered Course Representative, you can set a custom web URL or upload a graphic file from your local storage to update the branding logo live on all screens.
            </p>

            <div className="text-left space-y-1">
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">UPLOAD IMAGE FROM DEVICE</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/40 border border-slate-800 text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-mono file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 cursor-pointer"
              />
              {isUploadingLogo && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-indigo-400">
                  <span className="animate-spin font-sans text-xs inline-block">⏳</span>
                  <span>Configuring and caching image upload...</span>
                </div>
              )}
              {logoUploadError && (
                <p className="text-[10px] text-rose-400 font-medium mt-1">⚠️ {logoUploadError}</p>
              )}
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono"><span className="bg-slate-900 px-2 text-slate-500">OR DEFINE EXTERNAL URL</span></div>
            </div>

            <div className="text-left space-y-2">
              <input
                type="text"
                value={logoInput}
                onChange={(e) => setLogoInput(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              />
              <span className="text-[9px] text-slate-500 leading-normal block">
                💡 Paste any public PNG, JPG, or web storage referrer link. To reset back to default, empty the input box.
              </span>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingLogo(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateLogo(logoInput.trim())}
                className="flex-1 py-2.5 bg-gradient-to-tr from-indigo-600 to-indigo-750 hover:from-indigo-500 hover:to-indigo-600 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Save Live Identity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time OTA App Update Dialog Block */}
      <AnimatePresence>
        {showOtaPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/85 z-[999999] flex flex-col items-center justify-center p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="glassmorphism p-6 rounded-2xl border border-indigo-500/30 max-w-sm w-full bg-slate-900/95 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(99,102,241,0.2)] text-center space-y-4 relative overflow-hidden"
            >
              {/* Internal abstract ambient glowing ring */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-500" />
              
              <div className="p-3 w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(99,102,241,0.15)] relative">
                <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>

              <div>
                <span className="text-[10px] font-mono font-black text-indigo-200 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                  v{appServerVersion} Update Available
                </span>
                <h3 className="text-slate-100 font-display font-black text-lg mt-3">Ready over-the-air!</h3>
                <p className="text-xs text-slate-400 font-sans mt-1 leading-relaxed">
                  An optimized software release package is ready for immediate deployment on your device.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/45 border border-slate-800/60 text-left space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
                <span className="text-[9px] uppercase font-mono tracking-wider font-extrabold text-indigo-400">What's New in this Build:</span>
                <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-line">
                  {appReleaseNotes}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('ich100l_client_app_version', appServerVersion);
                    setShowOtaPopup(false);
                    window.location.reload();
                  }}
                  className="w-full py-3 bg-gradient-to-tr from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 rounded-xl text-xs font-bold text-white transition-all shadow-[0_4px_16px_rgba(99,102,241,0.35)] cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <Loader2 className="w-3.5 h-3.5 text-white/80 animate-spin" />
                  Apply Update & Reload
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('ich100l_dismissed_ota_version', appServerVersion);
                    setShowOtaPopup(false);
                  }}
                  className="w-full py-2.5 bg-slate-800/50 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700/20"
                >
                  Remind Me Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic atmospheric decoration background grids */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-500/5 via-[#0f172a]/2 to-[#0f172a] pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      {/* Persistent global app header */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-900/40 p-4 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (isCourseRep) {
                  setIsEditingLogo(true);
                }
              }}
              disabled={!isCourseRep}
              className={`relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden outline-none ${
                isCourseRep 
                  ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all group bg-gradient-to-tr from-amber-500 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]' 
                  : 'bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
              }`}
              title={isCourseRep ? "Click to change App Logo" : undefined}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <GraduationCap className="w-5 h-5 text-white" />
              )}
              {isCourseRep && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[7px] text-white font-mono uppercase tracking-widest font-black">Edit</span>
                </div>
              )}
            </button>
            <div>
              {matchedDepartment ? (
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 h-5">
                    <h1 className="text-base font-sans font-bold text-slate-100 tracking-tight leading-none">
                      {((matchedDepartment.prefix || '').split('/').pop() || 'BCH').toUpperCase()}
                    </h1>
                    <span className="text-[9px] font-mono leading-none bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-400 font-extrabold pb-[2px]">
                      {(matchedDepartment.level || '100l').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[9px] font-sans text-slate-400 mt-1 block truncate max-w-[155px]" title={matchedDepartment.name}>
                    {matchedDepartment.name}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col">
                  <h1 className="text-xl font-display font-bold text-slate-100 tracking-tight leading-none font-sans">
                    {appTitle}
                  </h1>
                  <span className="text-[10px] font-mono font-medium text-slate-400">Class Board</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl animate-pulse flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>Offline</span>
              </span>
            )}
            {/* User state preview badge inside header */}
            <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/80 p-1.0 pr-3 rounded-2xl">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-sans font-bold select-none ${
                isCourseRep ? 'bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 font-black' : 'bg-gradient-to-tr from-indigo-500 to-violet-600 text-white'
              }`}>
                {getInitials(currentUser.name)}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-sans font-bold text-slate-200 truncate max-w-[65px]">
                  {currentUser.name}
                </p>
                <p className="text-[7px] font-mono text-slate-500 leading-none">
                  {isCourseRep ? 'Rep👑' : 'Student'}
                </p>
              </div>
            </div>

            {/* Bell Icon trigger in Header - far right edge */}
            <button
              onClick={() => setActiveTab('notifications' as any)}
              className={`relative p-2 rounded-xl transition-all cursor-pointer border ${
                activeTab === ('notifications' as any)
                  ? 'bg-indigo-600/35 border-indigo-500 text-white animate-none shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                  : 'bg-slate-950/40 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Notices & Inbox"
            >
              <Bell className="w-4 h-4" />
              {visibleNotifications.some(n => !n.isRead) && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-slate-950 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Prime Core Scrollable workspace container */}
      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full px-4 pt-6 pb-32 z-10 no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Course Repo Hovering floating plus trigger button */}
      {isCourseRep && ['schedule', 'deadlines', 'announcements'].includes(activeTab) && (
        <div className="fixed bottom-24 right-5 sm:right-1/2 sm:translate-x-48 z-40">
          <button
            onClick={() => {
              if (activeTab === 'schedule') {
                setAddingOrEditing({ type: 'schedule', editActivity: null });
              } else if (activeTab === 'deadlines') {
                setAddingOrEditing({ type: 'deadline' });
              } else if (activeTab === 'announcements') {
                setAddingOrEditing({ type: 'announcement' });
              }
            }}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white flex items-center justify-center p-0 transition-transform hover:scale-110 active:scale-95 shadow-[0_8px_32px_rgba(99,102,241,0.5)] cursor-pointer outline-none relative group"
            title={`Add item to ${activeTab === 'schedule' ? 'Schedules' : activeTab === 'deadlines' ? 'Deadlines' : 'Announcements'}`}
          >
            {/* Ambient dynamic pulse rings around button */}
            <span className="absolute inset-x-0 inset-y-0 rounded-full bg-indigo-500/30 animate-ping group-hover:block" />
            <Plus className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Global Interactive Bottom Menu bar */}
      <BottomNav
        currentTab={activeTab}
        onChangeTab={setActiveTab}
        isCourseRep={isCourseRep}
        deadlinesBadge={visiblePendingDeadlinesCount}
        broadcastsBadge={unseenAnnouncementsCount}
      />
    </div>
  );
}
