import { MatchersV3 } from "@pact-foundation/pact";
import type { V3MockServer } from "@pact-foundation/pact";

import { createProviderState, setJsonBody, setJsonContent } from "../support/consumer-helpers";
import { createPact } from "../support/pact-config";
import { poolExists, noPoolsExist } from "../support/provider-states";

// TODO: Import REAL consumer API client once it exists.
// Example: import { getPools, getPoolById, setApiUrl } from '../../../src/api/pool-client';
//
// For now, we use a placeholder fetch wrapper to demonstrate the pattern.
// Replace with actual consumer code before running in CI.

let apiBaseUrl = "http://localhost:3000";

function setApiUrl(url: string) {
  apiBaseUrl = url;
}

async function getPools(): Promise<Array<{ id: string; name: string; season: string }>> {
  const res = await fetch(`${apiBaseUrl}/api/pools`);
  if (!res.ok) throw new Error(`GET /api/pools failed: ${res.status}`);
  return res.json();
}

async function getPoolById(
  id: string,
): Promise<{ id: string; name: string; season: string; ownerId: string }> {
  const res = await fetch(`${apiBaseUrl}/api/pools/${id}`);
  if (!res.ok) throw new Error(`GET /api/pools/${id} failed: ${res.status}`);
  return res.json();
}

const { like, string, eachLike } = MatchersV3;

const pact = createPact();

describe("NHL Pool API Consumer Contract", () => {
  const testPool = {
    id: "pool-1",
    name: "2026 Playoff Pool",
    season: "2025-2026",
    ownerId: "user-1",
  };

  it("should get a pool by ID", async () => {
    const [stateName, stateParams] = createProviderState(poolExists(testPool));

    await pact
      .addInteraction()
      .given(stateName, stateParams)
      .uponReceiving("a request to get a pool by ID")
      .withRequest(
        "GET",
        "/api/pools/pool-1",
        setJsonContent({
          headers: { Accept: "application/json" },
        }),
      )
      .willRespondWith(
        200,
        setJsonBody(
          like({
            id: string("pool-1"),
            name: string("2026 Playoff Pool"),
            season: string("2025-2026"),
            ownerId: string("user-1"),
          }),
        ),
      )
      .executeTest(async (mockServer: V3MockServer) => {
        setApiUrl(mockServer.url);

        const pool = await getPoolById("pool-1");

        expect(pool.id).toBe("pool-1");
        expect(pool.name).toBe("2026 Playoff Pool");
      });
  });

  it("should get all pools", async () => {
    const [stateName, stateParams] = createProviderState(poolExists(testPool));

    await pact
      .addInteraction()
      .given(stateName, stateParams)
      .uponReceiving("a request to list all pools")
      .withRequest(
        "GET",
        "/api/pools",
        setJsonContent({
          headers: { Accept: "application/json" },
        }),
      )
      .willRespondWith(
        200,
        setJsonBody(
          eachLike({
            id: string("pool-1"),
            name: string("2026 Playoff Pool"),
            season: string("2025-2026"),
          }),
        ),
      )
      .executeTest(async (mockServer: V3MockServer) => {
        setApiUrl(mockServer.url);

        const pools = await getPools();

        expect(pools.length).toBeGreaterThanOrEqual(1);
        expect(pools[0].name).toBe("2026 Playoff Pool");
      });
  });

  it("should handle pool not found", async () => {
    const [stateName, stateParams] = createProviderState(noPoolsExist());

    await pact
      .addInteraction()
      .given(stateName, stateParams)
      .uponReceiving("a request to get a non-existent pool")
      .withRequest("GET", "/api/pools/non-existent")
      .willRespondWith(404, setJsonBody({ error: "Pool not found" }))
      .executeTest(async (mockServer: V3MockServer) => {
        setApiUrl(mockServer.url);

        await expect(getPoolById("non-existent")).rejects.toThrow();
      });
  });
});
