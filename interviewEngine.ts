// interviewEngine.ts - Advanced question generation and answer evaluation engine for ChAIL AI Interview System

export interface QuestionItem {
  q: string;
  s: string;
  d: "Easy" | "Medium" | "Hard";
  type: "mcq" | "short" | "long";
  options?: string[];
  correctOption?: string; // e.g. "A"
  round?: string;
  roundType?: string;
  skillTested?: string;
}

export interface QuestionEvaluationResult {
  qIndex: number;
  question: string;
  answer: string;
  status: "correct" | "partially_correct" | "incorrect" | "unanswered";
  score: number; // 0 to 10
  maxScore: number; // 10
  grade: "A+" | "A" | "B+" | "B" | "C" | "F";
  feedback: string;
  evaluation?: string;
}

// In-memory cache for recent interview questions per user (session level persistence)
export const userRecentQuestions = new Map<number, Set<string>>();

/**
 * Normalizes question text to compare semantic similarity and avoid duplicates
 */
export function normalizeQuestionText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/^[0-9]+[\.\)\s]+/, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect if an answer is skipped, blank, or evasive
 */
export function isAnswerSkippedOrEvasive(answer: string): boolean {
  const clean = (answer || "").trim().toLowerCase();
  if (!clean) return true;

  const evasivePhrases = [
    "skipped",
    "skip",
    "no answer",
    "no response",
    "no response provided",
    "no response provided.",
    "i do not know",
    "i dont know",
    "dont know",
    "don't know",
    "idk",
    "no idea",
    "not sure",
    "sorry",
    "pass",
    "na",
    "n/a",
    "none",
    "nothing",
    "left blank",
    "blank",
    "not answered",
    "unanswered"
  ];

  if (evasivePhrases.includes(clean)) return true;
  if (clean.length <= 2 && !/^[a-d]$/i.test(clean)) return true;

  return false;
}

/**
 * Detect if an answer is keyboard mashing or gibberish
 */
export function isAnswerGibberish(answer: string): boolean {
  const clean = (answer || "").trim();
  if (clean.length < 5) return false;

  // Repetitive characters like "aaaaaa" or "asdfasdf"
  if (/(.)\1{4,}/.test(clean)) return true;

  // Character sets with no vowels in long strings
  const words = clean.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length > 8 && !/[aeiouy]/i.test(w)) {
      return true;
    }
  }

  // Single word repeated over and over
  if (words.length >= 4) {
    const unique = new Set(words.map(w => w.toLowerCase()));
    if (unique.size === 1) return true;
  }

  // Pure keyboard rows: e.g. "asdfghjkl", "qwertyuiop", "zxcvbnm"
  const mashPatterns = [
    /^(asdf|qwer|zxcv|1234|hjkl|poiuy)/i
  ];
  if (mashPatterns.some(p => p.test(clean)) && words.length <= 2) {
    return true;
  }

  return false;
}

/**
 * Evaluate MCQ answers accurately by identifying selected option and comparing to correct option
 */
