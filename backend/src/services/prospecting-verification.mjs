import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import http from 'node:http';
import https from 'node:https';
export const OWNER='fba75bd9-8f92-4e2b-83f9-3bc48d7fa4bd';
export const normCnpj=x=>String(x||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
export function validCnpj(value){
 const s=normCnpj(value); if(!/^[A-Z0-9]{12}\d{2}$/.test(s)||/^(.)\1+$/.test(s))return false;
 const digit=t=>{let w=t.length-7,sum=0;for(const c of t){sum+=(c.charCodeAt(0)-48)*w;if(--w<2)w=9;} const r=sum%11;return r<2?0:11-r;};
 return digit(s.slice(0,12))===Number(s[12])&&digit(s.slice(0,13))===Number(s[13]);
}
const ddds=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export function phone(value){let s=String(value||'').replace(/\D/g,'');if(s.length===12||s.length===13){if(s.startsWith('55'))s=s.slice(2);}return ddds.has(s.slice(0,2))&&(/^[0-9]{2}[2-5][0-9]{7}$/.test(s)||/^[0-9]{2}9[0-9]{8}$/.test(s))?s:null;}
export function containsCnpj(text,cnpj){return [...String(text).toUpperCase().matchAll(/(?<![A-Z0-9])([A-Z0-9]{2}\.?[A-Z0-9]{3}\.?[A-Z0-9]{3}\/?[A-Z0-9]{4}-?\d{2})(?![A-Z0-9])/g)].some(m=>normCnpj(m[1])===cnpj);}
export function containsPhone(text,target){return [...String(text).matchAll(/(?<!\d)(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4}(?!\d)/g)].some(m=>phone(m[0])===target);}
export function publicAddress(ip){if(isIP(ip)===6)return /^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:(?:db8|0):/i.test(ip);if(isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));}
export async function getPublic(url,hops=0){
 const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||hops>3)throw Error('fonte_publica_invalida');
 const addresses=await dns.lookup(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('endereco_nao_publico');
 const pinned=addresses[0];
 const response=await new Promise((resolve,reject)=>{
  const req=(u.protocol==='https:'?https:http).get(u,{headers:{'User-Agent':'DigitaleLeadVerifier/1.0','Accept':'application/json,text/html'},lookup:(hostname,opts,cb)=>opts.all?cb(null,[pinned]):cb(null,pinned.address,pinned.family)},res=>{
   if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({redirect:new URL(res.headers.location,u).href});return;}
   if(res.statusCode!==200){res.resume();reject(Error(`fonte_http_${res.statusCode}`));return;}
   let size=0,chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>1000000)res.destroy(Error('fonte_muito_grande'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>resolve({url:u.href,body:Buffer.concat(chunks).toString('utf8')}));
  });req.setTimeout(15000,()=>req.destroy(Error('fonte_timeout')));req.on('error',reject);
 });return response.redirect?getPublic(response.redirect,hops+1):response;
}
export const socialUrl=url=>{try{return /(^|\.)(instagram\.com|facebook\.com|linkedin\.com)$/.test(new URL(url).hostname);}catch{return false;}};
export const plain=html=>String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
export function links(html,base){return [...String(html).matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1].replace(/&amp;/g,'&'),base).href;}catch{return '';}}).filter(Boolean);}
const fresh=t=>{const age=Date.now()-Date.parse(t);return Number.isFinite(age)&&age>=-60000&&age<=86400000;};
export function validProof(p,body){
 return p?.version===1&&p.review_status==='pending_nicolle'&&p.owner_id===OWNER&&p.phone_call_tested===false&&fresh(p.checked_at)&&validCnpj(body.cnpj)&&normCnpj(body.cnpj)===p.cnpj&&phone(body.phone)===p.phone&&p.registry?.active===true&&p.registry.cnpj===p.cnpj&&[p.registry.legal_name,p.registry.trade_name].filter(Boolean).includes(body.company)&&p.website?.cnpj_match===true&&p.website?.phone_match===true&&(p.social?.identity_match===true||p.social?.status==='pending_nicolle')&&[p.registry.url,p.website.url,...(p.social?.identity_match===true?[p.social.url]:[])].every(u=>{try{return /^https?:$/.test(new URL(u).protocol);}catch{return false;}})&&(p.social?.status==='pending_nicolle'||socialUrl(p.social.url));
}


// DIGITALE_HOURLY_REVIEW_V1
export function reviewDescription(p) {
  const c = normCnpj(p.cnpj);
  const formattedCnpj =
    `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
  const number = phone(p.phone) || String(p.phone || '');
  const formattedPhone =
    `(${number.slice(0,2)}) ${number.slice(2,-4)}-${number.slice(-4)}`;
  const checked = new Date(p.checked_at).toLocaleString('pt-BR', {
    timeZone:'America/Sao_Paulo'
  });
  return [
    'Validação pendente — Nicolle',
    '',
    `Empresa: ${p.registry.legal_name}`,
    `CNPJ: ${formattedCnpj} — cadastro ativo`,
    `Telefone: ${formattedPhone}`,
    `Conferência: ${checked}`,
    '',
    'Telefone publicado no site; ligação não realizada.',
    p.social?.identity_match
      ? 'Rede social: conferência automática registrada; revisão humana pendente.'
      : 'Rede social: pendente de conferência por Nicolle.',
    '',
    'Fontes:',
    `Cadastro: ${p.registry.url}`,
    `Site: ${p.website.url}`,
    p.social?.url ? `Rede social: ${p.social.url}` : null
  ].filter(line => line !== null).join('\n');
}

export async function hourlyAllowance(db) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone:'America/Sao_Paulo',
    hourCycle:'h23',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  }).formatToParts(now);

  const value = type =>
    Number(parts.find(p => p.type === type).value);
  const hour = value('hour');

  if (hour < 8 || hour >= 18) {
    console.log('Fora do horário: 08h às 18h, São Paulo.');
    return 0;
  }

  const elapsed = value('minute') * 60
    + value('second') + now.getMilliseconds() / 1000;

  const [rows] = await db.execute(`
    SELECT COUNT(*) AS total
    FROM prospecting_verified_delivery_queue
    WHERE status='synced'
      AND synced_at >= DATE_SUB(NOW(6), INTERVAL ? SECOND)
      AND synced_at <= NOW(6)
  `, [elapsed]);

  const delivered = Number(rows[0].total);
  const remaining = Math.max(0, 20 - delivered);

  console.log(JSON.stringify({
    hourly_target:20,
    confirmed_this_hour:delivered,
    remaining,
    schedule:'08:00-18:00',
    timezone:'America/Sao_Paulo'
  }));
  return remaining;
}
