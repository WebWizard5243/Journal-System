# ARCHITECTURE.md — ArvyaX Journal System

---

## Current Architecture

The system is a straightforward REST API built with Node.js + Express, backed by a PostgreSQL database (Neon), with Google Gemini 2.5 Flash handling emotion analysis. User identity is anonymous — a UUID is generated client-side and stored in localStorage, requiring no auth system.

```
React Frontend
      │
      ▼
Express REST API (Node.js)
      │
      ├──► PostgreSQL (Neon)
      │      ├── journal         (entries)
      │      └── cache           (analysis results)
      │
      └──► Gemini 1.5 Flash API  (emotion analysis)
```

---

## 1. How would you scale this to 100,000 users?

The current single-server setup would buckle under 100k users. The bottleneck areas are the API server, the database, and the LLM calls. Here's how each gets addressed:

**API Layer — horizontal scaling:**
Run multiple instances of the Express server behind a load balancer (e.g. NGINX or AWS ALB). Each instance is stateless — no session data lives on the server — so requests can be distributed freely across instances. Container orchestration via Kubernetes or AWS ECS handles spinning instances up and down based on traffic.

**Database — connection pooling + read replicas:**
PostgreSQL with a single connection handles maybe a few hundred concurrent users. At scale, PgBouncer is introduced as a connection pooler sitting between the API and the database, reducing the number of actual DB connections. For read-heavy endpoints like `GET /journal/:userId` and `GET /insights/:userId`, read replicas are added so reads don't compete with writes on the primary instance.

**LLM calls — async job queue:**
At 100k users, hitting Gemini synchronously on every analyze request creates a bottleneck. Analysis requests are pushed onto a job queue (BullMQ + Redis) and processed by worker processes asynchronously. The frontend polls for the result or receives it via a webhook. This decouples the API response time from Gemini's latency.

**Caching layer — Redis:**
A Redis cache sits in front of the database for frequently accessed data like insights. A user's insights don't need to be recalculated on every request — cache them for 5-10 minutes and invalidate when a new entry is added.

```
                    ┌─────────────┐
                    │ Load Balancer│
                    └──────┬──────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         API Server   API Server   API Server
              │
         ┌────┴────┐
         ▼         ▼
       Redis    PgBouncer
     (cache)       │
                   ▼
             PostgreSQL
            Primary + Replicas
```

---

## 2. How would you reduce LLM cost?

Even on the free tier, LLM calls are the most expensive operation in the system — in time if not money. Three strategies reduce this significantly:

**Strategy 1 — Cache aggressively (already implemented):**
Every analysis result is stored in the `cache` table keyed by `entry_id`. If the same entry is analyzed again, the cached result is returned instantly without touching Gemini. This is the single most impactful cost reduction.

**Strategy 2 — Batch similar entries:**
Instead of analyzing one entry per API call, group multiple short entries into a single Gemini request. A single prompt can ask for analysis of 3-5 entries at once, using one API call instead of five. This is especially effective for the insights endpoint which aggregates across many entries.

**Strategy 3 — Semantic deduplication:**
Before calling Gemini, check if a semantically similar entry has already been analyzed. Two entries like "I felt peaceful by the ocean" and "The ocean made me feel at peace" would both hit the API separately today. With text similarity checking (cosine similarity on embeddings), the second call can be skipped and the cached result reused.

**Strategy 4 — Model tiering:**
Use a cheaper/faster model (Gemini Flash) for simple short entries and only escalate to a more powerful model for longer, more complex entries above a certain word count threshold.

---

## 3. How would you cache repeated analysis?

Caching is already implemented in the current system at the database level. Here's the full strategy across layers:

**Layer 1 — Database cache (implemented):**
The `cache` table stores every Gemini response keyed by `entry_id` with a unique constraint. On every `/analyze` request, the database is checked first. If a result exists, it is returned immediately with `cached: true` in the response. The LLM is never called for the same entry twice.

```js
// Check cache before calling Gemini
const cached = await db.query(
  `SELECT * FROM cache WHERE entry_id = $1`, [entryId]
);
if (cached.rows.length > 0) return cached result;

// Only reaches here on cache miss
const analysis = await analyzeEmotion(text);
// Store in cache for next time
await db.query(`INSERT INTO cache ...`);
```

**Layer 2 — Redis cache (at scale):**
For the insights endpoint, results are cached in Redis with a TTL of 10 minutes. Insights are expensive to compute (4 parallel DB queries with JOINs) and don't need to be real-time. The cache is invalidated whenever the user adds a new journal entry.

**Layer 3 — HTTP cache headers:**
For the `GET /journal/:userId` endpoint, `Cache-Control` headers are added so the browser and any CDN layer can cache the response for a short window, reducing unnecessary repeat requests.

---

## 4. How would you protect sensitive journal data?

Journal entries are deeply personal mental health data. Protection happens at multiple levels:

**Encryption at rest:**
The PostgreSQL database is hosted on Neon which encrypts all data at rest by default using AES-256. For additional protection, sensitive fields like `text` in the journal table can be encrypted at the application level before writing to the database using a library like `crypto` (Node.js built-in), so even a database breach doesn't expose raw journal content.

**Encryption in transit:**
All communication between the frontend, backend, and database uses HTTPS/TLS. The Neon connection string enforces SSL (`rejectUnauthorized: false` for compatibility, upgradeable to full certificate verification in production).

**User data isolation:**
Every database query is scoped to a `user_id`. There is no endpoint that returns data across users. Parameterized queries (`$1`, `$2`) are used throughout, preventing SQL injection attacks.

**Rate limiting:**
The `/analyze` endpoint is rate limited to 100 requests per 15 minutes per IP, preventing abuse and brute force attempts.

**No PII collection:**
The system collects no personally identifiable information. User identity is an anonymous UUID — no name, email, or phone number is ever stored. This significantly reduces privacy risk and regulatory exposure (GDPR, HIPAA).

**Future additions for production:**
- Row-level security (RLS) in PostgreSQL so database-level access is scoped per user
- JWT-based authentication replacing the anonymous UUID system
- Audit logging for all data access
- Automatic data retention policies — entries older than X days are purged or archived

---

## Summary Table

| Concern | Current Solution | At Scale |
|---|---|---|
| Traffic | Single Express server | Load balancer + multiple instances |
| Database | Neon PostgreSQL | PgBouncer + read replicas |
| LLM cost | DB-level cache | Batching + semantic dedup + model tiering |
| Analysis cache | `cache` table in PostgreSQL | Redis + DB cache |
| Data protection | HTTPS + parameterized queries + UUID identity | Application-level encryption + RLS + JWT auth |