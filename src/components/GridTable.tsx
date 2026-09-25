import { useMemo } from 'react'
import { AllCommunityModule, themeQuartz, type ColDef, type CellValueChangedEvent } from 'ag-grid-community'
import { AgGridProvider, AgGridReact } from 'ag-grid-react'

const gridTheme = themeQuartz.withParams({
  backgroundColor:'#111317',
  foregroundColor:'#e8eaed',
  headerBackgroundColor:'#16191f',
  headerTextColor:'#aeb6c2',
  borderColor:'#272b33',
  rowHoverColor:'#171b21',
  accentColor:'#c8a96b',
  fontSize:12,
  spacing:6
})

type Props = {
  rows: any[]
  columns: ColDef<any>[]
  editable?: boolean
  onChange?: (rows:any[])=>void
  height?: number
}

export function GridTable({rows,columns,editable=false,onChange,height=560}:Props){
  const defaults = useMemo<ColDef<any>>(()=>({
    sortable:true,filter:true,resizable:true,editable,minWidth:90,flex:1
  }),[editable])

  const changed = (event:CellValueChangedEvent<any>)=>{
    if(!onChange) return
    const next:any[]=[]
    event.api.forEachNode(n=>{if(n.data) next.push(n.data)})
    onChange(next)
  }

  return (
    <AgGridProvider modules={[AllCommunityModule]}>
      <div style={{height,width:'100%'}}>
        <AgGridReact
          theme={gridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaults}
          pagination
          paginationPageSize={50}
          animateRows
          onCellValueChanged={changed}
        />
      </div>
    </AgGridProvider>
  )
}
