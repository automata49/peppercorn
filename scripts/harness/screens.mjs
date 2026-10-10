import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const acceptance='docs/design/FOLIO_SCREEN_ACCEPTANCE.md';
const review='docs/harness/UI_REVIEW.md';
const concept=readFileSync('docs/design/references/folio-lifetime-ui-concept.png');
assert.equal(createHash('sha256').update(concept).digest('hex'),'6d0d4f8166ccdfd41c38f83c763633886fe41e13492b755ca6c22e9d7dffea41','Preserve the supplied four-screen concept; replacing it requires an explicit reference decision.');
for(const file of ['AGENTS.md','CLAUDE.md','docs/harness/CONTRACT.md','docs/design/FOLIO_DESIGN_BASELINE.md','docs/design/FOLIO_IDENTITY_V2.md','docs/design/FOLIO_LIFETIME_UI.md',...['folio-identity','pepper-ui','pepper-review'].map(name=>`harness/skills/${name}/SKILL.md`)])assert(read(file).includes(acceptance),`${file} must route current four-screen work to the acceptance contract.`);
for(const file of ['.codex/agents/identity-reviewer.toml','.codex/agents/ui-reviewer.toml','.claude/agents/identity-reviewer.md','.claude/agents/ui-reviewer.md']){
  const content=read(file);
  assert(content.includes(review),`${file} must use the shared current review procedure.`);
  assert(!content.includes('섹터>ETF')&&!content.includes('restricted to')&&!content.includes('stays restricted'),`${file} contains a superseded review instruction.`);
}
const spec=read(acceptance);
assert(spec.includes('regression-only')&&spec.includes('**Open:**'),'Acceptance must distinguish current regression images from open product requirements.');
assert(read('docs/harness/HANDOFF.md').includes('FOUR-SCREENS-1'),'Current acceptance work must have a HANDOFF entry.');
assert.equal(JSON.parse(read('package.json')).scripts['test:four-screens'],'playwright test tests/four-screen-visual.spec.ts --update-snapshots=none');
for(const file of ['.github/workflows/harness.yml','.github/workflows/deploy.yml'])assert(read(file).includes('npm run test:four-screens'),`${file} must execute the four-screen pixel comparison.`);
// Missing or incorrectly sized PNGs cannot be silently approved by Playwright's default missing mode.
for(const [view,width,height] of [['phone-390',390,844],['ipad-834',834,1194],['ipad-pro-1366',1366,1024],['desktop-1440',1440,900]])for(const theme of ['light','dark'])for(const screen of ['today','discover','journal','journey']){
  const file=`tests/four-screen-visual.spec.ts-snapshots/${screen}-${theme}-${view}-linux.png`;
  const png=readFileSync(file);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${file} is not a PNG.`);
  assert.equal(png.readUInt32BE(16),width,`${file} viewport width drifted.`);
  assert.equal(png.readUInt32BE(20),height,`${file} viewport height drifted.`);
}
console.log('Four-screen reference, review authority and 32 committed regression PNGs verified (concept gaps remain open).');
