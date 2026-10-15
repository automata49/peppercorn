import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync('src/lib/workspaceOutbox.ts','utf8'))+'\nglobalThis.outbox={readWorkspaceOutbox,queueWorkspaceWrite,acknowledgeWorkspaceWrite};'
test('transactional outbox preserves other tabs and newer mutations during acknowledgements',async({browser})=>{
 const context=await browser.newContext(),a=await context.newPage(),b=await context.newPage()
 for(const page of [a,b]){await page.route('**/__outbox',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Outbox fixture</title>'}));await page.goto('/__outbox');await page.addScriptTag({type:'module',content:source});await page.waitForFunction(()=>!!(window as any).outbox)}
 const [watch,portfolio]=await Promise.all([a.evaluate(()=>(window as any).outbox.queueWorkspaceWrite('owner','watchlist',[{id:'watch',note:'first tab'}])),b.evaluate(()=>(window as any).outbox.queueWorkspaceWrite('owner','portfolio',[{id:'portfolio',note:'second tab'}]))])
 expect((await a.evaluate(()=>(window as any).outbox.readWorkspaceOutbox('owner'))).length).toBe(2)
 const newer=await b.evaluate(()=>(window as any).outbox.queueWorkspaceWrite('owner','watchlist',[{id:'watch',note:'newer mutation'}]))
 await a.evaluate(mutation=>(window as any).outbox.acknowledgeWorkspaceWrite('owner','watchlist',mutation),watch)
 expect((await a.evaluate(()=>(window as any).outbox.readWorkspaceOutbox('owner'))).find((item:any)=>item.resource==='watchlist').mutation).toBe(newer)
 await b.evaluate(mutation=>(window as any).outbox.acknowledgeWorkspaceWrite('owner','portfolio',mutation),portfolio)
 const remaining=await a.evaluate(()=>(window as any).outbox.readWorkspaceOutbox('owner'));expect(remaining).toHaveLength(1);expect(remaining[0].rows[0].note).toBe('newer mutation')
 expect(await a.evaluate(()=>(window as any).outbox.readWorkspaceOutbox('other-account'))).toHaveLength(0)
 await context.close()
})
