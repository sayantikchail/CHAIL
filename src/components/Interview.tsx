import React, { useState, useEffect, useRef } from "react";
import { User, Question, AnswerItem } from "../types";

interface InterviewProps {
  user: User;
  onLogout: () => void;
  onInterviewComplete: () => void;
  showNotification: (msg: string) => void;
  preGeneratedQuestions?: Question[];
}

export default function Interview({ user, onLogout: _onLogout, onInterviewComplete, showNotification, preGeneratedQuestions }: InterviewProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Countdown timer states (35 minutes = 2100s overall)
  const [timeLeft, setTimeLeft] = useState(2100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to access the latest state inside the non-resetting interval
  const currentAnswerRef = useRef(currentAnswer);
  const currentIndexRef = useRef(currentIndex);
  const answersRef = useRef(answers);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Evaluation states
  const [showEvaluationOverlay, setShowEvaluationOverlay] = useState(false);
  const [evaluationText, setEvaluationText] = useState("Evaluating answers...");

  // Load tailored questions on load
  useEffect(() => {
    if (preGeneratedQuestions && preGeneratedQuestions.length > 0) {
      setQuestions(preGeneratedQuestions);
      setAnswers(new Array(preGeneratedQuestions.length).fill(""));
      setLoadingQuestions(false);
    } else {
      const fetchQuestions = async () => {
        try {
          const selectedLanguage = localStorage.getItem("chail_selected_language") || "English";
          const response = await fetch("/api/interview/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              userId: user.id, 
              language: selectedLanguage 
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);

          setQuestions(data.questions);
          setAnswers(new Array(data.questions.length).fill(""));
        } catch (err: any) {
          console.error("Failed to load backend questions, using default profile set:", err);
          const defaultQuestions = [
            { q: "Tell me about yourself.", s: "Give a short introduction focused on your background, skills, and what makes you a good fit.", d: "Easy" },
            { q: "What are the key skills mentioned in your resume?", s: "Mention only the strongest and most relevant skills with confidence.", d: "Medium" },
            { q: "Explain one project from your resume in detail.", s: "Describe problem, approach, tools used, and outcome in a clear way.", d: "Medium" },
            { q: "Why should we select you for this role?", s: "Focus on value, learning ability, and alignment with the role.", d: "Hard" },
            { q: "Where do you see yourself in the next 3 years?", s: "Show ambition, stability, and career direction.", d: "Medium" }
          ];
          setQuestions(defaultQuestions);
          setAnswers(new Array(defaultQuestions.length).fill(""));
        } finally {
          setLoadingQuestions(false);
        }
      };

      fetchQuestions();
    }
  }, [user.id, preGeneratedQuestions]);

  // Handle continuous 35-minute countdown timer (2100s)
  useEffect(() => {
    if (loadingQuestions || questions.length === 0 || showEvaluationOverlay) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          showNotification("Exam time limit of 35 minutes reached! Submitting your answers automatically... 🕒");
          
          const finalAnswers = [...answersRef.current];
          finalAnswers[currentIndexRef.current] = currentAnswerRef.current;
          setAnswers(finalAnswers);

          triggerFinalEvaluation(finalAnswers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadingQuestions, questions.length, showEvaluationOverlay]);

  // Sync current typed text when active question changes
  useEffect(() => {
    if (questions.length > 0) {
      setCurrentAnswer(answers[currentIndex] || "");
    }
  }, [currentIndex, questions]);

  const formatTimer = (seconds: number) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `Time left: ${m}:${s}`;
  };

  const handleSaveAnswer = () => {
    const trimmed = currentAnswer.trim();
    if (!trimmed) {
      showNotification("Please write your answer in the box before submitting.");
      return false;
    }

    const updated = [...answers];
    updated[currentIndex] = trimmed;
    setAnswers(updated);
    showNotification("Answer submitted successfully! 🎉");
    return true;
  };

  const handlePrev = () => {
    const updated = [...answers];
    updated[currentIndex] = currentAnswer;
    setAnswers(updated);

    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    const updated = [...answers];
    updated[currentIndex] = currentAnswer;
    setAnswers(updated);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      triggerFinalEvaluation(updated);
    }
  };

  const triggerFinalEvaluation = async (finalAnswers: string[]) => {
    setShowEvaluationOverlay(true);

    const stages = [
      "Checking answer quality...",
      "Comparing with expected skills...",
      "Calculating performance metrics...",
      "Preparing SVU evaluation scorecard..."
    ];

    let stageIdx = 0;
    setEvaluationText(stages[0]);
    const textInterval = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        setEvaluationText(stages[stageIdx]);
      }
    }, 1100);

    const payload: AnswerItem[] = questions.map((q, idx) => ({
      question: q.q,
      answer: finalAnswers[idx] || ""
    }));

    try {
      const response = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          questionsAndAnswers: payload
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      clearInterval(textInterval);
      setEvaluationText("Report Card Generated! Loading Marksheet...");
      
      setTimeout(() => {
        onInterviewComplete();
      }, 1000);
    } catch (err: any) {
      clearInterval(textInterval);
      showNotification("Evaluation saved. Fallback report generated.");
      onInterviewComplete();
    }
  };

  const activeQuestion = questions[currentIndex];

  return (
    <div className="interview-page-wrapper">
      <style>{`
        :root{
          --bg1:#01040c;
          --bg2:#030817;
          --bg3:#06112a;
          --glass:rgba(10,14,26,.84);
          --glass2:rgba(255,255,255,.06);
          --border:rgba(255,255,255,.10);
          --text:#f5f7ff;
          --muted:#98a7c2;
          --cyan:#22d3ee;
          --blue:#3b82f6;
          --pink:#ec4899;
          --green:#22c55e;
          --orange:#f59e0b;
          --shadow:0 22px 80px rgba(0,0,0,.56);
        }

         .interview-page-wrapper {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          background:
            radial-gradient(circle at 10% 10%, rgba(34,211,238,.10), transparent 25%),
            radial-gradient(circle at 90% 90%, rgba(236,72,153,.08), transparent 22%),
            linear-gradient(135deg,var(--bg1),var(--bg2),var(--bg3));
          background-size: 220% 220%;
          animation: bgmove 12s ease-in-out infinite alternate;
          padding: 12px;
          position: relative;
        }

        .orb{
          position:fixed;
          border-radius:50%;
          filter:blur(12px);
          opacity:.55;
          pointer-events:none;
          z-index:0;
          animation:float 9s ease-in-out infinite;
        }

        .o1{width:220px;height:220px;background:rgba(34,211,238,.12);top:-70px;left:-70px;}
        .o2{width:180px;height:180px;background:rgba(236,72,153,.10);bottom:-70px;right:-70px;animation-delay:3s;}
        .o3{width:120px;height:120px;background:rgba(34,197,94,.10);bottom:16%;left:10%;animation-delay:5s;}

        .shell{
          position:relative;
          z-index:1;
          width:min(1450px,100%);
          height:calc(100vh - 24px);
          max-height:calc(100vh - 24px);
          margin:auto;
          background:rgba(4,8,18,.78);
          border:1px solid rgba(255,255,255,.08);
          border-radius:30px;
          box-shadow:var(--shadow);
          backdrop-filter:blur(20px);
          padding:14px;
          display:grid;
          grid-template-columns:300px 1fr;
          gap:14px;
          overflow:hidden;
        }

        .panel{
          background:rgba(255,255,255,.05);
          border:1px solid var(--border);
          border-radius:26px;
          backdrop-filter:blur(14px);
          box-shadow:0 8px 22px rgba(0,0,0,.20);
          height:100%;
          overflow:hidden;
        }

        .sidebar,.main{
          padding:16px;
          min-height:0;
          height:100%;
          overflow-y:auto;
          scrollbar-width:thin;
        }

        .sidebar{
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          gap:20px;
        }

        .brand{
          text-align:center;
        }

        .brand h1{
          font-size:36px;
          line-height:1;
          font-weight:900;
          letter-spacing:1px;
        }

        .brand span{
          background:linear-gradient(90deg,var(--cyan),var(--pink));
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
        }

        .brand p{
          margin-top:8px;
          margin-bottom:30px;
          color:var(--muted);
          font-size:12px;
          line-height:1.55;
        }

        .robot-wrap{
          display:flex;
          justify-content:center;
          margin-top:35px;
        }

        .ai-core{
          width:124px;
          height:124px;
          border-radius:34px;
          background:linear-gradient(145deg,#050b18,#07172f);
          border:1px solid rgba(34,211,238,.40);
          box-shadow:0 0 18px rgba(34,211,238,.22), inset 0 0 22px rgba(255,255,255,.04);
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          position:relative;
          overflow:hidden;
          animation:robot 3s ease-in-out infinite;
        }

        .ai-core::before{
          content:"";
          position:absolute;
          top:0;
          left:-120%;
          width:60%;
          height:100%;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          transform:skewX(-25deg);
          animation:shine 3s infinite;
        }

        .eye{
          width:58px;
          height:10px;
          background:var(--cyan);
          border-radius:999px;
          box-shadow:0 0 14px rgba(34,211,238,.85);
          margin-bottom:12px;
          animation:blink 2s infinite;
          z-index:1;
        }

        .ai-text{
          font-size:30px;
          font-weight:900;
          letter-spacing:5px;
          background:linear-gradient(90deg,var(--cyan),var(--pink));
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          z-index:1;
        }

        .mini-stats{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:14px;
          margin-top:25px;
          margin-bottom:25px;
        }

        .mini-card{
          padding:12px 10px;
          text-align:center;
          border-radius:16px;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.06);
          color:#eef4ff;
          transition:.25s ease;
          line-height:1.35;
          font-size:12px;
        }

        .mini-card:hover{
          transform:translateY(-2px);
          box-shadow:0 0 16px rgba(34,211,238,.14);
        }

        .footer{
          text-align:center;
          color:#b7c4df;
          font-size:12px;
          letter-spacing:.2px;
          margin-top:25px;
          padding-top:0;
        }

        .footer span{
          background:linear-gradient(90deg,var(--cyan),var(--pink));
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          font-weight:800;
        }

        .main{
          display:flex;
          flex-direction:column;
          gap:12px;
          overflow:hidden;
          min-height:0;
        }

        .topbar{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          padding:14px 16px;
          border-radius:20px;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.06);
          flex-shrink:0;
        }

        .topbar h2{
          font-size:22px;
          line-height:1.15;
          font-weight: bold;
        }

        .topbar p{
          color:var(--muted);
          font-size:12px;
          margin-top:3px;
        }

        .badge{
          padding:9px 13px;
          border-radius:999px;
          background:linear-gradient(90deg,var(--cyan),var(--blue));
          color:#fff;
          font-weight:700;
          font-size:12px;
          box-shadow:0 8px 20px rgba(0,102,255,.18);
          white-space:nowrap;
        }

        .question-card{
          padding:18px;
          border-radius:24px;
          background:rgba(6,10,20,.92);
          border:1px solid rgba(255,255,255,.07);
          box-shadow:0 12px 34px rgba(0,0,0,.24);
          display:flex;
          flex-direction:column;
          gap:12px;
          flex:1;
          min-height:0;
        }

        .q-head{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }

        .q-no{
          padding:7px 12px;
          border-radius:999px;
          background:rgba(255,255,255,.06);
          font-size:12px;
          color:#eaf0ff;
        }

        .timer{
          color:#ffcc66;
          font-weight:800;
          font-size:13px;
        }

        .question{
          font-size:24px;
          font-weight:800;
          line-height:1.35;
          margin-top:2px;
        }

        .question small{
          display:block;
          color:var(--muted);
          font-size:13px;
          font-weight:500;
          margin-top:6px;
          line-height:1.55;
        }

        textarea{
          width:100%;
          flex:1;
          min-height:140px;
          resize:none;
          padding:14px 15px;
          border-radius:20px;
          border:1px solid rgba(255,255,255,.10);
          background:rgba(255,255,255,.05);
          color:#fff;
          outline:none;
          font-size:14px;
          line-height:1.6;
          transition:.25s ease;
        }

        textarea::placeholder{
          color:#d9e4ff;
          opacity:.72;
        }

        textarea:focus{
          border-color:var(--cyan);
          box-shadow:0 0 0 4px rgba(34,211,238,.08), 0 0 16px rgba(34,211,238,.16);
          background:rgba(255,255,255,.07);
        }

        .actions{
          display:grid;
          grid-template-columns:1fr 1fr 1fr;
          gap:10px;
          flex-shrink:0;
        }

        .actions button{
          padding:12px 14px;
          border:none;
          border-radius:16px;
          font-weight:800;
          font-size:14px;
          color:#fff;
          cursor:pointer;
          transition:.25s ease;
          background:linear-gradient(90deg,var(--cyan),var(--blue),var(--pink));
          box-shadow:0 10px 22px rgba(0,102,255,.20);
        }

        .actions button:hover{
          transform:translateY(-2px) scale(1.01);
          filter:saturate(1.08);
        }

        .actions .ghost{
          background:rgba(255,255,255,.06);
          box-shadow:none;
          border:1px solid rgba(255,255,255,.08);
        }

        .actions .secondary{
          background:linear-gradient(90deg,#16a34a,#22c55e);
        }

        .actions button:disabled{
          opacity:.45;
          cursor:not-allowed;
          transform:none !important;
          box-shadow:none !important;
        }

        .overlay{
          position:fixed;
          inset:0;
          z-index:100000;
          background:rgba(0,0,0,.96);
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          gap:12px;
          text-align:center;
          padding:24px;
          color:#fff;
        }

        .overlay .emoji{font-size:76px;}

        @keyframes float{50%{transform:translateY(-42px);}}
        @keyframes robot{50%{transform:translateY(-10px);}}
        @keyframes blink{50%{opacity:.22;}}
        @keyframes shine{100%{left:150%;}}
        @keyframes bgmove{from{background-position:0% 50%;}to{background-position:100% 50%;}}

        @media (max-width: 1180px){
          .interview-page-wrapper {
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
          }
          .shell{
            height:auto;
            max-height:none;
            min-height:calc(100vh - 24px);
            grid-template-columns:1fr;
            overflow: visible;
          }
          .panel {
            height: auto;
            overflow: visible;
          }
          .sidebar, .main {
            height: auto;
            overflow: visible;
          }
        }

        @media (max-width: 720px){
          .shell{padding:12px;border-radius:24px;}
          .topbar{flex-direction:column;align-items:flex-start;}
          .actions{grid-template-columns:1fr;}
          .mini-stats{grid-template-columns:1fr 1fr;}
          .question{font-size:21px;}
        }

        @media (max-width: 480px){
          .mini-stats{grid-template-columns:1fr;}
          .brand h1{font-size:32px;}
          .ai-core{width:116px;height:116px;}
          .ai-text{font-size:28px;}
        }

        @keyframes soundWavePremium {
          0% {
            transform: scaleY(0.22);
            opacity: 0.45;
          }
          50% {
            transform: scaleY(1.15);
            opacity: 1;
          }
          100% {
            transform: scaleY(0.22);
            opacity: 0.45;
          }
        }

        @keyframes circularRipple1 {
          0% {
            transform: scale(0.9);
            opacity: 0.6;
            box-shadow: 0 0 10px rgba(34, 211, 238, 0.4);
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
            box-shadow: 0 0 25px rgba(34, 211, 238, 0.7), 0 0 12px rgba(236, 72, 153, 0.5);
          }
          100% {
            transform: scale(0.9);
            opacity: 0.6;
            box-shadow: 0 0 10px rgba(34, 211, 238, 0.4);
          }
        }

        @keyframes circularRipple2 {
          0% {
            transform: scale(0.9);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.7;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.4;
          }
        }

        @keyframes circularRipple3 {
          0% {
            transform: scale(0.9);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.5;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.2;
          }
        }

        @keyframes premiumSuccessPulse {
          0% {
            transform: scale(0.98);
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.4);
          }
          70% {
            transform: scale(1.01);
            box-shadow: 0 0 0 15px rgba(34, 211, 238, 0);
          }
          100% {
            transform: scale(0.98);
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0);
          }
        }
      `}</style>

      {/* Background Orbs */}
      <div className="orb o1"></div>
      <div className="orb o2"></div>
      <div className="orb o3"></div>

      <div className="shell">
        {/* Sidebar */}
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

            <div className="mini-stats">
              <div className="mini-card">📄<br />Resume Parsed</div>
              <div className="mini-card">🧠<br />AI Ready</div>
              <div className="mini-card">🎯<br />Questions Set</div>
              <div className="mini-card">⚡<br />Live Practice</div>
            </div>
          </div>

          <div className="footer">
            @2026- copyright -- <span>Developed by Sayantik Chail</span>
          </div>
        </aside>

        {/* Main Panel Content */}
        <main className="panel main">
          <div className="topbar">
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: "bold", background: "linear-gradient(90deg,#fff,#cbd5e1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Interview Session</h2>
              {!loadingQuestions && activeQuestion?.round && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", background: "rgba(236, 72, 153, 0.15)", color: "var(--pink)", border: "1px solid rgba(236,72,153,0.3)", padding: "2px 10px", borderRadius: "999px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    🔄 {activeQuestion.round}
                  </span>
                </div>
              )}
            </div>
            <div className="badge" id="stageBadge" style={{ background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34,211,238,0.2)", color: "var(--cyan)", padding: "6px 14px" }}>
              {loadingQuestions ? "Preparing..." : `Question ${currentIndex + 1} of ${questions.length}`}
            </div>
          </div>

          {loadingQuestions ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", margin: "auto" }}>
              <p style={{ fontSize: "20px", fontWeight: "bold", animation: "pulse 1.5s infinite" }}>
                Preparing interview questions based on your resume and major subject stream ({user.stream})...
              </p>
            </div>
          ) : (
            <section className="question-card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
              <div className="q-head" style={{ flexShrink: 0 }}>
                <div className="q-no" id="difficulty">
                  Difficulty: {activeQuestion?.d || "Easy"}
                </div>
                <div className="timer" id="timer">
                  {formatTimer(timeLeft)}
                </div>
              </div>

              {/* Always visible scrollable body section */}
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: "4px", display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px", marginBottom: "10px" }}>
                <div className="question" id="questionText" style={{ flexShrink: 0 }}>
                  {activeQuestion?.q}
                  <small style={{ display: "block", marginTop: "8px" }}>💡 Hint: {activeQuestion?.s}</small>
                </div>

                {activeQuestion?.type === "mcq" && activeQuestion.options && activeQuestion.options.length > 0 ? (
                  <div className="mcq-options-container" style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "14px 0" }}>
                    {activeQuestion.options.map((opt, oIdx) => {
                      const isSelected = currentAnswer === opt || currentAnswer.startsWith(opt.substring(0, 2));
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          className={`mcq-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => setCurrentAnswer(opt)}
                          style={{
                            textAlign: "left",
                            padding: "16px 20px",
                            borderRadius: "18px",
                            background: isSelected ? "rgba(34, 211, 238, 0.12)" : "rgba(255, 255, 255, 0.03)",
                            border: isSelected ? "2px solid var(--cyan)" : "1px solid rgba(255, 255, 255, 0.08)",
                            color: isSelected ? "#fff" : "#cbd5e1",
                            fontWeight: isSelected ? "700" : "500",
                            cursor: "pointer",
                            transition: "all 0.25s ease",
                            boxShadow: isSelected ? "0 0 20px rgba(34, 211, 238, 0.2)" : "none",
                            fontSize: "14px",
                            lineHeight: "1.4"
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    id="answerBox"
                    style={{ flex: 1, minHeight: "140px" }}
                    placeholder={activeQuestion?.type === "short" ? "Type your short, crisp answer (max 2-3 sentences) here..." : "Type your detailed, structured answer here..."}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                  />
                )}
              </div>

              {/* Always pinned action buttons container */}
              <div className="actions" style={{ flexShrink: 0, marginTop: "auto" }}>
                <button
                  type="button"
                  className="ghost"
                  id="prevBtn"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                >
                  ← Previous
                </button>
                <button type="button" id="submitBtn" onClick={handleSaveAnswer}>
                  Submit Answer
                </button>
                <button type="button" className="secondary" id="nextBtn" onClick={handleNext}>
                  {currentIndex === questions.length - 1 ? "Submit Interview 🚀" : "Next →"}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* EVALUATION PROGRESS OVERLAY */}
      {showEvaluationOverlay && (
        <div className="overlay">
          <div className="emoji">📊</div>
          <h2>Evaluating Your Answers...</h2>
          <p id="loadingText" style={{ color: "var(--cyan)", fontWeight: "bold" }}>
            {evaluationText}
          </p>
        </div>
      )}
    </div>
  );
}
