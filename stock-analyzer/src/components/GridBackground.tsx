import { useEffect, useRef } from 'react'

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let offset = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      // Horizon point (vanishing point)
      const vx = w / 2
      const vy = h * 0.42

      // Grid color
      const gridColor = 'rgba(245, 197, 24, 0.18)'
      const gridColorBright = 'rgba(245, 197, 24, 0.35)'

      // Number of vertical lines
      const numV = 16
      const spread = w * 1.2

      // Draw vertical perspective lines
      for (let i = 0; i <= numV; i++) {
        const t = i / numV
        const x = w / 2 - spread / 2 + t * spread

        ctx.beginPath()
        ctx.moveTo(vx, vy)
        ctx.lineTo(x, h + 20)

        const isBright = i === 0 || i === numV || i === numV / 2
        ctx.strokeStyle = isBright ? gridColorBright : gridColor
        ctx.lineWidth = isBright ? 0.8 : 0.5
        ctx.stroke()
      }

      // Draw horizontal lines with perspective (moving)
      const numH = 18
      const speed = 0.4

      for (let i = 0; i < numH; i++) {
        // t goes from 0 (horizon) to 1 (bottom)
        // Use exponential spacing for perspective effect
        const rawT = ((i / numH) + (offset * speed / 100)) % 1
        const t = Math.pow(rawT, 2.2) // perspective curve

        if (t < 0.01) continue

        const y = vy + t * (h - vy + 20)

        // Calculate x extents at this y level
        const progress = (y - vy) / (h - vy)
        const xLeft = vx - progress * (spread / 2)
        const xRight = vx + progress * (spread / 2)

        const alpha = Math.min(t * 1.5, 0.25)
        ctx.beginPath()
        ctx.moveTo(xLeft, y)
        ctx.lineTo(xRight, y)
        ctx.strokeStyle = `rgba(245, 197, 24, ${alpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Horizon glow line
      const grad = ctx.createLinearGradient(0, vy, w, vy)
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(0.3, 'rgba(245,197,24,0.5)')
      grad.addColorStop(0.5, 'rgba(245,197,24,0.8)')
      grad.addColorStop(0.7, 'rgba(245,197,24,0.5)')
      grad.addColorStop(1, 'transparent')

      ctx.beginPath()
      ctx.moveTo(0, vy)
      ctx.lineTo(w, vy)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.2
      ctx.stroke()

      // Floating particles
      for (let i = 0; i < 40; i++) {
        const seed = i * 137.5
        const px = ((seed * 7.3 + offset * 0.3) % w + w) % w
        const py = ((seed * 3.7 + offset * 0.8 * (0.5 + (i % 3) * 0.3)) % h + h) % h
        const alpha = 0.2 + (Math.sin(offset * 0.05 + i) + 1) * 0.15
        const size = 1 + (i % 3) * 0.5

        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245, 197, 24, ${alpha})`
        ctx.fill()
      }

      offset += 1
      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}