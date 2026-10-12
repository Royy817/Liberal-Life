'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../server/db.cjs');
(async()=>{
  const statements=fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
  for(const sql of statements)await getDb().query(sql);
  console.log('AIPLUN LIFE schema ready');
})().catch(()=>{console.error('Migration failed. Check DATABASE_URL; secret values are not logged.');process.exitCode=1;});
