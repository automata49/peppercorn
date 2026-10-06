import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT=path.resolve('tests')
const files=[]
const walk=dir=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())walk(full)
    else if(/\.(?:spec|test)\.(?:ts|tsx)$/.test(entry.name))files.push(full)
  }
}
walk(ROOT)

let failed=false
for(const file of files.sort()){
  const rel=path.relative(process.cwd(),file)
  const result=spawnSync('npx',['playwright','test',rel,'--list'],{
    encoding:'utf8',
    env:{...process.env,CI:'1'},
    maxBuffer:8*1024*1024
  })
  if(result.status!==0){
    failed=true
    console.error(`Playwright parse failed: ${rel}`)
    if(result.stdout?.trim())console.error(result.stdout.trim())
    if(result.stderr?.trim())console.error(result.stderr.trim())
    const tsc=spawnSync('npx',['tsc','--pretty','false','--noEmit','--skipLibCheck','--target','ESNext','--module','ESNext','--moduleResolution','Bundler',rel],{
      encoding:'utf8',
      env:{...process.env,CI:'1'},
      maxBuffer:8*1024*1024
    })
    const diagnostics=(tsc.stdout||'')+(tsc.stderr||'')
    const syntaxOnly=diagnostics.split(/\r?\n/).filter(line=>/error TS1\d{3}:/.test(line))
    if(syntaxOnly.length)console.error('TypeScript syntax diagnostics:\n'+syntaxOnly.join('\n'))
  }
}
if(failed)process.exit(1)
console.log(`Playwright test syntax OK: ${files.length} files`)
