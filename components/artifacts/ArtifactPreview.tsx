'use client'

import { useMemo, useState } from 'react'
import { Download, Eye, Moon, RefreshCcw, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { randomizeArtifact, randomizeDeck, sampleArtifacts, sampleDecks } from '@/lib/artifacts/samples'
import { artifactPalettes, artifactSeries } from '@/lib/artifacts/theme'
import type { ArtifactBlock, ArtifactDeck, ArtifactSpec, ChartBlock, KpiItem } from '@/lib/artifacts/types'

type PreviewTheme = 'light' | 'dark'

function toneClass(tone: KpiItem['tone'] | undefined, theme: PreviewTheme) {
  const dark = theme === 'dark'
  if (tone === 'good') return dark ? 'text-emerald-300' : 'text-emerald-600'
  if (tone === 'warning') return dark ? 'text-amber-300' : 'text-amber-600'
  if (tone === 'bad') return dark ? 'text-rose-300' : 'text-rose-600'
  if (tone === 'accent') return dark ? 'text-cyan-200' : 'text-blue-600'
  return dark ? 'text-slate-100' : 'text-slate-950'
}

function ArtifactShell({ spec, theme }: { spec: ArtifactSpec; theme: PreviewTheme }) {
  const isDark = theme === 'dark'

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[2rem] border p-4 shadow-2xl sm:p-5',
        isDark
          ? 'border-white/10 bg-[#050607] text-slate-50 shadow-black/30'
          : 'border-sky-100 bg-white text-slate-950 shadow-blue-950/10'
      )}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDark ? 'text-cyan-200/70' : 'text-blue-600')}>
            {spec.subtitle ?? 'Artifact preview'}
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">{spec.title}</h2>
          {spec.description && (
            <p className={cn('mt-2 max-w-2xl text-sm leading-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {spec.description}
            </p>
          )}
        </div>
        <div className={cn('rounded-full border px-3 py-1 text-xs font-semibold', isDark ? 'border-white/10 text-slate-300' : 'border-sky-100 text-slate-500')}>
          {theme}
        </div>
      </header>

      <div className="grid gap-3">
        {spec.blocks.map((block, index) => (
          <ArtifactBlockView key={`${block.type}-${index}`} block={block} theme={theme} />
        ))}
      </div>

      {spec.sources && spec.sources.length > 0 && (
        <footer className={cn('mt-4 flex flex-wrap gap-2 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
          {spec.sources.map(source => (
            <span key={`${source.label}-${source.detail}`} className={cn('rounded-full border px-2.5 py-1', isDark ? 'border-white/10' : 'border-sky-100')}>
              {source.label}{source.detail ? ` / ${source.detail}` : ''}
            </span>
          ))}
        </footer>
      )}
    </article>
  )
}

function findBlock<T extends ArtifactBlock['type']>(spec: ArtifactSpec, type: T): Extract<ArtifactBlock, { type: T }> | undefined {
  return spec.blocks.find((block): block is Extract<ArtifactBlock, { type: T }> => block.type === type)
}

function SlideCanvas({ spec, theme, index }: { spec: ArtifactSpec; theme: PreviewTheme; index: number }) {
  const isDark = theme === 'dark'
  const layout = spec.layout ?? 'summary'
  const kpi = findBlock(spec, 'kpi')
  const chart = findBlock(spec, 'chart')
  const table = findBlock(spec, 'table')
  const text = findBlock(spec, 'text')
  const insight = findBlock(spec, 'insight')

  return (
    <article
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-[1.35rem] border p-[4.8%] shadow-2xl',
        isDark
          ? 'border-black bg-[#050607] text-slate-50 shadow-black/30'
          : 'border-slate-950/10 bg-[#f7fbff] text-slate-950 shadow-blue-950/10'
      )}
    >
      <div className={cn('absolute inset-0 pointer-events-none', isDark ? 'bg-[radial-gradient(circle_at_85%_10%,rgba(103,232,249,0.16),transparent_26rem)]' : 'bg-[radial-gradient(circle_at_86%_12%,rgba(47,125,246,0.13),transparent_24rem)]')} />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className={cn('text-[clamp(9px,1.05vw,13px)] font-semibold uppercase tracking-[0.16em]', isDark ? 'text-cyan-200/70' : 'text-blue-600')}>
              {spec.subtitle ?? `Slide ${index + 1}`}
            </p>
            <h2 className={cn(
              'mt-[1.6%] max-w-[78%] font-semibold leading-[0.96] tracking-normal',
              layout === 'cover' ? 'text-[clamp(42px,7vw,96px)]' : 'text-[clamp(25px,4.3vw,58px)]'
            )}>
              {spec.title}
            </h2>
          </div>
          <span className={cn('rounded-full border px-3 py-1 text-[clamp(8px,0.85vw,11px)] font-semibold', isDark ? 'border-white/10 text-slate-400' : 'border-slate-950/10 text-slate-500')}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </header>

        {layout === 'cover' ? (
          <div className="mt-auto grid grid-cols-[1fr_0.65fr] gap-[5%] pb-[1%]">
            <p className={cn('max-w-xl text-[clamp(13px,1.45vw,20px)] leading-snug', isDark ? 'text-slate-300' : 'text-slate-600')}>{spec.description}</p>
            {kpi && <SlideKpis items={kpi.items.slice(0, 2)} theme={theme} compact />}
          </div>
        ) : layout === 'big-number' ? (
          <div className="grid flex-1 grid-cols-[0.82fr_1fr] items-end gap-[5%] pt-[4%]">
            <div>
              <p className="text-[clamp(56px,12vw,148px)] font-semibold leading-none tracking-normal">{kpi?.items[0]?.value ?? '42'}</p>
              <p className={cn('mt-4 text-[clamp(12px,1.4vw,18px)] leading-snug', isDark ? 'text-slate-300' : 'text-slate-600')}>{insight?.text ?? spec.description}</p>
            </div>
            {chart ? <SlideChart block={chart} theme={theme} /> : text ? <SlideBullets block={text} theme={theme} /> : null}
          </div>
        ) : layout === 'chart-focus' ? (
          <div className="grid flex-1 grid-cols-[1.35fr_0.65fr] gap-[4%] pt-[3%]">
            {chart && <SlideChart block={chart} theme={theme} large />}
            <div className="flex flex-col gap-[4%]">
              {insight && <SlideInsight block={insight} theme={theme} />}
              {text && <SlideBullets block={text} theme={theme} />}
            </div>
          </div>
        ) : layout === 'table-focus' ? (
          <div className="grid flex-1 grid-cols-[1.2fr_0.65fr] gap-[4%] pt-[3%]">
            {table && <SlideTable block={table} theme={theme} />}
            <div className="flex flex-col gap-[4%]">
              {text && <SlideBullets block={text} theme={theme} />}
              {insight && <SlideInsight block={insight} theme={theme} />}
            </div>
          </div>
        ) : layout === 'timeline' ? (
          <div className="flex flex-1 items-end pt-[4%]">
            {text && <SlideTimeline block={text} theme={theme} />}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-[1fr_0.82fr] gap-[4%] pt-[4%]">
            {kpi && <SlideKpis items={kpi.items} theme={theme} />}
            <div className="flex flex-col gap-[4%]">
              {insight && <SlideInsight block={insight} theme={theme} />}
              {text && <SlideBullets block={text} theme={theme} />}
            </div>
          </div>
        )}

        <footer className={cn('relative z-10 mt-auto flex items-center justify-between pt-[2%] text-[clamp(7px,0.8vw,10px)]', isDark ? 'text-slate-600' : 'text-slate-400')}>
          <span>Back Office Agent</span>
          <span>{spec.sources?.[0]?.label ?? 'artifact lab'}</span>
        </footer>
      </div>
    </article>
  )
}

