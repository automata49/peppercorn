import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync, writeFileSync, existsSync} from 'node:fs'
import {basename} from 'node:path'

const sha=(process.argv[2]||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim()
assert(/^[a-f0-9]{12,40}$/.test(sha),'Expected a commit revision')
const rev=sha.slice(0,12)
let html=readFileSync('dist/index.html','utf8')
const entries=[...html.matchAll(/<script\b[^>]*\bsrc="(\/peppercorn\/assets\/app-[\w-]+\.js)"/g)]
assert.equal(entries.length,1,'Expected one canonical hashed entry without a query string')
const entry=basename(entries[0][1])
assert(existsSync(`dist/assets/${entry}`),'Canonical entry must exist')

// Cached app.js and historical entry aliases must import the same module as lazy
// chunks. Copying the boot bundle, or adding a query to just the HTML entry,
// creates another ESM identity and mounts React twice when an editor/chart opens.
writeFileSync('dist/assets/app.js',`export * from './${entry}';\n`)
html=html.replace(/(\/peppercorn\/assets\/app\.css)(?:\?v=[a-f0-9]+)?"/g,`$1?v=${rev}"`)
writeFileSync('dist/index.html',html)
const sw=readFileSync('dist/sw.js','utf8')
assert(/const BUILD_REV = '(?:__BUILD_REV__|[a-f0-9]+)'/.test(sw),'Service worker revision missing')
writeFileSync('dist/sw.js',sw.replace(/const BUILD_REV = '(?:__BUILD_REV__|[a-f0-9]+)'/,`const BUILD_REV = '${rev}'`))
console.log(`Canonical entry ${entry}; compatible app.js; CSS and worker revision ${rev}`)
