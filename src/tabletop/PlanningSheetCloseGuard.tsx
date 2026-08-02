import { useEffect } from 'react'

export function PlanningSheetCloseGuard() {
  useEffect(() => {
    const keepSheetOpen = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLDialogElement) || !target.classList.contains('discussion-dialog')) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    document.addEventListener('click', keepSheetOpen, true)
    return () => document.removeEventListener('click', keepSheetOpen, true)
  }, [])

  return null
}
