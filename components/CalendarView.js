import { useMemo } from 'react'

/**
 * Simple month view calendar that highlights dates with entries.
 * Expects `entriesByDate` map of yyyy-mm-dd -> array
 */
export default function CalendarView({ year, month, entriesByDate, onSelectDate }){
  const weeks = useMemo(()=>{
    const d = new Date(year, month, 1)
    const startDay = d.getDay()
    const daysInMonth = new Date(year, month+1,0).getDate()
    const cells = []
    for(let i=0;i<startDay;i++) cells.push(null)
    for(let day=1; day<=daysInMonth; day++) cells.push(new Date(year, month, day))
    while(cells.length%7 !==0) cells.push(null)
    const rows = []
    for(let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7))
    return rows
  },[year,month])

  return (
    <div className="card p-3">
      <div className="grid grid-cols-7 gap-2 text-sm mb-2 subtle">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      {weeks.map((row,ri)=> (
        <div key={ri} className="grid grid-cols-7 gap-2 mb-2">
          {row.map((cell,ci)=>{
            if(!cell) return <div key={ci} className="h-12"></div>
            const key = cell.toISOString().slice(0,10)
            const has = entriesByDate[key] && entriesByDate[key].length>0
            return (
              <button key={ci} onClick={()=>onSelectDate(key)} className={`h-12 rounded ${has? 'bg-beige-100':''} flex items-center justify-center`}>{cell.getDate()}</button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
