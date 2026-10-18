import {test,expect} from '@playwright/test'
import {getDailyQuote,quoteDayIndex} from '../src/lib/dailyQuotes'

test('Asia/Seoul midnight rotates the author even with UTC clock',()=>{
 const before=new Date('2026-10-18T14:59:59Z')
 const after=new Date('2026-10-18T15:00:00Z')
 expect(quoteDayIndex(after)-quoteDayIndex(before)).toBe(1)
 expect(getDailyQuote(before).person).toBe('buffett')
 expect(getDailyQuote(after).person).toBe('munger')
 expect(getDailyQuote(before).text).not.toBe(getDailyQuote(after).text)
})

test('24 curated one-line excerpts include all four figures without repeated daily text',()=>{
 const origin=Date.UTC(2026,9,18,3)
 const days=Array.from({length:24},(_,i)=>getDailyQuote(new Date(origin+i*86400_000)))
 expect(new Set(days.map(d=>d.text)).size).toBe(24)
 expect(days.slice(0,4).map(d=>d.person)).toEqual(['buffett','munger','sagan','dawkins'])
 for(const q of days){
  expect(q.text.length).toBeLessThanOrEqual(24)
  expect(q.source).toMatch(/^https:\/\//)
  expect(q.author.length).toBeGreaterThan(2)
 }
})
