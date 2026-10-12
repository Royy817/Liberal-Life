'use strict';
// Read the password from stdin so it never appears in command history/argv.
const fs = require('node:fs');
const { passwordHash } = require('../server/auth.cjs');
(async()=>{
  const username=process.argv[2];
  if(!/^[a-zA-Z0-9_-]{2,40}$/.test(username||''))throw new Error('Username must be 2–40 safe characters');
  const password=fs.readFileSync(0,'utf8').replace(/\r?\n$/,'');
  const hash=await passwordHash(password);
  process.stdout.write(JSON.stringify({username,hash})+'\n');
})().catch(()=>{console.error('Use a valid username and a 16–128 character password on stdin.');process.exitCode=1;});
