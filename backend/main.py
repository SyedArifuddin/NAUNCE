# NAUNCE AI Service - Unified Production Build
import os
import asyncio
import httpx
from io import BytesIO
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import psycopg2
import edge_tts
from deep_translator import GoogleTranslator
from docx import Document
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from pypdf import PdfReader

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv() # Fallback for Vercel

app = FastAPI(title="NAUNCE API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
security = HTTPBearer()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
# We will fetch these dynamically in the functions to ensure Vercel's latest config is picked up
def get_db_url():
    return os.getenv("NAUNCE_DB_URL", "")

def get_gemini_key():
    return os.getenv("GEMINI_API_KEY", "")


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    primary_language: str = "English"


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class AnalyzePayload(BaseModel):
    text: str = Field(min_length=2)
    language: Optional[str] = "auto"


class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    text: str


class ChatPayload(BaseModel):
    message: str = Field(min_length=1)
    analysis_context: Optional[str] = None
    history: Optional[List[ChatMessage]] = []


class TranslatePayload(BaseModel):
    text: str = Field(min_length=1)
    target_language: str = Field(min_length=2, default="en")
    source_language: Optional[str] = "auto"
    tone: Optional[str] = "neutral"
    persona: Optional[str] = "general"


class SpeakPayload(BaseModel):
    text: str = Field(min_length=1)
    target_language: str = Field(min_length=2, default="en")
    style: str = Field(default="professor")


SPEAK_VOICE_MAP = {
    "en": "en-US-JennyNeural",
    "ur": "ur-PK-UzmaNeural",
    "te": "te-IN-ShrutiNeural",
    "hi": "hi-IN-SwaraNeural",
    "ar": "ar-SA-ZariyahNeural",
    "fr": "fr-FR-DeniseNeural",
    "es": "es-ES-ElviraNeural",
    "de": "de-DE-KatjaNeural",
    "zh-cn": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "it": "it-IT-ElsaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ko": "ko-KR-SunHiNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "nl": "nl-NL-ColetteNeural",
    "tr": "tr-TR-EmelNeural",
    "sv": "sv-SE-SofieNeural",
    "pl": "pl-PL-ZofiaNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "th": "th-TH-PremwadeeNeural",
}


def resolve_language_code(language_input: str) -> str:
    normalized = (language_input or "").strip().lower()
    if not normalized:
        return "en"

    normalized = normalized.replace("language", "").replace("lang", "").strip()

    supported = GoogleTranslator().get_supported_languages(as_dict=True)
    # supported format: {"english": "en", "urdu": "ur", ...}
    code_to_name = {code.lower(): name for name, code in supported.items()}
    normalized_compact = normalized.replace("_", "-").replace(" ", "")

    aliases = {
        "zh": "zh-cn",
        "zhcn": "zh-cn",
        "chinese": "zh-cn",
        "chinesesimplified": "zh-cn",
        "chinese(simplified)": "zh-cn",
        "mandarin": "zh-cn",
        "telgu": "te",
        "telegu": "te",
        "urdu": "ur",
        "hindi": "hi",
        "telugu": "te",
        "arabic": "ar",
        "french": "fr",
        "spanish": "es",
        "german": "de",
        "japanese": "ja",
        "english": "en",
        "italiano": "it",
        "italian": "it",
        "portuguese": "pt",
        "portugais": "pt",
        "korean": "ko",
        "hangul": "ko",
        "russian": "ru",
        "turkish": "tr",
        "dutch": "nl",
        "swedish": "sv",
        "polish": "pl",
        "vietnamese": "vi",
        "thai": "th",
    }

    if normalized in code_to_name:
        return normalized
    if normalized_compact in code_to_name:
        return normalized_compact
    if normalized in supported:
        return supported[normalized].lower()
    if normalized_compact in aliases:
        return aliases[normalized_compact]
    if normalized in aliases:
        return aliases[normalized]

    # forgiving match for close names, e.g. "chinese simplified"
    for name, code in supported.items():
        name_compact = name.lower().replace(" ", "")
        if normalized_compact == name_compact or normalized_compact in name_compact:
            return code.lower()

    # try first token or short code fallback before failing
    first_token = normalized.split(" ")[0]
    if first_token in aliases:
        return aliases[first_token]
    if first_token in supported:
        return supported[first_token].lower()
    if first_token in code_to_name:
        return first_token
    if len(first_token) >= 2 and first_token[:2] in code_to_name:
        return first_token[:2]

    return "en"


def get_db_connection():
    db_url = get_db_url()
    print(f"DEBUG: Attempting connection. URL Length: {len(db_url)}")
    if not db_url:
        print("DEBUG: Connection failed - URL IS EMPTY")
        raise HTTPException(status_code=500, detail="NAUNCE_DB_URL is missing in environment")
    try:
        return psycopg2.connect(db_url)
    except Exception as e:
        print(f"DEBUG: Connection failed - {e}")
        raise e


def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    primary_language TEXT NOT NULL DEFAULT 'English',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS analysis_history (
                    id SERIAL PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    adaptability_score INTEGER NOT NULL,
                    literal_translation JSONB DEFAULT '[]',
                    emotional_tone JSONB NOT NULL,
                    cultural_context TEXT,
                    markers JSONB DEFAULT '[]',
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS chat_history (
                    id SERIAL PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    message TEXT NOT NULL,
                    reply TEXT NOT NULL,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            conn.commit()


@app.on_event("startup")
def on_startup():
    try:
        init_db()
        print("Database initialized successfully.")
    except Exception as exc:
        print(f"Database initialization failed: {exc}")
        # We don't re-raise here so the app can still start and serve /health


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token subject")
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT email, primary_language FROM users WHERE email = %s",
                    (email,),
                )
                user = cur.fetchone()
                if not user:
                    raise HTTPException(status_code=401, detail="Invalid token subject")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Token validation failed") from exc
    return {"email": user[0], "primary_language": user[1]}


@app.get("/health")
def health():
    db_url = get_db_url()
    peek = ""
    if db_url:
        peek = f"{db_url[:5]}...{db_url[-5:]}" if len(db_url) > 10 else "too short"
    
    # Safely list all environment variable names to find the missing one
    env_keys = list(os.environ.keys())
    
    # Check for subtle typos or spaces in key names
    naunce_lookalikes = [k for k in env_keys if "NAUNCE" in k.upper()]
    
    return {
        "status": "ok", 
        "service": "naunce-api",
        "database_configured": bool(db_url),
        "db_url_length": len(db_url),
        "db_url_peek": peek,
        "available_env_keys_count": len(env_keys),
        "naunce_keys_found": naunce_lookalikes,
        "vercel_project_name": os.getenv("VERCEL_PROJECT_NAME", "unknown"),
        "vercel_env": os.getenv("VERCEL_ENV", "unknown")
    }


@app.post("/api/auth/register")
def register(payload: RegisterPayload):
    password_hash = pwd_context.hash(payload.password)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (email, password_hash, primary_language)
                    VALUES (%s, %s, %s)
                    """,
                    (payload.email.lower(), password_hash, payload.primary_language),
                )
                conn.commit()
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="User already exists") from exc
    return {"message": "Registration successful"}


@app.post("/api/auth/login")
def login(payload: LoginPayload):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT email, password_hash, primary_language
                FROM users
                WHERE email = %s
                """,
                (payload.email.lower(),),
            )
            row = cur.fetchone()

    if not row or not pwd_context.verify(payload.password, row[1]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=row[0])
    return {"access_token": token, "token_type": "bearer", "email": row[0]}


@app.post("/api/analyze")
async def analyze(payload: AnalyzePayload, user=Depends(get_current_user)):
    api_key = get_gemini_key()
    if not api_key:
        # Fallback to lite logic if key is missing
        text = payload.text.lower()
        score = max(40, min(95, 64 + (8 if "please" in text else -7)))
        return {
            "user": user["email"],
            "adaptability_score": score,
            "literal_translation": ["AI key missing, using lite analysis."],
            "emotional_tone": {"respect": 70, "urgency": 50, "warmth": 60},
            "cultural_context": "Lite mode active.",
            "markers": ["lite-analysis"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    system_prompt = (
        "You are Naunce AI, a cultural communication expert. Perform a deep, highly accurate analysis of the input text emotionally, culturally, and physically (e.g. implied body language, physiological tension, directness).\n"
        "1. Adaptability Score (0-100): How well it fits diverse cultural contexts.\n"
        "2. Literal Translation Risks: Phrases that might be misunderstood if translated literally.\n"
        "3. Metrics (0-100 each): respect, warmth, urgency, clarity, inclusiveness, and physical_tension.\n"
        "4. Cultural Context: A short paragraph explaining the communication DNA, including emotional undertones and physical implications.\n"
        "5. Linguistic Markers: 3-5 keywords representing the tone (e.g. 'izzat', 'directness').\n\n"
        "Return ONLY a valid JSON object with these precise keys (no markdown): score, risks (list of strings), respect, warmth, urgency, clarity, inclusiveness, physical_tension, context, markers (list of strings)."
    )

    body = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": payload.text}]}],
        "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
    }

    try:
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(gemini_url, json=body)
            
        if not resp.is_success:
            print(f"Gemini API returned {resp.status_code}: {resp.text}")
            raise Exception(f"AI API failed with status {resp.status_code}")
        
        data = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        
        # Clean potential markdown JSON wrapping
        data = data.strip()
        if data.startswith("```json"):
            data = data[7:]
        elif data.startswith("```"):
            data = data[3:]
        if data.endswith("```"):
            data = data[:-3]
        data = data.strip()
        
        import json
        analysis = json.loads(data)

        response = {
            "user": user["email"],
            "adaptability_score": analysis.get("score", 50),
            "literal_translation": analysis.get("risks", []),
            "emotional_tone": {
                "respect": analysis.get("respect", 50),
                "urgency": analysis.get("urgency", 50),
                "warmth": analysis.get("warmth", 50),
                "physical_tension": analysis.get("physical_tension", 0)
            },
            "clarity": analysis.get("clarity", 85),
            "inclusiveness": analysis.get("inclusiveness", 80),
            "cultural_context": analysis.get("context", "Analysis complete."),
            "markers": analysis.get("markers", []),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        print(f"Fallback. AI analysis exception: {str(exc)}")
        # Fallback to lite logic if AI fails (e.g. rate limit / quota exceeded)
        text_lower = payload.text.lower()
        score = max(40, min(95, 64 + (8 if "please" in text_lower else -7)))
        response = {
            "user": user["email"],
            "adaptability_score": score,
            "literal_translation": ["AI quota reached or unavailable. Using offline lite analysis."],
            "emotional_tone": {"respect": 65, "urgency": 45, "warmth": 55},
            "cultural_context": "Lite mode active. The detailed context requires AI server availability. Please try again in a few moments.",
            "markers": ["offline-analysis", "fallback"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    try:
        import json
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO analysis_history (user_email, adaptability_score, literal_translation, emotional_tone, cultural_context, markers)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user["email"],
                        response["adaptability_score"],
                        json.dumps(response["literal_translation"]),
                        json.dumps(response["emotional_tone"]),
                        response["cultural_context"],
                        json.dumps(response["markers"])
                    )
                )
                conn.commit()
    except Exception as db_exc:
        print(f"Failed to save analysis to DB: {db_exc}")
        
    return response


@app.get("/api/dashboard")
def dashboard(user=Depends(get_current_user)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT adaptability_score, markers FROM analysis_history WHERE user_email = %s ORDER BY timestamp DESC LIMIT 50",
                (user["email"],)
            )
            rows = cur.fetchall()
            
    trend = [r[0] for r in reversed(rows[-8:])]
    markers = {}
    import json
    for r in rows:
        ms = r[1]
        if isinstance(ms, str):
            ms = json.loads(ms)
        for marker in ms:
            markers[marker] = markers.get(marker, 0) + 1
            
    return {
        "user": user["email"],
        "total_analyses": len(rows),
        "trend_scores": trend,
        "word_cloud": markers,
    }


@app.post("/api/chat")
async def chat(payload: ChatPayload, user=Depends(get_current_user)):
    api_key = get_gemini_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not configured on server.")

    system_prompt = (
        "You are Naunce Bot, an intelligent AI assistant embedded in the NAUNCE dashboard — "
        "a cultural communication analysis platform. NAUNCE analyzes text for cultural DNA: "
        "emotional tone, literal translation risks, cultural context, and produces an Adaptability Score (0-100).\n\n"
        "Your role:\n"
        "- Answer any question the user asks clearly and helpfully\n"
        "- For questions about communication, culture, tone, language, or translation — give expert, detailed answers\n"
        "- For general knowledge questions — answer accurately like a knowledgeable AI\n"
        "- For questions about the current analysis — use the context provided\n"
    )
    if payload.analysis_context:
        system_prompt += f"\nCurrent Analysis Context:\n{payload.analysis_context}\n"

    system_prompt += "\nKeep replies concise but thorough. Use plain text (no markdown). Be warm, professional, and helpful."

    # Build conversation history for multi-turn
    contents = []
    for msg in (payload.history or []):
        contents.append({"role": msg.role, "parts": [{"text": msg.text}]})
    contents.append({"role": "user", "parts": [{"text": payload.message}]})

    body = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 512},
    }

    try:
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(gemini_url, json=body)
        if not resp.is_success:
            print(f"Chat API failed: {resp.status_code} {resp.text}")
            reply = "I'm currently resting due to high usage in the API. Please try asking me again in a few moments!"
        else:
            data = resp.json()
            reply = data["candidates"][0]["content"]["parts"][0]["text"]
            
            # Remove any markdown block wrapping if present
            reply = reply.strip()
            if reply.startswith("```"):
                lines = reply.split("\n")
                if len(lines) > 2 and lines[0].startswith("```") and lines[-1].startswith("```"):
                    reply = "\n".join(lines[1:-1]).strip()
                    
    except Exception as exc:
        print(f"Chat failure: {exc}")
        reply = "I'm currently resting due to high usage in the API. Please try asking me again in a few moments!"

    item = {
        "user": user["email"],
        "message": payload.message,
        "reply": reply,
    }
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chat_history (user_email, message, reply) VALUES (%s, %s, %s)",
                (user["email"], item["message"], item["reply"])
            )
            conn.commit()
    return item


