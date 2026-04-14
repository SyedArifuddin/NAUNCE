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
const API_BASE = "http://127.0.0.1:8000";

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
  try {
    const response = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (!response.ok) {
      refs.translateStatus.textContent = "Backend connected with errors. Please restart backend.";
      setVoiceSourceStatus(false);
      return;
    }
    refs.translateStatus.textContent = "Backend connected. Translation module ready.";
    setVoiceSourceStatus(true);
  } catch (error) {
    refs.translateStatus.textContent = "Backend not reachable. Start backend on 127.0.0.1:8000.";
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

function setProcessing(on) {
  refs.processingDot.classList.toggle("active", on);
  refs.processingDot.textContent = on ? "Analyzing..." : "Idle";
}

function mockAnalyze(text) {
  const lower = text.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  const wordCount = tokens.length;
  const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const avgSentenceLength = wordCount / sentenceCount;

  const politenessTerms = [
    "please",
    "kindly",
    "thanks",
    "thank you",
    "appreciate",
    "sorry",
    "grateful",
    "excuse me",
    "pardon",
    "if you don't mind",
    "would you",
    "could you",
    "may i",
    "with respect",
  ];
  const aggressiveTerms = [
    "now",
    "immediately",
    "asap",
    "must",
    "do it",
    "right now",
    "or else",
    "i said",
    "don't argue",
    "no excuses",
    "you better",
    "final warning",
  ];
  const respectfulTerms = [
    "sir",
    "madam",
    "ji",
    "respected",
    "dear",
    "please",
    "kind regards",
    "best regards",
    "sincerely",
    "honorable",
  ];
  const inclusiveTerms = [
    "we",
    "together",
    "let us",
    "our",
    "could we",
    "team",
    "everyone",
    "all of us",
    "community",
    "mutual",
    "shared",
  ];
  const positiveTerms = [
    "help",
    "support",
    "understand",
    "respect",
    "welcome",
    "collaborate",
    "safe",
    "love",
    "care",
    "kind",
    "kindness",
    "affection",
    "warm",
    "friendly",
    "grace",
    "empathy",
    "compassion",
    "encourage",
    "hope",
    "peace",
    "trust",
    "honest",
    "gratitude",
    "thankful",
    "appreciated",
    "blessing",
    "smile",
    "happiness",
    "joy",
    "beautiful",
    "gentle",
    "cooperate",
    "cooperation",
    "unity",
  ];
  const benignIntentTerms = [
    "invite",
    "invitation",
    "join us",
    "you are invited",
    "please join",
    "welcome to",
    "let's meet",
    "see you",
    "thank you for coming",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "hello",
    "hi",
    "hey",
    "greetings",
    "nice to meet you",
    "happy birthday",
    "congratulations",
    "all the best",
    "take care",
    "get well soon",
    "wishing you",
    "warm wishes",
    "best wishes",
    "love you",
    "miss you",
    "proud of you",
    "you matter",
    "you are valued",
  ];
  const violentTerms = [
    "kill",
    "murder",
    "stab",
    "shoot",
    "burn",
    "bomb",
    "attack",
    "hurt",
    "destroy",
    "die",
    "slap",
    "beat",
    "rape",
    "strangle",
    "choke",
    "poison",
    "lynch",
    "massacre",
    "genocide",
    "assault",
    "eliminate",
    "terminate you",
    "annihilate",
    "blood",
    "dead body",
    "bury you",
  ];
  const threatPhrases = [
    "i will kill you",
    "i'll kill you",
    "kill you",
    "you are dead",
    "i will hurt you",
    "i'll hurt you",
    "i will destroy you",
    "you will die",
    "or i will",
    "i will beat you",
    "i'll beat you",
    "i will hurt your family",
    "watch your back",
    "you are finished",
    "you are done",
    "i will make you pay",
    "you will regret this",
    "i will ruin you",
    "i will break you",
  ];
  const abuseTerms = [
    "idiot",
    "stupid",
    "worthless",
    "shut up",
    "hate you",
    "useless",
    "moron",
    "loser",
    "garbage",
    "trash",
    "disgusting",
    "pathetic",
    "dumb",
    "fool",
    "pig",
    "bastard",
    "slut",
    "whore",
    "racist slur",
    "terrorist",
    "dog",
    "nonsense person",
  ];

  const countMatches = (arr) => arr.reduce((acc, term) => acc + (lower.includes(term) ? 1 : 0), 0);

  const politenessCount = countMatches(politenessTerms);
  const aggressiveCount = countMatches(aggressiveTerms);
  const respectfulCount = countMatches(respectfulTerms);
  const inclusiveCount = countMatches(inclusiveTerms);
  const positiveCount = countMatches(positiveTerms);
  const benignIntentCount = countMatches(benignIntentTerms);
  const violentCount = countMatches(violentTerms);
  const threatPhraseCount = countMatches(threatPhrases);
  const abuseCount = countMatches(abuseTerms);
  const capsRatio =
    text.replace(/[^A-Z]/g, "").length / Math.max(1, text.replace(/[^A-Za-z]/g, "").length);
  const exclamations = (text.match(/!/g) || []).length;
  const hasDirectThreatTarget = /\byou\b/.test(lower) && violentCount > 0;
  const coercivePattern = /(do this|do it).*(or|otherwise|else)/.test(lower);
  const targetedAbusePattern =
    /\b(you are|you're|are you|u are|u r)\b.*\b(idiot|stupid|moron|loser|worthless|pathetic|dumb|fool)\b/.test(
      lower
    ) ||
    (/\byou\b/.test(lower) && abuseCount > 0);

  const harmRaw =
    0 +
    threatPhraseCount * 36 +
    violentCount * 17 +
    abuseCount * 13 +
    (hasDirectThreatTarget ? 16 : 0) +
    (targetedAbusePattern ? 26 : 0) +
    (coercivePattern ? 14 : 0) +
    aggressiveCount * 7 +
    exclamations * 2 +
    Math.round(capsRatio * 18) -
    politenessCount * 5 -
    positiveCount * 4 -
    benignIntentCount * 10;
  const harmScore = Math.max(0, Math.min(100, harmRaw));

  const literalFlags = [];
  if (harmScore >= 70 || threatPhraseCount > 0) {
    literalFlags.push("High-risk threat language detected. Message may be harmful or abusive.");
  }
  if (violentCount > 0) {
    literalFlags.push("Violent intent markers found (e.g., kill/hurt/attack terms).");
  }
  if (abuseCount > 0) {
    literalFlags.push("Abusive language detected.");
  }
  if (targetedAbusePattern) {
    literalFlags.push("Targeted insult detected (second-person abuse).");
  }
  if (lower.includes("just translate")) {
    literalFlags.push("Phrase 'just translate' may erase social context.");
  }
  if (aggressiveCount > 0) {
    literalFlags.push("Command-heavy wording may reduce perceived respect.");
  }
  if (capsRatio > 0.35 || exclamations > 2) {
    literalFlags.push("High emphasis (ALL CAPS / many !) can be read as harsh.");
  }
  if (!literalFlags.length) literalFlags.push("No major literal-risk phrase detected.");

  const respectValue = Math.max(
    0,
    Math.min(
      98,
      62 +
        respectfulCount * 11 +
        politenessCount * 8 +
        positiveCount * 5 -
        aggressiveCount * 10 -
        harmScore * 0.9 -
        (targetedAbusePattern ? 35 : 0)
    )
  );
  const urgencyValue = Math.max(10, Math.min(95, 18 + aggressiveCount * 20 + exclamations * 8));
  const warmthValue = Math.max(
    0,
    Math.min(98, 46 + politenessCount * 10 + inclusiveCount * 8 + positiveCount * 7 - harmScore * 0.55 - capsRatio * 25)
  );

  const structurePenalty = avgSentenceLength > 24 ? 6 : avgSentenceLength < 4 ? 4 : 0;
  const clarityBonus = avgSentenceLength >= 8 && avgSentenceLength <= 20 ? 5 : 0;
  const scoreRaw =
    68 +
    politenessCount * 7 +
    respectfulCount * 6 +
    positiveCount * 6 +
    inclusiveCount * 5 -
    aggressiveCount * 8 -
    harmScore * 0.75 -
    exclamations * 2 -
    Math.round(capsRatio * 20) -
    structurePenalty +
    clarityBonus;
  const score = Math.max(0, Math.min(98, Math.round(scoreRaw)));

  const emotions = [
    { label: "Respect", value: Math.round(respectValue) },
    { label: "Harm Risk", value: Math.round(harmScore) },
    { label: "Warmth", value: Math.round(warmthValue) },
  ];

  let context = "";
  if (harmScore >= 70) {
    context =
      "High Risk: Threat or violence signals detected. This message can cause fear or harm and should be rewritten before sharing.";
  } else if (harmScore >= 45) {
    context =
      "Caution: The wording appears coercive or aggressive. Replace forceful language with respectful intent and non-threatening phrasing.";
  } else if (score >= 80 && politenessCount > 0 && inclusiveCount > 0) {
    context =
      "Strong cross-cultural resonance: respectful, collaborative, and clear. Tone is safe for diverse audiences.";
  } else if (respectfulCount > 0 && politenessCount > 0 && aggressiveCount === 0) {
    context =
      "Polite and respectful tone detected. Message is likely to be received positively across formal and informal contexts.";
  } else if (aggressiveCount > 0 && politenessCount === 0) {
    context =
      "Direct command tone detected. Consider adding courtesy markers (please/kindly) and context to avoid sounding harsh.";
  } else if (avgSentenceLength > 24) {
    context =
      "Message may be hard to process due to long sentence structure. Shorter sentences can improve clarity and cultural comprehension.";
  } else if (avgSentenceLength < 5 && wordCount < 8) {
    context =
      "Message is very brief and may feel abrupt. Add context or intent to improve interpretation.";
  } else if (positiveCount > 0 || benignIntentCount > 0) {
    context =
      "Positive intent detected. The message appears safe and constructive, with low cultural friction risk.";
  } else {
    context =
      "Neutral tone detected. Add relational framing or audience-specific context to improve resonance.";
  }

  const markers = [
    harmScore >= 70 ? "threat-detected" : "safe-intent",
    politenessCount ? "politeness" : "directness",
    respectfulCount ? "respect-marker" : "neutral-form",
    inclusiveCount ? "inclusive-language" : "individual-focus",
    aggressiveCount ? "high-urgency" : "measured-urgency",
    harmScore >= 45 ? "harm-risk" : "low-harm",
  ];
  const trend = [
    Math.max(18, score - 14),
    Math.max(20, score - 9),
    Math.max(22, score - 6),
    Math.max(24, score - 3),
    Math.max(26, score - 1),
    score,
  ];
  const clarityValue = Math.max(
    15,
    Math.min(98, Math.round(100 - structurePenalty * 12 - Math.abs(avgSentenceLength - 14) * 1.6))
  );
  const inclusivenessValue = Math.max(
    10,
    Math.min(98, Math.round(28 + inclusiveCount * 18 + politenessCount * 4 - aggressiveCount * 6))
  );
  const safePct = Math.max(0, Math.min(100, Math.round(100 - harmScore)));
  const cautionPct = Math.max(
    0,
    Math.min(
      100,
      Math.round(harmScore < 30 ? harmScore * 0.35 : harmScore < 70 ? 28 + (harmScore - 30) * 0.7 : 18)
    )
  );
  const riskPct = Math.max(0, Math.min(100, Math.round(harmScore)));

  return {
    literalFlags,
    emotions,
    score,
    context,
    markers,
    trend,
    safetySplit: { safe: safePct, caution: cautionPct, risk: riskPct },
    signalProfile: {
      clarity: clarityValue,
      inclusiveness: inclusivenessValue,
      respect: respectValue,
      warmth: warmthValue,
      harmRisk: harmScore,
    },
  };
}

function renderLiteral(flags) {
  refs.literalList.innerHTML = "";
  flags.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    refs.literalList.appendChild(li);
  });
}

