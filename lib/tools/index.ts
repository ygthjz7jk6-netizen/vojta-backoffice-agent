import { SchemaType, type Tool } from '@google/generative-ai'

export const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'search_documents',
        description: 'Prohledá RAG databázi firemních dokumentů (CRM exporty, smlouvy, poznámky, emaily, meeting záznamy). Vždy použij pro dotazy na firemní data.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING, description: 'Vyhledávací dotaz v češtině' },
            source_type: { type: SchemaType.STRING, description: 'Filtr typu dokumentu: crm, contract, email, note, meeting, property' },
            limit: { type: SchemaType.NUMBER, description: 'Počet výsledků (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'query_structured_data',
        description: 'SQL dotaz na strukturovaná data: CRM leady, nemovitosti, uzavřené obchody. Použij pro agregace, počty, filtry podle datumu.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            table: { type: SchemaType.STRING, description: 'Tabulka: crm_leads, properties, scraped_listings' },
            filters: {
              type: SchemaType.OBJECT,
              description: 'Filtry jako JSON: { "status": "new", "created_after": "2025-01-01" }',
              properties: {
                status: { type: SchemaType.STRING },
                district: { type: SchemaType.STRING },
                source: { type: SchemaType.STRING },
                created_after: { type: SchemaType.STRING },
                created_before: { type: SchemaType.STRING },
              },
            },
            aggregation: { type: SchemaType.STRING, description: 'count, sum_price, avg_price, group_by_source, group_by_status' },
          },
          required: ['table'],
        },
      },
      {
        name: 'get_calendar_slots',
        description: 'Načte volné termíny z Google Kalendáře pro plánování schůzek a prohlídek.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            date_from: { type: SchemaType.STRING, description: 'Datum od (YYYY-MM-DD)' },
            date_to: { type: SchemaType.STRING, description: 'Datum do (YYYY-MM-DD)' },
            duration_minutes: { type: SchemaType.NUMBER, description: 'Délka schůzky v minutách (default 60)' },
          },
          required: ['date_from', 'date_to'],
        },
      },
      {
        name: 'draft_communication',
        description: 'Připraví návrh emailu nebo SMS. NEVYSÍLÁ automaticky — vždy čeká na potvrzení uživatele.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            type: { type: SchemaType.STRING, description: 'email nebo sms' },
            recipient_name: { type: SchemaType.STRING, description: 'Jméno příjemce' },
            recipient_email: { type: SchemaType.STRING, description: 'Email příjemce' },
            context: { type: SchemaType.STRING, description: 'Kontext zprávy' },
            proposed_slots: {
              type: SchemaType.ARRAY,
              description: 'Navrhované termíny ze search_calendar',
              items: { type: SchemaType.STRING },
            },
          },
          required: ['type', 'context'],
        },
      },
      {
        name: 'create_visualization',
        description: 'Vytvoří graf z dat. Vrátí Chart.js konfiguraci pro zobrazení v UI.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            chart_type: { type: SchemaType.STRING, description: 'bar, line, pie, doughnut' },
            title: { type: SchemaType.STRING, description: 'Název grafu' },
            labels: {
              type: SchemaType.ARRAY,
              description: 'Popisky osy X nebo segmentů',
              items: { type: SchemaType.STRING },
            },
            datasets: {
              type: SchemaType.ARRAY,
              description: 'Data pro graf: [{ label, data: [čísla] }]',
              items: { type: SchemaType.OBJECT, properties: {} },
            },
            source_description: { type: SchemaType.STRING, description: 'Popis zdroje dat pro citaci' },
          },
          required: ['chart_type', 'title', 'labels', 'datasets', 'source_description'],
        },
      },
      {
        name: 'generate_report',
        description: 'Vygeneruje strukturovaný report z dostupných dat.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: 'Název reportu' },
            period: { type: SchemaType.STRING, description: 'Období (např. "Q1 2025", "minulý týden")' },
            sections: {
              type: SchemaType.ARRAY,
              description: 'Sekce reportu: ["leads", "deals", "properties", "recommendations"]',
              items: { type: SchemaType.STRING },
            },
            format: { type: SchemaType.STRING, description: 'markdown nebo pptx' },
          },
          required: ['title', 'period', 'sections'],
        },
      },
      {
        name: 'schedule_action',
        description: 'Naplánuje opakující se úkol (scraping, report, notifikace). NEVYTVOŘÍ automaticky — čeká na potvrzení.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            cron: { type: SchemaType.STRING, description: 'Cron výraz (např. "0 8 * * 1-5")' },
            action_type: { type: SchemaType.STRING, description: 'scrape_listings, send_report, notify' },
            action_params: {
              type: SchemaType.OBJECT,
              description: 'Parametry akce',
              properties: {
                location: { type: SchemaType.STRING },
                format: { type: SchemaType.STRING },
                recipient: { type: SchemaType.STRING },
              },
            },
            description: { type: SchemaType.STRING, description: 'Popis úkolu česky' },
          },
          required: ['cron', 'action_type', 'description'],
        },
      },
    ],
  },
]
