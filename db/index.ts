import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let db: ReturnType<typeof create> | undefined;

function create() {
  return drizzle(neon(process.env.DATABASE_URL!), { schema });
}

export function getDb() {
  return (db ??= create());
}
