export interface User {
  id: number;
  name: string;
  email: string;
  qualification: string;
  institution: string;
  stream: string;
  is_admin?: number;
}

export interface Skill {
  name: string;
  level: number;
}

export interface Question {
  q: string;
  s: string; // suggestion/hint
  d: string; // difficulty (Easy, Medium, Hard)
  type?: "mcq" | "short" | "long";
  options?: string[]; // options for MCQs
  round?: string;
  roundType?: string;
}

export interface AnswerItem {
  question: string;
  answer: string;
}

export interface ScoreItem {
  score: number;
  remark: string;
}

export interface QuestionWiseScoreItem {
  qIndex: number;
  status: "correct" | "partially_correct" | "incorrect" | "unanswered";
  score: number;
  maxScore: number;
  grade: string;
  evaluation: string;
}

export interface Evaluation {
  confidence: ScoreItem;
  clarity: ScoreItem;
  relevance: ScoreItem;
  technicalDepth: ScoreItem;
  grammar: ScoreItem;
  overallScore: number;
  percentage: number;
  finalGrade: string;
  performanceLevel: string;
  strengths: string[];
  developmentAreas: string[];
  summary: string;
  recommendations: string[];
  questionWise?: QuestionWiseScoreItem[];
}

export interface ReportCard {
  id?: number;
  interviewId: string;
  studentName: string;
  email: string;
  qualification: string;
  institution: string;
  stream: string;
  overallScore: number;
  percentage: number;
  finalGrade: string;
  performanceLevel: string;
  strengths: string[];
  developmentAreas: string[];
  summary: string;
  feedback: string[];
  scores: {
    confidence: ScoreItem;
    clarity: ScoreItem;
    relevance: ScoreItem;
    technicalDepth: ScoreItem;
    grammar: ScoreItem;
    questionWise?: QuestionWiseScoreItem[];
  };
  date: string;
  questions?: string[];
  answers?: string[];
}
