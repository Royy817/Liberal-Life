'use strict';
let client;
function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  if (!client) {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    client = { query: (text, params = []) => sql.query(text, params) };
  }
  return client;
}
module.exports = { getDb };
