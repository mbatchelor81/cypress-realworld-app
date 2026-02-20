require("dotenv").config();
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const seedData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "database-seed.json"), "utf-8")
);

const defaultPassword = process.env.SEED_DEFAULT_USER_PASSWORD || "s3cret";
const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

seedData.users = seedData.users.map((user: { password: string }) => ({
  ...user,
  password: user.password === "HASHED_AT_RUNTIME" ? hashedPassword : user.password,
}));

fs.writeFileSync(
  path.join(process.cwd(), "data", "database.json"),
  JSON.stringify(seedData, null, 2)
);
