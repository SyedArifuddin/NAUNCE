const AUTH_CURRENT_KEY = "naunce_current_user";
const AUTH_TOKEN_KEY = "naunce_access_token";
const API_BASE = window.location.origin;



const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");
let animationFrameId = null;

function setCurrentUser(email) {
  localStorage.setItem(AUTH_CURRENT_KEY, email);
}

function setAccessToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function showMessage(text, isError = true) {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.classList.toggle("error", isError);
  authMessage.classList.toggle("success", !isError);
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        showMessage(data.detail || "Invalid email or password.");
        return;
      }
      setCurrentUser(data.email || email);
      setAccessToken(data.access_token);
      showMessage("Login successful. Redirecting...", false);
      setTimeout(() => {
        window.location.href = "./dashboard.html";
      }, 500);
    } catch (error) {
      showMessage("Unable to reach server. It might be waking up or offline.");
      return;
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const primaryLanguage = document.getElementById("signupLanguage").value;
    try {
      const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, primary_language: primaryLanguage }),
      });
      const registerData = await registerResponse.json();
      if (!registerResponse.ok) {
        showMessage(registerData.detail || "Signup failed.");
        return;
      }

      const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        showMessage(loginData.detail || "Signup succeeded, but auto-login failed.");
        return;
      }

      setCurrentUser(loginData.email || email);
      setAccessToken(loginData.access_token);
      showMessage("Signup complete. Redirecting to dashboard...", false);
      setTimeout(() => {
        window.location.href = "./dashboard.html";
      }, 600);
    } catch (error) {
      showMessage("Unable to reach server. It might be waking up or offline.");
      return;
    }
  });
}

function initLoginBackground() {
  const target = document.getElementById("loginVanta");
  if (!target) return;

  const canvas = document.createElement("canvas");
  canvas.className = "login-bg-canvas";
  target.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const points = [];
  const pointCount = window.innerWidth < 768 ? 56 : 86;
  const maxDistance = window.innerWidth < 768 ? 170 : 230;
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function resize() {
    canvas.width = target.clientWidth;
    canvas.height = target.clientHeight;
  }

  function randomSpeed() {
    return (Math.random() - 0.5) * 0.45;
  }

  function seedPoints() {
    points.length = 0;
    for (let i = 0; i < pointCount; i += 1) {
      points.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: randomSpeed(),
        vy: randomSpeed(),
        size: Math.random() * 1.8 + 1.1,
      });
    }
  }

  function drawGradient() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#f5dfe3");
    gradient.addColorStop(0.45, "#efc7ce");
    gradient.addColorStop(1, "#e5a9b4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawFrame() {
    drawGradient();

    points.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x <= 0 || p.x >= canvas.width) p.vx *= -1;
      if (p.y <= 0 || p.y >= canvas.height) p.vy *= -1;

      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const pull = Math.max(0, 1 - Math.hypot(dx, dy) / 220);
      p.x += dx > 0 ? pull * 0.04 : -pull * 0.04;
      p.y += dy > 0 ? pull * 0.04 : -pull * 0.04;
    });

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < maxDistance) {
          const alpha = 1 - dist / maxDistance;
          ctx.strokeStyle = `rgba(90, 10, 20, ${alpha * 0.52})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    points.forEach((p) => {
      ctx.fillStyle = "rgba(78, 8, 16, 0.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    animationFrameId = window.requestAnimationFrame(drawFrame);
  }

  resize();
  seedPoints();
  drawFrame();

  window.addEventListener("resize", () => {
    resize();
    seedPoints();
  });

  window.addEventListener("mousemove", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  });
}

window.addEventListener("load", initLoginBackground);
window.addEventListener("beforeunload", () => {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
  }
});
