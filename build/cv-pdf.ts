// Prints the built CV page to cv.pdf with headless Chrome (uses the @media print styles).
import { execFileSync, spawn } from "node:child_process";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Full path: preview (appType custom) does not resolve directory indexes.
const URL = "http://localhost:4799/cv/index.html";

const server = spawn("vp", ["preview", "--port", "4799", "--strictPort"], { stdio: "ignore" });
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(URL).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (i > 50) throw new Error(`preview server never answered at ${URL}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  execFileSync(CHROME, ["--headless", "--no-pdf-header-footer", "--print-to-pdf=cv.pdf", URL], {
    stdio: "ignore",
  });
  console.log("wrote cv.pdf");
} finally {
  server.kill();
}
