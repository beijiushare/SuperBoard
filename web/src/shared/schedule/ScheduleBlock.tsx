import 'temporal-polyfill/global'
import { useState } from 'react'
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
import { InputDialog } from '../ui/InputDialog'

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

type ScheduleDialog =
  | { type: 'add'; start: Date }
  | { type: 'edit'; id: string; title: string }

export function ScheduleBlock({
  events = [],
  onEventsChange,
}: {
  events?: SuperBoardScheduleEvent[]
  onEventsChange?: (events: SuperBoardScheduleEvent[]) => void
}) {
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null)

  function openAddDialog(start = new Date()) {
    setDialog({ type: 'add', start })
  }

  function handleDateClick(info: DateClickInfo) {
    openAddDialog(new Date(info.dateStr))
  }

  function handleEventClick(info: EventClickInfo) {
    setDialog({
      type: 'edit',
      id: info.event.id,
      title: info.event.title,
    })
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

  function confirmDialog(value: string) {
    if (!dialog) return
    const title = value.trim()

    if (dialog.type === 'add') {
      if (!title) return
      const end = new Date(dialog.start.getTime() + 60 * 60 * 1000)
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`
      onEventsChange?.([
        ...events,
        {
          id,
          title,
          start: dialog.start.toISOString(),
          end: end.toISOString(),
        },
      ])
    } else if (title) {
      onEventsChange?.(
        events.map((item) =>
          item.id === dialog.id ? { ...item, title } : item,
        ),
      )
    } else {
      onEventsChange?.(events.filter((item) => item.id !== dialog.id))
    }

    setDialog(null)
  }

  const buttons = {
    add: {
      text: 'Add Event',
      click: () => openAddDialog(),
    },
  }

  return (
    <>
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
      {dialog ? (
        <InputDialog
          key={
            dialog.type === 'edit'
              ? `edit:${dialog.id}`
              : `add:${dialog.start.getTime()}`
          }
          title={dialog.type === 'add' ? '新建日程' : '编辑日程'}
          description={
            dialog.type === 'edit'
              ? '留空并保存会删除此日程'
              : undefined
          }
          initialValue={dialog.type === 'edit' ? dialog.title : ''}
          placeholder="日程名称"
          confirmText={dialog.type === 'add' ? '创建' : '保存'}
          allowEmpty={dialog.type === 'edit'}
          onConfirm={confirmDialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  )
}
