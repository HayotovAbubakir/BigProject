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
      id: product.id,
      name: product.name.trim(),
      qty: Number(product.qty || 0),
      price: product.price !== undefined ? Number(product.price) : null,
      currency: product.currency || 'UZS',
    }

    // Add optional fields that may or may not exist in the schema
    if (product.price_piece !== undefined && product.price_piece !== null) {
      safe.price_piece = Number(product.price_piece)
    }
    if (product.price_pack !== undefined && product.price_pack !== null) {
      safe.price_pack = Number(product.price_pack)
    }
    if (product.pack_qty !== undefined && product.pack_qty !== null) {
      safe.pack_qty = Number(product.pack_qty)
    }
    if (product.meter_qty !== undefined && product.meter_qty !== null) {
      safe.meter_qty = Number(product.meter_qty)
    }
    if (product.electrode_size) {
      safe.electrode_size = product.electrode_size.toString().trim()
    }
    if (product.stone_thickness) {
      safe.stone_thickness = product.stone_thickness.toString().trim()
    }
    if (product.stone_size) {
      safe.stone_size = product.stone_size.toString().trim()
    }
    if (product.location) {
      safe.location = product.location
    }
    if (product.category) {
      safe.category = product.category
    }

    console.log('supabase.insertProduct ->', safe)

    const { data, error } = await supabase
      .from('products')
      .insert(safe)
      .select('*')
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
      const cat = (safeUpdates.category || '').toString().trim();
      safeUpdates.category = cat ? cat : null;
    }
    console.log('updateProduct: id=', id, 'safeUpdates=', safeUpdates);
    const { data, error } = await supabase
      .from('products')
      .update(safeUpdates)
      .eq('id', id)
      .select('*')
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
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('deleteProduct error:', err)
    throw err
  }
}
