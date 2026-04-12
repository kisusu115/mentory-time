import { useState } from 'react'
import { buildGoogleCalendarUrl } from '../lib/calendar'
import type { NormalizedEntry } from '../lib/types'
import { useStore } from './store'

const calendarIconUrl = chrome.runtime.getURL('icons/google-calendar-icon.svg')

interface Props {
  entry: NormalizedEntry
  tabOrigin: string
}

export default function GoogleCalendarButton({ entry, tabOrigin }: Props) {
  const [fetching, setFetching] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFetching(true)
    try {
      const { locationCache, fetchLocation } = useStore.getState()
      if (locationCache[entry.qustnrSn] === undefined) {
        await fetchLocation(entry.qustnrSn)
      }
      const location = useStore.getState().locationCache[entry.qustnrSn] || undefined
      window.open(buildGoogleCalendarUrl(entry, tabOrigin, location), '_blank')
    } finally {
      setFetching(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={fetching}
      className="flex-shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
      title="구글 캘린더에 추가"
    >
      <img src={calendarIconUrl} alt="구글 캘린더에 추가" className="w-4 h-4" />
    </button>
  )
}
