const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const result=spawnSync(process.execPath,['scripts/harness/check.mjs'],{cwd:root,encoding:'utf8',timeout:25000});
if(result.status!==0){console.error('Pepper harness check failed. Run npm run harness:check and repair the reported issue.\n'+(result.stderr||result.error||'')+(result.stdout||''));process.exit(2)}
console.log('Pepper harness check passed. UI/brand changes still require build, npm run test:identity and browser checks.');
