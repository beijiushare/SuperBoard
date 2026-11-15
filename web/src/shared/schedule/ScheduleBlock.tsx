import 'temporal-polyfill/global'
import { Calendar, type DateClickInfo } from '@fullcalendar/react'
import themePlugin from '@fullcalendar/react/themes/forma'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/forma/theme.css'
import '@fullcalendar/react/themes/forma/palettes/red.css'
import './schedule.css'
import type { SuperBoardScheduleEvent } from '../../canvas/model'

const PLUGINS = [themePlugin, timeGridPlugin, listPlugin]

const HEADER_TOOLBAR = {
  start: 'add today prev,next title',
  end: 'timeGridWeek,timeGridDay,listWeek',
}

export function ScheduleBlock({
  events = [],
  onEventsChange,
}: {
  events?: SuperBoardScheduleEvent[]
  onEventsChange?: (events: SuperBoardScheduleEvent[]) => void
}) {
  function addEvent(start = new Date()) {
    const title = window.prompt('日程名称')
    if (!title?.trim()) return
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`
    onEventsChange?.([
      ...events,
      {
        id,
        title: title.trim(),
        start: start.toISOString(),
        end: end.toISOString(),
      },
    ])
  }

  function handleDateClick(info: DateClickInfo) {
    addEvent(new Date(info.dateStr))
  }

  const buttons = {
    add: {
      text: 'Add Event',
      click: () => addEvent(),
    },
  }

  return (
    <div className="sb-schedule">
      <Calendar
        colorScheme="light"
        plugins={PLUGINS}
        headerToolbar={HEADER_TOOLBAR}
        buttons={buttons}
        initialView="timeGridWeek"
        height="100%"
        events={events}
        dateClick={handleDateClick}
      />
    </div>
  )
}