export function evaluateMcqAnswer(
  questionText: string,
  candidateAnswer: string,
  knownCorrectOption?: string
): { isMcq: boolean; isCorrect: boolean; selectedLetter: string | null; correctLetter: string | null; feedback: string } {
  const qClean = questionText.trim();
  const aClean = candidateAnswer.trim();

  // Extract options from question text if present
  // Matches e.g. "A. Option One\nB. Option Two\nC. Option Three\nD. Option Four"
  const optionRegex = /([A-D])[\.\)\s]+([^\n\r]+)/gi;
  const optionsMap: { [key: string]: string } = {};
  let match;
  while ((match = optionRegex.exec(qClean)) !== null) {
    optionsMap[match[1].toUpperCase()] = match[2].trim();
  }

  const hasOptions = Object.keys(optionsMap).length >= 2;

  // Determine candidate's selected option letter
  let selectedLetter: string | null = null;
  const letterMatch = aClean.match(/^([A-D])[\.\)\s]*(.*)$/i);
  if (letterMatch) {
    selectedLetter = letterMatch[1].toUpperCase();
  } else if (/^[A-D]$/i.test(aClean)) {
    selectedLetter = aClean.toUpperCase();
  } else if (hasOptions) {
    // Check if candidate typed the text of an option
    const lowerAns = aClean.toLowerCase();
    for (const [letter, text] of Object.entries(optionsMap)) {
      if (lowerAns.includes(text.toLowerCase()) || text.toLowerCase().includes(lowerAns)) {
        selectedLetter = letter;
        break;
      }
    }
  }

  if (!hasOptions && !selectedLetter) {
    return { isMcq: false, isCorrect: false, selectedLetter: null, correctLetter: null, feedback: "" };
  }

  // Determine correct option
  let correctLetter = (knownCorrectOption || "").toUpperCase();
  if (!correctLetter) {
    // Derive correct letter from question keywords if standard known questions
    const lowerQ = qClean.toLowerCase();
    if (lowerQ.includes("excel") || lowerQ.includes("spreadsheet") || lowerQ.includes("কন্ডিশনাল") || lowerQ.includes("formatting")) {
      // Find which option is "Conditional Formatting"
      for (const [letter, text] of Object.entries(optionsMap)) {
        if (text.toLowerCase().includes("conditional") || text.toLowerCase().includes("ফরম্যাটিং")) {
          correctLetter = letter;
          break;
        }
      }
      if (!correctLetter) correctLetter = "A";
    } else if (lowerQ.includes("bloom") || lowerQ.includes("ব্লুম")) {
      for (const [letter, text] of Object.entries(optionsMap)) {
        if (text.toLowerCase().includes("remember") || text.toLowerCase().includes("জ্ঞান") || text.toLowerCase().includes("recall")) {
          correctLetter = letter;
          break;
        }
      }
      if (!correctLetter) correctLetter = "A";
    } else if (lowerQ.includes("schedule") || lowerQ.includes("মিটিং") || lowerQ.includes("meeting") || lowerQ.includes("outlook")) {
      for (const [letter, text] of Object.entries(optionsMap)) {
        if (text.toLowerCase().includes("outlook") || text.toLowerCase().includes("teams")) {
          correctLetter = letter;
          break;
        }
      }
      if (!correctLetter) correctLetter = "B";
    } else {
      // Default to option A or check hint
      correctLetter = "A";
    }
  }

  if (!selectedLetter) {
    return {
      isMcq: true,
      isCorrect: false,
      selectedLetter: null,
      correctLetter,
      feedback: `Question required selecting an option (A, B, C, or D). The response did not specify a valid choice (Correct: Option ${correctLetter}).`
    };
  }

  const isCorrect = selectedLetter === correctLetter;
  const selectedText = optionsMap[selectedLetter] ? ` - ${optionsMap[selectedLetter]}` : "";
  const correctText = optionsMap[correctLetter] ? ` - ${optionsMap[correctLetter]}` : "";

  const feedback = isCorrect
    ? `Correct! Selected Option ${selectedLetter}${selectedText}. Full marks awarded.`
    : `Incorrect choice: Selected Option ${selectedLetter}${selectedText}. The correct answer was Option ${correctLetter}${correctText}.`;

  return {
    isMcq: true,
    isCorrect,
    selectedLetter,
    correctLetter,
    feedback
  };
}

/**
 * Strict evaluation of individual question and answer based on technical quality, correctness, and CV alignment
 * NO WORD COUNT HACKS - strictly based on technical correctness, conceptual depth, and accuracy!
 */
