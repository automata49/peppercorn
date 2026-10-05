import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const required=[
  'docs/design/FOLIO_IDENTITY_V2.md',
  'harness/skills/folio-identity/SKILL.md',
  '.agents/skills/folio-identity/SKILL.md',
  '.claude/skills/folio-identity/SKILL.md',
  'plugins/pepper-harness/skills/folio-identity/SKILL.md',
  '.claude/agents/identity-reviewer.md',
  '.codex/agents/identity-reviewer.toml',
  'tests/brand.spec.ts',
  'tests/theme-system.spec.ts',
  'tests/compact-editorial.spec.ts',
  'scripts/generate-folio-icons.mjs'
];
for(const file of required)assert(existsSync(file),`Missing Folio identity harness file: ${file}`);

const read=file=>readFileSync(file,'utf8');
const contract=read('docs/harness/CONTRACT.md');
const design=read('docs/design/FOLIO_IDENTITY_V2.md');
const css=read('src/design/folio-identity.css');
const main=read('src/main.tsx');
const sidebar=read('src/components/Sidebar.tsx');
const pkg=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('public/manifest.webmanifest'));
const claudePlugin=JSON.parse(read('plugins/pepper-harness/.claude-plugin/plugin.json'));
const codexPlugin=JSON.parse(read('plugins/pepper-harness/.codex-plugin/plugin.json'));
const agentsEntry=read('AGENTS.md');
const claudeEntry=read('CLAUDE.md');

assert(contract.includes('Sunset Editorial (B)'), 'CONTRACT must name Sunset Editorial (B).');
assert(contract.includes('same Sunset Editorial (B) visual system as desktop'), 'CONTRACT must make B authoritative on phone/iPad.');
assert(design.includes('Compact layouts do not use a separate C/Fluid-Market UI'), 'Design doc must forbid a separate Fluid Market compact UI.');
assert(css.includes('Sunset Editorial (B) across desktop, mobile and iPad'), 'Identity stylesheet direction is stale.');
assert(css.includes('Compact / touch override — Sunset Editorial (B)'), 'Compact B override is missing.');
assert(main.includes("import './design/folio-identity.css'"), 'Folio identity stylesheet is not loaded.');
assert(!existsSync('src/design/robinhood.css'), 'Superseded robinhood.css must stay removed.');
assert(sidebar.includes('FolioWordmark'), 'Theme-native Folio wordmark is missing.');
for(const label of ["system:'System'","light:'Light'","dark:'Dark'"])assert(sidebar.includes(label),`Theme mode missing: ${label}`);
assert.equal(pkg.scripts?.['test:identity'],'playwright test tests/brand.spec.ts tests/theme-system.spec.ts tests/compact-editorial.spec.ts tests/compact-titlebar.spec.ts','test:identity script drifted.');
assert(agentsEntry.includes('docs/design/FOLIO_IDENTITY_V2.md')&&agentsEntry.includes('folio-identity'),'AGENTS.md must route identity work through the design doc and skill.');
assert(claudeEntry.includes('docs/design/FOLIO_IDENTITY_V2.md')&&claudeEntry.includes('folio-identity'),'CLAUDE.md must route identity work through the design doc and skill.');
assert.equal(claudePlugin.version,'1.1.0','Claude harness plugin version must match identity-v2 bundle.');
assert.equal(codexPlugin.version,'1.1.0','Codex harness plugin version must match identity-v2 bundle.');

const expectedIcons=[
  './folio-identity-192.png',
  './folio-identity-512.png',
  './folio-identity-512-maskable.png'
];
assert.deepEqual(manifest.icons.map(icon=>icon.src),expectedIcons,'Manifest must use only current Folio identity icons.');

for(const file of ['app/index.html','public/sw.js','src/components/InstallApp.tsx','.github/workflows/deploy.yml']){
  const content=read(file);
  assert(!content.includes('folio-app-icon-'),`Stale punch-card icon reference in ${file}`);
}
for(const file of ['app/index.html','src/components/Sidebar.tsx']){
  const content=read(file);
  assert(!content.includes('folio-wordmark.webp'),`Legacy wordmark reference in active UI: ${file}`);
  assert(!content.includes('folio-icon.webp'),`Legacy emblem reference in active UI: ${file}`);
}
console.log('Folio identity harness invariants passed.');
