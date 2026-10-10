import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';

const supplied=[
  'public/folio-brand-launch.webp',
  'public/folio-brand-launch-landscape.webp',
  'public/folio-brand-typography.webp',
  'public/folio-brand-photography.webp',
  'public/folio-brand-wordmark-light.webp',
  'public/folio-brand-wordmark-dark.webp',
  'public/folio-brand-icon-black.webp',
  'public/folio-brand-icon-glossy.webp',
  'public/folio-brand-icon-light.webp',
];
const required=[
  'docs/design/FOLIO_IDENTITY_V2.md',
  'docs/design/FOLIO_DESIGN_BASELINE.md',
  'src/design/folio-baseline.css',
  'src/design/folio-identity.css',
  'src/design/folio-journey.css',
  'src/components/StockSizeFilter.tsx',
  'src/lib/stockSize.ts',
  'tests/design-baseline.spec.ts',
  'tests/brand.spec.ts',
  'tests/theme-system.spec.ts',
  'tests/compact-editorial.spec.ts',
  'tests/visual-identity-regression.spec.ts',
  'harness/skills/folio-identity/SKILL.md',
  '.agents/skills/folio-identity/SKILL.md',
  '.claude/skills/folio-identity/SKILL.md',
  'plugins/pepper-harness/skills/folio-identity/SKILL.md',
  '.claude/agents/identity-reviewer.md',
  '.codex/agents/identity-reviewer.toml',
  'scripts/generate-b-app-icons.mjs',
  'src/components/FolioWordmark.tsx',
  'src/components/AppIcon.tsx',
  'src/components/FolioInsight.tsx',
  'public/folio-b-icon-180.png',
  'public/folio-b-icon-192.png',
  'public/folio-b-icon-512.png',
  'public/folio-b-icon-512-maskable.png',
  ...supplied,
];
for(const file of required){
  assert(existsSync(file),`Missing Folio supplied-identity file: ${file}`);
  if(file.startsWith('public/folio-'))assert(statSync(file).size>1024,`Identity asset unexpectedly small: ${file}`);
}

const read=file=>readFileSync(file,'utf8');
const contract=read('docs/harness/CONTRACT.md');
const design=read('docs/design/FOLIO_IDENTITY_V2.md');
const baseline=read('docs/design/FOLIO_DESIGN_BASELINE.md');
const baselineCss=read('src/design/folio-baseline.css');
const css=read('src/design/folio-identity.css');
const journeyCss=read('src/design/folio-journey.css');
const stockSizeFilter=read('src/components/StockSizeFilter.tsx');
const stockSize=read('src/lib/stockSize.ts');
const app=read('src/App.tsx');
const sidebar=read('src/components/Sidebar.tsx');
const wordmark=read('src/components/FolioWordmark.tsx');
const appIcon=read('src/components/AppIcon.tsx');
const iconCheck=read('scripts/generate-b-app-icons.mjs');
const pkg=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('public/manifest.webmanifest'));
const appIndex=read('app/index.html');
const authModal=read('src/components/AuthModal.tsx');
const installApp=read('src/components/InstallApp.tsx');
const mainEntry=read('src/main.tsx');
const deployWorkflow=read('.github/workflows/deploy.yml');
const visualRegression=read('tests/visual-identity-regression.spec.ts');
const claudePlugin=JSON.parse(read('plugins/pepper-harness/.claude-plugin/plugin.json'));
const codexPlugin=JSON.parse(read('plugins/pepper-harness/.codex-plugin/plugin.json'));