function renderEmotions(emotions) {
  refs.emotionWheel.innerHTML = "";
  emotions.forEach((emotion) => {
    const div = document.createElement("div");
    div.className = "emotion-pill";
    div.textContent = `${emotion.label} ${emotion.value}%`;
    refs.emotionWheel.appendChild(div);
  });
  const top = [...emotions].sort((a, b) => b.value - a.value)[0];
  refs.emotionSummary.textContent = `Dominant signal: ${top.label} (${top.value}%).`;
}

function renderScore(score) {
  const circumference = 452;
  const offset = circumference - (circumference * score) / 100;
  refs.ringProgress.style.strokeDashoffset = `${offset}`;
  refs.scoreText.textContent = score.toString();
}

function renderTrend(points) {
  if (!refs.trendPath) return;
  const xStep = 50;
  const xStart = 10;
  const yMax = 160;
  const d = points
    .map((p, i) => {
      const x = xStart + i * xStep;
      const y = yMax - (p / 100) * 140;
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
  refs.trendPath.setAttribute("d", d);
  refs.trendPath.style.strokeDashoffset = "0";
}

function renderSafetyDistribution(split) {
  const safe = Math.max(0, Math.min(100, Math.round(split.safe || 0)));
  const caution = Math.max(0, Math.min(100, Math.round(split.caution || 0)));
  const risk = Math.max(0, Math.min(100, Math.round(split.risk || 0)));
  if (refs.safeBar) refs.safeBar.style.width = `${safe}%`;
  if (refs.cautionBar) refs.cautionBar.style.width = `${caution}%`;
  if (refs.riskBar) refs.riskBar.style.width = `${risk}%`;
  if (refs.safePct) refs.safePct.textContent = `${safe}%`;
  if (refs.cautionPct) refs.cautionPct.textContent = `${caution}%`;
  if (refs.riskPct) refs.riskPct.textContent = `${risk}%`;
}

function renderFingerprint(profile) {
  if (refs.clarityVal) refs.clarityVal.textContent = `${Math.round(profile.clarity || 0)}%`;
  if (refs.inclusiveVal) refs.inclusiveVal.textContent = `${Math.round(profile.inclusiveness || 0)}%`;
  if (refs.respectVal) refs.respectVal.textContent = `${Math.round(profile.respect || 0)}%`;
  if (refs.warmthVal) refs.warmthVal.textContent = `${Math.round(profile.warmth || 0)}%`;
  if (refs.harmVal) refs.harmVal.textContent = `${Math.round(profile.harmRisk || 0)}%`;
}


async function runAnalysis() {
  const text = getBestAvailableInputText();
  if (!text) {
    addChatMessage("bot", "Paste a message first so I can evaluate cultural signals.");
    return;
  }

  setProcessing(true);
  await new Promise((resolve) => setTimeout(resolve, 900));

  const result = mockAnalyze(text);
  state.text = text;
  state.score = result.score;
  state.context = result.context;
  state.markers = result.markers;
  state.trend = result.trend;

  renderLiteral(result.literalFlags);
  renderEmotions(result.emotions);
  refs.contextSummary.textContent = result.context;
  renderScore(result.score);
  renderSafetyDistribution(result.safetySplit || {});
  renderFingerprint(result.signalProfile || {});
  setProcessing(false);
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
