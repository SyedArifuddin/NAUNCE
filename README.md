<div align="center">

<!-- Animated title -->
<img src="https://readme-typing-svg.demolab.com?font=Cormorant+Garamond&weight=700&size=52&duration=3000&pause=1000&color=8F1F24&center=true&vCenter=true&width=700&height=90&lines=NAUNCE;Cultural+Intelligence+Platform;Communication+Beyond+Translation" alt="NAUNCE Typing SVG" />

<br/>

<!-- Badges -->
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-AI_Engine-8F1F24?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![JWT](https://img.shields.io/badge/Auth-JWT-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![HTML5](https://img.shields.io/badge/Frontend-HTML5%2FVanilla_JS-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![License](https://img.shields.io/badge/License-MIT-a42a30?style=for-the-badge)](LICENSE)

<br/>

> *"Words translate meaning, but culture translates intent."*

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12&height=120&section=header&text=&fontSize=0" width="100%"/>

</div>

---

## 🧬 What is NAUNCE?

**NAUNCE** is a **Cultural Intelligence Platform** that decodes the *Cultural DNA* of written communication. Unlike standard translation tools, NAUNCE goes three layers deep:

| Layer | What it does |
|---|---|
| 🔤 **Literal Translation** | Flags phrases that lose meaning or cause offense when translated directly |
| 🎭 **Emotional Tone Analysis** | Measures respect, warmth, urgency, and harm risk in real-time |
| 🌍 **Cultural Context Dossier** | Provides audience-specific guidance on cultural resonance |

All three combine into a single **Adaptability Score (0–100)** — your message's cross-cultural fitness rating.

---

## ✨ Live Features

<div align="center">

```
┌───────────────────────────────────────────────────────────┐
│                    NAUNCE Dashboard                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐    │
│  │  Analysis   │  │  Adaptability│  │  Safety       │    │
│  │  Studio     │  │  Score Ring  │  │  Distribution │    │
│  │  ▸ Voice in │  │   ╭──────╮   │  │  Safe   ████░│    │
│  │  ▸ File drop│  │   │  87  │   │  │  Caution ██░░│    │
│  │  ▸ Translate│  │   ╰──────╯   │  │  Risk   █░░░░│    │
│  └─────────────┘  └──────────────┘  └───────────────┘    │
└───────────────────────────────────────────────────────────┘
```

</div>

### 🎯 Core Capabilities

- 📝 **Text & File Analysis** — Paste text or drag-drop `.pdf`, `.txt`, `.docx`
- 🗣️ **Voice Input / Output** — Speak your message; hear translations via Edge TTS
- 🌐 **10-Language Translation** — English, Urdu, Telugu, Hindi, Arabic, French, Spanish, German, Chinese, Japanese
- 📊 **Communication Fingerprint** — Clarity, Inclusiveness, Respect, Warmth, Harm Risk
- 🎨 **Live Animated Background** — Full-screen canvas with aurora waves, glowing orbs & rising particles
- 🔐 **JWT Authentication** — Secure login/signup with token-based sessions

---

## 🏗️ Architecture

```mermaid
graph TD
    A[Browser - Frontend] -->|JWT Bearer Token| B[FastAPI Backend]
    A -->|Canvas Animation| C[Live Background Engine]
    B -->|GEMINI_API_KEY from .env| D[Google Gemini 2.0 Flash]
    B -->|GoogleTranslator| E[Translation Service]
    B -->|edge-tts| F[Voice Synthesis]
    B -->|psycopg2| G[(PostgreSQL - Supabase)]
    B -->|load_dotenv| H[.env Secrets]
```

---

## 🗂️ Project Structure

```
NAUNCE/
├── 📁 frontend/
│   ├── index.html          # Login page with animated background
│   ├── signup.html         # Registration page
│   ├── dashboard.html      # Main analysis dashboard
│   ├── styles.css          # Design system — white/red palette, animations
│   └── app.js              # Analysis engine, voice, translation, file handling
│
├── 📁 backend/
│   ├── main.py             # FastAPI app — auth, analyze, translate, speak, chat
│   ├── schema.sql          # PostgreSQL schema
│   ├── requirements.txt    # Python dependencies
│   ├── .env                # 🔒 Never committed — contains secrets
│   └── .env.example        # Template for environment setup
│
├── .gitignore              # Excludes .env and cache files
└── README.md               # This file
```

---

## ⚙️ Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS, Vanilla JS (ES6+) |
| **Backend** | Python 3.10+, FastAPI, Uvicorn |
| **Database** | PostgreSQL (hosted on Supabase) |
| **AI / Chat** | Google Gemini 2.0 Flash (via backend proxy) |
| **Translation** | `deep-translator` → Google Translate |
| **Voice** | Microsoft Edge TTS (`edge-tts`) |
| **Auth** | JWT (`python-jose`), bcrypt (`passlib`) |
| **File Parsing** | `pypdf`, `python-docx` |
| **HTTP Client** | `httpx` (async Gemini proxy) |
| **Typography** | Cormorant Garamond, Syne, JetBrains Mono |

</div>

---

## 🚀 Run Locally

### Prerequisites

- Python 3.10+
- A PostgreSQL database (or free [Supabase](https://supabase.com) project)
- A free [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Clone the repository

```bash
git clone https://github.com/SyedArifuddin/NAUNCE.git
cd NAUNCE
```

### 2. Set up the backend

```bash
cd backend
python -m pip install -r requirements.txt
```

Create your `.env` file from the example:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET_KEY=your_secure_random_secret
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the backend:

```bash
python -m uvicorn main:app --reload
```

> Backend runs at `http://127.0.0.1:8000`

### 3. Open the frontend

Open `frontend/index.html` in your browser (no build step needed).

---

## 🔒 Security

| What | How |
|---|---|
| API keys | Stored in `backend/.env` — never in source code |
| Gemini key | Backend-proxied — **never reaches the browser** |
| Passwords | Hashed with `pbkdf2_sha256` via `passlib` |
| Sessions | Short-lived JWT tokens (60 min expiry) |
| `.env` | Blocked from git by `.gitignore` |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/analyze` | Run cultural DNA analysis on text |
| `POST` | `/api/translate` | Translate text to a target language |
| `POST` | `/api/speak` | Synthesize speech (Edge TTS) |
| `GET` | `/api/dashboard` | Fetch trend scores and marker analytics |
| `GET` | `/health` | Backend health check |

---

## 🎨 Design System

```
Color Palette
─────────────────────────────────────────
  #8F1F24  ██  Deep Red (terracotta)
  #A42A30  ██  Gold (accent)
  #FFFFFF  ██  Pure White (background)
  #FFE6EA  ██  Blush (gradient end)
  #1D1F24  ██  Near-black (text)
  #5F656F  ██  Muted (secondary text)

Typography
─────────────────────────────────────────
  Cormorant Garamond  →  Headings (editorial, serif)
  Syne                →  UI text (modern, geometric)
  JetBrains Mono      →  Data / code values

Animations
─────────────────────────────────────────
  ▸ Aurora canvas waves  (sine-wave strokes, 4 layers)
  ▸ Drifting glow orbs   (radial-gradient blobs, 6 orbs)
  ▸ Rising particles     (55 glowing dots, fade lifecycle)
  ▸ Float cards          (CSS keyframes, staggered)
  ▸ SVG ring animation   (stroke-dashoffset progress)
  ▸ Fade-up page load    (opacity + translateY)
```

---

## 👤 Author

<div align="center">

**Syed Arifuddin**

[![GitHub](https://img.shields.io/badge/GitHub-SyedArifuddin-181717?style=for-the-badge&logo=github)](https://github.com/SyedArifuddin)

*Built with ❤️ and a passion for culturally intelligent communication.*

</div>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12&height=100&section=footer" width="100%"/>

**NAUNCE** — *Decode the Cultural DNA of every message.*

</div>
