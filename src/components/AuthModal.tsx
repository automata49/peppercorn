import { useEffect, useState } from 'react'
import { login, signup, startGoogleLogin, type Session } from '../lib/session'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { FolioWordmark } from './FolioWordmark'
import { AppIcon } from './AppIcon'

const messages:Record<string,string>={
  invalid_setup_code:'Setup Code가 올바르지 않습니다.',
  signup_closed:'Folio 계정은 이미 생성되어 있습니다.',
  login_failed:'이메일 또는 비밀번호를 확인하세요.',
  email_and_password_required:'이메일과 8자 이상의 비밀번호를 입력하세요.',
  google_not_linked:'이 Google 계정은 등록된 계정과 연결되어 있지 않습니다. 등록한 이메일과 같은 Google 계정으로 로그인하세요.',
  oauth_failed:'Google 로그인을 확인하지 못했습니다. 다시 시도하세요.',
  oauth_state_missing:'로그인을 시작한 창과 다른 곳에서 돌아왔습니다. 다시 시도하세요.',
  oauth_access_denied:'Google 로그인이 취소되었습니다.'
}

export function AuthModal({
  open,
  onClose,
  onAuthenticated,
  notice
}:{
  open:boolean
  onClose:()=>void
  onAuthenticated:(session:Session)=>void
  notice?:string
}){
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [setupCode,setSetupCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{if(notice)setError(messages[notice]||'Google 로그인에 실패했습니다: '+notice)},[notice])
  const google=async()=>{setBusy(true);setError('');try{await startGoogleLogin()}catch{setBusy(false);setError('Google 로그인을 시작하지 못했습니다.')}}

  const submit=async()=>{
    setBusy(true);setError('')
    try{
      const session=mode==='login'
        ? await login(email,password)
        : await signup(email,password,setupCode)
      onAuthenticated(session)
      onClose()
    }catch(e){
      const code=e instanceof Error?e.message:String(e)
      setError(messages[code]||'인증에 실패했습니다: '+code)
    }finally{setBusy(false)}
  }

  return <Dialog open={open} onOpenChange={next=>{if(!next)onClose()}}>
    <DialogContent className="auth-card">
      <div className="auth-head">
        <div><FolioWordmark className="auth-wordmark"/><DialogTitle>{mode==='login'?'로그인':'최초 계정 생성'}</DialogTitle></div>
        <DialogClose asChild><button aria-label="닫기"><AppIcon name="close"/></button></DialogClose>
      </div>
      {mode==='login'&&<><button type="button" className="auth-google" disabled={busy} onClick={google}><svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>Google 계정으로 로그인</button>
      <div className="auth-or"><span>또는 이메일</span></div></>}
      <div className="auth-tabs">
        <button className={mode==='login'?'on':''} onClick={()=>setMode('login')}>로그인</button>
        <button className={mode==='signup'?'on':''} onClick={()=>setMode('signup')}>최초 등록</button>
      </div>
      <label>이메일<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label>비밀번호<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} /></label>
      {mode==='signup'&&<label>Setup Code<input value={setupCode} onChange={e=>setSetupCode(e.target.value.toUpperCase())} placeholder="PC-XXXX-XXXX-XXXX" /></label>}
      {error&&<div className="auth-error">{error}</div>}
      <button className="auth-submit" disabled={busy||!email||password.length<8} onClick={submit}>{busy?'처리 중…':mode==='login'?'로그인':'계정 생성'}</button>
      <DialogDescription className="auth-description">로그인하면 Watchlist · Portfolio · 시장 온도계 · 종목 분석 · Journal이 Supabase에 저장됩니다.</DialogDescription>
    </DialogContent>
  </Dialog>
}
