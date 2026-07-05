import express from "express";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Helper to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Fallback questions dictionary for translations when Gemini API hits 429 quota limits
const FALLBACK_TRANSLATIONS: Record<string, {
  bn: { q: string; s: string; options?: string[] };
  hi: { q: string; s: string; options?: string[] };
}> = {
  // Engineering Questions
  "Under high write-concurrency, which distributed database transaction model prevents race conditions without introducing a single point of failure?": {
    bn: {
      q: "উচ্চ রাইট-কনকারেন্সির (write-concurrency) অধীনে, কোন ডিস্ট্রিবিউটেড ডাটাবেস ট্রানজ্যাকশন মডেলটি কোনো সিঙ্গেল পয়েন্ট অফ ফেইলিউর ছাড়াই রেস কন্ডিশন প্রতিরোধ করে?",
      s: "ডিস্ট্রিবিউটেড ট্রানজ্যাকশন, লকিং মেকানিজম এবং কোঅর্ডিনেশন ওভারহেড বিবেচনা করুন।",
      options: [
        "A. সেন্ট্রালাইজড কোঅর্ডিনেটরের সাথে টু-ফেজ কমিট (2PC)",
        "B. ডিসেন্ট্রালাইজড ভ্যালিডেশন এবং Raft কনসেনসাসের সাথে অপটিমিস্টিক কনকারেন্সি কন্ট্রোল (OCC)",
        "C. ট্রানজ্যাকশন লগ ছাড়া সিঙ্গেল-মাস্টার রেপ্লিকেশন",
        "D. সেকেন্ডারি রেপ্লিকাতে সাধারণ টেবিল-লেভেল লকিং"
      ]
    },
    hi: {
      q: "उच्च राइट-कॉन्करेंसी (write-concurrency) के तहत, कौन सा वितरित डेटाबेस ट्रांजेक्शन मॉडल बिना किसी सिंगल पॉइंट ऑफ़ फेलियर के रेस कंडीशंस को रोकता है?",
      s: "वितरित लेनदेन, लॉकिंग तंत्र और समन्वय ओवरहेड पर विचार करें।",
      options: [
        "A. सेंट्रलाइज्ड कोऑर्डिनेटर के साथ टू-फेज कमिट (2PC)",
        "B. डिसेंट्रलाइज्ड वैलिडेशन और Raft कंसेंसस के साथ ऑप्टिमिस्टिक कॉन्करेंसी कंट्रोल (OCC)",
        "C. ट्रांजेक्शन लॉग के बिना सिंगल-मास्टर रेप्लिकेशन",
        "D. सेकेंडरी रेप्लिका में साधारण टेबल-लेवल लॉकिंग"
      ]
    }
  },
  "Explain the architectural difference and memory trade-offs between implementing an asynchronous task worker with a ring-buffer vs a lock-free linked list queue.": {
    bn: {
      q: "রিং-বাফার বনাম লক-ফ্রি লিঙ্কড লিস্ট কিউ-এর মাধ্যমে একটি অ্যাসিঙ্ক্রোনাস টাস্ক ওয়ার্কার বাস্তবায়নের আর্কিটেকচারাল পার্থক্য এবং মেমরি ট্রেড-অফ ব্যাখ্যা করুন।",
      s: "বাউন্ডেড/আনবাউন্ডেড মেমরি ফুটপ্রিন্ট, ক্যাশ-লোকালিটি এবং CPU অ্যাটমিক অপারেশনগুলির তুলনা করুন।"
    },
    hi: {
      q: "रिंग-बफर बनाम लॉक-फ्री लिंक्ड लिस्ट कतार (lock-free linked list queue) के माध्यम से एक एसिंक्रोनस टास्क वर्कर को लागू करने के बीच आर्किटेक्चरल अंतर और मेमोरी ट्रेड-ऑफ को समझाएं।",
      s: "बाउंडेड/अनबाउंडेड मेमोरी फ़ुटप्रिंट, कैश-लोकेलिटी और सीपीयू एटॉमिक ऑपरेशन्स की तुलना करें।"
    }
  },
  "Explain the advantages and architectural trade-offs of designing a multi-region distributed system with eventual consistency vs strong consistency.": {
    bn: {
      q: "ইভেনচুয়াল কনসিস্টেন্সি (eventual consistency) বনাম স্ট্রং কনসিস্টেন্সি (strong consistency) সহ একটি মাল্টি-রিজিয়ন ডিস্ট্রিবিউটেড সিস্টেম ডিজাইনের সুবিধা এবং আর্কিটেকচারাল ট্রেড-অফ ব্যাখ্যা করুন।",
      s: "CAP থিওরেমের সীমাবদ্ধতা, রাইট লেটেন্সি, সিঙ্ক রেপ্লিকেশন এবং ডাটাবেস বিভাজন হাইলাইট করুন।"
    },
    hi: {
      q: "इवेन्चुअल कंसिस्टेंसी (eventual consistency) बनाम स्ट्रांग कंसिस्टेंसी के साथ एक मल्टी-रीजन वितरित सिस्टम को डिजाइन करने के फायदे और आर्किटेक्चरल ट्रेड-ऑफ को समझाएं।",
      s: "CAP प्रमेय की सीमाओं, राइट लेटेंसी, सिंक रेप्लिकेशन और डेटाबेस विभाजन को उजागर करें।"
    }
  },
  "When a security audit flags a JWT-based session architecture for susceptibility to token replay attacks, which mitigation strategy is most secure?": {
    bn: {
      q: "যখন কোনো সিকিউরিটি অডিট টোকেন রিপ্লে অ্যাটাকের ঝুঁকির কারণে একটি JWT-ভিত্তিক সেশন আর্কিটেকচারকে চিহ্নিত করে, তখন কোন প্রশমন কৌশলটি সবচেয়ে নিরাপদ?",
      s: "স্ট্যান্ডার্ড এক্সপায়ারেশন এবং অ্যাক্টিভ ভ্যালিডেশন প্রযুক্তির মধ্যে পার্থক্য করুন।",
      options: [
        "A. টোকেনের মেয়াদ কমিয়ে ৫ মিনিট করা",
        "B. টোকেন রোটেশন সহ Redis রেভোকেশন লিস্ট দ্বারা সমর্থিত শর্ট-লিভড অ্যাক্সেস টোকেন এবং স্লাইডিং রিফ্রেশ টোকেন ব্যবহার করা",
        "C. ব্রাউজারের লোকাল স্টোরেজে JWT সংরক্ষণ করা",
        "D. একটি পাবলিক RSA কী দিয়ে JWT পেলোড এনক্রিপ্ট করা"
      ]
    },
    hi: {
      q: "जब एक सुरक्षा ऑडिट टोकन रीप्ले हमलों की संवेदनशीलता के लिए JWT-आधारित सत्र आर्किटेक्चर को ध्वजांकित करता है, तो कौन सी शमन रणनीति सबसे सुरक्षित है?",
      s: "मानक समाप्ति और सक्रिय सत्यापन तकनीकों के बीच अंतर करें।",
      options: [
        "A. बस टोकन समाप्ति अवधि को 5 मिनट तक कम करना",
        "B. Redis रिवोकेशन सूची द्वारा समर्थित शॉर्ट-लिव्ड एक्सेस टोकन और स्लाइडिंग रिफ्रेश टोकन के साथ टोकन रोटेशन लागू करना",
        "C. ब्राउज़र के स्थानीय स्टोरेज में JWT को संग्रहीत करना",
        "D. एक सार्वजनिक RSA कुंजी के साथ JWT पेलोड को एन्क्रिप्ट करना"
      ]
    }
  },
  "Explain the exact performance impact, lock escalation behavior, and deadlock mitigation strategy when switching from optimistic concurrency control (OCC) to pessimistic locking in a high-concurrency PostgreSQL database.": {
    bn: {
      q: "একটি হাই-কনকারেন্সি PostgreSQL ডাটাবেসে অপটিমিস্টিক কনকারেন্সি কন্ট্রোল (OCC) থেকে পেসিমিস্টিক লকিংয়ে স্যুইচ করার সময় সুনির্দিষ্ট পারফরম্যান্স প্রভাব, লক এসকেলেশন আচরণ এবং ডেডলক প্রশমন কৌশল ব্যাখ্যা করুন।",
      s: "লক-ফ্রি ভার্সন চেকের সাথে SELECT FOR UPDATE-এর মতো অ্যাক্টিভ রো-লেভেল লকের তুলনা করুন।"
    },
    hi: {
      q: "एक उच्च-कॉन्करेंसी PostgreSQL डेटाबेस में ऑप्टिमिस्टिक कॉन्करेंसी कंट्रोल (OCC) से पेसिमिस्टिक लॉकिंग में स्विच करते समय सटीक प्रदर्शन प्रभाव, लॉक एस्केलेशन व्यवहार और डेडलॉक शमन रणनीति को समझाएं।",
      s: "सक्रिय रो-लेवल लॉक जैसे SELECT FOR UPDATE के साथ लॉक-मुक्त संस्करण जांच की तुलना करें।"
    }
  },
  "Design a fault-tolerant and highly scalable microservices pipeline for high-throughput file parsing, detailing rate-limiting, message queues, and horizontal scaling.": {
    bn: {
      q: "হাই-থ্রুপুট ফাইল পার্সিংয়ের জন্য একটি ফল্ট-টলারেন্ট এবং অত্যন্ত স্কেলযোগ্য মাইক্রোসার্ভিস পাইপলাইন ডিজাইন করুন, যেখানে রেট-লিমিটিং, মেসেজ কিউ এবং হরাইজন্টাল স্কেলিং বিস্তারিত থাকবে।",
      s: "API গেটওয়ে, রেট-লিমিটার (টোকেন বাকেট), পাব-সাব কিউ এবং ওয়ার্কার অটো-স্কেলিং নিয়ে আলোচনা করুন।"
    },
    hi: {
      q: "हाई-थ्रूपुट फ़ाइल पार्सिंग के लिए एक फॉल्ट-टोलरेंट और अत्यधिक स्केलेबल माइक्रोसर्विसेज पाइपलाइन डिजाइन करें, जिसमें रेट-लिमिटिंग, संदेश कतारों और क्षैतिज स्केलिंग (horizontal scaling) का विवरण हो।",
      s: "API गेटवे, रेट-लिमिटर (टोकन बकेट), पब-सब कतारों और वर्कर ऑटो-स्केलिंग पर चर्चा करें।"
    }
  },
  "In distributed databases, which of the following is represented by the PACELC theorem as an extension of the CAP theorem?": {
    bn: {
      q: "ডিস্ট্রিবিউটেড ডাটাবেসে, নিচের কোনটি CAP থিওরেমের সম্প্রসারণ হিসেবে PACELC থিওরেম দ্বারা উপস্থাপিত হয়?",
      s: "পার্টিশন না থাকার সময় লেটেন্সি এবং কনসিস্টেন্সির ট্রেড-অফ সনাক্ত করুন।",
      options: [
        "A. Partition, Availability, Consistency, Else Latency, Consistency",
        "B. Performance, Availability, Cache, Else Load, Capacity",
        "C. Asynchronous, Coherent, Encryption, Else Durable, Decoupled",
        "D. Parallelism, Active-active, Consensus, Else Replay, Validation"
      ]
    },
    hi: {
      q: "वितरित डेटाबेस में, CAP प्रमेय के विस्तार के रूप में निम्नलिखित में से किसे PACELC प्रमेय द्वारा दर्शाया जाता है?",
      s: "विभाजन न होने पर लेटेंसी और निरंतरता (consistency) के बीच के ट्रेड-ऑफ की पहचान करें।",
      options: [
        "A. Partition, Availability, Consistency, Else Latency, Consistency",
        "B. Performance, Availability, Cache, Else Load, Capacity",
        "C. Asynchronous, Coherent, Encryption, Else Durable, Decoupled",
        "D. Parallelism, Active-active, Consensus, Else Replay, Validation"
      ]
    }
  },
  "Explain the CAP theorem and discuss its implications for distributed database systems, highlighting how NoSQL databases choose between AP and CP.": {
    bn: {
      q: "CAP থিওরেমটি ব্যাখ্যা করুন এবং ডিস্ট্রিবিউটেড ডাটাবেস সিস্টেমে এর প্রভাব আলোচনা করুন, নো-এসকিউএল (NoSQL) ডাটাবেসগুলি কীভাবে AP এবং CP-এর মধ্যে বেছে নেয় তা হাইলাইট করুন।",
      s: "ডিস্ট্রিবিউটেড ডাটা সিস্টেমে কনসিস্টেন্সি, অ্যাভেইল্যাবিলিটি এবং পার্টিশন টলারেন্সের ট্রেড-অফ তুলনা করুন।"
    },
    hi: {
      q: "CAP प्रमेय की व्याख्या करें और वितरित डेटाबेस सिस्टम के लिए इसके निहितार्थों पर चर्चा करें, यह उजागर करते हुए कि NoSQL डेटाबेस AP और CP के बीच कैसे चुनते हैं।",
      s: "वितरित डेटा प्रणालियों में कंसिस्टेंसी, उपलब्धता और विभाजन सहिष्णुता के ट्रेड-ऑफ की तुलना करें।"
    }
  },
  "Detail the system architecture of a scalable, fault-tolerant real-time notification system capable of supporting 10 million concurrent WebSocket connections.": {
    bn: {
      q: "১০ মিলিয়ন সমবর্তী (concurrent) WebSocket সংযোগ সমর্থন করতে সক্ষম একটি স্কেলযোগ্য, ফল্ট-টলারেন্ট রিয়েল-টাইম নোটিফিকেশন সিস্টেমের সিস্টেম আর্কিটেকচার বিস্তারিত বর্ণনা করুন।",
      s: "WebSockets/SSE, পাব/সাব কিউ (Redis/Kafka), লোড ব্যালেন্সিং এবং কানেকশন-পিনিং ব্যাকএন্ড নিয়ে আলোচনা করুন।"
    },
    hi: {
      q: "10 मिलियन समवर्ती (concurrent) वेबसॉकेट कनेक्शनों का समर्थन करने में सक्षम स्केलेबल, फॉल्ट-टोलरेंट रीयल-टाइम नोटिफिकेशन सिस्टम के सिस्टम आर्किटेक्चर का विवरण दें।",
      s: "वेबसॉकेट/एसएसई, पब/सब कतारों (रेडिस/काफका), लोड संतुलन और कनेक्शन-पिनिंग बैकएंड पर चर्चा करें।"
    }
  },
  "Discuss a challenging project from your resume. What was the most critical performance bottleneck or memory leak you encountered, and how did you diagnose and resolve it under load?": {
    bn: {
      q: "আপনার সিভির একটি চ্যালেঞ্জিং প্রজেক্ট নিয়ে আলোচনা করুন। আপনি সেখানে কোন পারফরম্যান্স বোতলনেক বা মেমরি লিকের সম্মুখীন হয়েছিলেন এবং কীভাবে লোডের অধীনে তা নির্ণয় ও সমাধান করেছিলেন?",
      s: "STAR পদ্ধতি ব্যবহার করুন, সুনির্দিষ্ট প্রোফাইলিং, মেমরি হিপ ডাম্প টুল এবং আর্কিটেকচারাল পরিবর্তনগুলি উল্লেখ করুন।"
    },
    hi: {
      q: "अपने बायोडाटा से एक चुनौतीपूर्ण प्रोजेक्ट पर चर्चा करें। सबसे महत्वपूर्ण प्रदर्शन बाधा (bottleneck) या मेमोरी लीक क्या था जिसका आपने सामना किया, और लोड के तहत आपने इसका निदान और समाधान कैसे किया?",
      s: "STAR विधि का उपयोग करें, सटीक प्रोफाइलिंग, मेमोरी हीप डंप टूल और आर्किटेक्चरल परिवर्तनों का हवाला दें।"
    }
  },
  "Which of the following database normal forms (NF) specifically addresses eliminating transitive dependencies on non-prime attributes?": {
    bn: {
      q: "নিচের কোন ডাটাবেস নরমাল ফর্ম (NF) বিশেষ করে নন-প্রাইম অ্যাট্রিবিউটগুলির ট্রানজিটিভ ডিপেনডেন্সি দূর করার কাজ করে?",
      s: "ট্রানজিটিভ ফাংশনাল ডিপেনডেন্সি দূর করে এমন নরমাল ফর্মটি সনাক্ত করুন।",
      options: [
        "A. ফার্স্ট নরমাল ফর্ম (1NF)",
        "B. সেকেন্ড নরমাল ফর্ম (2NF)",
        "C. থার্ড নরমাল ফর্ম (3NF)",
        "D. বয়েস-কড নরমাল ফর্ম (BCNF)"
      ]
    },
    hi: {
      q: "निम्नलिखित में से कौन सा डेटाबेस नॉर्मल फॉर्म (NF) विशेष रूप से नॉन-प्राइम एट्रिब्यूट्स पर सकर्मक निर्भरता (transitive dependencies) को समाप्त करने से संबंधित है?",
      s: "उस सामान्य रूप की पहचान करें जो सकर्मक कार्यात्मक निर्भरता को समाप्त करता है।",
      options: [
        "A. First Normal Form (1NF)",
        "B. Second Normal Form (2NF)",
        "C. Third Normal Form (3NF)",
        "D. Boyce-Codd Normal Form (BCNF)"
      ]
    }
  },
  "Briefly explain the purpose, routing algorithms, and health-checking mechanisms of a Layer 7 Load Balancer in modern web architectures.": {
    bn: {
      q: "আধুনিক ওয়েব আর্কিটেকচারে লেয়ার ৭ লোড ব্যালেন্সারের উদ্দেশ্য, রাউটিং অ্যালগরিদম এবং হেলথ-চেকিং মেকানিজম সংক্ষেপে ব্যাখ্যা করুন।",
      s: "রিভার্স প্রক্সি, অ্যাপ্লিকেশন লেয়ারে (HTTP/HTTPS) রিকোয়েস্ট রাউটিং এবং সার্ভার пулিং নিয়ে আলোচনা করুন।"
    },
    hi: {
      q: "आधुनिक वेब आर्किटेक्चर में लेयर 7 लोड बैलेंसर के उद्देश्य, राउटिंग एल्गोरिदम और स्वास्थ्य-जांच (health-checking) तंत्र को संक्षेप में समझाएं।",
      s: "रिवर्स प्रॉक्सी, एप्लिकेशन लेयर (HTTP/HTTPS) पर आने वाले अनुरोधों को रूट करने और सर्वर पूलिंग की व्याख्या करें।"
    }
  },
  "Explain the architectural differences, payload overhead, and API versioning strategies when choosing between RESTful APIs, GraphQL, and gRPC.": {
    bn: {
      q: "RESTful API, GraphQL এবং gRPC-এর মধ্যে নির্বাচন করার সময় তাদের আর্কিটেকচারাল পার্থক্য, পেলোড ওভারহেড এবং API ভার্সনিং কৌশলগুলি ব্যাখ্যা করুন।",
      s: "ফিক্সড এন্ডপয়েন্ট বনাম ক্লায়েন্ট-সংজ্ঞায়িত কোয়েরি এবং প্রোটোকল বাফারের বাইনারি সিরিয়ালাইজেশন তুলনা করুন।"
    },
    hi: {
      q: "RESTful API, GraphQL और gRPC के बीच चयन करते समय आर्किटेक्चरल अंतर, पेलोड ओवरहेड और API वर्जनिंग रणनीतियों की व्याख्या करें।",
      s: "निश्चित एंडपॉइंट्स बनाम क्लाइंट-परिभाषित क्वेरी और प्रोटोकॉल बफ़र्स के बाइनरी सीरियलाइजेशन की तुलना करें।"
    }
  },
  "Describe the primary architectural benefits, index structures, and consistency trade-offs of using a Document Store (like MongoDB) over a Relational Database.": {
    bn: {
      q: "একটি রিলেশনাল ডাটাবেসের তুলনায় ডকুমেন্ট স্টোর (যেমন MongoDB) ব্যবহারের মূল আর্কিটেকচারাল সুবিধা, ইনডেক্স স্ট্রাকচার এবং কনসিস্টেন্সি ট্রেড-অফ বর্ণনা করুন।",
      s: "স্কিমা নমনীয়তা এবং অনুভূমিক বিভাজন (sharding) এর সাথে ট্রানজ্যাকশনাল ACID সীমাবদ্ধতার তুলনা করুন।"
    },
    hi: {
      q: "रिलेशनल डेटाबेस पर दस्तावेज़ स्टोर (जैसे MongoDB) का उपयोग करने के प्राथमिक आर्किटेक्चरल लाभों, इंडेक्स संरचनाओं और निरंतरता (consistency) ट्रेड-ऑफ का वर्णन करें।",
      s: "लेन-देन संबंधी ACID बाधाओं के साथ स्कीमा लचीलेपन और क्षैतिज विभाजन (sharding) की तुलना करें।"
    }
  },
  "What is the primary objective of implementing a Write-Ahead Log (WAL) in modern transactional database engines?": {
    bn: {
      q: "আধুনিক ট্রানজ্যাকশনাল ডাটাবেস ইঞ্জিনে রাইট-অ্যাহেড লগ (WAL) বাস্তবায়নের মূল উদ্দেশ্য কী?",
      s: "স্থায়িত্ব, পুনরুদ্ধার এবং অ্যাটমিসিটির ওপর ফোকাস করা বৈশিষ্ট্যটি সনাক্ত করুন।",
      options: [
        "A. বি-ট্রি ইনডেক্স ব্যবহার করে রিড কোয়েরি পারফরম্যান্স ত্বরান্বিত করা",
        "B. ডাটা পেজে পরিবর্তন প্রয়োগের আগে পরিবর্তনগুলি লগ করে স্থায়িত্ব এবং ট্রানজ্যাকশন রিকভারি (ACID) নিশ্চিত করা",
        "C. রিডান্ডেন্ট এন্ট্রি এড়াতে টেবিল নরমালাইজ করা",
        "D. একাধিক ক্লাউড নোড জুড়ে ডাটাবেস পার্টিশনগুলি স্বয়ংক্রিয়ভাবে বিতরণ করা"
      ]
    },
    hi: {
      q: "आधुनिक ट्रांजेक्शनल डेटाबेस इंजन में राइट-अहेड लॉग (WAL) को लागू करने का प्राथमिक उद्देश्य क्या है?",
      s: "टिकाऊपन, पुनर्प्राप्ति और परमाणुता (atomicity) पर ध्यान केंद्रित करने वाले मुख्य लक्षण की पहचान करें।",
      options: [
        "A. बी-ट्री इंडेक्स का उपयोग करके रीड क्वेरी प्रदर्शन को तेज करना",
        "B. डेटा पेजों में परिवर्तन लागू करने से पहले संशोधनों को लॉग करके स्थायित्व और लेनदेन पुनर्प्राप्ति (ACID) सुनिश्चित करना",
        "C. अनावश्यक प्रविष्टियों से बचने के लिए तालिकाओं को सामान्य बनाना",
        "D. स्वचालित रूप से कई क्लाउड नोड्स में डेटाबेस विभाजन वितरित करना"
      ]
    }
  },
  "Detail the steps, security practices, and deployment strategies (e.g. blue-green, canary) for establishing a secure, automated CI/CD pipeline.": {
    bn: {
      q: "একটি নিরাপদ এবং স্বয়ংক্রিয় CI/CD পাইপলাইন প্রতিষ্ঠার জন্য প্রয়োজনীয় পদক্ষেপ, নিরাপত্তা অনুশীলন এবং ডেপ্লয়মেন্ট কৌশলগুলি (যেমন blue-green, canary) বিস্তারিত লিখুন।",
      s: "স্বয়ংক্রিয় টেস্টিং, স্ট্যাটিক কোড অ্যানালিসিস (SAST), সিক্রেট ম্যানেজমেন্ট এবং জিরো-ডাউনটাইম আপডেট নিয়ে আলোচনা করুন।"
    },
    hi: {
      q: "एक सुरक्षित, स्वचालित CI/CD पाइपलाइन स्थापित करने के लिए चरणों, सुरक्षा प्रथाओं और परिनियोजन रणनीतियों (जैसे ब्लू-ग्रीन, कैनरी) का विवरण दें।",
      s: "स्वचालित परीक्षण, स्थिर कोड विश्लेषण (SAST), रहस्य प्रबंधन और शून्य-डाउनटाइम रोलिंग अपडेट पर चर्चा करें।"
    }
  },

  // Medical Questions
  "In an adult patient experiencing refractory ventricular fibrillation cardiac arrest, which medication and dosage is indicated following the third shock?": {
    bn: {
      q: "ভেন্ট্রিকুলার ফিব্রিলেশন কার্ডিয়াক অ্যারেস্টে আক্রান্ত একজন প্রাপ্তবয়স্ক রোগীর ক্ষেত্রে, ৩য় শকের পর কোন ওষুধ এবং সঠিক ডোজ দেওয়া উচিত?",
      s: "সঠিক ACLS নির্দেশিকা অনুযায়ী অপশনটি বেছে নিন।",
      options: [
        "A. অ্যামিওডারোন ৩০০ মিলিগ্রাম IV/IO বোলাস",
        "B. এপিনেফ্রিন ১ মিলিগ্রাম IV/IO",
        "C. লিডোকেন ১০০ মিলিগ্রাম IV/IO",
        "D. ভ্যাসোপ্রেসিন ৪০ ইউনিট IV/IO"
      ]
    },
    hi: {
      q: "रिफ्रैक्टरी वेंट्रिकुलर फाइब्रिलेशन कार्डियक अरेस्ट से पीड़ित एक वयस्क रोगी में, तीसरे शॉक के बाद कौन सी दवा और सही खुराक दी जानी चाहिए?",
      s: "स्वर्ण-मानक ACLS दिशानिर्देशों के अनुसार सही विकल्प चुनें।",
      options: [
        "A. एमीओडैरोन 300mg IV/IO बोलस",
        "B. एपिनेफ्रीन 1mg IV/IO",
        "C. लिडोकेन 100mg IV/IO",
        "D. वैसोप्रेसिन 40 यूनिट IV/IO"
      ]
    }
  },
  "Outline the clinical criteria, diagnostic markers, and blood gas thresholds used to distinguish between Type 1 and Type 2 Acute Respiratory Distress Syndrome (ARDS) in an intensive care setting.": {
    bn: {
      q: "আইসিইউ (ICU) পরিবেশে টাইপ ১ এবং টাইপ ২ অ্যাকিউট রেসপিরেটরি ডিস্ট্রেস সিন্ড্রোম (ARDS) এর মধ্যে পার্থক্য করার জন্য ক্লিনিকাল মানদণ্ড, ডায়াগনস্টিক মার্কার এবং ব্লাড গ্যাস থ্রেশহোল্ডগুলি রূপরেখা করুন।",
      s: "PaO2/FiO2 অনুপাত, ইতিবাচক শেষ-নিঃশ্বাসের চাপ (PEEP), এবং সিস্টেমিক ইনফ্ল্যামেটরি মার্কারগুলি উল্লেখ করুন।"
    },
    hi: {
      q: "आईसीयू सेटिंग में टाइप 1 और टाइप 2 एक्यूट रेस्पिरेटरी डिस्ट्रेस सिंड्रोम (ARDS) के बीच अंतर करने के लिए उपयोग किए जाने वाले नैदानिक ​​मानदंडों, नैदानिक ​​​​संकेतकों और रक्त गैस सीमाओं की रूपरेखा तैयार करें।",
      s: "PaO2/FiO2 अनुपात, सकारात्मक अंत-श्वसन दबाव (PEEP), और प्रणालीगत भड़काऊ संकेतकों का उल्लेख करें।"
    }
  },
  "Explain how you would handle an emergency department patient presenting with acute ischemic stroke symptoms. Detail your timeline, diagnostics, and thrombolytic inclusion/exclusion criteria.": {
    bn: {
      q: "অ্যাকিউট ইসকেমিক স্ট্রোকের লক্ষণ নিয়ে ইমার্জেন্সি বিভাগে আসা একজন রোগীকে আপনি কীভাবে পরিচালনা করবেন? আপনার টাইমলাইন, ডায়াগনস্টিকস এবং থ্রোম্বোলাইটিক অন্তর্ভুক্তির মানদণ্ড বিস্তারিত ব্যাখ্যা করুন।",
      s: "'Time is Brain' ধারণাটি প্রয়োগ করুন এবং সিটি স্ক্যান ও থ্রোম্বোলাইটিক ইন্ডিকেশন সংক্ষেপে লিখুন।"
    },
    hi: {
      q: "तीव्र इस्केमिक स्ट्रोक के लक्षणों के साथ आपातकालीन विभाग में आने वाले रोगी को आप कैसे संभालेंगे? अपनी समयरेखा, निदान और थ्रोम्बोलाइटिक समावेशन/बहिष्करण मानदंडों का विवरण दें।",
      s: "'टाइम इज ब्रेन' की अवधारणा को लागू करें और सीटी स्कैन और थ्रोम्बोलाइटिक संकेतों की रूपरेखा तैयार करें।"
    }
  },
  "What is the primary mechanism of action of Sodium-Glucose Cotransporter 2 (SGLT2) inhibitors, and why are they cardioprotective in heart failure patients?": {
    bn: {
      q: "সোডিয়াম-গ্লুকোজ কোট্রান্সপোর্টার ২ (SGLT2) ইনহিবিটরগুলির মূল কাজ কী এবং হার্ট ফেইলিউর রোগীদের ক্ষেত্রে এগুলি কেন কার্ডিওপ্রোটেক্টিভ?",
      s: "রেনাল গ্লুকোজ পুনরায় শোষণ রোধ করে হার্টের প্রিলোড ও আফটারলোড কমানো ব্যাখ্যা করুন।",
      options: [
        "A. রেনাল গ্লুকোজ পুনরায় শোষণ রোধ করে অসমোটিক ডিউরিসিস প্রচার এবং কার্ডিয়াক আফটারলোড হ্রাস করা",
        "B. অগ্ন্যাশয় বিটা কোষ থেকে সরাসরি ইনসুলিন নিঃসরণ উদ্দীপিত করা",
        "C. হেপাটিক গ্লুকোনোজেনেসিস বাধা দেওয়া এবং ইনসুলিন প্রতিরোধ ক্ষমতা কমানো",
        "D. পাকস্থলী খালি হতে বিলম্ব করা এবং কার্বোহাইড্রেট শোষণ ধীর করা"
      ]
    },
    hi: {
      q: "सोडियम-ग्लूकोज कोट्रांसपोर्टर 2 (SGLT2) अवरोधकों की मुख्य क्रिया प्रणाली क्या है, और वे दिल की विफलता के रोगियों में हृदय सुरक्षात्मक क्यों हैं?",
      s: "गुर्दे द्वारा ग्लूकोज के अवशोषण को रोकने और दिल के प्रिलोड/आफ्टरलोड को कम करने वाला उत्तर चुनें।",
      options: [
        "A. गुर्दे द्वारा ग्लूकोज के अवशोषण को रोकना, आसमाटिक ड्यूरिसिस को बढ़ावा देना और हृदय के बाद के लोड को कम करना",
        "B. सीधे अग्नाशयी बीटा कोशिकाओं से इंसुलिन की रिहाई को उत्तेजित करना",
        "C. यकृत ग्लूकोनोजेनेसिस को रोकना और इंसुलिन प्रतिरोध को कम करना",
        "D. गैस्ट्रिक खाली होने में देरी करना और आंत में कार्बोहाइड्रेट के अवशोषण को धीमा करना"
      ]
    }
  },

  // Legal Questions
  "Under modern legal principles, which of the following elements is strictly required to establish the defense of 'promissory estoppel' in a commercial dispute?": {
    bn: {
      q: "বাণিজ্যিক বিরোধে 'প্রমিসরি এস্টোপেল' (promissory estoppel) এর প্রতিরক্ষা প্রতিষ্ঠার জন্য নিচের কোন উপাদানটি কঠোরভাবে প্রয়োজন?",
      s: "স্পষ্ট উপস্থাপনা, যুক্তিসঙ্গত নির্ভরতা এবং ক্ষতির প্রতিনিধিত্বকারী অপশনটি চিহ্নিত করুন।",
      options: [
        "A. একটি পূর্ব-বিদ্যমান চুক্তিভিত্তিক সম্পর্ক এবং পারস্পরিক আর্থিক সুবিধা",
        "B. একটি স্পষ্ট এবং দ্ব্যর্থহীন প্রতিশ্রুতি, যুক্তিসঙ্গত নির্ভরতা এবং নিজের ক্ষতি সাধন করে অবস্থানের পরিবর্তন",
        "C. একজন পাবলিক নোটারির সামনে সম্পাদিত একটি লিখিত দলিল",
        "D. সমস্ত বিধিবদ্ধ অধিকার এবং সুবিধার সম্পূর্ণ মওকুফ"
      ]
    },
    hi: {
      q: "एक व्यावसायिक विवाद में 'वचन विबंध' (promissory estoppel) के बचाव को स्थापित करने के लिए निम्नलिखित में से कौन सा तत्व सख्ती से आवश्यक है?",
      s: "स्पष्ट प्रतिनिधित्व, उचित निर्भरता और नुकसान का प्रतिनिधित्व करने वाले विकल्प की पहचान करें।",
      options: [
        "A. एक पूर्व-मौजूदा संविदात्मक संबंध और पारस्परिक वित्तीय लाभ",
        "B. एक स्पष्ट और अकाट्य वादा, उचित निर्भरता और अपने नुकसान के लिए स्थिति में बदलाव",
        "C. एक सार्वजनिक नोटरी के समक्ष निष्पादित एक लिखित विलेख (deed)",
        "D. सभी वैधानिक अधिकारों और विशेषाधिकारों की पूर्ण छूट"
      ]
    }
  },
  "Briefly explain the legal doctrine of 'Res Sub-Judice' and its application in civil litigation procedure.": {
    bn: {
      q: "দেওয়ানি মামলা কার্যবিধিতে 'রেস সাব-জুডিস' (Res Sub-Judice) এর আইনি মতবাদ এবং এর প্রয়োগ সংক্ষেপে ব্যাখ্যা করুন।",
      s: "একই পক্ষ/বিষয় এবং বিচার বিভাগীয় দক্ষতার জন্য সমান্তরাল বিচার স্থগিত করার বিষয়টি হাইলাইট করুন।"
    },
    hi: {
      q: "दीवानी मुकदमेबाजी प्रक्रिया में 'रेस सब-जूडिस' (Res Sub-Judice) के कानूनी सिद्धांत और उसके अनुप्रयोग को संक्षेप में समझाएं।",
      s: "समान पक्षों/मामलों के लिए बाद के समानांतर मुकदमों पर रोक और न्यायिक दक्षता को उजागर करें।"
    }
  },
  "Detail the essential requirements for establishing a legally binding contract, and explain the legal status of an agreement made under coercion or undue influence.": {
    bn: {
      q: "একটি আইনগতভাবে বাধ্যতামূলক চুক্তি প্রতিষ্ঠার জন্য প্রয়োজনীয় শর্তগুলি বিস্তারিত লিখুন এবং জোরপূর্বক বা অন্যায় প্রভাবের অধীনে করা চুক্তির আইনি স্থিতি ব্যাখ্যা করুন।",
      s: "প্রস্তাব, গ্রহণযোগ্যতা, আইনি বিবেচনা, সক্ষমতা, স্বাধীন সম্মতি এবং বাতিলযোগ্য স্থিতি উল্লেখ করুন।"
    },
    hi: {
      q: "एक कानूनी रूप से बाध्यकारी अनुबंध स्थापित करने के लिए आवश्यक आवश्यकताओं का विवरण दें, और जबरदस्ती (coercion) या अनुचित प्रभाव के तहत किए गए समझौते की कानूनी स्थिति की व्याख्या करें।",
      s: "प्रस्ताव, स्वीकृति, कानूनी प्रतिफल, क्षमता, स्वतंत्र सहमति और अमान्य करने योग्य (voidable) स्थिति का उल्लेख करें।"
    }
  },

  // General Questions
  "In corporate financial evaluation, which capital allocation metric is most reliable for comparing projects of differing lifetimes and capital scales?": {
    bn: {
      q: "কর্পোরেট আর্থিক মূল্যায়নে, বিভিন্ন জীবনকাল এবং মূলধন স্কেলের প্রকল্পগুলির তুলনা করার জন্য কোন ক্যাপিটাল অ্যালোকেশন মেট্রিকটি সবচেয়ে নির্ভরযোগ্য?",
      s: "নেট প্রেজেন্ট ভ্যালু (NPV), ইন্টারনাল রেট অফ রিটার্ন (IRR) এবং ইকুইভ্যালেন্ট অ্যানুয়াল অ্যানুইটি তুলনা করুন।",
      options: [
        "A. ইন্টারনাল রেট অফ রিটার্ন (IRR)",
        "B. নেট প্রেজেন্ট ভ্যালু (NPV) এবং ইকুইভ্যালেন্ট অ্যানুয়াল অ্যানুইটি (EAA)",
        "C. সাধারণ পে-ব্যাক পিরিয়ড",
        "D. অ্যাকাউন্টিং রেট অফ রিটার্ন (ARR)"
      ]
    },
    hi: {
      q: "कॉर्पोरेट वित्तीय मूल्यांकन में, विभिन्न जीवनकाल और पूंजीगत पैमाने की परियोजनाओं की तुलना करने के लिए कौन सा पूंजी आवंटन मीट्रिक सबसे विश्वसनीय है?",
      s: "शुद्ध वर्तमान मूल्य (NPV), रिटर्न की आंतरिक दर (IRR), और समकक्ष वार्षिक वार्षिकी (EAA) की तुलना करें।",
      options: [
        "A. रिटर्न की आंतरिक दर (IRR)",
        "B. शुद्ध वर्तमान मूल्य (NPV) और समकक्ष वार्षिक वार्षिकी (EAA)",
        "C. सरल पेबैक अवधि",
        "D. लेखांकन रिटर्न दर (ARR)"
      ]
    }
  },
  "Explain how the 'Ansoff Matrix' guides enterprise-level growth strategies, and the structural risks of pursuing a diversification strategy.": {
    bn: {
      q: "'অ্যানসফ ম্যাট্রিক্স' কীভাবে এন্টারপ্রাইজ-স্তরের প্রবৃদ্ধি কৌশলগুলিকে নির্দেশ করে এবং ডাইভারসিফিকেশন কৌশল অনুসরণের কাঠামোগত ঝুঁকিগুলি ব্যাখ্যা করুন।",
      s: "মার্কেট পেনিট্রেশন, মার্কেট ডেভেলপমেন্ট, প্রোডাক্ট ডেভেলপমেন্ট এবং ডাইভারসিফিকেশনের ঝুঁকিগুলি তুলনা করুন।"
    },
    hi: {
      q: "समझाएं कि 'एन्सॉफ मैट्रिक्स' (Ansoff Matrix) उद्यम-स्तर की विकास रणनीतियों का मार्गदर्शन कैसे करता है, और विविविधीकरण (diversification) रणनीति को आगे बढ़ाने के संरचनात्मक जोखिम क्या हैं।",
      s: "बाजार में पैठ, बाजार विकास, उत्पाद विकास और विविधीकरण जोखिमों की तुलना करें।"
    }
  },
  "Describe how you would design and implement a comprehensive change management initiative at a 5,000-employee enterprise undergoing a digital ERP transition.": {
    bn: {
      q: "ডিজিটাল ইআরপি (ERP) রূপান্তরের মধ্য দিয়ে যাওয়া ৫০০০ কর্মচারীর একটি প্রতিষ্ঠানে আপনি কীভাবে একটি বিস্তৃত পরিবর্তন পরিচালনা (change management) উদ্যোগ ডিজাইন এবং বাস্তবায়ন করবেন?",
      s: "স্টেকহোল্ডার বাই-ইন, ট্রেনিং রোডম্যাপ, যোগাযোগ এবং ঝুঁকি প্রশমন হাইলাইট করুন।"
    },
    hi: {
      q: "डिजिटल ईआरपी (ERP) परिवर्तन से गुजर रहे 5,000 कर्मचारियों के उद्यम में आप एक व्यापक परिवर्तन प्रबंधन (change management) पहल को कैसे डिजाइन और कार्यान्वित करेंगे?",
      s: "हितधारकों के समर्थन (stakeholder buy-in), प्रशिक्षण रोडमैप, संचार और जोखिम शमन को उजागर करें।"
    }
  }
};

