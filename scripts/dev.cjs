'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('../server/admin.cjs');
const { PGlite } = require('@electric-sql/pglite');
async function main() {
  process.env.NODE_ENV = 'development';
  let db;
  if (process.env.LOCAL_DATABASE_PATH) {
    if (process.env.VERCEL) throw new Error('Local SQL engine cannot run on Vercel');
    db = new PGlite(process.env.LOCAL_DATABASE_PATH);
    await db.exec(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));
  }
  const api = createHandler({db,secure:false});
  const root = path.join(__dirname,'../public');
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain'};
  const server = http.createServer((req,res)=>{
    const url = new URL(req.url,'http://local');
    if(url.pathname==='/api/admin')return api(req,res);
    const relative=url.pathname==='/'?'index.html':/^\/admin\/?$/.test(url.pathname)?'admin/index.html':decodeURIComponent(url.pathname.slice(1));
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    if(relative.startsWith('admin/'))res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('AIPLUN LIFE local server ready'));
}
main().catch(()=>{console.error('Local startup failed. Check database and admin configuration.');process.exitCode=1;});
