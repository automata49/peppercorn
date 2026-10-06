import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const required=[
  'docs/design/FOLIO_IDENTITY_V2.md',
  'docs/design/FOLIO_DESIGN_BASELINE.md',
  'docs/design/FOLIO_UI_RESEARCH.md',
  'src/design/folio-baseline.css',
  'tests/design-baseline.spec.ts',
  'harness/skills/folio-identity/SKILL.md',
  '.agents/skills/folio-identity/SKILL.md',
  '.claude/skills/folio-identity/SKILL.md',
  'plugins/pepper-harness/skills/folio-identity/SKILL.md',
  '.claude/agents/identity-reviewer.md',
  '.codex/agents/identity-reviewer.toml',
  'tests/brand.spec.ts',
  'tests/theme-system.spec.ts',
  'tests/compact-editorial.spec.ts',
  'tests/visual-identity-regression.spec.ts',
  'scripts/generate-b-app-icons.mjs',
  'src/components/FolioMark.tsx',
  'src/components/FolioWordmark.tsx',
  'src/components/AppIcon.tsx',
  'src/components/FolioInsight.tsx',
  'public/folio-b-icon-180.png',
  'public/folio-b-icon-192.png',
  'public/folio-b-icon-512.png',
  'public/folio-b-icon-512-maskable.png',
  'public/folio-b-launch-hero.webp',
  'public/folio-b-motif.svg',
  'public/folio-c-photography.webp'
];
for(const file of required)assert(existsSync(file),`Missing Folio B identity file: ${file}`);

const read=file=>readFileSync(file,'utf8');
const contract=read('docs/harness/CONTRACT.md');
const design=read('docs/design/FOLIO_IDENTITY_V2.md');
const baseline=read('docs/design/FOLIO_DESIGN_BASELINE.md');
const research=read('docs/design/FOLIO_UI_RESEARCH.md');
const baselineCss=read('src/design/folio-baseline.css');
const css=read('src/design/folio-identity.css');
const main=read('src/main.tsx');
const app=read('src/App.tsx');
const sidebar=read('src/components/Sidebar.tsx');
const wordmark=read('src/components/FolioWordmark.tsx');
const appIcon=read('src/components/AppIcon.tsx');
const analysisWorkbench=read('src/components/AnalysisWorkbench.tsx');
const pkg=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('public/manifest.webmanifest'));
const claudePlugin=JSON.parse(read('plugins/pepper-harness/.claude-plugin/plugin.json'));
const codexPlugin=JSON.parse(read('plugins/pepper-harness/.codex-plugin/plugin.json'));
const agentsEntry=read('AGENTS.md');
const claudeEntry=read('CLAUDE.md');
const visualRegression=read('tests/visual-identity-regression.spec.ts');

