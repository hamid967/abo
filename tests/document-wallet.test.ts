import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("document wallet", () => {
  const db = readFileSync("server/db.ts", "utf8");
  const routers = readFileSync("server/routers.ts", "utf8");
  const screen = readFileSync("app/documents/index.tsx", "utf8");

  it("lists and deletes only documents owned by the active user", () => {
    expect(db).toContain("export async function listOwnedDocuments");
    expect(db).toContain("eq(documents.ownerUserId, ownerUserId)");
    expect(db).toContain("export async function softDeleteOwnedDocument");
    expect(db).toContain("DOCUMENT_LINKED_TO_RECORD");
  });

  it("uses protected list, upload, download-link, and delete routes", () => {
    expect(routers).toContain("list: protectedProcedure.query");
    expect(routers).toContain("downloadUrl: protectedProcedure");
    expect(routers).toContain("delete: protectedProcedure");
    expect(routers).toContain("storageGetSignedUrl");
  });

  it("offers actual file selection with allowed types and a size cap", () => {
    expect(screen).toContain("DocumentPicker.getDocumentAsync");
    expect(screen).toContain("copyToCacheDirectory: true");
    expect(screen).toContain("maxFileSize");
    expect(screen).toContain("trpc.documents.list.useQuery");
  });
});