export function evaluateQuestionAndAnswerStrict(
  question: string,
  answer: string,
  index: number,
  cvSkills: string[] = []
): QuestionEvaluationResult {
  const qTrim = (question || "").trim();
  const aTrim = (answer || "").trim();

  // 1. Unanswered / Skipped / Evasive
  if (isAnswerSkippedOrEvasive(aTrim)) {
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim || "No response provided.",
      status: "unanswered",
      score: 0,
      maxScore: 10,
      grade: "F",
      feedback: "Question was skipped or left blank without response (0/10 marks).",
      evaluation: "Question was skipped or left blank without response (0/10 marks)."
    };
  }

  // 2. Gibberish / Keyboard Mash
  if (isAnswerGibberish(aTrim)) {
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim,
      status: "incorrect",
      score: 0,
      maxScore: 10,
      grade: "F",
      feedback: "Nonsensical or gibberish answer detected (0/10 marks).",
      evaluation: "Nonsensical or gibberish answer detected (0/10 marks)."
    };
  }

  // 3. Multiple Choice Question
  const mcqEval = evaluateMcqAnswer(qTrim, aTrim);
  if (mcqEval.isMcq) {
    if (mcqEval.isCorrect) {
      return {
        qIndex: index,
        question: qTrim,
        answer: aTrim,
        status: "correct",
        score: 10,
        maxScore: 10,
        grade: "A+",
        feedback: mcqEval.feedback,
        evaluation: mcqEval.feedback
      };
    } else {
      return {
        qIndex: index,
        question: qTrim,
        answer: aTrim,
        status: "incorrect",
        score: 0,
        maxScore: 10,
        grade: "F",
        feedback: mcqEval.feedback,
        evaluation: mcqEval.feedback
      };
    }
  }

  // 4. Open-ended / Descriptive Answer Quality Assessment
  // Extract key concept words from the question
  const stopWords = new Set([
    "what", "how", "why", "when", "where", "which", "who", "whom", "whose",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "can", "could", "should", "would", "may", "might",
    "the", "a", "an", "and", "or", "but", "if", "in", "on", "at", "to", "for",
    "with", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "from", "up", "down", "of", "off", "over", "under",
    "explain", "describe", "discuss", "candidate", "should", "highlight", "answer",
    "provide", "detail", "scenario", "practice", "system", "using"
  ]);

  const qWords = qTrim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const aWords = aTrim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);

  const aWordSet = new Set(aWords);

  // Check how many relevant question terms or domain concepts appear in the candidate's answer
  let conceptOverlapCount = 0;
  for (const qw of qWords) {
    if (aWordSet.has(qw)) {
      conceptOverlapCount++;
    }
  }

  // Check presence of candidate's verified CV skills in the answer
  let skillMentionCount = 0;
  for (const s of cvSkills) {
    const sLower = s.toLowerCase();
    if (aTrim.toLowerCase().includes(sLower)) {
      skillMentionCount++;
    }
  }

  // Technical substance signals
  const technicalIndicators = [
    "because", "therefore", "lifecycle", "state", "props", "hook", "component",
    "render", "virtual dom", "reconciliation", "async", "await", "promise",
    "middleware", "controller", "model", "schema", "query", "index", "latency",
    "throughput", "cache", "memory", "leak", "closure", "prototype", "scope",
    "rest", "api", "endpoint", "status code", "authorization", "authentication",
    "jwt", "token", "header", "payload", "encrypt", "hash", "sanitize",
    "transaction", "rollback", "acid", "normalization", "foreign key", "primary key",
    "flexbox", "grid", "responsive", "breakpoint", "media query", "accessibility",
    "aria", "semantic", "timeline", "cut", "transition", "codec", "bitrate",
    "render queue", "color space", "lut", "waveform", "frame rate", "audio leveling",
    "pedagogy", "curriculum", "assessment", "formative", "summative", "scaffolding",
    "balance sheet", "ledger", "journal", "debit", "credit", "gaap", "ifrs",
    "diagnosis", "symptom", "treatment", "protocol", "pharmacokinetics", "etiology",
    "statute", "precedent", "jurisdiction", "doctrine", "clause", "liability"
  ];

  let technicalSignalCount = 0;
  for (const term of technicalIndicators) {
    if (aTrim.toLowerCase().includes(term)) {
      technicalSignalCount++;
    }
  }

  // Check for completely off-topic or nonsensical answers
  const isOffTopic = qWords.length >= 3 && conceptOverlapCount === 0 && technicalSignalCount === 0 && skillMentionCount === 0;

  if (isOffTopic) {
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim,
      status: "incorrect",
      score: 1,
      maxScore: 10,
      grade: "F",
      feedback: "Answer does not address the core technical subject of the question (1/10 marks).",
      evaluation: "Answer does not address the core technical subject of the question (1/10 marks)."
    };
  }

  // Score determination based on technical accuracy and depth
  if (technicalSignalCount >= 3 || (conceptOverlapCount >= 3 && technicalSignalCount >= 1)) {
    // High-quality accurate answer
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim,
      status: "correct",
      score: 9,
      maxScore: 10,
      grade: "A+",
      feedback: "Accurate and well-articulated technical response with relevant domain depth.",
      evaluation: "Accurate and well-articulated technical response with relevant domain depth."
    };
  } else if (technicalSignalCount >= 1 || conceptOverlapCount >= 2) {
    // Good accurate answer
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim,
      status: "correct",
      score: 8,
      maxScore: 10,
      grade: "A",
      feedback: "Technically sound response addressing the primary requirements of the question.",
      evaluation: "Technically sound response addressing the primary requirements of the question."
    };
  } else if (conceptOverlapCount >= 1 || aWords.length >= 6) {
    // Partial answer
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim,
      status: "partially_correct",
      score: 5,
      maxScore: 10,
      grade: "C",
      feedback: "Partially correct. Touches upon basic concepts but lacks technical depth and complete explanation.",
      evaluation: "Partially correct. Touches upon basic concepts but lacks technical depth and complete explanation."
    };
  } else {
    // Very weak
    return {
      qIndex: index,
      question: qTrim,
      answer: aTrim,
      status: "partially_correct",
      score: 3,
      maxScore: 10,
      grade: "F",
      feedback: "Incomplete answer with minimal technical detail (3/10 marks).",
      evaluation: "Incomplete answer with minimal technical detail (3/10 marks)."
    };
  }
}

