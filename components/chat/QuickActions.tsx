'use client'

import { BarChart2, Users, Mail, Search, FileText, Bell } from 'lucide-react'
import { AgentMark } from '@/components/brand/AgentMark'

const ACTIONS = [
  {
    icon: Users,
    label: 'Noví klienti Q1',
    query: 'Jaké nové klienty máme za 1. kvartál? Odkud přišli? Znázorni graficky.',
  },
  {
    icon: BarChart2,
    label: 'Graf leadů 6M',
    query: 'Vytvoř graf vývoje počtu leadů za posledních 6 měsíců.',
  },
  {
    icon: Mail,
    label: 'Email zájemci',
    query: 'Napiš email pro zájemce o nemovitost a doporuč termín prohlídky na základě mé dostupnosti v kalendáři.',
  },
  {
    icon: Search,
    label: 'Chybějící data',
    query: 'Najdi nemovitosti, u kterých chybí data o rekonstrukci a stavebních úpravách.',
  },
  {
    icon: FileText,
    label: 'Týdenní report',
    query: 'Shrň výsledky minulého týdne do krátkého reportu pro vedení.',
  },
  {
    icon: Bell,
    label: 'Sleduj Holešovice',
    query: 'Sleduj všechny hlavní realitní servery a každé ráno mě informuj o nových nabídkách v lokalitě Praha Holešovice.',
  },
]

export function QuickActions({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10 md:px-6">
      <div className="w-full max-w-4xl">
        <div className="mx-auto mb-8 max-w-xl text-center">
          <AgentMark className="mx-auto mb-5 h-20 w-20" />
          <h2 className="text-3xl font-bold text-slate-950 md:text-4xl">Ahoj, jsem Back Office Agent.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 md:text-base">
            Pomůžu s leady, dokumenty, prezentacemi, monitoringem nabídek i e-maily.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => onSelect(action.query)}
            className="group flex min-h-16 items-center gap-3 rounded-3xl border border-white/70 bg-white/70 px-3.5 py-3 text-left shadow-sm shadow-blue-950/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 text-blue-700 transition-transform group-hover:scale-105">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-slate-800">{action.label}</span>
          </button>
        ))}
        </div>
      </div>
    </div>
  )
}
