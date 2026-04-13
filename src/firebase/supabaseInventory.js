import { supabase } from '/supabase/supabaseClient'
import { safeLimit } from '../utils/network'
import { normalizeCategory } from '../utils/productCategories'
import { v4 as uuidv4 } from 'uuid'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

const PRODUCT_COLUMNS = [
  'id',
  'name',
  'qty',
  'price',
  'currency',
  'pack_qty',
  'meter_qty',
  'price_pack',
  'price_piece',
  'category',
  'location',
  'note',
  'date',
  'electrode_size',
  'stone_thickness',
  'stone_size',
].join(',')

export const getProducts = async (location = null, options = {}) => {
  if (!isSupabaseConfigured()) return []
  const limit = typeof options.limit === 'number' ? options.limit : safeLimit(120, 20)
  const offset = options.offset || 0
  const withCount = !!options.withCount
  const columns = options.columns || PRODUCT_COLUMNS

  try {
    let query = supabase
      .from('products')
      .select(columns, { count: withCount ? 'exact' : 'planned' })
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (location) query = query.eq('location', location)

    const { data, error, count } = await query
    if (error) throw error
    if (withCount) return { data: data || [], count: count || 0 }
    return data || []
  } catch (err) {
    console.error('getProducts error:', err)
    return withCount ? { data: [], count: 0 } : []
  }
}

export const insertProduct = async (product) => {
  if (!isSupabaseConfigured()) return null
  try {
    if (!product || typeof product !== 'object') {
      throw new Error('Invalid product payload: expected object')
    }
    if (!product.name || typeof product.name !== 'string' || !product.name.trim()) {
      throw new Error('Invalid product payload: "name" is required')
    }

    const safe = {
      id: product.id || uuidv4(),
      name: product.name.trim(),
      qty: Number(product.qty || 0),
      price: product.price !== undefined ? Number(product.price) : null,
      currency: product.currency || 'UZS',
    }

    if (product.price_piece !== undefined && product.price_piece !== null) safe.price_piece = Number(product.price_piece)
    if (product.price_pack !== undefined && product.price_pack !== null) safe.price_pack = Number(product.price_pack)
    if (product.pack_qty !== undefined && product.pack_qty !== null) safe.pack_qty = Number(product.pack_qty)
    if (product.meter_qty !== undefined && product.meter_qty !== null) safe.meter_qty = Number(product.meter_qty)
    if (product.electrode_size) safe.electrode_size = product.electrode_size.toString().trim()
    if (product.stone_thickness) safe.stone_thickness = product.stone_thickness.toString().trim()
    if (product.stone_size) safe.stone_size = product.stone_size.toString().trim()
    if (product.location) safe.location = product.location
    if (product.category) {
      const category = normalizeCategory(product.category)
      if (category) safe.category = category
    }

    console.log('supabase.insertProduct ->', safe)

    const { data, error } = await supabase
      .from('products')
      .insert(safe)
      .select(PRODUCT_COLUMNS)
      .single()

    if (error) throw error
    return data
  } catch (err) {
    const message = (err?.message || err?.details || '').toString()
    if (err?.code === '23505' || /unique/i.test(message)) {
      throw new Error('Unique cheklov sababli insert rad etildi. Nom o‘zgartirilmaydi. products.name unique indeksini olib tashlang yoki mavjud yozuvni tahrirlang.')
    }
    console.error('insertProduct error:', err)
    throw err
  }
}

export const updateProduct = async (id, updates) => {
  if (!isSupabaseConfigured()) return null;
  try {
    // Remove 'id' from updates to avoid trying to update the primary key
    const { id: _, ...safeUpdates } = updates;
    if (typeof safeUpdates.name === 'string') safeUpdates.name = safeUpdates.name.trim();
    if (safeUpdates.qty !== undefined) safeUpdates.qty = Number(safeUpdates.qty || 0);
    if (safeUpdates.price !== undefined) safeUpdates.price = Number(safeUpdates.price);
    if (safeUpdates.price_piece !== undefined) safeUpdates.price_piece = safeUpdates.price_piece === null ? null : Number(safeUpdates.price_piece);
    if (safeUpdates.price_pack !== undefined) safeUpdates.price_pack = safeUpdates.price_pack === null ? null : Number(safeUpdates.price_pack);
    if (safeUpdates.pack_qty !== undefined) safeUpdates.pack_qty = safeUpdates.pack_qty === null ? null : Number(safeUpdates.pack_qty);
    if (safeUpdates.meter_qty !== undefined) safeUpdates.meter_qty = safeUpdates.meter_qty === null ? null : Number(safeUpdates.meter_qty);
    if (safeUpdates.electrode_size !== undefined) {
      const size = (safeUpdates.electrode_size || '').toString().trim();
      safeUpdates.electrode_size = size ? size : null;
    }
    if (safeUpdates.stone_thickness !== undefined) {
      const thickness = (safeUpdates.stone_thickness || '').toString().trim();
      safeUpdates.stone_thickness = thickness ? thickness : null;
    }
    if (safeUpdates.stone_size !== undefined) {
      const size = (safeUpdates.stone_size || '').toString().trim();
      safeUpdates.stone_size = size ? size : null;
    }
    if (safeUpdates.category !== undefined) {
      const cat = normalizeCategory(safeUpdates.category || '');
      safeUpdates.category = cat ? cat : null;
    }
    console.log('updateProduct: id=', id, 'safeUpdates=', safeUpdates);
    const { data, error } = await supabase
      .from('products')
      .update(safeUpdates)
      .eq('id', id)
      .select(PRODUCT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Bu nom, qalinlik va hajmdagi mahsulot allaqachon mavjud.');
      }
      console.error('updateProduct supabase error:', error);
      throw error;
    }

    console.log('updateProduct: data=', data);

    return data;

  } catch (err) {
    console.error('updateProduct error:', err);
    throw err;
  }
}

export const deleteProduct = async (id) => {
  if (!isSupabaseConfigured()) return false
  try {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select(PRODUCT_COLUMNS)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    console.error('deleteProduct error:', err)
    throw err
  }
}



