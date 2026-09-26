import { useState } from 'react'
import { login, signup, type Session } from '../lib/session'

export function AuthModal({
  open,
  onClose,
  onAuthenticated
}:{
  open:boolean
  onClose:()=>void
  onAuthenticated:(session:Session)=>void
}){
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [setupCode,setSetupCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  if(!open) return null

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
      const messages:Record<string,string>={
        invalid_setup_code:'Setup Code가 올바르지 않습니다.',
        signup_closed:'Peppercorn 계정은 이미 생성되어 있습니다.',
        login_failed:'이메일 또는 비밀번호를 확인하세요.',
        email_and_password_required:'이메일과 8자 이상의 비밀번호를 입력하세요.'
      }
      setError(messages[code]||'인증에 실패했습니다: '+code)
    }finally{setBusy(false)}
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="auth-card">
      <div className="auth-head">
        <div><span>Peppercorn Capital</span><h2>{mode==='login'?'로그인':'최초 계정 생성'}</h2></div>
        <button onClick={onClose}>×</button>
      </div>
      <div className="auth-tabs">
        <button className={mode==='login'?'on':''} onClick={()=>setMode('login')}>로그인</button>
        <button className={mode==='signup'?'on':''} onClick={()=>setMode('signup')}>최초 등록</button>
      </div>
      <label>이메일<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label>비밀번호<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} /></label>
      {mode==='signup'&&<label>Setup Code<input value={setupCode} onChange={e=>setSetupCode(e.target.value.toUpperCase())} placeholder="PC-XXXX-XXXX-XXXX" /></label>}
      {error&&<div className="auth-error">{error}</div>}
      <button className="auth-submit" disabled={busy||!email||password.length<8} onClick={submit}>{busy?'처리 중…':mode==='login'?'로그인':'계정 생성'}</button>
      <p>로그인하면 Watchlist · Portfolio · Research · Journal이 Supabase에 저장됩니다.</p>
    </div>
  </div>
}
