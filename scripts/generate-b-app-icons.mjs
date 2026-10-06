import {existsSync,statSync} from 'node:fs'

const required=[
  'public/folio-brand-icon-black.webp',
  'public/folio-b-icon-180.png',
  'public/folio-b-icon-192.png',
  'public/folio-b-icon-512.png',
  'public/folio-b-icon-512-maskable.png',
]
for(const file of required){
  if(!existsSync(file))throw new Error('Missing supplied Folio icon asset: '+file)
  if(statSync(file).size<1024)throw new Error('Supplied Folio icon asset is unexpectedly small: '+file)
}
console.log('Using user-supplied Folio icon artwork; no procedural icon generation performed.')
