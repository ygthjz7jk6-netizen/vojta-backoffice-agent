// @ts-nocheck
import { tool, jsonSchema } from 'ai'
import { handleToolCall } from './handlers'

// Používáme jsonSchema() místo z.object() pro explicitní OpenAPI/Vertex schema.

async function executeTool(name: string, args: Record<string, unknown>, accessToken?: string | null) {
  const { result, citations } = await handleToolCall(name, args, accessToken)
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...result, citations }
  }
  return { result, citations }
}

export const getTools = (accessToken?: string | null) => ({
  search_documents: tool({
    description: 'Prohledá RAG databázi firemních dokumentů (CRM exporty, smlouvy, poznámky, emaily, meeting záznamy). Vždy použij pro dotazy na firemní data.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Vyhledávací dotaz v češtině' },
        source_type: { type: 'string', description: 'Filtr typu dokumentu: crm, contract, email, note, meeting, property' },
        source_file: { type: 'string', description: 'Přesný název souboru, pokud chceš hledat jen v jednom dokumentu' },
        uploaded_file_id: { type: 'string', description: 'UUID ručně nahraného souboru, pokud je uvedené v aktuální zprávě uživatele' },
        limit: { type: 'number', description: 'Počet výsledků (default 5)' },
      },
      required: ['query'],
    }),
    execute: async (args) => executeTool('search_documents', args, accessToken),
  }),

  query_structured_data: tool({
    description: 'Dotaz na strukturovaná data. Parametr table MUSÍ být přesně jeden z: "crm_leads", "properties", "scraped_listings", "transactions". Nikdy nepsat SQL do table. Pro grafy vývoje použij aggregation="monthly_count" nebo "monthly_sum". Pro platební data (nájmy, výdaje, bankové výpisy) VŽDY použij table="transactions".',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        table: {
          type: 'string',
          enum: ['crm_leads', 'properties', 'scraped_listings', 'transactions'],
          description: 'POVINNÉ: přesně "crm_leads", "properties", "scraped_listings", nebo "transactions"',
        },
        filters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Hledání podle jména kontaktu (částečná shoda) — pro crm_leads' },
            status: { type: 'string' },
            district: { type: 'string' },
            source: { type: 'string' },
            created_after: { type: 'string', description: 'Datum od ve formátu YYYY-MM-DD' },
            created_before: { type: 'string', description: 'Datum do ve formátu YYYY-MM-DD' },
            has_missing_fields: { type: 'string', description: 'Pokud "true", vrátí jen záznamy s chybějícími daty' },
            id_nemovitosti: { type: 'string', description: 'ID nemovitosti (např. "ID003") — pouze pro transactions' },
            kategorie: { type: 'string', description: 'Kategorie transakce: "Najem", "Udrzba", "Provize", "Jine" — pouze pro transactions' },
            najemnik: { type: 'string', description: 'Jméno nájemníka (částečná shoda) — pouze pro transactions' },
            typ: { type: 'string', description: 'Typ transakce: "Příchozí", "Odchozí", "Chybějící" — pouze pro transactions' },
          },
          description: 'Filtry',
        },
        aggregation: {
          type: 'string',
          description: 'Jedna z hodnot: "count", "avg_price", "group_by_source", "group_by_status", "monthly_count" (počty po měsících), "monthly_sum" (součty částek po měsících — pro transactions), "group_by_nemovitost" (součet per nemovitost — pro transactions)',
        },
      },
      required: ['table'],
    }),
    execute: async (args) => executeTool('query_structured_data', args, accessToken),
  }),

  get_calendar_slots: tool({
    description: 'Načte volné termíny z Google Kalendáře pro plánování schůzek a prohlídek.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Datum od (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Datum do (YYYY-MM-DD)' },
        duration_minutes: { type: 'number', description: 'Délka schůzky v minutách (default 60)' },
      },
      required: ['date_from', 'date_to'],
    }),
    execute: async (args) => executeTool('get_calendar_slots', args, accessToken),
  }),

  draft_communication: tool({
    description: 'Připraví návrh emailu nebo SMS. NEVYSÍLÁ automaticky — vždy čeká na potvrzení uživatele.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        type: { type: 'string', description: 'email nebo sms' },
        recipient_name: { type: 'string', description: 'Jméno příjemce' },
        recipient_email: { type: 'string', description: 'Email příjemce' },
        context: { type: 'string', description: 'Kontext zprávy' },
        proposed_slots: {
          type: 'array',
          items: { type: 'string' },
          description: 'Navrhované termíny ze search_calendar',
        },
      },
      required: ['type', 'context'],
    }),
    execute: async (args) => executeTool('draft_communication', args, accessToken),
  }),

  create_visualization: tool({
    description: 'Vytvoří graf z dat. Vrací konzistentní designový artifact pro UI a PPTX export.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        chart_type: { type: 'string', description: 'bar, line, area, pie, doughnut' },
        title: { type: 'string', description: 'Název grafu' },
        subtitle: { type: 'string', description: 'Krátký popis co graf zobrazuje' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Popisky osy X nebo segmentů' },
        datasets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              data: { type: 'array', items: { type: 'number' } },
            },
            required: ['label', 'data'],
          },
          description: 'Data pro graf: [{ label, data: [čísla] }]',
        },
        source_description: { type: 'string', description: 'Popis zdroje dat pro citaci' },
        unit: { type: 'string', description: 'Jednotka hodnot, např. Kč, leadů, ks, %' },
        x_axis_label: { type: 'string', description: 'Popisek osy X' },
        y_axis_label: { type: 'string', description: 'Popisek osy Y' },
      },
      required: ['chart_type', 'title', 'labels', 'datasets', 'source_description'],
    }),
    execute: async (args) => executeTool('create_visualization', args, accessToken),
  }),

  create_presentation: tool({
    description: 'Vytvoří PowerPoint prezentaci (.pptx) s libovolným obsahem. Agent sám definuje každý slide — používej po tom, co máš data z jiných nástrojů. Titulní slide se přidá automaticky.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Název prezentace' },
        subtitle: { type: 'string', description: 'Podtitul (volitelný)' },
        slides: {
          type: 'array',
          description: 'Obsah slidů (max 9 content slidů + titulní = 10 celkem)',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', description: 'Nadpis slidu' },
              bullets: { type: 'array', items: { type: 'string' }, description: 'Odrážky' },
              kpis: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                    highlight: { type: 'boolean' },
                  },
                  required: ['label', 'value'],
                },
                description: 'KPI karty (max 4)',
              },
              table: {
                type: 'object',
                properties: {
                  headers: { type: 'array', items: { type: 'string' } },
                  rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
                },
                required: ['headers', 'rows'],
              },
              note: { type: 'string', description: 'Poznámka o zdroji dat' },
            },
            required: ['heading'],
          },
        },
      },
      required: ['title', 'slides'],
    }),
    execute: async (args) => executeTool('create_presentation', args, accessToken),
  }),

  generate_report: tool({
    description: 'Vygeneruje strukturovaný report z dostupných dat.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Název reportu' },
        period: { type: 'string', description: 'Období (např. "Q1 2025", "minulý týden")' },
        sections: { type: 'array', items: { type: 'string' }, description: 'Sekce: ["leads", "deals", "properties", "recommendations"]' },
        format: { type: 'string', description: 'Vždy "markdown"' },
      },
      required: ['title', 'period', 'sections', 'format'],
    }),
    execute: async (args) => executeTool('generate_report', args, accessToken),
  }),

  manage_monitoring: tool({
    description: 'Zobrazí nebo smaže nastavená sledování nabídek.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        action: { type: 'string', description: 'list — výpis všech, delete — smazání podle lokality, delete_all — smazání všeho' },
        location_name: { type: 'string', description: 'Název lokality pro delete' },
      },
      required: ['action'],
    }),
    execute: async (args) => executeTool('manage_monitoring', args, accessToken),
  }),

  setup_monitoring: tool({
    description: 'Nastaví automatické sledování realitních nabídek pro zadanou lokalitu.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Lokalita česky — např. "Holešovice", "Praha 6"' },
        category_type: { type: 'string', description: 'prodej (default) nebo pronájem' },
        category_main: { type: 'string', description: 'byty (default) nebo domy' },
      },
      required: ['location'],
    }),
    execute: async (args) => executeTool('setup_monitoring', args, accessToken),
  }),

  manage_documents: tool({
    description: 'Správa ručně nahraných dokumentů. Vypiš, filtruj nebo smaž dokumenty.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        action: { type: 'string', description: 'list, delete, list_categories' },
        category: { type: 'string', description: 'Filtr nebo cíl operace podle kategorie' },
        uploaded_before: { type: 'string', description: 'YYYY-MM-DD' },
        uploaded_after: { type: 'string', description: 'YYYY-MM-DD' },
        file_id: { type: 'string', description: 'UUID konkrétního souboru' },
      },
      required: ['action'],
    }),
    execute: async (args) => executeTool('manage_documents', args, accessToken),
  }),

  schedule_action: tool({
    description: 'Naplánuje opakující se úkol. NEVYTVOŘÍ automaticky — čeká na potvrzení.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        cron: { type: 'string', description: 'Cron výraz (např. "0 8 * * 1-5")' },
        action_type: { type: 'string', description: 'scrape_listings, send_report, notify' },
        action_params: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            format: { type: 'string' },
            recipient: { type: 'string' },
          },
        },
        description: { type: 'string', description: 'Popis úkolu česky' },
      },
      required: ['cron', 'action_type', 'description'],
    }),
    execute: async (args) => executeTool('schedule_action', args, accessToken),
  }),
})
