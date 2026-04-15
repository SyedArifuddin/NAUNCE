const state = {
  text: "",
  score: 0,
  trend: [42, 49, 56, 58, 62, 70],
  markers: ["izzat", "adab", "maryada", "respect", "tone", "context"],
  context: "No analysis yet.",
  lastInputText: "",
};

const refs = {
  inputText: document.getElementById("inputText"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  processingDot: document.getElementById("processingDot"),
  literalList: document.getElementById("literalList"),
  emotionWheel: document.getElementById("emotionWheel"),
  emotionSummary: document.getElementById("emotionSummary"),
  contextSummary: document.getElementById("contextSummary"),
  ringProgress: document.getElementById("ringProgress"),
  scoreText: document.getElementById("scoreText"),
  safeBar: document.getElementById("safeBar"),
  cautionBar: document.getElementById("cautionBar"),
  riskBar: document.getElementById("riskBar"),
  safePct: document.getElementById("safePct"),
  cautionPct: document.getElementById("cautionPct"),
  riskPct: document.getElementById("riskPct"),
  clarityVal: document.getElementById("clarityVal"),
  inclusiveVal: document.getElementById("inclusiveVal"),
  respectVal: document.getElementById("respectVal"),
  warmthVal: document.getElementById("warmthVal"),
  harmVal: document.getElementById("harmVal"),
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  targetLanguage: document.getElementById("targetLanguage"),
  customLang: document.getElementById("customLang"),
  translateBtn: document.getElementById("translateBtn"),
  translatedText: document.getElementById("translatedText"),
  translateStatus: document.getElementById("translateStatus"),
  voiceSourceBadge: document.getElementById("voiceSourceBadge"),
  speakInputBtn: document.getElementById("speakInputBtn"),
  speakOutputBtn: document.getElementById("speakOutputBtn"),
  startBtn: document.getElementById("startBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
};
const API_BASE = window.location.origin;


const currentUser = localStorage.getItem("naunce_current_user");
const accessToken = localStorage.getItem("naunce_access_token");
if (!currentUser || !accessToken) {
  window.location.href = "./index.html";
}


function autoResize() {
  refs.inputText.style.height = "auto";
  refs.inputText.style.height = `${refs.inputText.scrollHeight}px`;
}

function getNormalizedInputText() {
  const raw = refs.inputText.value || "";
  // Remove zero-width characters that can appear when pasting text.
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function getBestAvailableInputText() {
  const liveText = getNormalizedInputText();
  if (liveText) {
    state.lastInputText = liveText;
    return liveText;
  }
  if (state.lastInputText) return state.lastInputText;
  if (state.text) return state.text;
  const selected = (window.getSelection && window.getSelection()?.toString()) || "";
  if (selected.trim()) return selected.trim();
  return "";
}

function detectLanguageFromText(text) {
  const value = text || "";
  if (/[\u0C00-\u0C7F]/.test(value)) return "te";
  if (/[\u0900-\u097F]/.test(value)) return "hi";
  if (/[\u0600-\u06FF]/.test(value)) return "ur";
  if (/[\u4E00-\u9FFF]/.test(value)) return "zh-cn";
  if (/[\u3040-\u30FF]/.test(value)) return "ja";
  return "en";
}

function updateInputDetectionStatus() {
  if (!refs.translateStatus) return;
  const text = getBestAvailableInputText();
  if (text.length > 0) {
    refs.translateStatus.textContent = `Text detected (${text.length} chars). Ready to translate.`;
  } else {
    refs.translateStatus.textContent = "Enter or paste text to enable translation.";
  }
}

let currentAudio = null;

function setVoiceSourceStatus(isOnline) {
  if (!refs.voiceSourceBadge) return;
  refs.voiceSourceBadge.classList.toggle("online", Boolean(isOnline));
  refs.voiceSourceBadge.classList.toggle("offline", !Boolean(isOnline));
  refs.voiceSourceBadge.textContent = isOnline ? "Voice Source: Cloud" : "Voice Source: Offline";
}

async function speakText(text, label, languageOverride) {
  const content = (text || "").trim();
  if (!content) {
    if (refs.translateStatus) refs.translateStatus.textContent = `No ${label} text available to speak.`;
    return;
  }
  const selectedLanguage = (languageOverride || resolveTargetLanguage() || "en").toLowerCase();
  if (refs.translateStatus) refs.translateStatus.textContent = `Generating ${label} voice...`;

  try {
    const response = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        text: content,
        target_language: selectedLanguage,
        style: "professor",
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = "Voice synthesis failed.";
      try {
        const json = raw ? JSON.parse(raw) : {};
        message = json.detail || message;
      } catch (_err) {
        message = raw || message;
      }
      refs.translateStatus.textContent = message;
      setVoiceSourceStatus(false);
      return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    audio.onplay = () => {
      refs.translateStatus.textContent = `Speaking ${label}...`;
      setVoiceSourceStatus(true);
    };
    audio.onended = () => {
      refs.translateStatus.textContent = `Finished speaking ${label}.`;
      URL.revokeObjectURL(audioUrl);
    };
    audio.onerror = () => {
      refs.translateStatus.textContent = `Could not play ${label} voice audio.`;
      URL.revokeObjectURL(audioUrl);
    };
    await audio.play();
  } catch (error) {
    refs.translateStatus.textContent = "Voice service unavailable. Check backend connection and internet.";
    setVoiceSourceStatus(false);
  }
}

async function checkBackendConnection() {
  if (!refs.translateStatus) return;
  
  // Inform user we are checking
  const originalStatus = refs.translateStatus.textContent;
  refs.translateStatus.textContent = "Connecting to backend...";

  try {
    // Increased timeout for cold starts (Vercel free tier)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${API_BASE}/health`, { 
      method: "GET",
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      refs.translateStatus.textContent = "Backend connected with errors. Please check logs.";
      setVoiceSourceStatus(false);
      return;
    }
    refs.translateStatus.textContent = "Backend active. All systems online.";
    setVoiceSourceStatus(true);
  } catch (error) {
    if (error.name === "AbortError") {
      refs.translateStatus.textContent = "Backend is taking a while to wake up. Please wait...";
    } else {
      refs.translateStatus.textContent = "Backend unreachable. If testing locally, ensure backend is running.";
    }
    setVoiceSourceStatus(false);
  }
}

function resolveTargetLanguage() {
  if (!refs.targetLanguage) return "en";
  const fromDropdown = (refs.targetLanguage.value || "en").toLowerCase().trim();
  const rawCustom = ((refs.customLang && refs.customLang.value) || "").toLowerCase().trim();
  if (!rawCustom) return fromDropdown;

  const cleaned = rawCustom
    .replace(/\blanguage\b/g, "")
    .replace(/\blang\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fromDropdown;

  const aliases = {
    telugu: "te",
    telgu: "te",
    telegu: "te",
    urdu: "ur",
    hindi: "hi",
    arabic: "ar",
    french: "fr",
    spanish: "es",
    german: "de",
    japanese: "ja",
    chinese: "zh-cn",
    mandarin: "zh-cn",
    english: "en",
  };
  const codePattern = /^[a-z]{2,3}(-[a-z]{2,3})?$/;
  if (aliases[cleaned]) return aliases[cleaned];
  if (codePattern.test(cleaned)) return cleaned;
  // If custom text is not a valid code/name, trust the dropdown value.
  return fromDropdown;
}

async function runAnalysis() {
  const text = getBestAvailableInputText();
  if (!text) {
    addChatMessage("bot", "Paste a message first so I can evaluate cultural signals.");
    return;
  }

  setProcessing(true);
  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error("Analysis failed");
    }

    const result = await response.json();
    state.text = text;
    state.score = result.adaptability_score;
    state.context = result.cultural_context;
    state.markers = result.markers;

    // Map backend response to UI format
    renderLiteral(result.literal_translation || []);
    
    const uiEmotions = [
      { label: "Respect", value: result.emotional_tone.respect },
      { label: "Warmth", value: result.emotional_tone.warmth },
      { label: "Urgency", value: result.emotional_tone.urgency },
    ];
    renderEmotions(uiEmotions);
    
    refs.contextSummary.textContent = result.cultural_context;
    renderScore(result.adaptability_score);
    
    // Safety distribution estimation
    const safety = {
        safe: Math.max(0, 100 - result.emotional_tone.urgency * 0.5),
        caution: result.emotional_tone.urgency * 0.3,
        risk: result.emotional_tone.urgency * 0.2
    };
    renderSafetyDistribution(safety);
    
    renderFingerprint({
        clarity: 85,
        inclusiveness: 78,
        respect: result.emotional_tone.respect,
        warmth: result.emotional_tone.warmth,
        harmRisk: result.emotional_tone.urgency * 0.4
    });

  } catch (error) {
    console.error(error);
    addChatMessage("bot", "I couldn't complete the AI analysis. Please check your connection.");
  } finally {
    setProcessing(false);
  }
}

function handleFile(file) {
  if (!file) return;
  const allowed = [".pdf", ".txt", ".docx"];
  const ext = `.${file.name.split(".").pop().toLowerCase()}`;
  if (!allowed.includes(ext)) return;
  refs.translateStatus.textContent = `Extracting text from ${file.name}...`;
  const formData = new FormData();
  formData.append("file", file);

  fetch(`${API_BASE}/api/extract-text`, {
    method: "POST",
    body: formData,
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Failed to extract text.");
      }
      refs.inputText.value = data.text || "";
      autoResize();
      state.lastInputText = getNormalizedInputText();
      refs.translatedText.value = "";
      refs.translateStatus.textContent = `Loaded text from ${file.name}. Ready to analyze/translate.`;
    })
    .catch((error) => {
      refs.translateStatus.textContent = error.message || "Could not process the uploaded file.";
    });
}

