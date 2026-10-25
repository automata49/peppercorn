import {test,expect} from '@playwright/test'
import {reportBlocks,reportChart,reportSummary,splitReportShelf} from '../src/lib/reportPresentation'
import type {SourceReport} from '../src/lib/sourceReports'

test('presentation groups source summaries and separates forecasts without changing figures',()=>{
 expect(reportSummary('[시장] 지수가 1.2% 상승했다.')).toEqual({label:'시장',text:'지수가 1.2% 상승했다.'})
 const text='확인된 사실\n• 매출 100억원.\n\n전망 · 미확정\n• 향후 120억원 전망.\n\n자료 유의사항\n투자 판단에 유의.'
 expect(reportBlocks(text)).toEqual([{kind:'facts',text:'• 매출 100억원.'},{kind:'outlook',text:'• 향후 120억원 전망.'},{kind:'note',text:'투자 판단에 유의.'}])
 expect(reportBlocks('일반 본문\n두 번째 줄')).toEqual([{kind:'text',text:'일반 본문\n두 번째 줄'}])
})
test('shelf chooses latest source snapshot without deleting or mutating archived reports',()=>{
 const old={drive_file_id:'old',source_modified_at:'2026-10-15T02:00:00Z'} as SourceReport
 const recent={drive_file_id:'new',source_modified_at:'2026-10-25T17:00:00Z'} as SourceReport
 const original=[old,recent],shelf=splitReportShelf(original)
 expect(shelf.latest).toBe(recent);expect(shelf.history).toEqual([old]);expect(original).toEqual([old,recent])
})
test('charts only use explicit comparable numeric tables and retain original values',()=>{
 const t={caption:'매출 · 단위: USD million · 2025년',columns:['사업','매출'],rows:[['A','1,200'],['B','600']]}
 expect(reportChart(t)?.rows.map(r=>r.display)).toEqual(['1,200','600'])
 expect(reportChart(t)?.max).toBe(1200)
 for(const table of [{...t,rows:[['A','-10'],['B','20']]},{...t,rows:[['A','미확인'],['B','20']]},{...t,rows:[['A','1,20'],['B','20']]},{...t,rows:[['A','10'],['A','20']]},{...t,caption:'기간 미확인',columns:['사업','값']},{...t,columns:['사업','값','추정']}])expect(reportChart(table)).toBeNull()
})

test('chart units cannot be inferred from ordinary words or mixed-unit metrics',()=>{
 const base={caption:'원문 표',columns:['항목','값'],rows:[['A','100'],['B','50']]}
 for(const caption of ['원문 표','기업별 개요','대상 비교','단위: 미확인','매출(USD million) · 영업이익률(%)'])expect(reportChart({...base,caption})).toBeNull()
 expect(reportChart({...base,caption:'매출 (USD million) · 2025년'})).not.toBeNull()
 expect(reportChart({...base,caption:'매출',columns:['사업','매출 (억원)']})).not.toBeNull()
 expect(reportChart({...base,caption:'단위: USD million',rows:[['매출','100'],['영업이익률 (%)','50']]})).toBeNull()
 expect(reportChart({...base,caption:'단위: USD million',rows:[['A','1'+'0'.repeat(300)],['B','50']]})).toBeNull()
})
