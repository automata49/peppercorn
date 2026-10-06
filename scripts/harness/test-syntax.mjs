import fs from 'node:fs'
import path from 'node:path'
import { babelParse } from 'playwright/lib/transform/babelBundle'

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
  const source=fs.readFileSync(file,'utf8')
  try{
    babelParse(source,file,true)
  }catch(error){
    failed=true
    const loc=error?.loc
    const where=loc?`:${loc.line}:${loc.column+1}`:''
    console.error(`Playwright parse failed: ${rel}${where}`)
    console.error(error?.message||String(error))
  }
}
if(failed)process.exit(1)
console.log(`Playwright test syntax OK: ${files.length} files`)
