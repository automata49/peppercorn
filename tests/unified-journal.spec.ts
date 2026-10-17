import {test,expect} from '@playwright/test'
import {legacyPage,unifiedPages} from '../src/lib/unifiedJournal'
import {blankSnapshot,parseNotebook} from '../src/lib/lifetimeJournal'

test('legacy investment Thesis and trade become one searchable, nonduplicated journal source',()=>{
 const thesis={id:123,market:'US',ticker:'NVDA',date:'2026-10-01',conclusion:'AI demand resilient',key_risk:'inventory'}
 const trade={id:345,market:'KR',ticker:'005930',date:'2026-10-02',thesis:'EPS recovery',review_condition:'earnings'}
 const pages=unifiedPages([], [thesis],[trade])
 expect(pages).toHaveLength(2)
 expect(pages.map(p=>p.kind)).toEqual(['investment','investment'])
 expect(pages[0]).toMatchObject({ticker:'US:NVDA',hypothesis:'AI demand resilient',counterEvidence:'inventory'})
 expect(pages[1]).toMatchObject({ticker:'KR:005930',hypothesis:'EPS recovery'})
 expect(unifiedPages([pages[0]],[thesis],[trade])).toHaveLength(2)
 expect(legacyPage('thesis',thesis).id).toBe(pages[0].id)
})
test('AI conversation remains in a normal version-1 journal backup',()=>{
 const now='2026-10-17T00:00:00.000Z'
 const entry={...blankSnapshot(),id:'ai-1',title:'대화 저널',createdAt:now,updatedAt:now,revisions:[],aiMessages:[{role:'user' as const,content:'가설을 검증해줘'},{role:'assistant' as const,content:'반증 근거를 확인하세요'}]}
 const parsed=parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[entry]}))
 expect(parsed[0].aiMessages).toEqual(entry.aiMessages)
})
