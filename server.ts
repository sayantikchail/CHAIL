import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '4JfwUQJNVeMWMwH.root',
  password: 'YSnA67L0zPtow1eP',
  database: 'test', 
  port: 4000,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false 
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Online MySQL Database Connected Successfully!");

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
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS resumes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255),
        skills TEXT,
        detailed_analysis JSON,
        file_base64 LONGTEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        qualification VARCHAR(255),
        stream VARCHAR(255),
        skills TEXT,
        questions JSON,
        answers JSON,
        scores JSON,
        overall_score INT,
        percentage INT,
        final_grade VARCHAR(10),
        performance_level VARCHAR(100),
        strengths JSON,
        development_areas JSON,
        summary TEXT,
        feedback JSON,
        date_created VARCHAR(100),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    
    connection.release();
    console.log("🚀 All Database Tables are Ready.");
  } catch (err: any) {
    console.error("❌ Database Init Error:", err.message);
  }
}

initDB();

let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    aiClient = new GoogleGenAI({ apiKey: apiKey });
  }
  return aiClient;
}

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, qualification, institution, stream } = req.body;
  try {
    const [result]: any = await pool.execute(
      "INSERT INTO users (name, email, password, qualification, institution, stream) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, password, qualification || "B.A.", institution || "SVU", stream || "Arts"]
    );
    res.status(201).json({ message: "Success", user: { id: result.insertId, name, email } });
  } catch (e: any) {
    res.status(400).json({ error: "Email already registered." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows]: any = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = rows[0];
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid credentials" });
    res.status(200).json({ user });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`🌍 Server live on http://localhost:${PORT}`));
}

startServer();