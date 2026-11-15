import 'temporal-polyfill/global'
import { Calendar } from '@fullcalendar/react'
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

const BUTTONS = {
  add: {
    text: 'Add Event',
    click() {
      alert('handle add event...')
    },
  },
}

export function ScheduleBlock({
  events = [],
}: {
  events?: SuperBoardScheduleEvent[]
}) {
  return (
    <div className="sb-schedule">
      <Calendar
        colorScheme="light"
        plugins={PLUGINS}
        headerToolbar={HEADER_TOOLBAR}
        buttons={BUTTONS}
        initialView="timeGridWeek"
        height="100%"
        events={events}
      />
    </div>
  )
}
