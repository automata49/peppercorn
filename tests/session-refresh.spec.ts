import {test,expect} from '@playwright/test'
import {ensureSession,storeSession,type Session} from '../src/lib/session'
test('polling with an older session reuses the rotated same-account token',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),originalFetch=globalThis.fetch,values=new Map<string,string>()
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}})
 const old:Session={access_token:'old-access',refresh_token:'old-refresh',expires_at:1,user:{id:'synthetic-owner'}},fresh:Session={...old,access_token:'new-access',refresh_token:'new-refresh',expires_at:Date.now()/1000+3600}
 let requests=0
 globalThis.fetch=async()=>{requests++;return Response.json(fresh)}
 try{
  storeSession(old)
  const [a,b]=await Promise.all([ensureSession(old),ensureSession(old)])
  expect(a).toEqual(fresh);expect(b).toEqual(fresh);expect(requests).toBe(1)
  expect(await ensureSession(old)).toEqual(fresh);expect(requests).toBe(1)
 }finally{globalThis.fetch=originalFetch;if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
})
