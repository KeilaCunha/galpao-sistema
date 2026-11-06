import { spawnSync } from "node:child_process";

if (process.env.RENDER) {
  console.log("Render: só a API. O site continua na Vercel.");
  process.exit(0);
}

const tsc = spawnSync("npx", ["tsc", "-b"], { stdio: "inherit", shell: true });
if (tsc.status) process.exit(tsc.status ?? 1);
const vite = spawnSync("npx", ["vite", "build"], { stdio: "inherit", shell: true });
process.exit(vite.status ?? 1);