assert(contract.includes('2026-10-07 supplied-asset lock'),'CONTRACT must lock the 2026-10-07 supplied identity assets.');
assert(design.includes('seven identity files supplied by the user on 2026-10-07'),'Identity doc must name the supplied asset set as source of truth.');
assert(baseline.includes('seven user-supplied identity files approved on **2026-10-07**'),'Level-0 baseline must defer brand pixels to the supplied files.');
assert(css.includes('USER-SUPPLIED IDENTITY ASSET LOCK — 2026-10-07'),'Supplied-asset CSS lock is missing.');
assert(mainEntry.includes("import './design/folio-baseline.css'")&&mainEntry.includes("import './design/folio-identity.css'")&&mainEntry.includes("import './design/folio-journey.css'"),'Baseline, identity and journey stylesheets must all load.');

assert(!existsSync('src/components/FolioMark.tsx'),'Retired FolioMark.tsx must not return after supplied wordmark approval.');
for(const file of [
  'public/folio-b-launch-hero.webp','folio-b-launch-hero.webp',
  'public/folio-b-motif.svg','folio-b-motif.svg',
  'public/folio-c-photography.webp','folio-c-photography.webp',
  'folio-b-xx-light.png','folio-b-xx-dark.png','public/folio-b-xx-light.png','public/folio-b-xx-dark.png',
  'apple-touch-icon.png','folio-wordmark.webp','logo.webp','public/logo.webp',
  'folio-app-icon-180.png','folio-app-icon-192.png','folio-app-icon-512.png','folio-app-icon-512-maskable.png',
  'folio-identity-180.png','folio-identity-192.png','folio-identity-512.png','folio-identity-512-maskable.png',
  'icon-192.png','icon-512.png','icon-512-maskable.png'
])assert(!existsSync(file),`Retired identity asset must stay removed: ${file}`);

assert(wordmark.includes('folio-brand-wordmark-light.webp?v=u2')&&wordmark.includes('folio-brand-wordmark-dark.webp?v=u2'),'Canonical FolioWordmark must display the supplied light/dark artwork.');
assert(!wordmark.includes('FolioMark')&&!wordmark.includes('folio-wordmark-text'),'Canonical wordmark must not reconstruct the supplied lettering.');
assert(sidebar.includes("import { FolioWordmark } from './FolioWordmark'")&&sidebar.includes('<FolioWordmark/>'),'Sidebar must consume canonical FolioWordmark.');
assert(authModal.includes('<FolioWordmark className="auth-wordmark"/>')&&installApp.includes('<FolioWordmark className="install-wordmark"/>')&&mainEntry.includes('<FolioWordmark className="fatal-wordmark"/>'),'All brand surfaces must consume canonical FolioWordmark.');

for(const asset of ['folio-brand-launch.webp?v=u3','folio-brand-launch-landscape.webp?v=u3','folio-brand-typography.webp?v=u2','folio-brand-photography.webp?v=u2']){
  assert(app.includes(asset),`App supplied identity placement missing ${asset}`);
}
assert(!app.includes('launch-editorial-caption')&&!app.includes('<footer className="launch-footer"'),'Supplied launch hero must not be duplicated by caption/footer branding.');
assert(!app.includes('SUNSET EDITORIAL')&&!app.includes('Peppercorn Capital')&&!app.includes('logo.webp'),'Launch must stay Folio-only.');
assert(css.includes('aspect-ratio:9/16'),'Launch must preserve the supplied 9:16 source ratio.');
assert(!css.includes('\\n'),'Identity CSS contains a literal \\n escape.');

assert(iconCheck.includes('Using user-supplied Folio icon artwork'),'Icon preflight must be verification-only.');
assert(iconCheck.includes('public/folio-brand-icon-black.webp'),'Icon preflight must require the supplied black icon source.');
for(const forbidden of ['MARK_WIDTH_RATIO','VIEW_W','const polygons','insidePolygon','colorAt','encodePng']){
  assert(!iconCheck.includes(forbidden),`Procedural app-icon reconstruction returned: ${forbidden}`);
}
assert(pkg.scripts?.build?.startsWith('node scripts/generate-b-app-icons.mjs &&'),'Build must verify supplied app icons before Vite.');
assert(pkg.scripts?.dev?.startsWith('node scripts/generate-b-app-icons.mjs &&'),'Dev must verify supplied app icons before Vite.');

