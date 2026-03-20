UPDATE devices
SET config = jsonb_set(config, '{role}', '"grid"', true)
WHERE device_type = 'meter'
  AND NOT (config ? 'role');

UPDATE devices
SET config = jsonb_set(config, '{role}', '"consumption"', true)
WHERE device_type = 'appliance'
  AND NOT (config ? 'role');
