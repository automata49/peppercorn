import type {WorkspaceResource} from './session'
import type {EditableRow} from '../types'
export type PendingWorkspace={scope:string;resource:WorkspaceResource;rows:EditableRow[];mutation:string}
const resources:WorkspaceResource[]=['watchlist','portfolio','research','analysis','journal','temperature']
let database:Promise<IDBDatabase>|undefined
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('folio-workspace-outbox',1);r.onupgradeneeded=()=>r.result.createObjectStore('pending',{keyPath:['scope','resource']});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=undefined;reject(r.error)}})}
async function migrate(scope:string){
 const key='folio-workspace-outbox:'+scope,raw=localStorage.getItem(key)
 if(!raw)return
 let legacy:Partial<Record<WorkspaceResource,EditableRow[]>>={};try{legacy=JSON.parse(raw)||{}}catch{return}
 const d=await db()
 await new Promise<void>((resolve,reject)=>{const t=d.transaction('pending','readwrite'),s=t.objectStore('pending');for(const resource of resources){if(!Array.isArray(legacy[resource]))continue;const r=s.get([scope,resource]);r.onsuccess=()=>{if(!r.result)s.put({scope,resource,rows:legacy[resource],mutation:crypto.randomUUID()})}}t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})
 if(localStorage.getItem(key)===raw)localStorage.removeItem(key)
}
export async function readWorkspaceOutbox(scope:string):Promise<PendingWorkspace[]>{
 await migrate(scope);const d=await db()
 return new Promise((resolve,reject)=>{const r=d.transaction('pending').objectStore('pending').getAll(IDBKeyRange.bound([scope,''],[scope,'\uffff']));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
}
export async function queueWorkspaceWrite(scope:string,resource:WorkspaceResource,rows:EditableRow[]){
 const pending={scope,resource,rows,mutation:crypto.randomUUID()},d=await db()
 await new Promise<void>((resolve,reject)=>{const t=d.transaction('pending','readwrite');t.objectStore('pending').put(pending);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})
 return pending.mutation
}
export async function acknowledgeWorkspaceWrite(scope:string,resource:WorkspaceResource,mutation:string){
 const d=await db()
 return new Promise<void>((resolve,reject)=>{const t=d.transaction('pending','readwrite'),s=t.objectStore('pending'),r=s.get([scope,resource]);r.onsuccess=()=>{if(r.result?.mutation===mutation)s.delete([scope,resource])};t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})
}
