import type {QuotePerson} from '../lib/dailyQuotes'
const names:Record<QuotePerson,string>={buffett:'워런 버핏',munger:'찰리 멍거',sagan:'칼 세이건',dawkins:'리처드 도킨스'}
/** Original monochrome pen-and-ink editorial vignettes; separate from Folio's locked identity artwork. */
export function QuotePortrait({person}:{person:QuotePerson}){
 const spectacles=person==='buffett'||person==='munger'
 const round=person==='munger'
 const sagan=person==='sagan'
 const dawkins=person==='dawkins'
 return <svg className={'home-quote-portrait portrait-'+person} viewBox="0 0 200 210" role="img" aria-label={names[person]+'의 펜 스케치 초상'} xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#312820" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
   <path d="M14 208 Q17 170 48 157 L73 148 L92 164 L112 165 L131 148 L159 157 Q184 169 190 208"/>
   <path d="M48 157 L70 181 L78 208 M158 158 L130 183 L121 208" strokeWidth="1.25"/>
   {!sagan&&<><path d="M83 148 L83 165 L101 187 L117 164 L117 147"/><path d="M85 162 L101 185 L115 161"/><path d="M100 184 L96 208 L106 208 L103 184"/></>}
   {sagan&&<><path d="M77 149 Q84 178 102 184 Q120 174 123 147"/><path d="M83 167 Q102 198 117 165 M90 180 Q99 197 110 181"/></>}
   <path d="M62 73 Q55 110 68 139 Q78 157 99 160 Q123 156 137 138 Q152 108 140 73" fill="#fbf7ee" fillOpacity=".32" strokeWidth="2"/>
   <path d="M63 101 Q53 88 54 110 Q54 125 67 128 M140 99 Q153 89 150 113 Q148 127 137 129"/>
   {person==='buffett'&&<>
    <path d="M61 79 Q47 51 63 39 Q77 25 93 30 Q114 18 130 34 Q148 36 147 69 L138 79 Q136 52 124 48 Q102 53 89 49 Q71 53 61 79" fill="#ddd2bf" fillOpacity=".5"/>
    <path d="M66 45 Q81 36 92 37 M98 33 Q119 28 130 39 M133 42 Q145 51 142 66"/>
   </>}
   {person==='munger'&&<>
    <path d="M62 82 Q55 60 63 43 Q67 27 83 22 Q108 12 126 31 Q145 46 144 79 M67 51 Q58 58 61 72 M129 29 Q143 43 144 58"/>
    <path d="M75 28 Q93 17 110 24 M119 28 Q135 36 138 47"/>
   </>}
   {sagan&&<>
    <path d="M63 88 Q42 64 54 47 Q47 23 70 22 Q83 7 101 18 Q124 7 140 28 Q158 38 150 60 Q160 73 143 89 L138 76 Q130 54 115 52 Q91 61 69 58 Z" fill="#4b4037" fillOpacity=".2"/>
    <path d="M51 48 L66 32 L73 22 M58 66 L63 43 L83 24 M82 31 Q108 14 125 29 M123 19 Q144 36 143 59 M138 37 L150 62"/>
   </>}
   {dawkins&&<>
    <path d="M61 82 Q44 53 60 33 Q76 20 89 27 Q118 13 133 31 Q152 39 147 67 L139 85 Q136 62 120 54 L78 57 Z" fill="#a39789" fillOpacity=".28"/>
    <path d="M54 47 Q68 27 88 32 M89 28 Q117 21 134 41 M130 30 Q144 42 147 62"/>
    <path d="M70 126 Q80 157 100 161 Q126 156 137 126" strokeDasharray="1 4" strokeWidth="3"/>
   </>}
   <path d="M72 89 Q82 84 91 89 M110 89 Q120 84 130 88" strokeWidth="2.2"/>
   {spectacles&&<g strokeWidth={round?'2.2':'1.6'}>
     {round?<><ellipse cx="81" cy="101" rx="19" ry="16"/><ellipse cx="121" cy="101" rx="19" ry="16"/></>:<><path d="M61 94 Q81 89 99 94 L98 109 Q83 121 69 109 Z"/><path d="M103 94 Q121 90 142 94 L135 109 Q120 122 104 109 Z"/></>}
     <path d="M99 99 Q101 96 104 99 M62 97 L55 94 M140 96 L149 93"/>
    </g>}
   <path d="M74 99 Q82 94 92 99 M110 99 Q120 94 129 98" strokeWidth="1.4"/>
   <path d="M80 100 L83 100 M119 99 L122 99" strokeWidth="2.6"/>
   <path d="M101 103 Q98 118 94 123 Q99 128 108 123"/>
   <path d="M84 137 Q100 144 119 136 M88 139 Q101 149 115 140"/>
   <path d="M69 119 L76 129 M132 118 L125 128 M77 146 Q84 151 89 151 M112 151 Q118 151 125 145" strokeWidth=".85"/>
   <path d="M72 112 L85 111 M116 110 L130 112 M80 130 L91 133 M111 133 L124 130" strokeWidth=".65" strokeOpacity=".55"/>
   {Array.from({length:7},(_,i)=><path key={'l'+i} d={`M${23+i*3} ${185+i*2} l15 -14`} strokeWidth=".55" strokeOpacity=".48"/>)}
   {Array.from({length:7},(_,i)=><path key={'r'+i} d={`M${158+i*3} ${171+i*4} l-13 17`} strokeWidth=".55" strokeOpacity=".48"/>)}
   {Array.from({length:5},(_,i)=><path key={'s'+i} d={`M${74+i*4} 120 l5 -3`} strokeWidth=".6" strokeOpacity=".36"/>)}
  </g>
 </svg>
}
