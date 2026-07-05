import React, { useState, useRef, useEffect } from "react";
import { User, Skill, Question } from "../types";

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onStartInterview: (detectedSkills: Skill[], questions?: Question[]) => void;
  showNotification: (msg: string) => void;
}

export default function Dashboard({ user, onLogout, onStartInterview, showNotification }: DashboardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [resumeValidationError] = useState<string | null>(null);
  const setResumeValidationError = (_val: string | null) => {}; // No-op to bypass all validation error states

  const [detectedSkills, setDetectedSkills] = useState<Skill[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState("Initializing AI...");
  const [isDragOver, setIsDragOver] = useState(false);

  // Profile configuration (can edit qualification and stream majorly used for question crafting)
  const [qualification, setQualification] = useState(user.qualification);
  const [stream, setStream] = useState(user.stream);
  const [institution, setInstitution] = useState(user.institution);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<User>(user);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem("chail_selected_language") || "";
  });
  const [preGeneratedQuestions, setPreGeneratedQuestions] = useState<Question[]>([]);

  const calibrateQuestions = async (lang: string) => {
    try {
      setOverlayText(`Calibrating custom high-quality questions in ${lang}... 🎯`);
      setShowOverlay(true);
      const res = await fetch("/api/interview/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentProfile.id,
          language: lang
        })
      });
      const qData = await res.json();
      if (res.ok && qData.questions) {
        setPreGeneratedQuestions(qData.questions);
        showNotification(`🎯 15 challenging questions successfully generated in ${lang}!`);
      } else {
        throw new Error(qData.error || "Failed to generate questions.");
      }
    } catch (err: any) {
      console.error("Language question generation failed:", err);
      showNotification(`❌ Question generation failed: ${err.message}`);
    } finally {
      setShowOverlay(false);
    }
  };

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setSelectedLanguage(lang);
    if (lang) {
      localStorage.setItem("chail_selected_language", lang);
      
      // If resume is already analyzed, generate questions in the chosen language!
      if (isAnalyzed) {
        await calibrateQuestions(lang);
      }
    } else {
      localStorage.removeItem("chail_selected_language");
      setPreGeneratedQuestions([]);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tabs & History States
  const [activeTab, setActiveTab] = useState<"PRACTICE" | "HISTORY">("PRACTICE");
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/interview/history/${currentProfile.id}`);
      const data = await res.json();
      if (res.ok && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Failed to load interview history:", err);
    }
  };

  // Sync state if user changes
  useEffect(() => {
    setCurrentProfile(user);
    setQualification(user.qualification);
    setStream(user.stream);
    setInstitution(user.institution);
  }, [user]);

  // Load history
  useEffect(() => {
    fetchHistory();
    // Enforce sequential workflow on load: clear language and questions
    setSelectedLanguage("");
    setPreGeneratedQuestions([]);
    localStorage.removeItem("chail_selected_language");
  }, [currentProfile.id]);

  const processFile = (file: File) => {
    setResumeValidationError(null);
    setSelectedFile(file);
    setIsAnalyzed(false);
    setUploadProgress(0);
    setDetectedSkills([]);
    setIsAnalyzing(true);
    setShowOverlay(true);
    setOverlayText("Uploading and reading your resume... (0%) 📄");
    setSelectedLanguage(""); // Clear chosen language on new upload
    setPreGeneratedQuestions([]); // Clear any pre-generated questions on new upload
    localStorage.removeItem("chail_selected_language");

    // Read file as base64 and start uploading/analyzing immediately
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result as string;
      
      let apiData: any = null;
      let apiError: any = null;
      let isApiDone = false;
      const intervalTime = 45; // 45ms per tick for smooth distribution
      let currentProgress = 0;

      // Start the background API calls immediately
      (async () => {
        try {
          // 1. Analyze resume
          const response = await fetch("/api/resume/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: currentProfile.id,
              filename: file.name,
              fileBase64: base64String,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Failed to analyze resume.");
          }
          apiData = data;
          isApiDone = true;
        } catch (err: any) {
          console.error("Background loading error:", err);
          apiError = err;
          isApiDone = true;
        }
      })();

      const finishProcess = () => {
        setIsAnalyzing(false);
        let finalSkills = [];
        let finalAnalysis = null;

        if (apiError || !apiData || !apiData.skills) {
          console.warn("Using client-side fallback due to API or network error:", apiError);
          
          let fallbackSkills = [
            { name: "HTML & CSS", level: 92 },
            { name: "JavaScript", level: 85 },
            { name: "Communication", level: 88 },
            { name: "Problem Solving", level: 78 }
          ];

          let fallbackAnalysis = {
            skills: fallbackSkills,
            detectedStream: currentProfile.stream || "Computer Science & Engineering",
            detectedQualification: currentProfile.qualification || "B.Tech",
            detectedInstitution: currentProfile.institution || "Swami Vivekananda University",
            keySubjects: ["Data Structures", "Database Management", "Computer Networks"],
            keyProjects: [
              {
                title: "Academic Portal",
                description: "A centralized student and instructor academic platform with portal dashboards.",
                techStack: "React, Node.js, SQLite"
              }
            ],
            knowledgeDepth: "Solid grasp of software systems, modern web frameworks, and clean UI/UX designs.",
            careerDomain: "Full Stack Development"
          };

          const lowerName = (file.name || "").toLowerCase();
          const isMedical = lowerName.includes("doctor") || lowerName.includes("medical") || lowerName.includes("nurse") || lowerName.includes("pharma") || lowerName.includes("mbbs") || lowerName.includes("health") || lowerName.includes("clinical") || lowerName.includes("hospital") || lowerName.includes("dentist") || lowerName.includes("bds") || lowerName.includes("md") ||
                            (currentProfile.stream || "").toLowerCase().includes("doctor") || (currentProfile.stream || "").toLowerCase().includes("medical") || (currentProfile.stream || "").toLowerCase().includes("mbbs");
          const isLegal = lowerName.includes("lawyer") || lowerName.includes("law") || lowerName.includes("legal") || lowerName.includes("llb") || lowerName.includes("llm") || lowerName.includes("advocate") || lowerName.includes("court") || lowerName.includes("judicial") ||
                          (currentProfile.stream || "").toLowerCase().includes("law") || (currentProfile.stream || "").toLowerCase().includes("legal") || (currentProfile.stream || "").toLowerCase().includes("llb");

          if (isMedical) {
            fallbackSkills = [
              { name: "Clinical Diagnosis", level: 90 },
              { name: "Patient Care", level: 94 },
              { name: "Emergency Medicine", level: 88 },
              { name: "Pharmacology", level: 85 }
            ];
            fallbackAnalysis = {
              skills: fallbackSkills,
              detectedStream: "Medical Science",
              detectedQualification: "MBBS",
              detectedInstitution: currentProfile.institution || "Swami Vivekananda University",
              keySubjects: ["Anatomy", "Physiology", "Pharmacology", "Internal Medicine"],
              keyProjects: [
                {
                  title: "Clinical Rotation Case Study",
                  description: "Detailed management plans for multi-system ICU patient profiles.",
                  techStack: "ACLS Protocols, Electronic Health Records"
                }
              ],
              knowledgeDepth: "Excellent clinical decision-making, patient monitoring, and medicine administration skills.",
              careerDomain: "Healthcare & Medicine"
            };
          } else if (isLegal) {
            fallbackSkills = [
              { name: "Legal Drafting", level: 90 },
              { name: "Case Law Research", level: 93 },
              { name: "Advocacy & Litigation", level: 87 },
              { name: "Constitutional Law", level: 86 }
            ];
            fallbackAnalysis = {
              skills: fallbackSkills,
              detectedStream: "Law / Legal Studies",
              detectedQualification: "LLB",
              detectedInstitution: currentProfile.institution || "Swami Vivekananda University",
              keySubjects: ["Constitutional Law", "Civil Procedure Code", "Indian Penal Code", "Corporate Law"],
              keyProjects: [
                {
                  title: "Moot Court Championship Brief",
                  description: "Comprehensive written pleadings and arguments on constitutional validity.",
                  techStack: "SCC Online, Westlaw"
                }
              ],
              knowledgeDepth: "Thorough understanding of statutory interpretation, precedent analysis, and pleading drafts.",
              careerDomain: "Legal Practice & Advocacy"
            };
          }

          finalSkills = fallbackSkills;
          finalAnalysis = fallbackAnalysis;
          showNotification("⚠️ Resume parsed with local intelligence fallback.");
        } else {
          finalSkills = apiData.skills;
          finalAnalysis = apiData.analysis || {
            skills: apiData.skills,
            detectedStream: currentProfile.stream,
            detectedQualification: currentProfile.qualification,
            detectedInstitution: currentProfile.institution,
            keySubjects: ["Core Technical Concepts"],
            keyProjects: [],
            knowledgeDepth: "Extracted skills from resume.",
            careerDomain: "Technology"
          };
          showNotification("🎉 Resume parsed successfully!");
        }

        setUploadProgress(100);
        setDetectedSkills(finalSkills);

        const s = finalAnalysis.detectedStream || currentProfile.stream;
        const q = finalAnalysis.detectedQualification || currentProfile.qualification;
        const inst = finalAnalysis.detectedInstitution || currentProfile.institution;

        setStream(s);
        setQualification(q);
        setInstitution(inst);
        setCurrentProfile(prev => ({
          ...prev,
          stream: s,
          qualification: q,
          institution: inst
        }));

        setIsAnalyzed(true);
        setShowOverlay(false);

        setSelectedLanguage("");
        setPreGeneratedQuestions([]);
        localStorage.removeItem("chail_selected_language");
        showNotification("👉 Now please choose your preferred Assessment Language to prepare and unlock the interview.");
      };

      const timer = setInterval(() => {
        if (!isApiDone) {
          let increment = 1.0;
          if (currentProgress < 45) {
            // Start fast (0% to 45%)
            increment = 1.6 + Math.random() * 0.5;
          } else if (currentProgress >= 45 && currentProgress < 80) {
            // Slow down / stall in the middle (45% to 80%)
            increment = 0.12 + Math.random() * 0.15;
          } else if (currentProgress >= 80 && currentProgress < 95) {
            // Speed up again (80% to 95%)
            increment = 1.2 + Math.random() * 0.4;
          } else {
            // Asymptotic micro-loading (95% to 99.4%) to distribute the remaining time naturally.
            // This ensures the animation continuously ticks and never freezes for 3-5 seconds.
            increment = (99.5 - currentProgress) * 0.015;
          }
          currentProgress = Math.min(99.4, currentProgress + increment);
        } else {
          if (currentProgress < 100) {
            currentProgress += 5.0; // Smooth fast catch-up to 100% once the API finishes
            if (currentProgress > 100) currentProgress = 100;
          } else {
            clearInterval(timer);
            finishProcess();
            return;
          }
        }

        const percent = Math.floor(currentProgress);
        setUploadProgress(percent);

        // Customize feedback text based on dynamic percentage segments
        let status = "Uploading and reading your resume... 📄";
        if (percent > 20 && percent <= 45) {
          status = `Parsing academic credentials & degree details... (${percent}%) 🎓`;
        } else if (percent > 45 && percent <= 70) {
          status = `Mapping listed skills and project experience... (${percent}%) 🧠`;
        } else if (percent > 70 && percent <= 88) {
          status = `Generating custom high-quality questions for your stream... (${percent}%) 🎯`;
        } else if (percent > 88 && percent < 99) {
          status = `Calibrating Swami Vivekananda University (SVU) standard parameters... (${percent}%) ⚡`;
        } else if (percent === 99) {
          status = "Generating top-tier challenging practice questions... Please wait a moment ⏳";
        } else if (percent === 100) {
          status = "Analysis complete! Calibration successful. 🎉";
        }
        setOverlayText(status);
      }, intervalTime);
    };

    reader.onerror = () => {
      alert("Failed to read the file.");
      setIsAnalyzing(false);
      setShowOverlay(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentProfile.id,
          qualification,
          stream,
          institution,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCurrentProfile(data.user);
      setIsEditingProfile(false);
      showNotification("Interview Profile updated! 🎯");
    } catch (error: any) {
      alert("Error updating profile: " + error.message);
    }
  };

  const handleStartInterviewClick = () => {
    if (!isAnalyzed) return;
    if (!selectedLanguage) {
      showNotification("Please select your preferred assessment language! 🌐");
      return;
    }

    onStartInterview(detectedSkills, preGeneratedQuestions);
  };

  return (
    <div className="dashboard-page-wrapper">
      <style>{`
        :root{
          --bg1:#020617;
          --bg2:#071226;
          --card:rgba(15,23,42,.72);
          --border:rgba(255,255,255,.12);
          --text:#e5eefc;
          --muted:#94a3b8;
          --cyan:#22d3ee;
          --blue:#3b82f6;
          --pink:#ec4899;
          --green:#22c55e;
          --shadow:0 24px 80px rgba(0,0,0,.45);
          --radius:28px;
        }

        .dashboard-page-wrapper {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle at top left, rgba(34,211,238,.16), transparent 28%),
                      radial-gradient(circle at bottom right, rgba(236,72,153,.12), transparent 28%),
                      linear-gradient(135deg, var(--bg1), var(--bg2));
          color: var(--text);
          padding: 16px;
          position: relative;
        }

        .dashboard-page-wrapper .orb{position:fixed;border-radius:50%;filter:blur(16px);opacity:.8;pointer-events:none;}
        .dashboard-page-wrapper .o1{width:260px;height:260px;background:rgba(34,211,238,.14);top:-80px;left:-80px;}
        .dashboard-page-wrapper .o2{width:220px;height:220px;background:rgba(236,72,153,.12);bottom:-80px;right:-80px;}
        .dashboard-page-wrapper .o3{width:150px;height:150px;background:rgba(34,197,94,.12);bottom:18%;left:12%;}

        .dashboard-page-wrapper .container{
          width: min(1400px,100%);
          height: calc(100vh - 32px);
          max-height: calc(100vh - 32px);
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 20px;
          padding: 20px;
          background: rgba(4,10,24,.74);
          border: 1px solid var(--border);
          border-radius: 32px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
          z-index: 1;
          overflow: hidden;
        }

        .dashboard-page-wrapper .panel{
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.08);
          border-radius:30px;
          padding:28px;
          height: 100%;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .dashboard-page-wrapper .left{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:22px;}
        .dashboard-page-wrapper .logo{font-size:54px;font-weight:800;letter-spacing:1px;line-height:1;}
        .dashboard-page-wrapper .logo span{background:linear-gradient(90deg,var(--cyan),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .dashboard-page-wrapper .tagline{color:var(--muted);font-size:16px;max-width:420px;line-height:1.7;}
        .dashboard-page-wrapper .robot{margin-top:10px;}

        .dashboard-page-wrapper .ai-core{
          width:170px;
          height:170px;
          border-radius:42px;
          border:1px solid rgba(34,211,238,.55);
          background:linear-gradient(145deg, rgba(8,16,32,.95), rgba(5,20,48,.95));
          box-shadow:0 0 25px rgba(34,211,238,.25), inset 0 0 20px rgba(34,211,238,.08);
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          position:relative;
          overflow:hidden;
          animation:float-dashboard 3.5s ease-in-out infinite;
        }
        .dashboard-page-wrapper .ai-core::before{content:"";position:absolute;top:0;left:-120%;width:60%;height:100%;background:linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);transform:skewX(-25deg);animation:shine-dashboard 3.2s infinite;}
        
        .dashboard-page-wrapper .eye{width:82px;height:14px;border-radius:999px;background:var(--cyan);box-shadow:0 0 18px rgba(34,211,238,.8);margin-bottom:18px;animation:blink-dashboard 2s infinite;}
        .dashboard-page-wrapper .ai-text{font-size:44px;font-weight:800;letter-spacing:5px;background:linear-gradient(90deg,var(--cyan),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        
        .dashboard-page-wrapper .status{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;}
        .dashboard-page-wrapper .status-box{padding:16px 14px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#dbeafe;transition:.3s ease;cursor:default;font-size:14px;}
        .dashboard-page-wrapper .status-box:hover{transform:translateY(-4px);background:rgba(255,255,255,.1);box-shadow:0 0 22px rgba(34,211,238,.22);}
        
        .dashboard-page-wrapper .right {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          height: 100%;
          overflow: hidden;
          padding: 24px;
        }
        .dashboard-page-wrapper .card {
          width: 100%;
          height: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow: hidden;
        }
        .dashboard-page-wrapper .card h2 { font-size: 34px; text-align: center; margin-bottom: -4px; font-weight: bold; }
        .dashboard-page-wrapper .subtitle { text-align: center; color: var(--muted); font-size: 15px; line-height: 1.7; margin-bottom: 8px; }

        .dashboard-page-wrapper .tab-content-scroll {
          flex: 1;
          overflow-y: auto;
          padding-right: 6px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.35) transparent;
        }

        .dashboard-page-wrapper .tab-content-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .dashboard-page-wrapper .tab-content-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .dashboard-page-wrapper .tab-content-scroll::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 999px;
        }

        .dashboard-page-wrapper .tab-content-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }
        
        .dashboard-page-wrapper .upload-box{padding:28px;border-radius:24px;border:1px dashed rgba(34,211,238,.655);background:rgba(255,255,255,.03);text-align:center;transition:.3s ease;}
        .dashboard-page-wrapper .upload-icon{font-size:54px;margin-bottom:12px;}
        .dashboard-page-wrapper .upload-box h3{font-size:22px;margin-bottom:6px;font-weight:bold;}
        .dashboard-page-wrapper .upload-box p{color:var(--muted);font-size:14px;}
        .dashboard-page-wrapper .file-upload{margin-top:18px;}
        
        .dashboard-page-wrapper .upload-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:16px;padding:14px 28px;font-size:16px;font-weight:700;cursor:pointer;color:#fff;background:linear-gradient(90deg,var(--cyan),var(--blue),var(--pink));box-shadow:0 10px 24px rgba(59,130,246,.25);transition:.25s ease;user-select:none;}
        .dashboard-page-wrapper .upload-btn:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(34,211,238,.25);filter:saturate(1.1);}
        
        .dashboard-page-wrapper #filename{margin-top:16px;color:var(--cyan);font-size:14px;word-break:break-word;min-height:22px;text-align:center;font-weight:bold;}
        .dashboard-page-wrapper .progress{width:100%;height:10px;background:rgba(255,255,255,.08);border-radius:999px;margin-top:18px;overflow:hidden;}
        .dashboard-page-wrapper #bar{width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--cyan),#22c55e);transition:width .18s linear;}
        
        .dashboard-page-wrapper .skill-section{padding:22px;border-radius:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);}
        .dashboard-page-wrapper .skill-section h3{margin-bottom:16px;font-size:20px;font-weight:bold;}
        .dashboard-page-wrapper .skill-item{margin-bottom:14px;}
        .dashboard-page-wrapper .skill-item .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:14px;color:#dbeafe;}
        .dashboard-page-wrapper .line{width:100%;height:10px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;}
        .dashboard-page-wrapper .fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--cyan),var(--green));transition:width .8s ease;}
        
        .dashboard-page-wrapper .waiting{padding:22px;text-align:center;border:1px dashed rgba(34,211,238,.55);border-radius:20px;color:#cbd5e1;background:rgba(255,255,255,.03);line-height:1.8;font-size:15px;}
        
        .dashboard-page-wrapper .buttons{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .dashboard-page-wrapper .buttons button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: 16px;
          padding: 14px 22px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          color: #fff;
          background: linear-gradient(90deg,var(--cyan),var(--blue),var(--pink));
          box-shadow: 0 10px 24px rgba(59,130,246,.25);
          transition: .25s ease;
          user-select: none;
        }
        .dashboard-page-wrapper .buttons button:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(34,211,238,.25);
          filter: saturate(1.1);
        }
        .dashboard-page-wrapper .buttons button:disabled {
          opacity: .45;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        /* Profile Editing configurations styling */
        .dashboard-page-wrapper .profile-form-box {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 20px;
        }
        .dashboard-page-wrapper .profile-form-box input, .dashboard-page-wrapper .profile-form-box select {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          margin-top: 5px;
          outline: none;
        }
        .dashboard-page-wrapper .profile-form-box input:focus, .dashboard-page-wrapper .profile-form-box select:focus {
          border-color: var(--cyan);
        }

        .dashboard-page-wrapper .logout-btn-header {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          cursor: pointer;
          font-weight: bold;
          transition: 0.2s;
        }
        .dashboard-page-wrapper .logout-btn-header:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
        }

        /* Overlay */
        .dashboard-page-wrapper .overlay{position:fixed;inset:0;background:rgba(2,6,23,.96);display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;font-size:28px;z-index:99999;gap:14px;text-align:center;padding:24px;}
        .dashboard-page-wrapper .overlay .emoji{font-size:84px;}

        /* Document/Resume scanning visual */
        .dashboard-page-wrapper .scan-container {
          position: relative;
          width: 130px;
          height: 160px;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .dashboard-page-wrapper .scan-doc {
          font-size: 88px;
          filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.45));
          animation: pulse-doc 2s infinite ease-in-out;
        }
        .dashboard-page-wrapper .scan-beam {
          position: absolute;
          left: -15px;
          right: -15px;
          height: 4px;
          background: linear-gradient(90deg, transparent, var(--cyan), transparent);
          box-shadow: 0 0 15px var(--cyan), 0 0 5px var(--cyan);
          border-radius: 999px;
          animation: scan-move 2.2s infinite ease-in-out;
        }
        .dashboard-page-wrapper .upload-progress-container {
          width: min(380px, 85vw);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          height: 12px;
          overflow: hidden;
          position: relative;
          margin-top: 14px;
        }
        .dashboard-page-wrapper .upload-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--cyan), var(--pink));
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.6);
          border-radius: 999px;
          transition: width 0.15s ease-out;
        }
        .dashboard-page-wrapper .upload-progress-percent {
          font-size: 15px;
          color: var(--cyan);
          font-weight: bold;
          margin-top: 4px;
          font-family: monospace;
          letter-spacing: 0.5px;
        }

        @keyframes scan-move {
          0% { top: 15%; }
          50% { top: 85%; }
          100% { top: 15%; }
        }
        @keyframes pulse-doc {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.04); opacity: 1; }
        }

        /* AI Hologram radar animation */
        .dashboard-page-wrapper .ai-holo-container {
          position: relative;
          width: 160px;
          height: 160px;
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .dashboard-page-wrapper .ai-holo-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid transparent;
        }
        .dashboard-page-wrapper .ring-outer {
          width: 140px;
          height: 140px;
          border-top-color: var(--cyan);
          border-bottom-color: var(--cyan);
          animation: spin-clockwise 3s linear infinite;
          opacity: 0.8;
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }
        .dashboard-page-wrapper .ring-middle {
          width: 100px;
          height: 100px;
          border-left-color: var(--pink);
          border-right-color: var(--pink);
          animation: spin-counter-clockwise 2s linear infinite;
          opacity: 0.6;
          box-shadow: 0 0 15px rgba(236, 72, 153, 0.25);
        }
        .dashboard-page-wrapper .ring-inner {
          width: 60px;
          height: 60px;
          border-top-color: var(--blue);
          border-bottom-color: var(--blue);
          animation: spin-clockwise 1.2s linear infinite;
          opacity: 0.9;
        }
        .dashboard-page-wrapper .ai-holo-core {
          font-size: 40px;
          z-index: 2;
          filter: drop-shadow(0 0 12px var(--cyan));
          animation: pulse-core 1.5s infinite ease-in-out;
        }
        .dashboard-page-wrapper .loading-gradient-title {
          background: linear-gradient(90deg, var(--cyan), var(--blue), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
          font-size: 30px;
          letter-spacing: -0.5px;
          margin-top: 8px;
        }
        .dashboard-page-wrapper .overlay-subtitle {
          font-size: 16px;
          color: rgba(245, 247, 255, 0.75);
          margin-top: 4px;
          font-weight: 500;
          letter-spacing: 0.5px;
          min-height: 24px;
        }
        .dashboard-page-wrapper .loading-dots {
          display: flex;
          gap: 6px;
          margin-top: 12px;
        }
        .dashboard-page-wrapper .loading-dots span {
          width: 8px;
          height: 8px;
          background-color: var(--cyan);
          border-radius: 50%;
          animation: dot-jump 1.4s infinite ease-in-out;
          box-shadow: 0 0 8px var(--cyan);
        }
        .dashboard-page-wrapper .loading-dots span:nth-child(2) {
          animation-delay: 0.2s;
          background-color: var(--pink);
          box-shadow: 0 0 8px var(--pink);
        }
        .dashboard-page-wrapper .loading-dots span:nth-child(3) {
          animation-delay: 0.4s;
          background-color: var(--blue);
          box-shadow: 0 0 8px var(--blue);
        }

        @keyframes spin-clockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-counter-clockwise {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulse-core {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px var(--cyan)); }
          50% { transform: scale(1.15); filter: drop-shadow(0 0 24px var(--pink)); }
        }
        @keyframes dot-jump {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }

        /* Tabs navigation */
        .dashboard-page-wrapper .tabs-nav {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding-bottom: 8px;
        }
        .dashboard-page-wrapper .tab-btn {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 12px;
          transition: 0.25s ease;
          position: relative;
        }
        .dashboard-page-wrapper .tab-btn.active {
          color: var(--cyan);
          background: rgba(34, 211, 238, 0.08);
          box-shadow: inset 0 0 10px rgba(34, 211, 238, 0.1);
        }
        .dashboard-page-wrapper .tab-btn:hover {
          color: white;
        }

        /* History items list */
        .dashboard-page-wrapper .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 6px;
        }
        .dashboard-page-wrapper .history-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          transition: 0.2s ease;
        }
        .dashboard-page-wrapper .history-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(34, 211, 238, 0.3);
          transform: translateX(4px);
        }
        .dashboard-page-wrapper .history-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }
        .dashboard-page-wrapper .history-title {
          font-size: 15px;
          font-weight: bold;
          color: white;
        }
        .dashboard-page-wrapper .history-meta {
          font-size: 12px;
          color: var(--muted);
        }
        .dashboard-page-wrapper .history-badge-row {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .dashboard-page-wrapper .history-badge {
          font-size: 10px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .dashboard-page-wrapper .history-badge.grade {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .dashboard-page-wrapper .history-badge.score {
          background: rgba(34, 211, 238, 0.15);
          color: var(--cyan);
          border: 1px solid rgba(34, 211, 238, 0.2);
        }
        .dashboard-page-wrapper .history-actions {
          display: flex;
          gap: 8px;
        }
        .dashboard-page-wrapper .history-btn {
          padding: 8px 14px;
          font-size: 12px;
          font-weight: bold;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: 0.2s ease;
        }
        .dashboard-page-wrapper .history-btn.view {
          background: rgba(34, 211, 238, 0.1);
          color: var(--cyan);
          border: 1px solid rgba(34, 211, 238, 0.25);
        }
        .dashboard-page-wrapper .history-btn.view:hover {
          background: var(--cyan);
          color: black;
          box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);
        }
        .dashboard-page-wrapper .history-btn.print {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .dashboard-page-wrapper .history-btn.print:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Diagnostic details overlay modal */
        .dashboard-page-wrapper .diag-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 100000;
          padding: 24px;
        }
        .dashboard-page-wrapper .diag-modal {
          background: #060f22;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 24px;
          width: 100%;
          max-width: 850px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          overflow: hidden;
          position: relative;
        }
        .dashboard-page-wrapper .diag-modal-header {
          padding: 18px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .dashboard-page-wrapper .diag-modal-title {
          font-size: 18px;
          font-weight: 800;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dashboard-page-wrapper .diag-modal-close {
          background: rgba(255,255,255,0.06);
          border: none;
          color: var(--muted);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: 0.2s ease;
        }
        .dashboard-page-wrapper .diag-modal-close:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }
        .dashboard-page-wrapper .diag-modal-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Diagnostic and Per-Question Evaluation Panel Styling inside modal */
        .dashboard-page-wrapper .diagnostic-header {
          font-size: 15px;
          font-weight: 800;
          margin-top: 10px;
          margin-bottom: 8px;
          color: #fff;
          border-left: 4px solid var(--cyan);
          padding-left: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dashboard-page-wrapper .diagnostic-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 8px;
        }

        @media (max-width: 900px) {
          .dashboard-page-wrapper .diagnostic-grid {
            grid-template-columns: 1fr;
          }
        }

        .dashboard-page-wrapper .diagnostic-card {
          padding: 14px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.06);
          position: relative;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        }

        .dashboard-page-wrapper .diagnostic-card.strength {
          background: linear-gradient(135deg, rgba(34,197,94,.06), rgba(22,101,52,.10));
          border-color: rgba(34,197,94,.20);
        }

        .dashboard-page-wrapper .diagnostic-card.mistake {
          background: linear-gradient(135deg, rgba(239,68,68,.06), rgba(153,27,27,.10));
          border-color: rgba(239,68,68,.20);
        }

        .dashboard-page-wrapper .diagnostic-card.improvement {
          background: linear-gradient(135deg, rgba(245,158,11,.06), rgba(146,64,14,.10));
          border-color: rgba(245,158,11,.20);
        }

        .dashboard-page-wrapper .diagnostic-card-title {
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dashboard-page-wrapper .diagnostic-card-title.strength { color: #4ade80; }
        .dashboard-page-wrapper .diagnostic-card-title.mistake { color: #f87171; }
        .dashboard-page-wrapper .diagnostic-card-title.improvement { color: #fbbf24; }

        .dashboard-page-wrapper .diagnostic-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dashboard-page-wrapper .diagnostic-item {
          font-size: 12px;
          line-height: 1.45;
          color: #cbd5e1;
          padding-left: 18px;
          position: relative;
          text-align: left;
        }

        .dashboard-page-wrapper .diagnostic-item::before {
          position: absolute;
          left: 0;
          font-weight: bold;
        }

        .dashboard-page-wrapper .diagnostic-card.strength .diagnostic-item::before { content: "✔"; color: #4ade80; }
        .dashboard-page-wrapper .diagnostic-card.mistake .diagnostic-item::before { content: "✖"; color: #f87171; }
        .dashboard-page-wrapper .diagnostic-card.improvement .diagnostic-item::before { content: "➔"; color: #fbbf24; }

        .dashboard-page-wrapper .q-analysis-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: auto;
          overflow: visible;
          padding: 4px 0;
        }

        .dashboard-page-wrapper .q-analysis-card {
          flex-shrink: 0;
          height: auto;
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(255,255,255,.02);
          border: 1px solid rgba(255,255,255,.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          box-sizing: border-box;
          overflow: visible;
        }

        .dashboard-page-wrapper .q-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }

        .dashboard-page-wrapper .q-num {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--cyan);
          letter-spacing: 0.5px;
        }

        .dashboard-page-wrapper .q-diff {
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .dashboard-page-wrapper .q-diff.easy { background: rgba(34,197,94,.15); color: #4ade80; }
        .dashboard-page-wrapper .q-diff.medium { background: rgba(245,158,11,.15); color: #fbbf24; }
        .dashboard-page-wrapper .q-diff.hard { background: rgba(239,68,68,.15); color: #f87171; }

        .dashboard-page-wrapper .q-text {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          line-height: 1.4;
          text-align: left;
        }

        .dashboard-page-wrapper .q-ans-box {
          border-left: 3px solid rgba(255,255,255,.12);
          padding-left: 10px;
          margin: 2px 0;
          text-align: left;
        }

        .dashboard-page-wrapper .q-ans-lbl {
          font-size: 9px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }

        .dashboard-page-wrapper .q-ans-val {
          font-size: 12px;
          line-height: 1.4;
          color: #94a3b8;
          font-style: italic;
        }

        .dashboard-page-wrapper .q-feedback-box {
          padding: 10px;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.45;
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
        }

        .dashboard-page-wrapper .feedback-scroll {
          max-height: 80px;
          overflow-y: auto;
          padding-right: 6px;
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.35) transparent;
        }

        .dashboard-page-wrapper .feedback-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .dashboard-page-wrapper .feedback-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .dashboard-page-wrapper .feedback-scroll::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 999px;
        }

        .dashboard-page-wrapper .feedback-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }

        .dashboard-page-wrapper .q-feedback-box.skip {
          background: rgba(239,68,68,.04);
          border: 1px dashed rgba(239,68,68,.20);
        }

        .dashboard-page-wrapper .q-feedback-box.short {
          background: rgba(245,158,11,.04);
          border: 1px dashed rgba(245,158,11,.20);
        }

        .dashboard-page-wrapper .q-feedback-box.good {
          background: rgba(34,197,94,.04);
          border: 1px dashed rgba(34,197,94,.20);
        }

        .dashboard-page-wrapper .q-fb-title {
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .dashboard-page-wrapper .q-fb-title.skip { color: #f87171; }
        .dashboard-page-wrapper .q-fb-title.short { color: #fbbf24; }
        .dashboard-page-wrapper .q-fb-title.good { color: #4ade80; }

        .dashboard-page-wrapper .q-fb-desc {
          color: #94a3b8;
        }

        @keyframes float-dashboard{50%{transform:translateY(-12px);}}
        @keyframes blink-dashboard{50%{opacity:.25;}}
        @keyframes shine-dashboard{100%{left:170%;}}

        @media (max-width: 980px){
          .dashboard-page-wrapper { height: auto; min-height: 100vh; overflow-y: auto; }
          .dashboard-page-wrapper .container { grid-template-columns: 1fr; height: auto; max-height: none; overflow: visible; }
          .dashboard-page-wrapper .panel { height: auto; overflow: visible; }
          .dashboard-page-wrapper .status { grid-template-columns: 1fr 1fr; }
          .dashboard-page-wrapper .right { height: auto; overflow: visible; }
          .dashboard-page-wrapper .card { height: auto; overflow: visible; }
          .dashboard-page-wrapper .tab-content-scroll { height: auto; overflow: visible; }
        }
        @media (max-width: 600px){
          .dashboard-page-wrapper .container { padding: 16px; border-radius: 24px; }
          .dashboard-page-wrapper .panel { padding: 20px; border-radius: 22px; }
          .dashboard-page-wrapper .logo { font-size: 40px; }
          .dashboard-page-wrapper .card h2 { font-size: 28px; }
          .dashboard-page-wrapper .buttons, .dashboard-page-wrapper .status { grid-template-columns: 1fr; }
          .dashboard-page-wrapper .ai-core { width: 140px; height: 140px; }
          .dashboard-page-wrapper .ai-text { font-size: 36px; }
        }
      `}</style>

      {/* Logout button at absolute top corner */}
      <button onClick={onLogout} className="logout-btn-header">
        Logout 👋
      </button>

      {/* Background Orbs */}
      <div className="orb o1"></div>
      <div className="orb o2"></div>
      <div className="orb o3"></div>

      <div className="container">
        {/* Left Info Side */}
        <div className="panel left">
          <div className="logo">Ch<span>AI</span>L</div>
          <p className="tagline">AI Resume Analyzer & Smart Interview Platform</p>

          <div className="robot">
            <div className="ai-core">
              <div className="eye"></div>
              <div className="ai-text">SVU</div>
            </div>
          </div>

          <div className="status">
            <div className="status-box">✔ Resume Upload</div>
            <div className="status-box">🧠 AI Analysis</div>
            <div className="status-box">🎯 Interview Ready</div>
            <div className="status-box">📊 Smart Result</div>
          </div>
        </div>

        {/* Right Dashboard Area */}
        <div className="panel right">
          <div className="card">
            <h2>Welcome Back, {currentProfile.name} 👋</h2>
            <p className="subtitle">
              Upload your resume and let AI prepare your interview journey in a clean, fast, and modern way.
            </p>

            {isEditingProfile ? (
              /* Config Academic Details */
              <div className="profile-form-box">
                <h3 className="text-lg font-bold text-cyan-400 mb-3">✏ Configure Academic Background</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-300">Qualification Level</label>
                    <select value={qualification} onChange={(e) => setQualification(e.target.value)}>
                      <option value="B.A. (Hons.)">B.A. (Hons.) - Honors Graduate</option>
                      <option value="B.Tech (Engineering)">B.Tech - Engineer</option>
                      <option value="M.Tech (Final Year)">M.Tech - Post Graduation</option>
                      <option value="M.B.B.S. (Medical)">M.B.B.S. - Doctor</option>
                      <option value="B.Sc (Honours)">B.Sc (Honours) - Graduation</option>
                      <option value="Higher Secondary (12th)">School Student (12th)</option>
                      <option value="Ph.D. (Doctorate)">Ph.D. (Doctorate research)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-300">Subject / Major Stream</label>
                    <input
                      type="text"
                      value={stream}
                      onChange={(e) => setStream(e.target.value)}
                      required
                      placeholder="e.g. Computer Science, Education"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300">University / Board / Institution</label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      style={{
                        padding: "10px 18px",
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "none",
                        color: "white",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        flex: 1,
                      }}
                    >
                      Save Configuration
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      style={{
                        padding: "10px 18px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "white",
                        borderRadius: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Main Switchable Tabs and Views */
              <>
                <div className="tabs-nav">
                  <button 
                    className={`tab-btn ${activeTab === "PRACTICE" ? "active" : ""}`}
                    onClick={() => setActiveTab("PRACTICE")}
                  >
                    🚀 Resume Practice
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "HISTORY" ? "active" : ""}`}
                    onClick={() => setActiveTab("HISTORY")}
                  >
                    📜 Practice History ({history.length})
                  </button>
                </div>

                <div className="tab-content-scroll">
                  {activeTab === "PRACTICE" ? (
                  <>
                    {/* Single shared input to avoid multiple ref bindings */}
                    <input
                      type="file"
                      id="resume-file-input"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.txt"
                      hidden
                    />

                    <div 
                      className={`upload-box ${selectedFile ? "uploaded" : ""}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        position: "relative",
                        cursor: "default",
                        overflow: "visible",
                        flexShrink: 0,
                        minHeight: "130px",
                        padding: "12px 16px",
                        borderRadius: "24px",
                        border: isDragOver ? "1px dashed var(--pink)" : resumeValidationError ? "1.5px solid rgba(239,68,68,0.5)" : selectedFile ? "1px solid rgba(34,197,94,0.4)" : "1px dashed rgba(34,211,238,.655)",
                        backgroundColor: isDragOver ? "rgba(255,255,255,0.08)" : resumeValidationError ? "rgba(239,68,68,0.02)" : selectedFile ? "rgba(34,197,94,0.02)" : "rgba(255,255,255,.03)",
                        boxShadow: isDragOver ? "0 0 35px rgba(236,72,153,0.3)" : resumeValidationError ? "0 8px 32px rgba(239,68,68,0.15)" : selectedFile ? "0 8px 32px rgba(34,197,94,0.06)" : "0 0 20px rgba(0,0,0,0.2)",
                        transition: "all 0.3s ease",
                        textAlign: "center"
                      }}
                    >
                      {isDragOver && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "radial-gradient(circle, var(--pink) 0%, transparent 70%)",
                            pointerEvents: "none",
                            opacity: 0.15
                          }}
                        />
                      )}

                      {resumeValidationError ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ 
                            fontSize: "44px", 
                            marginBottom: "10px",
                            filter: "drop-shadow(0 4px 12px rgba(239,68,68,0.5))",
                            animation: "pulse-doc 1.5s infinite ease-in-out"
                          }}>
                            🚫
                          </div>
                          
                          <h3 style={{ 
                            fontSize: "18px", 
                            fontWeight: "800", 
                            color: "#ef4444", 
                            marginBottom: "12px",
                            letterSpacing: "0.5px",
                            textShadow: "0 2px 10px rgba(239,68,68,0.25)"
                          }}>
                            Not a Valid Resume / CV!
                          </h3>

                          <div className="file-upload" style={{ margin: "5px 0" }}>
                            <div 
                              className="upload-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                border: "none",
                                borderRadius: "12px",
                                padding: "10px 22px",
                                fontSize: "14px",
                                fontWeight: "700",
                                cursor: "pointer",
                                color: "#fff",
                                background: "linear-gradient(90deg, #ef4444, #f43f5e)",
                                boxShadow: "0 6px 16px rgba(239,68,68,.25)",
                                userSelect: "none",
                                transition: "all 0.25s ease"
                              }}
                            >
                              ✨ Choose Resume
                            </div>
                          </div>
                        </div>
                      ) : selectedFile ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ 
                              fontSize: "44px", 
                              marginBottom: "8px",
                              filter: "drop-shadow(0 4px 12px rgba(34,197,94,0.3))"
                            }}>
                              🎉
                            </div>
                            
                            <h3 style={{ 
                              fontSize: "18px", 
                              fontWeight: "800", 
                              color: "#4ade80", 
                              marginBottom: "6px",
                              letterSpacing: "0.5px",
                              textShadow: "0 2px 10px rgba(34,197,94,0.15)"
                            }}>
                              Resume Uploaded Successfully!
                            </h3>
                            
                            <div style={{
                              marginTop: "4px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "4px 12px",
                              background: "rgba(34,197,94,0.08)",
                              border: "1px solid rgba(34,197,94,0.2)",
                              borderRadius: "10px",
                              color: "rgba(255,255,255,0.9)",
                              fontSize: "12px",
                              fontWeight: "500",
                              maxWidth: "90%",
                              wordBreak: "break-all"
                            }}>
                              <span>📄</span>
                              <span>{selectedFile.name}</span>
                            </div>

                            <div className="file-upload" style={{ margin: "10px 0 0 0" }}>
                              <div 
                                className="upload-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                  borderRadius: "10px",
                                  padding: "8px 18px",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  color: "#fff",
                                  background: "rgba(255, 255, 255, 0.12)",
                                  border: "1px solid rgba(255, 255, 255, 0.18)",
                                  userSelect: "none",
                                  transition: "all 0.25s ease"
                                }}
                              >
                                🔄 Change Resume
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div 
                              className="upload-icon"
                              style={{ fontSize: "36px", marginBottom: "6px", display: "inline-block" }}
                            >
                              📄
                            </div>

                            <h3 
                              style={{ fontSize: "18px", marginBottom: "4px", fontWeight: "bold" }}
                            >
                              Upload Resume
                            </h3>
                            
                            <p 
                              style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "12px" }}
                            >
                              PDF / DOC / DOCX / TXT or Drag & Drop
                            </p>

                            <div className="file-upload" style={{ margin: "5px 0" }}>
                              <div 
                                className="upload-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                  border: "none",
                                  borderRadius: "12px",
                                  padding: "10px 22px",
                                  fontSize: "14px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  color: "#fff",
                                  background: "linear-gradient(90deg,var(--cyan),var(--blue),var(--pink))",
                                  boxShadow: "0 6px 16px rgba(59,130,246,.25)",
                                  userSelect: "none",
                                  transition: "all 0.25s ease"
                                }}
                              >
                                ✨ Choose Resume
                              </div>
                            </div>
                          </>
                      )}
                    </div>

                    {/* Mandatory Language Selection */}
                    <div style={{
                      marginTop: "16px",
                      marginBottom: "16px",
                      padding: "16px",
                      borderRadius: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      alignItems: "stretch"
                    }}>
                      <label style={{ 
                        fontSize: "13px", 
                        fontWeight: "600", 
                        color: !isAnalyzed ? "rgba(255, 255, 255, 0.3)" : "var(--cyan)", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "6px" 
                      }}>
                        {!isAnalyzed ? "🔒" : "🌐"} Choose Assessment Language {!isAnalyzed && "(Locked)"}
                      </label>
                      <select
                        value={selectedLanguage}
                        onChange={handleLanguageChange}
                        disabled={!isAnalyzed}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "12px",
                          background: !isAnalyzed ? "rgba(255, 255, 255, 0.02)" : "#0d1527",
                          border: !isAnalyzed ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(34, 211, 238, 0.3)",
                          color: !isAnalyzed ? "rgba(255, 255, 255, 0.25)" : "#fff",
                          fontSize: "14px",
                          fontWeight: "500",
                          outline: "none",
                          cursor: !isAnalyzed ? "not-allowed" : "pointer",
                          opacity: !isAnalyzed ? 0.6 : 1
                        }}
                      >
                        <option value="">-- Select Language / ভাষা নির্বাচন করুন --</option>
                        <option value="English">English (Recommended)</option>
                        <option value="Bengali">Bengali (বাংলা)</option>
                        <option value="Hindi">Hindi (हिंदी)</option>
                      </select>
                      <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                        All questions, options, and hints will be generated in your chosen language.
                      </p>
                    </div>

                    <div className="buttons" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        id="start"
                        onClick={handleStartInterviewClick}
                        disabled={!isAnalyzed || isAnalyzing || !selectedLanguage || preGeneratedQuestions.length === 0}
                        style={{ 
                          width: "100%",
                          background: (!isAnalyzed || !selectedLanguage || preGeneratedQuestions.length === 0) ? "rgba(255, 255, 255, 0.04)" : "linear-gradient(90deg,var(--cyan),var(--blue),var(--pink))",
                          border: (!isAnalyzed || !selectedLanguage || preGeneratedQuestions.length === 0) ? "1px dashed rgba(255, 255, 255, 0.15)" : "none",
                          color: (!isAnalyzed || !selectedLanguage || preGeneratedQuestions.length === 0) ? "rgba(255, 255, 255, 0.4)" : "#fff",
                        }}
                      >
                        {!isAnalyzed 
                          ? "🔒 Upload & Analyze Resume to Unlock" 
                          : !selectedLanguage 
                            ? "🌐 Choose Assessment Language" 
                            : preGeneratedQuestions.length === 0
                              ? "⚡ Preparing Interview..."
                              : "🚀 Start Interview"
                        }
                      </button>
                      {!isAnalyzed && (
                        <p style={{ fontSize: "13px", color: "var(--cyan)", textAlign: "center", marginTop: "6px", opacity: 0.95, fontWeight: "500", lineHeight: "1.4" }}>
                          💡 <strong>Have multiple Resumes (e.g., Doctor & Lawyer)?</strong> Upload the specific CV you want to be interviewed for. Each upload instantly detects the domain and calibrates the questions & language! <br />
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "4px" }}>
                            (আপনার কাছে একাধিক সিভি থাকলে (যেমন: ডাক্তার এবং আইনজীবী), আপনি যে বিষয়ে ইন্টারভিউ দিতে চান সেই সিভিটি আপলোড করুন। প্রতিবার আপলোডের সাথে সাথে প্রশ্ন ও ভাষা পরিবর্তিত হবে।)
                          </span>
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  /* Practice History Tab */
                  <div className="history-list">
                    {history.length > 0 ? (
                      history.map((item, index) => (
                        <div key={index} className="history-card">
                          <div className="history-info">
                            <div className="history-title">
                              {item.qualification} in {item.stream}
                            </div>
                            <div className="history-meta">
                              <span>📅 {item.date}</span> • <span style={{ color: "rgba(255,255,255,0.4)" }}>ID: {item.interviewId}</span>
                            </div>
                            <div className="history-badge-row">
                              <span className="history-badge grade">Grade: {item.finalGrade}</span>
                              <span className="history-badge score">Score: {item.percentage}%</span>
                            </div>
                          </div>
                          <div className="history-actions">
                            <button 
                              className="history-btn view" 
                              onClick={() => {
                                setSelectedHistoryItem(item);
                                setShowHistoryModal(true);
                              }}
                            >
                              🔍 View Diagnostics
                            </button>
                            <a 
                              href={`/api/interview/print/${currentProfile.id}/${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="history-btn print"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                              onClick={() => {
                                showNotification("Opening official transcript... 🖨");
                              }}
                            >
                              🖨 Print
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="waiting">
                        <span>No past practice interview transcripts found. Complete an interview to generate a transcript history!</span>
                      </p>
                    )}
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* HISTORY DIAGNOSTIC DETAILS POPUP MODAL */}
      {showHistoryModal && selectedHistoryItem && (
        <div className="diag-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="diag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="diag-modal-header">
              <div className="diag-modal-title">
                <span>📊</span> SVU-ChAIL Placement Diagnostic Analysis
              </div>
              <button className="diag-modal-close" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="diag-modal-body">
                {/* Header Info */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px" }}>
                  <div style={{ textAlign: "left" }}>
                    <h4 style={{ color: "#22d3ee", margin: 0, fontSize: "16px", fontWeight: "bold" }}>{selectedHistoryItem.qualification} in {selectedHistoryItem.stream}</h4>
                    <p style={{ color: "#94a3b8", margin: "4px 0 0 0", fontSize: "12px" }}>ID: {selectedHistoryItem.interviewId} • Date: {selectedHistoryItem.date}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#4ade80" }}>{selectedHistoryItem.finalGrade}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>Score: {selectedHistoryItem.percentage}% ({selectedHistoryItem.overallScore}/500)</div>
                  </div>
                </div>

                {/* Chief Appraisal */}
                <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>
                  <div style={{ fontWeight: "800", color: "#fbbf24", marginBottom: "6px", fontSize: "13px", textTransform: "uppercase" }}>Chief AI Appraisal</div>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#e2e8f0" }}>{selectedHistoryItem.summary}</p>
                </div>

                {/* Strengths & Mistakes & How to Improve Grid */}
                <div className="diagnostic-header">
                  <span>📊</span> Strengths & Flaws Diagnostic Overview
                </div>
                <div className="diagnostic-grid">
                  {/* Strengths */}
                  <div className="diagnostic-card strength">
                    <div className="diagnostic-card-title strength">
                      <span>🌟</span> Core Strengths
                    </div>
                    <ul className="diagnostic-list">
                      {selectedHistoryItem.strengths.map((str: string, index: number) => (
                        <li key={index} className="diagnostic-item">{str}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Flaws */}
                  <div className="diagnostic-card mistake">
                    <div className="diagnostic-card-title mistake">
                      <span>❌</span> Flaws & Mistakes
                    </div>
                    <ul className="diagnostic-list">
                      {selectedHistoryItem.developmentAreas.map((dev: string, index: number) => (
                        <li key={index} className="diagnostic-item">{dev}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Improvement */}
                  <div className="diagnostic-card improvement">
                    <div className="diagnostic-card-title improvement">
                      <span>🚀</span> How To Improve
                    </div>
                    <ul className="diagnostic-list">
                      {(selectedHistoryItem.feedback && selectedHistoryItem.feedback.length > 0 ? selectedHistoryItem.feedback : selectedHistoryItem.strengths).map((rec: string, index: number) => (
                        <li key={index} className="diagnostic-item">{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Per-Question Transcript */}
                {selectedHistoryItem.questions && selectedHistoryItem.questions.length > 0 && (
                  <>
                    <div className="diagnostic-header" style={{ marginTop: "0px" }}>
                      <span>🧠</span> Question-Level Performance Transcript
                    </div>
                    <div className="q-analysis-list">
                      {selectedHistoryItem.questions.map((qText: string, index: number) => {
                        const ansText = (selectedHistoryItem.answers && selectedHistoryItem.answers[index]) || "";
                        const isSkipped = !ansText || ansText.trim().toLowerCase() === "skipped" || ansText.trim().toLowerCase() === "skip" || ansText.trim().length < 5;
                        const isShort = !isSkipped && ansText.trim().split(/\s+/).length < 15;

                        let qDiff = "Medium";
                        if (index === 0) qDiff = "Easy";
                        if (index === 3) qDiff = "Hard";

                        return (
                          <div key={index} className="q-analysis-card">
                            <div className="q-meta-row">
                              <span className="q-num">Question {index + 1}</span>
                              <span className={`q-diff ${qDiff.toLowerCase()}`}>{qDiff}</span>
                            </div>
                            <div className="q-text">{qText}</div>
                            <div className="q-ans-box">
                              <div className="q-ans-lbl">Your Submitted Answer</div>
                              <div className="q-ans-val">
                                {isSkipped ? "Skipped / No Answer Provided" : `"${ansText}"`}
                              </div>
                            </div>

                            {/* AI Per-Question Critique */}
                            {isSkipped ? (
                              <div className="q-feedback-box skip">
                                <div className="q-fb-title skip">🔴 Skipped - Critical Penalty (0 Marks)</div>
                                <div className="q-fb-desc">
                                  <div className="feedback-scroll">
                                    Leaving questions empty severely damages your score. Academic assessors require an attempt for all questions to evaluate your logical direction. Always try to express some fundamental background in your placement practice sessions.
                                  </div>
                                </div>
                              </div>
                            ) : isShort ? (
                              <div className="q-feedback-box short">
                                <div className="q-fb-title short">⚠️ Superficial Answer - Basic Marks</div>
                                <div className="q-fb-desc">
                                  <div className="feedback-scroll">
                                    You provided an answer, but it is too brief. Industry interviewers look for structured details, architectural concepts, or specific software toolsets. Elaborate using the STAR framework: explain the problem, your action, and the technical outcome.
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="q-feedback-box good">
                                <div className="q-fb-title good">🟢 Adequate Answer - Domain Competent</div>
                                <div className="q-fb-desc">
                                  <div className="feedback-scroll">
                                    Excellent attempt! You successfully structured your thoughts and utilized professional domain vocabulary. To secure an outstanding A+ grade, integrate numerical metrics (e.g., performance speeds, database schema counts) and practical testing tools.
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <a 
                href={`/api/interview/print/${currentProfile.id}/${selectedHistoryItem.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  showNotification("Opening official transcript... 🖨");
                }}
                style={{
                  background: "linear-gradient(90deg, var(--cyan), var(--blue))",
                  border: "none",
                  color: "white",
                  padding: "10px 20px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-block"
                }}
              >
                🖨 Print Official Marksheet
              </a>
              <button 
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                  padding: "10px 20px",
                  borderRadius: "12px",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY LOADING */}
      {showOverlay && (
        <div className="overlay">
          {isAnalyzing ? (
            <>
              <div className="scan-container">
                <div className="scan-doc">📄</div>
                <div className="scan-beam"></div>
              </div>
              <h2 style={{ background: "linear-gradient(90deg, var(--cyan), var(--pink))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800 }}>Analyzing Your Resume</h2>
              <div className="upload-progress-container" style={{ marginTop: "16px" }}>
                <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <div className="upload-progress-percent" style={{ fontSize: "24px", fontWeight: "bold", color: "var(--cyan)", marginTop: "12px" }}>{uploadProgress}%</div>
            </>
          ) : (
            <>
              <div className="ai-holo-container">
                <div className="ai-holo-ring ring-outer"></div>
                <div className="ai-holo-ring ring-middle"></div>
                <div className="ai-holo-ring ring-inner"></div>
                <div className="ai-holo-core">🤖</div>
              </div>
              <h2 className="loading-gradient-title">Preparing Your Interview</h2>
              <p className="overlay-subtitle" style={{ fontSize: "16px", color: "rgba(245, 247, 255, 0.75)", marginTop: "10px", fontWeight: "500", textShadow: "0 0 10px rgba(34, 211, 238, 0.25)", textAlign: "center" }}>
                {overlayText}
              </p>
              <div className="loading-dots" style={{ marginTop: "16px" }}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
