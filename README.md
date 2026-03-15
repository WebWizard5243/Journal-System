# AI-Assisted Journal System

A nature-session journaling app with LLM-powered emotion analysis and mental wellness insights.
#### p.s : the server is hosted online but the backend server takes 60s to boot up please wait.
---

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Backend  | Node.js + Express           |
| Database | PostgreSQL (Neon)           |
| LLM      | Google Gemini 1.5 Flash     |
| Frontend | React (Lovable)             |

---

## Project Structure

```
backend/
├── llm/
│   └── llmCall.js        # Gemini API integration
├── .env                  # Environment variables
├── server.js             # Express app + all routes
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A PostgreSQL database (Neon, Supabase, or Railway)
- A Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### Installation

```bash
git clone https://github.com/your-username/arvyax-journal.git
cd arvyax-journal/backend
npm install
```

### Environment Variables

Create a `.env` file in the backend root:

```env
PORT=5001
NEON_DATABASE_STRING=postgresql://user:password@host/dbname
GEMINI_API_KEY=your_gemini_api_key_here
```

### Database Setup

Run the following SQL in your PostgreSQL provider's query editor:

```sql
CREATE TABLE IF NOT EXISTS journal (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  ambience    TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cache (
  id          SERIAL PRIMARY KEY,
  entry_id    INTEGER     NOT NULL UNIQUE REFERENCES journal(id) ON DELETE CASCADE,
  emotion     TEXT,
  keywords    JSONB,
  summary     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5001`

---

## API Endpoints

### POST `/api/journal`
Save a new journal entry.

**Request body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

**Response:**
```json
{
  "id": 1,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain.",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### GET `/api/journal/:userId`
Retrieve all journal entries for a user.

**Response:**
```json
[
  {
    "id": 1,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "ambience": "forest",
    "text": "I felt calm today after listening to the rain.",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### POST `/api/journal/analyze`
Analyze a journal entry's emotion using Gemini. Results are cached — calling this twice with the same `entryId` will return the cached result without hitting the LLM again.

**Request body:**
```json
{
  "text": "I felt calm today after listening to the rain.",
  "entryId": 1
}
```

**Response:**
```json
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "User experienced relaxation during the forest session.",
  "cached": false
}
```

---

### GET `/api/journal/insights/:userId`
Get aggregated mental wellness insights for a user.

**Response:**
```json
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain", "peace", "calm"]
}
```

---

## Features

- **Emotion analysis** via Google Gemini 2.5 Flash
- **Analysis caching** — same entry is never sent to the LLM twice
- **Rate limiting** — `/api/journal/analyze` limited to 100 requests per 15 minutes
- **Insights aggregation** — top emotion, most used ambience, recent keywords
- **Anonymous user identity** — UUID generated client-side, stored in localStorage

---

## User Identity

There is no authentication. When a user first opens the app, the frontend generates a UUID using `crypto.randomUUID()` and stores it in `localStorage`. This ID is sent with every API request and persists across sessions.

---