function SlidePanel({ children, theme, className }: { children: React.ReactNode; theme: PreviewTheme; className?: string }) {
  return (
    <div className={cn('h-full rounded-[1rem] border p-[4%]', theme === 'dark' ? 'border-white/10 bg-white/[0.045]' : 'border-sky-100 bg-white/75', className)}>
      {children}
    </div>
  )
}

function SlideKpis({ items, theme, compact }: { items: KpiItem[]; theme: PreviewTheme; compact?: boolean }) {
  return (
    <div className={cn('grid gap-[3%]', compact ? 'grid-cols-2' : 'grid-cols-2')}>
      {items.slice(0, compact ? 2 : 4).map(item => (
        <SlidePanel key={item.label} theme={theme}>
          <p className={cn('text-[clamp(8px,0.95vw,12px)]', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>{item.label}</p>
          <p className={cn('mt-[8%] text-[clamp(25px,4.2vw,58px)] font-semibold leading-none', toneClass(item.tone, theme))}>{item.value}</p>
          {item.delta && <p className={cn('mt-[6%] text-[clamp(8px,0.9vw,12px)] font-semibold', toneClass(item.tone, theme))}>{item.delta}</p>}
        </SlidePanel>
      ))}
    </div>
  )
}

function SlideChart({ block, theme, large }: { block: ChartBlock; theme: PreviewTheme; large?: boolean }) {
  return (
    <SlidePanel theme={theme} className="min-h-0">
      <p className={cn('mb-[2%] text-[clamp(10px,1.1vw,15px)] font-semibold', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>{block.title}</p>
      <div className={large ? 'h-[82%]' : 'h-[76%]'}>
        {block.kind === 'dotMatrix' ? <DotMatrixChart block={block} theme={theme} /> : block.kind === 'donut' ? <DonutChart block={block} theme={theme} /> : <BarLineChart block={block} theme={theme} />}
      </div>
    </SlidePanel>
  )
}

function SlideInsight({ block, theme }: { block: Extract<ArtifactBlock, { type: 'insight' }>; theme: PreviewTheme }) {
  return (
    <SlidePanel theme={theme} className={cn(theme === 'dark' ? 'bg-cyan-300/10' : 'bg-blue-100/80')}>
      <p className={cn('text-[clamp(15px,2.05vw,28px)] font-semibold leading-tight', toneClass(block.tone, theme))}>{block.text}</p>
    </SlidePanel>
  )
}

function SlideBullets({ block, theme }: { block: Extract<ArtifactBlock, { type: 'text' }>; theme: PreviewTheme }) {
  return (
    <SlidePanel theme={theme}>
      <p className="text-[clamp(11px,1.2vw,16px)] font-semibold">{block.title}</p>
      <ul className={cn('mt-[6%] space-y-[5%] text-[clamp(10px,1.15vw,15px)] leading-snug', theme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
        {block.bullets.slice(0, 5).map(bullet => <li key={bullet}>{bullet}</li>)}
      </ul>
    </SlidePanel>
  )
}

function SlideTable({ block, theme }: { block: Extract<ArtifactBlock, { type: 'table' }>; theme: PreviewTheme }) {
  return (
    <SlidePanel theme={theme}>
      <p className="mb-[3%] text-[clamp(10px,1.1vw,15px)] font-semibold">{block.title}</p>
      <table className="w-full table-fixed text-left text-[clamp(7px,0.86vw,11px)]">
        <thead>
          <tr className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>
            {block.headers.slice(0, 5).map(header => <th key={header} className="border-b border-current/20 py-[1.5%] pr-2 font-semibold">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {block.rows.slice(0, 6).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {block.headers.slice(0, 5).map((header, cellIndex) => (
                <td key={`${header}-${cellIndex}`} className={cn('border-b py-[2%] pr-2', theme === 'dark' ? 'border-white/10 text-slate-200' : 'border-sky-100 text-slate-700')}>
                  <span className="line-clamp-2">{row[cellIndex] ?? ''}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SlidePanel>
  )
}

function SlideTimeline({ block, theme }: { block: Extract<ArtifactBlock, { type: 'text' }>; theme: PreviewTheme }) {
  return (
    <div className="grid w-full grid-cols-4 gap-[2%]">
      {block.bullets.slice(0, 4).map((bullet, index) => (
        <div key={bullet} className="relative">
          <div className={cn('mb-[8%] h-px w-full', theme === 'dark' ? 'bg-white/20' : 'bg-slate-950/15')} />
          <span className={cn('absolute -top-2 left-0 size-4 rounded-full', theme === 'dark' ? 'bg-cyan-200' : 'bg-blue-600')} />
          <p className="text-[clamp(14px,1.6vw,22px)] font-semibold leading-tight">0{index + 1}</p>
          <p className={cn('mt-[8%] text-[clamp(10px,1.05vw,14px)] leading-snug', theme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>{bullet}</p>
        </div>
      ))}
    </div>
  )
}

function DeckShell({ deck, theme }: { deck: ArtifactDeck; theme: PreviewTheme }) {
  const isDark = theme === 'dark'

  return (
    <section className="space-y-5">
      <div
        className={cn(
          'overflow-hidden rounded-[2rem] border p-6 shadow-2xl',
          isDark
            ? 'border-white/10 bg-[#050607] text-slate-50 shadow-black/30'
            : 'border-sky-100 bg-white text-slate-950 shadow-blue-950/10'
        )}
      >
        <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDark ? 'text-cyan-200/70' : 'text-blue-600')}>
          {deck.subtitle ?? 'Presentation deck'}
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">{deck.title}</h2>
            {deck.description && (
              <p className={cn('mt-4 max-w-2xl text-sm leading-6', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {deck.description}
              </p>
            )}
          </div>
          <div className={cn('rounded-[1.25rem] border p-4', isDark ? 'border-white/10 bg-white/[0.035]' : 'border-sky-100 bg-sky-50/70')}>
            <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>Obsah prezentace</p>
            <div className="mt-3 grid gap-2">
              {deck.slides.map((slide, index) => (
                <div key={slide.title} className="flex items-center gap-3 text-sm">
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', isDark ? 'bg-white/10 text-slate-200' : 'bg-white text-slate-700')}>
                    {index + 1}
                  </span>
                  <span className="truncate">{slide.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SlideCanvas
        spec={{
          title: deck.title,
          subtitle: deck.subtitle,
          description: deck.description,
          layout: 'cover',
          blocks: deck.slides[0]?.blocks ?? [],
          sources: deck.sources,
        }}
        theme={theme}
        index={0}
      />

      {deck.slides.map((slide, index) => (
        <div key={`${slide.title}-${index}`} className="grid gap-2">
          <p className={cn('px-2 text-xs font-semibold uppercase tracking-[0.16em]', isDark ? 'text-slate-500' : 'text-slate-400')}>
            Slide {index + 2}
          </p>
          <SlideCanvas spec={slide} theme={theme} index={index + 1} />
        </div>
      ))}
    </section>
  )
}

function ArtifactBlockView({ block, theme }: { block: ArtifactBlock; theme: PreviewTheme }) {
  if (block.type === 'kpi') return <KpiBlockView block={block} theme={theme} />
  if (block.type === 'chart') return <ChartBlockView block={block} theme={theme} />
  if (block.type === 'table') return <TableBlockView block={block} theme={theme} />
  if (block.type === 'text') return <TextBlockView block={block} theme={theme} />
  return <InsightBlockView block={block} theme={theme} />
}

function Panel({ children, title, theme, className }: { children: React.ReactNode; title?: string; theme: PreviewTheme; className?: string }) {
  const isDark = theme === 'dark'
  return (
    <section
      className={cn(
        'rounded-[1.35rem] border p-4',
        isDark ? 'border-white/10 bg-white/[0.035]' : 'border-sky-100 bg-sky-50/55',
        className
      )}
    >
      {title && <h3 className={cn('mb-3 text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-700')}>{title}</h3>}
      {children}
    </section>
  )
}

function KpiBlockView({ block, theme }: { block: Extract<ArtifactBlock, { type: 'kpi' }>; theme: PreviewTheme }) {
  return (
    <Panel title={block.title} theme={theme}>
      <div className="grid gap-2 sm:grid-cols-3">
        {block.items.slice(0, 6).map(item => (
          <div
            key={item.label}
            className={cn(
              'min-h-28 rounded-[1rem] border p-4',
              theme === 'dark' ? 'border-white/10 bg-black/35' : 'border-white bg-white/80'
            )}
          >
            <p className={cn('text-xs', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>{item.label}</p>
            <p className={cn('mt-4 text-3xl font-semibold tracking-normal', toneClass(item.tone, theme))}>{item.value}</p>
            {item.delta && <p className={cn('mt-2 text-xs font-semibold', toneClass(item.tone, theme))}>{item.delta}</p>}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ChartBlockView({ block, theme }: { block: ChartBlock; theme: PreviewTheme }) {
  if (block.kind === 'dotMatrix') {
    return (
      <Panel title={block.title} theme={theme}>
        <DotMatrixChart block={block} theme={theme} />
      </Panel>
    )
  }

  if (block.kind === 'donut') {
    return (
      <Panel title={block.title} theme={theme}>
        <DonutChart block={block} theme={theme} />
      </Panel>
    )
  }

  return (
    <Panel title={block.title} theme={theme}>
      <BarLineChart block={block} theme={theme} />
    </Panel>
  )
}

function BarLineChart({ block, theme }: { block: ChartBlock; theme: PreviewTheme }) {
  const palette = artifactPalettes[theme]
  const series = artifactSeries[theme]
  const values = block.datasets[0]?.data ?? []
  const max = Math.max(...values, 1)
  const points = values.map((value, index) => {
    const x = 32 + index * (336 / Math.max(values.length - 1, 1))
    const y = 168 - (value / max) * 126
    return { x, y, value }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? 368} 176 L ${points[0]?.x ?? 32} 176 Z`

  return (
    <div className="h-64">
      <svg viewBox="0 0 400 220" className="h-full w-full overflow-visible">
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1="28" x2="376" y1={48 + i * 42} y2={48 + i * 42} stroke={palette.grid} strokeWidth="1" opacity="0.72" />
        ))}
        {block.kind === 'area' && <path d={areaPath} fill={series[1]} opacity={theme === 'dark' ? 0.22 : 0.16} />}
        {(block.kind === 'line' || block.kind === 'area') ? (
          <>
            <path d={path} fill="none" stroke={series[0]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map(point => (
              <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="4.5" fill={series[0]} />
            ))}
          </>
        ) : (
          points.map((point, index) => {
            const barH = 176 - point.y
            return (
              <g key={block.labels[index]}>
                <rect x={point.x - 15} y={point.y} width="30" height={barH} rx="7" fill={series[index % series.length]} />
                <text x={point.x} y={point.y - 8} textAnchor="middle" fontSize="11" fill={palette.muted}>{point.value}</text>
              </g>
            )
          })
        )}
        {block.labels.map((label, index) => (
          <text key={label} x={32 + index * (336 / Math.max(block.labels.length - 1, 1))} y="205" textAnchor="middle" fontSize="10" fill={palette.muted}>
            {label.length > 12 ? `${label.slice(0, 11)}...` : label}
          </text>
        ))}
      </svg>
    </div>
  )
}

function DotMatrixChart({ block, theme }: { block: ChartBlock; theme: PreviewTheme }) {
  const palette = artifactPalettes[theme]
  const values = block.datasets[0]?.data ?? []
  const max = Math.max(...values, 1)
  const rows = 12
  const columnsPerValue = 4

  return (
    <div>
      <div
        className="grid gap-[5px]"
        style={{ gridTemplateColumns: `repeat(${values.length * columnsPerValue}, minmax(0, 1fr))` }}
      >
        {values.flatMap((value, valueIndex) => {
          const activeRows = Math.max(1, Math.round((value / max) * rows))
          return Array.from({ length: columnsPerValue * rows }, (_, index) => {
            const row = Math.floor(index / columnsPerValue)
            const active = rows - row <= activeRows
            return (
              <span
                key={`${valueIndex}-${index}`}
                className="aspect-square rounded-[35%]"
                style={{ backgroundColor: active ? palette.dot : palette.fadedDot }}
              />
            )
          })
        })}
      </div>
      <div className={cn('mt-4 grid gap-2 text-xs', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')} style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {block.labels.map((label, index) => (
          <div key={label} className="min-w-0 text-center">
            <p className="truncate">{label}</p>
            <p className={cn('mt-1 font-semibold', theme === 'dark' ? 'text-slate-100' : 'text-slate-900')}>
              {values[index]}{block.unit ? ` ${block.unit}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ block, theme }: { block: ChartBlock; theme: PreviewTheme }) {
  const palette = artifactPalettes[theme]
  const series = artifactSeries[theme]
  const values = block.datasets[0]?.data ?? []
  const total = values.reduce((sum, value) => sum + value, 0) || 1
  const gradient = values.map((value, index) => {
    const start = values.slice(0, index).reduce((sum, item) => sum + (item / total) * 100, 0)
    const end = start + (value / total) * 100
    return `${series[index % series.length]} ${start}% ${end}%`
  }).join(', ')

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto size-44 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className={cn('absolute inset-8 rounded-full', theme === 'dark' ? 'bg-[#080a0c]' : 'bg-white')} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold">{total}</p>
          <p className="text-xs" style={{ color: palette.muted }}>{block.unit ?? 'celkem'}</p>
        </div>
      </div>
      <div className="grid flex-1 gap-2">
        {block.labels.map((label, index) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: series[index % series.length] }} />
              <span className="truncate">{label}</span>
            </span>
            <span className="font-semibold">{values[index]}{block.unit ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TableBlockView({ block, theme }: { block: Extract<ArtifactBlock, { type: 'table' }>; theme: PreviewTheme }) {
  const isDark = theme === 'dark'
  return (
    <Panel title={block.title} theme={theme}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {block.headers.map(header => (
                <th key={header} className={cn('border-b px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]', isDark ? 'border-white/10 text-slate-400' : 'border-sky-100 text-slate-500')}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.slice(0, 8).map((row, rowIndex) => (
              <tr key={rowIndex} className={cn(rowIndex % 2 === 0 ? (isDark ? 'bg-white/[0.025]' : 'bg-white/60') : '')}>
                {block.headers.map((header, cellIndex) => (
                  <td key={`${header}-${cellIndex}`} className={cn('border-b px-3 py-2.5', isDark ? 'border-white/10 text-slate-200' : 'border-sky-100 text-slate-700')}>
                    {row[cellIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function TextBlockView({ block, theme }: { block: Extract<ArtifactBlock, { type: 'text' }>; theme: PreviewTheme }) {
  return (
    <Panel title={block.title} theme={theme}>
      <ul className={cn('space-y-2 text-sm leading-6', theme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
        {block.bullets.map(bullet => (
          <li key={bullet} className="flex gap-2">
            <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', theme === 'dark' ? 'bg-cyan-200' : 'bg-blue-600')} />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function InsightBlockView({ block, theme }: { block: Extract<ArtifactBlock, { type: 'insight' }>; theme: PreviewTheme }) {
  return (
    <Panel title={block.title} theme={theme} className={cn(theme === 'dark' ? 'bg-cyan-300/10' : 'bg-blue-100/70')}>
      <p className={cn('text-sm leading-6', toneClass(block.tone, theme))}>{block.text}</p>
    </Panel>
  )
}

export function ArtifactLab() {
  const [theme, setTheme] = useState<PreviewTheme>('light')
  const [selectedKey, setSelectedKey] = useState('deck-0')
  const [seed, setSeed] = useState(0)
  const [showRenderedPreview, setShowRenderedPreview] = useState(false)

  const items = useMemo(() => [
    ...sampleDecks.map((deck, index) => ({ key: `deck-${index}`, label: deck.subtitle ?? deck.title, kind: 'deck' as const, value: deck })),
    ...sampleArtifacts.map((artifact, index) => ({ key: `artifact-${index}`, label: artifact.subtitle ?? artifact.title, kind: 'artifact' as const, value: artifact })),
  ], [])
  const selectedItem = items.find(item => item.key === selectedKey) ?? items[0]
  const selectedIndex = Number(selectedItem.key.split('-')[1] ?? '0')
  const downloadHref = `/api/artifact-lab/pptx?kind=${selectedItem.kind}&index=${selectedIndex}&theme=${theme}`
  const renderedPreviewHref = `/api/artifact-lab/preview?kind=${selectedItem.kind}&index=${selectedIndex}&theme=${theme}`
  const artifact = useMemo(() => {
    if (selectedItem.kind === 'deck') return seed === 0 ? selectedItem.value : randomizeDeck(selectedItem.value)
    return seed === 0 ? selectedItem.value : randomizeArtifact(selectedItem.value)
  }, [selectedItem, seed])

  return (
    <main className={cn('min-h-screen px-4 py-6 sm:px-6 lg:px-8', theme === 'dark' ? 'bg-[#0b0d10]' : 'bg-[#eef7ff]')}>
      <div className="mx-auto max-w-6xl">
        <div className={cn('mb-5 rounded-[1.5rem] border p-4 shadow-xl', theme === 'dark' ? 'border-white/10 bg-black/40 text-white shadow-black/20' : 'border-white/70 bg-white/80 text-slate-950 shadow-blue-950/10')}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', theme === 'dark' ? 'text-cyan-200/70' : 'text-blue-600')}>Artifact lab</p>
              <h1 className="mt-2 text-2xl font-semibold">Lokalni test grafu, tabulek a prezentaci</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={theme === 'dark' ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : ''}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === 'dark' ? 'Svetla' : 'Tmava'}
              </Button>
              <Button variant="outline" onClick={() => setSeed(value => value + 1)} className={theme === 'dark' ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : ''}>
                <RefreshCcw className="size-4" />
                Randomize
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRenderedPreview(value => !value)}
                className={theme === 'dark' ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : ''}
              >
                <Eye className="size-4" />
                {showRenderedPreview ? 'Schovat render' : 'Render PDF'}
              </Button>
              <a
                href={downloadHref}
                download
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-2.5 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all hover:brightness-105"
              >
                <Download className="size-4" />
                PPTX
              </a>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {items.map(item => (
              <button
                key={item.key}
                onClick={() => { setSelectedKey(item.key); setSeed(0) }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                  selectedKey === item.key
                    ? theme === 'dark' ? 'border-cyan-200 bg-cyan-200 text-slate-950' : 'border-blue-600 bg-blue-600 text-white'
                    : theme === 'dark' ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-sky-100 text-slate-600 hover:bg-white'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {showRenderedPreview && (
          <section className={cn('mb-5 overflow-hidden rounded-[1.5rem] border shadow-xl', theme === 'dark' ? 'border-white/10 bg-black/40 shadow-black/20' : 'border-white/70 bg-white/80 shadow-blue-950/10')}>
            <div className={cn('flex items-center justify-between border-b px-4 py-3', theme === 'dark' ? 'border-white/10 text-white' : 'border-sky-100 text-slate-950')}>
              <div>
                <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', theme === 'dark' ? 'text-cyan-200/70' : 'text-blue-600')}>Rendered PPTX preview</p>
                <p className={cn('mt-1 text-sm', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>Skutečný render přes LibreOffice z generovaného PPTX, zobrazený jako obrázky slidů.</p>
              </div>
              <a href={`${renderedPreviewHref}&format=pdf`} target="_blank" rel="noopener noreferrer" className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold', theme === 'dark' ? 'border-white/10 text-slate-200 hover:bg-white/10' : 'border-sky-100 text-slate-600 hover:bg-white')}>
                Otevrit PDF
              </a>
            </div>
            <iframe
              key={renderedPreviewHref}
              src={renderedPreviewHref}
              className="h-[78vh] w-full bg-white"
              title="Rendered PPTX preview"
            />
          </section>
        )}

        {'slides' in artifact ? <DeckShell deck={artifact} theme={theme} /> : <ArtifactShell spec={artifact} theme={theme} />}
      </div>
    </main>
  )
}
