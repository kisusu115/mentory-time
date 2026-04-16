import { useEffect } from 'react'
import type { NormalizedEntry } from '../lib/types'
import { useStore } from './store'

const notionIconUrl = chrome.runtime.getURL('icons/notion-icon.svg')

interface Props {
  entry: NormalizedEntry
}

export default function NotionButton({ entry }: Props) {
  const { notionSettings, notionAddedSet, notionBusy, notionError, addToNotion } = useStore()

  useEffect(() => {
    if (notionError && notionBusy === null) {
      alert(notionError)
      useStore.setState({ notionError: null })
    }
  }, [notionError, notionBusy])

  if (!notionSettings) return null

  const isAdded = notionAddedSet.has(entry.qustnrSn)
  const isBusy = notionBusy === entry.qustnrSn

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBusy) return
    if (isAdded) {
      const ok = confirm('이미 추가된 항목입니다. 다시 추가할까요?')
      if (!ok) return
    }
    await addToNotion(entry)
  }

  return (
    <button
      onClick={handleClick}
      disabled={isBusy}
      className={`relative flex-shrink-0 -mt-1 p-1.5 transition-opacity ${
        isBusy ? 'opacity-30' : isAdded ? 'opacity-25' : 'opacity-70 hover:opacity-100'
      }`}
      title={isAdded ? 'Notion에 이미 추가됨 (클릭하면 재추가)' : 'Notion에 추가'}
    >
      {isBusy ? (
        <span className="block w-5 h-5 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
      ) : (
        <img src={notionIconUrl} alt="Notion에 추가" className="w-5 h-5" />
      )}
      {isAdded && !isBusy && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 text-white text-[8px] rounded-full flex items-center justify-center leading-none">
          ✓
        </span>
      )}
    </button>
  )
}
