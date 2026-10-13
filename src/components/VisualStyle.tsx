import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
export type PhotoStyle='film'|'vivid'
const VisualStyleContext=createContext<{photoStyle:PhotoStyle;setPhotoStyle:(style:PhotoStyle)=>void}>({photoStyle:'film',setPhotoStyle:()=>{}})
export function VisualStyleProvider({children}:{children:ReactNode}){
 const [photoStyle,setPhotoStyle]=useState<PhotoStyle>(()=>{try{return localStorage.getItem('folio-photo-style')==='vivid'?'vivid':'film'}catch{return 'film'}})
 useEffect(()=>{document.documentElement.dataset.photoStyle=photoStyle;try{localStorage.setItem('folio-photo-style',photoStyle)}catch{}},[photoStyle])
 return <VisualStyleContext.Provider value={{photoStyle,setPhotoStyle}}>{children}</VisualStyleContext.Provider>
}
export const useVisualStyle=()=>useContext(VisualStyleContext)
export function coverPhoto(section:'today'|'discover'|'journal'|'journey',style:PhotoStyle){
 return `${import.meta.env.BASE_URL}folio-${style==='vivid'?'vivid':'retro'}-${section}.webp`
}