// Translate fallback question helper function
function translateQuestion(qObj: any, language: string): any {
  if (!language || language === "English") return qObj;
  
  const originalQ = qObj.q;
  const translation = FALLBACK_TRANSLATIONS[originalQ];
  if (!translation) return qObj; // If no translation exists, return as is

  const langKey = language === "Bengali" ? "bn" : "hi";
  const tData = translation[langKey];
  if (!tData) return qObj;

  return {
    ...qObj,
    q: tData.q || qObj.q,
    s: tData.s || qObj.s,
    options: tData.options || qObj.options
  };
}

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Parse JSON bodies (up to 15MB for base64 file uploads)
app.use(express.json({ limit: "15mb" }));

// Initialize TiDB Cloud MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.TIDB_HOST || "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
  user: process.env.TIDB_USER || "4JfwUQJNVeMWMwH.root",
  password: process.env.TIDB_PASSWORD || "YSnA67L0zPtow1eP",
  database: process.env.TIDB_DATABASE || "test",
  port: parseInt(process.env.TIDB_PORT || "4000", 10),
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Bootstrap MySQL Database tables
async function initDB() {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to TiDB Cloud MySQL database successfully.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        qualification VARCHAR(255),
        institution VARCHAR(255),
        stream VARCHAR(255),
        is_admin TINYINT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS resumes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255),
        skills TEXT,
        detailed_analysis LONGTEXT,
        file_base64 LONGTEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        qualification VARCHAR(255),
        stream VARCHAR(255),
        skills TEXT,
        questions LONGTEXT,
        answers LONGTEXT,
        scores LONGTEXT,
        overall_score INT,
        percentage INT,
        final_grade VARCHAR(255),
        performance_level VARCHAR(255),
        strengths LONGTEXT,
        development_areas LONGTEXT,
        summary LONGTEXT,
        feedback LONGTEXT,
        date_created VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    connection.release();
    console.log("MySQL Relational Database tables initialized successfully.");
  } catch (error: any) {
    console.error("CRITICAL error initializing MySQL database:", error);
    // Do not crash the process immediately, allow server to run and show connection errors
  }
}

