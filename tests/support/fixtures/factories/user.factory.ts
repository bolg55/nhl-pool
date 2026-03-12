/**
 * User Data Factory
 *
 * Two approaches available:
 *
 * 1. **Better Auth testUtils** (recommended for auth-related tests):
 *    Uses testHelpers.createUser() / saveUser() / deleteUser() directly.
 *    Available via the `testHelpers` fixture.
 *
 * 2. **Faker-based factory** (for non-auth test data or unit tests):
 *    Uses @faker-js/faker for realistic data without DB access.
 *
 * Usage:
 *   // Via testHelpers fixture (preferred):
 *   const user = testHelpers.createUser({ email: 'test@example.com' });
 *   const saved = await testHelpers.saveUser(user);
 *
 *   // Via standalone factory (unit tests, no DB):
 *   const user = buildUser({ name: 'Alice' });
 */

import { faker } from "@faker-js/faker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape that mirrors the Drizzle `user` table in auth.schema.ts. */
export interface UserData {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UserOverrides = Partial<UserData>;

// ---------------------------------------------------------------------------
// Standalone build function (no DB, no auth — pure data generation)
// ---------------------------------------------------------------------------

/**
 * Build a user object with realistic defaults using Faker.
 * Does NOT persist to the database. Use testHelpers.saveUser() for that.
 */
export function buildUser(overrides: UserOverrides = {}): UserData {
  const now = new Date().toISOString();
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id: faker.string.uuid(),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Build multiple user objects without persistence.
 */
export function buildUsers(count: number, overrides: UserOverrides = {}): UserData[] {
  return Array.from({ length: count }, () => buildUser(overrides));
}
