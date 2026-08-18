import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import { readSessionToken } from "../auth/secureSession";

export const API_BASE_URL = "https://govtrackapp-juokytrr.manus.space";

export const api: any = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      transformer: superjson,
      async headers() {
        const token = await readSessionToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
