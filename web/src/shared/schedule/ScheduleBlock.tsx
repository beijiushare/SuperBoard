import 'temporal-polyfill/global'
import { useRef, useState } from 'react'
import {
  Calendar,
  type CalendarRef,
  type DateSelectInfo,
  type DateUnselectInfo,
  type EventChangeInfo,
  type EventClickInfo,
  type EventDisplayInfo,
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
  | { type: 'add'; start: Date; end?: Date; allDay: boolean }
  | { type: 'edit'; id: string; title: string }

type Selection = {
  start: string
  end: string
  allDay: boolean
  x: number
  y: number
}

export function ScheduleBlock({
  events = [],
  onEventsChange,
}: {
  events?: SuperBoardScheduleEvent[]
  onEventsChange?: (events: SuperBoardScheduleEvent[]) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const calendarRef = useRef<CalendarRef | null>(null)
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  function openAddDialog(start = new Date(), end?: Date, allDay = false) {
    setDialog({ type: 'add', start, end, allDay })
  }

  function openEditDialog(id: string, title: string) {
    setSelectedEventId(id)
    setDialog({ type: 'edit', id, title })
  }

  function localPoint(clientX: number, clientY: number) {
    const host = hostRef.current
    const rect = host?.getBoundingClientRect()
    if (!host || !rect || rect.width === 0 || rect.height === 0) {
      return { x: 12, y: 12 }
    }
    return {
      x: (clientX - rect.left) * (host.clientWidth / rect.width),
      y: (clientY - rect.top) * (host.clientHeight / rect.height),
    }
  }

  function handleSelect(info: DateSelectInfo) {
    const fallback = info.jsEvent
      ? localPoint(info.jsEvent.clientX, info.jsEvent.clientY)
      : { x: 12, y: 12 }
    const next = {
      start: info.startStr,
      end: info.endStr,
      allDay: info.allDay,
      x: fallback.x,
      y: fallback.y,
    }
    setSelectedEventId(null)
    setSelection(next)
    requestAnimationFrame(() => {
      const host = hostRef.current
      const highlight = host?.querySelector<HTMLElement>('.fc-highlight')
      if (!host || !highlight) return
      const highlightRect = highlight.getBoundingClientRect()
      const point = localPoint(highlightRect.left + 6, highlightRect.top + 6)
      setSelection((current) =>
        current && current.start === next.start && current.end === next.end
          ? {
              ...current,
              x: Math.max(8, Math.min(point.x, host.clientWidth - 140)),
              y: Math.max(8, Math.min(point.y, host.clientHeight - 40)),
            }
          : current,
      )
    })
  }

  function handleUnselect(_info: DateUnselectInfo) {
    setSelection(null)
  }

  function handleEventClick(info: EventClickInfo) {
    setSelection(null)
    calendarRef.current?.getApi().unselect()
    if (info.jsEvent.detail >= 2) {
      openEditDialog(info.event.id, info.event.title)
      return
    }
    setSelectedEventId(info.event.id)
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
    if (!title) return

    if (dialog.type === 'add') {
      const end =
        dialog.end ?? new Date(dialog.start.getTime() + 60 * 60 * 1000)
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
          allDay: dialog.allDay,
        },
      ])
    } else {
      onEventsChange?.(
        events.map((item) =>
          item.id === dialog.id ? { ...item, title } : item,
        ),
      )
    }

    setDialog(null)
    setSelection(null)
    calendarRef.current?.getApi().unselect()
  }

  function deleteEvent(id: string) {
    onEventsChange?.(events.filter((item) => item.id !== id))
    setSelectedEventId(null)
    setDialog(null)
    calendarRef.current?.getApi().unselect()
  }

  const buttons = {
    add: {
      text: 'Add Event',
      click: () => {
        const start = selection ? new Date(selection.start) : new Date()
        const end = selection ? new Date(selection.end) : undefined
        openAddDialog(start, end, selection?.allDay ?? false)
      },
    },
  }

  return (
    <>
      <div ref={hostRef} className="sb-schedule">
        <Calendar
          ref={calendarRef}
          colorScheme="light"
          plugins={PLUGINS}
          headerToolbar={HEADER_TOOLBAR}
          buttons={buttons}
          initialView="timeGridWeek"
          height="100%"
          events={events}
          selectable
          unselectAuto
          unselectCancel=".sb-schedule-add-event"
          editable
          eventStartEditable
          eventDurationEditable
          select={handleSelect}
          unselect={handleUnselect}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          eventClass={(arg: EventDisplayInfo) =>
            arg.event.id === selectedEventId
              ? 'sb-schedule-event-selected'
              : ''
          }
        />
        {selection ? (
          <button
            type="button"
            className="sb-schedule-add-event"
            style={{ left: selection.x, top: selection.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              const start = new Date(selection.start)
              const end = new Date(selection.end)
              openAddDialog(start, end, selection.allDay)
              setSelection(null)
              calendarRef.current?.getApi().unselect()
            }}
          >
            + 新建日程
          </button>
        ) : null}
      </div>
      {dialog ? (
        <InputDialog
          key={
            dialog.type === 'edit'
              ? `edit:${dialog.id}`
              : `add:${dialog.start.getTime()}:${dialog.end?.getTime() ?? ''}`
          }
          title={dialog.type === 'add' ? '新建日程' : '编辑日程'}
          initialValue={dialog.type === 'edit' ? dialog.title : ''}
          placeholder="日程名称"
          confirmText={dialog.type === 'add' ? '创建' : '保存'}
          onDelete={
            dialog.type === 'edit'
              ? () => deleteEvent(dialog.id)
              : undefined
          }
          onConfirm={confirmDialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  )
}
