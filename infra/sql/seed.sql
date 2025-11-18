-- Seed data para desarrollo/pruebas

-- Insertar 1-2 locales de ejemplo
INSERT INTO locals (id, name, slug, description, phone, whatsapp, email, ticket_price)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'Bar Example 1',
    'bar-example-1',
    'Bar de ejemplo para pruebas',
    '+595981234567',
    '+595981234567',
    'bar1@example.com',
    50000.00
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002',
    'Club Example 2',
    'club-example-2',
    'Club de ejemplo para pruebas',
    '+595982345678',
    '+595982345678',
    'club2@example.com',
    75000.00
  )
ON CONFLICT (slug) DO NOTHING;

-- Insertar 1 promo de ejemplo
INSERT INTO promos (local_id, title, description, image_url, start_date, end_date)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'Promo de Prueba',
    'Descripción de la promo de prueba',
    'https://example.com/promo.jpg',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '7 days'
  )
ON CONFLICT DO NOTHING;

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

