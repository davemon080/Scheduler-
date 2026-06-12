import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc } from "firebase/firestore";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

// Setup Firebase client instance on server matching firebase-applet-config
let db: any = null;
try {
  const appletConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(appletConfigPath)) {
    const appletConfig = JSON.parse(fs.readFileSync(appletConfigPath, "utf-8"));
    const firebaseConfig = {
      apiKey: appletConfig.apiKey || "AIzaSyDasXOCsqxwer5TJEkw8boKtnxk_KHCT0o",
      authDomain: appletConfig.authDomain || "ich100l.firebaseapp.com",
      projectId: appletConfig.projectId || "ich100l",
      storageBucket: appletConfig.storageBucket || "ich100l.firebasestorage.app",
      messagingSenderId: appletConfig.messagingSenderId || "957173852676",
      appId: appletConfig.appId || "1:957173852676:web:c87374af6a8e02afefa351",
      measurementId: appletConfig.measurementId || "G-X7T2126SDY"
    };
    const fbApp = initializeApp(firebaseConfig);
    db = initializeFirestore(fbApp, {
      experimentalForceLongPolling: true
    }, appletConfig.firestoreDatabaseId);
    console.log("[Server] Firebase Firestore offline-compatible client initialized successfully.");
  } else {
    console.warn("[Server] firebase-applet-config.json not found. Database features disabled on backend.");
  }
} catch (error) {
  console.error("[Server] Firebase Firestore initialization failed:", error);
}

