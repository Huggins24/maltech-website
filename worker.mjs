const origins = new Set(['https://maltech-young.co.uk','https://www.maltech-young.co.uk']);
const json = (body,status=200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
export default {
 async scheduled(controller,env,ctx){
  if(!env.WORKSHOP||!env.WEBSITE_BRIDGE_SECRET)return;
  ctx.waitUntil((async()=>{
   const target=new URL('https://app.maltech-young.co.uk/api/internal/booking-emails');const timestamp=String(Date.now());
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array()))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const canonical=['POST',target.pathname,'https://maltech-young.co.uk','',timestamp,'booking-email-scheduler',digest].join('\n');
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.WEBSITE_BRIDGE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(canonical)))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const result=await env.WORKSHOP.fetch(new Request(target,{method:'POST',headers:{origin:'https://maltech-young.co.uk','x-maltech-client-ip':'booking-email-scheduler','x-maltech-timestamp':timestamp,'x-maltech-signature':signature},signal:AbortSignal.timeout(30000)}));
   if(!result.ok)throw Error('Booking email retry job failed');
  })());
 },
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/booking-config')return json({enabled:Boolean(env.WORKSHOP),localPreview:false});
  if(url.pathname==='/api/public/bookings'){
   if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
   const origin=request.method==='GET'?url.origin:request.headers.get('origin');
   if(!origins.has(origin))return json({error:'This booking request is not allowed.'},403);
   const ip=request.headers.get('cf-connecting-ip');
   if(!ip||!env.WORKSHOP||!env.WEBSITE_BRIDGE_SECRET)return json({error:'Online bookings are temporarily unavailable.'},503);
   if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send booking details as JSON.'},415);
   let bytes;
   if(request.method==='POST'){
    const reader=request.body?.getReader();if(!reader)return json({error:'Booking details are missing.'},400);
    const chunks=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>12000){await reader.cancel();return json({error:'Your booking message is too long.'},413);}chunks.push(part.value);}
    bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   }
   const headers=new Headers({'origin':origin,'x-maltech-client-ip':ip});
   if(request.method==='POST'){headers.set('content-type','application/json');headers.set('idempotency-key',request.headers.get('idempotency-key')||'');}
   const target=new URL('https://app.maltech-young.co.uk/api/public/bookings');
   if(request.method==='GET')target.searchParams.set('date',url.searchParams.get('date')||'');
   try{
    const timestamp=String(Date.now());headers.set('x-maltech-timestamp',timestamp);
    const bodyDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes||new Uint8Array()))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const canonical=[request.method,target.pathname+target.search,origin,headers.get('idempotency-key')||'',timestamp,ip,bodyDigest].join('\n');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.WEBSITE_BRIDGE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(canonical)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    headers.set('x-maltech-signature',signature);
    const response=await env.WORKSHOP.fetch(new Request(target,{method:request.method,headers,body:bytes,signal:AbortSignal.timeout(20000)}));
    if(!response.headers.get('content-type')?.includes('application/json'))return json({error:'Online bookings are temporarily unavailable. Please try again.'},503);
    return new Response(await response.text(),{status:response.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
   }catch{return json({error:'The booking system could not be reached. Please try again.'},503);}
  }
  if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
  const response=await env.ASSETS.fetch(request);
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  if(headers.get('content-type')?.includes('text/html'))headers.set('Cache-Control','no-cache');
  return new Response(response.body,{status:response.status,headers});
 }
};