assert(contract.includes('attached concept B is authoritative')&&contract.includes('FolioMark'), 'CONTRACT must keep B authoritative and lock the vector Folio mark.');
assert(contract.includes('UI-BENCHMARK-1')&&contract.includes('LIQUID-GLASS-1'),'CONTRACT must govern benchmark research and the functional glass layer.');
assert(research.includes('principle + evidence + Folio hypothesis + acceptance test')&&research.includes('Liquid Glass belongs to the **functional layer**'),'UI research protocol must prevent reference cloning and constrain glass to functional layers.');
assert(design.includes('attached concept board\'s column 02 — “Sunset Editorial” (B)'), 'Design doc must name the B concept board as source of truth.');
assert(design.includes('C remains photography treatment only') || design.includes('C is limited to photography treatment'), 'Design doc must limit C to photography treatment.');
assert(css.includes('B EXACT LOCK'), 'Exact B CSS lock is missing.');
assert(css.includes('Inter,"Neue Haas Grotesk Text"'), 'B typography stack drifted.');
assert(main.includes("import './design/folio-baseline.css'")&&main.includes("import './design/folio-identity.css'"), 'Folio baseline and identity stylesheets must both be loaded.');
assert(!existsSync('src/design/robinhood.css'), 'Superseded robinhood.css must stay removed.');
assert(!existsSync('scripts/generate-folio-icons.mjs'), 'Generic icon generator must stay removed once exact B artwork is committed.');
const legacyIdentityAssets=[
  'folio-b-xx-light.png','folio-b-xx-dark.png','public/folio-b-xx-light.png','public/folio-b-xx-dark.png',
  'folio-b-motif.webp','public/folio-b-motif.webp',
  'apple-touch-icon.png',
  'folio-app-icon-180.png','folio-app-icon-192.png','folio-app-icon-512.png','folio-app-icon-512-maskable.png',
  'folio-apple-touch-icon.png',
  'folio-icon-192.png','folio-icon-512.png','folio-icon-512-maskable.png','folio-icon.webp',
  'folio-identity-180.png','folio-identity-192.png','folio-identity-512.png','folio-identity-512-maskable.png',
  'folio-wordmark.webp',
  'icon-192.png','icon-512.png','icon-512-maskable.png',
  'logo.webp','public/logo.webp'
];
for(const file of legacyIdentityAssets)assert(!existsSync(file),`Legacy identity asset must stay removed: ${file}`);
assert(!app.includes('Peppercorn Capital')&&!app.includes('logo.webp'),'Launch must remain Folio-only without Peppercorn co-branding.');
const mainEntry=read('src/main.tsx');
const authModal=read('src/components/AuthModal.tsx');
const installApp=read('src/components/InstallApp.tsx');
assert(!mainEntry.includes('<strong>Peppercorn Capital</strong>'),'Fatal fallback must remain Folio-only.');
assert(!authModal.includes('<span>Peppercorn Capital</span>')&&!authModal.includes("signup_closed:'Peppercorn"),'Auth UI must remain Folio-only.');
assert(authModal.includes("import { FolioWordmark } from './FolioWordmark'")&&authModal.includes('<FolioWordmark className="auth-wordmark"/>'),'Auth must use the same canonical Folio wordmark, not plain brand text.');
assert(mainEntry.includes("import { FolioWordmark } from './components/FolioWordmark'")&&mainEntry.includes('<FolioWordmark className="fatal-wordmark"/>'),'Fatal fallback must use the canonical Folio wordmark.');
assert(installApp.includes("import { FolioWordmark } from './FolioWordmark'")&&installApp.includes('<FolioWordmark className="install-wordmark"/>'),'Install UI must use the canonical Folio wordmark.');
for(const [name,content] of [['App',app],['Sidebar',sidebar],['Wordmark',wordmark],['Auth',authModal],['Install',installApp],['Main',mainEntry]])assert(!content.includes('Folio XX'),`${name} must never expose uppercase Folio XX; the brand is Folio xx.`);
for(const [name,content] of [['App',app],['Auth',authModal],['Install',installApp],['AnalysisWorkbench',analysisWorkbench]])assert(!content.includes('>×</button>'),`${name} must use the shared AppIcon close symbol, not a text × glyph.`);
assert(!app.includes('SUNSET EDITORIAL'),'Launch must not expose the internal Sunset Editorial concept label.');
assert(!css.includes('\\n'),'Identity CSS contains a literal \\n escape.');
assert(!css.includes('launch-wordmark-system')&&!css.includes('radial-gradient(circle at 24% 78%'),'Superseded launch/wordmark identity CSS returned.');
assert(!existsSync('public/folio-b-wordmark-light.webp')&&!existsSync('public/folio-b-wordmark-dark.webp'),'Noisy screenshot-crop wordmarks must stay removed.');
assert(!pkg.scripts?.predev&&!pkg.scripts?.prebuild, 'Exact B artwork must not be regenerated by npm lifecycle scripts.');
const iconBuild=read('scripts/generate-b-app-icons.mjs');
assert(pkg.scripts?.build?.startsWith('node scripts/generate-b-app-icons.mjs &&'),'Build must render the corrected B app-icon family before Vite.');
assert(pkg.scripts?.dev?.startsWith('node scripts/generate-b-app-icons.mjs &&'),'Local dev must render the same baseline app-icon family before Vite.');
assert(iconBuild.includes('MARK_WIDTH_RATIO=0.58')&&iconBuild.includes('MARK_ASPECT=VIEW_W/VIEW_H'),'B app-icon xx scale/aspect drifted from the approved concept-B board.');
assert(iconBuild.includes('const diamond=[[92,33],[111,52],[92,71],[73,52]]'),'B app-icon must preserve the centered negative diamond.');
assert(!iconBuild.includes('folio-b-xx-dark.png'),'App icon generator must use procedural vector geometry, not a raster source.');
assert(iconBuild.includes("fs.readFileSync('src/design/folio-baseline.css','utf8')")&&iconBuild.includes('return mix(PLUM,MAGENTA,t)'),'App icon palette must derive from the Level-0 B colour tokens.');
assert(!iconBuild.includes('transparentCorners')&&!iconBuild.includes('roundedInside'),'Home-screen icon PNGs must stay full square; platform masks own the corner shape.');

