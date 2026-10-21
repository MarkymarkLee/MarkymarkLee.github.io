import { mountSlime } from "./slime/app.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#slime");
if (canvas) mountSlime(canvas);