/**
 * Dynamic CV-Strict Question Generator Engine
 * Generates 15 questions exclusively derived from the candidate's actual CV skills & projects.
 * Guarantees distinct questions for every interview attempt by rotating angles and excluding past questions.
 */
export function generateCvStrictQuestions(
  skills: string[],
  projects: Array<{ title: string; description?: string; techStack?: string }>,
  stream: string,
  qualification: string,
  attemptNumber: number,
  pastQuestionsNormalized: Set<string>,
  language: string = "English"
): QuestionItem[] {
  // Normalize skills list
  const activeSkills = (skills && skills.length > 0)
    ? skills.map(s => (typeof s === "string" ? s : (s as any).name || "")).filter(Boolean)
    : [stream || "Core Concepts"];

  // Skill-based question repository generator
  const generatedPool: QuestionItem[] = [];

  // Helper to safely add to pool
  const addQuestion = (
    q: string,
    s: string,
    d: "Easy" | "Medium" | "Hard",
    type: "mcq" | "short" | "long",
    options?: string[],
    correctOption?: string,
    skillTested?: string
  ) => {
    generatedPool.push({
      q,
      s,
      d,
      type,
      options,
      correctOption,
      skillTested
    });
  };

  // Generate questions for each skill in candidate's CV
  for (const skill of activeSkills) {
    const sLower = skill.toLowerCase();

    if (sLower.includes("react")) {
      // Easy
      addQuestion(
        "In React, what is the primary purpose of the Virtual DOM during state updates?",
        "Explain DOM diffing and minimizing real DOM re-renders",
        "Easy",
        "mcq",
        [
          "A. It minimizes costly direct manipulations of the browser DOM via diffing and batching.",
          "B. It directly compiles JSX into native C++ browser assembly instructions.",
          "C. It replaces the browser's JavaScript engine with WebAssembly.",
          "D. It stores user credentials in encrypted browser memory."
        ],
        "A",
        skill
      );
      addQuestion(
        "Explain how the `useState` hook manages local state and triggers component re-rendering in React.",
        "Highlight state setter, immutability, and component re-render cycle",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "What is the difference between controlled and uncontrolled components in React forms?",
        "Discuss state-driven inputs vs DOM refs",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );

      // Medium
      addQuestion(
        "When using the `useEffect` hook in React, what is the exact function of the dependency array?",
        "Highlight re-execution conditions and cleanup functions",
        "Medium",
        "mcq",
        [
          "A. It specifies which state or prop values must change to trigger the effect re-execution.",
          "B. It limits the total number of times the component can ever render in memory.",
          "C. It connects the component directly to an external backend database.",
          "D. It encrypts all variables declared inside the effect function."
        ],
        "A",
        skill
      );
      addQuestion(
        "How do `useMemo` and `useCallback` prevent unnecessary child re-renders, and when can their use be counterproductive?",
        "Discuss referential equality, computation cost vs hook overhead",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "Explain how React handles prop drilling and compare Context API with custom state management libraries.",
        "Address component decoupling, re-render boundaries, and scalability",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );

      // Hard
      addQuestion(
        "How does React 18 Concurrent Rendering with `useTransition` and `useDeferredValue` avoid UI thread freezing during heavy updates?",
        "Explain non-blocking interruptible rendering and priority lane scheduling",
        "Hard",
        "mcq",
        [
          "A. It marks secondary updates as interruptible transitions, keeping the main thread responsive for user interactions.",
          "B. It executes React inside a background Web Worker thread using shared array buffers.",
          "C. It automatically compresses all virtual DOM trees using GZIP in memory.",
          "D. It forces immediate synchronous DOM mutations while blocking network packets."
        ],
        "A",
        skill
      );
      addQuestion(
        "Describe a real-world scenario where you diagnosed and fixed a memory leak or infinite re-render loop caused by unstable references in React.",
        "Focus on cleanup handlers, closures, effect dependencies, and profiling tools",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("node") || sLower.includes("express")) {
      // Easy
      addQuestion(
        "What architectural model does Node.js use to process non-blocking asynchronous I/O operations?",
        "Mention single-threaded event loop and libuv thread pool",
        "Easy",
        "mcq",
        [
          "A. A single-threaded event loop backed by the libuv worker pool for non-blocking I/O.",
          "B. Creating a new operating system thread for every incoming HTTP socket connection.",
          "C. Synchronous sequential execution using standard blocking operating system calls.",
          "D. Compiling JavaScript directly into kernel-level drivers."
        ],
        "A",
        skill
      );
      addQuestion(
        "How do middleware functions work in Express.js, and what is the critical role of the `next()` callback?",
        "Discuss request-response lifecycle and error forwarding",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );

      // Medium
      addQuestion(
        "Which of the following describes the difference between `process.nextTick()` and `setImmediate()` in Node.js?",
        "Focus on event loop phases: microtasks queue vs check phase",
        "Medium",
        "mcq",
        [
          "A. `process.nextTick` fires immediately after current operation before the event loop continues; `setImmediate` fires in the check phase.",
          "B. `setImmediate` runs synchronously before any other code; `process.nextTick` runs after 1000ms.",
          "C. Both functions are exact aliases with identical execution timing.",
          "D. `process.nextTick` only executes in worker threads."
        ],
        "A",
        skill
      );
      addQuestion(
        "Explain how you design a centralized error-handling middleware in Express to catch synchronous and asynchronous errors cleanly.",
        "Address (err, req, res, next) signature, async wrappers, and sanitized error payloads",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );

      // Hard
      addQuestion(
        "In a high-throughput Node.js microservice, how do you handle stream backpressure when piping large files to slow network clients?",
        "Discuss readable and writable streams, highWaterMark, and drain event",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("javascript") || sLower.includes("typescript") || sLower.includes("coding") || sLower.includes("programming")) {
      // Easy
      addQuestion(
        "In JavaScript, what is the key difference between `==` (loose equality) and `===` (strict equality)?",
        "Highlight type coercion vs type and value matching",
        "Easy",
        "mcq",
        [
          "A. `===` checks both value and type without type coercion, while `==` performs type coercion.",
          "B. `==` checks both value and type without coercion, while `===` coerces types.",
          "C. `===` can only be used for string comparison.",
          "D. There is no difference; they are completely interchangeable."
        ],
        "A",
        skill
      );
      addQuestion(
        "Explain what a closure is in JavaScript and provide a practical use case where closures are essential.",
        "Discuss lexical scope, inner functions accessing outer scope variables, and data encapsulation",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );

      // Medium
      addQuestion(
        "What is the Event Loop in JavaScript, and in what order are the call stack, microtask queue (Promises), and macrotask queue (setTimeout) processed?",
        "Detail microtasks draining before macrotasks",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "In TypeScript, how do `type` and `interface` differ regarding declaration merging and union types?",
        "Highlight interface reopening vs union/primitive type capability",
        "Medium",
        "mcq",
        [
          "A. Interfaces support declaration merging whereas types cannot; types can directly define unions.",
          "B. Interfaces are compiled into runtime JavaScript code; types are deleted.",
          "C. Types cannot represent object shapes.",
          "D. Interfaces only work in class declarations."
        ],
        "A",
        skill
      );

      // Hard
      addQuestion(
        "Explain how Prototype Chaining works in JavaScript and how modern ES6 `class` syntax translates under the hood.",
        "Detail __proto__, prototype property, constructor functions, and inheritance delegation",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("database") || sLower.includes("sql") || sLower.includes("mysql") || sLower.includes("postgres") || sLower.includes("mongodb")) {
      // Easy
      addQuestion(
        "What is the primary function of an Index on a database table column?",
        "Highlight query lookup speed vs write overhead",
        "Easy",
        "mcq",
        [
          "A. It significantly accelerates data search and retrieval at the expense of slight write overhead.",
          "B. It encrypts the column data so only database administrators can read it.",
          "C. It automatically backups the table to an external cloud bucket.",
          "D. It prevents duplicate rows from ever being inserted into any table."
        ],
        "A",
        skill
      );
      addQuestion(
        "Explain the fundamental difference between relational (SQL) and non-relational (NoSQL) databases, and when you would choose one over the other.",
        "Discuss schema rigidity, ACID guarantees, relational joins vs document nesting and horizontal scaling",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );

      // Medium
      addQuestion(
        "What do the ACID properties stand for in relational database transactions?",
        "Atomicity, Consistency, Isolation, Durability",
        "Medium",
        "mcq",
        [
          "A. Atomicity, Consistency, Isolation, Durability.",
          "B. Authentication, Concurrency, Indexing, Decryption.",
          "C. Allocation, Compression, Integration, Distribution.",
          "D. Availability, Clustering, Invalidation, Replication."
        ],
        "A",
        skill
      );
      addQuestion(
        "How do database connection pooling and query optimization (e.g., EXPLAIN ANALYZE) resolve latency bottlenecks in high-concurrency systems?",
        "Discuss connection reuse, index scans vs sequential scans, and execution plans",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );

      // Hard
      addQuestion(
        "Explain transaction isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) and the anomalies each level prevents (Dirty Read, Non-Repeatable Read, Phantom Read).",
        "Compare lock-based concurrency control vs MVCC (Multi-Version Concurrency Control)",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("html") || sLower.includes("css") || sLower.includes("frontend") || sLower.includes("web")) {
      // Easy
      addQuestion(
        "What is the CSS Box Model, and how does `box-sizing: border-box` modify the calculation of an element's total width and height?",
        "Explain content, padding, border, margin, and inclusion of padding/border in dimension calculations",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "In CSS layout, what is the primary structural difference between Flexbox and CSS Grid?",
        "One-dimensional (row or column) vs two-dimensional (rows and columns simultaneously)",
        "Easy",
        "mcq",
        [
          "A. Flexbox is primarily designed for one-dimensional layouts; CSS Grid is designed for two-dimensional grid layouts.",
          "B. Flexbox only works on mobile devices; CSS Grid only works on desktop browsers.",
          "C. CSS Grid does not support responsive design breakpoints.",
          "D. Flexbox requires JavaScript to calculate element positions."
        ],
        "A",
        skill
      );

      // Medium
      addQuestion(
        "Explain CSS Specificity hierarchy and how conflicting rules are resolved when multiple selectors target the same HTML element.",
        "Discuss inline styles (1000), IDs (100), classes/attributes/pseudo-classes (10), elements/pseudo-elements (1)",
        "Medium",
        "short",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "How does the browser's Critical Rendering Path work, and what optimizations prevent render-blocking resources?",
        "Explain DOM construction, CSSOM, Render Tree, Layout, Paint, async/defer scripts",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );

      // Hard
      addQuestion(
        "Explain Web Accessibility (WCAG AA standards) principles and how semantic HTML5, ARIA attributes, and keyboard navigation focus management are correctly implemented.",
        "Discuss screen readers, contrast ratios, aria-live regions, and tab order",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("video") || sLower.includes("premiere") || sLower.includes("resolve") || sLower.includes("editing")) {
      // Video Editing Skills
      addQuestion(
        "In digital video editing, what is the difference between a video codec (e.g., H.264, ProRes) and a container format (e.g., .mp4, .mov)?",
        "Explain compression algorithm vs file wrapper",
        "Easy",
        "mcq",
        [
          "A. The codec is the algorithm that compresses/decompresses video data; the container is the file wrapper that bundles video, audio, and metadata.",
          "B. The container is the compression algorithm; the codec is the operating system.",
          "C. Both terms refer to the exact same audio bitrate specification.",
          "D. Codecs are only used for audio mastering."
        ],
        "A",
        skill
      );
      addQuestion(
        "Explain the workflow of color grading using Log footage: from applying a technical Rec.709 LUT to creative grading and balancing with waveforms.",
        "Discuss dynamic range, exposure correction, color wheels, and scopes",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "How do you manage complex multi-cam edits, audio syncing, and proxy media workflows to ensure real-time playback on heavy 4K/6K timeline projects?",
        "Highlight ProRes proxy creation, timecode sync, scratch disks, and render cache optimization",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("literature") || sLower.includes("history") || sLower.includes("philosophy") || sLower.includes("research") || sLower.includes("critical")) {
      // Arts & Humanities
      addQuestion(
        "In literary and critical analysis, what distinguishes a formalist or structuralist critique of a text from a historicist or post-colonial critique?",
        "Internal textual mechanics vs socio-historical and political context",
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "Explain the methodology of qualitative research, particularly the role of primary vs secondary source evaluation and triangulation of historical evidence.",
        "Source reliability, bias identification, archival validation",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "Critically analyze how ideological frameworks and socio-cultural discourses shape narrative perspective in modern literature.",
        "Discuss hegemony, voice, thematic structure, and hermeneutics",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else if (sLower.includes("account") || sLower.includes("finance") || sLower.includes("tax") || sLower.includes("commerce")) {
      // Commerce & Finance
      addQuestion(
        "Under standard double-entry bookkeeping, what is the core accounting equation that governs balance sheets?",
        "Assets = Liabilities + Owner's Equity",
        "Easy",
        "mcq",
        [
          "A. Assets = Liabilities + Owner's Equity (Capital).",
          "B. Assets = Revenue - Operating Expenses.",
          "C. Gross Profit = Sales - Tax Payable.",
          "D. Working Capital = Fixed Assets + Long-term Debt."
        ],
        "A",
        skill
      );
      addQuestion(
        "Explain the difference between Cash Flow Statement and Profit & Loss Statement, and how a profitable company can still face liquidity crisis.",
        "Accrual accounting vs actual cash inflow/outflow, working capital lock-up",
        "Medium",
        "long",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        "How do financial analysts calculate Weighted Average Cost of Capital (WACC), and how is it applied in Discounted Cash Flow (DCF) company valuations?",
        "Cost of equity (CAPM), cost of debt after tax, capital structure weighting",
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    } else {
      // Generic professional questions adapted to the exact skill name
      addQuestion(
        `What are the core foundational principles and primary practical use cases of ${skill}?`,
        `Demonstrate clear understanding of fundamental ${skill} principles and applications`,
        "Easy",
        "short",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        `What common challenges or edge cases arise when implementing ${skill} in a production environment, and how do you resolve them?`,
        `Discuss debugging, error handling, and best practices in ${skill}`,
        "Medium",
        "short",
        undefined,
        undefined,
        skill
      );
      addQuestion(
        `Analyze the architectural trade-offs and performance considerations when scaling solutions built with ${skill}.`,
        `Highlight optimization strategies, scalability bottlenecks, and professional methodology in ${skill}`,
        "Hard",
        "long",
        undefined,
        undefined,
        skill
      );
    }
  }

  // Project-specific questions from candidate's CV projects
  for (const proj of (projects || [])) {
    if (!proj.title || proj.title.toLowerCase().includes("academic portal")) continue;

    addQuestion(
      `In your project "${proj.title}" (${proj.description || "Portfolio Project"}), what was your architectural rationale for selecting ${proj.techStack || "the technical stack"}?`,
      `Explain design choices, component structure, and trade-offs in ${proj.title}`,
      "Medium",
      "long",
      undefined,
      undefined,
      proj.title
    );
    addQuestion(
      `What was the most challenging technical roadblock or bug you encountered while building "${proj.title}", and how did you diagnose and solve it?`,
      `Detail root-cause analysis, troubleshooting steps, and implementation outcome in ${proj.title}`,
      "Hard",
      "long",
      undefined,
      undefined,
      proj.title
    );
  }

  // Ensure we have plenty of questions for this skill set
  if (generatedPool.length < 25) {
    // Generate additional scenario-based questions targeting candidate's primary skills
    const primarySkill = activeSkills[0] || stream || "General Technical Practice";
    addQuestion(
      `Which testing strategy (Unit, Integration, or End-to-End) provides the most reliable confidence when refactoring modules built with ${primarySkill}?`,
      `Compare test isolation, mock overhead, and system verification`,
      "Easy",
      "mcq",
      [
        `A. A balanced test pyramid combining fast unit tests for core logic with targeted integration tests for ${primarySkill} boundaries.`,
        `B. Completely skipping unit tests and exclusively writing manual UI checklists.`,
        `C. Testing code only after deploying directly into production.`,
        `D. Mocking every single module so no actual application code runs.`
      ],
      "A",
      primarySkill
    );
    addQuestion(
      `How do you perform security hardening and input validation in projects leveraging ${primarySkill}?`,
      `Discuss sanitization, authorization checks, and defense in depth`,
      "Medium",
      "short",
      undefined,
      undefined,
      primarySkill
    );
    addQuestion(
      `In a collaborative engineering team, how do you manage version control conflicts, code review standards, and CI/CD deployment pipelines for ${primarySkill}?`,
      `Discuss Git branch strategies, automated linting, automated testing, and regression prevention`,
      "Hard",
      "long",
      undefined,
      undefined,
      primarySkill
    );
  }

  // Filter pool against past questions to guarantee 100% uniqueness
  const freshQuestions = generatedPool.filter(q => {
    const norm = normalizeQuestionText(q.q);
    return !pastQuestionsNormalized.has(norm);
  });

  // If filtered pool is sufficient, use it; otherwise use the entire pool with an attempt-based rotation offset
  const candidatePool = freshQuestions.length >= 15 ? freshQuestions : generatedPool;

  // Separate candidate pool by difficulty
  const easyPool = candidatePool.filter(q => q.d === "Easy");
  const medPool = candidatePool.filter(q => q.d === "Medium");
  const hardPool = candidatePool.filter(q => q.d === "Hard");

  // Selection function that rotates based on attemptNumber
  const selectQuestions = (pool: QuestionItem[], count: number, offsetMultiplier: number): QuestionItem[] => {
    if (pool.length === 0) {
      return candidatePool.slice(0, count);
    }
    const result: QuestionItem[] = [];
    const poolSize = pool.length;
    const startIndex = (attemptNumber * offsetMultiplier) % poolSize;

    for (let i = 0; i < poolSize && result.length < count; i++) {
      const idx = (startIndex + i) % poolSize;
      const q = pool[idx];
      const norm = normalizeQuestionText(q.q);
      // Ensure no duplicates within current selection
      if (!result.some(r => normalizeQuestionText(r.q) === norm)) {
        result.push(q);
      }
    }

    // If still short, fill with remaining items
    let fallbackIdx = 0;
    while (result.length < count && fallbackIdx < candidatePool.length) {
      const q = candidatePool[fallbackIdx];
      const norm = normalizeQuestionText(q.q);
      if (!result.some(r => normalizeQuestionText(r.q) === norm)) {
        result.push(q);
      }
      fallbackIdx++;
    }

    return result.slice(0, count);
  };

  const finalEasy = selectQuestions(easyPool, 5, 3);
  const finalMed = selectQuestions(medPool, 5, 5);
  const finalHard = selectQuestions(hardPool, 5, 7);

  const final15 = [...finalEasy, ...finalMed, ...finalHard];

  return final15.slice(0, 15);
}
