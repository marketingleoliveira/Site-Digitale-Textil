import {db} from '../database.js';
import {OWNER,normCnpj,validCnpj,phone,containsCnpj,containsPhone,getPublic,socialUrl,plain,links,validProof,hourlyAllowance} from '../services/prospecting-verification.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const dry=process.argv.includes('--dry-run');
const parse=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
const base=process.env.PORTAL_LEAD_URL,secret=process.env.PORTAL_LEAD_SECRET;
async function portal(url,method='GET',payload){
 const r=await fetch(url,{method,headers:{'content-type':'application/json','x-site-lead-secret':secret},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(20000)});
 let body;try{body=await r.json();}catch{throw Error(`portal_http_${r.status}`);}if(!r.ok||body.ok!==true)throw Error(`portal_${body.error||r.status}`);return body;
}
async function verify(c){
 const cnpj=normCnpj(c.cnpj);if(!validCnpj(cnpj))throw Error('cnpj_invalido');
 let registryUrl=`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;

let r;
try {
  const result = await getPublic(registryUrl);
  r = JSON.parse(result.body);
  if (r.opcao_pelo_mei == null) {
    throw Error('consultar_mei_na_fonte_alternativa');
  }
} catch (primaryError) {
  await delay(60000);
  registryUrl = `https://publica.cnpj.ws/cnpj/${cnpj}`;
  const alternative = await getPublic(registryUrl);
  const raw = JSON.parse(alternative.body);
  const e = raw.estabelecimento;
  if (!e || !e.cnpj || !raw.razao_social) {
    throw Error('cadastro_alternativo_incompleto');
  }
  r = {
    cnpj: e.cnpj,
    opcao_pelo_mei: raw.simples?.mei ?? null,
    razao_social: raw.razao_social,
    nome_fantasia: e.nome_fantasia || null,
    situacao_cadastral:
      String(e.situacao_cadastral).toUpperCase() === 'ATIVA' ? 2 : 0,
    ddd_telefone_1: e.ddd1 && e.telefone1
      ? String(e.ddd1) + String(e.telefone1) : null,
    ddd_telefone_2: e.ddd2 && e.telefone2
      ? String(e.ddd2) + String(e.telefone2) : null,
    updated_at: raw.atualizado_em || null
  };
  console.log(JSON.stringify({
    cnpj, registry_fallback: 'CNPJWS'
  }));
}

 if(normCnpj(r.cnpj)!==cnpj||Number(r.situacao_cadastral)!==2||!r.razao_social)throw Error('cadastro_inativo_ou_divergente');

 // POLITICA_NAO_MEI_WHATSAPP_V1
 const meiValue = String(r.opcao_pelo_mei ?? '')
   .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .trim().toLowerCase();
 if (['sim','s','true','1'].includes(meiValue)) {
   throw Error('mei_descartado');
 }
 if (!['nao','n','false','0','no'].includes(meiValue)) {
   console.log(JSON.stringify({cnpj,mei_status:'nao_confirmado'}));
 }
 const phones=[r.ddd_telefone_1,r.ddd_telefone_2,c.contact_phone].map(phone).filter(Boolean);
 let root=c.website||c.domain;if(!root)throw Error('site_ausente');if(!/^https?:\/\//i.test(root))root='https://'+root;
 if(socialUrl(root))throw Error('site_oficial_ausente');const origin=new URL(root).origin;
 const pages=[root,...['/contato','/sobre','/quem-somos'].map(p=>origin+p)];
 let website,contact,social,siteCnpjUrl;
 for(const url of [...new Set(pages)]){
  let page;try{page=await getPublic(url);}catch{continue;}
  if(new URL(page.url).hostname.replace(/^www\./,'')!==new URL(root).hostname.replace(/^www\./,''))continue;
  const text=plain(page.body);if(containsCnpj(text,cnpj))siteCnpjUrl=page.url;if(website)continue;
  // Telefone precisa constar na mesma página que identifica o CNPJ.
  const pageLinks = links(page.body,page.url);
  const whatsappContacts = [];
  for (const link of pageLinks) {
    try {
      const u = new URL(link);
      const allowed = [
        'wa.me','api.whatsapp.com','web.whatsapp.com',
        'www.whatsapp.com','whatsapp.com'
      ];
      if (!allowed.includes(u.hostname.toLowerCase())) continue;
      const rawNumber = u.hostname.toLowerCase() === 'wa.me'
        ? u.pathname.slice(1)
        : u.searchParams.get('phone');
      const number = phone(rawNumber);
      if (number) whatsappContacts.push({number,url:link});
    } catch {}
  }
  const telPhones = pageLinks
    .filter(l=>l.startsWith('tel:')).map(phone).filter(Boolean);
  const preferredPhones = [...new Set([
    ...whatsappContacts.map(w=>w.number),
    ...phones,
    ...telPhones
  ])];
  const available = text + ' ' +
    pageLinks.filter(l=>l.startsWith('tel:')).join(' ') +
    ' ' + whatsappContacts.map(w=>w.number).join(' ');
  const foundContact=preferredPhones.find(p=>containsPhone(available,p));if(!foundContact)continue;contact=foundContact;
  website={
    url:page.url,
    cnpj_match:true,
    phone_match:true,
    whatsapp_link:
      whatsappContacts.find(w=>w.number===contact)?.url || null
  };
  const candidates=links(page.body,page.url).filter(socialUrl).filter(u=>!/(sharer|shareArticle|\/share\b|\/intent\b)/i.test(u));
  for(const socialLink of [...new Set(candidates)].slice(0,3)){
   try{
    const profile=await getPublic(socialLink);if(!socialUrl(profile.url))continue;
    const text=plain(profile.body);
    // Não confundir página de login/bloqueio com perfil verificado.
    const exactCnpj=containsCnpj(text,cnpj);
    const officialBacklink=links(profile.body,profile.url).some(l=>{try{return new URL(l).hostname.replace(/^www\./,'')===new URL(root).hostname.replace(/^www\./,'');}catch{return false;}});
    const names=[r.razao_social,r.nome_fantasia].filter(n=>n&&n.length>=5);
    const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
    const nameMatch=names.some(n=>normalized(text).includes(normalized(n)));
    if(exactCnpj||(officialBacklink&&nameMatch&&containsPhone(text,contact))){social={url:profile.url,identity_match:true,method:exactCnpj?'cnpj':'nome_telefone_link_oficial'};break;}
   }catch{/* Perfil inacessível permanece sem evidência. */}
  }
  // Continuar visitando paginas para encontrar o CNPJ.
 }
 if(!website || !siteCnpjUrl)throw Error('site_sem_comprovacao_separada_cnpj_telefone');website.cnpj_url=siteCnpjUrl;
if(!social) social = {
  url:null,
  identity_match:false,
  status:'pending_nicolle',
  method:'conteudo_pendente_de_conferencia_humana'
};

 const proof={version:1,review_status:'pending_nicolle',owner_id:OWNER,checked_at:new Date().toISOString(),cnpj,phone:contact,phone_call_tested:false,registry:{url:registryUrl,cnpj,active:true,legal_name:r.razao_social,trade_name:r.nome_fantasia||null,source_updated_at:r.updated_at||null},website,social};
 const payload={visitor_key:'verified_'+cnpj,name:null,company:r.nome_fantasia||r.razao_social,cnpj,phone:contact,email:null,phone_validated:true,source:'IA_PROSPECCAO',medium:'cnpj_conferido_v1',campaign:c.campaign_id,path:website.url,identified_at:proof.checked_at,score:Number(c.confidence_score||0),verification:proof};
 if(!validProof(proof,payload))throw Error('prova_invalida');return payload;
}
async function main(){
 const remaining = dry ? 20 : await hourlyAllowance(db);
 if (remaining === 0) return;

 if(!base||!secret)throw Error('integracao_nao_configurada');
 const endpoint=new URL('/api/integrations/prospecting-leads',base).href;
 if(new URL(endpoint).protocol!=='https:'&&!['localhost','127.0.0.1'].includes(new URL(endpoint).hostname))throw Error('portal_requer_https');
 let health;
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    health = await portal(endpoint+'/health');
    break;
  } catch (error) {
    if (attempt === 9) throw error;
    await delay(2000);
  }
}if(health.owner!=='Nicolle')throw Error('responsavel_portal_nao_e_nicolle');
 // Apenas as rejeições automáticas antigas por gates podem ser reavaliadas.
 const autoReject=`(c.status <> 'rejected' OR c.rejection_reason = 'insufficient_evidence' OR c.rejection_reason REGEXP '^(company_verified|icp_verified|contact_verified|recent_activity_verified|intent_verified|textile_relevance_verified|second_validation_passed)(,(company_verified|icp_verified|contact_verified|recent_activity_verified|intent_verified|textile_relevance_verified|second_validation_passed))*$')`;
 if(!dry)await db.execute(`INSERT IGNORE INTO prospecting_verified_delivery_queue(candidate_id,payload,status) SELECT c.id,'{}','pending' FROM prospecting_candidates c WHERE c.cnpj IS NOT NULL AND ${autoReject}`);
 const [rows]=await db.execute(dry?`SELECT c.* FROM prospecting_candidates c WHERE c.cnpj IS NOT NULL AND ${autoReject} ORDER BY c.created_at DESC LIMIT ${remaining}`:`SELECT c.* FROM prospecting_candidates c JOIN prospecting_verified_delivery_queue q ON q.candidate_id=c.id WHERE q.status<>'synced' AND ${autoReject} AND (q.last_attempt_at IS NULL OR q.last_attempt_at < NOW()-INTERVAL 6 HOUR) ORDER BY q.last_attempt_at IS NOT NULL,q.last_attempt_at,c.created_at LIMIT ${remaining}`);
 for(const c of rows){
  try{
   if(!dry)await db.execute(`UPDATE prospecting_verified_delivery_queue SET attempts=attempts+1,last_attempt_at=NOW(),updated_at=NOW() WHERE candidate_id=?`,[c.id]);
   const payload=await verify(c);
   if(dry){console.log(JSON.stringify({candidate_id:c.id,eligible:true,owner:'Nicolle',dry_run:true}));continue;}
   await db.execute(`UPDATE prospecting_verified_delivery_queue SET payload=?,status='pending',last_error=NULL,updated_at=NOW() WHERE candidate_id=?`,[JSON.stringify(payload),c.id]);
   if ((await hourlyAllowance(db)) === 0) break;
   const result=await portal(endpoint,'POST',payload);
   if(!result.deal_id)throw Error('portal_sem_deal_id');
   await db.execute(`UPDATE prospecting_verified_delivery_queue SET status='synced',synced_at=NOW(),last_error=NULL,updated_at=NOW() WHERE candidate_id=?`,[c.id]);
   const data=parse(c.data);data.delivery_verification=payload.verification;data.portal_deal_id=result.deal_id;
   await db.execute(`UPDATE prospecting_candidates SET company_name=?,contact_phone=?,data=?,last_verified_at=NOW(),updated_at=NOW() WHERE id=?`,[payload.company,payload.phone,JSON.stringify(data),c.id]);
   console.log(JSON.stringify({candidate_id:c.id,delivered:true,deal_id:result.deal_id,review_status:'pending_nicolle'}));
  }catch(e){
   if(!dry)await db.execute(`UPDATE prospecting_verified_delivery_queue SET status='blocked',last_error=?,updated_at=NOW() WHERE candidate_id=?`,[String(e.message).slice(0,1000),c.id]);
   console.log(JSON.stringify({candidate_id:c.id,delivered:false,reason:e.message,dry_run:dry}));
  }
  await delay(3000);
 }
}
try{await main();}catch(e){console.error('VERIFIED_DELIVERY:',e.message);process.exitCode=1;}finally{await db.end();}
