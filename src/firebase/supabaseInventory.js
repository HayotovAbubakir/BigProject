import { supabase } from '/supabase/supabaseClient'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export const getProducts = async (location = null) => {
  if (!isSupabaseConfigured()) return []
  try {
    let query = supabase.from('products').select('*')
    if (location) query = query.eq('location', location)
    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('getProducts error:', err)
    return []
  }
}

export const insertProduct = async (product) => {
  if (!isSupabaseConfigured()) return null
  try {
    // Basic payload validation to avoid 400 errors from Supabase
    if (!product || typeof product !== 'object') {
      throw new Error('Invalid product payload: expected object')
    }
    if (!product.name || typeof product.name !== 'string' || !product.name.trim()) {
      throw new Error('Invalid product payload: "name" is required')
    }
    // Ensure numeric fields are numbers (or convertible)
    const safe = {
      name: product.name.trim(),
      qty: Number(product.qty || 0),
      cost: Number(product.cost || 0),
      price: product.price !== undefined ? Number(product.price) : null,
      price_uzs: product.price_uzs !== undefined ? Number(product.price_uzs) : null,
      cost_uzs: product.cost_uzs !== undefined ? Number(product.cost_uzs) : null,
      currency: product.currency || 'UZS',
      location: product.location || null,
      date: product.date || null,
      note: product.note || null,
    }

    console.log('supabase.insertProduct ->', safe)

    const { data, error } = await supabase
      .from('products')
      .insert(safe)
      .select()
      .single()

    if (error) {
      // Supabase error object may include status, code, details
      console.error('insertProduct supabase error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details
      })
      throw error
    }

    console.log('supabase.insertProduct success ->', data)
    return data
  } catch (err) {
    // Network or validation errors will surface here
    console.error('insertProduct error (full):', err)
    const msg = err?.message || err?.error || err?.details || JSON.stringify(err)
    throw new Error(`insertProduct failed: ${msg}`)
  }
}

export const updateProduct = async (id, updates) => {
  if (!isSupabaseConfigured()) return null;
  try {
    // Remove 'id' from updates to avoid trying to update the primary key
    const { id: _, ...safeUpdates } = updates;
    console.log('updateProduct: id=', id, 'safeUpdates=', safeUpdates);
    const { data, error } = await supabase
      .from('products')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
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
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  } catch (err) {
    console.error('deleteProduct error:', err)
    throw err
  }
}