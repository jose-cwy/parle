import { useMemo } from 'react'
import { motion } from 'framer-motion'

/**
 * Simple month view calendar that highlights dates with entries.
 * Expects `entriesByDate` map of yyyy-mm-dd -> array
 */
function formatLocalDateKey(date){
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CalendarView({ year, month, entriesByDate, onSelectDate }){
  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Journal map</p>
          <h4 className="mt-1 font-semibold text-lg">{monthLabel}</h4>
        </div>
        <div className="rounded-full bg-white/70 px-3 py-1 text-xs text-[#7a6756] shadow-sm">
          {Object.keys(entriesByDate).length} active days
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-sm mb-2 subtle">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      {weeks.map((row,ri)=> (
        <div key={ri} className="grid grid-cols-7 gap-2 mb-2">
          {row.map((cell,ci)=>{
            if(!cell) return <div key={ci} className="h-12"></div>
            const key = formatLocalDateKey(cell)
            const has = entriesByDate[key] && entriesByDate[key].length>0
            return (
              <motion.button
                key={ci}
                onClick={()=>onSelectDate(key)}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`calendar-day ${has ? 'calendar-day-active' : ''}`}
              >
                {cell.getDate()}
              </motion.button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
