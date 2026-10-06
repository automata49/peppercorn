import fs from 'node:fs'
import path from 'node:path'
import { transformSync } from 'esbuild'

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
  const source=fs.readFileSync(file,'utf8')
  try{
    transformSync(source,{
      loader:file.endsWith('.tsx')?'tsx':'ts',
      sourcefile:path.relative(process.cwd(),file),
      format:'esm',
      target:'es2022',
      sourcemap:false,
      logLevel:'silent'
    })
  }catch(error){
    failed=true
    const errors=error?.errors||[]
    if(errors.length){
      for(const e of errors){
        const loc=e.location
        console.error(`${loc?.file||file}:${loc?.line||0}:${loc?.column||0} ${e.text}`)
        if(loc?.lineText)console.error(`  ${loc.lineText}`)
      }
    }else console.error(`Syntax parse failed: ${file}\n${error?.stack||error}`)
  }
}
if(failed)process.exit(1)
console.log(`Test syntax OK: ${files.length} files`)
