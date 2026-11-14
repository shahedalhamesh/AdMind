# AdMind: setup and run guide

AdMind is a multi-tenant SaaS for marketing agencies. This guide runs the whole backend on one Windows machine
(Laragon). For the API itself, see `AdMind-Frontend-Brief.md`.

## 1. What runs where

| Part | Tech | Default address | Started with |
|---|---|---|---|
| Laravel API | PHP 8.1, Laravel 10, Sanctum, MySQL | `http://127.0.0.1:8080` | `php artisan serve --port=8080` |
| Queue worker | Laravel queue (database driver) | no port | `php artisan queue:work --timeout=900` |
| AI service | Python, FastAPI, CrewAI | `http://127.0.0.1:8000` | `uv run uvicorn api:app --port 8000` (inside `ai-service`) |

You need **all three running** at the same time (three terminal windows). The frontend talks only to the Laravel API;
Laravel talks to the AI service; the AI service is never called from a browser.

The queue worker runs the slow jobs (AI requests, meeting transcription, image and reel generation). If it is not running,
AI requests stay `running` forever.

## 2. Requirements

- Windows with **Laragon** (PHP 8.1+, MySQL, Composer) or an equivalent.
- **Git**.
- **Python 3.12** and **uv** (<https://docs.astral.sh/uv/>).
- Internet access (the AI model, Hugging Face Spaces for images/videos, and the voice service are online).
- Accounts (all have a free tier): a **Gemini API key** (Google AI Studio), a **Hugging Face token** (Read), and optionally a Google Cloud OAuth Client ID for Google sign-in.

## 3. First-time setup

### 3.1 Get the code
```
git clone https://github.com/shahedalhamesh/AdMind.git
cd AdMind
git checkout ai-crewai
```

### 3.2 Laravel
```
composer install
copy .env.example .env
php artisan key:generate
```
Create an empty MySQL database named `admind` (phpMyAdmin or `CREATE DATABASE admind CHARACTER SET utf8mb4;`), then edit `.env`:

```
DB_DATABASE=admind
DB_USERNAME=root
DB_PASSWORD=
QUEUE_CONNECTION=database

AI_SERVICE_URL=http://127.0.0.1:8000
AI_SERVICE_KEY=<a long random string, the SAME value as in ai-service/.env>
GOOGLE_CLIENT_ID=<optional: the Google OAuth Web client id>
```
Make a random key with: `php -r "echo bin2hex(random_bytes(24));"`.

Then create the tables and the demo data:
```
php artisan migrate --seed
```
Files (recordings, uploaded and generated media) are stored privately under `storage/app`; no `storage:link` is needed.

### 3.3 AI service
```
cd ai-service
uv sync
```
Create `ai-service/.env` (never commit it). The variables:

| Variable | Meaning |
|---|---|
| `MODEL` | the language model, currently `gemini/gemini-2.5-flash` |
| `GEMINI_API_KEY` | Google AI Studio key |
| `AI_SERVICE_KEY` | must equal `AI_SERVICE_KEY` in the Laravel `.env` |
| `EMBED_MODEL`, `FASTEMBED_CACHE_PATH` | embedding model and its local cache folder |
| `HF_TOKEN` | Hugging Face token (Read) for image, video and music Spaces |
| `MAX_RPM` | requests per minute limit towards the model (free tiers are small) |
| `DEBUG_ENDPOINTS` | `0` normally; `1` only while debugging |
| `WHISPER_MODEL` | speech-to-text model size: `base` (fast, English) or `small` / `medium` (better Arabic, slower) |
| `VOICE_RATE_EN`, `VOICE_RATE_AR` | optional: voiceover speed, default `-8%` and `-6%` |
| `IMAGE_SPACE`, `VIDEO_SPACE`, `MUSIC_SPACE` | optional: override the Hugging Face Spaces used |

On Windows, if a Hugging Face download hangs, set `$env:HF_HUB_DISABLE_XET="1"` in that PowerShell session before starting.
The first transcription downloads the Whisper model (a few hundred MB for `base`).

## 4. Every day: start the three services

Window 1, the API:
```
cd C:\laragon\www\AdMind
php artisan serve --port=8080
```
Window 2, the worker:
```
cd C:\laragon\www\AdMind
php artisan queue:work --timeout=900
```
Window 3, the AI service:
```
cd C:\laragon\www\AdMind\ai-service
uv run uvicorn api:app --port 8000
```

When to restart: the worker keeps the code in memory, so restart it after changing any Job or Service file, or `.env`.
`artisan serve` reads controllers and routes on every request, but restart it after changing `.env` or config.

Quick checks: `http://127.0.0.1:8000/health` returns `{"status":"ok"}`; `http://127.0.0.1:8000/docs` is the AI service's Swagger page;
`POST http://127.0.0.1:8080/api/login` works with a demo account.

## 5. Demo accounts (development only)

Password for all: `password`.

| Email | Role |
|---|---|
| `admin@admind.test` | Platform Admin (no company) |
| `owner@demo.test` | Owner of "Demo Agency" |
| `manager@demo.test` | Manager |
| `employee@demo.test` | Employee |
| `client@demo.test` | the client's own login (client "Demo Client") |

Change or remove these accounts before any real deployment.

**Teach the AI about the demo client** (once): sign in as Owner and save the client's brand profile with
`PUT /api/clients/1/profile` (and add documents with `POST /api/clients/1/documents`). The AI uses these to write in the client's voice.

## 6. Testing with Postman

Import `AdMind-API.postman_collection.json`. Sign in with one of the `Auth` requests: the token is saved in the collection
variable `token` and used by every other request. Use **Replace** when re-importing an updated collection, and sign in again after.

## 7. Sign-in with Google (optional)

1. In Google Cloud Console create an OAuth client of type **Web application**.
2. Add the frontend origin (for example `http://localhost:5173`) under **Authorised JavaScript origins**.
3. Put the client id in `GOOGLE_CLIENT_ID` in the Laravel `.env`. No client secret is needed.

Google only proves the email: it must belong to an existing active AdMind account. Accounts are created by invitation links
or by the Owner, never by Google sign-in.

## 8. Free-tier limits you will meet

- **Gemini**: a small daily request quota. When it runs out, AI runs end `failed`; it resets daily.
- **Hugging Face ZeroGPU** (images, videos, reels): a daily GPU quota per account. When it is used up, media jobs fail with "exceeded your ZeroGPU runs limit"; try again the next day.
- Only one image or video is generated at a time (a second request gets `429`).
- A reel takes 2 to 12 minutes.
- Background music is currently unavailable (the Space it used is gone); reels are made without it and a warning is shown.

## 9. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| AI request stays `running` | the queue worker is not running: start it (window 2) |
| `Cannot reach the AI service ... Connection refused` | the AI service is not running (window 3) |
| `AI service error 401: Invalid or missing API key` | `AI_SERVICE_KEY` differs between the two `.env` files, or a service was not restarted. Check there are no spaces before the name or around `=` |
| `Route [login] not defined` | the request had no token or no `Accept: application/json` header |
| `403 Invalid signature` on a media link | the link was copied with quotes or cut; copy the whole `url` without quotes (links last 2 hours) |
| `exceeded your ZeroGPU runs limit` | the daily GPU quota is finished; wait until tomorrow |
| Gemini `429` / quota errors | the daily model quota is finished; wait or use another key |
| Postman `Unauthenticated` after re-importing | sign in again (the token variable was reset) |
| Everything seems stuck after a crash | stop the three windows and start them again in order: AI service, worker, API |

## 10. Security notes

- Never commit `.env` files or paste keys and tokens in chats, tickets or screenshots. If one leaks, create a new one and delete the old one.
- Keep `AI_SERVICE_KEY` long and random; it is the only thing protecting the AI service.
- Keep `DEBUG_ENDPOINTS=0` and `APP_DEBUG=false` outside development.
- Uploaded and generated files are private: they are served only through short-lived signed links.
- Recording a meeting needs the participants' consent.

## 11. Repository layout

```
app/Http/Controllers/Api/   the API controllers
app/Jobs/                   background jobs (AI runs, transcription, media generation)
app/Services/               AiService (talks to the AI service), ContentService, ReportService
app/Models/                 Eloquent models (tenant-scoped with BelongsToCompany)
config/permissions.php      the default permissions of each role
database/migrations/        the schema; database/seeders/ the demo data
routes/api.php              every API route and its permission
ai-service/                 the FastAPI + CrewAI service (agents, memory, media, transcription)
```

## 12. Not built yet

- Automatic posting to Instagram and Facebook (posting is recorded manually today).
- Sending emails (invitation links are copied and sent by hand).
- Background music for reels.