// Lazy initialization of Gemini Client
let aiClient: GoogleGenerativeAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will fallback to simulated data.");
      return null;
    }
    aiClient = new GoogleGenerativeAI(apiKey);
  }
  return aiClient;
}

// Robust fallback Gemini generator helper to completely solve 404 model errors
async function generateContentWithFallback(
  ai: GoogleGenerativeAI,
  prompt: string | any[],
  isJson: boolean = false
): Promise<string> {
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const generationConfig = isJson ? { responseMimeType: "application/json" } : undefined;

      let response;
      if (Array.isArray(prompt)) {
        response = await model.generateContent({
          contents: prompt,
          generationConfig
        });
      } else {
        response = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig
        });
      }

      if (response && response.response) {
        const text = response.response.text();
        if (text) return text;
      }
    } catch (err: any) {
      console.warn(`Gemini generation failed with model ${modelName}:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini model attempts failed.");
}

// Helper to handle SQL queries safely (now asynchronous for MySQL)
const getUserById = async (id: number | string) => {
  try {
    const [rows]: any = await pool.execute("SELECT * FROM users WHERE id = ?", [Number(id)]);
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`Error in getUserById for user ${id}:`, error);
    return null;
  }
};

// ================= API ENDPOINTS =================

// User Registration
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, qualification, institution, stream } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    const [result]: any = await pool.execute(`
      INSERT INTO users (name, email, password, qualification, institution, stream, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `, [
      name,
      email,
      password,
      qualification || "B.A. (Hons.)",
      institution || "SVU",
      stream || "Education (Arts)"
    ]);

    const newUser = {
      id: result.insertId,
      name,
      email,
      qualification: qualification || "B.A. (Hons.)",
      institution: institution || "SVU",
      stream: stream || "Education (Arts)"
    };

    return res.status(201).json({ message: "Registration successful!", user: newUser });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")) || (error.message && error.message.includes("UNIQUE constraint failed"))) {
      return res.status(400).json({ error: "Email is already registered. Please login." });
    }
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const [rows]: any = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    const userByEmail = rows && rows.length > 0 ? rows[0] : null;

    if (!userByEmail) {
      return res.status(401).json({ error: "No account found with this email address. Please register first." });
    }

    if (userByEmail.password !== password) {
      return res.status(401).json({ error: "Incorrect password! Please double-check your password and try again." });
    }

    const user = userByEmail;

    if (user.is_admin === 1) {
      return res.status(200).json({
        needs2FA: true,
        message: "Admin authentication detected. Please verify security code."
      });
    }

    return res.status(200).json({
      message: "Login successful!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        qualification: user.qualification,
        institution: user.institution,
        stream: user.stream,
        is_admin: 0
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Helper to get valid verification codes (DDMMYY format) for current date
function getValidAdminCodes() {
  const codes: string[] = [];
  const dLocal = new Date();
  
  // Local code
  const ddLocal = String(dLocal.getDate()).padStart(2, "0");
  const mmLocal = String(dLocal.getMonth() + 1).padStart(2, "0");
  const yyLocal = String(dLocal.getFullYear()).slice(-2);
  codes.push(`${ddLocal}${mmLocal}${yyLocal}`);
  
  // UTC code
  const ddUTC = String(dLocal.getUTCDate()).padStart(2, "0");
  const mmUTC = String(dLocal.getUTCMonth() + 1).padStart(2, "0");
  const yyUTC = String(dLocal.getUTCFullYear()).slice(-2);
  codes.push(`${ddUTC}${mmUTC}${yyUTC}`);
  
  // Asia/Kolkata code
  try {
    const kolkataString = dLocal.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const dKolkata = new Date(kolkataString);
    const ddK = String(dKolkata.getDate()).padStart(2, "0");
    const mmK = String(dKolkata.getMonth() + 1).padStart(2, "0");
    const yyK = String(dKolkata.getFullYear()).slice(-2);
    codes.push(`${ddK}${mmK}${yyK}`);
  } catch (err) {}

  return Array.from(new Set(codes));
}

// Admin Registration
app.post("/api/auth/register-admin", async (req, res) => {
  const { name, email, password, code } = req.body;

  if (!name || !email || !password || !code) {
    return res.status(400).json({ error: "All fields and verification code are required." });
  }

  const validCodes = getValidAdminCodes();
  if (!validCodes.includes(code.trim())) {
    return res.status(400).json({ error: "Admin Identity Verification failed. Code is invalid for current date." });
  }

  try {
    const [result]: any = await pool.execute(`
      INSERT INTO users (name, email, password, qualification, institution, stream, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [name, email, password, "Lead Architect", "SVU", "Elite Command"]);

    const newUser = {
      id: result.insertId,
      name,
      email,
      qualification: "Lead Architect",
      institution: "SVU",
      stream: "Elite Command",
      is_admin: 1
    };

    return res.status(201).json({ message: "Admin Registration successful!", user: newUser });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")) || (error.message && error.message.includes("UNIQUE constraint failed"))) {
      return res.status(400).json({ error: "Email is already registered." });
    }
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Admin Verify Login
app.post("/api/auth/verify-admin-login", async (req, res) => {
  const { email, password, code } = req.body;

  if (!email || !password || !code) {
    return res.status(400).json({ error: "Credentials and verification code are required." });
  }

  const validCodes = getValidAdminCodes();
  if (!validCodes.includes(code.trim())) {
    return res.status(401).json({ error: "Security code validation failed. Code is invalid for current date." });
  }

  try {
    const [rows]: any = await pool.execute(
      "SELECT * FROM users WHERE email = ? AND password = ? AND is_admin = 1",
      [email, password]
    );
    const user = rows && rows.length > 0 ? rows[0] : null;

    if (!user) {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }

    return res.status(200).json({
      message: "Admin Access Granted!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        qualification: user.qualification,
        institution: user.institution,
        stream: user.stream,
        is_admin: 1
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Serve ChAIL signature image
app.get("/api/assets/chail-signature", (_req, res) => {
  try {
    const signaturePath = path.join(process.cwd(), "src/assets/images/sayantik_chail_sig_1782897123530.jpg");
    res.sendFile(signaturePath);
  } catch (err: any) {
    res.status(500).send("Failed to load signature asset: " + err.message);
  }
});

// Fetch Admin Dashboard Data
app.get("/api/admin/data", async (_req, res) => {
  try {
    const [students]: any = await pool.execute("SELECT id, name, email, qualification, institution, stream FROM users WHERE is_admin = 0 OR is_admin IS NULL");
    const [resumes]: any = await pool.execute("SELECT id, user_id, filename, skills, detailed_analysis FROM resumes");
    const [interviews]: any = await pool.execute("SELECT id, user_id, qualification, stream, skills, questions, answers, scores, overall_score, percentage, final_grade, performance_level, strengths, development_areas, summary, feedback, date_created FROM interviews");
    const [admins]: any = await pool.execute("SELECT id, name, email FROM users WHERE is_admin = 1");

    return res.status(200).json({
      students,
      resumes,
      interviews,
      admins
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch admin dashboard data: " + error.message });
  }
});

// Get Resume File
app.get("/api/admin/resume/:userId/file", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid User ID." });
  }
  try {
    const [rows]: any = await pool.execute("SELECT filename, file_base64 FROM resumes WHERE user_id = ?", [userId]);
    const resume = rows && rows.length > 0 ? rows[0] : null;

    if (!resume) {
      return res.status(404).json({ error: "Resume file not found for this user." });
    }
    return res.status(200).json({
      filename: resume.filename,
      fileBase64: resume.file_base64 || ""
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Delete Student
app.delete("/api/admin/student/:id", async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  if (isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student ID format." });
  }
  try {
    await pool.execute("DELETE FROM interviews WHERE user_id = ?", [studentId]);
    await pool.execute("DELETE FROM resumes WHERE user_id = ?", [studentId]);
    await pool.execute("DELETE FROM users WHERE id = ? AND (is_admin = 0 OR is_admin IS NULL)", [studentId]);

    return res.status(200).json({ message: "Student and all associated data deleted successfully." });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to delete student: " + error.message });
  }
});

// Delete Interview Session
app.delete("/api/admin/interview/:id", async (req, res) => {
  const interviewId = parseInt(req.params.id, 10);
  if (isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview ID format." });
  }
  try {
    await pool.execute("DELETE FROM interviews WHERE id = ?", [interviewId]);
    return res.status(200).json({ message: "Interview session deleted successfully." });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to delete interview: " + error.message });
  }
});

// Delete Admin Registration
app.delete("/api/admin/admin-user/:id", async (req, res) => {
  const adminId = parseInt(req.params.id, 10);
  if (isNaN(adminId)) {
    return res.status(400).json({ error: "Invalid admin ID format." });
  }
  try {
    const [rows]: any = await pool.execute("SELECT COUNT(*) as count FROM users WHERE is_admin = 1");
    const adminCount = rows && rows.length > 0 ? rows[0].count : 0;

    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot delete the last remaining administrator." });
    }

    const [result]: any = await pool.execute("DELETE FROM users WHERE id = ? AND is_admin = 1", [adminId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Admin not found or already deleted." });
    }

    return res.status(200).json({ message: "Admin registration deleted successfully." });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to delete admin: " + error.message });
  }
});

// Update Profile details
app.post("/api/auth/update-profile", async (req, res) => {
  const { userId, qualification, institution, stream } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }
  try {
    await pool.execute(`
      UPDATE users 
      SET qualification = ?, institution = ?, stream = ?
      WHERE id = ?
    `, [qualification, institution, stream, userId]);

    const updatedUser = await getUserById(userId);
    return res.status(200).json({ message: "Profile updated successfully!", user: updatedUser });
  } catch (error: any) {
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Resume parsing and Skill detection
app.post("/api/resume/analyze", async (req, res) => {
  const { userId, filename, fileBase64 } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    const ai = getGeminiClient();
    const user = await getUserById(userId);

    const lowerName = (filename || "").toLowerCase();
    // Since the user requested to stop strict validation checking, we disable the strict ID keyword check
    const isIdKeyword = false;

    if (isIdKeyword) {
      return res.status(400).json({
        error: "Government ID detected. Please upload a real Resume/CV. / এটি একটি পরিচয়পত্র। অনুগ্রহ করে রেজুমে বা সিভি আপলোড করুন।",
        invalidResume: true
      });
    }

    // Build smart, dynamic fallback analysis based on filename and existing profile keywords
    const streamFromProfile = (user?.stream || "").toLowerCase();
    const qualFromProfile = (user?.qualification || "").toLowerCase();
    const isMedical = lowerName.includes("doctor") || lowerName.includes("medical") || lowerName.includes("nurse") || lowerName.includes("pharma") || lowerName.includes("mbbs") || lowerName.includes("health") || lowerName.includes("clinical") || lowerName.includes("hospital") || lowerName.includes("dentist") || lowerName.includes("bds") || lowerName.includes("md") ||
                      streamFromProfile.includes("doctor") || streamFromProfile.includes("medical") || streamFromProfile.includes("mbbs") || streamFromProfile.includes("nursing") || streamFromProfile.includes("pharma") || streamFromProfile.includes("dentist") || streamFromProfile.includes("health") || qualFromProfile.includes("mbbs") || qualFromProfile.includes("md") || qualFromProfile.includes("bds");
    
    const isLegal = lowerName.includes("lawyer") || lowerName.includes("law") || lowerName.includes("legal") || lowerName.includes("llb") || lowerName.includes("llm") || lowerName.includes("advocate") || lowerName.includes("court") || lowerName.includes("judicial") ||
                    streamFromProfile.includes("law") || streamFromProfile.includes("legal") || streamFromProfile.includes("llb") || streamFromProfile.includes("court") || streamFromProfile.includes("advocate") || qualFromProfile.includes("llb") || qualFromProfile.includes("llm");

    let fallbackSkills = [
      { name: "HTML & CSS", level: 92 },
      { name: "JavaScript", level: 85 },
      { name: "Communication", level: 88 },
      { name: "Problem Solving", level: 78 }
    ];

    let fallbackAnalysis = {
      skills: fallbackSkills,
      detectedStream: "Computer Science & Engineering",
      detectedQualification: "B.Tech",
      detectedInstitution: "Swami Vivekananda University",
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
        detectedInstitution: "Swami Vivekananda University",
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
        detectedInstitution: "Swami Vivekananda University",
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

    let parsedAnalysis = fallbackAnalysis;

    if (ai && fileBase64) {
      try {
        let mimeType = "text/plain";
        if (lowerName.endsWith(".pdf")) {
          mimeType = "application/pdf";
        } else if (lowerName.endsWith(".png")) {
          mimeType = "image/png";
        } else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
          mimeType = "image/jpeg";
        } else if (lowerName.endsWith(".webp")) {
          mimeType = "image/webp";
        } else if (lowerName.endsWith(".txt")) {
          mimeType = "text/plain";
        }

        const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;

        const inlinePart = {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        };

        const textPrompt = `You are ChAIL AI Resume Analyzer. Given the uploaded document, analyze it as a professional or academic profile and extract technical skills, academic branch (stream), qualification degree, key subjects, and projects. 
             Do not perform any verification of whether it is a "real" resume or reject it. Always treat it as valid.
             Assign realistic proficiency levels (65% to 98%) based on their background.
             
             Format the output strictly as a single JSON object (with no enclosing markdown code blocks, no comments, no extra text):
             {
               "isValidResume": true,
               "skills": [
                 {"name": "React", "level": 90},
                 {"name": "Node.js", "level": 82},
                 {"name": "Database Management", "level": 78},
                 {"name": "Communication", "level": 88}
               ],
               "detectedStream": "The major branch or stream of study, e.g., 'Computer Science & Engineering', 'Information Technology', 'Civil Engineering', 'Management', etc. Use proper capitalized name",
               "detectedQualification": "The qualification degree detected, e.g., 'B.Tech', 'M.Tech CSE', 'BCA', 'MCA', 'B.Sc Physics', etc.",
               "detectedInstitution": "The name of the academic institution or university of their last or highest qualification, e.g. 'Swami Vivekananda University', 'Techno India', 'Calcutta University', etc. (If not clearly mentioned, use 'Swami Vivekananda University')",
               "keySubjects": ["Core academic courses or technical subjects mentioned or implied, e.g., Data Structures, Operating Systems, Financial Management"],
               "keyProjects": [
                 {
                   "title": "Project Title",
                   "description": "Short summary of project scope, features, and their role",
                   "techStack": "Technologies used, e.g., React, Python, Flask"
                 }
               ],
               "knowledgeDepth": "A short 1-2 sentence description summarizing their technical depth, expertise, and conceptual understanding.",
               "careerDomain": "Primary corporate role/domain matching their profile, e.g., Full Stack Development, Data Engineering, Business Analyst, etc."
             }`;

        const rawText = await generateContentWithFallback(ai, [inlinePart, textPrompt], true);
        
        let parsed;
        try {
          // Clean the markdown wrapping if any
          let cleanedText = rawText.trim();
          if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
          }
          parsed = JSON.parse(cleanedText);
        } catch (pe) {
          console.error("Failed to parse Gemini JSON (falling back):", rawText);
          throw new Error("Could not parse AI response.");
        }

        if (parsed && typeof parsed === "object") {
          parsedAnalysis = {
            skills: Array.isArray(parsed.skills) ? parsed.skills : fallbackSkills,
            detectedStream: parsed.detectedStream || user?.stream || "Computer Science",
            detectedQualification: parsed.detectedQualification || user?.qualification || "B.Tech",
            detectedInstitution: parsed.detectedInstitution || user?.institution || "Swami Vivekananda University",
            keySubjects: Array.isArray(parsed.keySubjects) ? parsed.keySubjects : ["Core Academics"],
            keyProjects: Array.isArray(parsed.keyProjects) ? parsed.keyProjects : [],
            knowledgeDepth: parsed.knowledgeDepth || "Demonstrated professional and academic competency.",
            careerDomain: parsed.careerDomain || "General Technology"
          };
        }
      } catch (aiError: any) {
        console.error("Gemini Resume Analysis failed (falling back to default analysis):", aiError);
        // We do not block the user with a 400 error. Instead, we gracefully fall back to fallbackAnalysis
        parsedAnalysis = fallbackAnalysis;
      }
    }

    // Auto-update user profile stream and qualification based on resume!
    if (parsedAnalysis.detectedStream || parsedAnalysis.detectedQualification) {
      const q = parsedAnalysis.detectedQualification || user?.qualification || "B.Tech";
      const s = parsedAnalysis.detectedStream || user?.stream || "Computer Science";
      await pool.execute("UPDATE users SET qualification = ?, stream = ? WHERE id = ?", [q, s, userId]);
    }

    // Save/Update in MySQL resumes table
    const [existingRows]: any = await pool.execute("SELECT id FROM resumes WHERE user_id = ?", [userId]);
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;
    const skillsString = JSON.stringify(parsedAnalysis.skills);
    const detailedString = JSON.stringify(parsedAnalysis);

    if (existing) {
      await pool.execute(
        "UPDATE resumes SET filename = ?, skills = ?, detailed_analysis = ?, file_base64 = ? WHERE user_id = ?",
        [filename || "resume.pdf", skillsString, detailedString, fileBase64 || "", userId]
      );
    } else {
      await pool.execute(
        "INSERT INTO resumes (user_id, filename, skills, detailed_analysis, file_base64) VALUES (?, ?, ?, ?, ?)",
        [userId, filename || "resume.pdf", skillsString, detailedString, fileBase64 || ""]
      );
    }

    return res.status(200).json({
      message: "Resume parsed and profile updated successfully!",
      filename: filename || "resume.pdf",
      skills: parsedAnalysis.skills,
      analysis: parsedAnalysis
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to analyze resume: " + error.message });
  }
});

// Question Generation based on skills and background
app.post("/api/interview/questions", async (req, res) => {
  const { userId, language = "English" } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    const user = await getUserById(userId);
    const [resumeRows]: any = await pool.execute("SELECT * FROM resumes WHERE user_id = ?", [userId]);
    const resumeRecord = resumeRows && resumeRows.length > 0 ? resumeRows[0] : null;
    
    // Retrieve all unique previously asked questions for this user to avoid repetitions
    let pastQuestionsList: string[] = [];
    try {
      const [pastInterviews]: any = await pool.execute("SELECT questions FROM interviews WHERE user_id = ?", [userId]);
      if (pastInterviews && pastInterviews.length > 0) {
        const uniqueQuestions = new Set<string>();
        pastInterviews.forEach((row: any) => {
          try {
            const list = JSON.parse(row.questions || "[]");
            if (Array.isArray(list)) {
              list.forEach((q: string) => {
                if (q && q.trim()) {
                  uniqueQuestions.add(q.trim());
                }
              });
            }
          } catch (e) {}
        });
        pastQuestionsList = Array.from(uniqueQuestions);
      }
    } catch (dbErr) {
      console.error("Failed to query past questions:", dbErr);
    }

    let pastQuestionsRule = "";
    if (pastQuestionsList.length > 0) {
      pastQuestionsRule = `
        
        CRITICAL NO-REPEAT RULE (DO NOT ASK THESE QUESTIONS):
        The student has already answered the following questions in past practice sessions. Under no circumstances should you repeat these questions or generate highly similar variations. You MUST ask completely different questions covering other concepts, tasks, scenarios, or sub-topics:
        ${pastQuestionsList.map((q, idx) => `${idx + 1}. "${q}"`).join("\n")}
        
        Make sure the new 10 questions are entirely unique and have zero overlap with the above list.`;
    }

    let analysis: any = null;
    if (resumeRecord && resumeRecord.detailed_analysis) {
      try {
        analysis = JSON.parse(resumeRecord.detailed_analysis);
      } catch (e) {
        // Fallback parsed from basic fields
      }
    }

    const qualification = user?.qualification || "B.Tech";
    const stream = user?.stream || "Computer Science";
    const skillsList = resumeRecord ? JSON.parse(resumeRecord.skills) : [];
    const skillsString = skillsList.map((s: any) => s.name).join(", ") || "General Technical Concepts, Software Engineering, Coding";

    const subjectsString = (analysis && analysis.keySubjects) ? analysis.keySubjects.join(", ") : "Database Management, Data Structures & Algorithms, Network Security";
    const projectDetails = (analysis && analysis.keyProjects && analysis.keyProjects.length > 0) 
      ? analysis.keyProjects.map((p: any) => `"${p.title}" (${p.description}, stack: ${p.techStack})`).join("; ")
      : "academic portal development";

    const lowerStream = stream.toLowerCase();
    const lowerQual = qualification.toLowerCase();
    const isMedical = lowerStream.includes("doctor") || lowerStream.includes("medical") || lowerStream.includes("mbbs") || lowerStream.includes("nursing") || lowerStream.includes("pharma") || lowerStream.includes("dentist") || lowerStream.includes("health") || lowerQual.includes("mbbs") || lowerQual.includes("md") || lowerQual.includes("bds");
    const isLegal = lowerStream.includes("law") || lowerStream.includes("legal") || lowerStream.includes("llb") || lowerStream.includes("court") || lowerStream.includes("advocate") || lowerQual.includes("llb") || lowerQual.includes("llm");
    const isEngineering = lowerStream.includes("computer") || lowerStream.includes("engineer") || lowerStream.includes("tech") || lowerStream.includes("bca") || lowerStream.includes("mca") || lowerStream.includes("software") || lowerQual.includes("b.tech") || lowerQual.includes("m.tech") || lowerQual.includes("bca") || lowerQual.includes("mca");

    let fallbackQuestions = [];
    if (isMedical) {
      fallbackQuestions = [
        { q: "In an adult patient experiencing refractory ventricular fibrillation cardiac arrest, which medication and dosage is indicated following the third shock?", s: "Select the correct option representing gold-standard ACLS guidelines.", d: "Easy", type: "mcq", options: ["A. Amiodarone 300mg IV/IO bolus", "B. Epinephrine 1mg IV/IO", "C. Lidocaine 100mg IV/IO", "D. Vasopressin 40 units IV/IO"] },
        { q: "Outline the clinical criteria, diagnostic markers, and blood gas thresholds used to distinguish between Type 1 and Type 2 Acute Respiratory Distress Syndrome (ARDS) in an intensive care setting.", s: "Mention PaO2/FiO2 ratio, positive end-expiratory pressure (PEEP), and systemic inflammatory indicators.", d: "Easy", type: "short" },
        { q: "Explain how you would handle an emergency department patient presenting with acute ischemic stroke symptoms. Detail your timeline, diagnostics, and thrombolytic inclusion/exclusion criteria.", s: "Apply the 'Time is Brain' concept and outline CT scan timing and thrombolytic indications.", d: "Easy", type: "long" },
        { q: "What is the primary mechanism of action of Sodium-Glucose Cotransporter 2 (SGLT2) inhibitors, and why are they cardioprotective in heart failure patients?", s: "Select the answer explaining renal sodium excretion and reduction in cardiac preload/afterload.", d: "Medium", type: "mcq", options: ["A. Inhibiting renal glucose reabsorption, promoting osmotic diuresis and lowering cardiac afterload", "B. Stimulating insulin release from pancreatic beta cells directly", "C. Inhibiting hepatic gluconeogenesis and decreasing cellular insulin resistance", "D. Delaying gastric emptying and carbohydrate absorption in the gut"] },
        { q: "Describe the immediate pharmacological sequence and clinical interventions required to manage a patient in suspected thyroid storm.", s: "Highlight beta-blockers, propylthiouracil/methimazole, iodine solutions, and corticosteroids sequence.", d: "Medium", type: "short" },
        { q: "Detail the clinical management steps and fluid resuscitation protocol (e.g. Parkland Formula) for a pediatric patient presenting with 35% total body surface area (TBSA) deep thermal burns.", s: "Mention fluid calculations, urine output targets, and monitoring for compartment syndrome.", d: "Medium", type: "long" },
        { q: "Which of the following ECG changes is classically considered a pathognomonic diagnostic indicator of progressive severe Hyperkalemia?", s: "Identify the correct ECG wave alteration matching high potassium levels.", d: "Medium", type: "mcq", options: ["A. Peaked symmetric T waves, prolonged PR interval, and widening of the QRS complex", "B. ST-segment elevation with reciprocal depression", "C. Pathological Q waves and T-wave inversion", "D. Shortened QT interval with prominent U waves"] },
        { q: "Outline the clinical features, diagnostic workup, and pharmacotherapeutic preparation (alpha/beta blockade sequence) for suspected Pheochromocytoma.", s: "Detail 24-hour metanephrines, CT/MRI localization, and why alpha-blockade must precede beta-blockade.", d: "Hard", type: "short" },
        { q: "Describe the clinical diagnostic criteria (Sepsis-3) and the first-hour resuscitation bundle for a patient presenting with suspected septic shock.", s: "Mention lactate level tracking, blood cultures, broad-spectrum antibiotics, fluid challenges, and vasopressors.", d: "Hard", type: "long" },
        { q: "How do you approach communicating a difficult, life-limiting diagnosis or terminal prognosis to a patient and their family? Discuss your bioethical and communication frameworks.", s: "Describe communication protocols like SPIKES to handle high-emotion doctor-patient scenarios.", d: "Hard", type: "long" },
        { q: "What is the primary emergency clinical intervention to take when a patient shows acute systemic anaphylaxis following intravenous antibiotic administration?", s: "Detail immediate cessation, intramuscular epinephrine administration, and airway protection.", d: "Easy", type: "short" },
        { q: "Which of the following classes of antihypertensive drugs is absolutely contraindicated in pregnancy due to risks of fetal renal dysgenesis?", s: "Select the class known to cause severe fetal abnormalities.", d: "Medium", type: "mcq", options: ["A. Beta-blockers", "B. Calcium Channel Blockers", "C. ACE Inhibitors and Angiotensin II Receptor Blockers (ARBs)", "D. Centrally acting Alpha-2 Agonists"] },
        { q: "Describe the pathophysiology, diagnostic laboratory findings, and immediate fluid/electrolyte correction strategy for Diabetic Ketoacidosis (DKA).", s: "Detail anion gap metabolic acidosis, potassium shifts, fluid deficits, and insulin infusion rates.", d: "Medium", type: "short" },
        { q: "Explain the standard clinical protocol for managing a patient presenting with an acute exacerbation of COPD.", s: "Detail oxygenation targets, nebulized bronchodilators, systemic corticosteroids, and non-invasive ventilation indications.", d: "Hard", type: "long" },
        { q: "Identify the primary hormone excess and diagnostic screening tests (e.g. dexamethasone suppression) for Cushing's Syndrome.", s: "Identify the hormone produced by the adrenal cortex and cortisol suppression pathways.", d: "Easy", type: "mcq", options: ["A. Excess Aldosterone", "B. Excess Cortisol", "C. Excess Thyroxine", "D. Excess Epinephrine"] },
        { q: "Explain the differential diagnosis, clinical presentation, and initial management differences between Tension Pneumothorax and Cardiac Tamponade.", s: "Contrast breath sounds, tracheal deviation, Beck's triad, and needle decompression vs pericardiocentesis.", d: "Medium", type: "long" },
        { q: "Describe how you would approach a pediatric patient presenting with high fever, neck stiffness, and non-blanching purpuric rash.", s: "Detail physical tests like Brudzinski/Kernig, immediate blood cultures, lumbar puncture, and empiric antibiotics.", d: "Hard", type: "long" }
      ];
    } else if (isLegal) {
      fallbackQuestions = [
        { q: "Under modern legal principles, which of the following elements is strictly required to establish the defense of 'promissory estoppel' in a commercial dispute?", s: "Identify the option representing clear representation, reasonable reliance, and detriment.", d: "Easy", type: "mcq", options: ["A. A pre-existing contractual relationship and mutual pecuniary benefit", "B. A clear and unambiguous promise, reasonable reliance, and alteration of position to one's detriment", "C. A written deed executed before a public notary", "D. A complete waiver of all statutory rights and privileges"] },
        { q: "Briefly explain the legal doctrine of 'Res Sub-Judice' and its application in civil litigation procedure.", s: "Highlight stay of subsequent parallel trials, same parties/matter, and judicial efficiency.", d: "Easy", type: "short" },
        { q: "Detail the essential requirements for establishing a legally binding contract, and explain the legal status of an agreement made under coercion or undue influence.", s: "Mention offer, acceptance, lawful consideration, capacity, free consent, and voidable status.", d: "Easy", type: "long" },
        { q: "Which of the following constitutional provisions guarantees procedural due process, protection against double jeopardy, and the right against self-incrimination?", s: "Identify the pivotal fundamental right defending accused individuals.", d: "Medium", type: "mcq", options: ["A. Article 14 (Equality before Law)", "B. Article 19 (Freedom of Speech)", "C. Article 20 and Article 21 (Protection of Life and Personal Liberty)", "D. Article 32 (Constitutional Remedies)"] },
        { q: "Explain the doctrine of 'Res Judicata' in civil procedure, highlighting the distinction between 'constructive' and 'actual' res judicata.", s: "Highlight bars on re-litigation of issues that were or ought to have been raised.", d: "Medium", type: "short" },
        { q: "Draft an argumentative strategy for a commercial client accused of breach of contract where the counterparty claims exorbitant liquidated damages. What defenses would you raise?", s: "Detail force majeure, mitigation of damages, penalty clauses, and actual loss proof requirements.", d: "Medium", type: "long" },
        { q: "What does the Latin legal maxim 'Actus non facit reum nisi mens sit rea' literally translate to in criminal jurisprudence?", s: "Identify the translation that links physical act with the requirement of a guilty mind.", d: "Medium", type: "mcq", options: ["A. The act itself makes a person guilty without further proof", "B. An act does not make a person guilty unless the mind is also guilty", "C. Ignorance of law is not an excuse for illegal conduct", "D. Nobody should be a judge in their own legal cause"] },
        { q: "Differentiate between 'Common Intention' and 'Common Object' under joint criminal liability principles.", s: "Mention pre-arranged plan and meeting of minds vs prior membership of an unlawful assembly.", d: "Hard", type: "short" },
        { q: "Explain the 'Basic Structure Doctrine' of constitutional law and outline its landmark judicial origins.", s: "Discuss Kesavananda Bharati v. State of Kerala, structural limits on parliamentary amending power, and core features.", d: "Hard", type: "long" },
        { q: "Describe a complex legal dispute where you had to research precedent and draft pleadings under a tight deadline. How did you structure the brief?", s: "Focus on ratio decidendi extraction, IRAC methodology, and procedural compliance.", d: "Hard", type: "long" },
        { q: "Which of the following constitutes admissible 'Hearsay Evidence' under statutory exceptions to the evidence law?", s: "Select the option explaining statements made out-of-court that are accepted under strict exceptions.", d: "Easy", type: "mcq", options: ["A. A casual rumor reported by a third-party witness", "B. A dying declaration made by a victim regarding the cause of death", "C. An unsigned anonymous letter found at the scene", "D. An out-of-court statement offered solely to prove the witness's memory"] },
        { q: "Briefly explain the legal doctrine of 'Caveat Emptor' in commercial sale contracts and state its primary modern exceptions.", s: "Explain buyer beware, duty of reasonable inspection, and exceptions like implied fitness for purpose.", d: "Easy", type: "short" },
        { q: "What is the fundamental legal distinction between a 'Cognizable Offense' and a 'Non-Cognizable Offense'?", s: "Discuss arrest without warrant capabilities, police obligation to register FIR, and court permissions.", d: "Medium", type: "short" },
        { q: "Explain the doctrine of 'Pith and Substance' in constitutional interpretation when resolving legislative competence disputes.", s: "Discuss looking at true nature and character of legislation when it overlaps between state/central lists.", d: "Medium", type: "short" },
        { q: "Which landmark judicial precedent established the 'Rarest of Rare Cases' doctrine for imposing death penalty?", s: "Recall the critical Supreme Court precedent governing sentencing discretion guidelines.", d: "Hard", type: "mcq", options: ["A. Maneka Gandhi v. Union of India", "B. Bachan Singh v. State of Punjab", "C. Keshvananda Bharati v. State of Kerala", "D. Vishaka v. State of Rajasthan"] },
        { q: "Detail the legal steps, remedies, and primary defenses available in a civil suit for Defamation.", s: "Mention publication, reference to plaintiff, damage, absolute vs qualified privilege, and truth/justification.", d: "Hard", type: "long" }
      ];
    } else if (isEngineering) {
      fallbackQuestions = [
        { q: "Under high write-concurrency, which distributed database transaction model prevents race conditions without introducing a single point of failure?", s: "Consider distributed transactions, locking mechanisms, and coordination overhead.", d: "Easy", type: "mcq", options: ["A. Two-Phase Commit (2PC) with centralized coordinator", "B. Optimistic Concurrency Control (OCC) with decentralized validation and Raft consensus", "C. Single-master replication without transaction logs", "D. Simple table-level locking in a secondary replica"] },
        { q: "Explain the architectural difference and memory trade-offs between implementing an asynchronous task worker with a ring-buffer vs a lock-free linked list queue.", s: "Contrast bounded/unbounded memory footprints, cache-locality, and CPU atomic operations.", d: "Easy", type: "short" },
        { q: "Explain the advantages and architectural trade-offs of designing a multi-region distributed system with eventual consistency vs strong consistency.", s: "Highlight CAP theorem constraints, write latency, sync replication, and database division.", d: "Easy", type: "long" },
        { q: "When a security audit flags a JWT-based session architecture for susceptibility to token replay attacks, which mitigation strategy is most secure?", s: "Distinguish between standard expiration and active validation techniques.", d: "Medium", type: "mcq", options: ["A. Simply reducing token expiry duration to 5 minutes", "B. Implementing token rotation with short-lived access tokens and sliding refresh tokens backed by a Redis revocation list", "C. Storing the JWT in the browser's local storage", "D. Encrypting the JWT payload with a public RSA key"] },
        { q: "Explain the exact performance impact, lock escalation behavior, and deadlock mitigation strategy when switching from optimistic concurrency control (OCC) to pessimistic locking in a high-concurrency PostgreSQL database.", s: "Contrast lock-free version checks with active row-level locks like SELECT FOR UPDATE.", d: "Medium", type: "short" },
        { q: "Design a fault-tolerant and highly scalable microservices pipeline for high-throughput file parsing, detailing rate-limiting, message queues, and horizontal scaling.", s: "Discuss API gateways, rate-limiters (token bucket), pub-sub queues (Kafka/RabbitMQ), and worker auto-scaling.", d: "Medium", type: "long" },
        { q: "In distributed databases, which of the following is represented by the PACELC theorem as an extension of the CAP theorem?", s: "Identify the theorem component focusing on latency and consistency trade-offs when there are no partitions.", d: "Medium", type: "mcq", options: ["A. Partition, Availability, Consistency, Else Latency, Consistency", "B. Performance, Availability, Cache, Else Load, Capacity", "C. Asynchronous, Coherent, Encryption, Else Durable, Decoupled", "D. Parallelism, Active-active, Consensus, Else Replay, Validation"] },
        { q: "Explain the CAP theorem and discuss its implications for distributed database systems, highlighting how NoSQL databases choose between AP and CP.", s: "Contrast consistency, availability, and partition tolerance trade-offs in distributed data systems.", d: "Hard", type: "short" },
        { q: "Detail the system architecture of a scalable, fault-tolerant real-time notification system capable of supporting 10 million concurrent WebSocket connections.", s: "Discuss WebSockets/SSE, pub/sub queues (Redis/Kafka), load balancing, and connection-pinning backends.", d: "Hard", type: "long" },
        { q: "Discuss a challenging project from your resume. What was the most critical performance bottleneck or memory leak you encountered, and how did you diagnose and resolve it under load?", s: "Utilize the STAR method, citing exact profiling, memory heap dump tools, and architectural changes.", d: "Hard", type: "long" },
        { q: "Which of the following database normal forms (NF) specifically addresses eliminating transitive dependencies on non-prime attributes?", s: "Identify the normalization level that eliminates transitive functional dependencies.", d: "Easy", type: "mcq", options: ["A. First Normal Form (1NF)", "B. Second Normal Form (2NF)", "C. Third Normal Form (3NF)", "D. Boyce-Codd Normal Form (BCNF)"] },
        { q: "Briefly explain the purpose, routing algorithms, and health-checking mechanisms of a Layer 7 Load Balancer in modern web architectures.", s: "Explain reverse proxy, routing incoming requests at application layer (HTTP/HTTPS), and server pooling.", d: "Easy", type: "short" },
        { q: "Explain the architectural differences, payload overhead, and API versioning strategies when choosing between RESTful APIs, GraphQL, and gRPC.", s: "Compare fixed endpoints vs client-defined queries and binary serialization of Protocol Buffers.", d: "Medium", type: "short" },
        { q: "Describe the primary architectural benefits, index structures, and consistency trade-offs of using a Document Store (like MongoDB) over a Relational Database.", s: "Contrast schema flexibility and horizontal partitioning (sharding) with transactional ACID constraints.", d: "Medium", type: "long" },
        { q: "What is the primary objective of implementing a Write-Ahead Log (WAL) in modern transactional database engines?", s: "Identify the core trait focused on durability, recovery, and atomicity.", d: "Medium", type: "mcq", options: ["A. Accelerating read query performance using B-Tree indices", "B. Ensuring durability and transaction recovery (ACID) by logging modifications before applying changes to data pages", "C. Normalizing tables to avoid redundant entries", "D. Automatically distributing database partitions across multiple cloud nodes"] },
        { q: "Detail the steps, security practices, and deployment strategies (e.g. blue-green, canary) for establishing a secure, automated CI/CD pipeline.", s: "Discuss automated testing, static code analysis (SAST), secrets management, and zero-downtime rolling updates.", d: "Hard", type: "long" }
      ];
    } else {
      fallbackQuestions = [
        { q: "In corporate financial evaluation, which capital allocation metric is most reliable for comparing projects of differing lifetimes and capital scales?", s: "Compare Net Present Value (NPV), Internal Rate of Return (IRR), and Equivalent Annual Annuity.", d: "Easy", type: "mcq", options: ["A. Internal Rate of Return (IRR)", "B. Net Present Value (NPV) and Equivalent Annual Annuity (EAA)", "C. Simple Payback Period", "D. Accounting Rate of Return (ARR)"] },
        { q: "Explain how the 'Ansoff Matrix' guides enterprise-level growth strategies, and the structural risks of pursuing a diversification strategy.", s: "Contrast market penetration, market development, product development, and diversification risks.", d: "Easy", type: "short" },
        { q: "Describe how you would design and implement a comprehensive change management initiative at a 5,000-employee enterprise undergoing a digital ERP transition.", s: "Highlight stakeholder buy-in, training roadmaps, communication pipelines, and risk mitigation.", d: "Easy", type: "long" },
        { q: "Under Michael Porter's Five Forces framework, which of the following represents a high structural barrier to entry for potential competitors in an industry?", s: "Choose the barrier that represents high capital requirements, scale advantages, or regulatory hurdles.", d: "Medium", type: "mcq", options: ["A. Low capital requirements and open distribution channels", "B. Significant economies of scale, high proprietary product differentiation, and restrictive regulatory policies", "C. High supplier switching costs and low buyer loyalty", "D. High availability of substitute products in adjacent markets"] },
        { q: "Explain the concept of 'Information Asymmetry' in financial markets and how corporate governance structures attempt to mitigate its impact.", s: "Define asymmetric data, adverse selection, moral hazard, and disclosure/independent audits.", d: "Medium", type: "short" },
        { q: "Describe a major crisis where a core teammate resigned unexpectedly on the day of a critical client launch. How did you manage resources and communicate with stakeholders?", s: "Outline task triaging, risk management, objective prioritization, and transparent stakeholder communication.", d: "Medium", type: "long" },
        { q: "Which of the following best defines the 'Weighted Average Cost of Capital' (WACC) in corporate valuation models?", s: "Identify the formula representing cost of equity and cost of debt proportions.", d: "Medium", type: "mcq", options: ["A. The simple average of interest rates on bank loans", "B. The blended rate of return a company is expected to pay to all its security holders to finance its assets", "C. The tax rate applied to corporate earnings", "D. The risk-free rate of return set by central banks"] },
        { q: "Briefly explain the 'DuPont Analysis' model and how it decomposes Return on Equity (ROE) into three distinct financial levers.", s: "Detail how profit margin, asset turnover, and financial leverage contribute to overall ROE.", d: "Hard", type: "short" },
        { q: "Formulate a comprehensive market-entry strategy for a premium electric vehicle brand seeking to expand into South-East Asian markets under tight regulatory constraints.", s: "Discuss regulatory compliance, supply chain logistics, joint-ventures, localized marketing, and charging infrastructure.", d: "Hard", type: "long" },
        { q: "Detail how you would resolve a major cross-departmental resource deadlock between software engineering and product management during a high-stakes release.", s: "Discuss negotiation tactics, priority mapping, shared objectives, and establishing clear accountability frameworks.", d: "Hard", type: "long" },
        { q: "Which of the following best defines 'Active Listening' in professional communication?", s: "Select the option that details feedback, clarification, and complete concentration on speaker.", d: "Easy", type: "mcq", options: ["A. Taking notes verbatim during a meeting", "B. Hearing words while planning your next response", "C. Giving undivided attention, clarifying, and reflecting back meaning", "D. Directing the conversation to your own goals"] },
        { q: "Explain the difference between 'Direct Marketing' and 'Indirect Marketing'.", s: "Contrast targeted communication to individual consumers against brand-awareness mass media campaigns.", d: "Easy", type: "short" },
        { q: "Describe the primary components of a standard Business Model Canvas.", s: "Mention value propositions, customer segments, channels, revenue streams, and key partners.", d: "Medium", type: "long" },
        { q: "What is the primary goal of utilizing Key Performance Indicators (KPIs) in corporate settings?", s: "Discuss measuring quantitative performance progress against key strategic objectives.", d: "Medium", type: "short" },
        { q: "In financial management, what does 'Break-Even Point' represent?", s: "Identify the revenue level where total revenue exactly equals total costs.", d: "Medium", type: "mcq", options: ["A. The point of maximum profit generation", "B. The state where total revenue equals total fixed and variable costs", "C. The initial capital requirement of a venture", "D. The interest rate on corporate loans"] },
        { q: "Detail how you would manage a major crisis where a team project has critical bugs on deployment day.", s: "Discuss immediate communication, hotfix triage, stakeholder management, and post-mortem analysis.", d: "Hard", type: "long" }
      ];
    }

    // Filter out past questions from the fallback pool if we have enough variety left
    let filteredFallback = fallbackQuestions;
    if (pastQuestionsList.length > 0) {
      const lowerPast = pastQuestionsList.map(q => q.toLowerCase().trim());
      filteredFallback = fallbackQuestions.filter(f => !lowerPast.includes(f.q.toLowerCase().trim()));
    }
    
    // If we have at least 15 questions left, use them, otherwise use all available questions
    if (filteredFallback.length >= 15) {
      fallbackQuestions = filteredFallback;
    }

    let customTailoredQuestions = [];
    // Check if the user has custom resume details and generate tailored questions
    if (skillsList.length > 0 || (analysis && analysis.keyProjects && analysis.keyProjects.length > 0)) {
      const topSkills = skillsList.slice(0, 3).map((s: any) => s.name).join(", ");
      const topProj = (analysis && analysis.keyProjects && analysis.keyProjects.length > 0)
        ? analysis.keyProjects[0].title
        : "listed project";

      let projectQText = `Based on your resume, explain the detailed architecture and key implementation challenges of your project "${topProj}". How did you resolve performance bottlenecks or key constraints?`;
      let skillsQText = `How do you apply your core skills in "${topSkills}" to solve complex practical problems in your domain of "${stream}"? Give a specific real-world example.`;
      let scenarioQText = `In your stream of ${stream}, describe a situation where you had to debug a critical issue or manage a sudden crisis in a project. What was your approach?`;

      let projectHint = "Use the STAR approach. Focus on your specific contribution, tools used, and results.";
      let skillsHint = "Provide a concrete instance where you solved a high-impact problem using these technical tools.";
      let scenarioHint = "Discuss immediate communication, resource management, and steps taken to resolve it.";

      if (language === "Bengali") {
        projectQText = `আপনার সিভি অনুযায়ী, "${topProj}" প্রজেক্টটির আর্কিটেকচার এবং বাস্তবায়নের প্রধান চ্যালেঞ্জগুলি বিস্তারিত ব্যাখ্যা করুন। আপনি কিভাবে পারফরম্যান্স বা অন্যান্য সীমাবদ্ধতা সমাধান করেছিলেন?`;
        skillsQText = `"${stream}" ডোমেনে কাজ করার সময় আপনার প্রধান দক্ষতা "${topSkills}" কিভাবে জটিল বাস্তব সমস্যা সমাধানে ব্যবহার করবেন? একটি নির্দিষ্ট উদাহরণ দিন।`;
        scenarioQText = `আপনার বিষয় "${stream}"-এ, এমন একটি পরিস্থিতির বর্ণনা দিন যেখানে আপনাকে একটি বড় প্রজেক্টের জটিল সমস্যা সমাধান করতে হয়েছিল। আপনার সমাধান পদ্ধতি কি ছিল?`;
        
        projectHint = "STAR পদ্ধতি ব্যবহার করুন। আপনার অবদান, প্রযুক্তি এবং ফলাফলের ওপর আলোকপাত করুন।";
        skillsHint = "আপনি এই প্রযুক্তিগুলি ব্যবহার করে কিভাবে একটি বড় সমস্যার সমাধান করেছিলেন তার একটি বাস্তব উদাহরণ দিন।";
        scenarioHint = "যোগাযোগ ব্যবস্থা, রিসোর্স ম্যানেজমেন্ট এবং সমস্যা সমাধানের পদক্ষেপগুলি বর্ণনা করুন।";
      } else if (language === "Hindi") {
        projectQText = `आपके बायोडाटा के अनुसार, आपके प्रोजेक्ट "${topProj}" की विस्तृत वास्तुकला (Architecture) और मुख्य चुनौतियों का वर्णन करें। आपने प्रदर्शन या सीमाओं को कैसे हल किया?`;
        skillsQText = `"${stream}" के क्षेत्र में, जटिल व्यावहारिक समस्याओं को हल करने के लिए आप अपने मुख्य कौशल "${topSkills}" का उपयोग कैसे करेंगे? एक विशिष्ट वास्तविक उदाहरण दें।`;
        scenarioQText = `आपके विषय "${stream}" में, एक ऐसी स्थिति का वर्णन करें जहां आपको किसी बड़े प्रोजेक्ट में एक गंभीर समस्या या संकट का सामना करना पड़ा। आपका दृष्टिकोण क्या था?`;
        
        projectHint = "STAR विधि का उपयोग करें। अपने योगदान, उपयोग किए गए टूल और परिणामों पर ध्यान दें।";
        skillsHint = "एक ठोस उदाहरण प्रदान करें जहां आपने इन तकनीकी उपकरणों का उपयोग करके किसी समस्या को हल किया हो।";
        scenarioHint = "संचार, संसाधन प्रबंधन और समाधान के लिए उठाए गए कदमों पर चर्चा करें।";
      }

      customTailoredQuestions.push(
        { q: projectQText, s: projectHint, d: "Hard", type: "long" },
        { q: skillsQText, s: skillsHint, d: "Medium", type: "short" },
        { q: scenarioQText, s: scenarioHint, d: "Medium", type: "long" }
      );
    }

    // Shuffle the available generic fallback questions
    let shuffledGeneric = shuffleArray(fallbackQuestions);
    
    // Combine custom tailored questions with generic fallbacks to make exactly 15 questions
    let finalFallbackList = [...customTailoredQuestions];
    const neededCount = 15 - finalFallbackList.length;
    if (neededCount > 0) {
      finalFallbackList.push(...shuffledGeneric.slice(0, neededCount));
    }
    
    // Re-sort the 15 questions so they are sequentially ordered: Easy, then Medium, then Hard
    const difficultyOrder = { "Easy": 1, "Medium": 2, "Hard": 3 };
    finalFallbackList.sort((a, b) => {
      const orderA = difficultyOrder[a.d as keyof typeof difficultyOrder] || 2;
      const orderB = difficultyOrder[b.d as keyof typeof difficultyOrder] || 2;
      return orderA - orderB;
    });

    fallbackQuestions = finalFallbackList;

    const ai = getGeminiClient();
    let questions = fallbackQuestions;

    if (ai) {
      try {
        const prompt = `You are a Senior Executive Board Member and Corporate Recruiter at Swami Vivekananda University (SVU) Placement Panel.
        Generate exactly 15 highly professional, customized, and rigorous interview questions for a student with the following profile:
        - Candidate Name: ${user?.name || "Student"}
        - Qualification: ${qualification}
        - Subject Stream: ${stream}
        - Detected Resume Skills: ${skillsString}
        - Core Academic Subjects: ${subjectsString}
        - Key Projects/Experience: ${projectDetails}
        - Knowledge Depth Summary: ${analysis?.knowledgeDepth || "Demonstrated professional capability."}
        - Target Domain Focus: ${analysis?.careerDomain || "General placement"}
        - Requested Assessment Language: ${language}

        Your goal is to thoroughly prepare this student for a competitive real-world job interview at an elite organization or firm matching their exact career profile (e.g. elite hospital or health institution for medical candidates, prestigious law firm or advocacy chamber for legal candidates, top-tier tech firm for engineering/computer science candidates, corporate business office for management, etc.).
        ${pastQuestionsRule}
        
        CRITICAL RESUME-ONLY SCOPE RULE:
        - All 15 questions MUST be strictly based on the provided resume details: detected skills, listed academic subjects, stream/qualification, and key projects.
        - Under no circumstances should you generate questions about external, general trivia, or concepts that have zero connection to this specific CV.
        - The candidate must not be able to complain that "questions came from outside my CV". Every single question must trace directly back to a skill, subject, project, or stream listed in their profile.
        - This rule applies universally regardless of the candidate's stream: Doctor, Engineer, General Honours, Arts, Science, Commerce, Lawyer, etc. Craft precise, highly relevant questions matching their exact qualifications.
        - DO NOT ask any coding, programming, database, or engineering questions to non-engineering candidates (like Doctors, Arts, Commerce, or General Honours students). Keep questions 100% strictly relevant to their field and listed CV content.

        CRITICAL HIGH-LEVEL AND DEPTH RULE:
        - Under no circumstances should you generate simple, entry-level, or basic definition questions (e.g., avoid basic questions like "What is React?", "What is inheritance?", or simple academic trivia).
        - Every question must be highly intellectual, advanced, and conceptually challenging, matching professional board-level and interview-level standards.
        - For computer science/tech: Focus on high-concurrency race conditions, performance optimization bottlenecks, distributed system architecture trade-offs, real-time sync protocols, edge cases of asynchronous execution, memory leak profiling, or deep database query optimizations under heavy load.
        - For medical/nursing: Focus on complex clinical scenarios, acute multi-system disease management, advanced pharmacology, severe drug-drug interactions, or critical bioethics in terminal cases.
        - For legal/law: Focus on complex multi-jurisdictional contract disputes, subtle jurisprudential interpretations, high-stakes litigation procedures, or advanced constitutional defenses.
        - For management/arts/general honours: Focus on deep strategic enterprise problem solving, advanced market optimization, crisis leadership, structural organizational transformation, or advanced core conceptual applications of their listed academic stream subjects.

        CRITICAL INDUSTRY ACCURACY RULE:
        - Under no circumstances should you ask generic tech questions to a doctor, or clinical questions to a lawyer. Tie every single question strictly to their specific qualification, stream, listed subjects, and exact projects or field of study.

        CRITICAL ASSESSMENT LANGUAGE RULE:
        - You MUST write the complete questions ("q"), the hint advice ("s"), and options ("options" if MCQ) inside the specified language: ${language}.
        - If language is "Bengali", write everything (questions, suggestions, MCQ options) strictly in beautiful Bengali script (বাংলা ভাষা).
        - If language is "Hindi", write everything strictly in beautiful Hindi script (हिंदी भाषा).
        - If language is "English" (or unspecified), write in English.

        The 15 questions MUST be graded sequentially in difficulty from Easy to Hard and include a mix of MCQ (Multiple Choice Questions with options), Short Answer, and Long Answer types:
        
        - Questions 1 to 5: Easy. Grade 1 and 4 as MCQ (with exactly 4 options A, B, C, D in an "options" array), Grade 2, 3, 5 as Short or Long Answer.
        - Questions 6 to 10: Medium. Grade 6 and 9 as MCQ (with exactly 4 options A, B, C, D in an "options" array), Grade 7, 8, 10 as Short or Long Answer.
        - Questions 11 to 15: Hard. Grade 11 as MCQ (with exactly 4 options A, B, C, D in an "options" array), Grade 12, 13, 14, 15 as Short or Long Answer.

        Strictly output a JSON array of exactly 15 objects matching this schema (do not include any enclosing markdown blocks, comments, or extra text, just raw JSON):
        [
          {
            "q": "Clear, direct, and professional question text in ${language}",
            "s": "Short advice/hint (max 15 words) on what candidate should highlight in their answer, written in ${language}",
            "d": "Easy" | "Medium" | "Hard",
            "type": "mcq" | "short" | "long",
            "options": ["A. Option text 1 in ${language}", "B. Option text 2 in ${language}", "C. Option text 3 in ${language}", "D. Option text 4 in ${language}"]
          }
        ]`;

        const rawText = await generateContentWithFallback(ai, prompt, true);

        if (rawText) {
          let cleanedText = rawText.trim();
          if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
          }
          const parsed = JSON.parse(cleanedText);
          if (Array.isArray(parsed) && parsed.length === 15) {
            questions = parsed;
          }
        }
      } catch (aiError) {
        console.error("Gemini Question Generation failed, using customized fallbacks:", aiError);
      }
    }

    // Apply dynamic language translation if a non-English language is selected
    if (language && language !== "English") {
      questions = questions.map((q: any) => translateQuestion(q, language));
    }

    // Enforce structured rounds on the questions array before returning
    const enrichedQuestions = questions.map((q: any, index: number) => {
      let round = "General Interview Round";
      let roundType = "general";

      if (isEngineering) {
        if (index < 5) {
          round = "Technical Basics Round";
          roundType = "technical_basics";
        } else if (index < 10) {
          round = "Technical Round";
          roundType = "technical";
        } else {
          round = "HR Round";
          roundType = "hr";
        }
      } else if (isMedical) {
        if (index < 5) {
          round = "Clinical Diagnosis Round";
          roundType = "clinical";
        } else if (index < 10) {
          round = "Medical Ethics Round";
          roundType = "ethics";
        } else {
          round = "Patient Care Round";
          roundType = "patient";
        }
      } else if (isLegal) {
        if (index < 5) {
          round = "Case Analysis Round";
          roundType = "case";
        } else if (index < 10) {
          round = "Courtroom Argumentation Round";
          roundType = "argumentation";
        } else {
          round = "Professional Ethics Round";
          roundType = "ethics";
        }
      } else {
        if (index < 5) {
          round = "Academic Fundamentals Round";
          roundType = "academic";
        } else if (index < 10) {
          round = "Subject Depth Round";
          roundType = "depth";
        } else {
          round = "Career HR Round";
          roundType = "hr";
        }
      }

      return {
        ...q,
        round,
        roundType
      };
    });

    return res.status(200).json({ questions: enrichedQuestions });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to generate interview questions: " + error.message });
  }
});

// Evaluate Interview and generate report card
app.post("/api/interview/evaluate", async (req, res) => {
  const { userId, questionsAndAnswers } = req.body;

  if (!userId || !questionsAndAnswers || !Array.isArray(questionsAndAnswers)) {
    return res.status(400).json({ error: "User ID and questionsAndAnswers array are required." });
  }

  try {
    const user = await getUserById(userId);
    const [resumeRows]: any = await pool.execute("SELECT * FROM resumes WHERE user_id = ?", [userId]);
    const resumeRecord = resumeRows && resumeRows.length > 0 ? resumeRows[0] : null;
    const skillsList = resumeRecord ? JSON.parse(resumeRecord.skills) : [];
    const skillsString = skillsList.map((s: any) => s.name).join(", ");

    const qualification = user?.qualification || "B.A. (Hons.)";
    const stream = user?.stream || "Education (Arts)";
    const candidateName = user?.name || "Student";

    // Build user answers text representation
    const qnasFormatted = questionsAndAnswers.map((item, index) => {
      return `Question ${index + 1}: ${item.question}\nCandidate Answer: ${item.answer || "Skipped / No Answer"}`;
    }).join("\n\n");

    const ai = getGeminiClient();

    // Dynamic Fallback Scoring based on actual candidate answers
    let totalQs = questionsAndAnswers.length || 5;
    let confidenceSum = 0;
    let claritySum = 0;
    let relevanceSum = 0;
    let technicalDepthSum = 0;
    let grammarSum = 0;
    let answeredCount = 0;

    // Technical vocabulary to check domain depth
    const techKeywords = ["react", "node", "database", "sql", "api", "html", "css", "js", "typescript", "algorithm", "complexity", "server", "http", "locking", "websockets", "redis", "query", "index", "optimization", "component", "state", "effect", "schema"];

    questionsAndAnswers.forEach(qna => {
      const qText = (qna.question || "").toLowerCase();
      const ans = (qna.answer || "").trim();
      const lowerAns = ans.toLowerCase();

      // Check if skipped or too short to be considered an answer
      const isSkipped = !ans || 
                        lowerAns === "skipped" || 
                        lowerAns === "skip" || 
                        lowerAns === "no answer" || 
                        lowerAns === "i do not know" ||
                        lowerAns === "dont know" ||
                        lowerAns === "don't know" ||
                        lowerAns === "no idea" ||
                        lowerAns === "not sure" ||
                        lowerAns === "sorry" ||
                        lowerAns === "na" ||
                        ans.length < 5;

      const words = ans.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;

      // If skipped, evasive, or has fewer than 3 words, they get exactly 0 marks for this question (skipped contributions are 0)
      if (isSkipped || wordCount < 3) {
        return;
      }

      // Check for obviously wrong, repetitive, or garbage answers
      // For example, if there is absolutely no overlap with key technical vocabulary OR the question words, and it's too short, penalize to 0
      const matchesTech = techKeywords.some(kw => lowerAns.includes(kw));
      const matchesResume = skillsList.some((s: any) => lowerAns.includes(s.name.toLowerCase()));
      const qWords = qText.split(/\s+/).filter(w => w.length > 4);
      const matchesQuestion = qWords.some(qw => lowerAns.includes(qw));

      if (!matchesTech && !matchesResume && !matchesQuestion && wordCount < 8) {
        // Obvious off-topic or wrong/gibberish answer, award 0 marks
        return;
      }

      // Valid answer (answeredCount incremented)
      answeredCount++;

      // Check keyword matches
      let keywordMatches = 0;
      techKeywords.forEach(kw => {
        if (lowerAns.includes(kw)) keywordMatches++;
      });
      // Also check if any resume skills are mentioned
      skillsList.forEach((s: any) => {
        if (lowerAns.includes(s.name.toLowerCase())) {
          keywordMatches++;
        }
      });

      // Check overlap with question words (to measure relevance)
      let questionWordOverlap = 0;
      qWords.forEach(qw => {
        if (lowerAns.includes(qw)) questionWordOverlap++;
      });

      // 1. Confidence & Conviction (depends strictly on length and content quality)
      let qConf = 15;
      if (wordCount >= 8) qConf += 25;
      if (wordCount >= 20) qConf += 25;
      if (wordCount >= 40) qConf += 15;
      if (keywordMatches > 0) qConf += 15;
      qConf = Math.min(qConf, 100);

      // 2. Explanation Structure & Clarity (punctuation & logical progression)
      let qClar = 10;
      if (wordCount >= 8) qClar += 25;
      if (wordCount >= 20) qClar += 25;
      if (lowerAns.includes(".") || lowerAns.includes(",")) qClar += 15;
      if (wordCount >= 40) qClar += 15;
      qClar = Math.min(qClar, 100);

      // 3. Relevance & Context Match (based on question word overlap)
      let qRel = 10;
      if (wordCount >= 8) qRel += 20;
      if (wordCount >= 18) qRel += 25;
      if (questionWordOverlap > 0) qRel += Math.min(questionWordOverlap * 10, 30);
      qRel = Math.min(qRel, 100);

      // 4. Technical Depth & Domain Knowledge (based on technical keywords and depth)
      let qTech = 5;
      if (wordCount >= 8) qTech += 15;
      if (wordCount >= 20) qTech += 25;
      if (keywordMatches > 0) {
        qTech += Math.min(keywordMatches * 12, 45);
      } else {
        qTech = Math.max(5, qTech - 10);
      }
      qTech = Math.min(qTech, 100);

      // 5. Grammar & Vocabulary (capitalization, length, clean text)
      let qGram = 20;
      if (wordCount >= 8) qGram += 25;
      if (wordCount >= 20) qGram += 25;
      if (ans[0] === ans[0].toUpperCase()) qGram += 10;
      qGram = Math.min(qGram, 100);

      confidenceSum += qConf;
      claritySum += qClar;
      relevanceSum += qRel;
      technicalDepthSum += qTech;
      grammarSum += qGram;
    });

    let confidenceScore = 0;
    let clarityScore = 0;
    let relevanceScore = 0;
    let technicalDepthScore = 0;
    let grammarScore = 0;

    if (totalQs > 0) {
      confidenceScore = Math.round(confidenceSum / totalQs);
      clarityScore = Math.round(claritySum / totalQs);
      relevanceScore = Math.round(relevanceSum / totalQs);
      technicalDepthScore = Math.round(technicalDepthSum / totalQs);
      grammarScore = Math.round(grammarSum / totalQs);
    }

    const overallScore = confidenceScore + clarityScore + relevanceScore + technicalDepthScore + grammarScore;
    const percentage = Math.round(overallScore / 5);

    let confidenceRemark = "No answer provided.";
    let clarityRemark = "No answer provided.";
    let relevanceRemark = "No answer provided.";
    let technicalDepthRemark = "No answer provided.";
    let grammarRemark = "No answer provided.";

    if (confidenceScore > 0) {
      confidenceRemark = confidenceScore >= 85 ? "Excellent presentation poise" : confidenceScore >= 70 ? "Decent voice and poise" : "Needs better practice and conviction";
      clarityRemark = clarityScore >= 85 ? "Highly articulated thoughts" : clarityScore >= 70 ? "Clear and understandable" : "Needs logical structure";
      relevanceRemark = relevanceScore >= 85 ? "Extremely focused answers" : relevanceScore >= 70 ? "Mostly relevant answers" : "Lacks context and depth";
      technicalDepthRemark = technicalDepthScore >= 85 ? "Deep domain command shown" : technicalDepthScore >= 70 ? "Satisfactory domain knowledge" : "Struggled with technicalities";
      grammarRemark = grammarScore >= 85 ? "Perfect professional vocabulary" : grammarScore >= 70 ? "Good phrasing" : "Needs work on sentence formation";
    }

    let finalGrade = "F";
    let performanceLevel = "FAIL / POOR";
    if (percentage >= 90) { finalGrade = "A+"; performanceLevel = "OUTSTANDING / EXCELLENT"; }
    else if (percentage >= 80) { finalGrade = "A"; performanceLevel = "EXCELLENT"; }
    else if (percentage >= 70) { finalGrade = "B+"; performanceLevel = "VERY GOOD"; }
    else if (percentage >= 60) { finalGrade = "B"; performanceLevel = "GOOD"; }
    else if (percentage >= 50) { finalGrade = "C"; performanceLevel = "PASSABLE"; }

    let defaultStrengths = [
      answeredCount > 0 ? "Responded to major core questions with active effort." : "Initiated the interview assessment.",
      answeredCount > 2 ? "Used relevant academic and resume keywords in responses." : "Exhibited cooperative board demeanor.",
      answeredCount > 4 ? "Presented clear domain interest in their qualified stream." : "Punctual session pacing."
    ];

    let defaultDevAreas = [
      answeredCount < totalQs ? `Ensure to answer all ${totalQs} questions fully to maximize marks.` : "Incorporate deeper structural examples using STAR format.",
      answeredCount < 3 ? "Omitted detailed practical stack mentions: " + (skillsString || "HTML, CSS") : "Enrich details on theoretical subjects."
    ];

    let defaultSummary = answeredCount > 0 
      ? `The student completed ${answeredCount} out of ${totalQs} questions. Their responses showed active participation. To score higher, answers should incorporate specific project instances and a structured delivery pattern.`
      : "The student did not submit any valid answers. All questions were skipped or left empty, resulting in a zero score. Active practice is required to build technical board confidence.";

    let evaluation = {
      confidence: { score: confidenceScore, remark: confidenceRemark },
      clarity: { score: clarityScore, remark: clarityRemark },
      relevance: { score: relevanceScore, remark: relevanceRemark },
      technicalDepth: { score: technicalDepthScore, remark: technicalDepthRemark },
      grammar: { score: grammarScore, remark: grammarRemark },
      overallScore,
      percentage,
      finalGrade,
      performanceLevel,
      strengths: defaultStrengths,
      developmentAreas: defaultDevAreas,
      summary: defaultSummary,
      recommendations: [
        "Create systematic practice summaries for each project on your resume.",
        "Practice answering technical questions aloud using a timer.",
        "Ensure no questions are skipped during the official academic board session."
      ]
    };

    if (ai) {
      try {
        const prompt = `You are a Chief Academic Assessor at Swami Vivekananda University (SVU) Board, collaborating with ChAIL AI Evaluator Engine.
        Evaluate the following candidate's interview session thoroughly:
        - Candidate Name: ${candidateName}
        - Qualification: ${qualification}
        - Stream: ${stream}
        - Resume Skills: ${skillsString}
        
        Session Q&As:
        ${qnasFormatted}

        CRITICAL EVALUATION MANDATE (STRICT PROPORTIONAL GRADING & ZERO CREDIT FOR WRONG/BLANK ANSWERS):
        - ENGLISH-ONLY OUTPUT REQUIREMENT: All generated remarks, summaries, feedback text, strengths, development areas, recommendations, and remarks MUST be in 100% plain English. Do not write any Bengali, Hindi, or any language other than English in the final JSON response.
        - ZERO TOLERANCE FOR WRONG/EMPTY ANSWERS: If an answer is wrong, incorrect, factually inaccurate, irrelevant, gibberish, empty, blank, or skipped (contains "skipped", "skip", "no answer", "don't know", etc.), the candidate MUST receive EXACTLY 0 marks for that specific question's contribution to all parameters. Under no circumstances should text length or presence of generic words trick you into awarding marks.
        - PROPORTIONAL SCORING: Excellent answers must get high marks, mediocre/partial answers must get poor/partial/proportionate marks, and incorrect/blank/unanswered questions must get absolutely zero marks.
        - Check MCQ answers: Determine the mathematically correct option (A, B, C, or D) for each MCQ. Compare it against the student's selected answer option. If correct, award 100% contribution; if wrong, blank, or skipped, award 0% contribution for that question.
        - Check Typed answers: Rigorously verify factual and conceptual correctness of the answer based on the candidate's stream/qualification (Doctor, Engineer, General Honours, Arts, Science, Law, Commerce, etc.). If the student writes a correct, highly accurate, and domain-deep answer, award high marks. If they write a wrong answer or state incorrect definitions/facts, award ZERO marks.
        - Translate and evaluate: If answers are written in Bengali or Hindi script, analyze their meaning objectively to check for correct conceptual and technical details before grading.
        - If the candidate skips, leaves blank, or fails to answer ALL questions, the scores for all 5 parameters MUST be EXACTLY 0, overallScore = 0, percentage = 0, finalGrade = "F", and performanceLevel = "FAIL / POOR".
        - Calculate the scores as a true mathematical reflection of their performance. This ensures they receive a fair, accurate, and realistic scorecard and marksheet.

        Please grade the student's performance on exactly 5 parameters out of 100 each:
        1. "confidence": assess professional confidence, conviction, certainty, and answer presence.
        2. "clarity": logical structure, explanation structure, readability, and depth.
        3. "relevance": relevance, direct answering, avoiding beating around the bush.
        4. "technicalDepth": correctness, domain depth, technical validity matching qualification ${qualification} and subjects.
        5. "grammar": vocabulary, syntax error-freeness, professional vocabulary.

        Calculate the aggregate "overallScore" (sum of all 5 scores, max 500) and the "percentage" (overallScore / 5).
        Assign a "finalGrade" based on percentage:
        - 90-100: "A+" (Outstanding)
        - 80-89: "A" (Excellent)
        - 70-79: "B+" (Very Good)
        - 60-69: "B" (Good)
        - 50-59: "C" (Passable)
        - Below 50: "F" (Needs Attention)

        Assign a "performanceLevel" description:
        - percentage >= 90: "OUTSTANDING / EXCELLENT"
        - percentage >= 80: "EXCELLENT"
        - percentage >= 70: "VERY GOOD"
        - percentage >= 60: "GOOD"
        - percentage >= 50: "PASSABLE"
        - else: "FAIL / POOR"

        Also provide extremely detailed and customized observations:
        - "strengths": 3 custom key strengths identifying exactly what the candidate did right, which technologies they explained well, and where their logic was correct (string array).
        - "developmentAreas": 3 detailed target development areas outlining their specific mistakes, technical inaccuracies, weak or sketchy explanations, omitted projects details, or skips in their answers (string array).
        - "summary": A professional qualitative AI appraisal summary detailing what was good and what was wrong overall in their performance, with a clear verdict (3-4 sentences, maximum 80 words).
        - "recommendations": 3 specific, actionable recommendations on how to rectify their specific errors, direct concept topics to review, and real-world project/debugging approaches to follow (string array).

        Strictly output a JSON object matching this schema exactly (no markdown formatting, no commentary outside the JSON):
        {
          "confidence": { "score": number, "remark": "string" },
          "clarity": { "score": number, "remark": "string" },
          "relevance": { "score": number, "remark": "string" },
          "technicalDepth": { "score": number, "remark": "string" },
          "grammar": { "score": number, "remark": "string" },
          "overallScore": number,
          "percentage": number,
          "finalGrade": "A+|A|B+|B|C|F",
          "performanceLevel": "string",
          "strengths": ["string", "string", "string"],
          "developmentAreas": ["string", "string", "string"],
          "summary": "string",
          "recommendations": ["string", "string", "string"]
        }`;

        const rawText = await generateContentWithFallback(ai, prompt, true);

        if (rawText) {
          let cleanedText = rawText.trim();
          if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
          }
          const parsed = JSON.parse(cleanedText);
          if (parsed && typeof parsed === "object" && parsed.confidence) {
            evaluation = parsed;
          }
        }
      } catch (aiError) {
        console.error("Gemini Evaluation failed, using intelligent fallbacks:", aiError);
      }
    }

    // Force absolute zero for all scoring fields if no valid answers were provided (answeredCount === 0)
    if (answeredCount === 0) {
      evaluation = {
        confidence: { score: 0, remark: "No valid answers provided." },
        clarity: { score: 0, remark: "No valid answers provided." },
        relevance: { score: 0, remark: "No valid answers provided." },
        technicalDepth: { score: 0, remark: "No valid answers provided." },
        grammar: { score: 0, remark: "No valid answers provided." },
        overallScore: 0,
        percentage: 0,
        finalGrade: "F",
        performanceLevel: "FAIL / POOR",
        strengths: ["None", "None", "None"],
        developmentAreas: [
          "Candidate skipped or provided invalid answers to all questions.",
          "Must answer questions in detail to build marks.",
          "Prepare core technical and stream concepts from resume."
        ],
        summary: "The candidate did not answer any questions in this interview session. As a result, they received a score of zero. Active practice and thorough study of your resume topics are highly recommended before attempting again.",
        recommendations: [
          "Do not skip questions during the interview panel.",
          "Formulate standard, clear conceptual answers.",
          "Provide answers with minimum details (at least 3 words)."
        ]
      };
    }

    // Save full interview evaluation record to relational interviews table
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    await pool.execute(`
      INSERT INTO interviews (
        user_id, qualification, stream, skills, questions, answers, scores, 
        overall_score, percentage, final_grade, performance_level, strengths, 
        development_areas, summary, feedback, date_created
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      qualification,
      stream,
      skillsString || "General Skills",
      JSON.stringify(questionsAndAnswers.map(q => q.question)),
      JSON.stringify(questionsAndAnswers.map(q => q.answer || "")),
      JSON.stringify({
        confidence: evaluation.confidence,
        clarity: evaluation.clarity,
        relevance: evaluation.relevance,
        technicalDepth: evaluation.technicalDepth,
        grammar: evaluation.grammar
      }),
      evaluation.overallScore,
      evaluation.percentage,
      evaluation.finalGrade,
      evaluation.performanceLevel,
      JSON.stringify(evaluation.strengths),
      JSON.stringify(evaluation.developmentAreas),
      evaluation.summary,
      JSON.stringify(evaluation.recommendations),
      dateStr
    ]);

    return res.status(200).json({
      message: "Evaluation complete!",
      evaluation,
      date: dateStr
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to evaluate interview answers: " + error.message });
  }
});

// Retrieve latest marksheet or report card for user
app.get("/api/interview/latest/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows]: any = await pool.execute(`
      SELECT * FROM interviews 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT 1
    `, [userId]);
    const interview = rows && rows.length > 0 ? rows[0] : null;

    if (!interview) {
      return res.status(404).json({ error: "No interview session found for this user." });
    }

    const user = await getUserById(userId);

    // Parse DB strings back to original array formats
    const scores = JSON.parse(interview.scores);
    const strengths = JSON.parse(interview.strengths);
    const devAreas = JSON.parse(interview.development_areas);
    const feedback = JSON.parse(interview.feedback);
    const questions = JSON.parse(interview.questions || "[]");
    const answers = JSON.parse(interview.answers || "[]");

    return res.status(200).json({
      interviewId: `INT-INT-SVU${interview.id}`,
      studentName: user?.name || "Student",
      email: user?.email || "",
      qualification: interview.qualification || "B.A. (Hons.)",
      institution: user?.institution || "SVU",
      stream: interview.stream || "Education (Arts)",
      overallScore: interview.overall_score,
      percentage: interview.percentage,
      finalGrade: interview.final_grade,
      performanceLevel: interview.performance_level,
      strengths,
      developmentAreas: devAreas,
      summary: interview.summary,
      feedback,
      scores,
      date: interview.date_created,
      questions,
      answers
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Retrieve all interview history for a user
app.get("/api/interview/history/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [interviews]: any = await pool.execute(`
      SELECT * FROM interviews 
      WHERE user_id = ? 
      ORDER BY id DESC
    `, [userId]);

    const user = await getUserById(userId);

    const history = interviews.map((interview: any) => {
      const scores = JSON.parse(interview.scores || "{}");
      const strengths = JSON.parse(interview.strengths || "[]");
      const devAreas = JSON.parse(interview.development_areas || "[]");
      const feedback = JSON.parse(interview.feedback || "[]");
      const questions = JSON.parse(interview.questions || "[]");
      const answers = JSON.parse(interview.answers || "[]");

      return {
        id: interview.id,
        interviewId: `INT-INT-SVU${interview.id}`,
        studentName: user?.name || "Student",
        email: user?.email || "",
        qualification: interview.qualification || "B.A. (Hons.)",
        institution: user?.institution || "SVU",
        stream: interview.stream || "Education (Arts)",
        overallScore: interview.overall_score,
        percentage: interview.percentage,
        finalGrade: interview.final_grade,
        performanceLevel: interview.performance_level,
        strengths,
        developmentAreas: devAreas,
        summary: interview.summary,
        feedback,
        scores,
        date: interview.date_created,
        questions,
        answers
      };
    });

    return res.status(200).json({ history });
  } catch (error: any) {
    return res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Serve pristine printable HTML marksheet in a new tab
app.get("/api/interview/print/:userId/:interviewId?", async (req, res) => {
  const { userId, interviewId: paramInterviewId } = req.params;

  try {
    let interview;
    if (paramInterviewId) {
      const cleanId = paramInterviewId.replace(/^(INT-INT-SVU|INT-SVU|INT-)/i, "");
      const [rows]: any = await pool.execute(`
        SELECT * FROM interviews 
        WHERE id = ? AND user_id = ?
      `, [Number(cleanId) || cleanId, userId]);
      interview = rows && rows.length > 0 ? rows[0] : null;
    } else {
      const [rows]: any = await pool.execute(`
        SELECT * FROM interviews 
        WHERE user_id = ? 
        ORDER BY id DESC LIMIT 1
      `, [userId]);
      interview = rows && rows.length > 0 ? rows[0] : null;
    }

    if (!interview) {
      return res.status(404).send("<h2>No interview session found for this student. Please complete your practice session first.</h2>");
    }

    const user = await getUserById(userId);
    const scores = JSON.parse(interview.scores);
    const strengths = JSON.parse(interview.strengths) as string[];
    const devAreas = JSON.parse(interview.development_areas) as string[];

    const getGrade = (score: number): string => {
      if (score >= 90) return "A+";
      if (score >= 80) return "A";
      if (score >= 70) return "B+";
      if (score >= 60) return "B";
      if (score >= 50) return "C";
      return "F";
    };

    const studentName = user?.name || "Student";
    const email = user?.email || "";
    const stream = interview.stream || "Computer Science & Engineering";
    const qualification = interview.qualification || "B.Tech";
    const institution = user?.institution || "Swami Vivekananda University";
    const interviewId = `INT-INT-SVU${interview.id}`;
    const date = interview.date_created;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SVU Official Transcript - ${studentName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body {
      background: #ffffff;
      color: #111111;
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-size: 10px;
      line-height: 1.35;
    }
    .print-container {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      padding: 4px;
      box-sizing: border-box;
      page-break-inside: avoid;
    }
    .marksheet-border {
      border: 3px double #0d235c;
      padding: 16px 20px;
      border-radius: 8px;
      box-sizing: border-box;
      background: #ffffff;
      min-height: 278mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      border-bottom: 1.5px solid #0d235c;
      padding-bottom: 6px;
    }
    .logo-box {
      width: 52px;
      height: 52px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      font-size: 12px;
      text-align: center;
      line-height: 1.1;
      flex-shrink: 0;
    }
    .svu-logo {
      border: 2px solid #0d235c;
      color: #0d235c;
      background: #f0f4ff;
    }
    .chail-logo {
      border: 2px solid #c21c24;
      color: #c21c24;
      background: #fff5f5;
      font-size: 11px;
    }
    .logo-subtitle {
      font-size: 6px;
      font-weight: bold;
      letter-spacing: 0.1px;
    }
    .header-text {
      text-align: center;
      flex: 1;
    }
    .header-text h2 {
      font-size: 15px;
      font-weight: 900;
      color: #0d235c;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .header-text h3 {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      margin: 2px 0 0 0;
      letter-spacing: 0.1px;
    }
    .header-text .subtitle {
      font-size: 7px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .marksheet-title-bar {
      background: #0d235c;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 10px;
      text-align: center;
      padding: 4px;
      border-radius: 4px;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .sheet-section-banner {
      background: #c21c24;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 8px;
      padding: 3px 6px;
      border-radius: 2px;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
      width: fit-content;
    }
    .profile-table, .scholastic-table, .grade-chart-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 6px;
    }
    .profile-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      color: #1e293b;
    }
    .profile-table .lbl {
      font-weight: 700;
      background: #f8fafc;
      color: #334155;
      width: 18%;
    }
    .profile-table .val {
      color: #0f172a;
      width: 32%;
      font-weight: 500;
    }
    .scholastic-table th {
      background: #0d235c;
      color: #ffffff !important;
      font-weight: 700;
      padding: 4px 6px;
      border: 1px solid #0d235c;
    }
    .scholastic-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      color: #0f172a;
    }
    .scholastic-table tbody tr:nth-child(even) {
      background: #f8fbff;
    }
    .aggregate-summary-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: #0d235c;
      border: 1.5px solid #0d235c;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .summary-col {
      background: #ffffff;
      padding: 5px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .summary-col .lbl {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748b;
    }
    .summary-col .val {
      font-size: 11px;
      font-weight: 900;
      color: #0d235c;
    }
    .strengths-dev-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }
    .side-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px;
      background: #fafbfc;
    }
    .side-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #0d235c;
      margin-bottom: 4px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 2px;
      letter-spacing: 0.3px;
    }
    .side-box ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .side-box li {
      font-size: 8px;
      color: #334155;
      margin-bottom: 2px;
      line-height: 1.25;
    }
    .appraisal-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px;
      background: #fcfdfe;
      margin-bottom: 6px;
    }
    .appraisal-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #c21c24;
      margin-bottom: 2px;
      letter-spacing: 0.3px;
    }
    .appraisal-box p {
      font-size: 8px;
      color: #334155;
      margin: 0;
      line-height: 1.35;
    }
    .grade-chart-table {
      margin-bottom: 6px;
      font-size: 7.5px;
      text-align: center;
    }
    .grade-chart-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      padding: 3px;
      border: 1px solid #cbd5e1;
    }
    .grade-chart-table td {
      border: 1px solid #cbd5e1;
      padding: 3px;
      color: #64748b;
    }
    .sheet-signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
    }
    .sig-col {
      text-align: center;
      width: 32%;
    }
    .sig-line {
      font-size: 9px;
      font-weight: bold;
      color: #0f172a;
      border-bottom: 1px solid #475569;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    .sig-line-sig {
      font-family: serif;
      font-style: italic;
      font-size: 11px;
      font-weight: bold;
      color: #0d235c;
      border-bottom: 1px solid #475569;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    .sig-line-chail {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 42px;
      border-bottom: 1px solid #475569;
      padding-bottom: 2px;
      margin-bottom: 3px;
    }
    .sig-lbl {
      font-size: 7.5px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: bold;
      letter-spacing: 0.3px;
    }
    .dotted-seal {
      border: 2px dashed #ff9900;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #ff9900 !important;
      font-weight: 800;
      font-size: 7px;
      text-align: center;
      padding: 2px;
      margin: 0 auto;
      line-height: 1.1;
    }
    .seal-small {
      font-size: 5px;
      font-weight: 600;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 4mm 6mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .print-container {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="marksheet-border">
      
      <!-- Header Block -->
      <div class="sheet-header">
        <div class="logo-box svu-logo">
          <span>SVU</span>
          <span class="logo-subtitle">ESTD 2019</span>
        </div>
        <div class="header-text">
          <h2>SWAMI VIVEKANANDA UNIVERSITY</h2>
          <h3>IN COLLABORATION WITH CHAIL ARTIFICIAL INTELLIGENCE PLATFORM</h3>
          <p class="subtitle">Established by West Bengal Act XXXIX of 2019 • UGC Recognised University</p>
        </div>
        <div class="logo-box chail-logo">
          <span>ChAIL</span>
          <span class="logo-subtitle">AI SYSTEM</span>
        </div>
      </div>

      <!-- Academic Performance Title -->
      <div class="marksheet-title-bar">
        ACADEMIC PERFORMANCE ASSESSMENT MARK SHEET • EVALUATION 2026-27
      </div>

      <!-- Student Profile Section -->
      <div class="sheet-section-banner">
        STUDENT'S PROFILE
      </div>
      <table class="profile-table">
        <tbody>
          <tr>
            <td class="lbl">STUDENT NAME</td>
            <td class="val">${studentName}</td>
            <td class="lbl">SUBJECT STREAM</td>
            <td class="val">${stream}</td>
          </tr>
          <tr>
            <td class="lbl">EMAIL ID</td>
            <td class="val">${email}</td>
            <td class="lbl">EVALUATION DATE</td>
            <td class="val">${date}</td>
          </tr>
          <tr>
            <td class="lbl">QUALIFICATION</td>
            <td class="val">${qualification}</td>
            <td class="lbl">UNIVERSITY / BOARD</td>
            <td class="val">${institution}</td>
          </tr>
          <tr>
            <td class="lbl">INTERVIEW ID</td>
            <td class="val">${interviewId}</td>
            <td class="lbl">ASSESSOR ENGINE</td>
            <td class="val">ChAIL AI Evaluator Module v2.0</td>
          </tr>
        </tbody>
      </table>

      <!-- Scholastic Area Section -->
      <div class="sheet-section-banner">
        ACADEMIC PERFORMANCE - SCHOLASTIC AREA
      </div>
      <table class="scholastic-table">
        <thead>
          <tr>
            <th style="width: 45%;">SUBJECT PARAMETER EVALUATED</th>
            <th style="width: 12%;">MAX MARKS</th>
            <th style="width: 13%;">OBTAINED</th>
            <th style="width: 10%;">GRADE</th>
            <th style="width: 20%;">PERFORMANCE REMARK</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Communication Confidence & Conviction</b></td>
            <td>10</td>
            <td><b>${(scores.confidence.score / 10).toFixed(1)}</b></td>
            <td><b>${getGrade(scores.confidence.score)}</b></td>
            <td>${scores.confidence.remark}</td>
          </tr>
          <tr>
            <td><b>Explanation Structure & Clarity</b></td>
            <td>10</td>
            <td><b>${(scores.clarity.score / 10).toFixed(1)}</b></td>
            <td><b>${getGrade(scores.clarity.score)}</b></td>
            <td>${scores.clarity.remark}</td>
          </tr>
          <tr>
            <td><b>Relevance & Context Match</b></td>
            <td>10</td>
            <td><b>${(scores.relevance.score / 10).toFixed(1)}</b></td>
            <td><b>${getGrade(scores.relevance.score)}</b></td>
            <td>${scores.relevance.remark}</td>
          </tr>
          <tr>
            <td><b>Technical Depth & Domain Knowledge</b></td>
            <td>10</td>
            <td><b>${(scores.technicalDepth.score / 10).toFixed(1)}</b></td>
            <td><b>${getGrade(scores.technicalDepth.score)}</b></td>
            <td>${scores.technicalDepth.remark}</td>
          </tr>
          <tr>
            <td><b>Grammar, Sentence Phrasing & Vocabulary</b></td>
            <td>10</td>
            <td><b>${(scores.grammar.score / 10).toFixed(1)}</b></td>
            <td><b>${getGrade(scores.grammar.score)}</b></td>
            <td>${scores.grammar.remark}</td>
          </tr>
        </tbody>
      </table>

      <!-- Aggregate Performance Summary Bar -->
      <div class="aggregate-summary-bar">
        <div class="summary-col">
          <span class="lbl">AGGREGATE SCORE</span>
          <span class="val">${(interview.overall_score / 10).toFixed(1)} / 50</span>
        </div>
        <div class="summary-col">
          <span class="lbl">PERCENTAGE RATING</span>
          <span class="val">${interview.percentage}%</span>
        </div>
        <div class="summary-col">
          <span class="lbl">FINAL ACCREDITED GRADE</span>
          <span class="val">${interview.final_grade}</span>
        </div>
        <div class="summary-col">
          <span class="lbl">PERFORMANCE BAND</span>
          <span class="val">${interview.performance_level}</span>
        </div>
      </div>

      <!-- Strengths and Dev Areas -->
      <div class="strengths-dev-grid">
        <div class="side-box">
          <div class="side-title">🌟 KEY STRENGTHS DETECTED</div>
          <ul>
            ${strengths.map(str => `<li>✔ ${str}</li>`).join("")}
          </ul>
        </div>
        <div class="side-box">
          <div class="side-title">🎯 TARGET DEVELOPMENT AREAS</div>
          <ul>
            ${devAreas.map(dev => `<li>• ${dev}</li>`).join("")}
          </ul>
        </div>
      </div>

      <!-- AI Appraisal Block -->
      <div class="appraisal-box">
        <div class="appraisal-title">CHIEF AI APPRAISAL REMARK</div>
        <p>${interview.summary}</p>
      </div>

      <!-- Official SVU Grading Scale -->
      <table class="grade-chart-table">
        <thead>
          <tr>
            <th>OBTAINED PERCENTAGE RANGE</th>
            <th>90% - 100%</th>
            <th>80% - 89%</th>
            <th>70% - 79%</th>
            <th>60% - 69%</th>
            <th>50% - 59%</th>
            <th>Below 50%</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>GRADE AWARDED</b></td>
            <td><b>A+</b> (Outstanding)</td>
            <td><b>A</b> (Excellent)</td>
            <td><b>B+</b> (Very Good)</td>
            <td><b>B</b> (Good)</td>
            <td><b>C</b> (Passable)</td>
            <td><b>F</b> (Needs Attention)</td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures Row -->
      <div class="sheet-signatures">
        <div class="sig-col">
          <div class="sig-line-chail">
            <img src="/api/assets/chail-signature" alt="Chail Signature" style="max-height: 48px; max-width: 130px; mix-blend-mode: multiply;" referrerPolicy="no-referrer" />
          </div>
          <div class="sig-lbl">Applicant Signatory</div>
        </div>
        <div class="sig-col">
          <div class="dotted-seal">
            <span>SVU & ChAIL</span>
            <span class="seal-small">VERIFIED BOARD</span>
            <span class="seal-small">ACCREDITED</span>
          </div>
        </div>
        <div class="sig-col">
          <div class="sig-line-sig">Swami Vivekananda University</div>
          <div class="sig-lbl">Authorized Signatory</div>
        </div>
      </div>

    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 600);
    };
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(html);
  } catch (error: any) {
    return res.status(500).send(`<h2>Print error: ${error.message}</h2>`);
  }
});

// ================= VITE OR STATIC SETUP =================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ChAIL Server running successfully on port ${PORT}`);
  });
}

startServer();