@app.post("/api/translate")
async def translate(payload: TranslatePayload, user=Depends(get_current_user)):
    return await perform_translation(payload, user.get("email", "authenticated-user"))


async def perform_translation(payload: TranslatePayload, user_email: str):
    target_code = resolve_language_code(payload.target_language)
    source_code = (payload.source_language or "auto").lower()

    # Attempt AI Transcreation for non-neutral/non-general requests
    api_key = get_gemini_key()
    translated = None
    if api_key and (payload.tone != "neutral" or payload.persona != "general"):
        system_prompt = (
            f"You are Naunce AI Transcreator. Translate the following text into the language denoted by code '{target_code}' (or language '{payload.target_language}').\n"
            f"Crucially, adapt the translation to fit a '{payload.tone}' tone and ensure it is culturally appropriate for a '{payload.persona}' audience.\n"
            "Return ONLY the translated text. Do not include markdown blocks, explanations, or quotes."
        )
        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": payload.text}]}],
            "generationConfig": {"temperature": 0.5},
        }
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(gemini_url, json=body)
            if resp.is_success:
                data = resp.json()
                translated = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as exc:
            print(f"AI Transcreation failed, falling back to literal translation: {exc}")
            
    # Fallback to literal if AI skipped or failed
    if not translated:
        try:
            translated = GoogleTranslator(
                source=source_code,
                target=target_code,
            ).translate(payload.text)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Translation service is currently unavailable. Please try again.",
            ) from exc

    return {
        "user": user_email,
        "source_text": payload.text,
        "translated_text": translated,
        "target_language": target_code,
        "tone_applied": payload.tone,
        "persona_applied": payload.persona
    }


