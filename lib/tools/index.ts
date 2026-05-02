// @ts-nocheck
import { tool, jsonSchema } from 'ai'
import { handleToolCall } from './handlers'

// Používáme jsonSchema() místo z.object() pro zaručení explicitního type:"object"
// Vertex AI striktně vyžaduje type:"object" na vrchní úrovni — Zod konverze v @ai-sdk/google v3 ho vynechává

export const getTools = (accessToken?: string | null) => ({
  search_documents: tool({
    description: 'Prohledá RAG databázi firemních dokumentů (CRM exporty, smlouvy, poznámky, emaily, meeting záznamy). Vždy použij pro dotazy na firemní data.',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Vyhledávací dotaz v češtině' },
        source_type: { type: 'string', description: 'Filtr typu dokumentu: crm, contract, email, note, meeting, property' },
        limit: { type: 'number', description: 'Počet výsledků (default 5)' },
      },
      required: ['query'],
    }),
    execute: async (args) => handleToolCall('search_documents', args, accessToken),
  }),

  query_structured_data: tool({
    description: 'Dotaz na strukturovaná data. Parametr table MUSÍ být přesně jeden z: "crm_leads", "properties", "scraped_listings". Nikdy nepsat SQL do table. Pro grafy vývoje použij aggregation="monthly_count".',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        table: {
          type: 'string',
          enum: ['crm_leads', 'properties', 'scraped_listings'],
          description: 'POVINNÉ: přesně "crm_leads", "properties", nebo "scraped_listings"',
        },
        filters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Hledání podle jména kontaktu (částečná shoda)' },
            status: { type: 'string' },
            district: { type: 'string' },
            source: { type: 'string' },
            created_after: { type: 'string', description: 'Datum od ve formátu YYYY-MM-DD' },
            created_before: { type: 'string', description: 'Datum do ve formátu YYYY-MM-DD' },
            has_missing_fields: { type: 'string', description: 'Pokud "true", vrátí jen záznamy s chybějícími daty' },
          },
          description: 'Filtry',
        },
        aggregation: {
          type: 'string',
          description: 'Jedna z hodnot: "count", "avg_price", "group_by_source", "group_by_status", "monthly_count" (pro graf vývoje po měsících)',
        },
      },
      required: ['table'],
    }),
    execute: async (args) => handleToolCall('query_structured_data', args, accessToken),
  }),

  get_calendar_slots: tool({
    description: 'Načte volné termíny z Google Kalendáře pro plánování schůzek a prohlídek.',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Datum od (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Datum do (YYYY-MM-DD)' },
        duration_minutes: { type: 'number', description: 'Délka schůzky v minutách (default 60)' },
      },
      required: ['date_from', 'date_to'],
    }),
    execute: async (args) => handleToolCall('get_calendar_slots', args, accessToken),
  }),

  draft_communication: tool({
    description: 'Připraví návrh emailu nebo SMS. NEVYSÍLÁ automaticky — vždy čeká na potvrzení uživatele.',
    parameters: jsonSchema({
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
    execute: async (args) => handleToolCall('draft_communication', args, accessToken),
  }),

  create_visualization: tool({
    description: 'Vytvoří graf z dat. Vrací konzistentní designový artifact pro UI/PPTX a současně Excel-kompatibilní datový podklad.',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        chart_type: { type: 'string', description: 'bar, line, area, pie, doughnut' },
        title: { type: 'string', description: 'Název grafu' },
        subtitle: { type: 'string', description: 'Krátký popis co graf zobrazuje' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Popisky osy X nebo segmentů' },
        datasets: { type: 'array', items: {}, description: 'Data pro graf: [{ label, data: [čísla] }]' },
        source_description: { type: 'string', description: 'Popis zdroje dat pro citaci' },
        unit: { type: 'string', description: 'Jednotka hodnot, např. Kč, leadů, ks, %' },
        x_axis_label: { type: 'string', description: 'Popisek osy X' },
        y_axis_label: { type: 'string', description: 'Popisek osy Y' },
      },
      required: ['chart_type', 'title', 'labels', 'datasets', 'source_description'],
    }),
    execute: async (args) => handleToolCall('create_visualization', args, accessToken),
  }),

  create_presentation: tool({
    description: 'Vytvoří PowerPoint prezentaci (.pptx) s libovolným obsahem. Agent sám definuje každý slide — používej po tom, co máš data z jiných nástrojů. Titulní slide se přidá automaticky.',
    parameters: jsonSchema({
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
    execute: async (args) => handleToolCall('create_presentation', args, accessToken),
  }),

  generate_report: tool({
    description: 'Vygeneruje strukturovaný report z dostupných dat.',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Název reportu' },
        period: { type: 'string', description: 'Období (např. "Q1 2025", "minulý týden")' },
        sections: { type: 'array', items: { type: 'string' }, description: 'Sekce: ["leads", "deals", "properties", "recommendations"]' },
        format: { type: 'string', description: 'Vždy "markdown"' },
      },
      required: ['title', 'period', 'sections', 'format'],
    }),
    execute: async (args) => handleToolCall('generate_report', args, accessToken),
  }),

  manage_monitoring: tool({
    description: 'Zobrazí nebo smaže nastavená sledování nabídek.',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        action: { type: 'string', description: 'list — výpis všech, delete — smazání podle lokality, delete_all — smazání všeho' },
        location_name: { type: 'string', description: 'Název lokality pro delete' },
      },
      required: ['action'],
    }),
    execute: async (args) => handleToolCall('manage_monitoring', args, accessToken),
  }),

  setup_monitoring: tool({
    description: 'Nastaví automatické sledování realitních nabídek pro zadanou lokalitu.',
    parameters: jsonSchema({
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Lokalita česky — např. "Holešovice", "Praha 6"' },
        category_type: { type: 'string', description: 'prodej (default) nebo pronájem' },
        category_main: { type: 'string', description: 'byty (default) nebo domy' },
      },
      required: ['location'],
    }),
    execute: async (args) => handleToolCall('setup_monitoring', args, accessToken),
  }),

  manage_documents: tool({
    description: 'Správa ručně nahraných dokumentů. Vypiš, filtruj nebo smaž dokumenty.',
    parameters: jsonSchema({
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
    execute: async (args) => handleToolCall('manage_documents', args, accessToken),
  }),

  schedule_action: tool({
    description: 'Naplánuje opakující se úkol. NEVYTVOŘÍ automaticky — čeká na potvrzení.',
    parameters: jsonSchema({
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
    execute: async (args) => handleToolCall('schedule_action', args, accessToken),
  }),
})
