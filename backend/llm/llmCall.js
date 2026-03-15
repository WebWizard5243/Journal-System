import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

async function analyzeEmotion(text) {
  const prompt = `
You are an expert mental wellness analyst with a background in psychology. 
Analyze the emotional and psychological state of the user based on their journal entry.
Go BEYOND what the user explicitly says — infer underlying emotions, patterns, and mental state.

Journal entry: "${text}"
Ambience: nature session

Rules:
- The emotion must be a single precise psychological term (e.g. "tranquil", "anxious", "nostalgic", "overwhelmed", "grounded")
- Keywords must be thematic concepts, NOT just words from the entry (e.g. "mindfulness", "emotional-release", "inner-peace")
- The summary must provide a genuine psychological insight — not a restatement of what the user wrote
- Summary should be 1-2 sentences and sound like a therapist's observation

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "emotion": "single precise emotion word",
  "keywords": ["theme1", "theme2", "theme3"],
  "summary": "psychological insight about the user's mental state"
}
`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    }
  );

  const raw = response.data.candidates[0].content.parts[0].text.trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export default  analyzeEmotion ;