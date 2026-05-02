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
  '#245BFF', '#F79234', '#FA5CAE', '#10B981', '#42A5FF',
  '#7C3AED', '#EAB308', '#0F766E', '#EF4444', '#64748B',
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
      const styled = ds as typeof ds & {
        pointRadius?: number
        pointHoverRadius?: number
        tension?: number
        fill?: boolean
        borderRadius?: number
      }
      if (!ds.backgroundColor) {
        if (config.type === 'bar' || config.type === 'line') {
          styled.backgroundColor = config.type === 'line' ? PALETTE[i % PALETTE.length] + '18' : PALETTE[i % PALETTE.length] + 'B8'
          styled.borderColor = PALETTE[i % PALETTE.length]
          styled.borderWidth = config.type === 'line' ? 3 : 0
          styled.pointRadius = config.type === 'line' ? 4 : styled.pointRadius
          styled.pointHoverRadius = config.type === 'line' ? 6 : styled.pointHoverRadius
          styled.tension = config.type === 'line' ? 0.32 : styled.tension
          styled.fill = config.type === 'line' ? false : styled.fill
          styled.borderRadius = config.type === 'bar' ? 6 : styled.borderRadius
        } else {
          styled.backgroundColor = PALETTE.slice(0, (ds.data as unknown[]).length)
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
            labels: { color: '#475569', boxWidth: 10, boxHeight: 10, useBorderRadius: true, padding: 16 },
          },
          tooltip: {
            backgroundColor: '#07111F',
            padding: 10,
            titleColor: '#FFFFFF',
            bodyColor: '#E2E8F0',
            displayColors: true,
          },
          ...config.options?.plugins,
        },
        scales: config.type === 'pie' || config.type === 'doughnut'
          ? config.options?.scales
          : {
              x: {
                border: { color: 'rgba(15, 23, 42, 0.18)' },
                grid: { display: false },
                ticks: { color: '#64748b' },
              },
              y: {
                border: { display: false },
                grid: { color: 'rgba(148, 163, 184, 0.18)' },
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
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div style={{ height: 310, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
