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
  const { gcalAddedSet, markGcalAdded } = useStore()
  const isAdded = gcalAddedSet.has(entry.qustnrSn)

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
      await markGcalAdded(entry.qustnrSn)
    } finally {
      setFetching(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={fetching}
      className={`relative flex-shrink-0 -mt-1 p-1.5 transition-opacity ${
        fetching ? 'opacity-30' : isAdded ? 'opacity-25' : 'opacity-60 hover:opacity-100'
      }`}
      title={isAdded ? '구글 캘린더에 이미 추가됨 (클릭하면 재추가)' : '구글 캘린더에 추가'}
    >
      <img src={calendarIconUrl} alt="구글 캘린더에 추가" className="w-5 h-5" />
      {isAdded && !fetching && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 text-white text-[8px] rounded-full flex items-center justify-center leading-none">
          ✓
        </span>
      )}
    </button>
  )
}
