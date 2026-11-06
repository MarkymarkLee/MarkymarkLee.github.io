import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/silkscreen";
import "./style.css";

// The initial theme is set by an inline script in <head> (no flash); this only handles the toggle.
const root = document.documentElement;
document.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", () => {
  const dark =
    root.dataset.theme === "dark" ||
    (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "light" : "dark";
  try {
    localStorage.setItem("theme", root.dataset.theme);
  } catch {}
  document.dispatchEvent(new Event("themechange"));
});

// Long-pressing a contact link on a touch screen copies it instead of opening it. After the hold time the
// link lights up and says "Copied" so you know to let go; the copy itself happens on release, because iOS
// only lets a page write to the clipboard from touchend. Moving the finger away cancels it.
const HOLD_MS = 300;
for (const a of document.querySelectorAll<HTMLAnchorElement>(".socials a, .cv > h1 + ul a")) {
  let ready = false;
  let timer = 0;
  const text = a.href.replace(/^mailto:/, "");
  const reset = () => {
    clearTimeout(timer);
    a.classList.remove("copy-ready");
  };
  const cancel = () => {
    if (ready) document.querySelector(".toast")?.remove();
    ready = false;
    reset();
  };
  a.addEventListener(
    "touchstart",
    () => {
      ready = false;
      timer = window.setTimeout(() => {
        ready = true;
        a.classList.add("copy-ready");
        toast(`Copied ${text}`);
        haptic();
      }, HOLD_MS);
    },
    { passive: true },
  );
  a.addEventListener("touchmove", cancel, { passive: true });
  a.addEventListener("touchcancel", cancel);
  a.addEventListener("touchend", (e) => {
    reset();
    if (!ready) return;
    ready = false;
    e.preventDefault(); // don't also open the link
    // The "Copied" message is already showing; only speak up if the copy failed.
    navigator.clipboard?.writeText(text).catch(() => toast("Couldn't copy"));
  });
  // Android opens a menu on long press; keep desktop right-click as it is.
  a.addEventListener(
    "contextmenu",
    (e) => a.classList.contains("copy-ready") && e.preventDefault(),
  );
}

// A short buzz. Android has navigator.vibrate; iOS Safari has no vibration API, but toggling an
// iOS 18+ <input switch> plays the system haptic, so click a hidden one.
// shortcut: the iOS trick is undocumented and may stop working in a future iOS; drop it if it does.
function haptic() {
  if (navigator.vibrate?.(15)) return;
  const label = document.createElement("label");
  label.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.body.append(label);
  label.click();
  label.remove();
}

// One toast at a time: a new message replaces the current one.
let toastTimer = 0;
function toast(msg: string) {
  let el = document.querySelector<HTMLDivElement>(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 1800);
}
