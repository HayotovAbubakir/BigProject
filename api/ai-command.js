const OPENAI_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4'

// Comprehensive schema supporting all site operations
const commandSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    actions: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          // SALES & RECEIVING
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['sell_product'] },
              source: { type: ['string', 'null'], enum: ['warehouse', 'store', null] },
              quantity: { type: 'number' },
              unit: { type: 'string', enum: ['dona', 'metr'] },
              unit_price: { type: ['number', 'null'] },
              currency: { type: 'string', enum: ['UZS', 'USD'] },
              product_query: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  electrode_size: { type: 'string' },
                  stone_thickness: { type: 'string' },
                  stone_size: { type: 'string' },
                },
              },
            },
            required: ['type', 'quantity', 'product_query'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['receive_goods'] },
              product_name: { type: 'string' },
              category: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string', enum: ['dona', 'metr'] },
              unit_price: { type: 'number' },
              currency: { type: 'string', enum: ['UZS', 'USD'] },
              location: { type: 'string', enum: ['warehouse', 'store'] },
              electrode_size: { type: ['string', 'null'] },
              stone_thickness: { type: ['string', 'null'] },
              stone_size: { type: ['string', 'null'] },
              note: { type: ['string', 'null'] },
            },
            required: ['type', 'product_name', 'category', 'quantity', 'unit_price', 'location'],
          },
          // INVENTORY ADJUSTMENTS
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['adjust_inventory'] },
              product_query: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                },
              },
              adjustment_qty: { type: 'number' },
              adjustment_type: { type: 'string', enum: ['add', 'remove'] },
              location: { type: 'string', enum: ['warehouse', 'store'] },
              reason: { type: 'string' },
            },
            required: ['type', 'product_query', 'adjustment_qty', 'adjustment_type', 'location'],
          },
          // CLIENT MANAGEMENT
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['add_client'] },
              client_name: { type: 'string' },
              client_phone: { type: ['string', 'null'] },
            },
            required: ['type', 'client_name'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['update_client'] },
              client_query: { type: 'string' },
              update_field: { type: 'string', enum: ['name', 'phone'] },
              update_value: { type: 'string' },
            },
            required: ['type', 'client_query', 'update_field', 'update_value'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['delete_client'] },
              client_query: { type: 'string' },
            },
            required: ['type', 'client_query'],
          },
          // PRODUCT MANAGEMENT
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['add_product'] },
              product_name: { type: 'string' },
              category: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' },
              currency: { type: 'string', enum: ['UZS', 'USD'] },
              location: { type: 'string', enum: ['warehouse', 'store'] },
              electrode_size: { type: ['string', 'null'] },
              stone_thickness: { type: ['string', 'null'] },
              stone_size: { type: ['string', 'null'] },
              pack_qty: { type: ['number', 'null'] },
            },
            required: ['type', 'product_name', 'category', 'quantity', 'unit_price', 'location'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['update_product'] },
              product_query: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                },
              },
              update_field: { type: 'string' },
              update_value: { type: ['string', 'number', 'null'] },
            },
            required: ['type', 'product_query', 'update_field', 'update_value'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['delete_product'] },
              product_query: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                },
              },
            },
            required: ['type', 'product_query'],
          },
          // CREDIT MANAGEMENT
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['add_credit'] },
              credit_type: { type: 'string', enum: ['cash', 'product'] },
              client_query: { type: 'string' },
              amount: { type: ['number', 'null'] },
              currency: { type: 'string', enum: ['UZS', 'USD'] },
              product_query: { type: ['object', 'null'] },
              quantity: { type: ['number', 'null'] },
              note: { type: ['string', 'null'] },
            },
            required: ['type', 'credit_type', 'client_query'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['delete_credit'] },
              credit_id: { type: 'string' },
            },
            required: ['type', 'credit_id'],
          },
        ],
      },
    },
  },
  required: ['summary', 'actions'],
}