async function runTranslation() {
  if (!refs.translateStatus || !refs.translateBtn || !refs.translatedText) {
    return;
  }
  const text = getBestAvailableInputText();
  refs.translateStatus.textContent = `Translate clicked. Detected ${text.length} chars.`;
  if (!text) {
    refs.translateStatus.textContent = "Enter or load text first before translation.";
    return;
  }

  const targetLanguage = resolveTargetLanguage();
  refs.translateStatus.textContent = `Translating ${text.length} chars to "${targetLanguage}"...`;
  refs.translateBtn.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const url = `${API_BASE}/api/translate`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        text,
        source_language: "auto",
        target_language: targetLanguage,
      }),
    });
    clearTimeout(timeoutId);
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = { detail: raw || "Unexpected server response." };
    }

    if (!response.ok) {
      if (response.status === 401) {
        refs.translateStatus.textContent = "Session expired. Please login again.";
        localStorage.removeItem("naunce_current_user");
        localStorage.removeItem("naunce_access_token");
        setTimeout(() => {
          window.location.href = "./index.html";
        }, 600);
        return;
      }
      refs.translateStatus.textContent = `Translation failed (${response.status}): ${data.detail || "Unknown error"}`;
      return;
    }
    refs.translatedText.value = data.translated_text || "";
    refs.translateStatus.textContent = `Translated successfully to "${targetLanguage}" via ${API_BASE}.`;
    addChatMessage("bot", `Translation completed in ${targetLanguage}.`);
  } catch (error) {
    if (error && error.name === "AbortError") {
      refs.translateStatus.textContent = "Translation request timed out. Please try again.";
    } else {
      refs.translateStatus.textContent = `Server unavailable for translation at ${API_BASE}.`;
    }
  } finally {
    refs.translateBtn.disabled = false;
  }
}

