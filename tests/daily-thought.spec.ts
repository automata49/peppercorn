import {test,expect} from '@playwright/test'
import {dailyThought,koreaDayNumber} from '../src/lib/dailyThought'

test('one Korean-calendar-day quote changes at midnight',()=>{
 const before=new Date('2026-10-18T14:59:59Z')
 const after=new Date('2026-10-18T15:00:00Z')
 expect(koreaDayNumber(after)-koreaDayNumber(before)).toBe(1)
 expect(dailyThought(before).person).toBe('buffett')
 expect(dailyThought(after).person).toBe('munger')
 expect(dailyThought(new Date('2026-10-19T15:00:00Z')).person).toBe('sagan')
 expect(dailyThought(new Date('2026-10-20T15:00:00Z')).person).toBe('dawkins')
})
