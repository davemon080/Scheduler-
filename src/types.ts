/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = string; // e.g., 'student' | 'course_rep' | 'admin' | 'user' | 'moderator' | 'developer'
export type UserStatus = string; // e.g., 'active' | 'trial' | 'expired' | 'pending' | 'suspended'

export interface UserRecord {
  id?: string;
  matricNumber?: string;
  matric?: string; // some templates use matric
  name?: string;
  email?: string;
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  isCourseRep?: boolean;
  isAdmin?: boolean;
  createdAt?: string;
  activeSessionId?: string;
  phoneNumber?: string;
  notes?: string;
  avatarUrl?: string;
  password?: string;
  lastActiveAt?: string;
}

// User mapping for backward compatibility
export interface User extends UserRecord {}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type ActivityCategory = string; // Broad category, e.g. Lecture, Exam, Tutorial, Lab, system, auth, etc.

export interface Activity {
  id?: string;
  title?: string;
  description?: string;
  timeStart?: string; // e.g. "08:00"
  timeEnd?: string;   // e.g. "10:00"
  day?: DayOfWeek;
  location?: string;
  courseCode?: string; // e.g. "ICH 101" or "ICH 102"
  category?: ActivityCategory;
  createdBy?: string; // Matric number of creator
  deliveryType?: 'physical' | 'online';
  classLink?: string;
  date?: string; // e.g. "2026-06-03" (YYYY-MM-DD format)
  departmentId?: string;
  userName?: string; // some mock utilities include userName
  action?: string; // some mock logs specify log actions
  severity?: string; // log severity levels
  timestamp?: string; // some custom logs use timestamp
  details?: string; // log details
}

export interface ActivityRecord extends Activity {}

export interface Deadline {
  id: string;
  title: string;
  courseCode: string;
  dueDate: string; // ISO Date String e.g. "2026-06-05"
  description?: string;
  isCompleted: boolean;
  createdBy: string; // Matric number of creator
  imageUrl?: string;
  imageUrls?: string[];
  completedBy?: Record<string, boolean>;
  departmentId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string; // date string
  priority: 'high' | 'medium' | 'info';
  author: string; // e.g. "Course Rep" or "Dr. Adeyeri"
  imageUrl?: string;
  imageUrls?: string[];
  departmentId?: string;
}

export interface SubscriptionRecord {
  id?: string;
  matricNumber: string;
  email: string;
  name?: string;
  status: string; // 'active' | 'inactive'
  expiryDate: string; // ISO date string
  expiresAt?: string; // some screens use expiresAt
  lastPaymentDate?: string;
  reference?: string;
  adminGranted?: boolean;
}
