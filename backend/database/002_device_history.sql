CREATE TABLE device_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    dwelling_id UUID NOT NULL REFERENCES dwellings(dwelling_id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    power_w REAL NOT NULL,
    soc REAL,
    is_charging BOOLEAN,
    temperature_c REAL
);

CREATE INDEX idx_device_history_device_time ON device_history(device_id, recorded_at DESC);
CREATE INDEX idx_device_history_dwelling_time ON device_history(dwelling_id, recorded_at DESC);
CREATE INDEX idx_device_history_cleanup ON device_history(recorded_at);

CREATE TABLE daily_energy_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dwelling_id UUID NOT NULL REFERENCES dwellings(dwelling_id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    solar_production_kwh REAL NOT NULL DEFAULT 0,
    grid_import_kwh REAL NOT NULL DEFAULT 0,
    grid_export_kwh REAL NOT NULL DEFAULT 0,
    battery_charge_kwh REAL NOT NULL DEFAULT 0,
    battery_discharge_kwh REAL NOT NULL DEFAULT 0,
    household_consumption_kwh REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (dwelling_id, summary_date)
);

CREATE INDEX idx_daily_energy_summary_dwelling_date ON daily_energy_summary(dwelling_id, summary_date DESC);
