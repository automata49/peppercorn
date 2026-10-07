import { useMemo } from 'react'
import { AllCommunityModule, themeQuartz, type ColDef, type CellValueChangedEvent, type CellClassParams } from 'ag-grid-community'
import { AgGridProvider, AgGridReact } from 'ag-grid-react'

const gridTheme = themeQuartz.withParams({
  backgroundColor:'#ffffff',
  foregroundColor:'#202938',
  headerBackgroundColor:'#eef2f7',
  headerTextColor:'#42526a',
  borderColor:'#dfe5ec',
  rowHoverColor:'#f7f9fc',
  accentColor:'#456a9e',
  fontSize:14,
  spacing:6
})

// Numeric values are right-aligned (CONTRACT UI rule). Tickers such as 005930 are identifiers, not numbers.
const isNumericCell=(p:CellClassParams<any>)=>{
  if(p.colDef.field==='ticker')return false
  const v=p.value
  // A missing value that a formatter renders as — sits where the number would.
  if(v==null||v==='')return !!p.colDef.valueFormatter
  if(typeof v==='number')return Number.isFinite(v)
  return typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))
}

type Props = { rows:any[]; columns:ColDef<any>[]; editable?:boolean; onChange?:(rows:any[])=>void; height?:number }

export function GridTable({rows,columns,editable=false,onChange,height=560}:Props){
  const defaults=useMemo<ColDef<any>>(()=>({sortable:true,filter:true,resizable:true,editable,minWidth:90,flex:1,cellClass:(p:CellClassParams<any>)=>isNumericCell(p)?'cell-num':undefined}),[editable])
  const changed=(event:CellValueChangedEvent<any>)=>{
    if(!onChange)return
    const next:any[]=[];event.api.forEachNode(n=>{if(n.data)next.push(n.data)});onChange(next)
  }
  return <AgGridProvider modules={[AllCommunityModule]}><div style={{height,width:'100%'}}><AgGridReact theme={gridTheme} rowData={rows} getRowClass={p=>p.data?.market==='KR'?'market-KR':p.data?.market==='US'?'market-US':'market-unknown'} columnDefs={columns} defaultColDef={defaults} pagination paginationPageSize={50} animateRows onCellValueChanged={changed}/></div></AgGridProvider>
}
