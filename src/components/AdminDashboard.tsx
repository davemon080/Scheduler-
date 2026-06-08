/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, KeyRound, 
  Trash2, Search, Loader2, LogOut, RefreshCw, Sparkles, Check, AlertTriangle, 
  GraduationCap, Mail, Calendar, CheckCircle, Info, Plus, Settings, LayoutDashboard,
  Ban, MessageSquare, Database, Edit3, Play, Square, Smartphone,
  Coins, CreditCard, TrendingUp, Activity, BarChart2, MessageCircle
} from 'lucide-react';
import GlassCard from './GlassCard';
import FeedbackPage from './FeedbackPage';
import CourseRepLogsView from './CourseRepLogsView';
import { db, getSafeDocId, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface AdminDashboardProps {
  currentUser: any;
  onLogout: () => void;
}

export default function AdminDashboard({
  currentUser,
  onLogout
}: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('all');
  const [semesterConfig, setSemesterConfig] = useState<{
    semesterActive: boolean;
    semesterStartedAt: string | null;
    amount: number;
  }>({
    semesterActive: true,
    semesterStartedAt: null,
    amount: 1000
  });
  const [isUpdatingSemester, setIsUpdatingSemester] = useState(false);
  const [chatConfig, setChatConfig] = useState<{
    enabled: boolean;
    visibility: 'paid' | 'all';
  }>({
    enabled: false,
    visibility: 'paid'
  });
  const [isUpdatingChat, setIsUpdatingChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // States for user subscriptions status
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  const [isGrantingSub, setIsGrantingSub] = useState<string | null>(null);
  const [isRevokingSub, setIsRevokingSub] = useState<string | null>(null);

  // Bottom navigation state
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'settings' | 'feedback' | 'departments' | 'traffic_payments' | 'messages' | 'rep_activities'>('dashboard');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [unreadFeedbacksCount, setUnreadFeedbacksCount] = useState(0);

  // New payments and traffic analytics states
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [trafficList, setTrafficList] = useState<any[]>([]);

  // Departments management state variables
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptName, setDeptName] = useState('');
  const [deptPrefix, setDeptPrefix] = useState('');
  const [deptCourseRepMatric, setDeptCourseRepMatric] = useState('');
  const [deptLevel, setDeptLevel] = useState('100l');
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  // OTA Release states
  const [appVersionConfig, setAppVersionConfig] = useState<{
    latestVersion: string;
    releaseNotes: string;
  }>({
    latestVersion: '1.2.0',
    releaseNotes: ''
  });
  const [newVersionInput, setNewVersionInput] = useState('');
  const [newReleaseNotesInput, setNewReleaseNotesInput] = useState('');
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [versionPubSuccess, setVersionPubSuccess] = useState('');
  const [versionPubError, setVersionPubError] = useState('');
  const [isSendingPushUpdate, setIsSendingPushUpdate] = useState(false);
  const [pushUpdateSuccess, setPushUpdateSuccess] = useState('');
  const [pushUpdateError, setPushUpdateError] = useState('');

  // Password reset/management states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // New user form state
  const [newMatric, setNewMatric] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newUserLevel, setNewUserLevel] = useState('100l');
  const [newUserDeptId, setNewUserDeptId] = useState('dept-ps-ich');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Course Rep logs state
  const [courseRepLogs, setCourseRepLogs] = useState<any[]>([]);

  // User edit modal states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMatric, setEditMatric] = useState('');
  const [editUserLevel, setEditUserLevel] = useState('100l');
  const [editUserDeptId, setEditUserDeptId] = useState('dept-ps-ich');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');
  const [selectedAccessFilter, setSelectedAccessFilter] = useState<'all' | 'paid' | 'admin-granted' | 'expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editFormError, setEditFormError] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Reset pagination to first page whenever filtering conditions are changed
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRegisterId, selectedLevelFilter, selectedAccessFilter]);

  // Action feedback states
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);

  // In-App Message States & Handlers
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgStyle, setMsgStyle] = useState<'modal' | 'banner'>('modal');
  const [msgTarget, setMsgTarget] = useState('all');
  const [msgBtnText, setMsgBtnText] = useState('');
  const [msgBtnLink, setMsgBtnLink] = useState('');
  const [msgError, setMsgError] = useState('');
  const [msgSuccess, setMsgSuccess] = useState('');
  const [isPublishingMsg, setIsPublishingMsg] = useState(false);
  const [localInApps, setLocalInApps] = useState<any[]>([]);

  // Load and manage in-app messages in Firestore
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'in_app_messages'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setLocalInApps(list);
    }, (error) => {
      console.warn('[AdminDashboard] Firestore in_app_messages subscribe failed:', error);
    });
    return () => unsub();
  }, []);

  const handlePublishInAppMsg = async () => {
    if (!msgTitle.trim() || !msgBody.trim()) return;
    setMsgError('');
    setMsgSuccess('');
    setIsPublishingMsg(true);
    try {
      const newMsg = {
        title: msgTitle.trim(),
        body: msgBody.trim(),
        style: msgStyle,
        targetDepartmentId: msgTarget,
        btnText: msgBtnText.trim() || null,
        btnLink: msgBtnLink || null,
        active: true,
        createdAt: new Date().toISOString()
      };
      const msgId = `inapp-${Date.now()}`;
      if (db) {
        await setDoc(doc(db, 'in_app_messages', msgId), newMsg);
      }
      setMsgTitle('');
      setMsgBody('');
      setMsgBtnText('');
      setMsgBtnLink('');
      setMsgSuccess('Successfully published manual in-app message overlay!');
    } catch (err: any) {
      console.error(err);
      setMsgError(err.message || 'Firestore write failure.');
    } finally {
      setIsPublishingMsg(false);
    }
  };

  const handleToggleInAppMsgActive = async (id: string, currentActive: boolean) => {
    try {
      if (db) {
        await setDoc(doc(db, 'in_app_messages', id), { active: !currentActive }, { merge: true });
      }
    } catch (err) {
      console.error('Failed toggling state:', err);
    }
  };

  const handleDeleteInAppMsg = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'in_app_messages', id));
      }
    } catch (err) {
      console.error('Failed deleting message:', err);
    }
  };

  // Database stats state
  const [dbStats, setDbStats] = useState({
    usersCount: 0,
    subsCount: 0,
    activitiesCount: 0,
    deadlinesCount: 0,
    announcementsCount: 0,
    feedbacksCount: 0,
    loading: true
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    setActionFeedback(null);
    try {
      // 1. Fetch from Firestore online if possible
      let fetchedUsers: any[] = [];
      let fetchedSubs: Record<string, any> = {};
      let actCount = 0;
      let dlCount = 0;
      let annCount = 0;
      let fbCount = 0;

      if (db) {
        try {
          const userSnap = await getDocs(collection(db, 'users'));
          fetchedUsers = userSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (dbErr) {
          console.warn('[Admin] Failed online users fetch, pulling cached list:', dbErr);
        }

        try {
          const subSnap = await getDocs(collection(db, 'subscriptions'));
          subSnap.docs.forEach(docSnap => {
            fetchedSubs[docSnap.id] = docSnap.data();
          });
        } catch (subErr) {
          console.warn('[Admin] Failed online subscriptions fetch:', subErr);
        }

        // Fetch counts for database storage calculation
        try {
          const actSnap = await getDocs(collection(db, 'activities'));
          actCount = actSnap.size;
        } catch (_) {}
        try {
          const dlSnap = await getDocs(collection(db, 'deadlines'));
          dlCount = dlSnap.size;
        } catch (_) {}
        try {
          const annSnap = await getDocs(collection(db, 'announcements'));
          annCount = annSnap.size;
        } catch (_) {}
        try {
          const fbSnap = await getDocs(collection(db, 'feedbacks'));
          fbCount = fbSnap.size;
        } catch (_) {}

        // Fetch payments list
        try {
          const paymentsSnap = await getDocs(collection(db, 'payments'));
          const fetchedPaymentsList = paymentsSnap.docs
            .map(doc => ({
              id: doc.id,
              ...(doc.data() as any)
            }))
            .filter(p => p.status !== 'cancelled' && p.email !== 'kujejamessamuel@gmail.com' && p.matricNumber !== '2025/PS/ICH/0113');
          setPaymentsList(fetchedPaymentsList);
        } catch (payErr) {
          console.warn('[Admin] Failed online payments fetch:', payErr);
        }

        // Fetch app traffic list
        try {
          const trafficSnap = await getDocs(collection(db, 'traffic'));
          const fetchedTrafficList = trafficSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTrafficList(fetchedTrafficList);
        } catch (trafficErr) {
          console.warn('[Admin] Failed online traffic fetch:', trafficErr);
        }
      }

      // Update DB stats state
      setDbStats({
        usersCount: fetchedUsers.length || (localStorage.getItem('ich100l_users_db') ? Object.keys(JSON.parse(localStorage.getItem('ich100l_users_db') || '{}')).length : 0),
        subsCount: Object.keys(fetchedSubs).length || (localStorage.getItem('ich100l_subscriptions_db') ? Object.keys(JSON.parse(localStorage.getItem('ich100l_subscriptions_db') || '{}')).length : 0),
        activitiesCount: actCount || (localStorage.getItem('ich100l_activities') ? JSON.parse(localStorage.getItem('ich100l_activities') || '[]').length : 0),
        deadlinesCount: dlCount || (localStorage.getItem('ich100l_deadlines') ? JSON.parse(localStorage.getItem('ich100l_deadlines') || '[]').length : 0),
        announcementsCount: annCount || (localStorage.getItem('ich100l_announcements') ? JSON.parse(localStorage.getItem('ich100l_announcements') || '[]').length : 0),
        feedbacksCount: fbCount,
        loading: false
      });

      // Merge local storage cached subscriptions (in case offline)
      const localSubsStr = localStorage.getItem('ich100l_subscriptions_db');
      const localSubs = localSubsStr ? JSON.parse(localSubsStr) : {};
      
      const mergedSubs = { ...localSubs, ...fetchedSubs };
      setSubscriptions(mergedSubs);
      localStorage.setItem('ich100l_subscriptions_db', JSON.stringify(mergedSubs));

      // 2. Fetch cache if online database empty or unreachable
      const localDBStr = localStorage.getItem('ich100l_users_db');
      const localUsers = localDBStr ? JSON.parse(localDBStr) : {};
      
      // Merge Firestore and LocalStorage
      const mergedMap = new Map<string, any>();
      
      // Insert cached users first
      Object.entries(localUsers).forEach(([matric, data]: [string, any]) => {
        const mat = data.matricNumber || data.matric || matric;
        const nameVal = data.name || data.displayName || 'No Name';
        mergedMap.set(mat, {
          ...data,
          matricNumber: mat,
          matric: mat,
          name: nameVal,
          displayName: nameVal
        });
      });

      // Overlay online users as source of truth
      fetchedUsers.forEach(user => {
        const mat = user.matricNumber || user.matric;
        if (mat) {
          const nameVal = user.name || user.displayName || 'No Name';
          mergedMap.set(mat, {
            ...user,
            matricNumber: mat,
            matric: mat,
            name: nameVal,
            displayName: nameVal
          });
        }
      });

      const finalUsers = Array.from(mergedMap.values());
      
      // Sort: Admins and Course Reps first, then newest registered
      finalUsers.sort((a, b) => {
        const scoreA = (a.isAdmin ? 10 : 0) + (a.isCourseRep ? 5 : 0);
        const scoreB = (b.isAdmin ? 10 : 0) + (b.isCourseRep ? 5 : 0);
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      setUsers(finalUsers);

      // Re-sync local users DB state with merged state
      const newLocalDB: Record<string, any> = {};
      finalUsers.forEach(u => {
        newLocalDB[u.matricNumber] = u;
      });
      localStorage.setItem('ich100l_users_db', JSON.stringify(newLocalDB));

    } catch (err: any) {
      console.error('[Admin] Fetch error:', err);
      setActionFeedback({
        type: 'error',
        message: 'Could not fetch the registered users registry.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUserStatus = (user: any) => {
    const isCurrentAdmin = (user.matricNumber || '').trim().toLowerCase() === '2026/ps/ich/0034';
    const isUserRep = user.isCourseRep === true;
    
    if (isCurrentAdmin) {
      return {
        type: 'admin',
        label: 'System Admin',
        hasAccess: true,
        badgeClass: 'bg-rose-500/10 text-rose-455 border-rose-500/20',
        expiryText: 'Lifetime Access'
      };
    }
    
    if (isUserRep) {
      return {
        type: 'rep',
        label: 'Course Representative',
        hasAccess: true,
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        expiryText: 'Exempt (Lifetime Access)'
      };
    }

    // Highly resilient case-insensitive and format-insensitive lookup
    const cleanUserMatric = (user.matricNumber || '').trim().toLowerCase().replace(/[\/-]/g, '');
    const matchedSubKey = Object.keys(subscriptions).find(key => {
      const cleanKey = key.trim().toLowerCase().replace(/[\/-]/g, '');
      return cleanKey === cleanUserMatric;
    });
    const sub = matchedSubKey ? subscriptions[matchedSubKey] : null;
    const now = new Date().toISOString();
    
    // Check if subscription exists and is active
    if (sub) {
      const isExpiryValid = sub.expiryDate && (
        sub.expiryDate === 'Current Semester' || 
        sub.expiryDate > now
      );
      const isStatusActive = sub.status === 'active';
      
      if (isStatusActive || isExpiryValid) {
        const isAdminGranted = sub.reference === 'ADMIN-GRANTED' || sub.adminGranted === true;
        if (isAdminGranted) {
          return {
            type: 'admin-granted',
            label: 'Ad-Free (Admin Granted)',
            hasAccess: true,
            badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
            expiryText: sub.expiryDate === 'Current Semester' ? 'Semester Pass' : `Expires ${new Date(sub.expiryDate).toLocaleDateString()}`,
            isAdminGranted: true
          };
        }
        return {
          type: 'paid',
          label: 'Ad-Free (Paid)',
          hasAccess: true,
          badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15',
          expiryText: sub.expiryDate === 'Current Semester' ? 'Semester Pass' : `Expires ${new Date(sub.expiryDate).toLocaleDateString()}`,
          isAdminGranted: false
        };
      }
    }
    
    return {
      type: 'expired',
      label: 'Inactive',
      hasAccess: false,
      badgeClass: 'bg-slate-550/10 text-slate-400 border-slate-800/60',
      expiryText: 'No active pass'
    };
  };

  const handleGrantFreeAccess = async (targetUser: any) => {
    setIsGrantingSub(targetUser.matricNumber);
    try {
      const safeId = getSafeDocId(targetUser.matricNumber);
      const subData = {
        status: 'active',
        matricNumber: targetUser.matricNumber,
        email: targetUser.email || `${targetUser.matricNumber.replace(/\//g, '_')}@ich100l.edu`,
        name: targetUser.name,
        expiryDate: 'Current Semester',
        lastPaymentDate: new Date().toISOString(),
        reference: 'ADMIN-GRANTED',
        adminGranted: true
      };

      // 1. Write to Firestore online
      if (db) {
        try {
          await setDoc(doc(db, 'subscriptions', safeId), subData);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.UPDATE, `subscriptions/${safeId}`);
        }
      }

      // 2. Write to local storage unified subscriptions list
      const stored = localStorage.getItem('ich100l_subscriptions_db');
      const localSubs = stored ? JSON.parse(stored) : {};
      localSubs[safeId] = subData;
      localStorage.setItem('ich100l_subscriptions_db', JSON.stringify(localSubs));

      // Also set the specific subscriber key that App.tsx reads, for convenience if they are logged in on this client browser
      localStorage.setItem(`ich100l_sub_${targetUser.matricNumber}`, JSON.stringify(subData));

      // Refresh subscriptions state
      setSubscriptions(prev => ({
        ...prev,
        [safeId]: subData
      }));

      setActionFeedback({
        type: 'success',
        message: `Successfully granted Semester-long free access to ${targetUser.name}! ⚡`
      });

    } catch (err) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: `Could not grant free access to ${targetUser.name}.`
      });
    } finally {
      setIsGrantingSub(null);
    }
  };

  const handleRevokeFreeAccess = async (targetUser: any) => {
    setIsRevokingSub(targetUser.matricNumber);
    try {
      const safeId = getSafeDocId(targetUser.matricNumber);

      // 1. Delete from Firestore online
      if (db) {
        try {
          await deleteDoc(doc(db, 'subscriptions', safeId));
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.DELETE, `subscriptions/${safeId}`);
        }
      }

      // 2. Delete from local storage unified subscriptions list
      const stored = localStorage.getItem('ich100l_subscriptions_db');
      if (stored) {
        const localSubs = JSON.parse(stored);
        delete localSubs[safeId];
        localStorage.setItem('ich100l_subscriptions_db', JSON.stringify(localSubs));
      }

      // Also clean up specific subscriber key read by App.tsx
      localStorage.removeItem(`ich100l_sub_${targetUser.matricNumber}`);

      // Refresh subscriptions state (by deleting the key)
      setSubscriptions(prev => {
        const updated = { ...prev };
        delete updated[safeId];
        return updated;
      });

      setActionFeedback({
        type: 'success',
        message: `Successfully revoked ad-free premium access for ${targetUser.name}.`
      });

    } catch (err) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: `Could not revoke free access for ${targetUser.name}.`
      });
    } finally {
      setIsRevokingSub(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Listen to live unread feedbacks to update badge
  useEffect(() => {
    let unsubscribe = () => {};
    if (db) {
      try {
        unsubscribe = onSnapshot(collection(db, 'feedbacks'), (snapshot) => {
          const count = snapshot.docs.filter(doc => doc.data().status === 'unread').length;
          setUnreadFeedbacksCount(count);
        }, (err) => {
          console.warn('[Admin] Live feedback count fallback:', err);
        });
      } catch (err) {
        console.error('[Admin] Live feedback onSnapshot subscription failed:', err);
      }
    }
    return () => unsubscribe();
  }, []);

  // Listen to live Course Rep activity logs
  useEffect(() => {
    let unsubscribe = () => {};
    if (db) {
      try {
        unsubscribe = onSnapshot(collection(db, 'course_rep_logs'), (snapshot) => {
          const logs: any[] = [];
          snapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() });
          });
          // Sort chronologically (newest first)
          logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
          setCourseRepLogs(logs);
        }, (err) => {
          console.warn('[Admin] Live course rep logs subscribe fallback:', err);
        });
      } catch (err) {
        console.error('[Admin] Live course rep logs subscription failed:', err);
      }
    }
    return () => unsubscribe();
  }, []);

    // Listen to live semester configuration
  useEffect(() => {
    let unsubscribe = () => {};
    if (db) {
      try {
        unsubscribe = onSnapshot(doc(db, 'system-config', 'semester-billing'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setSemesterConfig({
              semesterActive: data.semesterActive ?? true,
              semesterStartedAt: data.semesterStartedAt ?? null,
              amount: data.amount ?? 1000
            });
          }
        }, (err) => {
          console.warn('[Admin] Live semester config fetch fallback:', err);
        });
      } catch (err) {
        console.error('[Admin] Live semester config subscription failed:', err);
      }
    }
    return () => unsubscribe();
  }, []);

  // Listen to live anonymous chat configuration
  useEffect(() => {
    let unsubscribe = () => {};
    if (db) {
      try {
        unsubscribe = onSnapshot(doc(db, 'system-config', 'anonymous-chat'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setChatConfig({
              enabled: data.enabled ?? false,
              visibility: data.visibility ?? 'paid'
            });
          }
        }, (err) => {
          console.warn('[Admin] Live chat config fetch fallback:', err);
        });
      } catch (err) {
        console.error('[Admin] Live chat config subscription failed:', err);
      }
    }
    return () => unsubscribe();
  }, []);

  // Listen to live departments
  useEffect(() => {
    let unsubscribe = () => {};
    if (db) {
      try {
        unsubscribe = onSnapshot(collection(db, 'departments'), (snapshot) => {
          const deptsList: any[] = [];
          snapshot.forEach((doc) => {
            deptsList.push({ ...doc.data(), id: doc.id });
          });
          setDepartments(deptsList);
          localStorage.setItem('ich100l_departments', JSON.stringify(deptsList));
        }, (err) => {
          console.warn('[Admin] Live departments fetch fallback:', err);
        });
      } catch (err) {
        console.error('[Admin] Live departments onSnapshot subscription failed:', err);
      }
    } else {
      const stored = localStorage.getItem('ich100l_departments');
      if (stored) {
        try {
          setDepartments(JSON.parse(stored));
        } catch (_) {}
      }
    }
    return () => unsubscribe();
  }, []);

  // Listen to live app version release config
  useEffect(() => {
    let unsubscribe = () => {};
    if (db) {
      try {
        unsubscribe = onSnapshot(doc(db, 'system-config', 'app-version'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const config = {
              latestVersion: data.latestVersion || '1.2.0',
              releaseNotes: data.releaseNotes || '🚀 A new software update is available.'
            };
            setAppVersionConfig(config);
            setNewVersionInput(config.latestVersion);
            setNewReleaseNotesInput(config.releaseNotes);
          }
        }, (err) => {
          console.warn('[Admin] Live version config fetch fallback:', err);
        });
      } catch (err) {
        console.error('[Admin] Live version subscription failed:', err);
      }
    }
    return () => unsubscribe();
  }, []);

  // Clear toast feedback
  useEffect(() => {
    if (actionFeedback) {
      const t = setTimeout(() => setActionFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [actionFeedback]);

  // Handle setting/removing course representative status
  const handleToggleCourseRep = async (targetUser: any) => {
    const nextRepState = !targetUser.isCourseRep;
    
    // Prevent locking out the main admin self
    if (targetUser.matricNumber === '2026/ps/ich/0034') {
      setActionFeedback({
        type: 'error',
        message: 'The master System Admin account cannot have their administrative access revoked.'
      });
      return;
    }

    try {
      const updatedUser = {
        ...targetUser,
        isCourseRep: nextRepState
      };

      // Set in Firestore
      if (db) {
        try {
          await setDoc(doc(db, 'users', getSafeDocId(targetUser.matricNumber)), { isCourseRep: nextRepState }, { merge: true });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.UPDATE, `users/${getSafeDocId(targetUser.matricNumber)}`);
        }
      }

      // Set in local cache
      const stored = localStorage.getItem('ich100l_users_db');
      const localDB = stored ? JSON.parse(stored) : {};
      if (localDB[targetUser.matricNumber]) {
        localDB[targetUser.matricNumber].isCourseRep = nextRepState;
        localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));
      }

      // Update state
      setUsers(prev => prev.map(u => u.matricNumber === targetUser.matricNumber ? updatedUser : u));

      setActionFeedback({
        type: 'success',
        message: `${targetUser.name} has been successfully ${nextRepState ? 'granted Course Rep status' : 'restored to regular Student status'}.`
      });

    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to update course representative authorization.'
      });
    }
  };

  // Create or Edit Department configuration mapping
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptPrefix.trim()) {
      setActionFeedback({
        type: 'error',
        message: 'Please fill in both the Department name and Matric prefix.'
      });
      return;
    }

    setIsSavingDept(true);
    setActionFeedback(null);

    const targetPrefix = deptPrefix.trim();
    const dId = editingDeptId || `dept-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const deptData = {
        id: dId,
        name: deptName.trim(),
        prefix: targetPrefix,
        courseRepMatric: deptCourseRepMatric || '',
        level: deptLevel,
        createdAt: new Date().toISOString()
      };

      // Demote previous representative if changed or removed during Edit
      const previousDept = departments.find(d => d.id === dId);
      const oldRepMatric = previousDept ? previousDept.courseRepMatric : '';
      if (oldRepMatric && oldRepMatric !== deptCourseRepMatric) {
        try {
          if (db) {
            await setDoc(doc(db, 'users', getSafeDocId(oldRepMatric)), { isCourseRep: false }, { merge: true });
          }
          setUsers(prev => prev.map(u => u.matricNumber === oldRepMatric ? { ...u, isCourseRep: false } : u));
          const stored = localStorage.getItem('ich100l_users_db');
          const localDB = stored ? JSON.parse(stored) : {};
          if (localDB[oldRepMatric]) {
            localDB[oldRepMatric].isCourseRep = false;
            localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));
          }
        } catch (demoteErr) {
          console.warn('[Admin] Failed to demote old representative profile:', demoteErr);
        }
      }

      // 1. Save doc to Firestore online/offline rules
      if (db) {
        try {
          await setDoc(doc(db, 'departments', dId), deptData);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.WRITE, `departments/${dId}`);
        }
      }

      // 2. Local memory update
      let updatedDepts = [...departments];
      if (editingDeptId) {
        updatedDepts = updatedDepts.map(d => d.id === dId ? deptData : d);
      } else {
        updatedDepts.push(deptData);
      }
      setDepartments(updatedDepts);
      localStorage.setItem('ich100l_departments', JSON.stringify(updatedDepts));

      // 3. Promote newly appointed representative user
      if (deptCourseRepMatric) {
        try {
          if (db) {
            await setDoc(doc(db, 'users', getSafeDocId(deptCourseRepMatric)), { isCourseRep: true }, { merge: true });
          }
          // Sync state users locally
          setUsers(prev => prev.map(u => u.matricNumber === deptCourseRepMatric ? { ...u, isCourseRep: true } : u));
          
          // Sync local storage users
          const stored = localStorage.getItem('ich100l_users_db');
          const localDB = stored ? JSON.parse(stored) : {};
          if (localDB[deptCourseRepMatric]) {
            localDB[deptCourseRepMatric].isCourseRep = true;
            localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));
          }
        } catch (promoErr) {
          console.warn('[Admin] Failed to promote Representative profile:', promoErr);
        }
      }

      // Reset Form State
      setDeptName('');
      setDeptPrefix('');
      setDeptCourseRepMatric('');
      setDeptLevel('100l');
      setEditingDeptId(null);

      setActionFeedback({
        type: 'success',
        message: editingDeptId 
          ? `Updated mapping rules for ${deptData.name}.`
          : `Established new academic department: ${deptData.name}.`
      });

    } catch (err) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: 'Could not write department mappings to local memory or cloud servers.'
      });
    } finally {
      setIsSavingDept(false);
    }
  };

  // Start editing mode for a department
  const handleStartEditDepartment = (dept: any) => {
    setEditingDeptId(dept.id);
    setDeptName(dept.name);
    setDeptPrefix(dept.prefix);
    setDeptCourseRepMatric(dept.courseRepMatric || '');
    setDeptLevel(dept.level || '100l');
    
    // Switch to Department tab if clicked from elsewhere, though already inside it
    setActiveAdminTab('departments');
  };

  // Delete department map
  const handleDeleteDepartment = async (id: string, name: string) => {
    try {
      if (db) {
        try {
          await deleteDoc(doc(db, 'departments', id));
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.DELETE, `departments/${id}`);
        }
      }

      const updated = departments.filter(d => d.id !== id);
      setDepartments(updated);
      localStorage.setItem('ich100l_departments', JSON.stringify(updated));

      setActionFeedback({
        type: 'success',
        message: `Removed ${name} department map configuration.`
      });
    } catch (err) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to purge department map registry.'
      });
    }
  };

  // Reset a user's password to 123456
  const handleResetPassword = async (targetUser: any) => {
    try {
      if (db) {
        try {
          await setDoc(doc(db, 'users', getSafeDocId(targetUser.matricNumber)), { password: '123456' }, { merge: true });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.UPDATE, `users/${getSafeDocId(targetUser.matricNumber)}`);
        }
      }

      // Set in local cache
      const stored = localStorage.getItem('ich100l_users_db');
      const localDB = stored ? JSON.parse(stored) : {};
      if (localDB[targetUser.matricNumber]) {
        localDB[targetUser.matricNumber].password = '123456';
        localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));
      }

      // Update local state if needed
      setUsers(prev => prev.map(u => u.matricNumber === targetUser.matricNumber ? { ...u, password: '123456' } : u));

      setActionFeedback({
        type: 'success',
        message: `Successfully reset password back to "123456" for ${targetUser.name}.`
      });
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to initialize password reset sequence.'
      });
    }
  };

  // Trigger custom confirmation modal for deletion
  const handleDeleteUserClick = (targetUser: any) => {
    if (targetUser.matricNumber === '2026/ps/ich/0034') {
      setActionFeedback({
        type: 'error',
        message: 'The master System Admin account cannot be deleted.'
      });
      return;
    }
    setUserToDelete(targetUser);
  };

  // Delete a student user account completely (Executed on confirmation)
  const handleDeleteUserConfirmed = async () => {
    if (!userToDelete) return;
    const targetUser = userToDelete;
    setUserToDelete(null);

    try {
      if (db) {
        try {
          await deleteDoc(doc(db, 'users', getSafeDocId(targetUser.matricNumber)));
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.DELETE, `users/${getSafeDocId(targetUser.matricNumber)}`);
        }
      }

      // Delete from local cache
      const stored = localStorage.getItem('ich100l_users_db');
      const localDB = stored ? JSON.parse(stored) : {};
      delete localDB[targetUser.matricNumber];
      localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));

      // Remove from states
      setUsers(prev => prev.filter(u => u.matricNumber !== targetUser.matricNumber));

      setActionFeedback({
        type: 'success',
        message: `Successfully deleted student account for ${targetUser.name}.`
      });
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to complete user account purge.'
      });
    }
  };

  // Create a brand new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!newName.trim() || !newEmail.trim() || !newMatric.trim()) {
      setFormError('Please enter the student\'s Full Name, Email and Matriculation number.');
      return;
    }

    const cleanedMatric = newMatric.trim();
    const cleanedEmail = newEmail.trim().toLowerCase();

    // Check if user already exists
    const duplicate = users.find(u => u.matricNumber.trim().toLowerCase() === cleanedMatric.toLowerCase());
    if (duplicate) {
      setFormError(`Matriculation number "${cleanedMatric}" already belongs to an existing user.`);
      return;
    }

    setIsSaving(true);
    try {
      // Structure of new user matching default fields, default password is '123456'
      const newUserProfile = {
        name: newName.trim(),
        email: cleanedEmail,
        matricNumber: cleanedMatric,
        password: '123456',
        createdAt: new Date().toISOString(),
        isAdmin: false,
        activeSessionId: '',
        level: newUserLevel,
        departmentId: newUserDeptId
      };

      // 1. Save online to Firestore
      if (db) {
        try {
          await setDoc(doc(db, 'users', getSafeDocId(cleanedMatric)), newUserProfile);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, `users/${getSafeDocId(cleanedMatric)}`);
        }
      }

      // 2. Save in local storage user registry cache
      const stored = localStorage.getItem('ich100l_users_db');
      const localDB = stored ? JSON.parse(stored) : {};
      localDB[cleanedMatric] = newUserProfile;
      localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));

      // Clear input fields
      setNewName('');
      setNewEmail('');
      setNewMatric('');
      setNewUserLevel('100l');
      setNewUserDeptId('dept-ps-ich');

      setActionFeedback({
        type: 'success',
        message: `Registered student ${newUserProfile.name} with password "123456"!`
      });
      setIsAddUserOpen(false);
      fetchUsers(); // Refresh layout
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Firestore connection issue while creating new student.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit edit form to modify user name, email and matric Number
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFormError('');
    setIsEditSaving(true);

    const oldMatric = editingUser.matricNumber;
    const newNameClean = editName.trim();
    const newEmailClean = editEmail.trim().toLowerCase();
    const newMatricClean = editMatric.trim();

    if (!newNameClean || !newEmailClean || !newMatricClean) {
      setEditFormError('Please enter all fields.');
      setIsEditSaving(false);
      return;
    }

    // Check if matric matches another user besides the one being edited
    const duplicate = users.find(u => 
      u.matricNumber.trim().toLowerCase() !== oldMatric.trim().toLowerCase() && 
      u.matricNumber.trim().toLowerCase() === newMatricClean.toLowerCase()
    );
    if (duplicate) {
      setEditFormError(`Matriculation number "${newMatricClean}" already belongs to an existing user.`);
      setIsEditSaving(false);
      return;
    }

    try {
      // Create full updated object mimicking properties
      const updatedUserProps = {
        ...editingUser,
        name: newNameClean,
        email: newEmailClean,
        matricNumber: newMatricClean,
        level: editUserLevel,
        departmentId: editUserDeptId
      };

      if (db) {
        if (oldMatric !== newMatricClean) {
          // If matric number changed:
          // Write to the new document ID
          await setDoc(doc(db, 'users', getSafeDocId(newMatricClean)), updatedUserProps);
          // Delete old document ID
          await deleteDoc(doc(db, 'users', getSafeDocId(oldMatric)));
        } else {
          // Just update the fields in place
          await setDoc(doc(db, 'users', getSafeDocId(oldMatric)), {
            name: newNameClean,
            email: newEmailClean,
            level: editUserLevel,
            departmentId: editUserDeptId
          }, { merge: true });
        }
      }

      // Update local storage user db cache
      const stored = localStorage.getItem('ich100l_users_db');
      const localDB = stored ? JSON.parse(stored) : {};
      
      if (oldMatric !== newMatricClean) {
        delete localDB[oldMatric];
      }
      localDB[newMatricClean] = updatedUserProps;
      localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));

      // If the admin edited THEIR OWN account, synchronize the active session user
      if (currentUser && (currentUser.matricNumber === oldMatric || currentUser.matric === oldMatric)) {
        const keysToUpdate = ['ich100l_current_user', 'ich100l_user'];
        keysToUpdate.forEach(k => {
          const sessionUserStr = localStorage.getItem(k);
          if (sessionUserStr) {
            try {
              const parsed = JSON.parse(sessionUserStr);
              const updatedSession = {
                ...parsed,
                name: newNameClean,
                displayName: newNameClean,
                email: newEmailClean,
                matricNumber: newMatricClean,
                matric: newMatricClean,
              };
              localStorage.setItem(k, JSON.stringify(updatedSession));
            } catch (_) {}
          } else {
            // Write standard schema if missing
            const updatedSession = {
              name: newNameClean,
              displayName: newNameClean,
              email: newEmailClean,
              matricNumber: newMatricClean,
              matric: newMatricClean,
              isAdmin: true
            };
            localStorage.setItem(k, JSON.stringify(updatedSession));
          }
        });
      }

      // Update local React state list
      setUsers(prev => prev.map(u => u.matricNumber === oldMatric ? updatedUserProps : u));

      setActionFeedback({
        type: 'success',
        message: `Successfully updated profile details for ${newNameClean}.`
      });

      setEditingUser(null);
    } catch (err: any) {
      console.error(err);
      setEditFormError(err.message || 'Error occurred while updating student record.');
    } finally {
      setIsEditSaving(false);
    }
  };

  // Change Admin Password Handler
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Please fill in all security fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match confirmation.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }

    setIsChangingPass(true);
    let isSuccess = false;

    try {
      // Check current password correctness
      let actualCurrentPassword = currentUser.password;
      
      const sessionUserStr = localStorage.getItem('ich100l_current_user');
      if (sessionUserStr) {
        const parsed = JSON.parse(sessionUserStr);
        if (parsed.password) {
          actualCurrentPassword = parsed.password;
        }
      }

      if (actualCurrentPassword && currentPassword !== actualCurrentPassword) {
        setPassError('Current password entered is incorrect.');
        setIsChangingPass(false);
        return;
      }

      // 1. Update online Firestore
      if (db) {
        const docRef = doc(db, 'users', getSafeDocId(currentUser.matricNumber));
        try {
          await setDoc(docRef, { password: newPassword }, { merge: true });
          isSuccess = true;
        } catch (fsErr) {
          console.warn('[Admin Settings] Online update failed:', fsErr);
        }
      }

      // 2. Update local users DB cache (Offline / Redundancy)
      const stored = localStorage.getItem('ich100l_users_db');
      const localDB = stored ? JSON.parse(stored) : {};
      if (localDB[currentUser.matricNumber]) {
        localDB[currentUser.matricNumber].password = newPassword;
        localStorage.setItem('ich100l_users_db', JSON.stringify(localDB));
        isSuccess = true;
      }

      // 3. Update the logged in current user state in local storage session wrapper
      if (sessionUserStr) {
        const sessionUser = JSON.parse(sessionUserStr);
        if (sessionUser.matricNumber === currentUser.matricNumber) {
          sessionUser.password = newPassword;
          localStorage.setItem('ich100l_current_user', JSON.stringify(sessionUser));
        }
      }

    } catch (err: any) {
      console.error(err);
      setPassError('Could not sync password update across nodes.');
    } finally {
      setIsChangingPass(false);
    }

    if (isSuccess || !db) {
      setPassSuccess('Security credentials successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setActionFeedback({
        type: 'success',
        message: 'Security credentials successfully updated.'
      });
    }
  };

  // OTA Version Publisher Handler
  const handlePublishNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionInput.trim()) {
      setVersionPubError('Please specify a valid software release version number.');
      return;
    }
    
    setIsPublishingVersion(true);
    setVersionPubSuccess('');
    setVersionPubError('');
    
    try {
      await setDoc(doc(db, 'system-config', 'app-version'), {
        latestVersion: newVersionInput.trim(),
        releaseNotes: newReleaseNotesInput.trim() || '🚀 A new software update is available. Updates are loaded with state integrity engines & view alignments.',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setVersionPubSuccess('Software release version published successfully! All active users will detect this version and have the prompt on their next view.');
    } catch (err: any) {
      console.error(err);
      setVersionPubError(err.message || 'Failed to update system config in Firestore.');
    } finally {
      setIsPublishingVersion(false);
    }
  };

  // Web Push Broadcaster Event Channel Handler
  const handleBroadcastPushUpdate = async () => {
    setIsSendingPushUpdate(true);
    setPushUpdateSuccess('');
    setPushUpdateError('');
    
    try {
      const activeVer = newVersionInput.trim() || appVersionConfig.latestVersion || '1.2.0';
      const notes = newReleaseNotesInput.trim() || 'A new optimized software release is ready for installation over-the-air.';
      
      const res = await fetch('/api/send-broadcast-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `📣 New Update Released (v${activeVer})`,
          body: `An over-the-air software package is ready: ${notes}`,
          category: 'announcements',
          targetGroup: 'all'
        })
      });
      
      let data: any = {};
      let isJson = false;
      try {
        const text = await res.text();
        data = JSON.parse(text);
        isJson = true;
      } catch (parseErr) {
        console.warn('Failed parsing push broadcast response as JSON:', parseErr);
      }

      if (res.ok && isJson && data.success !== false) {
        setPushUpdateSuccess(`Successful push broadcast dispatched! ${data.count ?? 0} active devices are being notified of the latest app version.`);
      } else {
        const errorMsg = data.error || data.message || 'The server returned an unexpected response. Please verify database connection.';
        setPushUpdateError(errorMsg);
      }
    } catch (err: any) {
      console.error(err);
      setPushUpdateError(err.message || 'Network error while broadcasting live push updates.');
    } finally {
      setIsSendingPushUpdate(false);
    }
  };

  // Anonymous Chat Configuration Functions
  const handleToggleChat = async (enabledVal: boolean) => {
    if (!db) return;
    setIsUpdatingChat(true);
    setActionFeedback(null);
    try {
      await setDoc(doc(db, 'system-config', 'anonymous-chat'), {
        enabled: enabledVal,
        visibility: chatConfig.visibility,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setActionFeedback({
        type: 'success',
        message: enabledVal ? 'Anonymous chat sub-panel has been activated on student portals!' : 'Anonymous chat has been successfully deactivated.'
      });
    } catch (err: any) {
      console.error('[Admin] Failed toggling chat:', err);
      setActionFeedback({
        type: 'error',
        message: 'Could not sync chat status with online database.'
      });
    } finally {
      setIsUpdatingChat(false);
    }
  };

  const handleUpdateChatVisibility = async (visibilityVal: 'paid' | 'all') => {
    if (!db) return;
    setIsUpdatingChat(true);
    setActionFeedback(null);
    try {
      await setDoc(doc(db, 'system-config', 'anonymous-chat'), {
        enabled: chatConfig.enabled,
        visibility: visibilityVal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setActionFeedback({
        type: 'success',
        message: `Chat access has been restricted to: ${visibilityVal === 'paid' ? 'Paid student users only' : 'All registered student users'}.`
      });
    } catch (err: any) {
      console.error('[Admin] Failed updating chat visibility:', err);
      setActionFeedback({
        type: 'error',
        message: 'Could not configure chat access restrictions.'
      });
    } finally {
      setIsUpdatingChat(false);
    }
  };

  // Academic Semester Control Functions
  const handleStartSemester = async () => {
    if (!db) return;
    setIsUpdatingSemester(true);
    setActionFeedback(null);
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'system-config', 'semester-billing'), {
        semesterActive: true,
        semesterStartedAt: now,
        amount: 1000
      });
      setActionFeedback({
        type: 'success',
        message: 'New academic semester officially started! Dynamic billing active and student access open.'
      });
    } catch (err: any) {
      console.error('[Admin] Fail starting semester:', err);
      setActionFeedback({
        type: 'error',
        message: 'Could not sync started semester state with online database.'
      });
    } finally {
      setIsUpdatingSemester(false);
    }
  };

  const handleEndSemester = async () => {
    if (!db) return;
    setIsUpdatingSemester(true);
    setActionFeedback(null);
    try {
      let currentEndedCount = 0;
      try {
        const snap = await getDoc(doc(db, 'system-config', 'semester-billing'));
        if (snap.exists()) {
          currentEndedCount = snap.data().endedSemestersCount || 0;
        }
      } catch (getErr) {
        console.warn('[Admin] Failed to read current ended count:', getErr);
      }

      const nextEndedCount = currentEndedCount + 1;
      let promotionTriggered = false;

      if (nextEndedCount > 0 && nextEndedCount % 2 === 0) {
        promotionTriggered = true;
        try {
          const deptsSnap = await getDocs(collection(db, 'departments'));
          const promotePromises = deptsSnap.docs.map(async (deptDoc) => {
            const deptData = deptDoc.data();
            const currentLevel = deptData.level || '100l';
            const match = currentLevel.match(/^(\d+)(l|L)?$/);
            let nextLevel = currentLevel;
            if (match) {
              const num = parseInt(match[1], 10);
              nextLevel = `${num + 100}${match[2] || 'l'}`;
            } else {
              nextLevel = '200l';
            }
            await setDoc(doc(db, 'departments', deptDoc.id), { level: nextLevel }, { merge: true });
          });
          await Promise.all(promotePromises);
          console.log('[Admin] Automatically promoted departments to next level!');
        } catch (promoteError) {
          console.error('[Admin] Failed to promote departments automatically:', promoteError);
        }
      }

      await setDoc(doc(db, 'system-config', 'semester-billing'), {
        semesterActive: false,
        semesterStartedAt: null,
        amount: 1000,
        endedSemestersCount: nextEndedCount
      });

      setActionFeedback({
        type: 'success',
        message: promotionTriggered
          ? `Current semester ended! Promotion triggered: all departments have been automatically promoted to their next academic level (e.g. 100L ➔ 200L).`
          : `Current semester marked as ended. Student access passport locked. (${nextEndedCount} semester(s) completed on current cycle).`
      });
    } catch (err: any) {
      console.error('[Admin] Fail ending semester:', err);
      setActionFeedback({
        type: 'error',
        message: 'Could not sync ended semester state with online database.'
      });
    } finally {
      setIsUpdatingSemester(false);
    }
  };

  // Match user to department ID dynamically
  const getUserDepartmentId = (user: any) => {
    if (user.departmentId) return user.departmentId;
    if (!user.matricNumber) return 'unassigned';
    const userNorm = String(user.matricNumber).toLowerCase().replace(/[\/\s\-_*]/g, "");
    const matched = departments.find(d => {
      const prefixNorm = String(d.prefix).toLowerCase().replace(/[\/\s\-_*]/g, "");
      return prefixNorm && userNorm.includes(prefixNorm);
    });
    return matched ? matched.id : 'unassigned';
  };

  // Filter users lists based on live search term and selected register
  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      u.name?.toLowerCase().includes(q) ||
      u.matricNumber?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );

    if (!matchesSearch) return false;

    // Filter by academic level
    if (selectedLevelFilter !== 'all') {
      const userLevel = (u.level || '100l').toLowerCase();
      if (userLevel !== selectedLevelFilter.toLowerCase()) {
        return false;
      }
    }

    // Filter by access status
    if (selectedAccessFilter !== 'all') {
      const statusObj = getUserStatus(u);
      if (statusObj.type !== selectedAccessFilter) {
        return false;
      }
    }

    if (selectedRegisterId === 'all') return true;
    return getUserDepartmentId(u) === selectedRegisterId;
  });

  // Paginated student registry slice
  const usersPerPage = 50;
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  // Calculate totals for KPI widgets
  const totalUserCount = users.length;
  const courseRepCount = users.filter(u => u.isCourseRep).length;
  const recentSignupsCount = users.filter(u => {
    if (!u.createdAt) return false;
    const diff = Date.now() - new Date(u.createdAt).getTime();
    return diff < 48 * 60 * 60 * 1000; // registered within last 48 hours
  }).length;

  // Calculate standard paid counts
  const paidStudentsCount = users.filter(u => {
    const status = getUserStatus(u);
    return status.type === 'paid';
  }).length;

  const filteredPaidCount = filteredUsers.filter(u => {
    const status = getUserStatus(u);
    return status.type === 'paid';
  }).length;

  // Calculate admin-granted free access counts
  const adminGrantedStudentsCount = users.filter(u => {
    const status = getUserStatus(u);
    return status.type === 'admin-granted';
  }).length;

  const filteredAdminGrantedCount = filteredUsers.filter(u => {
    const status = getUserStatus(u);
    return status.type === 'admin-granted';
  }).length;

  // Simple clean helper for visual initials
  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    return fullName.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  // Helper for dynamic anticipated student matric format hints based on register selection
  const getExpectedMatricFormat = () => {
    if (selectedRegisterId === 'all' || selectedRegisterId === 'unassigned') {
      return 'Format: yyyy/ps/ich/xxxx';
    }
    const matchedDept = departments.find(d => d.id === selectedRegisterId);
    if (matchedDept?.prefix) {
      return `Format: yyyy/${matchedDept.prefix.toLowerCase()}/xxxx`;
    }
    return 'Format: yyyy/ps/ich/xxxx';
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Decortive glows */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />

      {/* Persistent global warning feedback popups */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-xl ${
              actionFeedback.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-955/90 border-rose-500/30 text-rose-300'
            }`}>
              {actionFeedback.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-bold uppercase tracking-wider">
                  {actionFeedback.type === 'success' ? 'Command Accomplished' : 'Authorization Refused'}
                </p>
                <p className="text-xs mt-0.5 opacity-90">{actionFeedback.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Administrative Header */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-900 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-display font-black tracking-tight text-white uppercase">ICH100L</h1>
                <span className="text-[9px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded">
                  Control Desk
                </span>
              </div>
              <p className="text-2xs text-slate-400 font-mono">System Master Configuration & Access Policies</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <p className="text-[10px] text-slate-400 leading-none">Signed in as</p>
              <p className="text-xs font-bold text-slate-200 mt-1">Super Administrative Console</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2.5 bg-slate-950/80 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer border border-slate-900 group"
              title="System Sign Out"
            >
              <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* Central Command Workspace Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Connection health & diagnostic stats ticker */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-gradient-to-r from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Root Node Active Code: 2026/PS/ICH/0034
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="text-[10px] font-mono border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-white px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isLoading ? 'Polling database...' : 'Poll Database Sync'}</span>
            </button>
          </div>
        </div>

        {activeAdminTab === 'dashboard' ? (
          <>
            {/* Telemetry/KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
                <Users className="w-8 h-8 text-indigo-400/20 absolute right-4 top-4 font-black" />
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Student Registry</h4>
                <p className="text-3xl font-display font-black text-slate-100 mt-1">
                  {filteredUsers.length} <span className="text-sm font-normal text-slate-500 font-mono">/ {totalUserCount}</span>
                </p>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5 font-mono">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 animate-pulse" />
                  <span className="truncate">
                    {selectedRegisterId === 'all' ? 'All Depts' : (departments.find(d => d.id === selectedRegisterId)?.prefix || selectedRegisterId).toUpperCase()} • {(selectedLevelFilter || 'ALL').toUpperCase()}
                  </span>
                </div>
              </GlassCard>

              <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
                <CreditCard className="w-8 h-8 text-indigo-500/20 absolute right-4 top-4 font-black" />
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Paid Students</h4>
                <p className="text-3xl font-display font-black text-indigo-400 mt-1">
                  {filteredPaidCount} <span className="text-sm font-normal text-slate-500 font-mono">/ {paidStudentsCount}</span>
                </p>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5 font-mono">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 animate-pulse" />
                  <span className="truncate">
                    Paid: {filteredPaidCount} in selection
                  </span>
                </div>
              </GlassCard>

              <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
                <Sparkles className="w-8 h-8 text-emerald-400/20 absolute right-4 top-4 font-black" />
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Admin Granted</h4>
                <p className="text-3xl font-display font-black text-emerald-400 mt-1">
                  {filteredAdminGrantedCount} <span className="text-sm font-normal text-slate-500 font-mono">/ {adminGrantedStudentsCount}</span>
                </p>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5 font-mono">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                  <span className="truncate">
                    Granted: {filteredAdminGrantedCount} in selection
                  </span>
                </div>
              </GlassCard>

              <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
                <ShieldCheck className="w-8 h-8 text-rose-400/20 absolute right-4 top-4 font-black" />
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Course Representatives</h4>
                <p className="text-3xl font-display font-black text-rose-400 mt-1">{courseRepCount}</p>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-between gap-1.5 font-mono">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
                    <span className="truncate">Reps / Admins</span>
                  </div>
                  <button
                    onClick={() => setActiveAdminTab('rep_activities')}
                    className="px-2 py-0.5 bg-rose-500/15 hover:bg-rose-500/35 border border-rose-500/30 rounded-md text-[9px] text-rose-300 font-bold transition-all cursor-pointer outline-none shrink-0"
                    id="admin-view-logs-btn"
                  >
                    View Logs
                  </button>
                </div>
              </GlassCard>

              <GlassCard className="p-4 bg-slate-950/40 border-slate-900 relative">
                <Calendar className="w-8 h-8 text-amber-400/20 absolute right-4 top-4 font-black" />
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Added Last 48 hrs</h4>
                <p className="text-3xl font-display font-black text-amber-400 mt-1">{recentSignupsCount}</p>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5 font-mono">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                  <span className="truncate">New student registrations</span>
                </div>
              </GlassCard>
            </div>

            {/* Storage diagnostics calculation */}
            {(() => {
              const estimatedBytes = (dbStats.usersCount * 500) + (dbStats.subsCount * 300) + (dbStats.activitiesCount * 400) + (dbStats.deadlinesCount * 300) + (dbStats.announcementsCount * 600) + (dbStats.feedbacksCount * 800) + 12800; // includes 12.8KB baseline
              const limitBytes = 1073741824; // 1.00 GB

              const formatBytes = (bytes: number) => {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
              };

              return (
                <GlassCard className="p-5 bg-gradient-to-br from-slate-950/50 to-slate-900/10 border-slate-900/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/5 blur-[50px] pointer-events-none" />
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                          Cloud Database Storage Diagnostics
                        </h4>
                      </div>
                      <p className="text-2xs text-slate-400 font-sans leading-relaxed">
                        Live telemetry tracking virtual file descriptors, collections, and database cluster size limits.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                        Spark Plan Quota &bull; Active
                      </span>
                    </div>
                  </div>

                  {/* Progress Display */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Database Space Taken</span>
                      <span className="text-indigo-400 font-bold">{formatBytes(estimatedBytes)}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-900 flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(0.5, (estimatedBytes / limitBytes) * 100)}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400"
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-2xs font-mono text-slate-500 pt-0.5">
                      <span>Available Space: {formatBytes(limitBytes - estimatedBytes)}</span>
                      <span>Limit: 1.00 GB (1,024 MB)</span>
                    </div>
                  </div>

                  {/* Dynamic collections breakdown */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-900/65">
                    <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xl text-center">
                      <span className="block text-2xs text-slate-500 font-mono">Students</span>
                      <span className="text-xs font-bold text-slate-200 mt-0.5 block">{dbStats.usersCount}</span>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xl text-center">
                      <span className="block text-[10px] text-slate-500 font-mono leading-none">Subscribers</span>
                      <span className="text-xs font-bold text-slate-200 mt-1 block">{dbStats.subsCount}</span>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xl text-center">
                      <span className="block text-2xs text-slate-500 font-mono">Classes</span>
                      <span className="text-xs font-bold text-slate-200 mt-0.5 block">{dbStats.activitiesCount}</span>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xl text-center">
                      <span className="block text-2xs text-slate-500 font-mono">Deadlines</span>
                      <span className="text-xs font-bold text-slate-200 mt-0.5 block">{dbStats.deadlinesCount}</span>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xl text-center">
                      <span className="block text-2xs text-slate-500 font-mono">Broadcasts</span>
                      <span className="text-xs font-bold text-slate-200 mt-0.5 block">{dbStats.announcementsCount}</span>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xl text-center">
                      <span className="block text-2xs text-slate-500 font-mono">Feedbacks</span>
                      <span className="text-xs font-bold text-slate-200 mt-0.5 block">{dbStats.feedbacksCount}</span>
                    </div>
                  </div>
                </GlassCard>
              );
            })()}

            {/* FULL-WIDTH Active Users List & Advanced Management Desk */}
            <div className="space-y-4 pb-28">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                  <h3 className="text-sm font-display font-bold text-slate-200">Registered Student Accounts ({filteredUsers.length})</h3>
                </div>

                {/* Filtering Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, matric, or email..."
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl pl-9 pr-3 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-650"
                  />
                </div>
              </div>

              {/* Department registers selector */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/40 border border-slate-900 rounded-2xl">
                {/* All Departments selection tab */}
                <button
                  type="button"
                  onClick={() => setSelectedRegisterId('all')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer outline-none ${
                    selectedRegisterId === 'all'
                      ? 'bg-gradient-to-r from-rose-500/20 to-rose-600/15 border border-rose-500/30 text-rose-350'
                      : 'border border-transparent text-slate-450 hover:text-rose-450/70 hover:bg-slate-900/40'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-rose-400 font-bold" />
                  <span>All Departments</span>
                  <span className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-md font-bold ${
                    selectedRegisterId === 'all' 
                      ? 'bg-rose-500/30 text-rose-300' 
                      : 'bg-slate-900 text-slate-550'
                  }`}>
                    {users.length}
                  </span>
                </button>

                {departments.map((dept) => {
                  const deptUsers = users.filter((u) => getUserDepartmentId(u) === dept.id);
                  const isSelected = selectedRegisterId === dept.id;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => setSelectedRegisterId(dept.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer outline-none ${
                        isSelected
                          ? 'bg-gradient-to-r from-rose-500/20 to-rose-600/15 border border-rose-500/30 text-rose-350'
                          : 'border border-transparent text-slate-450 hover:text-rose-450/70 hover:bg-slate-900/40'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-rose-400" />
                      <span>{(dept.prefix || dept.name).toUpperCase()} Register</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-md font-bold ${
                        isSelected 
                          ? 'bg-rose-500/30 text-rose-300' 
                          : 'bg-slate-900 text-slate-550'
                      }`}>
                        {deptUsers.length}
                      </span>
                    </button>
                  );
                })}

                {/* Display Unassigned tab if there are unassigned students */}
                {(() => {
                  const unassignedCount = users.filter((u) => getUserDepartmentId(u) === 'unassigned').length;
                  if (unassignedCount > 0) {
                    const isSelected = selectedRegisterId === 'unassigned';
                    return (
                      <button
                        onClick={() => setSelectedRegisterId('unassigned')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer outline-none ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/15 border border-amber-500/30 text-amber-300'
                            : 'border border-transparent text-slate-450 hover:text-amber-450/75 hover:bg-slate-900/40'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-450" />
                        <span>Unassigned</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-md font-bold ${
                          isSelected 
                            ? 'bg-amber-500/30 text-amber-350' 
                            : 'bg-slate-900 text-slate-550'
                        }`}>
                          {unassignedCount}
                        </span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Filter controls row */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                {/* Academic Level Filters selector */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/20 border border-slate-950 rounded-2xl flex-1 lg:flex-initial">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-2 font-bold select-none">Level:</span>
                  {[
                    { id: 'all', label: 'All Levels' },
                    { id: '100l', label: '100L' },
                    { id: '200l', label: '200L' },
                    { id: '300l', label: '300L' },
                    { id: '400l', label: '400L' },
                    { id: '500l', label: '500L' }
                  ].map((levelObj) => {
                    const isSelected = selectedLevelFilter === levelObj.id;
                    const matchingCount = users.filter((u) => {
                      const matchesDept = selectedRegisterId === 'all' || getUserDepartmentId(u) === selectedRegisterId;
                      if (!matchesDept) return false;
                      if (levelObj.id === 'all') return true;
                      return (u.level || '100l').toLowerCase() === levelObj.id;
                    }).length;

                    return (
                      <button
                        key={levelObj.id}
                        onClick={() => setSelectedLevelFilter(levelObj.id)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-mono font-bold uppercase transition-all duration-250 cursor-pointer outline-none ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/15 border border-indigo-500/30 text-indigo-350 shadow-md shadow-indigo-500/5'
                            : 'border border-transparent text-slate-500 hover:text-indigo-400 hover:bg-slate-900/30'
                        }`}
                      >
                        <span>{levelObj.label}</span>
                        <span className={`text-[8.5px] font-mono ml-2 px-1 py-0.1 rounded ${
                          isSelected 
                            ? 'bg-indigo-500/20 text-indigo-300' 
                            : 'bg-slate-900/60 text-slate-600'
                        }`}>
                          {matchingCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Access Status Filters selector */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/20 border border-slate-950 rounded-2xl flex-1 lg:flex-initial">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-2 font-bold select-none">Access:</span>
                  {[
                    { id: 'all', label: 'All Access' },
                    { id: 'paid', label: 'Ad-Free (Paid)' },
                    { id: 'admin-granted', label: 'Ad-Free (Granted)' },
                    { id: 'expired', label: 'No Access / Free' }
                  ].map((statusObj) => {
                    const isSelected = selectedAccessFilter === statusObj.id;
                    const matchingCount = users.filter((u) => {
                      const matchesDept = selectedRegisterId === 'all' || getUserDepartmentId(u) === selectedRegisterId;
                      if (!matchesDept) return false;
                      const matchesLevel = selectedLevelFilter === 'all' || (u.level || '100l').toLowerCase() === selectedLevelFilter;
                      if (!matchesLevel) return false;
                      
                      const statusVal = getUserStatus(u);
                      if (statusObj.id === 'all') return true;
                      return statusVal.type === statusObj.id;
                    }).length;

                    return (
                      <button
                        key={statusObj.id}
                        onClick={() => setSelectedAccessFilter(statusObj.id as any)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-mono font-bold uppercase transition-all duration-250 cursor-pointer outline-none ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/15 border border-emerald-500/30 text-emerald-350 shadow-md shadow-emerald-500/5'
                            : 'border border-transparent text-slate-500 hover:text-emerald-400 hover:bg-slate-900/30'
                        }`}
                      >
                        <span>{statusObj.label}</span>
                        <span className={`text-[8.5px] font-mono ml-2 px-1 py-0.1 rounded ${
                          isSelected 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-slate-900/60 text-slate-600'
                        }`}>
                          {matchingCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User stream records view */}
              <div className="space-y-3">
                {isLoading && users.length === 0 ? (
                  <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-2" />
                    <p className="text-xs font-mono">Synchronizing user registry from database...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/20">
                    <Users className="w-10 h-10 text-slate-700 mx-auto mb-2.5" />
                    <h4 className="text-xs font-mono font-bold uppercase text-slate-400">Registry query is blank</h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 font-sans">
                      No matching student credentials have been found matching "{searchTerm}". Check spelling parameters or provision them.
                    </p>
                  </div>
                ) : (
                  paginatedUsers.map((user) => {
                    const isCurrentAdmin = user.matricNumber === '2026/ps/ich/0034';
                    const isUserRep = user.isCourseRep;
                    const status = getUserStatus(user);
                    
                    return (
                      <div key={user.matricNumber}>
                        <GlassCard 
                          className={`p-4 bg-slate-950/35 border-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:bg-slate-950/50 ${
                            isCurrentAdmin 
                              ? 'border-l-[4px] border-rose-500 bg-rose-950/[0.03]' 
                              : isUserRep 
                                ? 'border-l-[4px] border-amber-500 bg-amber-950/[0.03]' 
                                : status.hasAccess
                                  ? 'border-l-[4px] border-emerald-500 bg-emerald-950/[0.03] shadow-[0_0_15px_rgba(16,185,129,0.04)]'
                                  : 'border-l-[3px] border-slate-800'
                          }`}
                        >
                          {/* Left Block: Profile Identity */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                                isCurrentAdmin
                                  ? 'bg-[#ef4444] text-white font-mono' 
                                  : isUserRep
                                    ? 'bg-gradient-to-tr from-amber-450 to-amber-600 bg-amber-500 text-slate-950 font-black'
                                    : 'bg-gradient-to-tr from-indigo-500 to-violet-600 text-white'
                              }`}>
                                {getInitials(user.name)}
                              </div>
                              {status.hasAccess && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0f172a] rounded-full shadow-[0_0_8px_rgba(52,211,153,0.65)] animate-pulse" />
                              )}
                            </div>
                            
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold font-sans text-slate-200 truncate">{user.name}</h4>
                                {status.hasAccess && (
                                  <span className="text-[8px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 shrink-0">
                                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                                    ACTIVE ACCESS
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditName(user.name || user.displayName || '');
                                    setEditEmail(user.email || '');
                                    setEditMatric(user.matricNumber || user.matric || '');
                                    setEditUserLevel(user.level || '100l');
                                    setEditUserDeptId(user.departmentId || getUserDepartmentId(user) || 'dept-ps-ich');
                                    setEditFormError('');
                                  }}
                                  className="p-1 hover:bg-indigo-500/10 hover:text-indigo-400 text-slate-500 border border-transparent hover:border-indigo-500/20 rounded cursor-pointer transition-all"
                                  title="Edit student profile details directly"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {isCurrentAdmin && (
                                  <span className="text-[7.5px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/15 px-1 py-0.2 rounded uppercase">
                                    Admin
                                  </span>
                                )}
                                {isUserRep && !isCurrentAdmin && (
                                  <span className="text-[7.5px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/15 px-1 py-0.2 rounded uppercase flex items-center gap-0.5">
                                    Rep 👑
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{user.matricNumber}</p>
                              <p className="text-[10px] text-slate-500 font-sans truncate">{user.email}</p>
                              
                              {/* Account status badge */}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[8px] font-mono font-bold uppercase border px-1.5 py-0.5 rounded-md ${status.badgeClass}`} title={status.expiryText}>
                                  {status.label}
                                </span>
                                <span className="text-[8px] font-mono font-bold uppercase border bg-indigo-500/10 text-indigo-300 border-indigo-500/20 px-1.5 py-0.5 rounded-md">
                                  {user.level ? user.level.toUpperCase() : '100L'}
                                </span>
                                <span className="text-[8.5px] text-slate-500 font-mono" title="Subscription Info">
                                  {status.expiryText}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right Block: Actions */}
                          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto pt-2 md:pt-0 border-t border-slate-900 md:border-t-0 justify-end">
                            {/* Toggle Access Clearance Button */}
                            {!isCurrentAdmin ? (
                              <button
                                onClick={() => handleToggleCourseRep(user)}
                                className={`p-1.5 px-2.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border ${
                                  isUserRep 
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-slate-900 hover:text-white hover:border-slate-800' 
                                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-amber-400 hover:border-amber-500/30'
                                }`}
                                title={isUserRep ? 'Revoke representative capabilities' : 'Grant representative clearance'}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{isUserRep ? 'Demote Rep' : 'Make Course Rep'}</span>
                              </button>
                            ) : (
                              <span className="text-[8px] font-mono font-bold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-1 rounded-lg flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                                Master Node
                              </span>
                            )}

                             {/* Give 30 Days Free Ad-Free Subscription Action Button */}
                             {!isCurrentAdmin && (
                               <button
                                 onClick={() => handleGrantFreeAccess(user)}
                                 disabled={isGrantingSub === user.matricNumber}
                                 className={`p-1.5 border rounded-lg text-[10px] font-mono transition-all flex items-center gap-1 cursor-pointer ${
                                   status.isAdminGranted
                                     ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-bold'
                                     : 'bg-slate-950 hover:bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-emerald-400'
                                 }`}
                                 title="Grant Semester-long Free Ad-Free Premium Access"
                               >
                                 {isGrantingSub === user.matricNumber ? (
                                   <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                                 ) : (
                                   <Sparkles className="w-3 h-3 shrink-0 text-amber-400" />
                                 )}
                                 <span>{status.isAdminGranted ? 'Extend Access' : 'Grant Semester Free'}</span>
                               </button>
                             )}
 
                             {/* Revoke Free Ad-Free Access Button */}
                             {!isCurrentAdmin && status.isAdminGranted && (
                               <button
                                 onClick={() => handleRevokeFreeAccess(user)}
                                 disabled={isRevokingSub === user.matricNumber}
                                 className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-lg text-[10px] font-mono transition-all flex items-center gap-1 cursor-pointer"
                                 title="Revoke Free Ad-Free Access"
                               >
                                 {isRevokingSub === user.matricNumber ? (
                                   <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                                 ) : (
                                   <Ban className="w-3 h-3 shrink-0 text-rose-400" />
                                 )}
                                 <span>Revoke Free</span>
                               </button>
                             )}

                            {/* Edit Profile Action Button */}
                            <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditName(user.name || user.displayName || '');
                                  setEditEmail(user.email || '');
                                  setEditMatric(user.matricNumber || user.matric || '');
                                  setEditUserLevel(user.level || '100l');
                                  setEditUserDeptId(user.departmentId || getUserDepartmentId(user) || 'dept-ps-ich');
                                  setEditFormError('');
                                }}
                              className="p-1.5 px-3 bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/25 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-lg text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Edit user details: name, email, and matric number"
                            >
                              <Edit3 className="w-3.5 h-3.5 shrink-0" />
                              <span>Edit Profile</span>
                            </button>

                            {/* Password Reset Action Button */}
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="p-1.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-amber-400 border border-slate-850 rounded-lg text-[10px] font-mono transition-all flex items-center gap-1 cursor-pointer"
                              title="Reset Password profile back to default '123456'"
                            >
                              <KeyRound className="w-3 h-3 shrink-0" />
                              <span>Reset pass</span>
                            </button>

                            {/* Account Purge Button */}
                            {!isCurrentAdmin && (
                              <button
                                onClick={() => handleDeleteUserClick(user)}
                                className="p-1.5 bg-slate-950 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-850 hover:border-rose-500/30 rounded-lg transition-all cursor-pointer"
                                title="Delete user profile permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        </GlassCard>
                      </div>
                    );
                  })
                )}

                {/* Pagination Controls */}
                {filteredUsers.length > usersPerPage && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-900/40 bg-slate-950/20 px-4 py-3 rounded-xl">
                    <span className="text-[11px] font-sans text-slate-400">
                      Showing <span className="font-bold text-slate-200">{Math.min(filteredUsers.length, (currentPage - 1) * usersPerPage + 1)}</span> to{' '}
                      <span className="font-bold text-slate-200">{Math.min(filteredUsers.length, currentPage * usersPerPage)}</span> of{' '}
                      <span className="font-bold text-slate-200">{filteredUsers.length}</span> students
                    </span>
                    
                    <div className="flex items-center gap-1.5 font-mono">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 px-2.5 text-[10px] font-bold rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-450 hover:text-slate-200 hover:border-slate-750 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer outline-none"
                        title="First Page"
                      >
                        &lt;&lt;
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 px-3 text-[10px] font-bold rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-450 hover:text-slate-200 hover:border-slate-750 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 outline-none"
                        title="Previous Page"
                      >
                        &lt; Prev
                      </button>
                      
                      <span className="text-[10px] font-bold text-slate-350 px-3.5 py-1.5 bg-slate-950/80 rounded-xl border border-slate-900/60 shadow-sm">
                        Page <span className="text-indigo-400 font-bold">{currentPage}</span> of <span className="font-semibold text-slate-400">{totalPages}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 px-3 text-[10px] font-bold rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-450 hover:text-slate-200 hover:border-slate-750 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 outline-none"
                        title="Next Page"
                      >
                        Next &gt;
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 px-2.5 text-[10px] font-bold rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-450 hover:text-slate-200 hover:border-slate-750 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer outline-none"
                        title="Last Page"
                      >
                        &gt;&gt;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeAdminTab === 'rep_activities' ? (
          <CourseRepLogsView
            logs={courseRepLogs}
            onBack={() => setActiveAdminTab('dashboard')}
            departments={departments}
          />
        ) : activeAdminTab === 'feedback' ? (
          <FeedbackPage
            user={{
              email: currentUser?.email || '',
              matricNumber: currentUser?.matricNumber || 'Admin',
              name: currentUser?.name || 'Administrator',
              isAdmin: true
            }}
            isAdminMode={true}
          />
        ) : activeAdminTab === 'departments' ? (
          <div className="max-w-4xl mx-auto space-y-6 pb-32">
            <div className="flex items-center gap-2 border-b border-slate-900/60 pb-2.5">
              <GraduationCap className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h3 className="text-sm font-display font-medium text-slate-100">Department Management System</h3>
                <p className="text-[10px] text-slate-505 font-sans mt-0.5">Define academic department routes, matric prefix mapping pattern rules, and assign Course Representatives.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Card 1: Add / Edit Form */}
              <GlassCard className="p-5 bg-slate-950/60 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-indigo-550 via-purple-550 to-indigo-400" />
                
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5 select-none">
                  <Database className="w-4 h-4 text-indigo-400" /> 
                  {editingDeptId ? 'Edit Mapping Configuration' : 'Establish Department Rule'}
                </h4>

                <form onSubmit={handleSaveDepartment} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Department Full Name</label>
                    <input
                      type="text"
                      required
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="e.g., Pure & Applied Chemistry"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-650 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Matric Prefix Pattern</label>
                    <input
                      type="text"
                      required
                      value={deptPrefix}
                      onChange={(e) => setDeptPrefix(e.target.value)}
                      placeholder="e.g., ps/chm"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-650 font-sans font-medium"
                    />
                    <span className="text-[9px] text-slate-500 italic block mt-1 font-sans">
                      Will be matched against student matric numbers (e.g., PS/CHM/0001) to automatically assign them to this department.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Department Level</label>
                    <select
                      value={deptLevel}
                      onChange={(e) => setDeptLevel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans font-medium"
                    >
                      <option value="100l">100L (Freshman)</option>
                      <option value="200l">200L (Sophomore)</option>
                      <option value="300l">300L (Junior)</option>
                      <option value="400l">400L (Senior)</option>
                      <option value="500l">500L (Super Senior)</option>
                    </select>
                    <span className="text-[9px] text-slate-500 italic block mt-1 font-sans">
                      Set the current academic level of students in this department routing segment.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Assign Course Representative</label>
                    <select
                      value={deptCourseRepMatric}
                      onChange={(e) => setDeptCourseRepMatric(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                    >
                      <option value="">-- Select student as Course Rep (Optional) --</option>
                      {users
                        .filter(u => !u.isAdmin)
                        .map(u => (
                          <option key={u.matricNumber} value={u.matricNumber}>
                            {u.name} ({u.matricNumber})
                          </option>
                        ))}
                    </select>
                    <span className="text-[9px] text-slate-500 italic block mt-1 font-sans">
                      Assigning a student makes them a Course Representative with broadcasting and scheduling privileges for this department.
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {editingDeptId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeptId(null);
                          setDeptName('');
                          setDeptPrefix('');
                          setDeptCourseRepMatric('');
                          setDeptLevel('100l');
                        }}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer box-border select-none border border-slate-855 outline-none"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingDept || !deptName.trim() || !deptPrefix.trim()}
                      className="flex-1 py-2.5 bg-gradient-to-r from-indigo-550 to-indigo-650 hover:from-indigo-450 hover:to-indigo-550 disabled:opacity-50 text-white font-sans font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-indigo-300/10 outline-none select-none"
                    >
                      {isSavingDept ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>{isSavingDept ? 'Establishing Rule...' : editingDeptId ? 'Update Config' : 'Create Map Rule'}</span>
                    </button>
                  </div>
                </form>
              </GlassCard>

              {/* Card 2: List Established Mappings */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold text-slate-450 uppercase tracking-widest pl-1 select-none">
                  Established Departments ({departments.length})
                </h4>

                {departments.length === 0 ? (
                  <GlassCard className="p-8 text-center border-slate-900 bg-slate-950/20">
                    <GraduationCap className="w-8 h-8 text-slate-600 mx-auto mb-3 opacity-50" />
                    <p className="text-xs text-slate-500 font-sans">No custom departments established yet.</p>
                    <p className="text-[10px] text-slate-600 font-sans mt-1">Configure your first department prefix in the form to begin routing student activity schedules.</p>
                  </GlassCard>
                ) : (
                  departments.map(dept => {
                    const repUser = users.find(u => u.matricNumber === dept.courseRepMatric);
                    return (
                      <div key={dept.id}>
                        <GlassCard className="p-4 bg-slate-950/40 border-slate-900/40 transition-all hover:bg-slate-950/60">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 min-w-0 flex-1">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-xs font-sans font-bold text-slate-200">{dept.name}</h5>
                                  <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 uppercase select-none">
                                    {dept.prefix}
                                  </span>
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 uppercase select-none">
                                    {(dept.level || '100l').toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Route ID: <span className="font-mono text-slate-400">{dept.id}</span></p>
                              </div>

                              <div className="p-2 bg-slate-950/70 border border-slate-900 rounded-xl flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <div className="min-w-0">
                                  <h6 className="text-[10px] font-sans font-medium text-slate-300 truncate">
                                    {repUser ? `Rep: ${repUser.name}` : 'No Course Rep assigned'}
                                  </h6>
                                  <p className="text-[9px] text-slate-500 font-mono truncate">
                                    {dept.courseRepMatric || 'Add representative to delegate permissions'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditDepartment(dept)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-850 hover:border-slate-800 rounded-lg transition-all cursor-pointer select-none outline-none"
                                title="Edit Mapping Configuration"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                                className="p-1.5 bg-slate-950 hover:bg-rose-950/40 text-slate-500 hover:text-rose-450 border border-slate-850 hover:border-rose-500/30 rounded-lg transition-all cursor-pointer select-none outline-none"
                                title="Delete Department Mapping"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </GlassCard>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : activeAdminTab === 'traffic_payments' ? (
          <div className="max-w-5xl mx-auto space-y-6 pb-32 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400 shrink-0 animate-pulse" />
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-100 font-bold">App Traffic & Financial Analytics</h3>
                  <p className="text-[10px] text-slate-450 font-sans mt-0.5">Live metrics tracking app traffic hits synchronized with standard semester student subscription fee revenues.</p>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-900">
                Total Revenue: <span className="text-indigo-400 font-bold font-sans text-sm">₦{(paymentsList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)).toLocaleString()}</span>
              </div>
            </div>

            {/* Apps Traffic Metrics Cards Grid */}
            {(() => {
              const nowTime = new Date().getTime();
              
              const dailyTraffic = trafficList.filter(t => {
                const tDate = new Date(t.timestamp || t.registeredAt || 0);
                return (nowTime - tDate.getTime()) <= 24 * 60 * 60 * 1000;
              }).length;

              const weeklyTraffic = trafficList.filter(t => {
                const tDate = new Date(t.timestamp || t.registeredAt || 0);
                return (nowTime - tDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
              }).length;

              const monthlyTraffic = trafficList.filter(t => {
                const tDate = new Date(t.timestamp || t.registeredAt || 0);
                return (nowTime - tDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
              }).length;

              const revenueAmount = paymentsList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <GlassCard className="p-4 bg-slate-950/40 border-slate-900/60 relative">
                    <Activity className="w-8 h-8 text-cyan-400/20 absolute right-4 top-4 font-black" />
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 font-bold">Daily App Traffic</h4>
                    <p className="text-2xl font-display font-black text-cyan-400 mt-1">{dailyTraffic}</p>
                    <div className="text-[10px] text-slate-450 mt-2 flex items-center gap-1.5 font-mono">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                      <span>Last 24 hrs active users</span>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 bg-slate-950/40 border-slate-900/60 relative">
                    <TrendingUp className="w-8 h-8 text-indigo-400/20 absolute right-4 top-4 font-black" />
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 font-bold">Weekly App Traffic</h4>
                    <p className="text-2xl font-display font-black text-indigo-400 mt-1">{weeklyTraffic}</p>
                    <div className="text-[10px] text-slate-450 mt-2 flex items-center gap-1.5 font-mono">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      <span>Last 7 days unique sessions</span>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 bg-slate-950/40 border-slate-900/60 relative">
                    <BarChart2 className="w-8 h-8 text-violet-400/20 absolute right-4 top-4 font-black" />
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 font-bold">Monthly App Traffic</h4>
                    <p className="text-2xl font-display font-black text-violet-400 mt-1">{monthlyTraffic}</p>
                    <div className="text-[10px] text-slate-450 mt-2 flex items-center gap-1.5 font-mono">
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
                      <span>Last 30 days overall hits</span>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 bg-slate-950/40 border-slate-900/60 relative bg-emerald-950/5">
                    <Coins className="w-8 h-8 text-emerald-400/20 absolute right-4 top-4 font-black" />
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 font-bold">Gross Revenue</h4>
                    <p className="text-2xl font-display font-black text-emerald-400 mt-1">₦{revenueAmount.toLocaleString()}</p>
                    <div className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1.5 font-mono">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span>Semester collection pool</span>
                    </div>
                  </GlassCard>
                </div>
              );
            })()}

            {/* Payments Table */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Transaction Audit History</h4>
              </div>

              <GlassCard className="bg-slate-950/40 border-slate-900 p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 select-none">
                        <th className="py-3.5 px-4 font-bold">Student Details</th>
                        <th className="py-3.5 px-4 font-bold">Matric Number</th>
                        <th className="py-3.5 px-4 font-bold">Transaction Ref</th>
                        <th className="py-3.5 px-4 font-bold">Amount Paid</th>
                        <th className="py-3.5 px-4 font-bold">Processed Date</th>
                        <th className="py-3.5 px-4 font-bold text-center">Gateway Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/20">
                      {paymentsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-550 font-mono">
                            No processed payment receipts detected on database channels.
                          </td>
                        </tr>
                      ) : (
                        paymentsList.map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-950/30 transition-colors text-xs font-sans">
                            {/* Student Details */}
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-200">{payment.name || 'Student'}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{payment.email || 'N/A'}</div>
                            </td>
                            {/* Matric Number */}
                            <td className="py-3.5 px-4 font-mono select-all text-slate-300 pb-1">
                              {payment.matricNumber || 'N/A'}
                            </td>
                            {/* Reference */}
                            <td className="py-3.5 px-4 font-mono select-all text-indigo-400 text-[11px]">
                              {payment.reference || payment.id}
                            </td>
                            {/* Amount */}
                            <td className="py-3.5 px-4 font-bold text-slate-200 font-sans">
                              ₦{(Number(payment.amount) || 0).toLocaleString()}
                            </td>
                            {/* Processed Date */}
                            <td className="py-3.5 px-4 font-mono text-[10.5px] text-slate-400">
                              {payment.paidAt ? new Date(payment.paidAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'N/A'}
                            </td>
                            {/* Status */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                SUCCESS
                              </span>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </div>
        ) : activeAdminTab === 'messages' ? (
          <div className="max-w-4xl mx-auto space-y-6 pb-32">
            <div className="flex items-center gap-2 border-b border-slate-900/60 pb-2.5 animate-fadeIn">
              <MessageSquare className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h3 className="text-sm font-display font-medium text-slate-100">In-App Messages Configurator</h3>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Draft, schedule and publish dynamic overlay alerts and header floating messages to student terminals.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-fadeIn">
              {/* Form Configurator */}
              <GlassCard className="p-5 bg-slate-950/60 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-indigo-550 via-purple-550 to-indigo-400" />
                
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5 select-none">
                  <Plus className="w-4 h-4 text-indigo-400" /> Configure Overlay Message
                </h4>

                <div className="space-y-4 text-left">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Message Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Scheduled Maintenance"
                      value={msgTitle}
                      onChange={(e) => setMsgTitle(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>

                  {/* Body */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Message Body Content</label>
                    <textarea
                      placeholder="Provide the explanation or announcement detail..."
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                      rows={4}
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans placeholder:text-slate-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Style */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Display Style</label>
                      <select
                        value={msgStyle}
                        onChange={(e: any) => setMsgStyle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-sans"
                      >
                        <option value="modal">Epic Modal Overlay</option>
                        <option value="banner">Floating Header Banner</option>
                      </select>
                    </div>

                    {/* Target */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Target Audience</label>
                      <select
                        value={msgTarget}
                        onChange={(e) => setMsgTarget(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-sans"
                      >
                        <option value="all">All Departments</option>
                        {departments && departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.prefix || dept.name} Student
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Action button text */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Button Text (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Check Deadlines"
                        value={msgBtnText}
                        onChange={(e) => setMsgBtnText(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans"
                      />
                    </div>

                    {/* Redirect link/tab */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Button Redirect Link</label>
                      <select
                        value={msgBtnLink}
                        onChange={(e) => setMsgBtnLink(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-sans"
                      >
                        <option value="">No Button Redirect</option>
                        <option value="deadlines">Navigate: Deadlines Tab</option>
                        <option value="announcements">Navigate: Broadcasts Tab</option>
                        <option value="modules">Navigate: Modules Tab</option>
                        <option value="schedule">Navigate: Schedule Tab</option>
                      </select>
                    </div>
                  </div>

                  {msgError && (
                    <p className="text-[10px] text-rose-400 font-medium font-sans">⚠️ {msgError}</p>
                  )}
                  {msgSuccess && (
                    <p className="text-[10.5px] text-emerald-400 font-medium font-sans">✨ {msgSuccess}</p>
                  )}

                  <button
                    type="button"
                    disabled={isPublishingMsg || !msgTitle.trim() || !msgBody.trim()}
                    onClick={handlePublishInAppMsg}
                    className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-550 border border-indigo-500/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 outline-none"
                  >
                    {isPublishingMsg ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                    <span>Publish In-App Message</span>
                  </button>
                </div>
              </GlassCard>

              {/* Logs & active overlays */}
              <GlassCard className="p-5 bg-slate-950/60 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-violet-500 via-indigo-500 to-indigo-400" />

                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5 select-none text-left">
                  <Database className="w-4 h-4 text-violet-400" /> Active Registry ({localInApps.length})
                </h4>

                {localInApps.length === 0 ? (
                  <div className="py-12 text-center select-none">
                    <p className="text-xs text-slate-500 font-sans italic">No customized manual overlay alerts configured yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {localInApps.map((msg: any) => (
                      <div key={msg.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between gap-3 text-left">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              msg.style === 'modal' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}>
                              {msg.style}
                            </span>
                            <span className="text-[8px] font-mono text-slate-500">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-200 truncate">{msg.title}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed font-sans">{msg.body}</p>
                          <p className="text-[8.5px] font-mono text-slate-500 mt-2">
                            Audience: <span className="text-indigo-450 font-bold uppercase">{msg.targetDepartmentId === 'all' ? 'All Departments' : 'Specific Dept'}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-800/50 pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleInAppMsgActive(msg.id, msg.active)}
                            className={`p-1 px-2.5 rounded text-[8.5px] font-mono font-bold uppercase border cursor-pointer outline-none transition-colors ${
                              msg.active 
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 animate-pulse' 
                                : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-355'
                            }`}
                          >
                            {msg.active ? 'Active' : 'Draft'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInAppMsg(msg.id)}
                            className="p-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-550/15 text-rose-450 hover:text-rose-400 rounded text-[8.5px] font-mono uppercase tracking-wider cursor-pointer outline-none transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 pb-32">
            <div className="flex items-center gap-2 border-b border-slate-900 db-2.5">
              <Settings className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h3 className="text-sm font-display font-bold text-slate-200">System Command Settings</h3>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Configure system parameters, semester billing gates, and credentials synchronization.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-fadeIn">
              {/* Card 1: Academic Semester Access & Billing */}
              <GlassCard className="p-6 bg-slate-950/60 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-emerald-500 via-teal-500 to-indigo-500" />
                
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-450" /> Academic Semester Control
                </h4>

                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-sans">Current Portal Mode:</span>
                      <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                        semesterConfig.semesterActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {semesterConfig.semesterActive ? '● SEMESTER STARTED' : '● SEMESTER ENDED'}
                      </span>
                    </div>

                    <div className="h-px bg-slate-900" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-sans">Student Pass Fee:</span>
                      <span className="text-xs text-slate-200 font-mono font-black">₦1,000 / semester</span>
                    </div>

                    {semesterConfig.semesterActive && semesterConfig.semesterStartedAt && (
                      <>
                        <div className="h-px bg-slate-900" />
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-[10px] text-slate-500 font-sans">Commencement Date:</span>
                          <span className="text-[10.5px] text-indigo-300 font-mono">
                            {new Date(semesterConfig.semesterStartedAt).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-450 leading-relaxed font-sans">
                    Click <strong>Start Semester</strong> to record active commencement date and enable student ₦1,000 payments on profiles. Click <strong>End Semester</strong> to immediately refresh student payments and lock their access.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isUpdatingSemester || semesterConfig.semesterActive}
                      onClick={handleStartSemester}
                      className="py-2.5 px-3 bg-gradient-to-tr from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:opacity-30 disabled:scale-100 disabled:shadow-none rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 shadow-md shadow-emerald-500/10 active:scale-95"
                    >
                      {isUpdatingSemester ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>Start Semester</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUpdatingSemester || !semesterConfig.semesterActive}
                      onClick={handleEndSemester}
                      className="py-2.5 px-3 bg-gradient-to-tr from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white disabled:opacity-30 disabled:scale-100 disabled:shadow-none rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 shadow-md active:scale-95"
                    >
                      {isUpdatingSemester ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      <span>End Semester</span>
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Card: Anonymous Chat Portal Control */}
              <GlassCard className="p-6 bg-slate-950/60 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-indigo-500 via-purple-500 to-pink-500" />
                
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
                  <MessageSquare className="w-4 h-4 text-indigo-400" /> Anonymous Chat Control
                </h4>
                <p className="text-[10px] text-slate-400 mb-4 font-sans leading-normal">
                  Toggle student anonymous chat access. When activated, a floating subpanel allows real-time interactive chats dynamically overlayed on profile terminals.
                </p>

                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-sans">Chat Subpanel Status:</span>
                      <button
                        type="button"
                        disabled={isUpdatingChat}
                        onClick={() => handleToggleChat(!chatConfig.enabled)}
                        className={`text-[9.5px] font-mono font-bold px-3 py-1 rounded-full border cursor-pointer select-none transition-all duration-300 outline-none ${
                          chatConfig.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                        }`}
                      >
                        {chatConfig.enabled ? '● ACTIVE / SHOWN' : '○ DEACTIVATED'}
                      </button>
                    </div>

                    <div className="h-px bg-slate-900" />

                    <div className="space-y-1 text-left">
                      <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-450 block">Who can access the chat?</label>
                      <select
                        disabled={isUpdatingChat}
                        value={chatConfig.visibility}
                        onChange={(e) => handleUpdateChatVisibility(e.target.value as 'paid' | 'all')}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                      >
                        <option value="paid">Paid Access Students Only (Admin Verified)</option>
                        <option value="all">Everyone (All Registered Students)</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans italic text-left">
                    * The dynamic badge will show the live number of concurrent viewer heartbeats. Sound updates run on new incoming room alerts.
                  </p>
                </div>
              </GlassCard>

              {/* Card 2: Security Credentials Control */}
              <GlassCard className="p-6 bg-slate-950/60 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-indigo-550 via-purple-550 to-pink-500" />
                
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" /> Security Credentials
                </h4>

              <form onSubmit={handleChangeAdminPassword} className="space-y-4">
                {passError && (
                  <div className="p-3 rounded-xl bg-rose-550/10 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed">
                    {passError}
                  </div>
                )}

                {passSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                    {passSuccess}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Current Admin Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPassError('');
                        setPassSuccess('');
                      }}
                      placeholder="Enter current password"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">New Security Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPassError('');
                        setPassSuccess('');
                      }}
                      placeholder="Enter new password (min. 6 chars)"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Re-Enter New Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPassError('');
                        setPassSuccess('');
                      }}
                      placeholder="Re-enter new password"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 flex gap-2">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Updating your password will instantly refresh local caching state tables and sync credentials with the Firestore cloud databases. Keep this secure.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPass || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-450 hover:to-violet-550 disabled:opacity-50 text-white font-sans font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-indigo-300/10"
                >
                  {isChangingPass ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{isChangingPass ? 'Updating Credentials...' : 'Save Security Key'}</span>
                </button>
              </form>
            </GlassCard>

            {/* Card 3: App Version & OTA Release Hub */}
            <GlassCard className="p-6 bg-slate-950/60 border-slate-900 relative md:col-span-2">
              <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-l from-emerald-500 via-indigo-500 to-violet-600" />
              
              <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" /> App Version & OTA Release Hub
              </h4>
              <p className="text-[10px] text-slate-400 mb-4 font-sans leading-normal">
                Publish over-the-air updates to all student dashboards. When you publish a new software version number, students will instantly see an "Update Available" banner in their profiles.
              </p>

              <form onSubmit={handlePublishNewVersion} className="space-y-4">
                {versionPubError && (
                  <div className="p-3 rounded-xl bg-rose-550/10 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed">
                    {versionPubError}
                  </div>
                )}

                {versionPubSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                    {versionPubSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Current Active Release</label>
                    <div className="bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-900 text-slate-300 text-xs font-mono">
                      v{appVersionConfig.latestVersion || '1.2.0'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">New Software Version</label>
                    <input
                      type="text"
                      required
                      value={newVersionInput}
                      onChange={(e) => {
                        setNewVersionInput(e.target.value);
                        setVersionPubError('');
                        setVersionPubSuccess('');
                      }}
                      placeholder="e.g., 1.3.6"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Release Notes & Package Details</label>
                  <textarea
                    required
                    value={newReleaseNotesInput}
                    onChange={(e) => {
                      setNewReleaseNotesInput(e.target.value);
                      setVersionPubError('');
                      setVersionPubSuccess('');
                    }}
                    rows={3}
                    placeholder="Explain features or performance patches (e.g., 🚀 Resolved minor bottlenecks on Android, optimized viewport height rendering on iOS layouts, updated database queries)."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 font-sans resize-none leading-relaxed"
                  />
                </div>

                {/* Save and Publish Button */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isPublishingVersion || !newVersionInput.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-650 hover:from-emerald-500 hover:to-indigo-550 disabled:opacity-50 text-white font-sans font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-400/10 focus:outline-none"
                  >
                    {isPublishingVersion ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{isPublishingVersion ? 'Saving Release...' : 'Save OTA Config'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBroadcastPushUpdate}
                    disabled={isSendingPushUpdate || !newVersionInput.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-sans font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-400/10 focus:outline-none"
                  >
                    {isSendingPushUpdate ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5 text-indigo-300" />
                    )}
                    <span>{isSendingPushUpdate ? 'Broadcasting...' : 'Broadcast Push Notification'}</span>
                  </button>
                </div>

                {pushUpdateError && (
                  <div className="p-3 rounded-xl bg-rose-550/10 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed animate-fadeIn">
                    {pushUpdateError}
                  </div>
                )}

                {pushUpdateSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed animate-fadeIn">
                    {pushUpdateSuccess}
                  </div>
                )}
              </form>
            </GlassCard>
          </div>
        </div>
      )}

      </main>

      {/* Admin Panel Footing Info */}
      <footer className="py-6 border-t border-slate-900 mt-12 bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-[10px] text-slate-550 font-mono leading-relaxed">
            ICH100L Chemistry Command Console Portal &bull; Designed for Ultimate Performance, Offline Compatibility & Live Student Management
          </p>
        </div>
      </footer>

      {/* Custom Purge Confirmation Overlay */}
      <AnimatePresence>
        {userToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#070b13]/85 backdrop-blur-md flex items-center justify-center p-4 shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-slate-950 border border-rose-500/30 rounded-3xl p-6 max-w-sm w-full shadow-[0_20px_50px_rgba(239,68,68,0.15)] relative overflow-hidden"
            >
              {/* Decorative top danger bar */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 animate-pulse" />
              
              <div className="flex flex-col items-center text-center mt-2">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 animate-bounce">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                
                <h3 className="text-sm font-display font-black tracking-wider uppercase text-white">Confirm User Purge</h3>
                
                <p className="text-xs text-slate-400 mt-2.5 font-sans leading-relaxed">
                  You are about to permanently delete <span className="text-rose-450 font-bold font-mono text-slate-200">{userToDelete.name}</span> (<span className="text-slate-350 font-mono text-xs text-rose-400">{userToDelete.matricNumber}</span>) from the system databases.
                </p>

                <div className="p-3 bg-[#0a0f1d] rounded-2xl border border-slate-900 mt-4 text-left w-full">
                  <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                    &bull; This user will be deleted from student registries.<br/>
                    &bull; Dynamic sessions and subscriptions will be invalidated.<br/>
                    &bull; This action cannot be reverted.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full mt-6">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border border-slate-850"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUserConfirmed}
                    className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-550 text-white rounded-xl text-xs font-sans font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer border-0"
                  >
                    Confirm Deletion
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Adding Student Provisioning */}
      {activeAdminTab === 'dashboard' && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            setIsAddUserOpen(true);
          }}
          className="fixed bottom-24 right-6 z-40 w-14 h-14 bg-gradient-to-tr from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(239,68,68,0.4)] cursor-pointer group border border-white/10"
          title="Provision New Student Profile"
        >
          <Plus className="w-6 h-6 transition-transform group-hover:rotate-90 duration-300" />
        </motion.button>
      )}

      {/* Dynamic Pop-up Modal: User Provisioning Terminal */}
      <AnimatePresence>
        {isAddUserOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#070b13]/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              {/* Hot neon ambient color bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500" />
              
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-rose-500" />
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">Provision Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-lg text-[10px] font-mono cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed">
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                    {formSuccess}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Student Name</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        setFormError('');
                        setFormSuccess('');
                      }}
                      placeholder="e.g. Samuel Alao"
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        setFormError('');
                        setFormSuccess('');
                      }}
                      placeholder="e.g. samuel@ich100l.edu"
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block flex justify-between">
                    <span>Student Matric Number</span>
                    <span className="text-[8px] text-slate-500 lowercase font-mono">{getExpectedMatricFormat()}</span>
                  </label>
                  <div className="relative font-mono">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={newMatric}
                      onChange={(e) => {
                        setNewMatric(e.target.value);
                        setFormError('');
                        setFormSuccess('');
                      }}
                      placeholder="e.g. 2026/ps/ich/0045"
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-650 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Student Academic Level</label>
                  <select
                    value={newUserLevel}
                    onChange={(e) => {
                      setNewUserLevel(e.target.value);
                      setFormError('');
                      setFormSuccess('');
                    }}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-sans cursor-pointer"
                  >
                    <option value="100l">100L</option>
                    <option value="200l">200L</option>
                    <option value="300l">300L</option>
                    <option value="400l">400L</option>
                    <option value="500l">500L</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Student Department</label>
                  <select
                    value={newUserDeptId}
                    onChange={(e) => {
                      setNewUserDeptId(e.target.value);
                      setFormError('');
                      setFormSuccess('');
                    }}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-sans cursor-pointer"
                  >
                    {departments.map((dept: any) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.prefix || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Provision Info Alert */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-455 shrink-0 mt-0.5" />
                  <p className="text-[9.5px] text-slate-400 font-sans leading-relaxed">
                    <strong>Auto-parameters initialized:</strong> Password will be compiled as <span className="text-amber-400 font-mono font-bold">123456</span> on creation. Billing registry checks, local profile caching & trial bounds are generated dynamically.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSaving || !newName.trim() || !newEmail.trim() || !newMatric.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-400 hover:to-amber-500 disabled:opacity-50 text-white font-sans font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-rose-300/10"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? 'Provisioning...' : 'Provision Student'}</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Modal: User Editing Terminal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#070b13]/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden text-left"
            >
              {/* Neon accent bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">Edit User Profile</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-lg text-[10px] font-mono cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleEditUserSubmit} className="space-y-4">
                {editFormError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed font-sans">
                    {editFormError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Student Name</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setEditFormError('');
                      }}
                      placeholder="Full Name"
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => {
                        setEditEmail(e.target.value);
                        setEditFormError('');
                      }}
                      placeholder="e.g. student@ich100l.edu"
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-605 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block flex justify-between">
                    <span>Student Matric Number</span>
                    <span className="text-[8px] text-slate-500 lowercase font-mono">{getExpectedMatricFormat()}</span>
                  </label>
                  <div className="relative font-mono">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={editMatric}
                      onChange={(e) => {
                        setEditMatric(e.target.value);
                        setEditFormError('');
                      }}
                      placeholder="Matric Number"
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-655 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Student Academic Level</label>
                  <select
                    value={editUserLevel}
                    onChange={(e) => {
                      setEditUserLevel(e.target.value);
                      setEditFormError('');
                    }}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                  >
                    <option value="100l">100L</option>
                    <option value="200l">200L</option>
                    <option value="300l">300L</option>
                    <option value="400l">400L</option>
                    <option value="500l">500L</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Student Department</label>
                  <select
                    value={editUserDeptId}
                    onChange={(e) => {
                      setEditUserDeptId(e.target.value);
                      setEditFormError('');
                    }}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                  >
                    {departments.map((dept: any) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.prefix || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 flex gap-2">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[9.5px] text-slate-405 font-sans leading-relaxed">
                    Changing the matric number will write a new entry with the updated ID in Cloud Firestore and delete the old entry. Local caches will synchronize immediately.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isEditSaving || !editName.trim() || !editEmail.trim() || !editMatric.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-550 to-indigo-600 hover:from-indigo-450 hover:to-indigo-550 disabled:opacity-50 text-white font-sans font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-indigo-300/10"
                >
                  {isEditSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Edit3 className="w-3.5 h-3.5" />
                  )}
                  <span>{isEditSaving ? 'Saving Updates...' : 'Commit Changes'}</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Navigation Menu for Admin */}
      <nav
        id="admin-bottom-navigation"
        className="fixed bottom-6 left-4 right-4 z-40 max-w-[470px] mx-auto bg-slate-950/80 backdrop-blur-xl border border-slate-850/90 rounded-full px-4 py-0.5 shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveAdminTab('dashboard')}
            className="relative flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-300 rounded-xl outline-none cursor-pointer"
          >
            <div
              className={`flex items-center justify-center p-1.5 rounded-lg transition-all duration-300 ${
                activeAdminTab === 'dashboard'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span
              className={`text-[9.5px] mt-0.5 font-medium tracking-wide font-sans transition-colors duration-300 ${
                activeAdminTab === 'dashboard' ? 'text-indigo-300' : 'text-slate-500'
              }`}
            >
              Dashboard
            </span>
            {activeAdminTab === 'dashboard' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('feedback')}
            className="relative flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-300 rounded-xl outline-none cursor-pointer"
          >
            {unreadFeedbacksCount > 0 && activeAdminTab !== 'feedback' && (
              <span className="absolute top-0.5 right-1.5 bg-rose-500 text-white font-sans text-[8px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center animate-pulse z-10 shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                {unreadFeedbacksCount}
              </span>
            )}
            <div
              className={`flex items-center justify-center p-1.5 rounded-lg transition-all duration-300 ${
                activeAdminTab === 'feedback'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </div>
            <span
              className={`text-[9.5px] mt-0.5 font-medium tracking-wide font-sans transition-colors duration-300 ${
                activeAdminTab === 'feedback' ? 'text-indigo-300' : 'text-slate-500'
              }`}
            >
              Feedback
            </span>
            {activeAdminTab === 'feedback' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('departments')}
            className="relative flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-300 rounded-xl outline-none cursor-pointer"
          >
            <div
              className={`flex items-center justify-center p-1.5 rounded-lg transition-all duration-300 ${
                activeAdminTab === 'departments'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
            </div>
            <span
              className={`text-[9.5px] mt-0.5 font-medium tracking-wide font-sans transition-colors duration-300 ${
                activeAdminTab === 'departments' ? 'text-indigo-300' : 'text-slate-500'
              }`}
            >
              Depts
            </span>
            {activeAdminTab === 'departments' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('traffic_payments')}
            className="relative flex flex-col items-center justify-center py-1 px-2 transition-all duration-300 rounded-xl outline-none cursor-pointer"
          >
            <div
              className={`flex items-center justify-center p-1.5 rounded-lg transition-colors duration-300 ${
                activeAdminTab === 'traffic_payments'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <span
              className={`text-[9.5px] mt-0.5 font-medium tracking-wide font-sans transition-colors duration-300 ${
                activeAdminTab === 'traffic_payments' ? 'text-indigo-300' : 'text-slate-505'
              }`}
            >
              Analytics
            </span>
            {activeAdminTab === 'traffic_payments' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('messages')}
            className="relative flex flex-col items-center justify-center py-1 px-2 transition-all duration-300 rounded-xl outline-none cursor-pointer"
          >
            <div
              className={`flex items-center justify-center p-1.5 rounded-lg transition-all duration-300 ${
                activeAdminTab === 'messages'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
            </div>
            <span
              className={`text-[9.5px] mt-0.5 font-medium tracking-wide font-sans transition-colors duration-300 ${
                activeAdminTab === 'messages' ? 'text-indigo-300' : 'text-slate-505'
              }`}
            >
              Messages
            </span>
            {activeAdminTab === 'messages' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('settings')}
            className="relative flex flex-col items-center justify-center py-1 px-2 transition-all duration-300 rounded-xl outline-none cursor-pointer"
          >
            <div
              className={`flex items-center justify-center p-1.5 rounded-lg transition-all duration-300 ${
                activeAdminTab === 'settings'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
            </div>
            <span
              className={`text-[9.5px] mt-0.5 font-medium tracking-wide font-sans transition-colors duration-300 ${
                activeAdminTab === 'settings' ? 'text-indigo-300' : 'text-slate-505'
              }`}
            >
              Settings
            </span>
            {activeAdminTab === 'settings' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
