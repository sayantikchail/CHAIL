# ChAIL AI Interview Platform

An advanced, full-stack, AI-powered automated interview practice platform. The app leverages the server-side **Google Gemini API** to conduct customized, robust mock interviews based directly on the candidate's uploaded resume and chosen assessment language. It tracks student progress, grades answers, and presents beautiful analytics dashboards for both students and administrators.

---

## 🌟 Key Features

### 1. Dynamic, Resume-Aware Interview Engine (Student Portal)
- **Mandatory Resume Parsing**: The **Choose Assessment Language** selector remains inactive until a resume is uploaded.
- **Tailored Question Generation**: The system extracts exact technical skills, experience levels, and projects from the uploaded resume. It generates **15 highly challenging, deep-dive interview questions** mapped strictly to that resume's profile.
- **Session Flexibility**: Students can practice multiple times. If they upload a new resume with different skills, the interview dynamically adapts, generating an entirely new set of customized questions.
- **Multilingual Mock Interviews**: Supports multiple assessment languages (English, Bengali, Hindi, etc.) for question generation and mock execution.

### 2. Powerful Administration Console ("Supreme Command")
- **Student & Interview Management**: Administrators can monitor all registered students, review detailed analytical grade sheets, and download formatted transcripts/reports.
- **Responsive Overflow Layouts**: Student tables and Interview records dynamically implement vertical scrollbars when list sizes overflow screen boundaries. When there are fewer items, scrollbars hide to keep the viewport clean.

---

## 🛠️ Tech Stack
- **Frontend**: React 18+, Vite, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: Express.js (Node.js) with native TypeScript support (`tsx`)
- **Database / Storage**: Local database engine to store persistent student profiles and graded mock sessions
- **AI Integration**: Google Gen AI SDK (`@google/genai`) powered by Gemini

---

## 🚀 How to Run this App on Your Local System

Follow these simple steps to set up and run this application on your local computer:

### 📋 Prerequisites
Make sure you have the following installed on your machine:
1. **Node.js** (v18.x or above recommended)
2. **npm** (comes packaged with Node.js)
3. A **Google Gemini API Key** (You can obtain one from the Google AI Developer Console)

---

### 📥 Setup Instructions

#### Step 1: Open the Project
Open this project folder in VS Code or your preferred IDE on your system.

#### Step 2: Open Terminal / command prompt
Open your terminal (macOS/Linux) or Command Prompt/PowerShell (Windows) and navigate to the project root directory:
```bash
cd path/to/extracted/chail-interview-platform
```

#### Step 3: Configure Environment Variables
Create a file named `.env` in the root directory and copy the contents of `.env.example` into it. Add your Gemini API key:
```env
# Create .env file in the root
PORT=3000
NODE_ENV=development
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
*(Replace `your_actual_gemini_api_key_here` with your real Google Gemini API Key)*

#### Step 4: Install Dependencies
Run the following command to download and install all required node modules:
```bash
npm install
```

#### Step 5: Start the Development Server
Launch the application with:
```bash
npm run dev
```

#### Step 6: Access the App
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## 📦 How to Build for Production

If you wish to build the app for production deployment:

1. **Build the assets and server bundle**:
   ```bash
   npm run build
   ```
2. **Start the production server**:
   ```bash
   npm run start
   ```

---
*Created with ♥ by Sayantik Chail.*
