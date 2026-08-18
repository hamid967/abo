const { spawn } = require("node:child_process");

let child;
let stopping = false;
const port = process.env.EXPO_PORT || "8081";
const metroEnv = { ...process.env, EXPO_NO_METRO_WORKSPACE_ROOT: "1" };
delete metroEnv.EXPO_USE_METRO_WORKSPACE_ROOT;

function startMetro() {
  child = spawn(
    "npx",
    ["expo", "start", "--lan", "--max-workers", "1", "--port", port],
    {
      stdio: "inherit",
      env: metroEnv,
    },
  );

  child.on("exit", (code, signal) => {
    if (stopping) {
      process.exit(code ?? 0);
    }

    console.warn(
      `[metro-supervisor] Metro stopped (${signal || `code ${code ?? 0}`}); restarting in 1 second.`,
    );
    setTimeout(startMetro, 1000);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
}

startMetro();
