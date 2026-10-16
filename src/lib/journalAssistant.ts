import {ensureSession,type Session} from './session'
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/journal-assistant'
export async function journalAiReply(session:Session|null,messages:{role:'user'|'assistant';content:string}[],context:string):Promise<string>{
 if(!session)throw Error('AI 대화는 로그인 후 사용할 수 있습니다.')
 const active=await ensureSession(session)
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+active.access_token,'Content-Type':'application/json'},body:JSON.stringify({messages:messages.slice(-12),context:context.slice(0,5000)})})
 const result=await response.json().catch(()=>({}))
 if(!response.ok)throw Error(response.status===503?'AI 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.':response.status===429?'요청이 많습니다. 다시 시도하세요.':String(result.error||'AI 응답을 가져오지 못했습니다.'))
 if(typeof result.reply!=='string'||!result.reply.trim())throw Error('AI 응답이 비어 있습니다.')
 return result.reply
}
