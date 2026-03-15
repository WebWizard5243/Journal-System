import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

async function analyzeEmotion(text) {
  const prompt = `
You are a mental wellness analyzer. Analyze the following journal entry and respond ONLY with valid JSON — no markdown, no explanation.

Journal entry: "${text}"

Respond with exactly this structure:
{
  "emotion": "single dominant emotion word",
  "keywords": ["word1", "word2", "word3"],
  "summary": "one sentence summary of the user's mental state"
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