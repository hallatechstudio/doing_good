import "dotenv/config";
import pg from "pg";
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  const result = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  console.log(JSON.stringify({ connected: true, tables: result.rows.map((r) => r.table_name) }));
} catch (error) {
  console.error(JSON.stringify({ connected: false, error: error.code || error.message }));
  process.exitCode = 1;
} finally {
  await client.end();
}