assert(sidebar.includes("import { FolioWordmark } from './FolioWordmark'")&&sidebar.includes('<FolioWordmark/>'),'Sidebar must consume the canonical Folio wordmark component.');
assert(wordmark.includes('folio-wordmark-text')&&wordmark.includes('>Folio</span>')&&wordmark.includes("import { FolioMark } from './FolioMark'")&&wordmark.includes('<FolioMark/>'),'Canonical wordmark must render live Folio text plus the vector xx mark.');
const folioMark=read('src/components/FolioMark.tsx');
assert(folioMark.includes('M92 33 111 52 92 71 73 52Z'),'Visible Folio mark must preserve the B negative diamond.');
assert(!folioMark.includes('currentColor')&&folioMark.includes('var(--folio-brand-plum,#54265f)')&&folioMark.includes('var(--folio-brand-coral,#f06a45)'),'Visible Folio xx colours must be fixed to the B palette, not inherited from page text.');
assert(appIcon.includes("stroke:'currentColor'")&&appIcon.includes('strokeWidth:1.55')&&appIcon.includes("strokeLinecap:'round'")&&appIcon.includes("strokeLinejoin:'round'"),'AppIcon master geometry/stroke contract drifted.');
assert(css.includes('.folio-wordmark-text')&&css.includes('font-family:Inter'),'B wordmark typography contract is missing.');
for(const asset of ['folio-b-launch-hero.webp','folio-b-motif.svg','folio-c-photography.webp'])assert(app.includes(asset),`App identity placement missing ${asset}`);
assert(app.includes("['overview','Overview'],['analysis','Analysis'],['financials','Financials'],['thesis','Thesis']"),'Analysis depth tabs must remain Overview / Analysis / Financials / Thesis.');
assert(app.includes('<FolioInsight row={selected} position={positionOf(selected)}/>'),'Overview must keep the structured Folio Insight.');
assert(css.includes('FOLIO DESIGN BASELINE — compact application'),'Compact UI must consume the Level-0 baseline.');
assert(css.includes('aspect-ratio:var(--folio-ds-wordmark-mark-ratio)')&&baselineCss.includes('--folio-ds-wordmark-mark-ratio:184 / 104'),'Visible xx must keep the master 184:104 vector aspect through the Level-0 token.');
assert(css.includes('var(--folio-ds-wordmark-phone)')&&css.includes('var(--folio-ds-wordmark-mark-height)')&&baselineCss.includes('--folio-ds-wordmark-mark-height:1ex'),'Phone Folio xx must consume the lowercase x-height baseline.');
assert(css.includes('var(--folio-ds-icon-size)')&&css.includes('var(--folio-ds-icon-stroke)'),'Compact icons must consume baseline tokens.');
assert(!/OPTICAL LOCK V[4-9]|QUALITY PASS V[3-9]/.test(css),'Do not append new quality-pass override generations; change baseline tokens or component owners.');
assert(baselineCss.includes('--folio-brand-plum:#54265f')&&baselineCss.includes('--folio-brand-magenta:#a34f78')&&baselineCss.includes('--folio-brand-coral:#f06a45')&&baselineCss.includes('--folio-brand-amber:#f5a24a'),'Level-0 B palette tokens drifted.');
assert(baselineCss.includes('--folio-ds-light-paper:#faf8f5')&&baselineCss.includes('--folio-ds-glass-bg:rgba(255,255,255,.68)')&&baselineCss.includes('--folio-ds-glass-bg-strong:rgba(255,255,255,.82)')&&baselineCss.includes('--folio-ds-glass-blur:22px'),'Bright-default / Liquid Glass Level-0 tokens drifted.');
assert(css.includes('var(--folio-ds-glass-bg-strong')&&css.includes('var(--folio-ds-glass-blur')&&css.includes('-webkit-backdrop-filter'),'Functional glass must be implemented with shared tokens and Safari-compatible blur.');
assert(css.includes('Glass is for navigation/controls, never analytical content')||baselineCss.includes('Glass is for navigation/controls, never analytical content'),'Glass/content-layer boundary must stay documented in source.');
for(const label of ["system:'System'","light:'Light'","dark:'Dark'"])assert(sidebar.includes(label),`Theme mode missing: ${label}`);
const appIndex=read('app/index.html');
assert(sidebar.includes("saved==='light'||saved==='dark'||saved==='system'?saved:'light'"),'React theme fallback must be Light on a fresh install.');
assert(appIndex.includes("saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'light'"),'Pre-React shell must start fresh installs in Light.');
assert(appIndex.includes('#faf8f5'),'Pre-React shell must use the bright editorial paper color.');
assert(css.includes('aspect-ratio:508/235')&&css.includes('width:calc(100vw - 36px)'),'Phone launch must preserve the B source aspect inside safe margins.');
assert(css.includes('clamp(var(--folio-ds-motif-phone-min),29vw,var(--folio-ds-motif-phone-max))')&&baselineCss.includes('--folio-ds-motif-phone-min:108px')&&baselineCss.includes('--folio-ds-motif-phone-max:122px'),'Phone B motif must consume the compact baseline bounds.');
const themeTest=read('tests/theme-system.spec.ts');
const brandTest=read('tests/brand.spec.ts');
assert(themeTest.includes('fresh install starts in Light even when the device prefers dark'),'Light-first regression test is missing.');
assert(brandTest.includes('frame!.width/frame!.height'),'Compact B launch-ratio regression test is missing.');
assert.equal(pkg.scripts?.['test:visual-identity'],'playwright test tests/visual-identity-regression.spec.ts','Visual identity regression command drifted.');
assert.equal(pkg.scripts?.['test:identity'],'playwright test tests/design-baseline.spec.ts tests/brand.spec.ts tests/theme-system.spec.ts tests/compact-editorial.spec.ts tests/compact-titlebar.spec.ts tests/discovery.spec.ts tests/visual-identity-regression.spec.ts','test:identity script drifted.');
for(const width of [390,834,1366,1440])assert(visualRegression.includes(`width:${width}`),`Missing canonical visual-regression viewport: ${width}px`);
assert(agentsEntry.includes('docs/design/FOLIO_DESIGN_BASELINE.md')&&agentsEntry.includes('docs/design/FOLIO_IDENTITY_V2.md')&&agentsEntry.includes('folio-identity'),'AGENTS.md must route identity work through the Level-0 baseline, identity doc and skill.');
assert(claudeEntry.includes('docs/design/FOLIO_DESIGN_BASELINE.md')&&claudeEntry.includes('docs/design/FOLIO_IDENTITY_V2.md')&&claudeEntry.includes('folio-identity'),'CLAUDE.md must route identity work through the Level-0 baseline, identity doc and skill.');
assert.equal(claudePlugin.version,'1.2.0','Claude harness plugin version must match exact-B bundle.');
assert.equal(codexPlugin.version,'1.2.0','Codex harness plugin version must match exact-B bundle.');

