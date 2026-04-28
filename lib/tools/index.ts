import type { Tool } from '@google/generative-ai'

export const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'search_documents',
        description: 'Prohledá RAG databázi firemních dokumentů (CRM exporty, smlouvy, poznámky, emaily, meeting záznamy). Vždy použij pro dotazy na firemní data.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            query: { type: 'STRING' as const, description: 'Vyhledávací dotaz v češtině' },
            source_type: {
              type: 'STRING' as const,
              description: 'Filtr typu dokumentu: crm, contract, email, note, meeting, property',
            },
            limit: { type: 'NUMBER' as const, description: 'Počet výsledků (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'query_structured_data',
        description: 'SQL dotaz na strukturovaná data: CRM leady, nemovitosti, uzavřené obchody. Použij pro agregace, počty, filtry podle datumu.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            table: {
              type: 'STRING' as const,
              description: 'Tabulka: crm_leads, properties, scraped_listings',
            },
            filters: {
              type: 'OBJECT' as const,
              description: 'Filtry jako JSON: { "status": "new", "created_after": "2025-01-01" }',
              properties: {},
            },
            aggregation: {
              type: 'STRING' as const,
              description: 'Agregace: count, sum_price, avg_price, group_by_source, group_by_status',
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'get_calendar_slots',
        description: 'Načte volné termíny z Google Kalendáře pro plánování schůzek a prohlídek.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            date_from: { type: 'STRING' as const, description: 'Datum od (YYYY-MM-DD)' },
            date_to: { type: 'STRING' as const, description: 'Datum do (YYYY-MM-DD)' },
            duration_minutes: { type: 'NUMBER' as const, description: 'Délka schůzky v minutách (default 60)' },
          },
          required: ['date_from', 'date_to'],
        },
      },
      {
        name: 'draft_communication',
        description: 'Připraví návrh emailu nebo SMS. NEVYSÍLÁ automaticky — vždy čeká na potvrzení uživatele.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            type: { type: 'STRING' as const, description: 'email nebo sms' },
            recipient_name: { type: 'STRING' as const, description: 'Jméno příjemce' },
            recipient_email: { type: 'STRING' as const, description: 'Email příjemce' },
            context: { type: 'STRING' as const, description: 'Kontext zprávy (o jakou nemovitost jde, jaký je účel)' },
            proposed_slots: {
              type: 'ARRAY' as const,
              description: 'Navrhované termíny ze search_calendar',
              items: { type: 'STRING' as const },
            },
          },
          required: ['type', 'context'],
        },
      },
      {
        name: 'create_visualization',
        description: 'Vytvoří graf z dat. Vrátí Chart.js konfiguraci pro zobrazení v UI.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            chart_type: { type: 'STRING' as const, description: 'bar, line, pie, doughnut' },
            title: { type: 'STRING' as const, description: 'Název grafu' },
            labels: {
              type: 'ARRAY' as const,
              description: 'Popisky osy X nebo segmentů',
              items: { type: 'STRING' as const },
            },
            datasets: {
              type: 'ARRAY' as const,
              description: 'Data pro graf: [{ label, data: [čísla] }]',
              items: { type: 'OBJECT' as const, properties: {} },
            },
            source_description: { type: 'STRING' as const, description: 'Popis zdroje dat pro citaci' },
          },
          required: ['chart_type', 'title', 'labels', 'datasets', 'source_description'],
        },
      },
      {
        name: 'generate_report',
        description: 'Vygeneruje strukturovaný report z dostupných dat.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            title: { type: 'STRING' as const, description: 'Název reportu' },
            period: { type: 'STRING' as const, description: 'Období (např. "Q1 2025", "minulý týden")' },
            sections: {
              type: 'ARRAY' as const,
              description: 'Sekce reportu: ["leads", "deals", "properties", "recommendations"]',
              items: { type: 'STRING' as const },
            },
            format: { type: 'STRING' as const, description: 'markdown nebo pptx' },
          },
          required: ['title', 'period', 'sections'],
        },
      },
      {
        name: 'schedule_action',
        description: 'Naplánuje opakující se úkol (scraping, report, notifikace). NEVYTVOŘÍ automaticky — čeká na potvrzení.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            cron: { type: 'STRING' as const, description: 'Cron výraz (např. "0 8 * * 1-5" = každý pracovní den v 8:00)' },
            action_type: {
              type: 'STRING' as const,
              description: 'Typ akce: scrape_listings, send_report, notify',
            },
            action_params: {
              type: 'OBJECT' as const,
              description: 'Parametry akce (lokalita, formát, příjemce...)',
              properties: {},
            },
            description: { type: 'STRING' as const, description: 'Popis úkolu česky' },
          },
          required: ['cron', 'action_type', 'description'],
        },
      },
    ],
  },
]
