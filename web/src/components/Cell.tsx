import styles from './Cell.module.css'
import { CellState } from '../engine/types'

interface CellProps {
  value: number
  state: CellState
  onClick: () => void        // left-click: select / deselect
  onDisable: () => void      // right-click: disable / clear
}

export function Cell({ value, state, onClick, onDisable }: CellProps) {
  return (
    <div
      className={`${styles.cell} ${styles[state]}`}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onDisable() }}
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
