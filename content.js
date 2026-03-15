/**
 * Guptavarta — Instagram E2E Encryption
 * 
 * Because Meta decided your DMs don't deserve privacy.
 * So I built this, Only for your baby girl.
 * 
 * Author:  Rudra Pratap Shukla
 * GitHub:  https://github.com/rudrapshukla
 * Email:   rudrapshukla@proton.me
 * 
 * How it works:
 *   - You type a message in a DM, press Enter
 *   - It gets AES-256-GCM encrypted before Instagram ever sees it
 *   - The other side (with this extension) gets a Decrypt button
 *   - Instagram's servers see nothing but gibberish
 *   - Comments, posts, captions — untouched. DMs only.
 * 
 * असतो मा सद्गमय — Bṛhadāraṇyaka Upaniṣad = Lead me from falsehood to truth.
 */

(function () {
  "use strict";

  const PASSPHRASE = "guptavarta-shared-v1-rudra-2026";
  const SALT       = new Uint8Array([67,82,89,80,84,65,71,82,65,77,50,48,50,54,82,86]);
  const PREFIX     = "GPV:";

  let sharedKey  = null;
  let isSending  = false;
  let isEnabled  = true; // toggled from popup

  // ── Key derivation ────────────────────────────────────────────────────────
  async function deriveKey() {
    const raw = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(PASSPHRASE),
      { name: "PBKDF2" }, false, ["deriveKey"]
    );
    sharedKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: SALT, iterations: 100000, hash: "SHA-256" },
      raw,
      { name: "AES-GCM", length: 256 },
      false, ["encrypt", "decrypt"]
    );
  }

  // ── Encrypt ───────────────────────────────────────────────────────────────
  async function encryptText(plaintext) {
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const ct  = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, sharedKey,
      new TextEncoder().encode(plaintext)
    );
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv);
    out.set(new Uint8Array(ct), 12);
    return PREFIX + btoa(String.fromCharCode(...out));
  }

  // ── Decrypt ───────────────────────────────────────────────────────────────
  async function decryptText(blob) {
    const b64 = blob.slice(PREFIX.length).trim().replace(/\s/g, "");
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pt  = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.slice(0, 12) },
      sharedKey, raw.slice(12)
    );
    return new TextDecoder().decode(pt);
  }

  // ── Are we inside a DM conversation? ─────────────────────────────────────
  // Instagram DMs live under /direct/t/ or /direct/inbox/
  // Comments live on post pages — different URL pattern entirely.
  // This is the fix for the "encrypting comments" bug.
  function isOnDMPage() {
    return /instagram\.com\/direct\//i.test(window.location.href);
  }

  // ── Send interception ─────────────────────────────────────────────────────
  function watchEnter() {
    document.addEventListener("keydown", async (e) => {
      if (!isEnabled) return;             // toggle is OFF
      if (!isOnDMPage()) return;          // not a DM page — leave it alone, like she leave you alone.
      if (e.key !== "Enter" || e.shiftKey || isSending) return;

      const input = getMessageInput();
      if (!input) return;

      const text = getText(input);
      if (!text.trim() || text.startsWith(PREFIX)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        isSending = true;
        const encrypted = await encryptText(text);
        setText(input, encrypted);
        await tick();

        const sent = clickSendButton();
        if (!sent) {
          input.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter", code: "Enter", keyCode: 13, which: 13,
            bubbles: true, cancelable: true
          }));
        }
        await tick();
      } catch (err) {
        console.error("[Guptavarta] encrypt error:", err);
      } finally {
        isSending = false;
      }
    }, true);
  }

  function clickSendButton() {
    for (const sel of ['button[aria-label="Send"]', '[aria-label="Send"]', 'button[type="submit"]']) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.offsetParent !== null) { el.click(); return true; }
      }
    }
    return false;
  }

  // ── Scan for encrypted messages ───────────────────────────────────────────
  // Only scan on DM pages — no point touching comment sections
  let scanTimer = null;
  function scheduleScan() {
    if (!isOnDMPage()) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanMessages, 500);
  }

  function scanMessages() {
    if (!isOnDMPage()) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found  = [];
    let node;

    while ((node = walker.nextNode())) {
      const val = node.nodeValue || "";
      const idx = val.indexOf(PREFIX);
      if (idx === -1) continue;

      const match = val.slice(idx).match(/^GPV:[A-Za-z0-9+/=]+/);
      if (!match) continue;

      const parent = node.parentElement;
      if (!parent || parent.dataset.cg) continue;

      found.push({ parent, blob: match[0] });
    }

    for (const { parent, blob } of found) {
      if (parent.dataset.cg) continue;
      parent.dataset.cg    = "1";
      parent.dataset.cgBlob = blob;
      renderDecryptUI(parent, blob);
    }
  }

  // ── Decrypt UI ────────────────────────────────────────────────────────────
  function renderDecryptUI(container, blob) {
    container.textContent = "";

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px;min-width:140px;max-width:280px;font-family:inherit";

    const label = document.createElement("div");
    label.style.cssText = "display:flex;align-items:center;gap:5px;opacity:0.55";
    label.innerHTML = `<span style="font-size:13px">🔒</span><span style="font-size:12px;font-style:italic">Encrypted message</span>`;

    const btn = document.createElement("button");
    btn.textContent = "Decrypt";
    btn.style.cssText = [
      "padding:6px 0",
      "border-radius:10px",
      "border:1.5px solid rgba(255,255,255,0.2)",
      "background:rgba(255,255,255,0.08)",
      "font-size:13px",
      "font-weight:600",
      "cursor:pointer",
      "width:100%",
      "font-family:inherit",
      "color:inherit",
      "outline:none",
      "transition:background 0.15s,border-color 0.15s",
    ].join(";");

    btn.onmouseover = () => { btn.style.background = "rgba(255,255,255,0.16)"; };
    btn.onmouseout  = () => { btn.style.background = "rgba(255,255,255,0.08)"; };

    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "Decrypting…";
      try {
        const plain = await decryptText(container.dataset.cgBlob);
        showRevealed(wrap, plain);
      } catch (err) {
        console.error("[Guptavarta] decrypt error:", err);
        btn.textContent = "⚠ Failed";
        btn.style.borderColor = "#e55";
        btn.disabled = false;
      }
    };

    wrap.appendChild(label);
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }

  function showRevealed(wrap, plaintext) {
    wrap.innerHTML = "";

    const badge = document.createElement("div");
    badge.style.cssText = "display:flex;align-items:center;gap:4px";
    badge.innerHTML = `
      <span style="font-size:12px">🔓</span>
      <span style="font-size:10px;font-weight:700;letter-spacing:1px;color:#00cc77;text-transform:uppercase;font-family:inherit">Decrypted</span>
    `;

    const msg = document.createElement("div");
    msg.style.cssText = "font-size:14px;line-height:1.5;word-break:break-word;font-family:inherit;opacity:0;transition:opacity 0.2s ease;margin-top:3px";
    msg.textContent = plaintext;

    wrap.appendChild(badge);
    wrap.appendChild(msg);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      msg.style.opacity = "1";
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getMessageInput() {
    const el = document.activeElement;
    if (!el) return null;
    if (!el.isContentEditable && el.tagName !== "TEXTAREA") return null;
    const hint = [
      el.getAttribute("aria-label") || "",
      el.getAttribute("aria-placeholder") || "",
      el.getAttribute("placeholder") || "",
    ].join(" ").toLowerCase();
    if (/message|dm|direct/i.test(hint) || el.closest("form")) return el;
    return null;
  }

  function getText(el) {
    return el.isContentEditable ? (el.innerText || "") : el.value;
  }

  function setText(el, text) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    } else {
      const proto = Object.getPrototypeOf(el);
      const desc  = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc?.set) desc.set.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function tick() { return new Promise(r => setTimeout(r, 80)); }

  // ── Listen for toggle from popup via storage change ───────────────────────
  // Polling storage is more reliable than chrome.tabs.sendMessage
  // which can fail silently if the content script context isn't ready
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled !== undefined) {
      isEnabled = changes.enabled.newValue !== false;
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  chrome.storage.local.get("enabled", (res) => {
    isEnabled = res.enabled !== false; // default ON

    deriveKey().then(() => {
      watchEnter();
      new MutationObserver(scheduleScan).observe(document.body, {
        childList: true, subtree: true
      });
      scheduleScan();
    }).catch(err => console.error("[Guptavarta] init failed:", err));
  });

})();
