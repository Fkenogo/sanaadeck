/* eslint-disable no-console */
const admin = require("firebase-admin");
const {migrateWorkspaceData} = require("../workspace/migration");

if (!admin.apps.length) {
  admin.initializeApp();
}

const pruneLegacy = process.argv.includes("--prune");

async function run() {
  console.log("Starting workspace data migration...");
  console.log(`Mode: ${pruneLegacy ? "migrate + prune" : "migrate only (legacy fields retained)"}`);

  const result = await migrateWorkspaceData({pruneLegacy});

  console.log("Workspace migration complete.");
  console.log(`Projects scanned: ${result.scanned}`);
  console.log(`Projects with legacy data migrated: ${result.migratedProjects}`);
  console.log(`Subcollection documents written/updated: ${result.totalInserted}`);
  if (pruneLegacy) {
    console.log("Legacy arrays were cleared after migration.");
  } else {
    console.log("Legacy arrays retained. Re-run with --prune after validation if desired.");
  }
}

run().catch((error) => {
  console.error("Workspace migration failed:", error);
  process.exit(1);
});
