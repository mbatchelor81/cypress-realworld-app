import { describe, expect, it, beforeEach } from "vitest";
import { faker } from "@faker-js/faker";
import {
  getBankAccountById,
  getBankAccountsByUserId,
  getRandomUser,
  seedDatabase,
  createBankAccountForUser,
  removeBankAccountById,
} from "../../backend/database";
import { User } from "../../src/models/user";
import { BankAccount } from "../../src/models/bankaccount";
describe("BankAccounts", () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it("should retrieve a list of bank accounts for a user", async () => {
    const userToLookup: User = await getRandomUser();

    const result = await getBankAccountsByUserId(userToLookup.id);
    expect(result[0].userId).toBe(userToLookup.id);
  });

  it("should retrieve a bank accounts by id", async () => {
    const userToLookup: User = await getRandomUser();

    const accounts = await getBankAccountsByUserId(userToLookup.id);
    const bankAccountId = accounts[0].id;

    const account = await getBankAccountById(bankAccountId);

    expect(account.id).toEqual(bankAccountId);
  });

  it("should create a bank account for user", async () => {
    const user: User = await getRandomUser();
    const accountNumber = faker.finance.accountNumber(10);

    const accountDetails: Partial<BankAccount> = {
      bankName: `${faker.company.name()} Bank`,
      accountNumber,
      routingNumber: faker.finance.accountNumber(9),
    };
    const result = await createBankAccountForUser(user.id, accountDetails);
    expect(result.userId).toBe(user.id);
  });

  it("should delete a bank account", async () => {
    const userToLookup: User = await getRandomUser();

    const accounts = await getBankAccountsByUserId(userToLookup.id);
    const bankAccountId = accounts[0].id;

    await removeBankAccountById(bankAccountId);

    const updatedBankAccounts = await getBankAccountsByUserId(userToLookup.id);
    expect(updatedBankAccounts[0].isDeleted).toBe(true);
  });
});
