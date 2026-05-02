'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  DoughnutController,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from 'chart.js'

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement,
  PieController, ArcElement,
  DoughnutController,
  CategoryScale, LinearScale,
  Title, Tooltip, Legend
)

const PALETTE = [
  '#3478f6', '#22d3ee', '#10b981', '#8b5cf6', '#f59e0b',
  '#0ea5e9', '#14b8a6', '#6366f1', '#f472b6', '#84cc16',
]

interface Props {
  config: ChartConfiguration
}

export function ChartEmbed({ config }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Přiřadit barvy pokud chybí
    const datasets = config.data?.datasets ?? []
    datasets.forEach((ds, i) => {
      if (!ds.backgroundColor) {
        if (config.type === 'bar' || config.type === 'line') {
          ds.backgroundColor = PALETTE[i % PALETTE.length] + '99'
          ds.borderColor = PALETTE[i % PALETTE.length]
          ds.borderWidth = 2
        } else {
          ds.backgroundColor = PALETTE.slice(0, (ds.data as unknown[]).length)
        }
      }
    })

    chartRef.current = new Chart(canvasRef.current, {
      ...config,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#475569', boxWidth: 10, boxHeight: 10, useBorderRadius: true },
          },
          ...config.options?.plugins,
        },
        scales: config.type === 'pie' || config.type === 'doughnut'
          ? config.options?.scales
          : {
              x: {
                grid: { color: 'rgba(148, 163, 184, 0.16)' },
                ticks: { color: '#64748b' },
              },
              y: {
                grid: { color: 'rgba(148, 163, 184, 0.16)' },
                ticks: { color: '#64748b' },
              },
              ...config.options?.scales,
            },
        ...config.options,
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [config])

  return (
    <div className="mt-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-blue-950/5 backdrop-blur-xl">
      <div style={{ height: 280, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
