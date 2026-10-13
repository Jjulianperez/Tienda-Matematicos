-- ============================================================================
-- 001_init.sql — Línea base
-- ============================================================================
-- Este archivo NO se ejecuta sobre una base existente: es una foto del
-- esquema en el commit donde se introdujo el versionado de migraciones.
--
-- Si tu base YA existe (la creaste con el antiguo supabase-schema.sql),
-- salteá este archivo y ejecutá directamente las migraciones 002 en adelante.
--
-- Para una base nueva: ejecutá este archivo y después 002_customers.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}',
  whatsapp_clicks INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  weight INTEGER CHECK (weight IS NULL OR weight > 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  product_name TEXT,
  price_at_order DECIMAL(10,2),
  combo_items JSONB,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('combo', 'promo')),
  image TEXT,
  price DECIMAL(10,2),
  discount_type TEXT CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(10,2),
  min_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  kind TEXT DEFAULT 'quantity' CHECK (kind IN ('quantity', 'weight')),
  min_weight INTEGER CHECK (min_weight IS NULL OR min_weight > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items que componen una promoción o combo
CREATE TABLE IF NOT EXISTS promotion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE (promotion_id, product_id),
  UNIQUE (promotion_id, category_id)
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuraciones editables desde el panel admin
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías por defecto
INSERT INTO categories (name, slug) VALUES
  ('Mates', 'mates'),
  ('Bombillas', 'bombillas'),
  ('Termos', 'termos'),
  ('Yerbas', 'yerbas'),
  ('Accesorios', 'accesorios')
ON CONFLICT (slug) DO NOTHING;
