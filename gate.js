// gate.js — Password gate for IMAZIA × OJUNIX contract
// SHA-256 hashed password — bypass requires effort but is not foolproof.
// To change the password, regenerate the hash with: sha256("new password")

(function () {
  const PASSWORD_HASH = 'a85fc0cdb9257bb9f94d606efc57b683ab8b5fd471750703f50afa1b7761f378';
  const STORAGE_KEY = 'imazia-gate-unlocked';
  const WELCOME_MSG = "Cette zone est gardée par deux photographes et un chat. Mot de passe, s'il vous plaît.";

  // Already unlocked in a previous session? Skip the gate.
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
  } catch (e) { /* localStorage unavailable */ }

  // Lock the page before content paints
  const style = document.createElement('style');
  style.textContent = `
    html.gate-locked > body > *:not(.gate-overlay) { display: none !important; }
    html.gate-locked, html.gate-locked > body { background: #1a1614 !important; overflow: hidden !important; }

    .gate-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background:
        radial-gradient(circle at 20% 20%, rgba(196, 81, 42, 0.18), transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(196, 81, 42, 0.10), transparent 50%),
        #1a1614;
      display: flex; align-items: center; justify-content: center;
      padding: 24px; font-family: 'Space Grotesk', system-ui, sans-serif; color: #fff;
    }
    .gate-card {
      max-width: 460px; width: 100%; text-align: center;
      animation: gate-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes gate-rise {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .gate-icon {
      width: 88px; height: 88px; margin: 0 auto 24px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(196, 81, 42, 0.18);
      border-radius: 50%; position: relative;
    }
    .gate-icon::after {
      content: ''; position: absolute; inset: -8px;
      border: 1.5px solid rgba(196, 81, 42, 0.3);
      border-radius: 50%; animation: gate-pulse 2.4s ease-in-out infinite;
    }
    @keyframes gate-pulse {
      0%, 100% { transform: scale(1);   opacity: 0.6; }
      50%      { transform: scale(1.08); opacity: 0.2; }
    }
    .gate-icon svg { width: 40px; height: 40px; stroke: #C4512A; }

    .gate-brand {
      font-family: 'Archivo', system-ui, sans-serif;
      font-weight: 800; font-size: 13px; letter-spacing: 4px;
      color: #C4512A; text-transform: uppercase; margin-bottom: 14px;
    }
    .gate-brand .x {
      font-style: italic; font-weight: 300; font-size: 14px;
      opacity: 0.8; margin: 0 3px;
    }
    .gate-msg {
      font-family: 'Archivo', system-ui, sans-serif;
      font-weight: 300; font-style: italic;
      font-size: 22px; line-height: 1.35; color: #fff;
      margin-bottom: 32px;
      text-wrap: balance;
    }
    .gate-form {
      display: flex; flex-direction: column; gap: 12px;
      align-items: stretch;
    }
    .gate-input {
      width: 100%; padding: 14px 18px;
      background: rgba(255, 255, 255, 0.06);
      border: 1.5px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      font-family: inherit; font-size: 15px;
      color: #fff; outline: none;
      transition: border-color 0.2s, background 0.2s;
      text-align: center; letter-spacing: 0.3px;
    }
    .gate-input::placeholder { color: rgba(255, 255, 255, 0.3); letter-spacing: 0.4px; }
    .gate-input:focus {
      border-color: #C4512A;
      background: rgba(196, 81, 42, 0.08);
    }
    .gate-input.gate-error {
      border-color: #ff8b8b;
      animation: gate-shake 0.45s cubic-bezier(.36,.07,.19,.97);
    }
    @keyframes gate-shake {
      10%, 90% { transform: translateX(-2px); }
      20%, 80% { transform: translateX(4px); }
      30%, 50%, 70% { transform: translateX(-8px); }
      40%, 60% { transform: translateX(8px); }
    }
    .gate-submit {
      padding: 14px 24px;
      background: #C4512A; color: #fff;
      border: 0; border-radius: 10px;
      font-family: inherit; font-size: 13px; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .gate-submit:hover { background: #A84020; }
    .gate-submit:active { transform: scale(0.98); }
    .gate-err-text {
      font-size: 12px; color: #ff8b8b;
      margin-top: 4px; min-height: 16px;
      font-style: italic; letter-spacing: 0.3px;
    }
    .gate-footer {
      margin-top: 28px; font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
      letter-spacing: 2px; text-transform: uppercase;
    }
    .gate-footer-cat {
      display: inline-block; margin-left: 6px;
      animation: gate-cat 5s ease-in-out infinite;
    }
    @keyframes gate-cat {
      0%, 90%, 100% { transform: rotate(0); }
      93% { transform: rotate(-8deg); }
      96% { transform: rotate(8deg); }
    }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add('gate-locked');

  // Build the overlay
  const overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.innerHTML = `
    <div class="gate-card">
      <div class="gate-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div class="gate-brand">Imazia<span class="x">&amp;</span>Ojunix</div>
      <div class="gate-msg">${WELCOME_MSG}</div>
      <form class="gate-form" id="gate-form" autocomplete="off">
        <input type="password" class="gate-input" id="gate-input" placeholder="••••••••••••••" autofocus />
        <button type="submit" class="gate-submit">Entrer</button>
        <div class="gate-err-text" id="gate-err"></div>
      </form>
      <div class="gate-footer">
        Accès réservé au duo<span class="gate-footer-cat">🐈‍⬛</span>
      </div>
    </div>
  `;

  // Attach when body is available
  function attach() {
    document.body.appendChild(overlay);
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const errEl = document.getElementById('gate-err');

    async function sha256(str) {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '';
      input.classList.remove('gate-error');
      const val = input.value.trim();
      if (!val) {
        input.classList.add('gate-error');
        return;
      }
      const h = await sha256(val);
      if (h === PASSWORD_HASH) {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
        // Fade out and reveal
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
          document.documentElement.classList.remove('gate-locked');
          overlay.remove();
        }, 400);
      } else {
        input.classList.add('gate-error');
        const messages = [
          'Mot de passe incorrect. Le chat n\'est pas dupe.',
          'Raté. Réessayez (le chat vous observe).',
          'Non. Définitivement non.',
          'Ce n\'est pas ça. Et le chat soupire.',
        ];
        errEl.textContent = messages[Math.floor(Math.random() * messages.length)];
        input.select();
      }
    });
  }

  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach);

  // Expose a log-out function for the user (call gateLogout() in console or from a button)
  window.gateLogout = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  };
})();
