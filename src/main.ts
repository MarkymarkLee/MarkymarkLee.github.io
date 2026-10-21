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
