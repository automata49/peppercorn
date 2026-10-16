import {test,expect} from '@playwright/test'
import {legacyJournalEntry,mergeLegacyJournal} from '../src/lib/unifiedJournal'
test('legacy Thesis is a reviewable journal record with a stable identity',()=>{
 const row={id:'alpha',market:'US',ticker:'NVDA',date:'2026-10-10',conclusion:'성장 유지',key_risk:'경쟁 심화'}
 const virtual=legacyJournalEntry('thesis',row,0)
 expect(virtual.kind).toBe('investment');expect(virtual.hypothesis).toBe('성장 유지')
 expect(mergeLegacyJournal([{...virtual,hypothesis:'수정'}],[row],[])).toHaveLength(1)
 expect(mergeLegacyJournal([],[row],[])).toHaveLength(1)
})