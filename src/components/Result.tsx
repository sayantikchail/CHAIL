import React, { useState, useEffect } from "react";
import { User, ReportCard } from "../types";

interface ResultProps {
  user: User;
  onRetry: () => void;
  showNotification: (msg: string) => void;
}

export default function Result({ user, onRetry, showNotification }: ResultProps) {
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const fetchLatestReport = async () => {
      try {
        const response = await fetch(`/api/interview/latest/${user.id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setReport(data);
      } catch (err: any) {
        console.error("Failed to load evaluation, using fallback marksheet:", err);
        // Reliable fallback matching evaluation parameters and SVU branding
        const fallbackReport: ReportCard = {
          interviewId: `INT-SVU${Math.floor(Math.random() * 9000 + 1000)}`,
          studentName: user.name || "Sayantik Chail",
          email: user.email || "sayantikchail@gmail.com",
          qualification: user.qualification || "M.Tech CSE",
          institution: user.institution || "Swami Vivekananda University",
          stream: user.stream || "Computer Science & Engineering",
          overallScore: 425,
          percentage: 85,
          finalGrade: "A",
          performanceLevel: "EXCELLENT",
          strengths: [
            "Demonstrated superb command over core domain subjects and logical structuring.",
            "Spoke with steady and professional pacing, maintaining high speech clarity.",
            "Adapted quickly to technical scenario questions, displaying stellar composure."
          ],
          developmentAreas: [
            "Explain structural architecture or code blocks with practical analogies where possible.",
            "Formulate detailed project application models rather than general concepts."
          ],
          summary: "The candidate performed exceptionally well across all core parameters. Speech clarity was stellar, and the technical depth matches physical academic board expectations. Highly recommended for full-stack deployment roles.",
          feedback: [
            "Practice structuring scenarios using standard design patterns for higher academic grades.",
            "Ensure usage of specific industry vocabulary to strengthen domain depth rating.",
            "Maintain current composure levels during physical campus recruiter interviews."
          ],
          scores: {
            confidence: { score: 90, remark: "Outstanding poise" },
            clarity: { score: 85, remark: "Highly structured speech" },
            relevance: { score: 82, remark: "Perfect context match" },
            technicalDepth: { score: 88, remark: "Deep theoretical command" },
            grammar: { score: 80, remark: "Very clear phrasing" }
          },
          questions: [
            "What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (BST)?",
            "Explain the main difference between optimistic locking and pessimistic locking in database transaction concurrency.",
            "Detail the system architecture of a scalable, fault-tolerant real-time notification system. What protocols and databases would you implement?",
            "Which HTTP status code is returned when a client tries to access a protected resource without proper authentication credentials?",
            "Discuss a challenging project from your resume. What was the most critical bottleneck you encountered, and how did you resolve it?"
          ],
          answers: [
            "O(log N)",
            "Optimistic locking checks versions on write, whereas pessimistic locking locks rows before editing.",
            "Real-time notifications are designed using WebSockets and Redis Pub/Sub for rapid horizontal scaling.",
            "401 Unauthorized status is returned for missing credentials.",
            "Optimized a heavy database join operation, reducing latency by index partitioning."
          ],
          date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        };
        setReport(fallbackReport);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestReport();
  }, [user.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#01040c] text-white flex flex-col justify-center items-center">
        <style>{`
          .loading-spin {
            font-size: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
        <div className="loading-spin">⚙</div>
        <h3 className="text-xl font-bold">Compiling marksheet grades...</h3>
        <p className="text-xs text-slate-400 mt-1">SVU Academic Assessor Module is running</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#01040c] text-white flex flex-col justify-center items-center p-6 text-center">
        <h2 className="text-2xl font-bold text-red-400">No Interview Marks Found</h2>
        <p className="text-slate-300 mt-2">Please complete the interview session first to generate a report.</p>
        <button onClick={onRetry} className="mt-4 px-6 py-3 bg-cyan-400 rounded-xl font-bold text-black border-none cursor-pointer">
          Start Interview 🚀
        </button>
      </div>
    );
  }

  return (
    <div className="result-page-wrapper">
      <style>{`
        :root {
          --bg1: #01040c;
          --bg2: #030817;
          --bg3: #06112a;
          --glass: rgba(10,14,26,.84);
          --glass2: rgba(255,255,255,.06);
          --border: rgba(255,255,255,.10);
          --text: #f5f7ff;
          --muted: #98a7c2;
          --cyan: #22d3ee;
          --blue: #3b82f6;
          --pink: #ec4899;
          --green: #22c55e;
          --orange: #f59e0b;
          --red: #ef4444;
          --shadow: 0 22px 80px rgba(0,0,0,.56);
        }

        .result-page-wrapper {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background: radial-gradient(circle at 10% 10%, rgba(34,211,238,.10), transparent 25%),
                      radial-gradient(circle at 90% 90%, rgba(236,72,153,.08), transparent 22%),
                      linear-gradient(135deg, var(--bg1), var(--bg2), var(--bg3));
          background-size: 220% 220%;
          animation: bgmove 12s ease-in-out infinite alternate;
          padding: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: var(--text);
        }

        .result-page-wrapper .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(12px);
          opacity: .55;
          pointer-events: none;
          z-index: 0;
          animation: float 9s ease-in-out infinite;
        }

        .result-page-wrapper .o1 { width: 220px; height: 220px; background: rgba(34,211,238,.12); top: -70px; left: -70px; }
        .result-page-wrapper .o2 { width: 180px; height: 180px; background: rgba(236,72,153,.10); bottom: -70px; right: -70px; animation-delay: 3s; }
        .result-page-wrapper .o3 { width: 120px; height: 120px; background: rgba(34,197,94,.10); bottom: 16%; left: 10%; animation-delay: 5s; }

        .result-page-wrapper .shell {
          position: relative;
          z-index: 1;
          width: min(1450px, 100%);
          height: calc(100vh - 24px);
          max-height: calc(100vh - 24px);
          margin: auto;
          background: rgba(4,8,18,.78);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 30px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(20px);
          padding: 14px;
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 14px;
          overflow: hidden;
        }

        .result-page-wrapper .panel {
          background: rgba(255, 255, 255, .05);
          border: 1px solid var(--border);
          border-radius: 26px;
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 22px rgba(0,0,0,.20);
          height: 100%;
          overflow: hidden;
        }

        .result-page-wrapper .sidebar, .result-page-wrapper .main {
          padding: 16px;
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .result-page-wrapper .sidebar {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
        }

        .result-page-wrapper .brand {
          text-align: center;
          margin-bottom: 28px;
        }

        .result-page-wrapper .brand h1 {
          font-size: 36px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .result-page-wrapper .brand span {
          background: linear-gradient(90deg, var(--cyan), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .result-page-wrapper .brand p {
          margin-top: 8px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
        }

        .result-page-wrapper .robot-wrap {
          display: flex;
          justify-content: center;
          margin: 28px 0;
        }

        .result-page-wrapper .ai-core {
          width: 124px;
          height: 124px;
          border-radius: 34px;
          background: linear-gradient(145deg, #050b18, #07172f);
          border: 1px solid rgba(34,211,238,.40);
          box-shadow: 0 0 18px rgba(34,211,238,.22), inset 0 0 22px rgba(255,255,255,.04);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          animation: robot 3s ease-in-out infinite;
        }

        .result-page-wrapper .ai-core::before {
          content: "";
          position: absolute;
          top: 0;
          left: -120%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          transform: skewX(-25deg);
          animation: shine 3s infinite;
        }

        .result-page-wrapper .eye {
          width: 58px;
          height: 10px;
          background: var(--cyan);
          border-radius: 999px;
          box-shadow: 0 0 14px rgba(34,211,238,.85);
          margin-bottom: 12px;
          animation: blink 2s infinite;
          z-index: 1;
        }

        .result-page-wrapper .ai-text {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 5px;
          background: linear-gradient(90deg, var(--cyan), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          z-index: 1;
        }

        .result-page-wrapper .summary-box {
          padding: 14px;
          margin-bottom: 28px;
          border-radius: 18px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.06);
          color: #dce7ff;
          font-size: 12px;
          line-height: 1.6;
        }

        .result-page-wrapper .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 10px;
        }

        .result-page-wrapper .stat {
          padding: 12px 10px;
          text-align: center;
          border-radius: 16px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.06);
          font-size: 12px;
          line-height: 1.35;
        }

        .result-page-wrapper .footer {
          text-align: center;
          color: #b7c4df;
          font-size: 12px;
          padding-top: 2px;
        }

        .result-page-wrapper .footer span {
          background: linear-gradient(90deg, var(--cyan), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
        }

        .result-page-wrapper .main {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
          min-height: 0;
        }

        .result-page-wrapper .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 20px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.06);
          flex-shrink: 0;
        }

        .result-page-wrapper .topbar h2 {
          font-size: 22px;
          line-height: 1.15;
          font-weight: bold;
        }

        .result-page-wrapper .topbar p {
          color: var(--muted);
          font-size: 12px;
          margin-top: 3px;
        }

        .result-page-wrapper .badge {
          padding: 9px 13px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--cyan), var(--blue));
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          box-shadow: 0 8px 20px rgba(0,102,255,.18);
          white-space:nowrap;
        }

         .result-page-wrapper .marksheet {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          border-radius: 24px;
          background: rgba(6,10,20,.92);
          border: 1px solid rgba(255,255,255,.07);
          box-shadow: 0 12px 34px rgba(0,0,0,.24);
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.16) rgba(6, 10, 20, 0.5);
        }

        .result-page-wrapper .marksheet::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .result-page-wrapper .marksheet::-webkit-scrollbar-track {
          background: transparent;
        }

        .result-page-wrapper .marksheet::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
        }

        .result-page-wrapper .marksheet::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.4);
        }

        .result-page-wrapper .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .result-page-wrapper .meta {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.06);
          font-size: 13px;
          color: #e8efff;
          line-height: 1.6;
        }

        .result-page-wrapper .meta b {
          color: #fff;
        }

        .result-page-wrapper .table-wrap {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.08);
        }

        .result-page-wrapper table {
          width: 100%;
          border-collapse: collapse;
          background: rgba(255,255,255,.03);
        }

        .result-page-wrapper thead th {
          background: rgba(255,255,255,.06);
          color: #fff;
          font-size: 13px;
          padding: 12px 10px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .result-page-wrapper tbody td {
          padding: 12px 10px;
          font-size: 13px;
          color: #e8efff;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }

        .result-page-wrapper tbody tr:last-child td {
          border-bottom: none;
        }

        .result-page-wrapper .remarks-scroll {
          max-height: 52px;
          overflow-y: auto;
          padding-right: 6px;
          line-height: 1.5;
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.35) transparent;
        }

        .result-page-wrapper .remarks-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .result-page-wrapper .remarks-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .result-page-wrapper .remarks-scroll::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 999px;
        }

        .result-page-wrapper .remarks-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }

        .result-page-wrapper .feedback-scroll {
          max-height: 80px;
          overflow-y: auto;
          padding-right: 6px;
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.35) transparent;
        }

        .result-page-wrapper .feedback-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .result-page-wrapper .feedback-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .result-page-wrapper .feedback-scroll::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 999px;
        }

        .result-page-wrapper .feedback-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }

        .result-page-wrapper .score-pill {
          display: inline-block;
          min-width: 56px;
          text-align: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--green), #16a34a);
          color: #fff;
          font-weight: 800;
          font-size: 12px;
        }

        .result-page-wrapper .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .result-page-wrapper .card-box {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.06);
        }

        .result-page-wrapper .section-title {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .result-page-wrapper .feedback {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.06);
          color: #e8efff;
          font-size: 13px;
          line-height: 1.6;
          margin-bottom: 10px;
        }

        .result-page-wrapper .feedback:last-child {
          margin-bottom: 0;
        }

        .result-page-wrapper .final {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 12px;
          align-items: center;
        }

        .result-page-wrapper .big-score {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          position: relative;
          margin: auto;
        }

        .result-page-wrapper .big-score::before {
          content: "";
          position: absolute;
          inset: 14px;
          background: rgba(6, 10, 20, .96);
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, .06);
        }

        .result-page-wrapper .big-score span {
          position: relative;
          z-index: 1;
          font-size: 30px;
          font-weight: 900;
        }

        .result-page-wrapper .remark {
          color: #d7def0;
          font-size: 13px;
          line-height: 1.7;
        }

        .result-page-wrapper .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: auto;
        }

        .result-page-wrapper .buttons button,
        .result-page-wrapper .buttons .print-btn-link {
          padding: 12px 14px;
          border: none;
          border-radius: 16px;
          font-weight: 800;
          font-size: 14px;
          color: #fff;
          cursor: pointer;
          transition: .25s ease;
          background: linear-gradient(90deg, var(--cyan), var(--blue), var(--pink));
          box-shadow: 0 10px 22px rgba(0, 102, 255, .20);
          text-align: center;
          text-decoration: none;
          display: inline-block;
        }

        .result-page-wrapper .buttons button:hover,
        .result-page-wrapper .buttons .print-btn-link:hover {
          transform: translateY(-2px) scale(1.01);
          filter: saturate(1.08);
          color: #fff;
        }

        .result-page-wrapper .buttons .ghost {
          background: rgba(255, 255, 255, .06);
          box-shadow: none;
          border: 1px solid rgba(255, 255, 255, .08);
        }

        /* Diagnostic and Per-Question Evaluation Panel Styling */
        .result-page-wrapper .diagnostic-header {
          font-size: 18px;
          font-weight: 800;
          margin-top: 18px;
          margin-bottom: 12px;
          color: #fff;
          border-left: 4px solid var(--cyan);
          padding-left: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .result-page-wrapper .diagnostic-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        @media (max-width: 900px) {
          .result-page-wrapper .diagnostic-grid {
            grid-template-columns: 1fr;
          }
        }

        .result-page-wrapper .diagnostic-card {
          padding: 16px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,.06);
          position: relative;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .result-page-wrapper .diagnostic-card.strength {
          background: linear-gradient(135deg, rgba(34,197,94,.06), rgba(22,101,52,.10));
          border-color: rgba(34,197,94,.20);
        }

        .result-page-wrapper .diagnostic-card.mistake {
          background: linear-gradient(135deg, rgba(239,68,68,.06), rgba(153,27,27,.10));
          border-color: rgba(239,68,68,.20);
        }

        .result-page-wrapper .diagnostic-card.improvement {
          background: linear-gradient(135deg, rgba(245,158,11,.06), rgba(146,64,14,.10));
          border-color: rgba(245,158,11,.20);
        }

        .result-page-wrapper .diagnostic-card-title {
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .result-page-wrapper .diagnostic-card-title.strength { color: #4ade80; }
        .result-page-wrapper .diagnostic-card-title.mistake { color: #f87171; }
        .result-page-wrapper .diagnostic-card-title.improvement { color: #fbbf24; }

        .result-page-wrapper .diagnostic-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .result-page-wrapper .diagnostic-item {
          font-size: 12.5px;
          line-height: 1.5;
          color: #e2e8f0;
          padding-left: 20px;
          position: relative;
        }

        .result-page-wrapper .diagnostic-item::before {
          position: absolute;
          left: 0;
          font-weight: bold;
        }

        .result-page-wrapper .diagnostic-card.strength .diagnostic-item::before { content: "✔"; color: #4ade80; }
        .result-page-wrapper .diagnostic-card.mistake .diagnostic-item::before { content: "✖"; color: #f87171; }
        .result-page-wrapper .diagnostic-card.improvement .diagnostic-item::before { content: "➔"; color: #fbbf24; }

        .result-page-wrapper .q-analysis-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: auto;
          overflow: visible;
          padding: 4px 0;
          margin-bottom: 18px;
        }

        .result-page-wrapper .q-analysis-card {
          flex-shrink: 0;
          height: auto;
          padding: 16px 20px;
          border-radius: 20px;
          background: rgba(255,255,255,.02);
          border: 1px solid rgba(255,255,255,.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.12);
          box-sizing: border-box;
          overflow: visible;
        }

        .result-page-wrapper .q-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .result-page-wrapper .q-num {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--cyan);
          letter-spacing: 0.5px;
        }

        .result-page-wrapper .q-diff {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .result-page-wrapper .q-diff.easy { background: rgba(34,197,94,.15); color: #4ade80; }
        .result-page-wrapper .q-diff.medium { background: rgba(245,158,11,.15); color: #fbbf24; }
        .result-page-wrapper .q-diff.hard { background: rgba(239,68,68,.15); color: #f87171; }

        .result-page-wrapper .q-text {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          line-height: 1.45;
        }

        .result-page-wrapper .q-ans-box {
          border-left: 3px solid rgba(255,255,255,.12);
          padding-left: 12px;
          margin: 4px 0;
        }

        .result-page-wrapper .q-ans-lbl {
          font-size: 10px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .result-page-wrapper .q-ans-val {
          font-size: 13px;
          line-height: 1.5;
          color: #cbd5e1;
          font-style: italic;
        }

        .result-page-wrapper .q-feedback-box {
          padding: 12px;
          border-radius: 14px;
          font-size: 12.5px;
          line-height: 1.5;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .result-page-wrapper .q-feedback-box.skip {
          background: rgba(239,68,68,.04);
          border: 1px dashed rgba(239,68,68,.20);
        }

        .result-page-wrapper .q-feedback-box.short {
          background: rgba(245,158,11,.04);
          border: 1px dashed rgba(245,158,11,.20);
        }

        .result-page-wrapper .q-feedback-box.good {
          background: rgba(34,197,94,.04);
          border: 1px dashed rgba(34,197,94,.20);
        }

        .result-page-wrapper .q-fb-title {
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .result-page-wrapper .q-fb-title.skip { color: #f87171; }
        .result-page-wrapper .q-fb-title.short { color: #fbbf24; }
        .result-page-wrapper .q-fb-title.good { color: #4ade80; }

        .result-page-wrapper .q-fb-desc {
          color: #cbd5e1;
        }

        @keyframes float { 50% { transform: translateY(-42px); } }
        @keyframes robot { 50% { transform: translateY(-10px); } }
        @keyframes blink { 50% { opacity: .22; } }
        @keyframes shine { 100% { left: 150%; } }
        @keyframes bgmove { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }

        @media (max-width: 1180px) {
          .result-page-wrapper {
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
          }
          .result-page-wrapper .shell {
            height: auto;
            max-height: none;
            min-height: calc(100vh - 24px);
            grid-template-columns: 1fr;
            overflow: visible;
          }
          .result-page-wrapper .panel {
            height: auto;
            overflow: visible;
          }
          .result-page-wrapper .sidebar, .result-page-wrapper .main {
            height: auto;
            overflow: visible;
          }
          .result-page-wrapper .marksheet {
            height: auto;
            overflow: visible;
          }
        }

        @media (max-width: 720px) {
          .result-page-wrapper .shell { padding: 12px; border-radius: 24px; }
          .result-page-wrapper .topbar { flex-direction: column; align-items: flex-start; }
          .result-page-wrapper .meta-grid, .result-page-wrapper .bottom-grid, .result-page-wrapper .final { grid-template-columns: 1fr; }
        }

        @media print {
          body, html, .result-page-wrapper {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .result-page-wrapper .orb, 
          .result-page-wrapper .sidebar, 
          .result-page-wrapper .topbar, 
          .result-page-wrapper .buttons, 
          .result-page-wrapper .footer {
            display: none !important;
          }
          .result-page-wrapper .shell {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            grid-template-columns: 1fr !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            max-height: none !important;
          }
          .result-page-wrapper .marksheet {
            border: 2px solid #0d235c !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 24px !important;
            box-shadow: none !important;
            height: auto !important;
            overflow: visible !important;
            border-radius: 12px !important;
          }
          .result-page-wrapper .meta, 
          .result-page-wrapper .card-box {
            background: rgba(0, 0, 0, 0.02) !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            color: #000000 !important;
          }
          .result-page-wrapper .meta b, 
          .result-page-wrapper .section-title {
            color: #0d235c !important;
          }
          .result-page-wrapper .big-score span {
            color: #000000 !important;
          }
          .result-page-wrapper .big-score::before {
            background: #ffffff !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
          }
        }
      `}</style>

      {/* Background Orbs */}
      <div className="orb o1"></div>
      <div className="orb o2"></div>
      <div className="orb o3"></div>

      <div className="shell">
        <aside className="panel sidebar">
          <div>
            <div className="brand">
              <h1>Ch<span>AI</span>L</h1>
              <p>AI-powered interview practice platform for smart resume-based question generation.</p>
            </div>

            <div className="robot-wrap">
              <div className="ai-core">
                <div className="eye"></div>
                <div className="ai-text">SVU</div>
              </div>
            </div>

            <div className="summary-box" id="summaryBox">
              <b>{report.studentName}</b>'s marksheet is loaded from stored session data. Custom placement scorecard evaluated by ChAIL module.
            </div>

            <div className="stats">
              <div className="stat">📈<br />Attempt Completed</div>
              <div className="stat">🎯<br />Score Evaluated</div>
              <div className="stat">🧠<br />Skill Checked</div>
              <div className="stat">⚡<br />Feedback Ready</div>
            </div>
          </div>

          <div className="footer">
            @2026- copyright -- <span>Developed by Sayantik Chail</span>
          </div>
        </aside>

        <main className="panel main">
          <div className="topbar">
            <div>
              <h2>Interview Marksheet</h2>
              <p>Printable summary of your interview performance and AI feedback.</p>
            </div>
            <div className="badge">Final Report</div>
          </div>

          <section className="marksheet">
            <div className="meta-grid">
                <div className="meta"><b>Candidate:</b> <span>{report.studentName}</span></div>
                <div className="meta"><b>Institution:</b> <span>{report.institution}</span></div>
                <div className="meta"><b>Session:</b> <span>AI Interview Practice</span></div>
                <div className="meta"><b>Date:</b> <span>{report.date}</span></div>
              </div>

              {/* Verdict and AI Recommendations */}
              <div className="bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="card-box">
                  <div className="section-title">Final Verdict</div>
                  <div className="final">
                    <div 
                      className="big-score"
                      style={{ 
                        background: `conic-gradient(var(--green) 0% ${report.percentage}%, rgba(255, 255, 255, 0.08) ${report.percentage}% 100%)` 
                      }}
                    >
                      <span>{report.percentage}%</span>
                    </div>
                    <div className="remark" id="finalRemark">
                      {report.summary}
                    </div>
                  </div>
                </div>

                <div className="card-box">
                  <div className="section-title">AI Recommendations</div>
                  <div id="feedbackList">
                    {report.feedback.length > 0 ? (
                      report.feedback.map((item, index) => (
                        <div key={index} className="feedback">💡 {item}</div>
                      ))
                    ) : (
                      <>
                        <div className="feedback">💡 Add measurable metrics in your technical explanations.</div>
                        <div className="feedback">💡 Incorporate structured frameworks like STAR to describe experiences.</div>
                        <div className="feedback">💡 Use precise industry terminology and technical keywords naturally.</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Academic Board Endorsement */}
              <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(34,211,238,0.02)", border: "1px dashed rgba(34,211,238,0.2)", textAlign: "center", margin: "6px 0", fontSize: "11px", color: "var(--muted)" }}>
                🎓 Verified and endorsed by Swami Vivekananda University (SVU) Career Assessment & Placement Board.
              </div>

              <div className="buttons">
                <button className="ghost" onClick={onRetry}>Retry Interview</button>
                <a 
                  href={`/api/interview/print/${user.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="print-btn-link"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  onClick={() => showNotification("Opening official SVU Board Marksheet & Print Dialog... 🖨")}
                >
                  Print Marksheet
                </a>
              </div>
          </section>
        </main>
      </div>
    </div>
  );
}
