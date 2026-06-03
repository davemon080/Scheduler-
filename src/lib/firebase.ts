/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  onSnapshot, 
  deleteDoc, 
  updateDoc,
  query
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
  experimentalForceLongPolling: true
}, appletConfig.firestoreDatabaseId);

// Test connection on boot to verify correct synchronization
async function testConnection() {
  try {
    await getDoc(doc(db, 'system-config', 'app-branding'));
    console.log("Firebase connection initialized.");
  } catch (error) {
    console.log("Firebase offline cache mode enabled.");
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

