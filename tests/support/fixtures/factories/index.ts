/**
 * Data Factories Index
 *
 * Re-exports all data factories for convenient imports:
 *
 *   import { buildUser, buildUsers } from '../support/fixtures/factories';
 *
 * For DB-backed user creation, use testHelpers.createUser() / saveUser()
 * from the fixture instead.
 */

export { buildUser, buildUsers } from "./user.factory";
export type { UserData, UserOverrides } from "./user.factory";
