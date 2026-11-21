import 'temporal-polyfill/global'
import { useState } from 'react'
import {
  Calendar,
  type EventChangeInfo,
  type EventClickInfo,
  type EventDisplayInfo,
} from '@fullcalendar/react'
import themePlugin from '@fullcalendar/react/themes/forma'
import zhCnLocale from '@fullcalendar/react/locales/zh-cn'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import interactionPlugin from '@fullcalendar/react/interaction'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/forma/theme.css'
import '@fullcalendar/react/themes/forma/palettes/red.css'
import './schedule.css'
import type { SuperBoardScheduleEvent } from '../../canvas/model'
import { useTranslation } from 'react-i18next'
import { getAppLanguage } from '../../i18n'
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

function currentScrollTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:00`
}

export function ScheduleBlock({
  events = [],
  onEventsChange,
}: {
  events?: SuperBoardScheduleEvent[]
  onEventsChange?: (events: SuperBoardScheduleEvent[]) => void
}) {
  const { t } = useTranslation(['editor', 'common'])
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [initialScrollTime] = useState(currentScrollTime)

  function openAddDialog(start = new Date(), end?: Date, allDay = false) {
    setDialog({ type: 'add', start, end, allDay })
  }

  function openEditDialog(id: string, title: string) {
    setSelectedEventId(id)
    setDialog({ type: 'edit', id, title })
  }

  function handleEventClick(info: EventClickInfo) {
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
  }

  function deleteEvent(id: string) {
    onEventsChange?.(events.filter((item) => item.id !== id))
    setSelectedEventId(null)
    setDialog(null)
  }

  const buttons = {
    add: {
      text: t('editor:schedule.newEvent'),
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
          locale={getAppLanguage() === 'en-US' ? 'en' : 'zh-cn'}
          locales={[zhCnLocale]}
          initialView="timeGridWeek"
          height="100%"
          scrollTime={initialScrollTime}
          nowIndicator
          events={events}
          editable
          eventStartEditable
          eventDurationEditable
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          eventClass={(arg: EventDisplayInfo) =>
            arg.event.id === selectedEventId
              ? 'sb-schedule-event-selected'
              : ''
          }
        />
      </div>
      {dialog ? (
        <InputDialog
          key={
            dialog.type === 'edit'
              ? `edit:${dialog.id}`
              : `add:${dialog.start.getTime()}:${dialog.end?.getTime() ?? ''}`
          }
          title={
            dialog.type === 'add'
              ? t('editor:schedule.newEvent')
              : t('editor:schedule.editEvent')
          }
          initialValue={dialog.type === 'edit' ? dialog.title : ''}
          placeholder={t('editor:schedule.eventName')}
          confirmText={
            dialog.type === 'add'
              ? t('editor:dialog.create')
              : t('editor:dialog.save')
          }
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
