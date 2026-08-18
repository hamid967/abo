const fs = require("node:fs");
const path = require("node:path");

const gradlePath = path.resolve(
  process.cwd(),
  process.argv[2] ?? "android/app/build.gradle",
);
const source = fs.readFileSync(gradlePath, "utf8");
const marker = "// Abu Mishal release signing injected by CI";

if (source.includes(marker)) {
  process.exit(0);
}

const signingBlock = /signingConfigs\s*\{/;
if (!signingBlock.test(source)) {
  throw new Error("Unable to find the Android signingConfigs block.");
}

const releaseConfig = `
        ${marker}
        release {
            if (project.hasProperty("ABU_MISHAL_KEYSTORE_FILE")) {
                storeFile file(ABU_MISHAL_KEYSTORE_FILE)
                storePassword ABU_MISHAL_KEYSTORE_PASSWORD
                keyAlias ABU_MISHAL_KEY_ALIAS
                keyPassword ABU_MISHAL_KEY_PASSWORD
            }
        }`;

let updated = source.replace(signingBlock, (match) => `${match}${releaseConfig}`);

if (/buildTypes\s*\{/.test(updated)) {
  updated = updated.replace(
    /buildTypes\s*\{/,
    "buildTypes {\n        release.signingConfig signingConfigs.release",
  );
} else {
  updated += "\nandroid.buildTypes.release.signingConfig = android.signingConfigs.release\n";
}

fs.writeFileSync(gradlePath, updated);
