export type Session = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: { id: string; email?: string }
}

export type WorkspaceResource = 'watchlist' | 'portfolio' | 'research' | 'analysis' | 'journal'

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
export function refresh(session:Session){return authRequest({action:'refresh',refresh_token:session.refresh_token})}
export async function ensureSession(session:Session):Promise<Session>{const expiresAt=Number(session.expires_at||0);if(!expiresAt||Date.now()/1000<expiresAt-90)return session;return refresh(session)}

function normalize(resource:WorkspaceResource,rows:any[]):any[]{
  if(resource==='research')return rows.map(r=>({...r,date:r.written_at,type:r.note_type,verification:r.verification||(r.verified===true?'확인됨':r.verified===false?'반박됨':'미검증')}))
  if(resource==='analysis')return rows.map(r=>({...r,date:r.analysis_date}))
  if(resource==='journal')return rows.map(r=>({...r,date:r.trade_date}))
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
