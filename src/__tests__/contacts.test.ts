import { describe, expect, it, beforeEach } from "vitest";
import {
  createContactForUser,
  getContactsByUsername,
  getAllContacts,
  getAllUsers,
  getRandomUser,
  seedDatabase,
  removeContactById,
  getContactsByUserId,
} from "../../backend/database";
import { User } from "../../src/models/user";
import { totalContacts, contactsPerUser } from "../../scripts/seedDataUtils";
describe("Contacts", () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it("should retrieve a list of contacts", async () => {
    expect((await getAllContacts()).length).toEqual(totalContacts);
  });

  it("should retrieve a list of contacts for a username", async () => {
    const userToLookup: User = (await getAllUsers())[0];

    const result = await getContactsByUsername(userToLookup.username);
    expect(result.length).toBeGreaterThanOrEqual(contactsPerUser);
    expect(result[0].userId).toBe(userToLookup.id);
  });

  it("should retrieve a list of contacts for a userId", async () => {
    const userToLookup: User = (await getAllUsers())[0];

    const result = await getContactsByUserId(userToLookup.id);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].userId).toBe(userToLookup.id);
  });

  it("should create a contact for user", async () => {
    const user: User = await getRandomUser();
    const contactToBe: User = await getRandomUser();

    const result = await createContactForUser(user.id, contactToBe.id);
    expect(result.userId).toBe(user.id);
  });

  it("should delete a contact", async () => {
    const userToLookup: User = await getRandomUser();

    const contacts = await getContactsByUsername(userToLookup.username);

    const contactId = contacts[0].id;

    await removeContactById(contactId);

    const updatedContacts = await getContactsByUsername(userToLookup.username);
    expect(updatedContacts.length).toBeLessThan(contacts.length);
  });
});
