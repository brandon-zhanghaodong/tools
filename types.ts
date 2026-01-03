export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum EvaluationStatus {
  PENDING = 'PENDING',
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

export enum Relationship {
  SELF = 'SELF',
  MANAGER = 'MANAGER',
  PEER = 'PEER',
  DIRECT_REPORT = 'DIRECT_REPORT',
}

export interface Organization {
  id: string;
  name: string;
  code: string; // Unique identifier for login (e.g., 'google', 'tesla')
  recoveryKey?: string; // Secret key for admin account recovery
  createdAt: string;
}

export interface User {
  id: string;
  organizationId: string; // Link to Organization
  name: string;
  username: string; // Used for login
  password?: string; // Added for authentication
  email: string;
  role: UserRole;
  department: string;
  avatarUrl: string;
  managerId?: string;
}

export interface Competency {
  id: string;
  name: string;
  description: string;
}

export interface Question {
  id: string;
  organizationId?: string; // If null, it's a system default question
  text: string;
  category: string; // e.g., "诚信正直", "战略思维"
}

export interface ReviewCycle {
  id: string;
  organizationId: string; // Link to Organization
  name: string;
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT';
  dueDate: string;
}

export interface ReviewAssignment {
  id: string;
  organizationId: string; // Link to Organization
  cycleId: string;
  reviewerId: string;
  subjectId: string; // The person being reviewed
  relationship: Relationship;
  status: EvaluationStatus;
  // Score can be 1-5 or -1 for "N/A" (Unknown/Not Applicable)
  scores: Record<string, number>; 
  comments: Record<string, string>; // Question specific comments
  
  // Structured qualitative feedback as per PDF page 7
  feedbackStrengths: string;
  feedbackImprovements: string;
  
  submittedAt?: string;
}

export interface ReportData {
  subjectName: string;
  cycleName: string;
  averageScore: number;
  categoryScores: { category: string; score: number; selfScore: number }[];
  feedbackSummary?: string;
  strengths: string[];
  improvements: string[];
}