import type { ProviderStateInput } from "./consumer-helpers";

export const poolExists = (pool: {
  id: string;
  name: string;
  season: string;
  ownerId: string;
}): ProviderStateInput => ({
  name: "A pool exists",
  params: pool,
});

export const userExists = (user: {
  id: string;
  email: string;
  name: string;
}): ProviderStateInput => ({
  name: "A user exists",
  params: user,
});

export const noPoolsExist = (): ProviderStateInput => ({
  name: "No pools exist",
  params: {},
});

export const poolHasEntries = (pool: {
  poolId: string;
  entryCount: number;
}): ProviderStateInput => ({
  name: "A pool has entries",
  params: pool,
});
