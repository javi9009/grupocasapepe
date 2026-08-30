-- ============================================================================
-- Mover Ateneo Virreyes de entity independiente a property de Sincrético
-- ============================================================================
-- Fecha: 2026-08-29
-- Decision: Javi Puente
-- Impacto: Reestrctura de entidades; Ateneo ahora pertenece a Sincrético
-- ============================================================================

-- 1. CAMBIO PRINCIPAL: Actualizar property Ateneo Virreyes
--    Cambiar entity_id de Ateneo de Virreyes → Sincrético
UPDATE properties
SET entity_id = 'f70154ca-3c1f-4679-bc89-a45c31ae40f4'  -- Sincrético
WHERE id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d'  -- Ateneo Virreyes CDMX
RETURNING id, nombre, entity_id;

-- 2. VERIFICACIÓN: Confirmar que la actualización fue correcta
SELECT 
  p.id,
  p.nombre as property_name,
  p.entity_id,
  e.nombre as entity_name
FROM properties p
LEFT JOIN entities e ON p.entity_id = e.id
WHERE p.id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d';

-- 3. VERIFICACIÓN: Listar todos los espacios bajo Ateneo Virreyes
SELECT 
  e.id,
  e.nombre,
  e.tipo,
  e.property_id
FROM espacios e
WHERE e.property_id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d'
ORDER BY e.tipo;

-- 4. VERIFICACIÓN: Listar reservas de espacios del Ateneo
SELECT 
  COUNT(*) as total_reservas,
  re.created_at
FROM reservas_espacio re
WHERE re.espacio_id IN (
  SELECT id FROM espacios WHERE property_id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d'
)
GROUP BY DATE(re.created_at)
ORDER BY re.created_at DESC;

-- 5. VERIFICACIÓN: Reglamento del Ateneo
SELECT 
  COUNT(*) as total_reglas
FROM reglamento r
WHERE r.property_id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d';

-- 6. VERIFICACIÓN: Info de propiedad del Ateneo
SELECT 
  COUNT(*) as info_records
FROM info_propiedad ip
WHERE ip.property_id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d';

-- 7. OPCIONAL: Ver quién tiene acceso a la property (user_modules/memberships)
SELECT DISTINCT
  um.user_id,
  u.email,
  COUNT(um.id) as modulos_asignados
FROM user_modules um
JOIN profiles u ON um.user_id = u.id
WHERE um.property_id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d'
GROUP BY um.user_id, u.email;

-- ============================================================================
-- POST-CAMBIO: Verificar cascada correcta
-- ============================================================================

-- 8. Confirmar que Ateneo es ahora property de Sincrético
SELECT 
  'Sincrético' as entity,
  COUNT(p.id) as properties
FROM entities e
JOIN properties p ON e.id = p.entity_id
WHERE e.id = 'f70154ca-3c1f-4679-bc89-a45c31ae40f4'
GROUP BY e.id;

-- 9. Listar todas las properties bajo Sincrético (debería incluir Ateneo)
SELECT 
  p.id,
  p.nombre,
  p.tipo,
  COUNT(DISTINCT e.id) as espacios,
  COUNT(DISTINCT re.id) as reservas
FROM properties p
LEFT JOIN espacios e ON p.id = e.property_id
LEFT JOIN reservas_espacio re ON e.id = re.espacio_id
WHERE p.entity_id = 'f70154ca-3c1f-4679-bc89-a45c31ae40f4'
GROUP BY p.id, p.nombre, p.tipo
ORDER BY p.nombre;

-- ============================================================================
-- NOTA: La entity "Ateneo de Virreyes" (06c2b780-9111-4a3a-a381-1d1c759a892b)
--       puede mantenerse para backward compatibility o deprecarse.
--       NO HACER DELETE en esta transacción.
-- ============================================================================