assert(appIcon.includes("stroke:'currentColor'")&&appIcon.includes('strokeWidth:1.55')&&appIcon.includes("strokeLinecap:'round'")&&appIcon.includes("strokeLinejoin:'round'"),'Functional AppIcon geometry/stroke contract drifted.');
assert(baselineCss.includes('.folio-wordmark-image')&&baselineCss.includes('height:100%'),'Level-0 must size the supplied wordmark image without reconstructing it.');
assert(css.includes('.folio-wordmark-image-light')&&css.includes('.folio-wordmark-image-dark'),'Light/dark supplied wordmark switching is missing.');
assert(css.includes('display:inline-grid!important')&&css.includes('grid-area:1 / 1!important'),'Wordmark variants must share one grid cell so they can never render side-by-side.');
assert(css.includes(':root[data-theme="light"] .leadership-overview')&&css.includes(':root[data-theme="light"] .analysis-page'),'Light theme must explicitly keep Leadership and Analysis surfaces light.');
assert(css.includes('--folio-surface:#efe9e3;'),'Light structural surface must remain the warm Sunset Editorial surface, not pure white.');
assert(!css.includes('--folio-surface:#ffffff;'),'Pure-white light surface token must not return.');
assert(journeyCss.includes('radial-gradient(circle at 94% 4%,rgba(240,106,69,.055)')&&journeyCss.includes('radial-gradient(circle at 75% 10%,rgba(84,38,95,.045)'),'Every workspace must keep the restrained Detail-style sunset field.');
assert(css.includes('var(--folio-ds-icon-size)')&&css.includes('var(--folio-ds-icon-stroke)'),'Compact functional icons must consume baseline tokens.');
assert(!/OPTICAL LOCK V[4-9]|QUALITY PASS V[3-9]/.test(css),'Do not append new quality-pass override generations.');

assert(sidebar.includes("saved==='light'||saved==='dark'||saved==='system'?saved:'light'"),'Fresh React theme fallback must remain Light.');
assert(appIndex.includes("saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'light'"),'Pre-React shell must remain Light-first.');
for(const label of ["system:'System'","light:'Light'","dark:'Dark'"])assert(sidebar.includes(label),`Theme mode missing: ${label}`);

