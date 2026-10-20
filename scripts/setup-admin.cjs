'use strict';
// Creates an ignored local env file without echoing the password.
const fs=require('node:fs');
const readline=require('node:readline');
const {Writable}=require('node:stream');
const {randomBytes}=require('node:crypto');
const {passwordHash}=require('../server/auth.cjs');
let muted=false;
const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk);done();}});
const rl=readline.createInterface({input:process.stdin,output,terminal:true});
const ask=prompt=>new Promise(resolve=>rl.question(prompt,resolve));
(async()=>{
  if(!process.stdin.isTTY)throw new Error('Use an interactive terminal');
  if(fs.existsSync('.env.admin.local'))throw new Error('The file already exists; it will not be overwritten');
  const username=(await ask('Admin username (2–40 safe characters): ')).trim();
  if(!/^[a-zA-Z0-9_-]{2,40}$/.test(username))throw new Error('Invalid username');
  process.stdout.write('Password (16–128 characters, hidden): ');muted=true;
  const password=await ask('');muted=false;process.stdout.write('\nConfirm password (hidden): ');muted=true;
  const confirm=await ask('');muted=false;process.stdout.write('\n');
  if(password!==confirm)throw new Error('Passwords do not match');
  const hash=await passwordHash(password),accounts=JSON.stringify([{username,hash}]);
  const content="ADMIN_ACCOUNTS='"+accounts+"'\nADMIN_SECRET="+randomBytes(32).toString('hex')+'\nDATABASE_URL=\n';
  fs.writeFileSync('.env.admin.local',content,{mode:0o600,flag:'wx'});
  console.log('Created .env.admin.local. Password is not stored. Never commit or share this file.');
})().catch(error=>{muted=false;console.error(error.message);process.exitCode=1;}).finally(()=>rl.close());
