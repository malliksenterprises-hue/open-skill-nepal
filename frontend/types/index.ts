export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'school_admin' | 'teacher' | 'student';
  schoolId?: string;
  name: string;
  createdAt: string;
}

export interface School {
  id: string;
  name: string;
  deviceLimit: number;
  studentLimit: number;
  status: 'active' | 'inactive';
}

export interface Class {
  id: string;
  teacherId: string;
  grade: string;
  subject: string;
  schedule: string;
  roomId: string;
  status: 'scheduled' | 'live' | 'ended';
}

export interface LiveSession {
  id: string;
  classId: string;
  startedAt: string;
  recordingUrl?: string;
  participantCount: number;
}