assert(app.includes("['overview','Overview'],['analysis','Analysis'],['financials','Financials'],['thesis','Thesis']"),'Analysis depth tabs must remain Overview / Analysis / Financials / Thesis.');
assert(app.includes('<FolioInsight row={selected} position={positionOf(selected)}/>'),'Overview must keep structured Folio Insight.');
assert(stockSizeFilter.includes("STOCK_CATEGORY_LABELS=[['large','대형주'],['small','중소형주'],['all','전체'],['etf','ETF']]"),'Explore category order must remain 대형주 / 중소형주 / 전체 / ETF.');
assert(stockSizeFilter.includes('stock-size-equities')&&stockSizeFilter.includes('stock-size-divider')&&stockSizeFilter.includes('stock-size-etf'),'Category control must keep equities grouped, a visible divider, and a separate ETF pebble.');
assert(stockSize.includes("export type StockSize='large'|'small'|'etf'|'all'")&&stockSize.includes("if(size==='etf')return rows.filter(r=>r.asset_class==='ETF')"),'ETF must remain a first-class Explore category.');
assert(app.includes("[['core','핵심 주도'],['candidates','주도 후보'],['turns','강세 전환'],['corrections','조정 중']]"),'Equity leadership labels must be exactly 핵심 주도 / 주도 후보 / 강세 전환 / 조정 중.');
assert(!app.includes("['position','Position']"),'Position must not return as an Explore category.');
assert(!app.includes("Financial Snapshot · Position"),'Legacy Position product label must not return.');
assert(journeyCss.includes('PRODUCT VISUAL IDENTITY — 2026-10-07'),'All-page Folio visual identity layer is missing.');
assert(contract.includes('Folio Sunset Editorial + Pebble Liquid Glass')&&design.includes('Pebble Liquid Glass')&&baseline.includes('Pebble Liquid Glass'),'Harness docs must brand the current system as Sunset Editorial + Pebble Liquid Glass.');
assert(journeyCss.includes('Sunset Editorial pebble glass')&&journeyCss.includes('backdrop-filter:blur(18px) saturate(1.22)')&&journeyCss.includes('border-radius:52% 48% 54% 46% / 46% 55% 45% 54%'),'Pebble Liquid Glass geometry/material contract drifted.');
assert(sidebar.includes("['signal','sectors','시장 신호']"),'The former Market Signal destination must remain named 시장 신호.');
assert(app.includes("const etfRows=useMemo(()=>marketRows.filter(r=>r.asset_class==='ETF'),[marketRows])")&&app.includes('const etfPreview=rankedEtfRows')&&app.includes('<EtfRsChart rows={rankedEtfRows.slice(0,5)}')&&!app.includes('etfMkt'),'Home ETF and 시장 신호 chart/list must share the same global-market ranked Top 5 without an independent ETF market state.');
assert(app.includes('dashboard-explore dashboard-explore-expanded')&&!app.includes('<details className="dashboard-explore"'),'Core ETF exploration must remain expanded, not hidden in a disclosure.');
assert(app.includes('sector-heat-disclosure signal-expanded-block')&&!app.includes('<details className="dashboard-disclosure sector-heat-disclosure"'),'Core sector map must remain expanded, not hidden in a disclosure.');
assert(app.includes('aria-label="시장 신호 요약"')&&app.includes('onClick={openMarketSignal}')&&app.includes('시장 폭 → 섹터 → ETF 요약')&&app.includes("setSectorMkt(market);setPage('signal')"),'Home 오늘의 시장 must summarize the full market-signal path, reset the sector page to the same global market, and its 전체 보기 must open 시장 신호.');
assert(app.includes('aria-label="오늘의 주도주"')&&app.includes('<h2>오늘의 주도주</h2>'),'Home leader preview must use the canonical 오늘의 주도주 title.');
assert(app.indexOf('className="journey-today"')<app.indexOf('className="journey-classes"'),'오늘의 주도주 must appear above the four leadership-class buttons.');
for(const selector of ['.page-analysis','.page-thesis','.page-tracking','.page-leaderboard','.page-universe','.page-temperature','.page-settings']){
  assert(journeyCss.includes(selector),`All-page Folio identity coverage missing ${selector}`);
}


const expectedIcons=[
  './folio-b-icon-192.png?v=u2',
  './folio-b-icon-512.png?v=u2',
  './folio-b-icon-512-maskable.png?v=u2'
];
assert.deepEqual(manifest.icons.map(icon=>icon.src),expectedIcons,'Manifest must use the supplied-icon derivatives.');
assert(appIndex.includes('folio-b-icon-180.png?v=u2'),'Apple touch icon must use supplied-icon cache revision u1.');
assert.equal(manifest.background_color,'#f4f1ec');
assert.equal(manifest.theme_color,'#f4f1ec');

for(const file of ['app/index.html','public/sw.js','src/components/InstallApp.tsx','.github/workflows/deploy.yml']){
  const content=read(file);
  assert(content.includes('folio-b-icon-'),`Supplied installed icon reference missing in ${file}`);
  assert(!content.includes('folio-app-icon-')&&!content.includes('folio-identity-'),`Stale identity reference in ${file}`);
}
for(const asset of supplied.map(file=>file.replace('public/',''))){
  assert(deployWorkflow.includes(asset),`Pages root sync missing supplied asset: ${asset}`);
}
for(const retired of ['folio-b-launch-hero.webp','folio-b-motif.svg','folio-c-photography.webp']){
  assert(!deployWorkflow.includes(retired),`Deploy workflow must not republish retired asset: ${retired}`);
}

