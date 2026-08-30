import { execFileSync, spawn } from "node:child_process";
import process from "node:process";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const appMarker = `${process.cwd()}/`;

function listeningPids() {
  try {
    const output = execFileSync(
      "lsof",
      ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return output
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function commandFor(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function stopOrblitzListener(pid) {
  const command = commandFor(pid);
  const isOrblitzVite = command.includes(appMarker) &&
    (command.includes("vite") || command.includes("start-dev.mjs"));
  if (!isOrblitzVite) return false;

  console.warn(`[orblitz] Reclaiming stale dev listener ${pid} on port ${port}`);
  try {
    process.kill(pid, "SIGTERM");
    for (let attempt = 0; attempt < 20; attempt++) {
      if (!listeningPids().includes(pid)) return true;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
    if (listeningPids().includes(pid)) process.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

for (const pid of listeningPids()) stopOrblitzListener(pid);

const child = spawn(
  process.platform === "win32" ? "vite.cmd" : "vite",
  ["--config", "vite.config.ts", "--host", "0.0.0.0", "--strictPort"],
  { stdio: "inherit", env: process.env },
);

const forwardSignal = (signal) => child.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});