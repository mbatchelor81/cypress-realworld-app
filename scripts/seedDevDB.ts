require("dotenv").config();

import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const seedData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "database-seed.json"), "utf-8")
);

const passwordHash = bcrypt.hashSync(process.env.SEED_DEFAULT_USER_PASSWORD!, 10);
seedData.users = seedData.users.map((user: Record<string, unknown>) => ({
  ...user,
  password: passwordHash,
}));

fs.writeFileSync(
  path.join(process.cwd(), "data", "database.json"),
  JSON.stringify(seedData, null, 2)
);