assert.equal(pkg.scripts?.['test:visual-identity'],'playwright test tests/visual-identity-regression.spec.ts');
assert.equal(pkg.scripts?.['test:identity'],'playwright test tests/design-baseline.spec.ts tests/brand.spec.ts tests/theme-system.spec.ts tests/compact-editorial.spec.ts tests/compact-titlebar.spec.ts tests/discovery.spec.ts tests/visual-identity-regression.spec.ts');
for(const width of [390,834,1366,1440])assert(visualRegression.includes(`width:${width}`),`Missing canonical visual-regression viewport: ${width}px`);
assert.equal(claudePlugin.version,'1.2.0');
assert.equal(codexPlugin.version,'1.2.0');
assert(claudePlugin.description.includes('Folio Sunset Editorial + Pebble Liquid Glass'),'Claude plugin description must carry the current Sunset Pebble identity.');
assert(codexPlugin.description.includes('Folio Sunset Editorial + Pebble Liquid Glass'),'Codex plugin description must carry the current Sunset Pebble identity.');

console.log('Folio Sunset Editorial + Pebble Liquid Glass identity invariants passed.');

const marketCss=readFileSync('src/design/market-colors.css','utf8');
const pebbleCss=readFileSync('src/design/folio-pebble.css','utf8');
assert(marketCss.includes('[data-market="KR"]')&&marketCss.includes('[data-market="US"]')&&marketCss.includes('--market-gain:#196b42;--market-loss:#b3261e'),'MARKET-COLORS-1 must preserve market-specific signed colours.');
assert(app.includes('data-market={r.market}')&&app.includes('data-market={g.market}'),'Mixed-market stock and sector rows must carry their own market.');
assert(pebbleCss.includes('.journey-today')&&pebbleCss.includes('.journey-classes button')&&pebbleCss.includes('.analysis-scope button')&&pebbleCss.includes('backdrop-filter:blur(18px) saturate(1.22)'),'PEBBLE-REGIONS-1 must cover major regions and leadership controls.');
assert(journeyCss.includes('FLAT-METRICS-1')&&journeyCss.includes('--folio-surface:var(--folio-paper)'),'Nested metrics must remain unboxed on the common paper base.');

assert(pebbleCss.includes('LEADERSHIP-GLASS-2')&&pebbleCss.includes('border-radius:24px!important')&&pebbleCss.includes('content:none!important'),'Leadership glass must be borderless rounded rectangles without edge decorations.');

const stockCard=readFileSync('src/components/StockTrendList.tsx','utf8');
assert(!stockCard.includes('stock-avatar')&&stockCard.includes('stock-trend-name'),'STOCK-CARDS-2 removes initials and preserves explicit instrument names.');
assert(pebbleCss.includes('.journey-tracking-tabs button[aria-selected=true]')&&journeyCss.includes('@container stock-list'),'Tracking must share glass and stock cards must adapt to available width.');

// LIFETIME-JOURNEY-1 retains analytics in Market Summary while making personal pages primary.
assert(app.includes("useState('today')")&&app.includes('<LifetimeJournal'),'Today must open the personal journal workspace.');
for(const label of ["['today','home','오늘']","['analysis','search','발견']","['notebook','journal','저널']","['tracking','watchlist','여정']"])assert(sidebar.includes(label),'Lifetime primary destination missing: '+label);
assert(mainEntry.includes("import './design/lifetime.css'"),'Lifetime component styles must load.');
for(const dependency of ['motion','@tiptap/react','@tiptap/starter-kit','lightweight-charts','@radix-ui/react-tabs','@radix-ui/react-slot','class-variance-authority'])assert(pkg.dependencies[dependency],'Missing approved UI dependency '+dependency);
