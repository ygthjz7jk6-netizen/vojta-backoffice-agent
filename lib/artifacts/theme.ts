import type { ArtifactTheme } from './types'

export const artifactPalettes = {
  light: {
    page: '#eef7ff',
    panel: '#fbfdff',
    panelAlt: '#f1f7fb',
    text: '#111827',
    muted: '#64748b',
    subtle: '#dbeafe',
    border: '#d7e7f3',
    grid: '#d7e7f3',
    accent: '#2f7df6',
    cyan: '#22d3ee',
    good: '#10b981',
    warning: '#f59e0b',
    bad: '#ef4444',
    dot: '#111827',
    fadedDot: '#d6e4ee',
  },
  dark: {
    page: '#050607',
    panel: '#080a0c',
    panelAlt: '#11151a',
    text: '#f8fafc',
    muted: '#9ca3af',
    subtle: '#1d2732',
    border: '#252c36',
    grid: '#242b34',
    accent: '#6fb7ff',
    cyan: '#67e8f9',
    good: '#34d399',
    warning: '#fbbf24',
    bad: '#fb7185',
    dot: '#f8fafc',
    fadedDot: '#2a3038',
  },
} as const

export const artifactSeries = {
  light: ['#2f7df6', '#22d3ee', '#14b8a6', '#8b5cf6', '#f59e0b', '#f472b6'],
  dark: ['#f8fafc', '#67e8f9', '#93c5fd', '#a7f3d0', '#fbbf24', '#f0abfc'],
} as const

export function resolveArtifactTheme(theme: ArtifactTheme | undefined, fallback: 'light' | 'dark'): 'light' | 'dark' {
  if (!theme || theme === 'auto') return fallback
  return theme
}
