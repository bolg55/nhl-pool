import path from "node:path";

import { PactV4 } from "@pact-foundation/pact";

export const createPact = (overrides?: { consumer?: string; provider?: string }) =>
  new PactV4({
    dir: path.resolve(process.cwd(), "pacts"),
    consumer: overrides?.consumer ?? "NhlPoolWeb",
    provider: overrides?.provider ?? "NhlPoolAPI",
    logLevel: "warn",
  });
