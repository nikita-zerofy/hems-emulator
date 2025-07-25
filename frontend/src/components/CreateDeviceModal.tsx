import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { apiClient } from '../utils/api';
import { Device, DeviceType, CreateDeviceForm } from '../types';

interface CreateDeviceModalProps {
  dwellingId: string;
  onClose: () => void;
  onDeviceCreated: (device: Device) => void;
}

const CreateDeviceModal: React.FC<CreateDeviceModalProps> = ({
  dwellingId,
  onClose,
  onDeviceCreated
}) => {
  const [formData, setFormData] = useState<CreateDeviceForm>({
    deviceType: DeviceType.SolarInverter,
    name: '',
    config: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceType = e.target.value as DeviceType;
    setFormData({
      deviceType,
      name: '',
      config: getDefaultConfig(deviceType)
    });
  };

  const getDefaultConfig = (deviceType: DeviceType) => {
    switch (deviceType) {
      case DeviceType.SolarInverter:
        return {
          kwPeak: 5.0,
          efficiency: 0.85,
          azimuth: 180,
          tilt: 30
        };
      case DeviceType.Battery:
        return {
          capacityKwh: 13.5,
          maxChargePowerW: 5000,
          maxDischargePowerW: 5000,
          efficiency: 0.95,
          minSoc: 0.1,
          maxSoc: 1.0
        };
      case DeviceType.Appliance:
        return {
          name: 'Electric Vehicle Charger',
          powerW: 7000,
          isControllable: true
        };
      case DeviceType.Meter:
        return {
          type: 'bidirectional'
        };
      default:
        return {};
    }
  };

  const handleConfigChange = (key: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  const renderConfigFields = () => {
    switch (formData.deviceType) {
      case DeviceType.SolarInverter:
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Peak Power (kW)</label>
                <input
                  type="number"
                  value={(formData.config as any).kwPeak || ''}
                  onChange={(e) => handleConfigChange('kwPeak', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  step="0.1"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Efficiency</label>
                <input
                  type="number"
                  value={(formData.config as any).efficiency || ''}
                  onChange={(e) => handleConfigChange('efficiency', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  step="0.01"
                  min="0"
                  max="1"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Azimuth (degrees)</label>
                <input
                  type="number"
                  value={(formData.config as any).azimuth || ''}
                  onChange={(e) => handleConfigChange('azimuth', parseInt(e.target.value) || 0)}
                  className="form-input"
                  min="0"
                  max="360"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tilt (degrees)</label>
                <input
                  type="number"
                  value={(formData.config as any).tilt || ''}
                  onChange={(e) => handleConfigChange('tilt', parseInt(e.target.value) || 0)}
                  className="form-input"
                  min="0"
                  max="90"
                  required
                />
              </div>
            </div>
          </>
        );

      case DeviceType.Battery:
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Capacity (kWh)</label>
                <input
                  type="number"
                  value={(formData.config as any).capacityKwh || ''}
                  onChange={(e) => handleConfigChange('capacityKwh', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  step="0.1"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Efficiency</label>
                <input
                  type="number"
                  value={(formData.config as any).efficiency || ''}
                  onChange={(e) => handleConfigChange('efficiency', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  step="0.01"
                  min="0"
                  max="1"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Max Charge Power (W)</label>
                <input
                  type="number"
                  value={(formData.config as any).maxChargePowerW || ''}
                  onChange={(e) => handleConfigChange('maxChargePowerW', parseInt(e.target.value) || 0)}
                  className="form-input"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Discharge Power (W)</label>
                <input
                  type="number"
                  value={(formData.config as any).maxDischargePowerW || ''}
                  onChange={(e) => handleConfigChange('maxDischargePowerW', parseInt(e.target.value) || 0)}
                  className="form-input"
                  min="0"
                  required
                />
              </div>
            </div>
          </>
        );

      case DeviceType.Appliance:
        return (
          <>
            <div className="form-group">
              <label className="form-label">Appliance Name</label>
              <input
                type="text"
                value={(formData.config as any).name || ''}
                onChange={(e) => handleConfigChange('name', e.target.value)}
                className="form-input"
                placeholder="e.g., Electric Vehicle Charger"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Power Consumption (W)</label>
                <input
                  type="number"
                  value={(formData.config as any).powerW || ''}
                  onChange={(e) => handleConfigChange('powerW', parseInt(e.target.value) || 0)}
                  className="form-input"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Controllable</label>
                <select
                  value={(formData.config as any).isControllable ? 'true' : 'false'}
                  onChange={(e) => handleConfigChange('isControllable', e.target.value === 'true')}
                  className="form-select"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </>
        );

      case DeviceType.Meter:
        return (
          <div className="form-group">
            <label className="form-label">Meter Type</label>
            <select
              value={(formData.config as any).type || 'bidirectional'}
              onChange={(e) => handleConfigChange('type', e.target.value)}
              className="form-select"
              required
            >
              <option value="bidirectional">Bidirectional (Import/Export)</option>
              <option value="import">Import Only</option>
              <option value="export">Export Only</option>
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const device = await apiClient.createDevice(dwellingId, formData);
      onDeviceCreated(device);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '1rem', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h2 className="card-title">
              <Plus size={20} />
              Add New Device
            </h2>
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="card-content">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="deviceType" className="form-label">
                Device Type
              </label>
              <select
                id="deviceType"
                value={formData.deviceType}
                onChange={handleTypeChange}
                className="form-select"
                required
                disabled={loading}
              >
                <option value={DeviceType.SolarInverter}>Solar Inverter</option>
                <option value={DeviceType.Battery}>Battery</option>
                <option value={DeviceType.Appliance}>Smart Appliance</option>
                <option value={DeviceType.Meter}>Smart Meter</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Device Name (Optional)
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                disabled={loading}
                placeholder="Custom name for this device"
              />
            </div>

            {renderConfigFields()}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Device
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateDeviceModal; 