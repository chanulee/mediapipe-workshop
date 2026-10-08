import { api } from './server.mjs';
import assets from './assets.mjs';
export default {async fetch(req,env) {
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/'))return api(req,env);
  const path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  const asset=assets[path];
  if(!asset && assets[path+'/index.html'])return Response.redirect(url.origin+path+'/'+url.search,302);
  if(!asset)return new Response('페이지를 찾지 못했어요.',{status:404});
  if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});
  const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
  return new Response(req.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[0],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Permissions-Policy':'camera=(self), microphone=()','Referrer-Policy':'same-origin'}});
}};
