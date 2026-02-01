const urlInput = document.getElementById("url");
const toastEl = document.getElementById("toast");
const boringToggleBtn = document.getElementById("boring-toggle");
const loadingEl = document.getElementById("loading");

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1600);
}

document.getElementById("go").onclick = () => window.api.go(urlInput.value);
document.getElementById("back").onclick = () => window.api.back();
document.getElementById("forward").onclick = () => window.api.forward();
document.getElementById("reload").onclick = () => window.api.reload();
document.getElementById("reader").onclick = () => window.api.extractReader();
boringToggleBtn.onclick = () => window.api.toggleBoring();

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.api.go(urlInput.value);
});

window.api.onUrl((u) => {
  if (typeof u === "string" && u.length > 0) urlInput.value = u;
});

window.api.onToast((msg) => showToast(msg));

window.api.onBoringState((enabled) => {
  boringToggleBtn.textContent = enabled ? "Boring Mode: ON" : "Boring Mode: OFF";
  boringToggleBtn.style.background = enabled ? "#d4edda" : "#f8d7da";
});

window.api.onLoading((isLoading) => {
  if (!loadingEl) return;
  loadingEl.classList.toggle("show", !!isLoading);
});