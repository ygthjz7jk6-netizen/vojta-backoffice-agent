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
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#6366f1',
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
          legend: { position: 'bottom' },
          ...config.options?.plugins,
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
    <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div style={{ height: 280, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