def apply_professor_diction(text: str) -> str:
    # Expand common academic abbreviations so speech sounds natural in class-like delivery.
    replacements = {
        "e.g.": "for example",
        "i.e.": "that is",
        "etc.": "et cetera",
        "vs.": "versus",
        "prof.": "professor",
    }
    normalized = text
    for source, target in replacements.items():
        normalized = normalized.replace(source, target).replace(source.upper(), target)
    return normalized.strip()


async def synthesize_edge_tts_stream(text: str, voice_name: str, style: str):
    rate = "+0%"
    pitch = "+0Hz"
    
    if style == "enthusiastic":
        rate = "+15%"
        pitch = "+10Hz"
    elif style == "professional":
        rate = "-5%"
        pitch = "-5Hz"
    elif style == "empathetic":
        rate = "-10%"
        pitch = "-10Hz"

    communicate = edge_tts.Communicate(text=text, voice=voice_name, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            yield chunk.get("data", b"")


@app.post("/api/speak")
async def speak(payload: SpeakPayload, user=Depends(get_current_user)):
    target_code = resolve_language_code(payload.target_language)
    text = payload.text.strip()
    
    # Normalize text specifically for TTS so it doesn't pause awkwardly on random line breaks
    import re
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    
    voice_name = SPEAK_VOICE_MAP.get(target_code)
    if not voice_name:
        raise HTTPException(
            status_code=422,
            detail=f"No configured voice for '{target_code}'.",
        )
        
    return StreamingResponse(
        synthesize_edge_tts_stream(text, voice_name, payload.style), 
        media_type="audio/mpeg"
    )


@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    filename = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        if filename.endswith(".txt"):
            extracted = content.decode("utf-8", errors="ignore")
        elif filename.endswith(".pdf"):
            pdf = PdfReader(BytesIO(content))
            extracted = "\n".join((page.extract_text() or "") for page in pdf.pages)
        elif filename.endswith(".docx"):
            doc = Document(BytesIO(content))
            extracted = "\n".join(p.text for p in doc.paragraphs)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, TXT, or DOCX.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to extract text from file.") from exc

    extracted = extracted.strip()
    
    import re
    # Fix PDF extraction issues by replacing single newlines with spaces, keeping double for paragraphs
    extracted = re.sub(r'(?<!\n)\n(?!\n)', ' ', extracted)
    
    if not extracted:
        raise HTTPException(status_code=422, detail="No readable text found in the file.")
    return {"text": extracted}
