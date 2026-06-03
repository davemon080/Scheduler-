import { UserRecord, ActivityRecord } from "./types";

export const SEED_USERS: Omit<UserRecord, "id">[] = [
  {
    displayName: "Alexander Vance",
    email: "alex.vance@company.io",
    role: "admin",
    status: "active",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    createdAt: "2026-01-15T08:30:00Z",
    lastActiveAt: "2026-05-31T17:15:00Z",
    phoneNumber: "+1 (555) 234-5678",
    notes: "Lead administrator for cloud infrastructure."
  },
  {
    displayName: "Sophia Martinez",
    email: "sophia.m@ich100l.edu",
    role: "moderator",
    status: "active",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
    createdAt: "2026-02-10T11:45:00Z",
    lastActiveAt: "2026-05-31T16:50:00Z",
    phoneNumber: "+1 (555) 876-5432",
    notes: "Coordinates student admissions and enrollment logs."
  },
  {
    displayName: "Liam Chen",
    email: "lchen@academic.net",
    role: "user",
    status: "active",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    createdAt: "2026-03-22T14:20:00Z",
    lastActiveAt: "2026-05-31T15:30:00Z",
    phoneNumber: "+44 20 7946 0958",
    notes: "Active lecturer on digital communications."
  },
  {
    displayName: "Chloe Henderson",
    email: "chloe.h@designgroup.com",
    role: "user",
    status: "pending",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200",
    createdAt: "2026-05-30T09:10:00Z",
    lastActiveAt: "2026-05-30T10:15:00Z",
    phoneNumber: "+1 (555) 432-1098",
    notes: "Newly invited creator for workspace branding guidelines."
  },
  {
    displayName: "Marcus Brody",
    email: "m.brody@museumlabs.org",
    role: "user",
    status: "suspended",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
    createdAt: "2025-11-05T16:00:00Z",
    lastActiveAt: "2026-05-20T11:22:00Z",
    phoneNumber: "+1 (555) 901-2345",
    notes: "Profile suspended due to duplicate submissions."
  }
];

export const SEED_ACTIVITIES: Omit<ActivityRecord, "id">[] = [
  {
    userName: "Alexander Vance",
    action: "System config backup completed",
    category: "system",
    severity: "success",
    timestamp: "2026-05-31T17:30:00Z",
    details: "Automated incremental backup of main cloud cluster. 42 collections archived."
  },
  {
    userName: "Sophia Martinez",
    action: "Bulk user role upgrade",
    category: "auth",
    severity: "info",
    timestamp: "2026-05-31T16:52:00Z",
    details: "Upgraded 4 profiles from user to moderator role in school cohort."
  },
  {
    userName: "Liam Chen",
    action: "Course content draft published",
    category: "interaction",
    severity: "success",
    timestamp: "2026-05-31T15:30:00Z",
    details: "Published 'Reactive Design Principles 101' slide deck. 280 students notified."
  },
  {
    userName: "System Daemon",
    action: "Third-party webhook fail (Stripes API)",
    category: "error",
    severity: "error",
    timestamp: "2026-05-31T14:15:00Z",
    details: "Request timed out after 10000ms. Retrying in 5 min. Status code: 504 Gateway Timeout."
  },
  {
    userName: "Chloe Henderson",
    action: "Invited by Sophia Martinez",
    category: "auth",
    severity: "info",
    timestamp: "2026-05-30T09:10:00Z",
    details: "Email verification link successfully dispatched."
  }
];
