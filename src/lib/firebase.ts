/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  getDocs, 
  collection, 
  onSnapshot, 
  deleteDoc, 
  updateDoc,
  query,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// Use the applet configuration to ensure we are connecting to the correct sandboxed database instance
const firebaseConfig = {
  apiKey: appletConfig.apiKey || "AIzaSyDasXOCsqxwer5TJEkw8boKtnxk_KHCT0o",
  authDomain: appletConfig.authDomain || "ich100l.firebaseapp.com",
  projectId: appletConfig.projectId || "ich100l",
  storageBucket: appletConfig.storageBucket || "ich100l.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || "957173852676",
  appId: appletConfig.appId || "1:957173852676:web:c87374af6a8e02afefa351",
  measurementId: appletConfig.measurementId || "G-X7T2126SDY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: true
}, appletConfig.firestoreDatabaseId);

// Enable offline persistence for seamless local state fallback
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore multi-tab persistence precondition failed, falling back to cached state.');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all features required for multi-tab persistence, try single tab
        enableIndexedDbPersistence(db).catch((e) => {
          console.warn('Firestore single-tab persistence failed to initialize: ', e.message);
        });
      } else {
        console.warn('Firestore persistence error: ', err.message);
      }
    });
}

// Test connection on boot to verify correct synchronization
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system-config', 'app-branding'));
    console.log("Firebase server connection initialized.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection.");
    } else {
      console.log("Firebase operating in offline/cached mode.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('ich100l_current_matric') || 'anonymous',
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function cleanData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanData) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = (obj as any)[key];
        if (val !== undefined) {
          cleaned[key] = cleanData(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export function getSafeDocId(id: string): string {
  if (!id) return '';
  return id.trim().replace(/\//g, '-');
}

export interface CourseRepActivityLog {
  id: string;
  repName: string;
  repMatric: string;
  action: 'add' | 'edit' | 'delete';
  targetType: 'schedule' | 'deadline' | 'announcement' | 'course' | 'pdf' | 'video';
  targetId: string;
  targetName: string;
  timestamp: string; // ISO String
  details?: string;
  departmentId?: string;
}

export async function logCourseRepActivity(
  action: 'add' | 'edit' | 'delete',
  targetType: 'schedule' | 'deadline' | 'announcement' | 'course' | 'pdf' | 'video',
  targetId: string,
  targetName: string,
  repName: string,
  repMatric: string,
  departmentId?: string,
  details?: string
) {
  const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const logDoc: CourseRepActivityLog = {
    id: logId,
    repName,
    repMatric,
    action,
    targetType,
    targetId,
    targetName,
    timestamp: new Date().toISOString(),
    details,
    departmentId
  };
  try {
    await setDoc(doc(db, 'course_rep_logs', logId), cleanData(logDoc));
    console.log(`Course rep log recorded: ${action} ${targetType} - ${targetName}`);
  } catch (err) {
    console.warn('Failed to write course rep log info:', err);
  }
}

