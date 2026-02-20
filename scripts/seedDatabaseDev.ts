require("dotenv").config();

import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const defaultPassword = process.env.SEED_DEFAULT_USER_PASSWORD!;
const passwordHash = bcrypt.hashSync(defaultPassword, 10);

const seedPath = path.join(process.cwd(), "data", "database-seed.json");
const dbPath = path.join(process.cwd(), "data", "database.json");

const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

if (seedData.users) {
  seedData.users.forEach((user: { password: string }) => {
    if (user.password === "HASHED_AT_SEED_TIME") {
      user.password = passwordHash;
    }
  });
}

fs.writeFileSync(dbPath, JSON.stringify(seedData, null, 2));
console.log("database seeded with hashed passwords");
