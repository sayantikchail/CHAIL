import React, { useState, useEffect, useRef } from "react";
import { User } from "../types";
import { 
  ShieldAlert, 
  Users, 
  FileText, 
  Briefcase, 
  Terminal, 
  RefreshCw, 
  LogOut, 
  Cpu, 
  Trash2, 
  Search, 
  Calendar, 
  Award, 
  CheckCircle, 
  X,
  BookOpen,
  Eye,
  Shield,
  Key
} from "lucide-react";

interface AdminConsoleProps {
  user: User;
  onLogout: () => void;
  showNotification: (msg: string) => void;
}

interface AdminRecord {
  id: number;
  name: string;
  email: string;
}

interface StudentRecord {
  id: number;
  name: string;
  email: string;
  qualification: string;
  institution: string;
  stream: string;
}

interface ResumeRecord {
  id: number;
  user_id: number;
  filename: string;
  skills: string; // JSON parsed array of skill objects
  detailed_analysis: string; // Detailed resume analysis JSON string
}

interface InterviewRecord {
  id: number;
  user_id: number;
  qualification: string;
  stream: string;
  skills: string; // JSON array
  questions: string; // JSON array
  answers: string; // JSON array
  scores: string; // JSON scores object
  overall_score: number;
  percentage: number;
  final_grade: string;
  performance_level: string;
  strengths: string; // JSON array
  development_areas: string; // JSON array
  summary: string;
  feedback: string; // JSON array
  date_created: string;
}

