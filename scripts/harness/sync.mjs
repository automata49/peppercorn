import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const check=process.argv.includes('--check');
let failed=false;
for(const name of readdirSync('harness/skills')){
  const content=readFileSync(`harness/skills/${name}/SKILL.md`,'utf8');
  for(const target of [`.agents/skills/${name}/SKILL.md`,`.claude/skills/${name}/SKILL.md`,`plugins/pepper-harness/skills/${name}/SKILL.md`]){
    if(check){try{if(readFileSync(target,'utf8')!==content)throw Error('drift')}catch{console.error(`Skill drift: ${target}`);failed=true}}
    else{mkdirSync(dirname(resolve(target)),{recursive:true});writeFileSync(target,content)}
  }
}
if(failed)process.exit(1);
console.log(check?'Skill adapters match canonical source.':'Skill adapters generated.');
