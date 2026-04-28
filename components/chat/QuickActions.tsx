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
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mb-4">
        BA
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Back Office Agent</h2>
      <p className="text-sm text-gray-500 mb-8 text-center max-w-sm">
        Vždy pracuji pouze s ověřenými daty a cituji zdroje. Nikdy si nic nevymýšlím.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => onSelect(action.query)}
            className="flex flex-col items-start gap-2 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
          >
            <action.icon className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-800">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
