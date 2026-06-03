/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity, Deadline, Announcement } from '../types';

export const DEFAULT_COURSE_REP_MATRIC = '2025/ps/ich/0034';

export const DEFAULT_ACTIVITIES: Activity[] = [
  // Monday
  {
    id: 'act-1',
    title: 'General Chemistry Lecture',
    description: 'Introduction to Atomic Structure and Periodicity with Dr. Robert.',
    timeStart: '08:00',
    timeEnd: '10:00',
    day: 'Monday',
    location: 'LT 1 (Faculty Lecture Theatre)',
    courseCode: 'ICH 101',
    category: 'Lecture',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'act-2',
    title: 'Linear Algebra Tutorial',
    description: 'Solving matrices and general quadratic equations practice.',
    timeStart: '11:00',
    timeEnd: '12:30',
    day: 'Monday',
    location: 'S204 Block B',
    courseCode: 'MTH 101',
    category: 'Tutorial',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'act-3',
    title: 'Introductory Organic Chemistry',
    description: 'Alkanes, Alkenes, and Alkynes properties and reaction pathways.',
    timeStart: '14:00',
    timeEnd: '16:00',
    day: 'Monday',
    location: 'LT 3',
    courseCode: 'ICH 102',
    category: 'Lecture',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },

  // Tuesday
  {
    id: 'act-4',
    title: 'ICH100L Practical Session A',
    description: 'Acid-Base Titration Experiments. Lab Coat and Safety Goggles are compulsory!',
    timeStart: '09:00',
    timeEnd: '12:00',
    day: 'Tuesday',
    location: 'Chemistry Lab 2',
    courseCode: 'ICH 100L',
    category: 'Lab',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'act-5',
    title: 'General Physics I',
    description: 'Newtonian Mechanics, rotational motion, and gravitation.',
    timeStart: '13:00',
    timeEnd: '15:00',
    day: 'Tuesday',
    location: 'Science Auditorium',
    courseCode: 'PHY 101',
    category: 'Lecture',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },

  // Wednesday
  {
    id: 'act-6',
    title: 'Inorganic Chemistry Principles',
    description: 'Chemical bonding, molecular geometry, and VSEPR theory.',
    timeStart: '10:00',
    timeEnd: '12:00',
    day: 'Wednesday',
    location: 'LT 2',
    courseCode: 'ICH 103',
    category: 'Lecture',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'act-7',
    title: 'Physics Practical Lab',
    description: 'Moment of inertia and simple pendulum experiment computations.',
    timeStart: '14:00',
    timeEnd: '17:00',
    day: 'Wednesday',
    location: 'Physics Lab Block C',
    courseCode: 'PHY 101',
    category: 'Lab',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },

  // Thursday
  {
    id: 'act-8',
    title: 'ICH100L Practical Session B',
    description: 'Qualitative analysis of unknown salt compounds. Prepare report sheets.',
    timeStart: '09:00',
    timeEnd: '12:00',
    day: 'Thursday',
    location: 'Chemistry Lab 1',
    courseCode: 'ICH 100L',
    category: 'Lab',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'act-9',
    title: 'General Chemistry Discussion',
    description: 'Stochiometry problems and thermochemistry group study.',
    timeStart: '15:00',
    timeEnd: '17:00',
    day: 'Thursday',
    location: 'Student Common Room',
    courseCode: 'ICH 101',
    category: 'Tutorial',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },

  // Friday
  {
    id: 'act-10',
    title: 'Introductory Chemistry Quiz',
    description: 'First continuous assessment test covering everything from week 1 to 4.',
    timeStart: '09:00',
    timeEnd: '10:30',
    day: 'Friday',
    location: 'Science Lecture Theater',
    courseCode: 'ICH 101',
    category: 'Exam',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'act-11',
    title: 'Calculus and Equations',
    description: 'Differentiation rules and parametric optimization problems.',
    timeStart: '11:00',
    timeEnd: '13:00',
    day: 'Friday',
    location: 'LT 1',
    courseCode: 'MTH 101',
    category: 'Lecture',
    createdBy: DEFAULT_COURSE_REP_MATRIC
  }
];

export const DEFAULT_DEADLINES: Deadline[] = [
  {
    id: 'dl-1',
    title: 'Titration Lab Report Submission',
    courseCode: 'ICH 100L',
    dueDate: '2026-06-03',
    description: 'Submit your write-up for Session A Acid-Base experiment via the course physical tray.',
    isCompleted: false,
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'dl-2',
    title: 'Organic Reaction Mechanisms Homework',
    courseCode: 'ICH 102',
    dueDate: '2026-06-08',
    description: 'Complete synthesis questions covering Alkenes and write chemical structures cleanly.',
    isCompleted: false,
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'dl-3',
    title: 'Physics Mechanics Exercise 4',
    courseCode: 'PHY 101',
    dueDate: '2026-06-01',
    description: 'Solve rotational dynamics problems 1 to 15 at the end of Chapter 4.',
    isCompleted: true,
    createdBy: DEFAULT_COURSE_REP_MATRIC
  },
  {
    id: 'dl-4',
    title: 'Inorganic Molecular Geometry Quiz Prep',
    courseCode: 'ICH 103',
    dueDate: '2026-06-12',
    description: 'Read up on hybridisation models and octahedral orbital splittings in chemistry texts.',
    isCompleted: false,
    createdBy: DEFAULT_COURSE_REP_MATRIC
  }
];

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'URGENT: Change of venue for ICH100L Lab tomorrow',
    content: 'Due to ongoing maintenance work in Lab 2, all Session A students are directed to move to Lab 1 by 09:00 AM. Ensure you bring your lab safety glasses and safety instructions pamphlet without fail.',
    date: '2026-05-30',
    priority: 'high',
    author: 'Course Rep (2025/ps/ich/0034)'
  },
  {
    id: 'ann-2',
    title: 'General Chemistry Lecture slide uploads',
    content: 'Dr. Robert has uploaded the slide notes on Atomic Periodicity and Periodic trends on the faculty boards. Hard copies are available at the department print store for 300 Naira.',
    date: '2026-05-29',
    priority: 'info',
    author: 'Course Rep'
  },
  {
    id: 'ann-3',
    title: 'MTH 101 Quiz dates rescheduled',
    content: 'The Mathematics department has shifted the first MTH 101 test from this Friday to next Monday. This is to allow all faculties to complete registration and obtain official index numbers.',
    date: '2026-05-28',
    priority: 'medium',
    author: 'Dr. Adeyeri (Course Coordinator)'
  }
];