const expectedIcons=[
  './folio-b-icon-192.png?v=b5',
  './folio-b-icon-512.png?v=b5',
  './folio-b-icon-512-maskable.png?v=b5'
];
assert.deepEqual(manifest.icons.map(icon=>icon.src),expectedIcons,'Manifest must use only exact B app icons.');
assert.equal(manifest.background_color,'#faf8f5','Manifest paper color must match bright editorial baseline.');
assert.equal(manifest.theme_color,'#faf8f5','Manifest theme color must match bright editorial baseline.');
assert(read('app/index.html').includes('folio-b-icon-180.png?v=b5'),'Apple touch icon must carry the B4 baseline cache revision.');

for(const file of ['app/index.html','public/sw.js','src/components/InstallApp.tsx','.github/workflows/deploy.yml']){
  const content=read(file);
  assert(!content.includes('folio-app-icon-'),`Stale punch-card icon reference in ${file}`);
  assert(!content.includes('folio-identity-'),`Superseded generated identity reference in ${file}`);
  assert(content.includes('folio-b-icon-'),`Exact B icon reference missing in ${file}`);
}

const deployWorkflow=read('.github/workflows/deploy.yml');
assert(!deployWorkflow.includes('logo.webp'),'Deploy workflow must not republish the legacy Peppercorn logo.');
for(const asset of [
  'folio-b-launch-hero.webp',
  'folio-b-motif.svg',
  'folio-c-photography.webp'
]){
  assert(deployWorkflow.includes(asset),`Pages root sync missing active identity asset: ${asset}`);
}
for(const file of ['app/index.html','src/components/Sidebar.tsx']){
  const content=read(file);
  assert(!content.includes('folio-wordmark.webp'),`Legacy wordmark reference in active UI: ${file}`);
  assert(!content.includes('folio-icon.webp'),`Legacy emblem reference in active UI: ${file}`);
}

console.log('Folio exact Sunset Editorial B identity invariants passed.');
