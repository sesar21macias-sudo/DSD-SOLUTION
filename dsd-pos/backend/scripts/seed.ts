/**
 * Seed consolidado para desarrollo local.
 * Uso: npm run seed -- <tenant|menu|recipes|all> [tenantSlug]
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_KEY en backend/.env (nunca hardcodear credenciales aquí).
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en backend/.env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const DEFAULT_SLUG = 'tacos-el-guero'

async function getTenantId(slug: string): Promise<string> {
  const { data, error } = await supabase.from('tenants').select('id').eq('slug', slug).single()
  if (error || !data) {
    console.error(`❌ No se encontró el tenant "${slug}". Corre primero: npm run seed -- tenant`)
    process.exit(1)
  }
  return data.id
}

async function seedTenantAndAdmin(slug: string) {
  console.log('🌱 Creando tenant y admin...')

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .upsert({ name: slug === DEFAULT_SLUG ? 'Tacos El Guero' : slug, slug, currency: 'MXN', is_active: true }, { onConflict: 'slug' })
    .select()
    .single()

  if (tenantErr) { console.error('❌ Error creando tenant:', tenantErr.message); process.exit(1) }
  console.log('✅ Tenant:', tenant.id)

  // El email es único a nivel global (no por tenant, ver database/001_schema.sql),
  // así que se parametriza por slug. No hardcodear el mismo email para todos los
  // tenants: el upsert por email movería la cuenta admin de un tenant a otro.
  const adminEmail = slug === DEFAULT_SLUG ? 'admin@tacoselguero.com' : `admin@${slug}.com`
  const hash = await bcrypt.hash('Admin1234!', 10)
  const { data: user, error: userErr } = await supabase
    .from('users')
    .upsert({
      email: adminEmail,
      password_hash: hash,
      full_name: 'Admin Principal',
      role: 'tenant_admin',
      tenant_id: tenant.id,
      is_active: true,
    }, { onConflict: 'email' })
    .select()
    .single()

  if (userErr) { console.error('❌ Error creando usuario:', userErr.message); process.exit(1) }
  console.log('✅ Usuario admin:', user.email, '(password: Admin1234!)')
}

async function seedMenu(slug: string) {
  const tenantId = await getTenantId(slug)
  console.log('🌱 Insertando categorías, productos y mesas...')

  const { data: existingCats } = await supabase.from('menu_categories').select('name').eq('tenant_id', tenantId)
  const existingCatNames = new Set(existingCats?.map(c => c.name) ?? [])

  const categoryNames = ['Tacos', 'Quesadillas', 'Bebidas', 'Postres']
  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i]
    if (existingCatNames.has(name)) { console.log('⏭️  Categoría ya existe:', name); continue }
    const { error } = await supabase.from('menu_categories').insert({ name, sort_order: i, tenant_id: tenantId })
    if (error) console.warn('⚠️ Categoría:', name, error.message)
    else console.log('✅ Categoría:', name)
  }

  const { data: cats } = await supabase.from('menu_categories').select('*').eq('tenant_id', tenantId)
  const catMap: Record<string, string> = {}
  cats?.forEach(c => { catMap[c.name] = c.id })

  const { data: existingProds } = await supabase.from('menu_products').select('name').eq('tenant_id', tenantId)
  const existingProdNames = new Set(existingProds?.map(p => p.name) ?? [])

  const products = [
    { name: 'Taco de Birria',      description: 'Con consomé',                  price_mxn: 35, category: 'Tacos' },
    { name: 'Taco de Asada',       description: 'Carne a las brasas',            price_mxn: 30, category: 'Tacos' },
    { name: 'Taco de Pastor',      description: 'Con piña y cilantro',           price_mxn: 28, category: 'Tacos' },
    { name: 'Taco de Carnitas',    description: 'Cerdo frito',                   price_mxn: 30, category: 'Tacos' },
    { name: 'Quesadilla Sencilla', description: 'Queso Oaxaca',                  price_mxn: 45, category: 'Quesadillas' },
    { name: 'Quesadilla Asada',    description: 'Carne + queso',                 price_mxn: 65, category: 'Quesadillas' },
    { name: 'Agua Fresca',         description: 'Horchata, Jamaica o Tamarindo', price_mxn: 25, category: 'Bebidas' },
    { name: 'Refresco',            description: 'Coca, Sprite, Fanta',           price_mxn: 20, category: 'Bebidas' },
    { name: 'Agua Mineral',        description: '600ml',                         price_mxn: 18, category: 'Bebidas' },
    { name: 'Churros',             description: 'Con cajeta',                    price_mxn: 35, category: 'Postres' },
  ]

  for (const p of products) {
    if (existingProdNames.has(p.name)) { console.log('⏭️  Producto ya existe:', p.name); continue }
    const catId = catMap[p.category]
    if (!catId) { console.warn('⚠️ No hay categoría:', p.category); continue }
    const { error } = await supabase.from('menu_products').insert({
      name: p.name, description: p.description, price_mxn: p.price_mxn,
      category_id: catId, tenant_id: tenantId, is_active: true, preparation_time_min: 10,
    })
    if (error) console.warn('⚠️ Producto:', p.name, error.message)
    else console.log('✅ Producto:', p.name)
  }

  const { data: existingTables } = await supabase.from('tables').select('number').eq('tenant_id', tenantId)
  const existingNums = new Set(existingTables?.map(t => t.number) ?? [])

  const tables = [
    { number: 1, name: 'Mesa 1', capacity: 4 },
    { number: 2, name: 'Mesa 2', capacity: 4 },
    { number: 3, name: 'Mesa 3', capacity: 6 },
    { number: 4, name: 'Mesa 4', capacity: 2 },
    { number: 5, name: 'Mesa 5', capacity: 4 },
    { number: 6, name: 'Mesa 6', capacity: 8 },
  ]
  for (const t of tables) {
    if (existingNums.has(t.number)) { console.log('⏭️  Mesa ya existe:', t.number); continue }
    const { error } = await supabase.from('tables').insert({ ...t, tenant_id: tenantId, status: 'available' })
    if (error) console.warn('⚠️ Mesa:', t.number, error.message)
    else console.log('✅ Mesa:', t.number)
  }

  console.log('🎉 Menú completado')
}

// Ingredientes y recetas: birria estilo Jalisco, asada, pastor, carnitas, suadero,
// quesadillas, consomé, salsa verde, aguas frescas, churros.
const INGREDIENTS = [
  { name: 'Carne de res (para birria/asada)',  unit: 'kg',    stock: 6,    min_stock: 1,    cost_per_unit: 180, category: 'Carnes' },
  { name: 'Carne de cerdo (pastor)',           unit: 'kg',    stock: 4,    min_stock: 1,    cost_per_unit: 120, category: 'Carnes' },
  { name: 'Carnitas',                          unit: 'kg',    stock: 3,    min_stock: 0.5,  cost_per_unit: 140, category: 'Carnes' },
  { name: 'Suadero',                           unit: 'kg',    stock: 3,    min_stock: 0.5,  cost_per_unit: 150, category: 'Carnes' },
  { name: 'Tortilla de maíz',                 unit: 'pza',   stock: 300,  min_stock: 60,   cost_per_unit: 1.5,  category: 'Básicos' },
  { name: 'Tortilla de harina',               unit: 'pza',   stock: 60,   min_stock: 10,   cost_per_unit: 2.5,  category: 'Básicos' },
  { name: 'Harina de trigo',                  unit: 'kg',    stock: 3,    min_stock: 0.5,  cost_per_unit: 22,   category: 'Básicos' },
  { name: 'Queso Oaxaca',                     unit: 'kg',    stock: 2.5,  min_stock: 0.5,  cost_per_unit: 180,  category: 'Lácteos' },
  { name: 'Cebolla blanca',                   unit: 'kg',    stock: 4,    min_stock: 0.5,  cost_per_unit: 25,   category: 'Verduras' },
  { name: 'Cilantro',                         unit: 'kg',    stock: 0.5,  min_stock: 0.1,  cost_per_unit: 40,   category: 'Verduras' },
  { name: 'Tomate verde (tomatillo)',          unit: 'kg',    stock: 2,    min_stock: 0.5,  cost_per_unit: 30,   category: 'Verduras' },
  { name: 'Jitomate',                         unit: 'kg',    stock: 1.5,  min_stock: 0.3,  cost_per_unit: 28,   category: 'Verduras' },
  { name: 'Ajo',                              unit: 'kg',    stock: 0.5,  min_stock: 0.1,  cost_per_unit: 60,   category: 'Verduras' },
  { name: 'Limón',                            unit: 'pza',   stock: 60,   min_stock: 12,   cost_per_unit: 2,    category: 'Verduras' },
  { name: 'Piña',                             unit: 'kg',    stock: 3,    min_stock: 0.5,  cost_per_unit: 30,   category: 'Verduras' },
  { name: 'Aguacate',                         unit: 'kg',    stock: 2,    min_stock: 0.5,  cost_per_unit: 65,   category: 'Verduras' },
  { name: 'Chile serrano',                    unit: 'kg',    stock: 0.4,  min_stock: 0.05, cost_per_unit: 50,   category: 'Chiles' },
  { name: 'Chile de árbol',                   unit: 'kg',    stock: 0.2,  min_stock: 0.05, cost_per_unit: 80,   category: 'Chiles' },
  { name: 'Chile guajillo',                   unit: 'kg',    stock: 0.3,  min_stock: 0.05, cost_per_unit: 90,   category: 'Chiles' },
  { name: 'Chile ancho',                      unit: 'kg',    stock: 0.2,  min_stock: 0.05, cost_per_unit: 95,   category: 'Chiles' },
  { name: 'Chile chipotle',                   unit: 'kg',    stock: 0.15, min_stock: 0.05, cost_per_unit: 100,  category: 'Chiles' },
  { name: 'Sal',                              unit: 'kg',    stock: 1.5,  min_stock: 0.2,  cost_per_unit: 15,   category: 'Especias' },
  { name: 'Orégano seco',                     unit: 'kg',    stock: 0.2,  min_stock: 0.05, cost_per_unit: 100,  category: 'Especias' },
  { name: 'Comino',                           unit: 'kg',    stock: 0.15, min_stock: 0.03, cost_per_unit: 120,  category: 'Especias' },
  { name: 'Canela en rama',                   unit: 'kg',    stock: 0.1,  min_stock: 0.02, cost_per_unit: 220,  category: 'Especias' },
  { name: 'Pimienta negra',                   unit: 'kg',    stock: 0.1,  min_stock: 0.02, cost_per_unit: 130,  category: 'Especias' },
  { name: 'Clavo de olor',                    unit: 'kg',    stock: 0.05, min_stock: 0.01, cost_per_unit: 400,  category: 'Especias' },
  { name: 'Azúcar',                           unit: 'kg',    stock: 2,    min_stock: 0.5,  cost_per_unit: 25,   category: 'Especias' },
  { name: 'Aceite vegetal',                   unit: 'litro', stock: 4,    min_stock: 1,    cost_per_unit: 40,   category: 'Aceites' },
  { name: 'Vinagre blanco',                   unit: 'litro', stock: 0.5,  min_stock: 0.1,  cost_per_unit: 20,   category: 'Aceites' },
  { name: 'Agua purificada',                  unit: 'litro', stock: 25,   min_stock: 5,    cost_per_unit: 5,    category: 'Bebidas' },
  { name: 'Refresco 355ml (pieza)',            unit: 'pza',   stock: 30,   min_stock: 6,    cost_per_unit: 12,   category: 'Bebidas' },
  { name: 'Agua mineral 600ml (pieza)',        unit: 'pza',   stock: 30,   min_stock: 6,    cost_per_unit: 8,    category: 'Bebidas' },
  { name: 'Jamaica seca',                     unit: 'kg',    stock: 0.5,  min_stock: 0.1,  cost_per_unit: 120,  category: 'Bebidas' },
  { name: 'Arroz (para horchata)',            unit: 'kg',    stock: 1,    min_stock: 0.2,  cost_per_unit: 30,   category: 'Bebidas' },
  { name: 'Tamarindo (pulpa)',                unit: 'kg',    stock: 0.5,  min_stock: 0.1,  cost_per_unit: 80,   category: 'Bebidas' },
  { name: 'Cajeta',                           unit: 'litro', stock: 1,    min_stock: 0.2,  cost_per_unit: 85,   category: 'Repostería' },
  { name: 'Leche entera',                     unit: 'litro', stock: 2,    min_stock: 0.5,  cost_per_unit: 24,   category: 'Repostería' },
  { name: 'Huevo',                            unit: 'pza',   stock: 30,   min_stock: 6,    cost_per_unit: 4,    category: 'Repostería' },
  { name: 'Caldo de res (consomé base)',      unit: 'litro', stock: 8,    min_stock: 2,    cost_per_unit: 30,   category: 'Fondos' },
]

const RECIPES: Record<string, { ingredient: string; quantity: number; unit: string }[]> = {
  'Taco de Birria': [
    { ingredient: 'Carne de res (para birria/asada)', quantity: 0.1,   unit: 'kg' },
    { ingredient: 'Tortilla de maíz',                quantity: 2,     unit: 'pza' },
    { ingredient: 'Chile guajillo',                   quantity: 0.008, unit: 'kg' },
    { ingredient: 'Chile ancho',                      quantity: 0.005, unit: 'kg' },
    { ingredient: 'Chile de árbol',                   quantity: 0.002, unit: 'kg' },
    { ingredient: 'Ajo',                              quantity: 0.005, unit: 'kg' },
    { ingredient: 'Cebolla blanca',                   quantity: 0.02,  unit: 'kg' },
    { ingredient: 'Cilantro',                         quantity: 0.005, unit: 'kg' },
    { ingredient: 'Orégano seco',                     quantity: 0.001, unit: 'kg' },
    { ingredient: 'Comino',                           quantity: 0.001, unit: 'kg' },
    { ingredient: 'Clavo de olor',                    quantity: 0.0003,unit: 'kg' },
    { ingredient: 'Limón',                            quantity: 0.5,   unit: 'pza' },
    { ingredient: 'Caldo de res (consomé base)',      quantity: 0.15,  unit: 'litro' },
    { ingredient: 'Sal',                              quantity: 0.002, unit: 'kg' },
  ],
  'Taco de Asada': [
    { ingredient: 'Carne de res (para birria/asada)', quantity: 0.1,   unit: 'kg' },
    { ingredient: 'Tortilla de maíz',                quantity: 2,     unit: 'pza' },
    { ingredient: 'Limón',                            quantity: 1,     unit: 'pza' },
    { ingredient: 'Ajo',                              quantity: 0.005, unit: 'kg' },
    { ingredient: 'Cebolla blanca',                   quantity: 0.015, unit: 'kg' },
    { ingredient: 'Cilantro',                         quantity: 0.005, unit: 'kg' },
    { ingredient: 'Chile chipotle',                   quantity: 0.005, unit: 'kg' },
    { ingredient: 'Aceite vegetal',                   quantity: 0.01,  unit: 'litro' },
    { ingredient: 'Sal',                              quantity: 0.002, unit: 'kg' },
    { ingredient: 'Aguacate',                         quantity: 0.03,  unit: 'kg' },
  ],
  'Taco de Pastor': [
    { ingredient: 'Carne de cerdo (pastor)',          quantity: 0.09,  unit: 'kg' },
    { ingredient: 'Tortilla de maíz',                quantity: 2,     unit: 'pza' },
    { ingredient: 'Chile guajillo',                   quantity: 0.008, unit: 'kg' },
    { ingredient: 'Chile ancho',                      quantity: 0.004, unit: 'kg' },
    { ingredient: 'Chile chipotle',                   quantity: 0.003, unit: 'kg' },
    { ingredient: 'Ajo',                              quantity: 0.004, unit: 'kg' },
    { ingredient: 'Cebolla blanca',                   quantity: 0.015, unit: 'kg' },
    { ingredient: 'Cilantro',                         quantity: 0.005, unit: 'kg' },
    { ingredient: 'Piña',                             quantity: 0.025, unit: 'kg' },
    { ingredient: 'Limón',                            quantity: 0.5,   unit: 'pza' },
    { ingredient: 'Vinagre blanco',                   quantity: 0.01,  unit: 'litro' },
    { ingredient: 'Orégano seco',                     quantity: 0.001, unit: 'kg' },
    { ingredient: 'Comino',                           quantity: 0.001, unit: 'kg' },
    { ingredient: 'Sal',                              quantity: 0.002, unit: 'kg' },
  ],
  'Taco de Carnitas': [
    { ingredient: 'Carnitas',                         quantity: 0.09,  unit: 'kg' },
    { ingredient: 'Tortilla de maíz',                quantity: 2,     unit: 'pza' },
    { ingredient: 'Cebolla blanca',                   quantity: 0.015, unit: 'kg' },
    { ingredient: 'Cilantro',                         quantity: 0.005, unit: 'kg' },
    { ingredient: 'Limón',                            quantity: 0.5,   unit: 'pza' },
    { ingredient: 'Aceite vegetal',                   quantity: 0.02,  unit: 'litro' },
    { ingredient: 'Ajo',                              quantity: 0.003, unit: 'kg' },
    { ingredient: 'Orégano seco',                     quantity: 0.001, unit: 'kg' },
    { ingredient: 'Sal',                              quantity: 0.002, unit: 'kg' },
  ],
  'Taco de Suadero': [
    { ingredient: 'Suadero',                          quantity: 0.09,  unit: 'kg' },
    { ingredient: 'Tortilla de maíz',                quantity: 2,     unit: 'pza' },
    { ingredient: 'Cebolla blanca',                   quantity: 0.015, unit: 'kg' },
    { ingredient: 'Cilantro',                         quantity: 0.005, unit: 'kg' },
    { ingredient: 'Limón',                            quantity: 0.5,   unit: 'pza' },
    { ingredient: 'Ajo',                              quantity: 0.003, unit: 'kg' },
    { ingredient: 'Orégano seco',                     quantity: 0.001, unit: 'kg' },
    { ingredient: 'Sal',                              quantity: 0.002, unit: 'kg' },
    { ingredient: 'Aceite vegetal',                   quantity: 0.01,  unit: 'litro' },
  ],
  'Quesadilla Sencilla': [
    { ingredient: 'Tortilla de harina',              quantity: 1,     unit: 'pza' },
    { ingredient: 'Queso Oaxaca',                    quantity: 0.08,  unit: 'kg' },
    { ingredient: 'Aceite vegetal',                  quantity: 0.005, unit: 'litro' },
    { ingredient: 'Sal',                             quantity: 0.001, unit: 'kg' },
  ],
  'Quesadilla Asada': [
    { ingredient: 'Tortilla de harina',              quantity: 1,     unit: 'pza' },
    { ingredient: 'Queso Oaxaca',                    quantity: 0.08,  unit: 'kg' },
    { ingredient: 'Carne de res (para birria/asada)',quantity: 0.08,  unit: 'kg' },
    { ingredient: 'Aceite vegetal',                  quantity: 0.005, unit: 'litro' },
    { ingredient: 'Cebolla blanca',                  quantity: 0.01,  unit: 'kg' },
    { ingredient: 'Sal',                             quantity: 0.001, unit: 'kg' },
  ],
  'Consomé': [
    { ingredient: 'Caldo de res (consomé base)',     quantity: 0.3,   unit: 'litro' },
    { ingredient: 'Cebolla blanca',                  quantity: 0.01,  unit: 'kg' },
    { ingredient: 'Cilantro',                        quantity: 0.003, unit: 'kg' },
    { ingredient: 'Chile de árbol',                  quantity: 0.002, unit: 'kg' },
    { ingredient: 'Orégano seco',                    quantity: 0.001, unit: 'kg' },
    { ingredient: 'Limón',                           quantity: 0.5,   unit: 'pza' },
    { ingredient: 'Sal',                             quantity: 0.001, unit: 'kg' },
  ],
  'Salsa Verde': [
    { ingredient: 'Tomate verde (tomatillo)',        quantity: 0.1,   unit: 'kg' },
    { ingredient: 'Chile serrano',                   quantity: 0.02,  unit: 'kg' },
    { ingredient: 'Cebolla blanca',                  quantity: 0.015, unit: 'kg' },
    { ingredient: 'Ajo',                             quantity: 0.003, unit: 'kg' },
    { ingredient: 'Cilantro',                        quantity: 0.01,  unit: 'kg' },
    { ingredient: 'Sal',                             quantity: 0.002, unit: 'kg' },
    { ingredient: 'Agua purificada',                 quantity: 0.03,  unit: 'litro' },
  ],
  'Orden de Tortillas': [
    { ingredient: 'Tortilla de maíz',               quantity: 5,     unit: 'pza' },
  ],
  'Agua Fresca': [
    { ingredient: 'Agua purificada',                quantity: 0.4,   unit: 'litro' },
    { ingredient: 'Azúcar',                         quantity: 0.025, unit: 'kg' },
    { ingredient: 'Jamaica seca',                   quantity: 0.008, unit: 'kg' },
    { ingredient: 'Arroz (para horchata)',           quantity: 0.02,  unit: 'kg' },
    { ingredient: 'Tamarindo (pulpa)',              quantity: 0.01,  unit: 'kg' },
    { ingredient: 'Canela en rama',                 quantity: 0.001, unit: 'kg' },
  ],
  'Refresco': [
    { ingredient: 'Refresco 355ml (pieza)',         quantity: 1,     unit: 'pza' },
  ],
  'Agua Mineral': [
    { ingredient: 'Agua mineral 600ml (pieza)',     quantity: 1,     unit: 'pza' },
  ],
  'Churros': [
    { ingredient: 'Harina de trigo',               quantity: 0.06,  unit: 'kg' },
    { ingredient: 'Agua purificada',               quantity: 0.08,  unit: 'litro' },
    { ingredient: 'Aceite vegetal',                quantity: 0.2,   unit: 'litro' },
    { ingredient: 'Azúcar',                        quantity: 0.02,  unit: 'kg' },
    { ingredient: 'Canela en rama',               quantity: 0.003, unit: 'kg' },
    { ingredient: 'Sal',                           quantity: 0.001, unit: 'kg' },
    { ingredient: 'Huevo',                         quantity: 1,     unit: 'pza' },
    { ingredient: 'Cajeta',                        quantity: 0.05,  unit: 'litro' },
  ],
}

async function seedRecipes(slug: string) {
  const tenantId = await getTenantId(slug)
  console.log('🌱 Insertando ingredientes y recetas...')

  const { data: existingIngs } = await supabase.from('ingredients').select('id, name').eq('tenant_id', tenantId)
  const ingMap: Record<string, string> = {}
  existingIngs?.forEach(i => { ingMap[i.name] = i.id })

  for (const ing of INGREDIENTS) {
    if (ingMap[ing.name]) { console.log(`⏭️  Ingrediente ya existe: ${ing.name}`); continue }
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ ...ing, tenant_id: tenantId, is_active: true })
      .select('id, name').single()
    if (error) console.warn(`⚠️  ${ing.name}: ${error.message}`)
    else { ingMap[data.name] = data.id; console.log(`✅  ${data.name}`) }
  }

  const { data: products } = await supabase.from('menu_products').select('id, name').eq('tenant_id', tenantId)
  const prodMap: Record<string, string> = {}
  products?.forEach(p => { prodMap[p.name] = p.id })

  for (const [productName, items] of Object.entries(RECIPES)) {
    const productId = prodMap[productName]
    if (!productId) { console.warn(`⚠️  Producto no encontrado: "${productName}" — omitiendo`); continue }

    await supabase.from('recipes').delete().eq('product_id', productId).eq('tenant_id', tenantId)

    const recipeRows = []
    for (const item of items) {
      const ingredientId = ingMap[item.ingredient]
      if (!ingredientId) { console.warn(`⚠️  "${productName}" — ingrediente no encontrado: ${item.ingredient}`); continue }
      recipeRows.push({ tenant_id: tenantId, product_id: productId, ingredient_id: ingredientId, quantity: item.quantity, unit: item.unit })
    }

    if (recipeRows.length > 0) {
      const { error } = await supabase.from('recipes').insert(recipeRows)
      if (error) console.warn(`❌  "${productName}": ${error.message}`)
      else console.log(`✅  "${productName}" — ${recipeRows.length} ingrediente(s)`)
    }
  }

  console.log('🎉 Recetas completadas')
}

async function main() {
  const step = process.argv[2] ?? 'all'
  const slug = process.argv[3] ?? DEFAULT_SLUG

  if (step === 'all' || step === 'tenant') await seedTenantAndAdmin(slug)
  if (step === 'all' || step === 'menu') await seedMenu(slug)
  if (step === 'all' || step === 'recipes') await seedRecipes(slug)

  if (!['all', 'tenant', 'menu', 'recipes'].includes(step)) {
    console.error(`❌ Paso desconocido "${step}". Usa: tenant | menu | recipes | all`)
    process.exit(1)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
