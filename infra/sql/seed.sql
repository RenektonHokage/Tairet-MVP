-- Seed data para desarrollo/pruebas
-- UUIDs fijos para garantizar determinismo en desarrollo

-- Insertar 5 locales MVP con slugs exactos para B2C
-- Usar ON CONFLICT(id) DO UPDATE para permitir reseed idempotente
-- Si existe club-example-2 u otros locales de ejemplo, no se borran automáticamente
INSERT INTO locals (id, name, slug, type, description, phone, whatsapp, email, ticket_price)
VALUES
  -- Bares (ticket_price = 0 o bajo para bares)
  (
    '550e8400-e29b-41d4-a716-446655440001', -- Mantener UUID existente para compatibilidad con panel
    'Mckharthys Bar',
    'mckharthys-bar',
    'bar',
    'Mckharthys Bar es un emblema del entretenimiento nocturno en Asunción desde 1995.',
    '+595981234567',
    '+595981234567',
    'mckharthys@example.com',
    0.00
  ),
  (
    '550e8400-e29b-41d4-a716-446655440003',
    'Killkenny Pub',
    'killkenny-pub',
    'bar',
    'Killkenny Pub es un auténtico pub irlandés establecido en Villa Morra.',
    '+595982345678',
    '+595982345678',
    'killkenny@example.com',
    0.00
  ),
  -- Clubs/Discotecas (ticket_price > 0)
  (
    '550e8400-e29b-41d4-a716-446655440004',
    'Morgan',
    'morgan',
    'club',
    'Morgan es una discoteca de reggaeton en Asunción.',
    '+595983456789',
    '+595983456789',
    'morgan@example.com',
    50000.00
  ),
  (
    '550e8400-e29b-41d4-a716-446655440005',
    'Celavie',
    'celavie',
    'club',
    'Celavie es un club comercial en Asunción.',
    '+595984567890',
    '+595984567890',
    'celavie@example.com',
    60000.00
  ),
  (
    '550e8400-e29b-41d4-a716-446655440006',
    'DLirio',
    'dlirio',
    'club',
    'DLirio es un club de música electrónica en Asunción.',
    '+595985678901',
    '+595985678901',
    'dlirio@example.com',
    70000.00
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  phone = EXCLUDED.phone,
  whatsapp = EXCLUDED.whatsapp,
  email = EXCLUDED.email,
  ticket_price = EXCLUDED.ticket_price,
  updated_at = NOW();

-- Insertar promos para bares
INSERT INTO promos (id, local_id, title, description, image_url, start_date, end_date)
VALUES
  (
    '72dd49e1-2472-4f7c-9376-ef622af05daf', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440001', -- mckharthys-bar
    'Promo de Prueba',
    'Descripción de la promo de prueba',
    'https://example.com/promo.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '7 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Insertar promos para clubs MVP
-- Morgan (3 promos)
INSERT INTO promos (id, local_id, title, description, image_url, start_date, end_date)
VALUES
  (
    'a1b2c3d4-e5f6-4789-a012-345678901234', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440004', -- morgan
    'Ladies Night',
    'Noche especial para damas con entrada reducida',
    'https://example.com/ladies-night.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  ),
  (
    'b2c3d4e5-f6a7-4890-b123-456789012345', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440004', -- morgan
    'Happy Hour',
    'Descuentos especiales en tragos',
    'https://example.com/happy-hour.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c3d4e5f6-a7b8-4901-c234-567890123456', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440004', -- morgan
    'Student Night',
    'Noche especial para estudiantes con descuentos',
    'https://example.com/student-night.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Celavie (3 promos)
INSERT INTO promos (id, local_id, title, description, image_url, start_date, end_date)
VALUES
  (
    'd4e5f6a7-b8c9-4012-d345-678901234567', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440005', -- celavie
    'Ladies Night',
    'Noche especial para damas con entrada reducida',
    'https://example.com/ladies-night.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  ),
  (
    'e5f6a7b8-c9d0-4123-e456-789012345678', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440005', -- celavie
    'Happy Hour',
    'Descuentos especiales en tragos',
    'https://example.com/happy-hour.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  ),
  (
    'f6a7b8c9-d0e1-4234-f567-890123456789', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440005', -- celavie
    'Student Night',
    'Noche especial para estudiantes con descuentos',
    'https://example.com/student-night.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  )
ON CONFLICT (id) DO NOTHING;

-- DLirio (3 promos)
INSERT INTO promos (id, local_id, title, description, image_url, start_date, end_date)
VALUES
  (
    'a7b8c9d0-e1f2-4345-a678-901234567890', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440006', -- dlirio
    'Bailongo - Sole Rössner',
    'Evento especial con DJ Sole Rössner',
    'https://example.com/bailongo.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  ),
  (
    'b8c9d0e1-f2a3-4456-b789-012345678901', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440006', -- dlirio
    'Tragos Fresh',
    'Promoción especial en tragos frescos',
    'https://example.com/tragos-fresh.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c9d0e1f2-a3b4-4567-c890-123456789012', -- UUID fijo para mapeo
    '550e8400-e29b-41d4-a716-446655440006', -- dlirio
    'La Fórmula Perfecta',
    'Combo especial de tragos y música',
    'https://example.com/formula.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Insertar profile_view de ejemplo (opcional)
INSERT INTO profile_views (local_id, ip_address, user_agent, source)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440001',
    '192.168.1.1',
    'Mozilla/5.0',
    'lovable_test'
  )
ON CONFLICT DO NOTHING;

-- Usuario de panel B2B de prueba
-- NOTA: Este usuario debe crearse primero en Supabase Auth (Authentication > Users > Add user)
-- Email: panel@tairet.test
-- Password: (configurar en Supabase Auth)
-- Luego copiar el auth_user_id (UUID) generado por Supabase y reemplazarlo en el INSERT siguiente
-- 
-- Para desarrollo local, puedes crear el usuario manualmente en Supabase Dashboard:
-- 1. Ir a Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Email: panel@tairet.test
-- 4. Password: (elegir una contraseña segura)
-- 5. Copiar el User UID generado
-- 6. Reemplazar 'REPLACE_WITH_AUTH_USER_ID' en el INSERT siguiente con ese UUID
--
-- INSERT INTO panel_users (auth_user_id, email, local_id, role)
-- VALUES
--   (
--     'REPLACE_WITH_AUTH_USER_ID', -- Reemplazar con el UUID del usuario creado en Supabase Auth
--     'panel@tairet.test',
--     '550e8400-e29b-41d4-a716-446655440001',
--     'owner'
--   )
-- ON CONFLICT (auth_user_id) DO NOTHING;

-- TODO: Agregar más datos de prueba según necesidades

