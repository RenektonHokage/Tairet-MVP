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

-- TODO: Agregar más datos de prueba según necesidades

