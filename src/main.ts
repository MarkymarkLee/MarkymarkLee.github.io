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
// link lights up and says "Release to copy"; the copy itself happens on release, because iOS only lets a
// page write to the clipboard from touchend.
const HOLD_MS = 300;
for (const a of document.querySelectorAll<HTMLAnchorElement>(".socials a, .cv > h1 + ul a")) {
  let ready = false;
  let timer = 0;
  const reset = () => {
    clearTimeout(timer);
    a.classList.remove("copy-ready");
  };
  a.addEventListener(
    "touchstart",
    () => {
      ready = false;
      timer = window.setTimeout(() => {
        ready = true;
        a.classList.add("copy-ready");
        toast("Release to copy");
      }, HOLD_MS);
    },
    { passive: true },
  );
  a.addEventListener(
    "touchmove",
    () => {
      ready = false;
      reset();
    },
    { passive: true },
  );
  a.addEventListener("touchcancel", () => {
    ready = false;
    reset();
  });
  a.addEventListener("touchend", (e) => {
    reset();
    if (!ready) return;
    ready = false;
    e.preventDefault(); // don't also open the link
    const text = a.href.replace(/^mailto:/, "");
    navigator.clipboard?.writeText(text).then(
      () => toast(`Copied ${text}`),
      () => toast("Couldn't copy"),
    );
  });
  // Android opens a menu on long press; keep desktop right-click as it is.
  a.addEventListener(
    "contextmenu",
    (e) => a.classList.contains("copy-ready") && e.preventDefault(),
  );
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