export default function AdminConsole({ user, onLogout, showNotification }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "STUDENTS" | "RESUMES" | "INTERVIEWS" | "GUIDE">("STUDENTS");
  const [manualRefreshing, setManualRefreshing] = useState(false);
  
  // DB Records
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<number | null>(null);

  // Selected Detail Modal state
  const [viewingResume, setViewingResume] = useState<ResumeRecord | null>(null);
  const [viewingInterview, setViewingInterview] = useState<InterviewRecord | null>(null);
  const [resumeFileContent, setResumeFileContent] = useState<{ filename: string; fileBase64: string } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);

  // Custom confirmation modal state (No alert/confirm iframe blockage)
  const [studentToDelete, setStudentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [interviewToDelete, setInterviewToDelete] = useState<{ id: number; studentName: string } | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track counts to detect actual updates
  const prevCounts = useRef({ students: 0, resumes: 0, interviews: 0, initialized: false });

  // Fetch admin console records
  const fetchAdminData = async (_isSilent = false) => {

    try {
      const res = await fetch("/api/admin/data");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch data");

      const newStudents = data.students || [];
      const newResumes = data.resumes || [];
      const newInterviews = data.interviews || [];

      // Only print change logs to keep the logs completely clean and free of duplicate/idle sync spam
      if (prevCounts.current.initialized) {
        if (newStudents.length > prevCounts.current.students) {
          const registered = newStudents[newStudents.length - 1];
          addLog(`[REGISTRATION] : New student account "${registered.name.toUpperCase()}" registered.`);
        } else if (newStudents.length < prevCounts.current.students) {
          addLog(`[PURGE] : Student account deleted from Database.`);
        }

        if (newResumes.length > prevCounts.current.resumes) {
          const uploaded = newResumes[newResumes.length - 1];
          const owner = newStudents.find((s: any) => s.id === uploaded.user_id);
          addLog(`[UPLOAD] : New resume parsed and processed for ${owner ? owner.name.toUpperCase() : "student"}.`);
        } else if (newResumes.length < prevCounts.current.resumes) {
          addLog(`[PURGE] : Resume document removed.`);
        }

        if (newInterviews.length > prevCounts.current.interviews) {
          const latestInterview = newInterviews[newInterviews.length - 1];
          const studentName = newStudents.find((s: any) => s.id === latestInterview.user_id)?.name || "Student";
          addLog(`[ASSESSMENT] : ${studentName.toUpperCase()} completed interview session. Grade: ${latestInterview.final_grade} (${latestInterview.percentage}%)`);
        } else if (newInterviews.length < prevCounts.current.interviews) {
          addLog(`[PURGE] : Interview session record deleted.`);
        }
      } else {
        prevCounts.current.initialized = true;
        addLog(`[SYSTEM] : Synchronized with Mainframe. Active DB: ${newStudents.length} Students, ${newResumes.length} Resumes, ${newInterviews.length} Interviews.`);
      }

      // Update refs
      prevCounts.current.students = newStudents.length;
      prevCounts.current.resumes = newResumes.length;
      prevCounts.current.interviews = newInterviews.length;

      setStudents(newStudents);
      setResumes(newResumes);
      setInterviews(newInterviews);
      setAdmins(data.admins || []);
    } catch (err: any) {
      console.error(err);
      addLog(`[ERROR] : Database sync failed: ${err.message}`);
    } finally {
      // Done syncing
    }
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
  };

  const handleManualSync = async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    const startTime = Date.now();
    await fetchAdminData(true);
    const elapsed = Date.now() - startTime;
    const minDuration = 800; // Guarantee at least 800ms of smooth spin
    if (elapsed < minDuration) {
      await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }
    setManualRefreshing(false);
  };

  // Poll for data updates dynamically (All time updated)
  useEffect(() => {
    fetchAdminData();

    // Long poll interval for live DB syncing
    const interval = setInterval(() => {
      fetchAdminData(true);
    }, 6000); // Poll every 6 seconds for dynamic live updates

    return () => clearInterval(interval);
  }, []);

  // Helper to convert base64 data URL to a safe browser Blob
  const dataURLtoBlob = (dataUrlStr: string): Blob | null => {
    if (!dataUrlStr) return null;
    try {
      let actualDataUrl = dataUrlStr;
      if (!dataUrlStr.startsWith("data:")) {
        actualDataUrl = `data:application/pdf;base64,${dataUrlStr}`;
      }
      const parts = actualDataUrl.split(",");
      const header = parts[0];
      const base64Data = parts[1] || parts[0];
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "application/pdf";
      
      const binary = atob(base64Data);
      const array = [];
      for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
      }
      return new Blob([new Uint8Array(array)], { type: mime });
    } catch (error) {
      console.error("Failed to convert base64 to Blob:", error);
      return null;
    }
  };

  // Manage Blob URL for iframe preview
  useEffect(() => {
    if (resumeFileContent && resumeFileContent.fileBase64) {
      const blob = dataURLtoBlob(resumeFileContent.fileBase64);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }
    setPreviewBlobUrl("");
  }, [resumeFileContent]);

  // Load original resume document content when opening the resume modal
  useEffect(() => {
    if (viewingResume) {
      setResumeFileContent(null);
      setLoadingFile(true);
      fetch(`/api/admin/resume/${viewingResume.user_id}/file`)
        .then(res => {
          if (!res.ok) throw new Error("File not found");
          return res.json();
        })
        .then(data => {
          if (data.fileBase64) {
            setResumeFileContent({ filename: data.filename, fileBase64: data.fileBase64 });
          } else {
            setResumeFileContent(null);
          }
        })
        .catch(err => {
          console.warn("Failed to retrieve resume binary:", err);
          setResumeFileContent(null);
        })
        .finally(() => {
          setLoadingFile(false);
        });
    } else {
      setResumeFileContent(null);
    }
  }, [viewingResume]);

  // Action: Delete Student (triggers custom confirmation modal)
  const handleDeleteStudent = (id: number, name: string) => {
    setStudentToDelete({ id, name });
  };

  // Action: Delete Interview (triggers custom confirmation modal)
  const handleDeleteInterview = (id: number, studentName: string) => {
    setInterviewToDelete({ id, studentName });
  };

  // Safe JSON Parsing helper
  const safeParse = (str: string, fallback: any) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  };

  // Filter students / resumes / interviews based on search and selected profile filters
  const filteredStudents = students.filter(s => {
    const query = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(query) || 
           s.email.toLowerCase().includes(query) ||
           s.stream.toLowerCase().includes(query) ||
           s.institution.toLowerCase().includes(query);
  });

  const filteredResumes = resumes.filter(r => {
    const student = students.find(s => s.id === r.user_id);
    if (selectedStudentFilter && r.user_id !== selectedStudentFilter) return false;
    
    const query = searchQuery.toLowerCase();
    const studentName = student ? student.name.toLowerCase() : "";
    const filename = r.filename.toLowerCase();
    return studentName.includes(query) || filename.includes(query);
  });

  const filteredInterviews = interviews.filter(i => {
    const student = students.find(s => s.id === i.user_id);
    if (selectedStudentFilter && i.user_id !== selectedStudentFilter) return false;

    const query = searchQuery.toLowerCase();
    const studentName = student ? student.name.toLowerCase() : "";
    const grade = i.final_grade.toLowerCase();
    const level = i.performance_level.toLowerCase();
    return studentName.includes(query) || grade.includes(query) || level.includes(query);
  });

  // Calculate stats dynamically
  const totalStudentsCount = students.length;
  const totalResumesCount = resumes.length;
  const totalInterviewsCount = interviews.length;

  return (
    <div className="admin-console-wrapper">
      <style>{`
        :root {
          --bg-dark: #02050e;
          --card-bg: rgba(8, 12, 24, 0.85);
          --accent: #00f2ff;
          --accent-glow: rgba(0, 242, 255, 0.4);
          --pink: #ff2975;
          --gold: #e2b714;
          --border-white: rgba(255, 255, 255, 0.08);
          --text-main: #ffffff;
          --text-dim: #8e99ae;
        }

        .admin-console-wrapper {
          background: var(--bg-dark);
          color: var(--text-main);
          min-height: 100vh;
          width: 100vw;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow-x: hidden;
          padding: 15px;
          position: relative;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .admin-console-wrapper::before {
          content: "";
          position: absolute; width: 100%; height: 100%;
          background: radial-gradient(circle at 15% 15%, rgba(0, 242, 255, 0.06) 0%, transparent 50%),
                      radial-gradient(circle at 85% 85%, rgba(255, 41, 117, 0.06) 0%, transparent 50%);
          z-index: 0;
          top: 0; left: 0;
          pointer-events: none;
        }

        .dashboard-container {
          width: 98vw; 
          height: 94vh;
          display: grid; 
          grid-template-columns: 310px 1fr;
          background: rgba(8, 12, 24, 0.96);
          backdrop-filter: blur(10px);
          border-radius: 40px;
          border: 1px solid var(--border-white);
          box-shadow: 0 40px 90px rgba(0,0,0,0.85);
          overflow: hidden;
          position: relative;
          z-index: 1;
          -webkit-font-smoothing: subpixel-antialiased;
          text-rendering: geometricPrecision;
        }

        aside {
          background: rgba(0, 0, 0, 0.6);
          border-right: 1px solid var(--border-white);
          padding: 40px 25px;
          display: flex; 
          flex-direction: column;
          position: relative;
        }

        /* brand logo */
        /* brand logo */
        .brand {
          font-family: 'Syncopate', sans-serif;
          font-size: 32px; font-weight: 800; 
          letter-spacing: 12px;
          text-align: center; margin-bottom: 45px;
          position: relative;
          background: linear-gradient(135deg, #ff9933 0%, #ffffff 50%, #138808 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 15px rgba(255, 153, 51, 0.2), 0 0 15px rgba(19, 136, 8, 0.2);
          filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.1));
        }

        .brand::after {
          content: "SUPREME ADMINISTRATION";
          position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
          font-size: 7px; letter-spacing: 4px; 
          background: linear-gradient(90deg, #ff9933, #138808);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 700; opacity: 0.9;
          white-space: nowrap;
        }

        /* Premium Avatar wrapper with glowing breathe and rotating double-ring aura */
        .logo-wrapper {
          width: 120px; height: 120px; margin: 0 auto 35px;
          position: relative; padding: 4px; border-radius: 50%;
          background: linear-gradient(135deg, #ff9933, #138808);
          box-shadow: 0 0 15px rgba(255, 153, 51, 0.3), 0 0 25px rgba(19, 136, 8, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s ease;
        }

        /* Double rotating glowing aura orbits in green and orange */
        .logo-wrapper::before, .logo-wrapper::after {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          padding: 2px;
          background: conic-gradient(
            from 0deg,
            #ff9933 0%,
            transparent 30%,
            #138808 50%,
            transparent 80%,
            #ff9933 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .logo-wrapper::before {
          animation: orbit-cw 6s linear infinite;
        }

        .logo-wrapper::after {
          inset: -12px;
          opacity: 0.5;
          animation: orbit-ccw 9s linear infinite;
          background: conic-gradient(
            from 180deg,
            #138808 0%,
            transparent 30%,
            #ff9933 50%,
            transparent 80%,
            #138808 100%
          );
        }

        @keyframes orbit-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes orbit-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        .logo-container {
          width: 100%; height: 100%; border-radius: 50%;
          overflow: hidden; background: #ffffff;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 15px rgba(0,0,0,0.12);
          border: none;
        }
        
        .logo-container img { 
          width: 100%; height: 100%; 
          object-fit: contain;
          border-radius: 50%;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .logo-wrapper:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 0 25px rgba(255, 153, 51, 0.5), 0 0 40px rgba(19, 136, 8, 0.5);
        }

        .logo-wrapper:hover .logo-container img {
          transform: scale(1.1);
        }

        /* Custom scrollbar styling */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 242, 255, 0.25);
          border-radius: 6px;
          border: 1px solid rgba(0, 242, 255, 0.1);
          box-shadow: inset 0 0 6px rgba(0, 242, 255, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 242, 255, 0.5);
          box-shadow: inset 0 0 8px rgba(0, 242, 255, 0.2);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 242, 255, 0.3) rgba(255, 255, 255, 0.02);
        }

        /* Sidebar Navigation buttons */
        .nav-link {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 20px; border-radius: 16px;
          color: var(--text-dim); text-decoration: none;
          font-size: 11px; font-weight: 800; margin-bottom: 10px;
          letter-spacing: 1.5px; transition: 0.35s ease;
          border: 1px solid transparent;
          text-transform: uppercase;
          background: transparent;
          text-align: left;
          width: 100%;
          cursor: pointer;
        }
        .nav-link:hover, .nav-link.active {
          background: linear-gradient(90deg, rgba(0, 242, 255, 0.08), transparent);
          color: var(--accent);
          border-left: 3px solid var(--accent);
          transform: translateX(6px);
        }

        .footer-note {
          margin-top: auto;
          text-align: center;
          padding-top: 25px;
          border-top: 1px solid var(--border-white);
        }

        .dev-label {
          font-size: 8px;
          letter-spacing: 3px;
          color: var(--accent);
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 700;
        }

        .dev-name {
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1px;
          background: linear-gradient(180deg, #ffffff 0%, #a5a5a5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 2px;
          display: inline-block;
        }

        .supreme-title {
          font-family: 'Syncopate', sans-serif;
          font-size: 9px;
          font-weight: 700;
          color: var(--gold);
          letter-spacing: 3px;
          display: block;
          margin-top: 3px;
          text-shadow: 0 0 10px rgba(226, 183, 20, 0.3);
        }

        .copyright {
          font-size: 8px;
          color: #475569;
          margin-top: 12px;
          letter-spacing: 2.2px;
          display: block;
          font-weight: 600;
        }

        /* Main Scrollable Canvas */
        main { 
          padding: 40px 50px; 
          overflow-y: auto; 
          height: 100%;
          max-height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .header-flex { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 35px; 
        }
        
        .stat-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-white);
          padding: 24px; border-radius: 24px;
          transition: 0.35s ease;
          position: relative;
          overflow: hidden;
        }
        .stat-card::after {
          content: "";
          position: absolute; bottom: 0; left: 0; width: 100%; height: 3px;
          background: transparent; transition: 0.35s;
        }
        .stat-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--accent);
          transform: translateY(-2px);
        }
        .stat-card:hover::after {
          background: var(--accent);
        }

        .btn-terminate {
          background: transparent;
          border: 1px solid var(--pink);
          color: var(--pink);
          padding: 12px 26px; border-radius: 100px;
          font-weight: 800; font-size: 10px; letter-spacing: 2px;
          cursor: pointer; transition: 0.3s;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-terminate:hover {
          background: var(--pink); color: #fff;
          box-shadow: 0 0 25px rgba(255, 41, 117, 0.35);
        }

        /* Live Terminal Panel for overview logs */
        .glass-panel {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-white);
          border-radius: 28px;
          height: 340px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .terminal-header {
          padding: 16px 24px; 
          border-bottom: 1px solid var(--border-white); 
          display: flex; 
          justify-content: space-between;
          align-items: center;
        }

        .terminal-logs {
          padding: 24px; 
          font-family: 'JetBrains Mono', monospace; 
          color: #94a3b8; 
          font-size: 12px; 
          line-height: 1.8;
          overflow-y: auto;
          flex-grow: 1;
        }

        /* Beautiful interactive tabular grid representation */
        .data-table-container {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-white);
          border-radius: 24px;
          overflow: hidden;
          margin-top: 15px;
        }

        .admin-table-scroll {
          max-height: 320px;
          overflow-y: auto;
          overflow-x: auto;
        }

        .table-controls {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-white);
          display: flex;
          gap: 15px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .search-input-wrap {
          position: relative;
          max-width: 380px;
          width: 100%;
        }

        .search-input-wrap input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-white);
          border-radius: 14px;
          padding: 10px 16px 10px 42px;
          color: #fff;
          outline: none;
          font-size: 13px;
          transition: 0.3s;
        }

        .search-input-wrap input:focus {
          border-color: var(--accent);
          background: rgba(255, 255, 255, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-dim);
          width: 16px;
          height: 16px;
        }

        .filter-select {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border-white);
          border-radius: 14px;
          padding: 10px 14px;
          color: #fff;
          font-size: 12px;
          outline: none;
          cursor: pointer;
        }

        .filter-select option {
          background: #02050e;
          color: #fff;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        th {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--text-dim);
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-white);
          font-weight: 700;
          background: rgba(0, 0, 0, 0.2);
        }

        td {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          font-size: 13px;
          color: #e2e8f0;
          vertical-align: middle;
        }

        tr:hover td {
          background: rgba(255,255,255,0.01);
        }

        .badge-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .badge-pill.cyan { background: rgba(0, 242, 255, 0.12); color: var(--accent); border: 1px solid rgba(0, 242, 255, 0.2); }
        .badge-pill.pink { background: rgba(255, 41, 117, 0.12); color: var(--pink); border: 1px solid rgba(255, 41, 117, 0.2); }
        .badge-pill.gold { background: rgba(226, 183, 20, 0.12); color: var(--gold); border: 1px solid rgba(226, 183, 20, 0.2); }
        .badge-pill.green { background: rgba(80, 250, 123, 0.12); color: #50fa7b; border: 1px solid rgba(80, 250, 123, 0.2); }

        /* Actions buttons inside records list */
        .btn-action-icon {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-white);
          width: 34px; height: 34px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-dim);
          cursor: pointer;
          transition: 0.25s;
          margin-right: 8px;
        }
        
        .btn-action-icon:hover {
          color: #fff;
          background: rgba(255,255,255,0.08);
        }

        .btn-action-icon.delete:hover {
          color: #fff;
          background: rgba(255, 41, 117, 0.2);
          border-color: var(--pink);
        }

        .btn-action-icon.view:hover {
          color: #fff;
          background: rgba(0, 242, 255, 0.2);
          border-color: var(--accent);
        }

        /* Modal Overlay for viewing details */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(2, 5, 14, 0.85);
          backdrop-filter: blur(15px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 100;
          padding: 20px;
        }

        .modal-content {
          background: #060b19;
          border: 1px solid var(--border-white);
          border-radius: 32px;
          width: min(850px, 95vw);
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 30px 80px rgba(0, 242, 255, 0.1);
          padding: 35px;
          position: relative;
        }

        .modal-close {
          position: absolute;
          top: 25px; right: 25px;
          cursor: pointer;
          color: var(--text-dim);
          transition: 0.2s;
        }
        .modal-close:hover { color: #fff; }

        /* Custom Scrollbar for premium vibe */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 10px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }

        .score-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-white);
          border-radius: 16px;
          padding: 12px 18px;
          text-align: center;
        }
      `}</style>

      <div className="dashboard-container">
        {/* Elite Sidebar Menu */}
        <aside>
          <div className="brand">CHAIL</div>
          
          {/* Rotating and Hoverable Premium Logo Avatar */}
          <div className="logo-wrapper">
            <div className="logo-container">
              <img 
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTGIreL4ghGgvcOM6lwE2tIo7eLGzusuKfiZHT6tDeexNnFFcHXCL5sdgq&s=10" 
                alt="Sayantik Chail" 
              />
            </div>
          </div>

          {/* Navigation Links */}
          <div className="nav-menu" style={{ flexGrow: 1 }}>
            <button 
              className={`nav-link ${activeTab === "STUDENTS" ? "active" : ""}`}
              onClick={() => { setActiveTab("STUDENTS"); setSelectedStudentFilter(null); }}
            >
              <Users size={15} /> STUDENTS ({totalStudentsCount})
            </button>
            <button 
              className={`nav-link ${activeTab === "INTERVIEWS" ? "active" : ""}`}
              onClick={() => setActiveTab("INTERVIEWS")}
            >
              <Briefcase size={15} /> INTERVIEWS ({totalInterviewsCount})
            </button>
            <button 
              className={`nav-link ${activeTab === "GUIDE" ? "active" : ""}`}
              onClick={() => setActiveTab("GUIDE")}
            >
              <BookOpen size={15} /> ADMIN GUIDE
            </button>
          </div>

          {/* Premium Developer Note Footer */}
          <div className="footer-note">
            <div className="dev-label">Lead Architect</div>
            <div className="dev-name">SAYANTIK CHAIL</div>
            <span className="supreme-title">SUPREME ARCHITECT</span>
            <span className="copyright">© 2026 GLOBAL CLEARANCE</span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main>
          {/* Supreme Command Header */}
          <div className="header-flex">
            <div>
              <h2 style={{ fontFamily: "Syncopate", fontSize: "24px", letterSpacing: "4px" }}>SUPREME COMMAND</h2>
              <p style={{ color: "var(--text-dim)", marginTop: "5px", fontSize: "12px" }}>
                Welcome back, {user.name}. System console status: Optimal.
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button 
                onClick={handleManualSync} 
                className="btn-action-icon"
                title="Force Database Sync"
                style={{ width: "42px", height: "42px", borderRadius: "100px" }}
              >
                <RefreshCw size={16} className={manualRefreshing ? "animate-spin" : ""} />
              </button>

              <button onClick={onLogout} className="btn-terminate">
                <LogOut size={14} /> Terminate Protocol
              </button>
            </div>
          </div>

          {/* Active Admin Deck representing 2nd uploaded image */}
          <div style={{
            background: "rgba(255, 41, 117, 0.02)",
            border: "1px solid rgba(255, 41, 117, 0.15)",
            borderRadius: "24px",
            padding: "16px 20px",
            marginBottom: "25px",
            boxShadow: "0 10px 30px rgba(255, 41, 117, 0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid rgba(255, 41, 117, 0.08)", paddingBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={16} style={{ color: "var(--pink)" }} />
                <span style={{ fontFamily: "Syncopate", fontSize: "11px", letterSpacing: "1.5px", color: "var(--pink)", fontWeight: 700 }}>ADMINS</span>
              </div>
              <span style={{
                background: "var(--pink)",
                color: "#fff",
                borderRadius: "100px",
                padding: "2px 8px",
                fontSize: "10px",
                fontWeight: "800",
                fontFamily: "monospace"
              }}>{admins.length}</span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "15px" }}>
              {admins.map(admin => {
                const isCurrent = admin.email.toLowerCase() === user.email.toLowerCase();
                return (
                  <div key={admin.id} style={{
                    background: isCurrent ? "rgba(0, 242, 255, 0.04)" : "rgba(255, 255, 255, 0.02)",
                    border: isCurrent ? "1px solid rgba(0, 242, 255, 0.25)" : "1px solid var(--border-white)",
                    borderRadius: "16px",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    position: "relative"
                  }}>
                    {isCurrent && (
                      <span className="badge-pill cyan" style={{ position: "absolute", top: "12px", right: "12px", fontSize: "7px", padding: "1px 5px" }}>
                        CURRENTLY ACTIVE
                      </span>
                    )}
                    {!isCurrent && (
                      <button
                        onClick={() => setAdminToDelete({ id: admin.id, name: admin.name })}
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          background: "rgba(255, 41, 117, 0.08)",
                          border: "1px solid rgba(255, 41, 117, 0.2)",
                          borderRadius: "8px",
                          width: "26px",
                          height: "26px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--pink)",
                          cursor: "pointer",
                          transition: "0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--pink)";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(255, 41, 117, 0.08)";
                          e.currentTarget.style.color = "var(--pink)";
                        }}
                        title="Delete Admin Registration"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <div style={{ fontWeight: "700", fontSize: "13px", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Shield size={12} style={{ color: "var(--pink)" }} /> {admin.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{admin.email}</div>
                    <div style={{ marginTop: "4px", fontSize: "9px", color: "var(--pink)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>
                      ✓ OPERATOR
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. STUDENTS VIEW */}
          {activeTab === "STUDENTS" && (
            <div className="data-table-container">
              <div className="table-controls">
                <div className="search-input-wrap">
                  <Search className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by student name, stream, college..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "12px" }}>
                  Showing {filteredStudents.length} of {totalStudentsCount} records
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                  No students matched your search query.
                </div>
              ) : (
                <div className="admin-table-scroll custom-scrollbar">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email ID</th>
                        <th>Qualification</th>
                        <th>Institution</th>
                        <th>Stream Branch</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(student => (
                        <tr key={student.id}>
                          <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>#{student.id}</td>
                          <td style={{ fontWeight: "600" }}>{student.name}</td>
                          <td>{student.email}</td>
                          <td>
                            <span className="badge-pill gold">{student.qualification}</span>
                          </td>
                          <td>{(() => {
                            const resume = resumes.find(r => r.user_id === student.id);
                            if (resume) {
                              const rAnalysis = safeParse(resume.detailed_analysis, null);
                              if (rAnalysis && (rAnalysis.detectedInstitution || rAnalysis.institution)) {
                                return rAnalysis.detectedInstitution || rAnalysis.institution;
                              }
                            }
                            return student.institution || "SVU";
                          })()}</td>
                          <td>{student.stream}</td>
                          <td style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {(() => {
                              const resume = resumes.find(r => r.user_id === student.id);
                              if (resume) {
                                return (
                                  <button
                                    onClick={() => setViewingResume(resume)}
                                    className="btn-action-icon view"
                                    title="View Original Resume Analysis"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                      width: "auto",
                                      padding: "6px 14px",
                                      height: "auto",
                                      background: "rgba(34, 211, 238, 0.12)",
                                      border: "1px solid rgba(34, 211, 238, 0.3)",
                                      borderRadius: "10px",
                                      color: "var(--cyan)",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      cursor: "pointer",
                                      transition: "0.2s"
                                    }}
                                  >
                                    <Search size={13} /> View Resume
                                  </button>
                                );
                              }
                              return (
                                <span style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic", padding: "6px 8px" }}>
                                  No Resume
                                </span>
                              );
                            })()}

                            <button 
                              onClick={() => handleDeleteStudent(student.id, student.name)}
                              className="btn-action-icon delete" 
                              title="Purge Student Account"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                width: "auto",
                                padding: "6px 14px",
                                height: "auto",
                                background: "rgba(255, 41, 117, 0.12)",
                                border: "1px solid rgba(255, 41, 117, 0.3)",
                                borderRadius: "10px",
                                color: "var(--pink)",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "0.2s"
                              }}
                            >
                              <Trash2 size={13} /> Delete Account
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. RESUMES VIEW */}
          {activeTab === "RESUMES" && (
            <div className="data-table-container">
              <div className="table-controls">
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexGrow: 1 }}>
                  <div className="search-input-wrap">
                    <Search className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search resume names..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {selectedStudentFilter && (
                    <button 
                      onClick={() => setSelectedStudentFilter(null)}
                      className="badge-pill pink"
                      style={{ border: "none", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      Filtered User #{selectedStudentFilter} <X size={10} />
                    </button>
                  )}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "12px" }}>
                  Showing {filteredResumes.length} of {totalResumesCount} detected files
                </div>
              </div>

              {filteredResumes.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                  No resume files detected matching current parameters.
                </div>
              ) : (
                <div className="admin-table-scroll custom-scrollbar">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Student Owner</th>
                        <th>File Name</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResumes.map(resume => {
                        const owner = students.find(s => s.id === resume.user_id);

                        return (
                          <tr 
                            key={resume.id}
                            style={{ cursor: "pointer" }}
                            className="hover:bg-white/5 transition-colors"
                          >
                            <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>#{resume.id}</td>
                            <td style={{ fontWeight: "600" }}>{owner ? owner.name : `Unknown (User ID: ${resume.user_id})`}</td>
                            <td style={{ color: "var(--gold)" }}>{resume.filename || "resume.pdf"}</td>
                            <td style={{ textAlign: "right" }}>
                              <button 
                                onClick={() => setViewingResume(resume)}
                                className="btn-action-icon view" 
                                title="View Deep Resume Analysis"
                              >
                                <Eye size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. INTERVIEWS VIEW */}
          {activeTab === "INTERVIEWS" && (
            <div className="data-table-container">
              <div className="table-controls">
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexGrow: 1 }}>
                  <div className="search-input-wrap">
                    <Search className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search score level, grades..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {selectedStudentFilter && (
                    <button 
                      onClick={() => setSelectedStudentFilter(null)}
                      className="badge-pill pink"
                      style={{ border: "none", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      Filtered User #{selectedStudentFilter} <X size={10} />
                    </button>
                  )}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "12px" }}>
                  Showing {filteredInterviews.length} of {totalInterviewsCount} sessions
                </div>
              </div>

              {filteredInterviews.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                  No interview records discovered matching criteria.
                </div>
              ) : (
                <div className="admin-table-scroll custom-scrollbar">
                  <table>
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Student Name</th>
                        <th>Stream</th>
                        <th>Grade</th>
                        <th>Percentage</th>
                        <th>Verdict Level</th>
                        <th>Timestamp Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInterviews.map(interview => {
                        const owner = students.find(s => s.id === interview.user_id);
                        
                        let gradeColor = "cyan";
                        if (interview.final_grade.startsWith("A")) gradeColor = "green";
                        else if (interview.final_grade.startsWith("B")) gradeColor = "gold";
                        else if (interview.final_grade.startsWith("C") || interview.final_grade.startsWith("F")) gradeColor = "pink";

                        return (
                          <tr key={interview.id}>
                            <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>#{interview.id}</td>
                            <td style={{ fontWeight: "600" }}>{owner ? owner.name : `Unknown (User ID: ${interview.user_id})`}</td>
                            <td>{interview.stream || "General"}</td>
                            <td>
                              <span className={`badge-pill ${gradeColor}`}>{interview.final_grade}</span>
                            </td>
                            <td style={{ fontWeight: "700" }}>{interview.percentage}%</td>
                            <td style={{ fontStyle: "italic", fontSize: "11px" }}>{interview.performance_level}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
                                <Calendar size={12} /> {interview.date_created || "01-07-2026"}
                              </div>
                            </td>
                             <td style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <button 
                                onClick={() => setViewingInterview(interview)}
                                className="btn-action-icon view" 
                                title="View Detailed Marksheet Report"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                  width: "auto",
                                  padding: "6px 14px",
                                  height: "auto",
                                  background: "rgba(0, 242, 255, 0.12)",
                                  border: "1px solid rgba(0, 242, 255, 0.3)",
                                  borderRadius: "10px",
                                  color: "var(--accent)",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "0.2s"
                                }}
                              >
                                <Eye size={13} /> View Report
                              </button>
                              <button 
                                onClick={() => handleDeleteInterview(interview.id, owner ? owner.name : "Student")}
                                className="btn-action-icon delete" 
                                title="Purge Record"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                  width: "auto",
                                  padding: "6px 14px",
                                  height: "auto",
                                  background: "rgba(255, 41, 117, 0.12)",
                                  border: "1px solid rgba(255, 41, 117, 0.3)",
                                  borderRadius: "10px",
                                  color: "var(--pink)",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "0.2s"
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "GUIDE" && (
            <div className="guide-tab-wrapper animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              {/* Main Banner */}
              <div className="cyber-card" style={{ padding: "30px", background: "linear-gradient(135deg, rgba(13, 35, 92, 0.4) 0%, rgba(5, 12, 31, 0.9) 100%)", border: "1px solid var(--accent-dim)" }}>
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <div style={{ background: "rgba(0, 242, 254, 0.1)", borderRadius: "12px", padding: "12px", color: "var(--accent)" }}>
                    <BookOpen size={28} />
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "Syncopate", fontSize: "16px", color: "#ffffff", letterSpacing: "2px", margin: 0 }}>
                      CHAIL COMMAND CENTER PLAYBOOK
                    </h2>
                    <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "6px", lineHeight: "1.6" }}>
                      Authorized Operator Handbook for Swami Vivekananda University Placement Assessment & AI-Mock Portal. Follow this structured roadmap to navigate, configure, and audit all student profiles, parsed resume data, and interview transcripts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid of Sections */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
                
                {/* Section 1: Authentication & Authorization Flow */}
                <div className="cyber-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-white)", paddingBottom: "10px" }}>
                    <span style={{ color: "var(--cyan)", display: "flex" }}><Key size={18} /></span>
                    <h3 style={{ fontSize: "13px", fontFamily: "Syncopate", fontWeight: "700", color: "var(--cyan)" }}>1. SECURE ENTRIES & AUTH</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6" }}>
                    The portal utilizes a secure multi-tier registration and authentication mechanism to prevent unauthorized access.
                  </p>
                  <ul style={{ fontSize: "11px", color: "var(--text-dim)", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <li><strong>Secret Onboarding Code:</strong> Newly assigned admins can self-register using the signup panel by inputting the master registration code: <code style={{ color: "var(--cyan)", fontWeight: "bold" }}>CHAILADMIN2026</code>.</li>
                    <li><strong>Dual-Factor Security:</strong> After entering registered email credentials, enter the 2-Factor passcode <code style={{ color: "var(--cyan)", fontWeight: "bold" }}>SVUADMIN2FA</code> to generate the administrative session token.</li>
                  </ul>
                </div>

                {/* Section 2: Real-time Deck Metrics & Admin Purge Protocol */}
                <div className="cyber-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-white)", paddingBottom: "10px" }}>
                    <span style={{ color: "var(--pink)", display: "flex" }}><Shield size={18} /></span>
                    <h3 style={{ fontSize: "13px", fontFamily: "Syncopate", fontWeight: "700", color: "var(--pink)" }}>2. LIVE OPERATORS & ACCESS</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6" }}>
                    Keep track of registered operators and utilize the strict de-authorization controls to maintain portal safety.
                  </p>
                  <ul style={{ fontSize: "11px", color: "var(--text-dim)", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <li><strong>Active Operator Deck:</strong> A dedicated widget at the top displays the total count of administrators. Currently active operator accounts are explicitly highlighted with a <span className="badge-pill cyan" style={{ fontSize: "8px", padding: "1px 4px" }}>CURRENTLY ACTIVE</span> badge.</li>
                    <li><strong>Admin Purge Protocol:</strong> To restrict access, operators can de-authorize other admins by clicking the red trash icon. Deleting credentials completely purges their login authorization.</li>
                    <li><strong>Fail-Safe Guard:</strong> The system strictly forbids deleting the last remaining administrator, protecting the SVU portal from accidental lockout.</li>
                  </ul>
                </div>

                {/* Section 3: Student Registry Operations */}
                <div className="cyber-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-white)", paddingBottom: "10px" }}>
                    <span style={{ color: "var(--green)", display: "flex" }}><Users size={18} /></span>
                    <h3 style={{ fontSize: "13px", fontFamily: "Syncopate", fontWeight: "700", color: "var(--green)" }}>3. STUDENTS REGISTRY</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6" }}>
                    Provides instant lookup, CV extraction, and management profiles of SVU student candidates.
                  </p>
                  <ul style={{ fontSize: "11px", color: "var(--text-dim)", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <li><strong>Instant Lookup:</strong> The search query bar enables real-time filtering of student directories by Name, Email address, Stream, or Institution.</li>
                    <li><strong>View Resumes:</strong> Retrieve candidate resumes instantly. Click "View Resume" to open the interactive CV panel, where you can inspect qualifications, download documents, or view the original PDF in a new window.</li>
                    <li><strong>Cascade Account Purge:</strong> Delete outdated or incorrect student registrations. *Warning: Deletions cascade and wipe out associated resumes and interviews.*</li>
                  </ul>
                </div>

                {/* Section 4: Performance Audits & Transcripts */}
                <div className="cyber-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-white)", paddingBottom: "10px" }}>
                    <span style={{ color: "var(--gold)", display: "flex" }}><Briefcase size={18} /></span>
                    <h3 style={{ fontSize: "13px", fontFamily: "Syncopate", fontWeight: "700", color: "var(--gold)" }}>4. INTERVIEWS & TRANSCRIPTS</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6" }}>
                    Provides placement officers with comprehensive grades and diagnostic evaluation transcripts.
                  </p>
                  <ul style={{ fontSize: "11px", color: "var(--text-dim)", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <li><strong>Numerical Marksheets:</strong> Inspect assessment metrics including Overall Percentage, Grade designations (A to F), and Performance Level ratings.</li>
                    <li><strong>Detailed Playback Reports:</strong> Click the <span style={{ color: "var(--accent)" }}>View Report</span> option to read full chat logs of the dialogue between candidates and the AI Mentor.</li>
                    <li><strong>Ready Feedback Matrix:</strong> View direct pointers on Core Strengths, Key Areas of Development, and custom Career Recommendations.</li>
                  </ul>
                </div>

                {/* Section 5: Dynamic Step-By-Step Onboarding Roadmap */}
                <div className="cyber-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px", gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-white)", paddingBottom: "10px" }}>
                    <span style={{ color: "var(--cyan)", display: "flex" }}><Cpu size={18} /></span>
                    <h3 style={{ fontSize: "13px", fontFamily: "Syncopate", fontWeight: "700", color: "var(--cyan)" }}>5. STEP-BY-STEP OPERATIONAL SEQUENCE</h3>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6" }}>
                    When a new placement session begins, follow this step-by-step administrative procedure:
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginTop: "10px" }}>
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px" }}>
                      <h4 style={{ fontSize: "12px", color: "#fff", fontWeight: "600", marginBottom: "8px" }}>STEP 1: Verify Registration</h4>
                      <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: 0, lineHeight: "1.5" }}>
                        Ensure candidates sign up on the portal under the correct department/branch. New student registrations will automatically stream onto the <strong>STUDENTS</strong> tab.
                      </p>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px" }}>
                      <h4 style={{ fontSize: "12px", color: "#fff", fontWeight: "600", marginBottom: "8px" }}>STEP 2: Review CV Extractor</h4>
                      <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: 0, lineHeight: "1.5" }}>
                        Once students upload their CV, click the <strong>View Resume</strong> button to check parsing accuracy, review core frameworks, languages, and technical keywords.
                      </p>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px" }}>
                      <h4 style={{ fontSize: "12px", color: "#fff", fontWeight: "600", marginBottom: "8px" }}>STEP 3: Evaluate Assessment Marks</h4>
                      <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: 0, lineHeight: "1.5" }}>
                        After candidates complete their AI Mock interview, review their performance under the <strong>INTERVIEWS</strong> tab. Use this diagnostic feedback to guide placement training.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Security and Ethics Notice */}
              <div className="cyber-card" style={{ padding: "20px", background: "rgba(235, 94, 85, 0.05)", border: "1px solid rgba(235, 94, 85, 0.2)" }}>
                <div style={{ display: "flex", gap: "15px", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--pink)", display: "flex", marginTop: "2px" }}><ShieldAlert size={18} /></span>
                  <div>
                    <h4 style={{ fontSize: "12px", fontWeight: "700", color: "var(--pink)", margin: 0, textTransform: "uppercase" }}>Administrative Protocol & Security Notice</h4>
                    <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px", lineHeight: "1.5" }}>
                      All deletions are absolute and cascading. Obsolete student, resume, or assessment records will be completely purged from the local database upon operation. Use destruction triggers with appropriate discretion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* DETAILED RESUME ANALYSIS MODAL */}
      {viewingResume && (
        <div className="modal-overlay" onClick={() => setViewingResume(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: "min(600px, 95vw)", maxWidth: "600px" }}>
            <X className="modal-close" onClick={() => setViewingResume(null)} />
            
            <h2 style={{ fontFamily: "Syncopate", fontSize: "16px", color: "var(--accent)", marginBottom: "20px", letterSpacing: "2px", textAlign: "center" }}>
              RESUME ARCHIVE PORTAL
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {loadingFile ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
                  <RefreshCw size={36} className="animate-spin" style={{ color: "var(--accent)", marginBottom: "15px" }} />
                  <div style={{ color: "var(--text-dim)", fontSize: "14px" }}>Retrieving original document...</div>
                </div>
              ) : !resumeFileContent || !resumeFileContent.fileBase64 ? (
                <div style={{ padding: "40px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px", background: "rgba(255,255,255,0.01)" }}>
                  <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "15px" }}>
                    ⚠️ Original binary document was not archived or is in an older database format.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "10px 0" }}>
                  {/* File Icon display */}
                  <div style={{ background: "rgba(0, 242, 255, 0.05)", border: "1px solid rgba(0, 242, 255, 0.15)", color: "var(--accent)", borderRadius: "20px", padding: "30px", marginBottom: "20px", display: "inline-block", boxShadow: "0 0 20px rgba(0,242,255,0.05)" }}>
                    <FileText size={64} style={{ color: "var(--gold)" }} />
                  </div>

                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#fff", marginBottom: "6px", wordBreak: "break-all" }}>
                    {resumeFileContent.filename}
                  </h3>
                  
                  <div style={{ fontSize: "13px", color: "var(--text-dim)", marginBottom: "20px" }}>
                    Candidate: <strong style={{ color: "var(--accent)" }}>{students.find(s => s.id === viewingResume.user_id)?.name || "Unknown"}</strong>
                    <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.15)" }}>|</span>
                    Format: <strong style={{ color: "var(--gold)" }}>{resumeFileContent.filename.split(".").pop()?.toUpperCase() || "UNKNOWN"}</strong>
                  </div>

                  <p style={{ fontSize: "12px", color: "var(--text-dim)", maxWidth: "440px", lineHeight: "1.6", marginBottom: "30px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-white)", padding: "12px 16px", borderRadius: "10px" }}>
                    ℹ️ For secure & high-fidelity rendering, please use the options below to download the resume file or view it directly in a dedicated browser tab.
                  </p>

                  {/* Actions buttons */}
                  <div style={{ display: "flex", gap: "15px", width: "100%", justifyContent: "center" }}>
                    <a
                      href={previewBlobUrl || resumeFileContent.fileBase64}
                      download={resumeFileContent.filename}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        background: "rgba(0, 242, 255, 0.12)",
                        border: "1px solid rgba(0, 242, 255, 0.3)",
                        borderRadius: "12px",
                        color: "var(--accent)",
                        fontSize: "14px",
                        fontWeight: "700",
                        cursor: "pointer",
                        textDecoration: "none",
                        transition: "all 0.2s",
                        boxShadow: "0 0 15px rgba(0, 242, 255, 0.05)",
                        flex: 1,
                        maxWidth: "200px"
                      }}
                    >
                      📥 Download File
                    </a>
                    
                    <button
                      onClick={() => {
                        if (previewBlobUrl) {
                          const w = window.open(previewBlobUrl, "_blank");
                          if (w) w.focus();
                        } else {
                          const newTab = window.open();
                          if (newTab) {
                            newTab.document.write(
                              `<iframe src="${resumeFileContent.fileBase64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
                            );
                            newTab.focus();
                          }
                        }
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        background: "linear-gradient(90deg, var(--accent) 0%, #0099ff 100%)",
                        border: "none",
                        borderRadius: "12px",
                        color: "#000",
                        fontSize: "14px",
                        fontWeight: "800",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: "0 0 15px rgba(0, 242, 255, 0.2)",
                        flex: 1,
                        maxWidth: "200px"
                      }}
                    >
                      Open in New Tab ↗
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETE STUDENT MODAL */}
      {studentToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setStudentToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: "min(500px, 95vw)", border: "1px solid var(--pink)" }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255, 41, 117, 0.1)", color: "var(--pink)", borderRadius: "50%", padding: "12px" }}>
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--pink)", fontFamily: "Syncopate", letterSpacing: "1px", margin: 0 }}>
                  CRITICAL PURGE PROTOCOL
                </h3>
                <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
                  ADMIN SECURITY CONFIRMATION REQUIRED
                </p>
              </div>
            </div>

            <div style={{ margin: "20px 0", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0" }}>
              Are you absolutely sure you want to completely delete the student account for <strong>{studentToDelete.name}</strong>?
              <div style={{ marginTop: "12px", background: "rgba(255, 41, 117, 0.05)", border: "1px solid rgba(255, 41, 117, 0.2)", padding: "12px", borderRadius: "10px", fontSize: "11px", color: "var(--text-dim)" }}>
                ⚠️ <strong>CASCADING DELETION DETECTED:</strong> This will permanently erase their user ID, credentials, uploaded resume file, and all associated interview marks/transcripts. The student will have to register again from scratch to perform any assessments.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "25px" }}>
              <button
                onClick={() => setStudentToDelete(null)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-white)",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel Protocol
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  const targetId = studentToDelete.id;
                  const targetName = studentToDelete.name;
                  setIsDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/student/${targetId}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to delete student");

                    showNotification(`Student ${targetName} deleted successfully!`);
                    addLog(`[PURGE] : Student account ${targetName.toUpperCase()} (ID: ${targetId}) deleted by administrator.`);
                    
                    // Update local state immediately
                    setStudents(prev => prev.filter(s => s.id !== targetId));
                    setResumes(prev => prev.filter(r => r.user_id !== targetId));
                    setInterviews(prev => prev.filter(i => i.user_id !== targetId));
                    setStudentToDelete(null);
                  } catch (err: any) {
                    showNotification(`❌ Error deleting account: ${err.message}`);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                style={{
                  background: "linear-gradient(90deg, var(--pink) 0%, #db1455 100%)",
                  boxShadow: "0 0 15px rgba(255, 41, 117, 0.4)",
                  border: "none",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1
                }}
              >
                {isDeleting ? "Purging Candidate..." : "Confirm Deletion 💥"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETE INTERVIEW MODAL */}
      {interviewToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setInterviewToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: "min(500px, 95vw)", border: "1px solid var(--pink)" }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255, 41, 117, 0.1)", color: "var(--pink)", borderRadius: "50%", padding: "12px" }}>
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--pink)", fontFamily: "Syncopate", letterSpacing: "1px", margin: 0 }}>
                  PURGE INTERVIEW SESSION
                </h3>
                <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
                  ADMIN CONFIRMATION REQUIRED
                </p>
              </div>
            </div>

            <div style={{ margin: "20px 0", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0" }}>
              Are you sure you want to delete the interview session record for student <strong>{interviewToDelete.studentName}</strong>?
              <div style={{ marginTop: "12px", background: "rgba(255, 41, 117, 0.05)", border: "1px solid rgba(255, 41, 117, 0.2)", padding: "12px", borderRadius: "10px", fontSize: "11px", color: "var(--text-dim)" }}>
                ⚠️ This will permanently remove this assessment and grade transcript from the database.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "25px" }}>
              <button
                onClick={() => setInterviewToDelete(null)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-white)",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel Protocol
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  const targetId = interviewToDelete.id;
                  const targetName = interviewToDelete.studentName;
                  setIsDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/interview/${targetId}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to delete interview");

                    showNotification(`Interview record deleted successfully!`);
                    addLog(`[PURGE] : Deleted interview ID ${targetId} associated with student ${targetName.toUpperCase()}.`);
                    
                    // Update local state immediately
                    setInterviews(prev => prev.filter(i => i.id !== targetId));
                    setInterviewToDelete(null);
                  } catch (err: any) {
                    showNotification(`❌ Error deleting interview: ${err.message}`);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                style={{
                  background: "linear-gradient(90deg, var(--pink) 0%, #db1455 100%)",
                  boxShadow: "0 0 15px rgba(255, 41, 117, 0.4)",
                  border: "none",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1
                }}
              >
                {isDeleting ? "Purging Session..." : "Confirm Purge 💥"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETE ADMIN REGISTRATION MODAL */}
      {adminToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setAdminToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: "min(500px, 95vw)", border: "1px solid var(--pink)" }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255, 41, 117, 0.1)", color: "var(--pink)", borderRadius: "50%", padding: "12px" }}>
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--pink)", fontFamily: "Syncopate", letterSpacing: "1px", margin: 0 }}>
                  ADMIN PURGE PROTOCOL
                </h3>
                <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
                  CRITICAL ACCESS CONTROL MUTATION
                </p>
              </div>
            </div>

            <div style={{ margin: "20px 0", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0" }}>
              Are you absolutely sure you want to delete the administrator registration for <strong>{adminToDelete.name}</strong>?
              <div style={{ marginTop: "12px", background: "rgba(255, 41, 117, 0.05)", border: "1px solid rgba(255, 41, 117, 0.2)", padding: "12px", borderRadius: "10px", fontSize: "11px", color: "var(--text-dim)" }}>
                ⚠️ <strong>DE-AUTHORIZATION IN PROGRESS:</strong> This action is permanent and will completely purge this admin's credentials and authority from the database mainframe. They will no longer be able to log in to this supreme command.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "25px" }}>
              <button
                onClick={() => setAdminToDelete(null)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-white)",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel Purge
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  const targetId = adminToDelete.id;
                  const targetName = adminToDelete.name;
                  setIsDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/admin-user/${targetId}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to delete admin");

                    showNotification(`Admin registration for ${targetName} deleted successfully!`);
                    addLog(`[PURGE] : Admin registration for ${targetName.toUpperCase()} (ID: ${targetId}) has been deleted.`);
                    
                    // Update local state immediately
                    setAdmins(prev => prev.filter(a => a.id !== targetId));
                    setAdminToDelete(null);
                  } catch (err: any) {
                    showNotification(`❌ Error deleting admin: ${err.message}`);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                style={{
                  background: "linear-gradient(90deg, var(--pink) 0%, #db1455 100%)",
                  boxShadow: "0 0 15px rgba(255, 41, 117, 0.4)",
                  border: "none",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1
                }}
              >
                {isDeleting ? "De-authorizing..." : "Confirm Purge 💥"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED INTERVIEW PERFORMANCE TRANSCRIPT MODAL */}
      {viewingInterview && (
        <div className="modal-overlay" onClick={() => setViewingInterview(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: "min(1050px, 95vw)" }}>
            <X className="modal-close" onClick={() => setViewingInterview(null)} />
            
            <h2 style={{ fontFamily: "Syncopate", fontSize: "15px", color: "var(--accent)", marginBottom: "25px", letterSpacing: "2px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Award size={18} style={{ color: "var(--accent)" }} /> OFFICIAL INTERVIEW ASSESSMENT REPORT CARD & MARKSHEET
            </h2>

            {/* Premium SVU Academic Marksheet Panel */}
            <div style={{
              background: "rgba(0, 242, 255, 0.01)",
              border: "2px solid rgba(0, 242, 255, 0.12)",
              borderRadius: "24px",
              padding: "24px",
              position: "relative",
              marginBottom: "25px",
              overflow: "hidden"
            }}>
              {/* Glowing Watermark background text */}
              <div style={{
                position: "absolute",
                right: "-20px",
                bottom: "-20px",
                opacity: 0.02,
                color: "var(--accent)",
                pointerEvents: "none",
                fontFamily: "Syncopate",
                fontSize: "120px",
                fontWeight: 900
              }}>
                SVU
              </div>

              {/* Marksheet Title Banner */}
              <div style={{
                textAlign: "center",
                borderBottom: "1px dashed rgba(255, 255, 255, 0.15)",
                paddingBottom: "18px",
                marginBottom: "20px"
              }}>
                <h3 style={{
                  fontFamily: "Syncopate",
                  fontSize: "15px",
                  color: "#fff",
                  letterSpacing: "3px",
                  margin: "0 0 5px 0"
                }}>
                  SWAMI VIVEKANANDA UNIVERSITY
                </h3>
                <p style={{
                  fontSize: "10px",
                  color: "var(--text-dim)",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  margin: "0 0 10px 0"
                }}>
                  Placement & Career Development Board (CHAIL Evaluation Engine)
                </p>
                <div style={{
                  display: "inline-block",
                  background: "rgba(0, 242, 255, 0.06)",
                  border: "1px solid rgba(0, 242, 255, 0.2)",
                  borderRadius: "6px",
                  padding: "5px 14px",
                  fontSize: "11px",
                  color: "var(--accent)",
                  fontWeight: "700",
                  letterSpacing: "0.5px"
                }}>
                  OFFICIAL TRANSCRIPT STATEMENT OF MARKS (MARKSHEET)
                </div>
              </div>

              {/* Marksheet Grid (Student details & Summary stats) */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: "24px",
                fontSize: "12px",
                marginBottom: "20px"
              }}>
                {/* Left: Candidate Details */}
                <div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 0", color: "var(--text-dim)", fontWeight: "500", width: "150px" }}>Examinee Name:</td>
                        <td style={{ padding: "8px 0", fontWeight: "700", color: "#fff" }}>
                          {students.find(s => s.id === viewingInterview.user_id)?.name || "Unknown Candidate"}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 0", color: "var(--text-dim)", fontWeight: "500" }}>Qualification:</td>
                        <td style={{ padding: "8px 0", fontWeight: "600", color: "var(--gold)" }}>
                          {viewingInterview.qualification || "Graduation"}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 0", color: "var(--text-dim)", fontWeight: "500" }}>Subject Stream:</td>
                        <td style={{ padding: "8px 0", fontWeight: "600", color: "var(--accent)" }}>
                          {viewingInterview.stream || "General Subjects"}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 0", color: "var(--text-dim)", fontWeight: "500" }}>Assessment Date:</td>
                        <td style={{ padding: "8px 0", color: "#e2e8f0" }}>{viewingInterview.date_created || "01-07-2026"}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px 0", color: "var(--text-dim)", fontWeight: "500" }}>Board Registry Ref:</td>
                        <td style={{ padding: "8px 0", fontFamily: "monospace", color: "var(--accent)" }}>SVU-CHAIL-DEC-#{viewingInterview.id}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Right: Board Seal & Quick Status */}
                <div style={{
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                  paddingLeft: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "1px" }}>Aggregate Percentage</div>
                    <div style={{ fontSize: "38px", fontWeight: "900", color: "var(--accent)", lineHeight: 1, margin: "6px 0" }}>
                      {viewingInterview.percentage}%
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                      ({viewingInterview.overall_score} / 500 cumulative score)
                    </div>
                  </div>

                  {/* Official Gold/Cyan Stamp Seal Emblem */}
                  <div style={{
                    width: "90px",
                    height: "90px",
                    border: "3px double rgba(0, 242, 255, 0.4)",
                    borderRadius: "50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: "rotate(-4deg)",
                    background: "rgba(0, 242, 255, 0.02)",
                    boxShadow: "0 0 15px rgba(0, 242, 255, 0.1)"
                  }}>
                    <Award size={26} style={{ color: "var(--gold)" }} />
                    <span style={{ fontSize: "7px", fontWeight: "bold", color: "var(--accent)", marginTop: "3px", letterSpacing: "1px" }}>SVU PANEL</span>
                    <span style={{ fontSize: "6px", color: "var(--text-dim)", textTransform: "uppercase" }}>CERTIFIED</span>
                  </div>
                </div>
              </div>

              {/* Marks Statement Detailed Table */}
              <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", background: "rgba(0,0,0,0.25)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th style={{ padding: "12px 14px", width: "50px", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px", fontWeight: "700" }}>SL</th>
                      <th style={{ padding: "12px 14px", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px", fontWeight: "700" }}>ASSESSMENT PARAMETER</th>
                      <th style={{ padding: "12px 14px", width: "110px", textAlign: "center", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px", fontWeight: "700" }}>MAX MARKS</th>
                      <th style={{ padding: "12px 14px", width: "130px", textAlign: "center", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px", fontWeight: "700" }}>MARKS OBTAINED</th>
                      <th style={{ padding: "12px 14px", width: "90px", textAlign: "center", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px", fontWeight: "700" }}>GRADE</th>
                      <th style={{ padding: "12px 14px", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px", fontWeight: "700" }}>QUALITATIVE REMARK / CORE OBSERVATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const scores = safeParse(viewingInterview.scores, {});
                      const parameterDetails: Record<string, { label: string; sl: number }> = {
                        confidence: { label: "Communication Confidence & Conviction", sl: 1 },
                        clarity: { label: "Explanation Structure & Clarity", sl: 2 },
                        relevance: { label: "Resume-Domain Relevance & Alignment", sl: 3 },
                        technicalDepth: { label: "Technical Competence & Concept Depth", sl: 4 },
                        grammar: { label: "Grammar, Phrasing & Professional Vocabulary", sl: 5 }
                      };

                      // Map keys to display them
                      const keys = ["confidence", "clarity", "relevance", "technicalDepth", "grammar"];
                      
                      return keys.map((key, i) => {
                        const item = scores[key] || { score: 0, remark: "No marks saved." };
                        const scoreVal = typeof item === "object" ? (item.score ?? 0) : (typeof item === "number" ? item : 0);
                        const remarkVal = typeof item === "object" ? (item.remark || "Satisfactory feedback provided.") : "Satisfactory feedback provided.";
                        const details = parameterDetails[key] || { label: key.replace(/([A-Z])/g, ' $1').trim(), sl: i + 1 };

                        let subGrade = "F";
                        let subColor = "var(--pink)";
                        if (scoreVal >= 90) { subGrade = "A+"; subColor = "#50fa7b"; }
                        else if (scoreVal >= 80) { subGrade = "A"; subColor = "var(--accent)"; }
                        else if (scoreVal >= 70) { subGrade = "B+"; subColor = "var(--gold)"; }
                        else if (scoreVal >= 60) { subGrade = "B"; subColor = "#ff79c6"; }
                        else if (scoreVal >= 50) { subGrade = "C"; subColor = "#bd93f9"; }

                        return (
                          <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "monospace", color: "var(--text-dim)" }}>{details.sl}</td>
                            <td style={{ padding: "12px 14px", fontWeight: "600", color: "#fff" }}>{details.label}</td>
                            <td style={{ padding: "12px 14px", textAlign: "center", color: "var(--text-dim)" }}>100</td>
                            <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", color: "var(--accent)" }}>{scoreVal}</td>
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <span style={{ fontWeight: "800", color: subColor }}>{subGrade}</span>
                            </td>
                            <td style={{ padding: "12px 14px", fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic" }}>{remarkVal}</td>
                          </tr>
                        );
                      });
                    })()}
                    
                    {/* Summary Cumulative Totals Row */}
                    <tr style={{ background: "rgba(0, 242, 255, 0.04)", borderTop: "2px solid rgba(0, 242, 255, 0.2)" }}>
                      <td style={{ padding: "14px" }}></td>
                      <td style={{ padding: "14px", fontWeight: "700", color: "#fff", textTransform: "uppercase", letterSpacing: "1px", fontSize: "11px" }}>CUMULATIVE ASSESSMENT TOTALS</td>
                      <td style={{ padding: "14px", textAlign: "center", fontWeight: "700", color: "#fff" }}>500</td>
                      <td style={{ padding: "14px", textAlign: "center", fontWeight: "800", color: "var(--accent)", fontSize: "13px" }}>{viewingInterview.overall_score}</td>
                      <td style={{ padding: "14px", textAlign: "center", fontWeight: "900", color: "var(--pink)", fontSize: "13px" }}>{viewingInterview.final_grade}</td>
                      <td style={{ padding: "14px", fontWeight: "700", color: "var(--accent)", fontSize: "11px" }}>
                        VERDICT: {viewingInterview.performance_level}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Strengths & Recommendations */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "25px" }}>
              <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-white)", borderRadius: "16px", padding: "18px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase", color: "var(--gold)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle size={14} style={{ color: "var(--gold)" }} /> QUALITATIVE AI APPRAISAL SUMMARY
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6", margin: 0 }}>
                  {viewingInterview.summary || "No qualitative summary generated for this session."}
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-white)", borderRadius: "16px", padding: "18px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Cpu size={14} style={{ color: "var(--accent)" }} /> SVU BOARD PLACEMENT RECOMMENDATIONS
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {safeParse(viewingInterview.feedback, ["Continue practicing core concepts.", "Focus on mock board interviews.", "Structure code responses using flowchart algorithms."]).map((rec: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text-dim)", lineHeight: "1.4" }}>
                      <span style={{ color: "var(--accent)", fontWeight: "bold" }}>▸</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stored Questions & Answers Dialog Transcript */}
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase", color: "var(--accent)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Terminal size={14} style={{ color: "var(--accent)" }} /> VERBATIM EXAMINEE RESPONSE TRANSCRIPT
              </h3>
              <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-white)", borderRadius: "16px", padding: "20px", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                {(() => {
                  const qArr = safeParse(viewingInterview.questions, []);
                  const aArr = safeParse(viewingInterview.answers, []);

                  if (qArr.length === 0) {
                    return <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>No active transcript lines recorded.</span>;
                  }

                  return qArr.map((q: any, index: number) => {
                    const questionText = typeof q === "string" ? q : q.question || q.q || "";
                    const answerText = aArr[index] ? (typeof aArr[index] === "string" ? aArr[index] : aArr[index].answer || "") : "No response provided.";

                    return (
                      <div key={index} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "14px" }}>
                        <div style={{ fontWeight: "700", color: "var(--accent)", fontSize: "12.5px", marginBottom: "4px" }}>Q{index + 1}: {questionText}</div>
                        <div style={{ fontSize: "12px", color: "#e2e8f0", paddingLeft: "12px", borderLeft: "2px solid var(--pink)", marginTop: "6px" }}>
                          <span style={{ fontWeight: "700", color: "var(--pink)", marginRight: "6px" }}>Answer:</span> {answerText}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
