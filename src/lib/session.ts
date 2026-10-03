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

async function authRequest(body:Record<string,unknown>):Promise<Session>{
  const res=await fetch(BASE+'/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(String(payload?.error||'auth_failed'))
  const session=payload as Session;storeSession(session);return session
}
export function login(email:string,password:string){return authRequest({action:'login',email,password})}
export function signup(email:string,password:string,setupCode:string){return authRequest({action:'signup',email,password,setup_code:setupCode})}
// GOOGLE-LOGIN-1: Supabase Auth's Google provider with PKCE. The browser goes to /auth/v1/authorize and comes back to
// this page with ?code=…; the auth function exchanges the code (no API key in the app). The verifier lives in
// sessionStorage for that one round trip only.
const AUTH_BASE = BASE.replace('/functions/v1', '/auth/v1')
const PKCE_KEY = 'peppercorn-pkce-verifier'
const b64url = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
export async function googleAuthorizeUrl(returnTo=location.origin+location.pathname){
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge=b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))
  sessionStorage.setItem(PKCE_KEY,verifier)
  return AUTH_BASE+'/authorize?'+new URLSearchParams({provider:'google',redirect_to:returnTo,code_challenge:challenge,code_challenge_method:'s256'}).toString()
}
export async function startGoogleLogin(){location.assign(await googleAuthorizeUrl())}
// Reads ?code / ?error (or the same in the hash) left by the redirect, removes them from the address bar, and returns
// the new session, null when this load is not a redirect, or throws the error code.
export async function completeGoogleLogin():Promise<Session|null>{
  const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,''))
  const code=query.get('code'),error=query.get('error')||hash.get('error')
  if(!code&&!error)return null
  const description=(query.get('error_description')||hash.get('error_description')||'').toLowerCase()
  for(const k of ['code','error','error_code','error_description','state'])query.delete(k)
  const rest=query.toString();history.replaceState(history.state,'',location.pathname+(rest?'?'+rest:'')+(hash.get('error')?'':location.hash))
  const verifier=sessionStorage.getItem(PKCE_KEY);sessionStorage.removeItem(PKCE_KEY)
  if(error)throw new Error(/signup|not allowed/.test(description)?'google_not_linked':'oauth_'+error)
  if(!verifier)throw new Error('oauth_state_missing')
  return authRequest({action:'pkce',auth_code:code,code_verifier:verifier})
}
export function refresh(session:Session){return authRequest({action:'refresh',refresh_token:session.refresh_token})}
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
