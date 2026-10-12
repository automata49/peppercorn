export type Session = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: { id: string; email?: string }
}

export type WorkspaceResource = 'watchlist' | 'portfolio' | 'research' | 'analysis' | 'journal' | 'temperature'

const BASE = 'https://mhbcchegrbakearqptdr.supabase.co/functions/v1'
const STORAGE_KEY = 'peppercorn-session'

export function loadStoredSession(): Session | null {
  try { const value=localStorage.getItem(STORAGE_KEY); return value?JSON.parse(value) as Session:null } catch { return null }
}
export function storeSession(session:Session|null){if(session)localStorage.setItem(STORAGE_KEY,JSON.stringify(session));else localStorage.removeItem(STORAGE_KEY)}

async function authResponse(body:Record<string,unknown>,signal?:AbortSignal){
  const res=await fetch(BASE+'/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})
  const payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(String(payload?.error||'auth_failed'))
  return payload
}
function acceptSession(payload:any):Session{
  if(!payload?.access_token||!payload?.refresh_token||!payload?.user?.id)throw new Error('auth_failed')
  const session=payload as Session;storeSession(session);return session
}
async function authRequest(body:Record<string,unknown>,signal?:AbortSignal):Promise<Session>{
  const previous=localStorage.getItem(STORAGE_KEY),payload=await authResponse(body,signal)
  if(signal?.aborted||localStorage.getItem(STORAGE_KEY)!==previous)throw new Error('auth_cancelled')
  return acceptSession(payload)
}
export function login(email:string,password:string,signal?:AbortSignal){return authRequest({action:'login',email,password},signal)}
export async function signup(email:string,password:string,signal?:AbortSignal):Promise<Session|null>{
  const previous=localStorage.getItem(STORAGE_KEY),payload=await authResponse({action:'signup',email,password},signal)
  if(signal?.aborted||localStorage.getItem(STORAGE_KEY)!==previous)throw new Error('auth_cancelled')
  return payload.confirmation_required===true?null:acceptSession(payload)
}
// GOOGLE-LOGIN-1: Supabase Auth's Google provider with PKCE. The browser goes to /auth/v1/authorize and comes back to
// this page with ?code=…; the auth function exchanges the code (no API key in the app). The verifier lives in
// sessionStorage for that one round trip only.
const AUTH_BASE = BASE.replace('/functions/v1', '/auth/v1')
const PKCE_KEY = 'peppercorn-pkce-verifier'
const PKCE_SESSION_KEY = 'peppercorn-pkce-session'
const b64url = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
export async function googleAuthorizeUrl(returnTo=location.origin+location.pathname){
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge=b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))
  sessionStorage.setItem(PKCE_KEY,verifier)
  sessionStorage.setItem(PKCE_SESSION_KEY,localStorage.getItem(STORAGE_KEY)||'')
  return AUTH_BASE+'/authorize?'+new URLSearchParams({provider:'google',redirect_to:returnTo,code_challenge:challenge,code_challenge_method:'s256'}).toString()
}
export async function startGoogleLogin(signal?:AbortSignal){
  const res=await fetch(BASE+'/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google_status'}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})
  const status=await res.json().catch(()=>({}))
  if(!res.ok||status.ready!==true)throw new Error(String(status.error||'google_unavailable'))
  if(signal?.aborted)return
  const url=await googleAuthorizeUrl()
  if(signal?.aborted){sessionStorage.removeItem(PKCE_KEY);sessionStorage.removeItem(PKCE_SESSION_KEY);return}
  location.assign(url)
}
// Reads ?code / ?error (or the same in the hash) left by the redirect, removes them from the address bar, and returns
// the new session, null when this load is not a redirect, or throws the error code.
export async function completeGoogleLogin():Promise<Session|null>{
  const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,''))
  const code=query.get('code'),error=query.get('error')||hash.get('error')
  if(query.has('email-confirmed')){
    query.delete('email-confirmed');const rest=query.toString();history.replaceState(history.state,'',location.pathname+(rest?'?'+rest:''));throw new Error(error?'email_confirmation_failed':'email_confirmed')
  }
  if(!code&&!error)return null
  const description=(query.get('error_description')||hash.get('error_description')||'').toLowerCase()
  for(const k of ['code','error','error_code','error_description','state'])query.delete(k)
  const rest=query.toString();history.replaceState(history.state,'',location.pathname+(rest?'?'+rest:'')+(hash.get('error')?'':location.hash))
  const verifier=sessionStorage.getItem(PKCE_KEY);sessionStorage.removeItem(PKCE_KEY)
  const previous=sessionStorage.getItem(PKCE_SESSION_KEY);sessionStorage.removeItem(PKCE_SESSION_KEY)
  if(previous!==null&&previous!==(localStorage.getItem(STORAGE_KEY)||''))throw new Error('auth_cancelled')
  if(error)throw new Error(/signup|not allowed/.test(description)?'signup_disabled':'oauth_'+error)
  if(!verifier)throw new Error('oauth_state_missing')
  return authRequest({action:'pkce',auth_code:code,code_verifier:verifier})
}
const refreshRequests=new Map<string,Promise<Session>>()
export function refresh(session:Session):Promise<Session>{
  const previous=localStorage.getItem(STORAGE_KEY)
  const key=session.user.id+'|'+session.refresh_token+'|'+previous
  const existing=refreshRequests.get(key);if(existing)return existing
  const request=(async()=>{
    const refreshed=await authResponse({action:'refresh',refresh_token:session.refresh_token}) as Session
    if(localStorage.getItem(STORAGE_KEY)!==previous)throw new Error('auth_cancelled')
    if(!refreshed.access_token||refreshed.user?.id!==session.user.id)throw new Error('refresh_failed')
    // All concurrent resource reads share this refresh; an explicit new login still invalidates it.
    if(loadStoredSession()?.user.id===session.user.id)storeSession(refreshed)
    return refreshed
  })().finally(()=>refreshRequests.delete(key))
  refreshRequests.set(key,request);return request
}
export async function ensureSession(session:Session):Promise<Session>{const expiresAt=Number(session.expires_at||0);if(!expiresAt||Date.now()/1000<expiresAt-90)return session;return refresh(session)}

function normalize(resource:WorkspaceResource,rows:any[]):any[]{
  if(resource==='research')return rows.map(r=>({...r,date:r.written_at,type:r.note_type,verification:r.verification||(r.verified===true?'확인됨':r.verified===false?'반박됨':'미검증')}))
  if(resource==='analysis')return rows.map(r=>({...r,date:r.analysis_date}))
  if(resource==='journal')return rows.map(r=>({...r,date:r.trade_date}))
  if(resource==='temperature')return rows.map(r=>({date:r.recorded_on,marks:r.marks||{},evidence:r.evidence||{},note:r.note||undefined,version:r.checklist_version}))
  return rows
}

export async function loadWorkspace(session:Session,resource:WorkspaceResource){
  const active=await ensureSession(session);const res=await fetch(BASE+'/workspace?resource='+resource,{headers:{Authorization:'Bearer '+active.access_token}})
  const payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(String(payload?.error||'workspace_read_failed'))
  return {session:active,rows:normalize(resource,payload.rows||[])}
}
export async function saveWorkspace(session:Session,resource:WorkspaceResource,rows:any[]){
  const active=await ensureSession(session);const res=await fetch(BASE+'/workspace?resource='+resource,{method:'POST',headers:{Authorization:'Bearer '+active.access_token,'Content-Type':'application/json'},body:JSON.stringify({rows})})
  const payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(String(payload?.error||'workspace_write_failed'))
  return {session:active,result:payload}
}
