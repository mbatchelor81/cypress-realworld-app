import dotenv from "dotenv";
import { buildDatabase } from "./seedDataUtils";
import { TDatabase } from "../backend/database";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const chunkInsert = async (table: string, rows: any[]) => {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
};

const seed = async () => {
  console.log("Generating seed data...");
  const testSeed: TDatabase = buildDatabase();

  // Truncate tables in reverse FK order
  const tables = [
    "banktransfers",
    "notifications",
    "comments",
    "likes",
    "transactions",
    "bankaccounts",
    "contacts",
    "users",
  ];

  console.log("Clearing existing data...");
  for (const table of tables) {
    await supabase.from(table).delete().neq("id", "");
  }

  // Insert in FK order
  console.log("Inserting users...");
  await chunkInsert("users", testSeed.users);

  console.log("Inserting contacts...");
  await chunkInsert("contacts", testSeed.contacts);

  console.log("Inserting bank accounts...");
  await chunkInsert("bankaccounts", testSeed.bankaccounts);

  console.log("Inserting transactions...");
  await chunkInsert("transactions", testSeed.transactions);

  console.log("Inserting likes...");
  await chunkInsert("likes", testSeed.likes);

  console.log("Inserting comments...");
  await chunkInsert("comments", testSeed.comments);

  console.log("Inserting notifications...");
  await chunkInsert("notifications", testSeed.notifications);

  console.log("Inserting bank transfers...");
  await chunkInsert("banktransfers", testSeed.banktransfers);

  console.log("Seed data inserted into Supabase successfully!");
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
