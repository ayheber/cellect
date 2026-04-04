import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import styles from './Grid.module.css'
import { Cell } from './Cell'
import { useGame } from '../hooks/useGame'

interface GridProps {
  game: ReturnType<typeof useGame>
}

export function Grid({ game }: GridProps) {
  const { puzzle, cellStates, toggleCell, toggleDisable, rowResults, colResults, opRevealed } = game
  const { grid, rowTargets, colTargets, n } = puzzle

  // Compute a fluid cell size that fills the viewport without overflow.
  // Layout columns per row: 1 row-label + n cells + 1 target + ~0.6 status = n + 2.2
  // Available width = viewport (capped at 520px) minus app + grid padding (≈ 60px)
  const cellSize = useMemo(() => {
    const available = Math.min(window.innerWidth, 520) - 60
    const gaps = (n + 2) * 6
    const cols = n + 2.2
    return Math.max(32, Math.min(52, Math.floor((available - gaps) / cols)))
  }, [n])

  const cs = cellSize
  const labelSize = Math.round(cs * 0.55)
  const statusSize = Math.round(cs * 0.58)

  const gridVars = {
    '--cell': `${cs}px`,
    '--label': `${labelSize}px`,
    '--status': `${statusSize}px`,
  } as CSSProperties

  function rowStatusIcon(r: number): string {
    if (!opRevealed) return ''
    const result = rowResults[r]
    if (result === null) return '?'
    return result === rowTargets[r] ? '✓' : '✗'
  }

  function rowStatusStyle(r: number): CSSProperties {
    if (!opRevealed) return {}
    const result = rowResults[r]
    if (result === null) return { color: '#aaa' }
    return result === rowTargets[r] ? { color: '#4CAF50' } : { color: '#f44336' }
  }

  function colStatusIcon(c: number): string {
    if (!opRevealed) return ''
    const result = colResults[c]
    if (result === null) return '?'
    return result === colTargets[c] ? '✓' : '✗'
  }

  function colStatusStyle(c: number): CSSProperties {
    if (!opRevealed) return {}
    const result = colResults[c]
    if (result === null) return { color: '#aaa' }
    return result === colTargets[c] ? { color: '#4CAF50' } : { color: '#f44336' }
  }

  return (
    <div className={styles.grid} style={gridVars}>
      {/* Column headers */}
      <div className={styles.headerRow}>
        <div className={styles.rowHeaderSpacer} />
        {Array.from({ length: n }, (_, c) => (
          <div key={c} className={styles.colHeader}>
            C{c + 1}
          </div>
        ))}
        <div className={styles.colTargetHeaderSpacer} />
        {opRevealed && <div className={styles.colStatusSpacer} />}
      </div>

      {/* Data rows */}
      {grid.map((row, r) => (
        <div key={r} className={styles.row}>
          <div className={styles.rowLabel}>R{r + 1}</div>
          {row.map((value, c) => (
            <Cell
              key={c}
              value={value}
              state={cellStates[r]?.[c] ?? 'neutral'}
              onClick={() => toggleCell(r, c)}
              onDisable={() => toggleDisable(r, c)}
            />
          ))}
          <div className={styles.targetCell}>{rowTargets[r]}</div>
          {opRevealed && (
            <div className={styles.statusCell} style={rowStatusStyle(r)}>
              {rowStatusIcon(r)}
            </div>
          )}
        </div>
      ))}

      <div className={styles.separator} />

      {/* Column targets row */}
      <div className={styles.row}>
        <div className={styles.rowLabel} style={{ fontSize: '0.65rem', color: '#888' }}>
          TGT
        </div>
        {Array.from({ length: n }, (_, c) => (
          <div key={c} className={styles.targetCell}>
            {colTargets[c]}
          </div>
        ))}
        <div style={{ width: cs }} />
        {opRevealed && <div style={{ width: statusSize }} />}
      </div>

      {/* Column status row */}
      {opRevealed && (
        <div className={styles.row}>
          <div className={styles.rowLabel} />
          {Array.from({ length: n }, (_, c) => (
            <div key={c} className={styles.colStatusCell} style={colStatusStyle(c)}>
              {colStatusIcon(c)}
            </div>
          ))}
          <div style={{ width: cs }} />
          <div style={{ width: statusSize }} />
        </div>
      )}
    </div>
  )
}
