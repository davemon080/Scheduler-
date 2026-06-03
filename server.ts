import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc } from "firebase/firestore";
import nodemailer from "nodemailer";

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
    db = getFirestore(fbApp, appletConfig.firestoreDatabaseId);
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
    const { title, body, category, targetGroup, targetValue } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body parameters are required for broadcasting alerts." });
    }

    if (!db) {
      return res.status(500).json({ error: "Backend database connection is offline. Notification bypass initiated." });
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
          unifiedTargetsMap.set(data.subscription.endpoint, {
            id: docSnap.id,
            source: "push-subscriptions",
            subscription: data.subscription,
            matricNumber: data.matricNumber || "Guest",
            name: data.name || "Guest",
            isStandalone: !!data.isStandalone,
            platform: data.platform || "Web",
          });
        }
      });

      // 2. Process devices (using their subscription if active)
      devicesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.subscription && data.subscription.endpoint) {
          const existing = unifiedTargetsMap.get(data.subscription.endpoint);
          const isStandalone = !!data.isStandalone || (existing ? !!existing.isStandalone : false);
          unifiedTargetsMap.set(data.subscription.endpoint, {
            id: existing ? existing.id : docSnap.id,
            source: existing ? `${existing.source}+devices` : "devices",
            subscription: data.subscription,
            matricNumber: data.matricNumber || (existing ? existing.matricNumber : "Guest"),
            name: data.name || (existing ? existing.name : "Guest"),
            isStandalone,
            platform: data.platform || (existing ? existing.platform : "Web"),
          });
        }
      });

      const targets = Array.from(unifiedTargetsMap.values());

      if (targets.length === 0) {
        return res.json({ success: true, count: 0, message: "No active push notifications configured." });
      }

      // Filter targets to match targeting criteria dynamically
      const matchingTargets = targets.filter((target) => {
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
          const dept = departments.find(d => d.id === targetValue);
          if (!dept || !dept.prefix) return false;
          const userNorm = String(target.matricNumber || "").toLowerCase().replace(/[\/\s\-_*]/g, "");
          const prefixNorm = String(dept.prefix).toLowerCase().replace(/[\/\s\-_*]/g, "");
          return prefixNorm && userNorm.startsWith(prefixNorm);
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
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.warn(`[WebPush] Subscription marked inactive or expired on push service side for ID: ${target.id} (sourced from ${target.source}, statusCode: ${error.statusCode})`);
          } else {
            console.error(`[WebPush] Push execution failed for target ID: ${target.id}`, error);
          }
        }
      });

      await Promise.all(sendPromises);
      res.json({ success: true, count: successfulCount, totalMatched: matchingTargets.length });
    } catch (err: any) {
      console.error("[Server] Broadcast WebPush system dispatch failed:", err);
      res.status(500).json({ error: err.message || "Failed to trigger PWA background alerts." });
    }
  });

  // API route to securely verify Paystack transactions
  app.post("/api/paystack-verify", async (req, res) => {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ error: "Reference parameter is required." });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
    if (!paystackSecret) {
      return res.status(550).json({ success: false, message: "Paystack secret key is not configured in the server environment settings." });
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      if (data.status === true && data.data && data.data.status === "success") {
        return res.json({
          success: true,
          data: {
            amount: data.data.amount / 100, // Convert Kobo to Naira
            reference: data.data.reference,
            email: data.data.customer?.email,
            paidAt: data.data.paid_at,
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: data.message || "Paystack transaction was unsuccessful or unverified."
        });
      }
    } catch (err: any) {
      console.error("Paystack server-side validation error: ", err);
      return res.status(500).json({
        success: false,
        error: err.message || "An error occurred during payment verification with Paystack."
      });
    }
  });

  // API route to securely initialize Paystack transactions for hosted checkout redirects
  app.post("/api/paystack-initialize", async (req, res) => {
    const { email, matricNumber, name, callbackUrl } = req.body;
    if (!email || !matricNumber) {
      return res.status(400).json({ error: "Email and Matric Number are required." });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";
    if (!paystackSecret) {
      return res.status(550).json({ error: "Paystack secret key is not configured in the server environment." });
    }
    const amount = 200 * 100; // ₦200 in kobo

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
          amount: amount,
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

