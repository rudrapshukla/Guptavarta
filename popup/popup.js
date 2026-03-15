//to dull the interface...like she dulled your life
const toggle    = document.getElementById("mainToggle");
const dot       = document.getElementById("statusDot");
const statusTxt = document.getElementById("statusText");
const label     = document.getElementById("toggleLabel");
const howCard   = document.getElementById("howCard");
const secCard   = document.getElementById("secCard");

chrome.storage.local.get("enabled", (res) => {
  const enabled = res.enabled !== false;
  toggle.checked = enabled;
  updateUI(enabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });
  updateUI(enabled);
});

function updateUI(enabled) {
  label.textContent     = enabled ? "ON" : "OFF";
  label.style.color     = enabled ? "#00c97a" : "#555";
  dot.className         = enabled ? "dot" : "dot off";
  statusTxt.textContent = enabled ? "Active on Instagram DMs" : "Paused";
  howCard.className     = enabled ? "card" : "card dimmed";
  secCard.className     = enabled ? "card" : "card dimmed";
}
