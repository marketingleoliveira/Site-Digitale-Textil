import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/integrations/supabase/client.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function client(responses=[]){
  const data=new Map(),exports={},requests=[];
  const context=vm.createContext({exports,console,queueMicrotask,
    localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},
    fetch:async url=>{requests.push(url);const next=responses.shift();assert.ok(next,'Unexpected request');const response=typeof next==='function'?await next():next;return {ok:response.status<400,status:response.status,json:async()=>response.body};}
  });
  vm.runInContext(compiled,context);
  return {auth:exports.supabase.auth,data,requests};
}
const user={id:'fixture-user',roles:['admin']},session={access_token:'fixture-token',token_type:'bearer',user};
test('successful login publishes the session immediately to active subscribers',async()=>{
  const {auth,data}=client([{status:200,body:{token:session.access_token,user}}]),events=[];
  auth.onAuthStateChange((event,session)=>events.push({event,session}));await flush();
  assert.equal(events[0].event,'INITIAL_SESSION');assert.equal(events[0].session,null);
  const result=await auth.signInWithPassword({email:'fixture@example.invalid',password:'fixture'});await flush();
  assert.equal(result.error,null);assert.equal(events[1].event,'SIGNED_IN');assert.equal(events[1].session.user.id,user.id);
  assert.equal(JSON.parse(data.get('digitale-auth')).access_token,session.access_token);
});
test('invalid credentials do not create an authenticated session',async()=>{
  const {auth,data}=client([{status:401,body:{error:'invalid_credentials'}}]),events=[];
  auth.onAuthStateChange(event=>events.push(event));await flush();
  const result=await auth.signInWithPassword({email:'fixture@example.invalid',password:'wrong'});await flush();
  assert.ok(result.error);assert.equal(data.has('digitale-auth'),false);assert.deepEqual(events,['INITIAL_SESSION']);
});
test('logout clears persisted state and informs subscribers; unsubscribe stops updates',async()=>{
  const {auth,data}=client([{status:200,body:{user}}]),events=[];data.set('digitale-auth',JSON.stringify(session));
  const {data:{subscription}}=auth.onAuthStateChange((event,session)=>events.push({event,session}));await flush();
  await auth.signOut();await flush();assert.equal(data.has('digitale-auth'),false);assert.equal(events[1].event,'SIGNED_OUT');assert.equal(events[1].session,null);
  subscription.unsubscribe();await auth.signOut();await flush();assert.equal(events.length,2);
});
test('refresh updates user identity and an expired session clears the interface',async()=>{
  const {auth,data}=client([{status:200,body:{user}},{status:200,body:{user:{...user,name:'Updated'}}},{status:401,body:{error:'invalid_token'}}]),events=[];
  data.set('digitale-auth',JSON.stringify(session));auth.onAuthStateChange((event,session)=>events.push({event,session}));await flush();
  await auth.refreshSession();await flush();assert.equal(events[1].event,'TOKEN_REFRESHED');assert.equal(events[1].session.user.name,'Updated');
  await auth.refreshSession();await flush();assert.equal(events[2].event,'SIGNED_OUT');assert.equal(events[2].session,null);assert.equal(data.has('digitale-auth'),false);
});
test('expired stored sessions are discarded before the initial user is restored',async()=>{
  const {auth,data}=client([{status:401,body:{error:'invalid_token'}}]),events=[];
  data.set('digitale-auth',JSON.stringify(session));auth.onAuthStateChange((event,session)=>events.push({event,session}));await flush();
  assert.equal(data.has('digitale-auth'),false);assert.ok(events.some(e=>e.event==='INITIAL_SESSION'&&e.session===null));assert.ok(events.every(e=>e.session===null));
});
test('simultaneous startup reads share one validation request',async()=>{
  const {auth,data,requests}=client([{status:200,body:{user}}]);data.set('digitale-auth',JSON.stringify(session));
  const results=await Promise.all([auth.getSession(),auth.getSession()]);assert.equal(requests.length,1);assert.ok(results.every(r=>r.data.session.user.id===user.id));
});
test('a late validation response cannot restore a logged-out session',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const {auth,data}=client([()=>pending]);data.set('digitale-auth',JSON.stringify(session));
  const request=auth.refreshSession();await auth.signOut();finish({status:200,body:{user}});
  assert.equal((await request).data.session,null);assert.equal(data.has('digitale-auth'),false);
});
test('a late expired-token response cannot erase a more recent login',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const {auth,data}=client([()=>pending,{status:200,body:{token:'new-token',user}}]);data.set('digitale-auth',JSON.stringify(session));
  const request=auth.refreshSession();await auth.signInWithPassword({email:'fixture@example.invalid',password:'fixture'});finish({status:401,body:{error:'invalid_token'}});
  assert.equal((await request).data.session.access_token,'new-token');assert.equal(JSON.parse(data.get('digitale-auth')).access_token,'new-token');
});
