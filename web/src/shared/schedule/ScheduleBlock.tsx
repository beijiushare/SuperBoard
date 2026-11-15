import 'temporal-polyfill/global'
import {
  Calendar,
  type DateClickInfo,
  type EventChangeInfo,
  type EventClickInfo,
} from '@fullcalendar/react'
import themePlugin from '@fullcalendar/react/themes/forma'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import interactionPlugin from '@fullcalendar/react/interaction'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/forma/theme.css'
import '@fullcalendar/react/themes/forma/palettes/red.css'
import './schedule.css'
import type { SuperBoardScheduleEvent } from '../../canvas/model'

const PLUGINS = [
  themePlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
]

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

  function handleEventClick(info: EventClickInfo) {
    const event = info.event
    const title = window.prompt('编辑日程（留空删除）', event.title)
    if (title === null) return
    onEventsChange?.(
      title.trim()
        ? events.map((item) =>
            item.id === event.id ? { ...item, title: title.trim() } : item,
          )
        : events.filter((item) => item.id !== event.id),
    )
  }

  function handleEventChange(info: EventChangeInfo) {
    const event = info.event
    onEventsChange?.(
      events.map((item) =>
        item.id === event.id
          ? {
              ...item,
              start: event.startStr,
              end: event.endStr ?? item.end,
              allDay: event.allDay,
            }
          : item,
      ),
    )
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
        editable
        eventStartEditable
        eventDurationEditable
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventChange={handleEventChange}
      />
    </div>
  )
}