refs.inputText.addEventListener("input", () => {
  state.lastInputText = getNormalizedInputText();
  autoResize();
  updateInputDetectionStatus();
});
if (refs.targetLanguage && refs.customLang) {
  refs.targetLanguage.addEventListener("change", () => {
    refs.customLang.value = "";
    updateInputDetectionStatus();
  });
}
refs.analyzeBtn.addEventListener("click", runAnalysis);
if (refs.translateBtn && refs.translateStatus) {
  refs.translateBtn.addEventListener("click", () => {
    refs.translateStatus.textContent = "Translate button clicked...";
    runTranslation();
  });
}
window.naunceTranslate = runTranslation;

if (refs.speakInputBtn) {
  refs.speakInputBtn.addEventListener("click", () => {
    const input = getBestAvailableInputText();
    speakText(input, "input", detectLanguageFromText(input));
  });
}

if (refs.speakOutputBtn) {
  refs.speakOutputBtn.addEventListener("click", () => {
    speakText(refs.translatedText?.value || "", "output", resolveTargetLanguage());
  });
}

refs.startBtn.addEventListener("click", () => {
  document.getElementById("analyze").scrollIntoView({ behavior: "smooth" });
});

["dragenter", "dragover"].forEach((eventName) => {
  refs.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    refs.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  refs.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    refs.dropZone.classList.remove("dragging");
  });
});

refs.dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  handleFile(file);
});

refs.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});



if (refs.logoutBtn) {
  refs.logoutBtn.addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.removeItem("naunce_current_user");
    localStorage.removeItem("naunce_access_token");
    window.location.href = "./index.html";
  });
}

renderScore(0);
renderSafetyDistribution({ safe: 0, caution: 0, risk: 0 });
renderFingerprint({ clarity: 0, inclusiveness: 0, respect: 0, warmth: 0, harmRisk: 0 });
updateInputDetectionStatus();
checkBackendConnection();
