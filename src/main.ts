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

// Long-pressing a contact link on a touch screen copies it instead of opening it.
for (const a of document.querySelectorAll<HTMLAnchorElement>(".socials a, .cv > h1 + ul a")) {
  let start = 0;
  a.addEventListener("touchstart", () => (start = Date.now()), { passive: true });
  a.addEventListener("touchmove", () => (start = 0), { passive: true });
  a.addEventListener("touchend", (e) => {
    const held = start && Date.now() - start >= 300;
    start = 0;
    if (!held) return;
    e.preventDefault(); // don't also open the link
    const text = a.href.replace(/^mailto:/, "");
    navigator.clipboard?.writeText(text).then(
      () => toast(`Copied ${text}`),
      () => {},
    );
  });
  // Android opens a menu on long press; keep desktop right-click as it is.
  a.addEventListener("contextmenu", (e) => start && e.preventDefault());
}

function toast(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}
