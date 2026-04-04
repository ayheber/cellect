import { useRef } from 'react'
import styles from './Cell.module.css'
import { CellState } from '../engine/types'

interface CellProps {
  value: number
  state: CellState
  onClick: () => void
  onDisable: () => void
}

const LONG_PRESS_MS = 500

export function Cell({ value, state, onClick, onDisable }: CellProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  function startPress() {
    didLongPressRef.current = false
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      onDisable()
    }, LONG_PRESS_MS)
  }

  function cancelPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function handleClick() {
    if (didLongPressRef.current) return  // already handled by long press
    onClick()
  }

  return (
    <div
      className={`${styles.cell} ${styles[state]}`}
      onClick={handleClick}
      onContextMenu={e => { e.preventDefault(); onDisable() }}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      role="button"
      aria-label={`Cell value ${value}, ${state}`}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
        if (e.key === 'd' || e.key === 'D')     { e.preventDefault(); onDisable() }
      }}
    >
      {value}
    </div>
  )
}
