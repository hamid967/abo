import { collectVerifiedOfficialSources } from "../server/db";

async function main() {
  const result = await collectVerifiedOfficialSources();
  console.log(JSON.stringify(result));
  process.exit(result.failedSourceIds.length ? 1 : 0);
}

main().catch(() => {
  console.error("official_update_collection_failed");
  process.exitCode = 1;
});
