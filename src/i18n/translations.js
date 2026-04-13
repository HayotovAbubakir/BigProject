import en from './en.json'
import uz from './uz.json'
import ru from './ru.json'

const translations = { uz, en, ru }

export const DEFAULT_LANGUAGE = 'uz'
export const SUPPORTED_LANGUAGES = Object.keys(translations)

export const languageOptions = [
  { code: 'uz', label: uz.language_uz || 'Uzbek' },
  { code: 'en', label: en.language_en || 'English' },
  { code: 'ru', label: ru.language_ru || 'Русский' }
]

const normalize = (value) => {
  if (!value) return ''
  return value.toString().trim().toLowerCase().replace(/\s+/g, ' ')
}

const categoryLabelMap = {
  uz: {
    'gaz balon': uz.category_gas_cylinder || 'Gaz balon',
    'elektrod': uz.category_electrode || 'Elektrod',
    'tosh': uz.category_stone || 'Tosh',
    'metrologiya': uz.category_meter_goods || 'Metrologiya',
    'metrlab sotiladigan mahsulotlar': uz.category_meter_goods || 'Metrologiya'
  },
  en: {
    'gaz balon': en.category_gas_cylinder || 'Gas cylinder',
    'elektrod': en.category_electrode || 'Electrode',
    'tosh': en.category_stone || 'Stone',
    'metrologiya': en.category_meter_goods || 'Metrology',
    'metrlab sotiladigan mahsulotlar': en.category_meter_goods || 'Metrology'
  },
  ru: {
    'gaz balon': ru.category_gas_cylinder || 'Газовый баллон',
    'elektrod': ru.category_electrode || 'Электрод',
    'tosh': ru.category_stone || 'Камень',
    'metrologiya': ru.category_meter_goods || 'Метология'
  }
}

export const translateCategoryLabel = (category, locale = DEFAULT_LANGUAGE) => {
  if (!category) return ''
  const normalized = normalize(category)
  const map = categoryLabelMap[locale] || categoryLabelMap[DEFAULT_LANGUAGE]
  return map[normalized] || category
}

export const categoryOptions = (categories = [], locale = DEFAULT_LANGUAGE) => {
  const unique = Array.from(new Set(categories.filter(Boolean).map(c => c.toString().trim())))
  return unique.map((cat) => ({
    value: cat,
    label: translateCategoryLabel(cat, locale)
  }))
}

export const unitOptions = (t) => ([
  { value: 'metr', label: t('unit_meter') || 'Metr' },
  { value: 'dona', label: t('unit_piece') || 'Dona' },
  { value: 'pachka', label: t('unit_pack') || 'Pachka' }
])

export default translations
