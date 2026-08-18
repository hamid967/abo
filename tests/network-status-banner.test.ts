import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "components/network-status-banner.tsx"), "utf8");

describe("network status banner", () => {
  it("uses actual internet reachability and explains queued network actions", () => {
    expect(source).toContain("Network.useNetworkState()");
    expect(source).toContain("isInternetReachable");
    expect(source).toContain("الرفع والمزامنة والإجراءات الجديدة");
    expect(source).toContain("Network.getNetworkStateAsync()");
    expect(source).toContain("إعادة المحاولة");
    expect(source).toContain("عاد اتصال الإنترنت");
  });
});
