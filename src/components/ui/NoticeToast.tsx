import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'

/** Aviso breve y discreto ("+2 🪵") que se desvanece solo. */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!notice) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), 1600)
    return () => window.clearTimeout(id)
  }, [notice])

  if (!notice) return null
  return (
    <div key={notice.id} className={`notice ${notice.tone} ${visible ? 'show' : ''}`}>
      {notice.text}
    </div>
  )
}
