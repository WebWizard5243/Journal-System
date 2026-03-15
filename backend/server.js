import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pg from "pg";
import  analyzeEmotion from "./llm/llmCall.js";
import rateLimit from "express-rate-limit"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173','https://journal-system-kappa.vercel.app']
}));


const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.NEON_DATABASE_STRING,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.post("/api/journal", async (req, res) => {
  const { userId, ambience, text } = req.body;
  try {
    const response = await db.query(
      `INSERT INTO journal (user_id, ambience, text) VALUES ($1,$2,$3) RETURNING *`,
      [userId, ambience, text],
    );
    if (response.rows.length > 0) {
      res.status(201).json(response.rows[0]);
    }
  } catch (error) {
    console.error("error message :", error.message);
    res.status(500).json({ message: "something went wrong" });
  }
});

app.get("/api/journal/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const response = await db.query(
      `SELECT * FROM journal WHERE user_id = $1`,
      [userId],
    );
    if (response.rows.length > 0) {
      res.status(200).json(response.rows );
    } else {
      res.status(404).json({ message: "no entries found" });
    }
  } catch (error) {
    console.error("error message :", error.message);
    res.status(500).json({ message: "something went wrong" });
  }
});

const analyzeLimiter = rateLimit({
    windowMs : 15 * 60 * 1000,
    max : 100,
    message : { error : 'Too many analysis requests, please try again later'}
})

app.post("/api/journal/analyze",analyzeLimiter, async (req, res) => {
  const { text, entryId } = req.body;
  if (!text) return res.status(400).json({ message: "text is required" });
  if (entryId) {
    try {
      const cached = await db.query(`SELECT * FROM cache WHERE entry_id = $1`, [
        entryId,
      ]);
      if (cached.rows.length > 0) {
        const c = cached.rows[0];
        return res.json({
          emotion: c.emotion,
          keywords: c.keywords, //already parsed -JSDONb comes back as JS array
          summary: c.summary,
          cached: true,
        });
      }
    } catch (error) {}
  }
  try {
    const analysis = await analyzeEmotion(text);
    if (entryId) {
      await db.query(
        `INSERT INTO cache (entry_id,emotion,keywords,summary) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (entry_id) DO UPDATE
                SET emotion = $2, keywords = $3, summary = $4`,
        [
          entryId,
          analysis.emotion,
          JSON.stringify(analysis.keywords),
          analysis.summary,
        ],
      );
    }
    res.json({ ...analysis, cached: false });
  } catch (error) {
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

app.get("/api/journal/insights/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [totalRes, emotionRes, ambienceRes, keywordRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM journal WHERE user_id = $1`, [userId]),
      db.query(
        `SELECT c.emotion,COUNT(*) as freq
            FROM cache c
            JOIN journal j on c.entry_id = j.id
            WHERE j.user_id = $1
            GROUP BY c.emotion ORDER BY freq desc LIMIT 1`,
        [userId],
      ),
      db.query(
        `SELECT ambience,COUNT(*) as freq
                FROM journal WHERE user_id = $1
                GROUP BY ambience ORDER by freq DESC LIMIT 1`,
        [userId],
      ),
      db.query(
        `SELECT c.keywords
                  FROM cache c
                  JOIN journal j ON c.entry_id = j.id
                  WHERE j.user_id = $1
                  ORDER BY c.created_at DESC LIMIT 5`,
        [userId],
      ),
    ]);

    const recentKeywords = [
      ...new Set(keywordRes.rows.flatMap((r) => r.keywords)),
    ].slice(0, 6);
    res.json({
      totalEntries: parseInt(totalRes.rows[0].count),
      topEmotion: emotionRes.rows[0]?.emotion || null,
      mostUsedAmbience: ambienceRes.rows[0]?.ambience || null,
      recentKeywords,
    });
  } catch (error) {console.error("error message :",error.message);
    res.status(500).json({message : "something went wrong"})
  }
});

app.listen(PORT, () => {
  console.log(`server currently running on ${PORT}`);
});
