/** Aviso para jugar en horizontal (se muestra solo en vertical, vía CSS). */
export function RotateDeviceHint() {
  return (
    <div className="rotate-hint">
      <div className="rotate-icon">⟳</div>
      <p>Gira el dispositivo para jugar en horizontal</p>
    </div>
  )
}