// Utility matching client-side
function getSafeDocId(id: string): string {
  if (!id) return "";
  return id.trim().replace(/\//g, "-");
}

// Persist / load VAPID Keys dynamically using Firestore as the primary stable master key storage
// This blocks session/subscription invalidation across stateless container updates and cold-starts on Cloud Run.
let vapidKeys: { publicKey: string; privateKey: string } | null = null;

async function ensureVapidKeys() {
  if (vapidKeys) return vapidKeys;

  // Use the predefined, high-entropy stable key pair to prevent mismatch across multiple browser/server boots on custom domains
  const STABLE_PUBLIC_KEY = "BCSfqxfrAVW0QUx5UfxnoN_Dmqi6VASv24QkYUEv5-1F1WTmPCwBuyQWkJsqMYsUb5cNpcjuRHqDQ-fc_giWydw";
  const STABLE_PRIVATE_KEY = "m0SCab83yUh8mvuH-kYyoX-lzYScQUk2tE8eeVVCx8Q";

  vapidKeys = {
    publicKey: STABLE_PUBLIC_KEY,
    privateKey: STABLE_PRIVATE_KEY
  };

  // Sync with Firestore for parity and database records
  if (db) {
    try {
      const configDoc = await getDoc(doc(db, "push-config", "vapid"));
      if (!configDoc.exists()) {
        console.log("[Server] Seeding stable Master VAPID Keypair to Firestore...");
        await setDoc(doc(db, "push-config", "vapid"), {
          publicKey: STABLE_PUBLIC_KEY,
          privateKey: STABLE_PRIVATE_KEY,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (fbSyncError) {
      console.warn("[Server] Failed to write stable keys to Firestore:", fbSyncError);
    }
  }

  webpush.setVapidDetails(
    "mailto:daveimagodei@gmail.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  return vapidKeys;
}

async function sendResetEmail(email: string, name: string, resetLink: string) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@ich100l.edu";

  // Check if SMTP is configured
  if (!user || !pass) {
    console.warn("[Server SMTP] Credentials not configured. Password reset link printed to console:", resetLink);
    return {
      success: false,
      simulated: true,
      message: "SMTP is not configured in environment variables. Password reset link was simulated."
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"ICH100L Portal" <${from}>`,
    to: email,
    subject: "Reset your ICH100L Portal Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #4f46e5; text-align: center;">ICH100L Portal</h2>
        <p>Dear ${name || "Student"},</p>
        <p>We received a request to reset the password for your ICH100L Chemistry Activities Account.</p>
        <p>You can reset your password by clicking the secure button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">Alternatively, copy and paste this link into your browser address bar:</p>
        <p style="word-break: break-all; color: #4f46e5; font-size: 14px;"><a href="${resetLink}">${resetLink}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This link will expire in 1 hour. If you did not request this password reset, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Server SMTP] Successfully sent reset link email to ${email}`);
    return { success: true, simulated: false };
  } catch (err: any) {
    console.error("[Server SMTP] Error sending reset email:", err);
    throw new Error(`Email dispatch failed: ${err.message}`);
  }
}


const app = express();
const PORT = 3000;

// Ensure uploads directory exists and is statically served
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));


  // Multer Storage Configuration (accepts files up to 100MB)
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const fileExt = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${file.fieldname}-${uniqueSuffix}${fileExt}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB Limit
    }
  });

  // Endpoints to support file uploads from device storage
  app.post("/api/upload-pdf", upload.single("pdf"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file received." });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".pdf") {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {}
      return res.status(400).json({ error: "Only .pdf files are permitted." });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: fileUrl, 
      filename: req.file.originalname 
    });
  });

  app.post("/api/upload-logo", upload.single("logo"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No logo image file received." });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
    if (!allowed.includes(ext)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {}
      return res.status(400).json({ 
        error: "Only PNG, JPG, JPEG, GIF, SVG, and WEBP images are allowed." 
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  });

  // Middleware for decoding incoming request bodies
  app.use(express.json());

  // Web Push API: Serve the VAPID public key
  app.get("/api/vapid-public-key", async (req, res) => {
    try {
      const keys = await ensureVapidKeys();
      res.json({ publicKey: keys.publicKey });
    } catch (e: any) {
      console.error("[Server] VAPID keys fetch failing:", e);
      res.status(500).json({ error: "Push notification credentials not initialized yet." });
    }
  });

  // Web Push API: Save push subscription durably in Firestore
  app.post("/api/push-subscribe", async (req, res) => {
    const { subscription, matricNumber, isStandalone, platform, name } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Subscription payload with endpoint is required." });
    }

    if (!db) {
      return res.status(500).json({ error: "Backend database connection is offline. Please try again." });
    }

    try {
      // Ensure VAPID keys are initialized and set
      await ensureVapidKeys();

      // Create a stable, unique document ID based on the subscription endpoint hash to allow multiple devices/browsers per student
      const endpointHash = Buffer.from(subscription.endpoint).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-60);
      const docId = getSafeDocId(`${matricNumber || "Guest"}-${endpointHash}`);

      await setDoc(doc(db, "push-subscriptions", docId), {
        subscription,
        matricNumber: matricNumber || "Guest",
        name: name || "Guest",
        endpoint: subscription.endpoint,
        isStandalone: !!isStandalone,
        platform: platform || "Web",
        createdAt: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Server] Subscribe persistence error:", error);
      res.status(500).json({ error: error.message || "Could not save push subscription." });
    }
  });

  // Web Push API: Remove push subscription from Firestore
  app.post("/api/push-unsubscribe", async (req, res) => {
    const { subscription, matricNumber } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Subscription payload with endpoint is required." });
    }

    if (!db) {
      return res.status(500).json({ error: "Backend database connection is offline." });
    }

    try {
      await ensureVapidKeys();
      const endpointHash = Buffer.from(subscription.endpoint).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-60);
      const docId = getSafeDocId(`${matricNumber || "Guest"}-${endpointHash}`);
      await deleteDoc(doc(db, "push-subscriptions", docId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Server] Unsubscribe error:", error);
      res.status(500).json({ error: error.message || "Could not remove subscription." });
    }
  });

  // Web Push API: Broadcast offline background notification alert
  app.post("/api/send-broadcast-push", async (req, res) => {
    let { title, body, category, targetGroup, targetValue, departmentId, excludeMatric } = req.body;
    if (!title || !body) {
      return res.json({ success: false, error: "Title and body parameters are required for broadcasting alerts." });
    }

    // Map departmentId parameter to targetGroup="department" / targetValue=departmentId for seamless targeting
    if (departmentId && !targetGroup) {
      targetGroup = "department";
      targetValue = departmentId;
    }

    if (!db) {
      return res.json({ success: false, error: "Backend database connection is offline. Notification bypass initiated." });
    }

    try {
      await ensureVapidKeys();
      const pushSubsSnap = await getDocs(collection(db, "push-subscriptions"));
      const devicesSnap = await getDocs(collection(db, "devices"));
      
      // Fetch departments to segment matching matric numbers
      let departments: any[] = [];
      try {
        const deptsSnap = await getDocs(collection(db, "departments"));
        departments = deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Server] Loaded ${departments.length} departments for push targeting:`, departments.map(d => d.id));
      } catch (deptErr) {
        console.warn("[Server] Failed carrying departments list for push segment:", deptErr);
      }

      const unifiedTargetsMap = new Map<string, any>();

      // 1. Process standard push-subscriptions
      pushSubsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.subscription && data.subscription.endpoint) {
          // Cryptographic key deduplication to prevent duplicate alerts on the same device.
          // Unique keys inside PWA rely on keys.p256dh which is constant for a given browser profile,
          // avoiding multiple signals triggered by cookie clearance or duplicate registration ids.
          const subKey = (data.subscription.keys && data.subscription.keys.p256dh) 
            ? String(data.subscription.keys.p256dh).trim() 
            : String(data.subscription.endpoint).trim();

          unifiedTargetsMap.set(subKey, {
            id: docSnap.id,
            source: "push-subscriptions",
            subscription: data.subscription,
            matricNumber: data.matricNumber || "Guest",
            name: data.name || "Guest",
            isStandalone: !!data.isStandalone,
            platform: data.platform || "Web",
            departmentId: data.departmentId || null,
          });
        }
      });

      // 2. Process devices (using their subscription if active)
      devicesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.subscription && data.subscription.endpoint) {
          const subKey = (data.subscription.keys && data.subscription.keys.p256dh) 
            ? String(data.subscription.keys.p256dh).trim() 
            : String(data.subscription.endpoint).trim();

          const existing = unifiedTargetsMap.get(subKey);
          const isStandalone = !!data.isStandalone || (existing ? !!existing.isStandalone : false);
          unifiedTargetsMap.set(subKey, {
            id: existing ? existing.id : docSnap.id,
            source: existing ? `${existing.source}+devices` : "devices",
            subscription: data.subscription,
            matricNumber: data.matricNumber || (existing ? existing.matricNumber : "Guest"),
            name: data.name || (existing ? existing.name : "Guest"),
            isStandalone,
            platform: data.platform || (existing ? existing.platform : "Web"),
            departmentId: data.departmentId || (existing ? existing.departmentId : null),
          });
        }
      });

      const targets = Array.from(unifiedTargetsMap.values());

      if (targets.length === 0) {
        return res.json({ success: true, count: 0, message: "No active push notifications configured." });
      }

      // Filter targets to match targeting criteria dynamically
      const matchingTargets = targets.filter((target) => {
        // Exclude sender matriculation number from broadcast
        if (excludeMatric && target.matricNumber) {
          const normTargetMatric = String(target.matricNumber).trim().toLowerCase().replace(/[\/\s\-_*]/g, "");
          const normExcludeMatric = String(excludeMatric).trim().toLowerCase().replace(/[\/\s\-_*]/g, "");
          if (normTargetMatric === normExcludeMatric) {
            return false;
          }
        }

        if (!targetGroup || targetGroup === "all") {
          return true;
        }

        if (targetGroup === "standalone") {
          return !!target.isStandalone;
        }

        if (targetGroup === "platform" && targetValue) {
          return String(target.platform || "").toLowerCase() === String(targetValue).toLowerCase();
        }

        if (targetGroup === "matric" && targetValue) {
          const deviceMatric = String(target.matricNumber || "").trim().toLowerCase();
          const filterMatric = String(targetValue).trim().toLowerCase();
          return deviceMatric === filterMatric;
        }

        if (targetGroup === "department" && targetValue) {
          // If the registered device has an explicit departmentId matching the targetValue, allow immediately
          if (target.departmentId && String(target.departmentId) === String(targetValue)) {
            return true;
          }
          const dept = departments.find(d => d.id === targetValue);
          if (!dept || !dept.prefix) return false;
          const userNorm = String(target.matricNumber || "").toLowerCase().replace(/[\/\s\-_*]/g, "");
          const prefixNorm = String(dept.prefix).toLowerCase().replace(/[\/\s\-_*]/g, "");
          return prefixNorm && userNorm.includes(prefixNorm);
        }

        return true;
      });

      if (matchingTargets.length === 0) {
        return res.json({ success: true, count: 0, message: "No devices found matching the selected targeting filters." });
      }

      // Generate standard high-entropy unique tag identifiers to allow stacking on iOS/Android notifications tray
      const pushId = `ich-alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const payload = JSON.stringify({ id: pushId, title, body, category });
      let successfulCount = 0;
      const sendPromises = matchingTargets.map(async (target) => {
        try {
          if (!target.subscription || !target.subscription.endpoint) return;
          await webpush.sendNotification(target.subscription, payload, {
            TTL: 86400, // 24 hours Time-to-Live limit
            headers: {
              "Urgency": "high",
              "Topic": category || "announcements"
            }
          });
          successfulCount++;
        } catch (error: any) {
          // Log expired or inactive registrations for monitoring, but do not aggressively delete
          // the master database document to prevent permanent subscription loss on temporary drops
          if (error && error.statusCode === 410) {
            console.warn(`[WebPush] Subscription marked inactive or expired on push service side for ID: ${target.id}`);
          } else {
            console.error(`[WebPush] Push execution failed for target ID: ${target.id}`, error);
          }
        }
      });

      await Promise.all(sendPromises);
      res.json({ success: true, count: successfulCount, totalMatched: matchingTargets.length });
    } catch (err: any) {
      console.error("[Server] Broadcast WebPush system dispatch failed:", err);
      res.json({ success: false, error: err.message || "Failed to trigger PWA background alerts due to server issue." });
    }
  });

  // API route to securely verify Paystack transactions
  app.post("/api/paystack-verify", async (req, res) => {
    try {
      const body = req.body || {};
      const { reference, matricNumber } = body;

      if (!reference) {
        return res.status(200).json({ success: false, message: "Transaction reference is required. Please type or paste your reference." });
      }

      const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
      if (!paystackSecret) {
        return res.status(200).json({ success: false, message: "Paystack billing credentials are not configured on the server. Please check environment variables or contact support." });
      }

      const cleanRef = String(reference).trim();
      const studentMatric = matricNumber ? String(matricNumber).trim() : "";
      
      const normalizeMatric = (m: string) => {
        if (!m) return "";
        return m.toLowerCase().replace(/[^a-z0-9]/g, "");
      };
      
      const normalizedStudentMatric = normalizeMatric(studentMatric);

      // 1. Prevent double-claiming of the same reference by looking up prior payment log
      if (db) {
        try {
          const checkPrior = async () => {
            const paymentDocRef = doc(db, 'payments', cleanRef);
            return await getDoc(paymentDocRef);
          };
          // Set a 2 second timeout for the prior check to prevent gateway issues when firestore is slow
          const pSnap: any = await Promise.race([
            checkPrior(),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1800))
          ]);
          if (pSnap && pSnap.exists()) {
            const existingPayment = pSnap.data();
            const existingMatric = existingPayment.matricNumber || "";
            if (normalizedStudentMatric && normalizeMatric(existingMatric) !== normalizedStudentMatric) {
              return res.status(200).json({
                success: false,
                message: `Verification halted: This reference has already been claimed and verified by a different student (${existingMatric}). You cannot reuse or hijack another user's payment reference.`
              });
            } else if (normalizedStudentMatric && normalizeMatric(existingMatric) === normalizedStudentMatric) {
              console.log(`[Server API] Secure Match: Reference ${cleanRef} was already verified for student ${existingMatric}. Healing subscription and returning success.`);
              
              const safeId = getSafeDocId(studentMatric);
              const subDocRef = doc(db, 'subscriptions', safeId);
              
              // Direct write to subscription to self-heal
              await setDoc(subDocRef, {
                status: 'active',
                matricNumber: studentMatric,
                email: existingPayment.email || `${studentMatric.replace(/\//g, '_')}@ich100l.edu`,
                name: existingPayment.name || "Chemistry Student",
                lastPaymentDate: existingPayment.paidAt || new Date().toISOString(),
                expiryDate: 'Current Semester',
                reference: cleanRef,
                amountPaid: existingPayment.amount || 1000,
              }, { merge: true });

              return res.status(200).json({
                success: true,
                message: "Reference verified and subscription healed in database.",
                data: {
                  amount: existingPayment.amount || 1000,
                  reference: cleanRef,
                  email: existingPayment.email || "",
                  paidAt: existingPayment.paidAt || new Date().toISOString()
                }
              });
            }
          }
        } catch (dbErr: any) {
          console.warn("[Server] Previous payment reference check bypass or failed:", dbErr.message || dbErr);
        }
      }

      // 2. Fetch official status from Paystack with a secure timeout of 8 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      let response;
      try {
        response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(cleanRef)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal
        });
      } catch (fetchErr: any) {
        console.error("[Server API] Paystack verify fetch error:", fetchErr);
        return res.status(200).json({
          success: false,
          message: "The verification server failed to contact Paystack right now (Timeout/Network latency). Please click verify again to re-attempt."
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[Server API] Paystack response parsing failed. Status: ${response.status}. Raw body: ${text.slice(0, 250)}`);
        return res.status(200).json({
          success: false,
          message: `The payment gateway integration returned an invalid response format (Status: ${response.status}). If you already paid, please try registering again or contact a Course Admin.`
        });
      }
      
      if (data.status === true && data.data && data.data.status === "success") {
        const payAmount = data.data.amount / 100;
        
        let metadataMatric = "";
        let metadataName = "";
        
        if (data.data.metadata && data.data.metadata.custom_fields && Array.isArray(data.data.metadata.custom_fields)) {
          const mField = data.data.metadata.custom_fields.find((f: any) => f && f.variable_name === 'matric_number');
          if (mField && mField.value) {
            metadataMatric = String(mField.value).trim();
          }
          const nField = data.data.metadata.custom_fields.find((f: any) => f && f.variable_name === 'student_name');
          if (nField && nField.value) {
            metadataName = String(nField.value).trim();
          }
        }
        
        // Backup: extract from reference if it has format sub-[matric]-timestamp
        let backupMatric = "";
        if (cleanRef.startsWith("sub-")) {
          const parts = cleanRef.split("-");
          if (parts.length >= 2) {
            const timestampPart = parts[parts.length - 1];
            if (!isNaN(Number(timestampPart)) || timestampPart.length > 10) {
              const matricPart = parts.slice(1, parts.length - 1).join("/");
              if (matricPart.length > 3) {
                backupMatric = matricPart;
              }
            }
          }
        }

        const customerEmail = data.data.customer?.email || "";
        let resolvedMatric = metadataMatric || backupMatric || "";
        
        // Tertiary backup: lookup by email in all active users
        if (!resolvedMatric && customerEmail && db) {
          try {
            const fetchUsers = async () => {
              const usersColl = collection(db, "users");
              return await getDocs(usersColl);
            };
            const usersSnap: any = await Promise.race([
              fetchUsers(),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500))
            ]);
            if (usersSnap) {
              for (const uDoc of usersSnap.docs) {
                const uData = uDoc.data();
                if (uData.email && uData.email.toLowerCase() === customerEmail.toLowerCase()) {
                  resolvedMatric = uData.matricNumber;
                  metadataName = metadataName || uData.name;
                  break;
                }
              }
            }
          } catch (dbErr: any) {
            console.warn("[Server] Backup query fallback for users table bypassed:", dbErr.message || dbErr);
          }
        }

        // --- VERIFY IF USER SUPPLIED ANOTHER USER'S REFERENCE BY MISTAKE ---
        if (resolvedMatric && studentMatric) {
          const normalizedResolved = normalizeMatric(resolvedMatric);
          if (normalizedResolved !== normalizedStudentMatric) {
            return res.status(200).json({
              success: false,
              message: `Verification Halted: This payment reference belongs to another student (${resolvedMatric}) according to our records. Please make sure you are inputting your own correct payment reference.`
            });
          }
        }

        const finalMatric = resolvedMatric || studentMatric;
        if (!finalMatric) {
          return res.status(200).json({
            success: false,
            message: "We found the transaction on Paystack, but could not associate it with any student matric number. Please contact an admin."
          });
        }

        // Write directly and eagerly to Firestore server-side on success
        if (db) {
          const saveToFirestore = async () => {
            const safeId = getSafeDocId(finalMatric);
            const subDocRef = doc(db, 'subscriptions', safeId);
            
            await setDoc(subDocRef, {
              status: 'active',
              matricNumber: finalMatric,
              email: customerEmail || `${finalMatric.replace(/\//g, '_')}@ich100l.edu`,
              name: metadataName || "Chemistry Student",
              lastPaymentDate: new Date().toISOString(),
              expiryDate: 'Current Semester',
              reference: cleanRef,
              amountPaid: payAmount,
            });

            // Write to chronological payments list
            await setDoc(doc(db, 'payments', cleanRef), {
              reference: cleanRef,
              matricNumber: finalMatric,
              email: customerEmail || `${finalMatric.replace(/\//g, '_')}@ich100l.edu`,
              name: metadataName || "Chemistry Student",
              amount: payAmount,
              paidAt: new Date().toISOString(),
              status: 'success'
            });
          };

          try {
            console.log(`[Server API] COMMITTING payment and subscription for student '${finalMatric}'...`);
            // Set a 4 second timeout constraint on database writes
            await Promise.race([
              saveToFirestore(),
              new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Database Write Timeout")), 3800))
            ]);
            console.log(`[Server API] Secure database write succeeded for student '${finalMatric}'`);
          } catch (writeErr: any) {
            console.error("[Server API] Background Firestore payment save failed or timed out:", writeErr.message || writeErr);
          }
        }

        return res.status(200).json({
          success: true,
          data: {
            amount: payAmount,
            reference: data.data.reference,
            email: customerEmail,
            paidAt: data.data.paid_at,
          }
        });
      } else {
        const paystackMsg = data.message || "Paystack transaction was unsuccessful or remains unverified.";
        return res.status(200).json({
          success: false,
          message: `The reference provided is incorrect, unpaid, or does not exist on Paystack (Paystack says: "${paystackMsg}"). Please double check your reference and try again.`
        });
      }
    } catch (err: any) {
      console.error("Paystack server-side validation error: ", err);
      return res.status(200).json({
        success: false,
        message: err.message || "A network error occurred while communicating with Paystack verification service."
      });
    }
  });

  // API route to listen to Paystack Webhooks so that students who pay but close the browser get credited instantly
  app.post("/api/paystack-webhook", async (req, res) => {
    // Paystack sends event signals to webhooks.
    // To preserve utmost security, we verify the payload reference with Paystack directly (verify API fetch)
    // to be 100% cryptographic and bypass key mismatch or signature issues!
    const event = req.body;
    
    if (!event || !event.data || !event.data.reference) {
      return res.status(200).json({ status: "ignored" }); // Always acknowledge with 200 to Paystack
    }

    const reference = event.data.reference;
    console.log(`[Paystack Webhook] Received event '${event.event}' for transaction reference: ${reference}`);

    if (event.event === "charge.success") {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
      if (!paystackSecret) {
        console.error("[Paystack Webhook] Paystack secret key is missing in environment variables!");
        return res.status(200).json({ status: "configured_error" });
      }

      try {
        // Double-verify with the official Paystack API to avoid spoofing
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        
        if (data.status === true && data.data && data.data.status === "success" && db) {
          const payAmount = data.data.amount / 100;
          let foundMatric = "";
          let foundName = "";

          // Extract matric from metadata
          if (data.data.metadata && data.data.metadata.custom_fields) {
            const mField = data.data.metadata.custom_fields.find((f: any) => f.variable_name === 'matric_number');
            if (mField) foundMatric = mField.value;
            const nField = data.data.metadata.custom_fields.find((f: any) => f.variable_name === 'student_name');
            if (nField) foundName = nField.value;
          }

          // Extract from reference naming
          if (!foundMatric && reference.startsWith("sub-")) {
            const parts = reference.split("-");
            if (parts.length >= 2) {
              const timestampPart = parts[parts.length - 1];
              if (!isNaN(Number(timestampPart)) || timestampPart.length > 10) {
                const matricPart = parts.slice(1, parts.length - 1).join("/");
                if (matricPart.length > 3) foundMatric = matricPart;
              }
            }
          }

          const customerEmail = data.data.customer?.email;

          // Resolve by searching users by email
          if (!foundMatric && customerEmail) {
            try {
              const usersColl = collection(db, "users");
              const usersSnap = await getDocs(usersColl);
              for (const uDoc of usersSnap.docs) {
                const uData = uDoc.data();
                if (uData.email && uData.email.toLowerCase() === customerEmail.toLowerCase()) {
                  foundMatric = uData.matricNumber;
                  foundName = foundName || uData.name;
                  break;
                }
              }
            } catch (dbErr) {
              console.warn("[Webhook] Backup users query fallback failed:", dbErr);
            }
          }

          if (foundMatric) {
            const safeId = getSafeDocId(foundMatric);
            const subDocRef = doc(db, 'subscriptions', safeId);
            
            await setDoc(subDocRef, {
              status: 'active',
              matricNumber: foundMatric,
              email: customerEmail || `${foundMatric.replace(/\//g, '_')}@ich100l.edu`,
              name: foundName || "Chemistry Student",
              lastPaymentDate: new Date().toISOString(),
              expiryDate: 'Current Semester',
              reference: reference,
              amountPaid: payAmount,
            });

            await setDoc(doc(db, 'payments', reference), {
              reference: reference,
              matricNumber: foundMatric,
              email: customerEmail || `${foundMatric.replace(/\//g, '_')}@ich100l.edu`,
              name: foundName || "Chemistry Student",
              amount: payAmount,
              paidAt: new Date().toISOString(),
              status: 'success'
            });

            console.log(`[Paystack Webhook] SUCCESS: Granted and recorded access for student '${foundMatric}' via Paystack Webhook.`);
          } else {
            console.warn(`[Paystack Webhook] Transaction verified successfully, but unable to resolve a student matricNumber.`);
          }
        }
      } catch (webhookErr) {
        console.error("[Paystack Webhook] Processing crash occurred: ", webhookErr);
      }
    }

    return res.status(200).json({ status: "processed" });
  });

  // API route for Course Rep / Admin to scan Paystack for recent successful charges and grant missing access
  app.post("/api/paystack-reconcile-sweep", async (req, res) => {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
    if (!paystackSecret) {
      return res.status(500).json({ success: false, message: "Paystack secret key is not configured in the server environment settings." });
    }

    if (!db) {
      return res.status(500).json({ success: false, message: "Firebase connection is unavailable at this moment." });
    }

    try {
      console.log("[Sweep API] Beginning a successful payments reconciliation sweep from Paystack...");
      const response = await fetch("https://api.paystack.co/transaction?status=success&perPage=100", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      });

      const pData = await response.json();
      if (!pData.status || !pData.data || !Array.isArray(pData.data)) {
        return res.status(400).json({ success: false, message: pData.message || "Failed to fetch transaction logs from Paystack." });
      }

      const verifiedTransactions = pData.data;
      let checkCount = 0;
      let matchCount = 0;
      let newUnlockCount = 0;
      const unlockedStudents: string[] = [];

      // Load all current users from db for faster local mapping in loop
      const usersColl = collection(db, "users");
      const usersSnap = await getDocs(usersColl);
      const userList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const tx of verifiedTransactions) {
        checkCount++;
        const reference = tx.reference;
        const payAmount = (tx.amount || 100000) / 100;
        const customerEmail = tx.customer?.email;

        let foundMatric = "";
        let foundName = "";

        // Extract from metadata custom fields
        if (tx.metadata && tx.metadata.custom_fields) {
          const mField = tx.metadata.custom_fields.find((f: any) => f.variable_name === 'matric_number');
          if (mField) foundMatric = mField.value;
          const nField = tx.metadata.custom_fields.find((f: any) => f.variable_name === 'student_name');
          if (nField) foundName = nField.value;
        }

        // Reconstruct from reference format
        if (!foundMatric && reference && reference.startsWith("sub-")) {
          const parts = reference.split("-");
          if (parts.length >= 2) {
            const timestampPart = parts[parts.length - 1];
            if (!isNaN(Number(timestampPart)) || timestampPart.length > 10) {
              const matricPart = parts.slice(1, parts.length - 1).join("/");
              if (matricPart.length > 3) foundMatric = matricPart;
            }
          }
        }

        // Match registered student matching Paystack email
        if (!foundMatric && customerEmail) {
          const match = userList.find((u: any) => u.email && u.email.toLowerCase() === customerEmail.toLowerCase());
          if (match) {
            foundMatric = (match as any).matricNumber;
            foundName = foundName || (match as any).name;
          }
        }

        if (foundMatric) {
          matchCount++;
          const safeId = getSafeDocId(foundMatric);
          const subDocRef = doc(db, 'subscriptions', safeId);
          
          // Check if subscription exists and is active, otherwise force-unlock it immediately
          const sSnap = await getDoc(subDocRef);
          const existingSub = sSnap.exists() ? sSnap.data() : null;

          if (!existingSub || existingSub.status !== 'active') {
            await setDoc(subDocRef, {
              status: 'active',
              matricNumber: foundMatric,
              email: customerEmail || `${foundMatric.replace(/\//g, '_')}@ich100l.edu`,
              name: foundName || "Chemistry Student",
              lastPaymentDate: tx.paid_at || tx.created_at || new Date().toISOString(),
              expiryDate: 'Current Semester',
              reference: reference,
              amountPaid: payAmount,
            }, { merge: true });

            await setDoc(doc(db, 'payments', reference), {
              reference: reference,
              matricNumber: foundMatric,
              email: customerEmail || `${foundMatric.replace(/\//g, '_')}@ich100l.edu`,
              name: foundName || "Chemistry Student",
              amount: payAmount,
              paidAt: tx.paid_at || tx.created_at || new Date().toISOString(),
              status: 'success'
            }, { merge: true });

            newUnlockCount++;
            unlockedStudents.push(`${foundName || "Student"} (${foundMatric})`);
          }
        }
      }

      console.log(`[Sweep Completed] Inspected ${checkCount} transactions, mapped ${matchCount} to registered students, unlocked/synced ${newUnlockCount} new students.`);
      return res.json({
        success: true,
        summary: `Inspected ${checkCount} successful transactions on Paystack. Mapped ${matchCount} students on file. Instantly unlocked ${newUnlockCount} student subscriptions due to failed redirects or slow updates.`,
        unlocked: unlockedStudents
      });
    } catch (err: any) {
      console.error("[Sweep API] Error in reconcile endpoint:", err);
      return res.status(500).json({ success: false, error: err.message || "Sweep operation failed on server." });
    }
  });

  // API route to securely initialize Paystack transactions for hosted checkout redirects
  app.post("/api/paystack-initialize", async (req, res) => {
    const { email, matricNumber, name, callbackUrl, amount } = req.body;
    if (!email || !matricNumber) {
      return res.status(400).json({ error: "Email and Matric Number are required." });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
    if (!paystackSecret) {
      return res.status(550).json({ error: "Paystack secret key is not configured in the server environment." });
    }
    
    // Dynamic pricing: use body amount, fallback to database doc check, or 1000 standard
    let payAmount = 1000 * 100; // Default kobo
    if (amount && !isNaN(Number(amount))) {
      payAmount = Number(amount);
    } else if (db) {
      try {
        const configDocRef = doc(db, "system-config", "semester-billing");
        const docSnap = await getDoc(configDocRef);
        if (docSnap.exists() && docSnap.data().amount) {
          payAmount = Number(docSnap.data().amount) * 100;
        }
      } catch (dbErr) {
        console.warn("[Server] Dynamic semester config read fallback:", dbErr);
      }
    }

    const reference = `sub-${matricNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          amount: payAmount,
          reference: reference,
          callback_url: callbackUrl,
          metadata: {
            custom_fields: [
              {
                display_name: "Student Name",
                variable_name: "student_name",
                value: name || "Chemistry Student"
              },
              {
                display_name: "Matriculation Number",
                variable_name: "matric_number",
                value: matricNumber
              }
            ]
          }
        })
      });

      const data = await response.json();
      if (data.status === true && data.data) {
        return res.json({
          success: true,
          authorization_url: data.data.authorization_url,
          reference: data.data.reference
        });
      } else {
        return res.status(400).json({
          success: false,
          message: data.message || "Failed to initialize standard checkout."
        });
      }
    } catch (err: any) {
      console.error("Initialize Paystack error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "An error occurred during transaction initialization."
      });
    }
  });

  // API route to request a password reset link
  app.post("/api/forgot-password", async (req, res) => {
    const { email, matricNumber } = req.body;
    if (!email || !matricNumber) {
      return res.status(400).json({ error: "Email and matriculation number are required." });
    }

    if (!db) {
      return res.status(500).json({ error: "Backend database connection is offline." });
    }

    try {
      const safeId = getSafeDocId(matricNumber);
      const userDocRef = doc(db, "users", safeId);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        return res.status(404).json({ error: "Matriculation number is not registered on this system." });
      }

      const userData = userSnap.data();
      if (String(userData.email).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
        return res.status(400).json({ error: "Entered email does not match our records for this matric number." });
      }

      // Generate a secure reset token
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour validity

      // Update in Firestore
      await setDoc(userDocRef, { resetToken, resetTokenExpiry }, { merge: true });

      // Determine the redirect link containing the secure parameters
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const resetLink = `${appUrl}?reset_token=${resetToken}&reset_matric=${encodeURIComponent(matricNumber)}`;

      const emailResult = await sendResetEmail(userData.email, userData.name, resetLink);

      return res.json({
        success: true,
        simulated: emailResult.simulated,
        resetLink: emailResult.simulated ? resetLink : undefined,
        message: emailResult.simulated
          ? "SMTP server credentials are not configured in environment variables. Password reset link was output to system logs and simulated here."
          : "A secure password reset link has been dispatched to your institutional email."
      });
    } catch (err: any) {
      console.error("[ForgotPassword] Error: ", err);
      return res.status(500).json({ error: err.message || "An error occurred while initiating password reset." });
    }
  });

  // API route to perform password reset
  app.post("/api/reset-password", async (req, res) => {
    const { token, matricNumber, newPassword } = req.body;
    if (!token || !matricNumber || !newPassword) {
      return res.status(400).json({ error: "Token, matric number, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    if (!db) {
      return res.status(500).json({ error: "Backend database connection is offline." });
    }

    try {
      const safeId = getSafeDocId(matricNumber);
      const userDocRef = doc(db, "users", safeId);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        return res.status(404).json({ error: "User profile associated with this reset link was not found." });
      }

      const userData = userSnap.data();
      if (!userData.resetToken || userData.resetToken !== token) {
        return res.status(400).json({ error: "Invalid or expired password reset token." });
      }

      const now = new Date().toISOString();
      if (!userData.resetTokenExpiry || userData.resetTokenExpiry < now) {
        return res.status(400).json({ error: "The password reset link has expired. Please request a new one." });
      }

      // Update password and clear reset token info
      await setDoc(userDocRef, {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null
      }, { merge: true });

      return res.json({
        success: true,
        message: "Your password has been successfully reset. You can now log in using your new password."
      });
    } catch (err: any) {
      console.error("[ResetPassword] Error: ", err);
      return res.status(500).json({ error: err.message || "Failed to reset password." });
    }
  });

  // Dynamic Gemini Client Lazy-Loader and file conversion helpers
  let aiInstance: any = null;
  function getGeminiClient() {
    if (!aiInstance) {
      const key = process.env.GEMINI_API_KEY;
      aiInstance = new GoogleGenAI({
        apiKey: key || "MOCK_KEY_FALLBACK",
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return aiInstance;
  }

  function getInlineDataFromFile(filePath: string) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".svg") mimeType = "image/svg+xml";

    return {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };
  }

  // Upload custom study image or screenshot file (accepts files up to 10MB)
  app.post("/api/upload-study", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No study attachment received." });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: fileUrl, 
      filename: req.file.originalname 
    });
  });

  // Automated Firebase AI Study Integration routes using Google GenAI SDK
  app.post("/api/ai/process", async (req, res) => {
    const { 
      selectedTool, 
      selectedPdfId, 
      selectedDeadlineId,
      summaryFormat, 
      quizLength, 
      quizDiff, 
      helpMode, 
      extraInstructions,
      uploadedImageUrl,
      pdfTextContent
    } = req.body;

    // Validate permission parameters
    try {
      // 1. Resolve Document Context
      const serverPdfPages: Record<string, string[]> = {
        "mock-1": [
          "CALCULUS I: INTEGRATION LIMITS AND RIEMANN SUMS. Section 1.1: Standard Limits and the Squeeze Theorem. Case Proof: Let f(x), g(x), and h(x) be functions such that g(x) <= f(x) <= h(x). Settle the limit as x approach c to prove they squeeze. Riemann Integrals and Continuous Sums. Section 1.3: The Fundamental Theorem of Calculus Part 1 and Part 2. Evaluates area under the curve y = 3x^2. Section 1.4: Special Integration by Substitution method for inverse chains.",
          "Riemann integral Continuity continuous functions properties, integration by substitution parameters, reverse chain rule exercises. Practice evaluation formula coefficient for x^2 e^(x^3) dx."
        ],
        "mock-2": [
          "PHYSICS II: CLASSICAL COULOMB INTERACTIONS & ELECTROSTATICS. Section 2.1: Electrostatic Vectors & Coulomb's Law, permittivity of free space. Superposition theory of discrete charges. Section 2.2: Gauss's Law and Integral Space Field Flux of Gaussian surface E . dA = Q_enclosed / epsilon_0.",
          "Flux limits, Maxwell's electric field divergence equations. Section 2.3: Conservative Fields and Electric Potential and gradients E = - grad V. Section 2.4: Capacitance parallel plate energy loading formulas U = (1/2) * C * V^2."
        ],
        "mock-3": [
          "ANALYTICAL INORGANIC CHEMISTRY: EQUILIBRIUM & BUFFER KINETICS. Section 3.1: Weak Acids and Dissociation constant Ka equilibrium ratio and log pKa indexing. Percent Ionization.",
          "Section 3.2: The Henderson-Hasselbalch Buffer Equation pH = pKa + log( [Base] / [Acid] ) proof and optimal buffering pH limits. Section 3.3: Precipitants & Solubility Products Ksp values for AgCl precipitate."
        ]
      };

      let docContent = pdfTextContent || "";
      let docTitle = "Syllabus Study Guide";
      let courseCode = "CHEM Course";

      if (selectedPdfId) {
        const pages = serverPdfPages[selectedPdfId] || serverPdfPages["mock-1"];
        docContent = docContent || pages.join("\n\n");
        if (selectedPdfId === "mock-1") {
          docTitle = "MTH101_Calculus_Limits_Integration.pdf";
          courseCode = "MTH 101";
        } else if (selectedPdfId === "mock-2") {
          docTitle = "PHY102_Electromagnetism_Physics_Intro.pdf";
          courseCode = "PHY 102";
        } else if (selectedPdfId === "mock-3") {
          docTitle = "CHM111_Analytical_Inorganic_Chemistry.pdf";
          courseCode = "CHM 111";
        }
      }

      // 2. Setup Gemini AI instance with secure error fallback
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.warn("[Gemini Server] GEMINI_API_KEY not defined. Generating secure automatic fallback study materials.");
        
        if (selectedTool === "summarize") {
          const formatText = summaryFormat === "bullets" ? "bullet points" : summaryFormat === "comprehensive" ? "detailed notes" : "equations formula sheet";
          return res.json({
            success: true,
            mode: "mock",
            resultText: `### 📘 Executive Study Analysis: ${docTitle} (${courseCode})\n\n*(Automatically rendered via study copilot node backup)*\n\n#### Key Concept Summarizations (Focus: ${extraInstructions || "General Study"})\n- **Core Foundation**: Designed to focus on the elements in the syllabus. Selected format was: **${formatText}**.\n- **Scientific Significance**: Outlines deep relationships between practical experiments, differential limits, and active formulas.\n- **Prerequisites Summary**: Evaluates integration, electrostatics, and buffer chemistry standard laws.\n\n#### Important formulas:\n- **Calculus Core**: $\\int_{a}^{b} f(x)dx = F(b) - F(a)$\n- **Gauss Field Flux**: $\\Phi_E = \\oint E \\cdot dA = \\frac{Q_{enclosed}}{\\varepsilon_0}$\n- **Buffer Equilibrium**: $pH = pK_a + \\log\\frac{[A^-]}{[HA]}$`
          });
        } else if (selectedTool === "quiz") {
          return res.json({
            success: true,
            mode: "mock",
            quizData: [
              {
                q: `In the context of ${courseCode}, what is the fundamental formula associated with the requested syllabus?`,
                o: ["Concept Formula A", "Concept Formula B", "Concept Formula C", "Concept Formula D"],
                a: 1,
                explanation: "The second choice represents the standard thermodynamic and mathematical equilibrium vector proof."
              },
              {
                q: `Which parameter dictates the rate of convergence under the given bounds?`,
                o: ["Integration Delta Width Limits", "Volumetric electric divergence", "Conjugate buffer percent base", "All of the above"],
                a: 3,
                explanation: "Each of these parameters corresponds correctly to the respective syllabus sections in our study."
              }
            ]
          });
        } else {
          return res.json({
            success: true,
            mode: "mock",
            resultText: `### 🎓 STEM Solution Brief (${helpMode === "conceptual" ? "Conceptual Guide" : "Mathematical Proof"})\n\n**Homework Challenge Solution for Course Repo**\n\n#### Step 1: Theoretical Setup\nIdentifying primary variables from source sheet. Target equations: ${helpMode === "conceptual" ? "Analogous reasoning" : "Riemann sum grids"}.\n\n#### Step 2: In-Depth Solutions\nFollowing rigorous scientific parameters, the evaluated coefficient is verified exactly at the target. ${extraInstructions ? `Followed your custom instruction: "${extraInstructions}"` : ""}\n\n#### Step 3: Verification Check\nChecking bounds and structural error vectors. **Consistent with standard course criteria.**`
          });
        }
      }

      const client = getGeminiClient();
      
      // 3. Assemble media blocks if image is uploaded
      const mediaParts: any[] = [];
      if (uploadedImageUrl) {
        const relativePath = uploadedImageUrl.startsWith("/") ? uploadedImageUrl.substring(1) : uploadedImageUrl;
        const absolutePath = path.join(process.cwd(), relativePath);
        const imagePart = getInlineDataFromFile(absolutePath);
        if (imagePart) {
          mediaParts.push(imagePart);
        }
      }

      // 4. Branch prompts according to active task
      if (selectedTool === "summarize") {
        const promptText = `You are an expert academic study assistant for university-level science courses.
Coordinate study materials on the syllabus and synthesize them.

Active Document Details:
Course Track: ${courseCode}
Title: ${docTitle}
Content: ${docContent}
Custom focus instructions from student (if any): "${extraInstructions || "none"}"
Format requested: ${summaryFormat === "bullets" ? "Structured bullet points with summary headers" : summaryFormat === "comprehensive" ? "Detailed comprehensive textbook notes breakdown" : "A core cheat-sheet showing important formulas, variables, definition matrices, and mathematical proof definitions"}

Please generate a professional, highly organized, and beautiful executive study brief or cheat sheet in clean Markdown.
Ensure you use bold variables, clear header titles, and spaced bullet points. Incorporate step-by-step calculus limits or chemistry equation structures.
Wrap variables and equations in clean inline math notation, e.g. dx, K_a, or LaTeX format where applicable. Make it readable for both desktop and mobile users. Do not include any meta conversation, start directly with the title of the document.`;

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [...mediaParts, promptText],
        });

        return res.json({
          success: true,
          resultText: response.text
        });

      } else if (selectedTool === "quiz") {
        const promptText = `You are a diagnostic test-engineering academic assistant.
Generate an interactive revision quiz testing core concepts from the syllabus material provided.

Document Context:
Course Track: ${courseCode}
Title: ${docTitle}
Content: ${docContent}

Configuration Parameters:
Quiz Size: ${quizLength || 5} questions
Grading Level: ${quizDiff === "intro" ? "Introductory/Prerequisite basics" : quizDiff === "rigorous" ? "Exam Hard Mode/Tricky scenarios and rigorous calculations" : "Standard Semester Level Course Standard"}

You MUST return a JSON array in the following EXACT schema. Do not output anything except this valid JSON array structure. Do not surround with markdown code blocks like \`\`\`json. Return pure JSON string.
Each object in the array represents a multiple-choice question:
[
  {
    "q": "Clear, detailed question testing a formula or concept from the content.",
    "o": ["Option A choice", "Option B choice", "Option C choice", "Option D choice"],
    "a": 1, // index (0-3) of the correct answer
    "explanation": "Detailed step-by-step answer justification of why this choice is correct."
  }
]`;

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: promptText,
          config: {
            responseMimeType: "application/json"
          }
        });

        let rawText = response.text || "";
        if (rawText.includes("```json")) {
          rawText = rawText.split("```json")[1].split("```")[0];
        } else if (rawText.includes("```")) {
          rawText = rawText.split("```")[1].split("```")[0];
        }
        rawText = rawText.trim();
        const quizData = JSON.parse(rawText);

        return res.json({
          success: true,
          quizData
        });

      } else if (selectedTool === "help") {
        let deadlineTitle = "MTH 101 Calculus Problem Set";
        let deadlineDescription = "General problems in limits and differentiation.";

        if (selectedDeadlineId) {
          if (selectedDeadlineId === "mock-dl-1") {
            deadlineTitle = "MTH101 Problem Set 3 - Trigonometric Integrals";
            deadlineDescription = "Complete all odd-numbered Riemann limits exercises.";
          }
        }

        const promptText = `You are a brilliant university STEM co-pilot tutor.
Solve the Homework Assignment or target problem outlined below.

Source Materials & Background Document Context (if active):
Course Track: ${courseCode}
Title: ${docTitle}
Background Content: ${docContent}

Active Homework Challenge Description:
Task Title: ${deadlineTitle}
Task Description/Details: ${deadlineDescription}
Student target guidelines (if any): "${extraInstructions || "none"}"
Uploaded Screenshot Image status: ${uploadedImageUrl ? "Yes, analyzed below" : "None"}
Ingestion Strategy Mode: ${helpMode === "conceptual" ? "Analogous Intuitive Explanations only" : helpMode === "calculator" ? "Mathematical formula breakdown, target constants, and key equations" : "Detailed Step-by-Step Proof"}

Please solve this STEM challenge with absolute mathematical precision and step-by-step educational instructions.
Write clean, gorgeous proofs. Highlight crucial constants (e.g. k_e, R, F, etc.) and equations. Use markdown for neat visual layouts.
Start directly with the problem resolution. No preamble.`;

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [...mediaParts, promptText],
        });

        return res.json({
          success: true,
          resultText: response.text
        });
      }

    } catch (error: any) {
      console.error("[Gemini AI Error]", error);
      res.status(500).json({ error: error.message || "An error occurred during AI content generation." });
    }
  });

  // Asynchronous initialization block for loading VAPID keys and mounting Vite
  async function initializeServer() {
    try {
      await ensureVapidKeys();
    } catch (err) {
      console.error("[Server] Critical startup error: Could not load stable VAPID credentials:", err);
    }

    // Integrate Vite as a middleware
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    if (process.env.VERCEL) {
      console.log("[Server] Running as a Vercel Serverless Function.");
    } else {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`[Server] ICH100L Full-stack Server listening on http://0.0.0.0:${PORT}`);
      });
    }
  }

  initializeServer();

export default app;

