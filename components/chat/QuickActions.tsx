'use client'

import { BarChart2, Users, Mail, Search, FileText, Bell } from 'lucide-react'

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
    <div className="flex flex-1 items-center justify-center px-4 py-8 md:px-6">
      <div className="w-full max-w-4xl">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-neutral-950">Rychlé akce</h2>
          <p className="text-sm text-neutral-500">Vyber pracovní scénář nebo napiš vlastní dotaz.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => onSelect(action.query)}
            className="flex min-h-14 items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100">
              <action.icon className="h-4 w-4 text-neutral-700" />
            </span>
            <span className="text-sm font-medium text-neutral-800">{action.label}</span>
          </button>
        ))}
        </div>
      </div>
    </div>
  )
}
