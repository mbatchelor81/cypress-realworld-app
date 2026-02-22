import { describe, expect, it, beforeEach } from "vitest";
import { seedDatabase, getAllUsers, searchUsers } from "../../backend/database";

import { User } from "../models";

describe("Users", () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it("should get a user by email address", async () => {
    const userToLookup: User = (await getAllUsers())[0];
    const { email } = userToLookup;

    const users = await searchUsers(email);

    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].id).toBe(userToLookup.id);
  });

  it("should get a user by username", async () => {
    const userToLookup: User = (await getAllUsers())[0];
    const { username } = userToLookup;

    const users = await searchUsers(username);

    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].id).toBe(userToLookup.id);
  });

  it("should get a user by phone number", async () => {
    const userToLookup: User = (await getAllUsers())[0];
    const { phoneNumber } = userToLookup;

    const users = await searchUsers(phoneNumber);

    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].id).toBe(userToLookup.id);
  });

  it("should get a list of users by alpha (username, email) (fuzzy match)", async () => {
    const userToLookup: User = (await getAllUsers())[0];
    const users = await searchUsers(userToLookup.firstName);

    expect(users.length).toBeGreaterThanOrEqual(1);
  });

  it("should get a list of users by phone (fuzzy match)", async () => {
    const users = await searchUsers("201");

    expect(users.length).toBeGreaterThanOrEqual(1);
  });
});
