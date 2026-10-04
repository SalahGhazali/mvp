/* Local frontend preview with automatic browser reload; no dependencies. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.QATRA_LIVE_PORT || 5501);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid QATRA_LIVE_PORT');
const clients = new Set();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
const reloadScript = `<script>(()=>{const source=new EventSource('/__qatra_live');source.addEventListener('reload',()=>location.reload());})();</script>`;
const insideRoot = file => {const relative=path.relative(root,file);return relative!== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);};
const server = http.createServer((request, response) => {
  if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405);response.end();return;}
  let pathname;
  try {pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);} catch {response.writeHead(400);response.end('Invalid URL');return;}
  if(pathname==='/__qatra_live') {
    response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    response.write(': connected\n\n');clients.add(response);request.on('close',()=>clients.delete(response));return;
  }
  if(pathname.split(/[\\/]/).some(part=>part.startsWith('.'))){response.writeHead(403);response.end('Forbidden');return;}
  let file=path.resolve(root,'.'+pathname);
  if(!insideRoot(file)){response.writeHead(403);response.end('Forbidden');return;}
  try {
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!insideRoot(fs.realpathSync(file)))throw new Error('Outside project');
    let body=fs.readFileSync(file);
    if(path.extname(file)==='.html')body=Buffer.from(body.toString('utf8').replace(/<\/body>/i,reloadScript+'</body>'));
    response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':body.length});
    response.end(request.method==='HEAD'?undefined:body);
  }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
});
let reloadTimer;
const watcher=fs.watch(root,{recursive:true},(event,file)=>{
  if(!file||String(file).split(/[\\/]/).some(part=>part.startsWith('.'))||!['.html','.js','.css','.json'].includes(path.extname(file)))return;
  clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>{for(const client of clients)client.write('event: reload\ndata: update\n\n');},150);
});
const heartbeat=setInterval(()=>{for(const client of clients)client.write(': keepalive\n\n');},15000);
server.on('error',error=>{console.error(error.message);watcher.close();clearInterval(heartbeat);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Qatra Live Server: http://localhost:${port}/`));
function stop(){watcher.close();clearTimeout(reloadTimer);clearInterval(heartbeat);for(const client of clients)client.end();server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
