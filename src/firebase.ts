import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Dynamic configuration from provisioning
export const DEFAULT_FIREBASE_CONFIG = firebaseConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const firestoreDbId = "firestoreDatabaseId" in firebaseConfig && (firebaseConfig as any).firestoreDatabaseId
  ? (firebaseConfig as any).firestoreDatabaseId
  : undefined;

// Use initializeFirestore with experimentalForceLongPolling to prevent iframe proxy timeout / websocket disruption
export const db = firestoreDbId
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, firestoreDbId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const auth = getAuth(app);

// Defined enum according to guidelines
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
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Error handler complying with instruction JSON format requirements
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error logged: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection on Boot
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Attempt standard single server fetch
    await getDocFromServer(doc(db, 'system_test_connection', 'ping'));
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("Firebase Connection check: ", msg);
    return { success: false, error: msg };
  }
}
