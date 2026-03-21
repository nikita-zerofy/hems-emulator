DELETE FROM device_history a
USING device_history b
WHERE a.id < b.id
  AND a.device_id = b.device_id
  AND a.recorded_at = b.recorded_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_history_device_recorded_unique
  ON device_history(device_id, recorded_at);