const SYSTEM_PROMPT = `
You convert natural-language commands into structured JSON for a comprehensive construction materials inventory management app.

SUPPORTED OPERATIONS:

1. SALES (sell_product):
   - sellотите продукт из склада или магазина
   - Примеры: "Ombordan 5 dona elektrod sotilsin 50000 so'm" "Sell 10 meters stone from warehouse"

2. RECEIVING GOODS (receive_goods):
   - Add new stock from suppliers
   - Примеры: "Omborga 100 dona elektrod qabul qilinsin narxi 30000 so'm" "Receive 50 pieces electrode at warehouse"

3. INVENTORY ADJUSTMENTS (adjust_inventory):
   - Add/remove inventory without sale (write-off, shrinkage, corrections)
   - Примеры: "Ombordagi tosh 5 dona olib tashlansin" "Remove 10 stone from warehouse inventory"

4. CLIENT MANAGEMENT:
   - add_client: "Yangi mijoz qo'shish: Abdullayev Aziz, +998901234567"
   - update_client: "Abdullayev ism o'zgarish: Mirjalol"
   - delete_client: "Abdullayev mijozni o'chirish"

5. PRODUCT MANAGEMENT:
   - add_product: "Yangi mahsulot: Elektrod 3mm, narxi 50000 so'm, omborga 100 dona"
   - update_product: "Elektrod 3mm narx o'zgarish: 55000 so'm"
   - delete_product: "Elektrod 3mm mahsulotni o'chirish"

6. CREDIT MANAGEMENT:
   - add_credit: "Obid mijozga 500000 so'm qarz berish" or "Obid mijozga 10 dona tosh qarz berish"
   - delete_credit: "Qarzni bekor qilish"

RULES FOR ALL OPERATIONS:
- Map "ombor" / "warehouse" / "sklad" → source: "warehouse"
- Map "do'kon" / "store" / "magazin" → source: "store"
- Categories: "elektrod", "tosh", "gaz balon", "metrologiya"
- Default currency: "UZS" unless user says "USD" or "$"
- Default unit: "dona" (pieces) unless user says "metr" (meters)
- product_query.name should NOT include action words, quantities, or locations
- If updating product, update_field can be: name, price, qty, category, electrode_size, stone_thickness, stone_size, pack_qty, etc.
- For client operations, client_query should be the client's name (for fuzzy matching)
- For credit with product: include product_query and quantity; for cash credit: include amount only
- Do not invent fields outside the schema
- Return summary in user's language explaining what command was understood

CRITICAL: Return ONLY valid JSON matching the schema above. Do not return code blocks or explanations.
`.trim()

const extractJsonText = (payload) => {
  if (!payload || typeof payload !== 'object') return ''
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text

  const chunks = Array.isArray(payload.output) ? payload.output : []
  for (const chunk of chunks) {
    const content = Array.isArray(chunk?.content) ? chunk.content : []
    for (const item of content) {
      if (typeof item?.text === 'string' && item.text.trim()) return item.text
    }
  }
  return ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
    return
  }

  const command = (req.body?.command || '').toString().trim()
  const locale = (req.body?.locale || 'uz').toString()

  if (!command) {
    res.status(400).json({ error: 'Command is required' })
    return
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        store: false,
        input: [
          { role: 'system', content: `${SYSTEM_PROMPT}\nUser locale: ${locale}` },
          { role: 'user', content: command },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'inventory_command',
            strict: true,
            schema: commandSchema,
          },
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText || 'OpenAI request failed' })
      return
    }

    const payload = await response.json()
    const jsonText = extractJsonText(payload)
    if (!jsonText) {
      res.status(502).json({ error: 'AI returned an empty response' })
      return
    }

    const parsed = JSON.parse(jsonText)
    res.status(200).json({ command: parsed })
  } catch (error) {
    res.status(500).json({ error: error.message || 'AI parse failed' })
  }
}
