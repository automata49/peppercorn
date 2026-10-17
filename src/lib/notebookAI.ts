import {ensureSession,type Session} from './session'
import type {JournalMessage} from '../components/JournalAI'

const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/journal-ai'

/** The answer is a draft, inserted only after the author explicitly types @ and asks. */
export async function askNotebookAI(session:Session|null,question:string,context:string,history:JournalMessage[]=[]):Promise<string>{
 if(!session)throw Error('AI 작성은 로그인 후 사용할 수 있습니다.')
 const fresh=await ensureSession(session)
 const messages:JournalMessage[]=[...history.slice(-10),{role:'user',content:question}]
 let response:Response
 try{
  response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+fresh.access_token,'Content-Type':'application/json'},body:JSON.stringify({messages,context:context.slice(0,10000)})})
 }catch{throw Error('AI 서버에 연결하지 못했습니다. 네트워크 상태를 확인하세요.')}
 const data=await response.json().catch(()=>({}))
 if(!response.ok){
  const error=String(data.error||'')
  throw Error(error==='model_unconfigured'?'AI 서버에 Gemini API 키 설정이 필요합니다.':
   error==='model_unavailable'?'AI 모델 응답이 실패했습니다. Gemini API 키·모델 접근 권한을 확인하세요.':
   error==='rate_limited'?'AI 요청이 많습니다. 잠시 후 다시 시도하세요.':
   error==='login_required'||error==='invalid_session'?'로그인 세션을 다시 확인하세요.':
   'AI 답변을 생성하지 못했습니다. ('+(error||response.status)+')')
 }
 if(typeof data.reply!=='string'||!data.reply.trim())throw Error('AI 답변이 비어 있습니다.')
 return data.reply.trim()
}
