// File: src/utils/constants.js
import { MODULE_ICONS } from './moduleIcons';

export const XX_IDS = ["23","71"];

export const LS_CLASS = 'bca_class_name';
export const LS_USER = 'bca_app_user';

export const DEFAULT_CLASS = '2 B.C.A. D';
export const DEFAULT_SUBJECTS = [
  "Programming in C","C Programming Lab","Digital Logic & Computer Organization",
  "Discrete Mathematics","Database Management Systems","DBMS Lab","Data Structures",
  "Operating Systems","Computer Networks","Web Technology","Communicative English",
  "Statistics","Tamil / Hindi","Value Education"
];

export const APP_MODULES = [
  {
    id: 'attendanceReport', name: 'Attendance Report', sub: 'Record absentees and generate daily reports',
    defaultAdminOnly: true, icon: MODULE_ICONS.attendanceReport
  },
  {
    id: 'studentDb', name: 'Student Database', sub: 'View and manage class student list',
    defaultAdminOnly: true, icon: MODULE_ICONS.studentDb
  },
  {
    id: 'adminSettings', name: 'Admin Settings', sub: 'Manage timetable, subjects, and settings',
    defaultAdminOnly: true, icon: MODULE_ICONS.adminSettings
  },
  {
    id: 'studyMaterials', name: 'Study Materials', sub: 'Access class notes, syllabus, and resources',
    defaultAdminOnly: false, icon: MODULE_ICONS.studyMaterials
  },
  {
    id: 'semesterResults', name: 'Semester Results', sub: 'Check internal and external marks',
    defaultAdminOnly: false, icon: MODULE_ICONS.semesterResults
  },
  {
    id: 'myAttendance', name: 'My Attendance Report', sub: 'Check your own absence record and attendance %',
    defaultAdminOnly: false, icon: MODULE_ICONS.myAttendance
  }
];

export const DEFAULT_STUDENT_PERMISSIONS = {
  studyMaterials: true,
  semesterResults: true,
  myAttendance: true,
  attendanceReport: false,
  studentDb: false,
  adminSettings: false
};

export const DAY_ORDERS = [1,2,3,4,5,6];
export const HOURS = [1,2,3,4,5];
export const PART_ONE_OPTIONS = ["Tamil","French","Hindi","Sanskrit","Telugu"];

export const DSE_SCHEDULE = {
  '2-4': 'DSE Lab',
  '2-5': 'DSE Lab',
  '4-1': 'DSE Theory'
};

export const STUDY_TABLE = 'study_materials';
export const STUDY_BUCKET = 'materials';