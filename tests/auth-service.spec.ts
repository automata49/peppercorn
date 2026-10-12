import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'

const source = stripTypeScriptTypes(readFileSync('supabase/functions/auth/index.ts', 'utf8').replace(/^import "jsr:.*?";\s*/m, ''))
function service(upstream: (url: string, options: RequestInit) => Promise<Response>) {
 let handler: (req: Request) => Promise<Response>
 runInNewContext(source, { Request, Response, AbortSignal, Date, encodeURIComponent, fetch: upstream,
  Deno: { env: { get: (key: string) => ({ SUPABASE_URL: 'https://auth.test', SUPABASE_ANON_KEY: 'test-public-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-sentinel' })[key] }, serve: (fn: typeof handler) => { handler = fn } } })
 return (body: unknown, origin = 'https://automata49.github.io') => handler(new Request('https://app.test/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }))
}
for(const enabled of [false,true])test(`auth provider readiness: ${enabled}`,async()=>{
 const request=service(async(url,options)=>{expect(url).toBe('https://auth.test/auth/v1/settings');expect(options.headers).toEqual({apikey:'test-public-key'});return Response.json({external:{google:enabled},secret:'never-return-this'})})
 const result=await request({action:'google_status'});expect(result.status).toBe(enabled?200:503)
 expect(await result.json()).toEqual(enabled?{ready:true}:{error:'google_provider_disabled'})
 expect(result.headers.get('Cache-Control')).toBe('no-store')
})
test('auth readiness upstream failure and disallowed origin stay closed',async()=>{
 const request=service(async()=>Response.json({}, {status:500}));expect((await request({action:'google_status'})).status).toBe(503)
 expect((await request({action:'google_status'},'https://untrusted.test')).status).toBe(403)
})
for(const linked of [true,false])test(`auth PKCE permits email-linked and Google-only users: ${linked}`,async()=>{
 const calls:string[]=[]
 const request=service(async(url,options)=>{calls.push(url);expect(url).toBe('https://auth.test/auth/v1/token?grant_type=pkce');expect(JSON.parse(options.body as string)).toEqual({auth_code:'test-code',code_verifier:'x'.repeat(64)});return Response.json({access_token:'test-access',refresh_token:'test-refresh',user:{id:linked?'existing-account':'new-google-account',email:'person@example.com',identities:linked?[{provider:'email'},{provider:'google'}]:[{provider:'google'}]}})})
 const result=await request({action:'pkce',auth_code:'test-code',code_verifier:'x'.repeat(64)});expect(result.status).toBe(200)
 expect((await result.json()).user.id).toBe(linked?'existing-account':'new-google-account');expect(calls).toHaveLength(1)
})
for(const confirm of [true,false])test(`public signup respects confirmation setting: ${confirm}`,async()=>{
 const request=service(async(url,options)=>{expect(url).toBe('https://auth.test/auth/v1/signup?redirect_to=https%3A%2F%2Fautomata49.github.io%2Fpeppercorn%2F%3Femail-confirmed%3D1');expect(options.headers).toEqual({apikey:'test-public-key','Content-Type':'application/json'});expect(JSON.parse(options.body as string)).toEqual({email:'new@example.com',password:'test-password'});return Response.json(confirm?{id:'new-user'}:{access_token:'new-access',refresh_token:'new-refresh',user:{id:'new-user',email:'new@example.com'}})})
 const result=await request({action:'signup',email:' New@Example.com ',password:'test-password'});expect(result.status).toBe(200)
 const body=await result.json();if(confirm)expect(body).toEqual({confirmation_required:true});else expect(body.user.id).toBe('new-user')
})
test('public signup can create two users without admin access or setup code',async()=>{
 const emails:string[]=[];const request=service(async(url,options)=>{expect(url).toContain('/auth/v1/signup?');const body=JSON.parse(options.body as string);expect(body.email_confirm).toBeUndefined();expect(body.setup_code).toBeUndefined();emails.push(body.email);return Response.json({id:body.email})})
 for(const email of ['alice@example.com','bob@example.com'])expect((await request({action:'signup',email,password:'test-password'})).status).toBe(200)
 expect(emails).toEqual(['alice@example.com','bob@example.com'])
})
test('public signup validates password and reports provider rate limits without upstream detail',async()=>{
 let calls=0;const request=service(async()=>{calls++;return Response.json({error_code:'over_email_send_rate_limit',secret:'never-return'}, {status:429})})
 expect((await request({action:'signup',email:'a@example.com',password:'short'})).status).toBe(400);expect(calls).toBe(0)
 const result=await request({action:'signup',email:'a@example.com',password:'test-password'});expect(result.status).toBe(429);expect(await result.json()).toEqual({error:'over_email_send_rate_limit'})
})
test('auth PKCE invalid verifier and expired code never produce a session',async()=>{
 let calls=0;const request=service(async()=>{calls++;return Response.json({error:'invalid_grant'},{status:400})})
 expect((await request({action:'pkce',auth_code:'test',code_verifier:'short'})).status).toBe(400);expect(calls).toBe(0)
 const result=await request({action:'pkce',auth_code:'expired',code_verifier:'x'.repeat(64)});expect(result.status).toBe(401);expect(await result.json()).toEqual({error:'oauth_failed'})
})
