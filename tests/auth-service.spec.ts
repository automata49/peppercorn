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
for(const owner of [true,false])test(`auth PKCE preserves owner identity and refuses unlinked user: ${owner}`,async()=>{
 const calls:string[]=[]
 const request=service(async(url,options)=>{calls.push(url);if(url.includes('/token?')){expect(JSON.parse(options.body as string)).toEqual({auth_code:'test-code',code_verifier:'x'.repeat(64)});return Response.json({access_token:'test-access',refresh_token:'test-refresh',user:{id:'same-account',email:'owner@example.com',identities:owner?[{provider:'email'},{provider:'google'}]:[{provider:'google'}]}})}expect(url).toBe('https://auth.test/auth/v1/logout?scope=local');expect(options.method).toBe('POST');return new Response(null,{status:204})})
 const result=await request({action:'pkce',auth_code:'test-code',code_verifier:'x'.repeat(64)});expect(result.status).toBe(owner?200:403)
 const body=await result.json();if(owner)expect(body.user.id).toBe('same-account');else expect(body).toEqual({error:'google_not_linked'})
 expect(calls.length).toBe(owner?1:2);expect(calls.some(url=>url.includes('/admin/users'))).toBe(false)
})
test('auth PKCE invalid verifier and expired code never produce a session',async()=>{
 let calls=0;const request=service(async()=>{calls++;return Response.json({error:'invalid_grant'},{status:400})})
 expect((await request({action:'pkce',auth_code:'test',code_verifier:'short'})).status).toBe(400);expect(calls).toBe(0)
 const result=await request({action:'pkce',auth_code:'expired',code_verifier:'x'.repeat(64)});expect(result.status).toBe(401);expect(await result.json()).toEqual({error:'oauth_failed'})
})
