import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT=path.resolve('tests')
const files=[]
const walk=dir=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())walk(full)
    else if(/\.(?:ts|tsx)$/.test(entry.name))files.push(full)
  }
}
walk(ROOT)

let failed=false
for(const file of files.sort()){
  const source=fs.readFileSync(file,'utf8')
  const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,kind)
  for(const d of sf.parseDiagnostics){
    failed=true
    const pos=sf.getLineAndCharacterOfPosition(d.start??0)
    const msg=ts.flattenDiagnosticMessageText(d.messageText,' ')
    console.error(`${file}:${pos.line+1}:${pos.character+1} TS${d.code} ${msg}`)
  }
}
if(failed)process.exit(1)
console.log(`Test syntax OK: ${files.length} files`)
