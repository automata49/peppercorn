import {test,expect} from '@playwright/test'
import {parseInstinctNews} from '../src/lib/instinctLeaderNews'
import {parseInstinctImages} from '../src/lib/instinctImages'
const image={url:'data/news-assets/external-'+'a'.repeat(64)+'.webp',image_url:'https://upload.wikimedia.org/source.png',source_url:'https://commons.wikimedia.org/wiki/File:Source.png',caption:'검증된 차트',credit:'Verified creator',usage_rights:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',kind:'chart'}
test('news only renders stored image paths with complete attribution',()=>{
 expect(parseInstinctImages([image])).toHaveLength(1)
 expect(parseInstinctImages([{...image,url:'https://tracking.example/pixel'}])).toHaveLength(0)
 expect(parseInstinctImages([{...image,source_url:'javascript:alert(1)'}])).toHaveLength(0)
 expect(parseInstinctImages([{...image,url:'data/news-assets/../../secret.webp'}])).toHaveLength(0)
 const now=Date.parse('2026-10-26T00:00:00Z')
 const feed=parseInstinctNews({version:1,updated_at:'2026-10-25T12:00:00Z',items:[{market:'US',ticker:'NVDA',headline:'Verified issuer announcement',summary:'The company published a dated factual announcement.',source_name:'Official issuer',source_url:'https://issuer.example/news',published_at:'2026-10-25T11:00:00Z',images:[image]}]},now)
 expect(feed?.items[0].images?.[0].kind).toBe('chart')
})
