import React, { useState } from 'react';
import { Trash2, Sun, Battery, Zap, Home, Droplet, Car, PlugZap } from 'lucide-react';
import { format } from 'date-fns';
import {
  Device,
  DeviceType,
  SolarInverterState,
  BatteryState,
  ApplianceState,
  MeterState,
  BatteryControlCommand,
  BatteryControlMode,
  ApplianceControlCommand,
  ApplianceConfig,
  HotWaterStorageState,
  HotWaterStorageControlCommand,
  EVState,
  EVChargerState,
  EVChargerControlCommand
} from '../types';
import { apiClient } from '../utils/api';

interface DeviceCardProps {
  device: Device;
  onDeviceDeleted: (deviceId: string) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onDeviceDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<Device>(device);

  React.useEffect(() => {
    setCurrentDevice(device);
  }, [device]);

  const getDeviceIcon = () => {
    switch (currentDevice.deviceType) {
      case DeviceType.SolarInverter:
        return <Sun size={20} style={{ color: '#f59e0b' }} />;
      case DeviceType.Battery:
        return <Battery size={20} style={{ color: '#10b981' }} />;
      case DeviceType.Appliance:
        return <Zap size={20} style={{ color: '#3b82f6' }} />;
      case DeviceType.Meter:
        return <Home size={20} style={{ color: '#6b7280' }} />;
      case DeviceType.HotWaterStorage:
        return <Droplet size={20} style={{ color: '#0ea5e9' }} />;
      case DeviceType.EV:
        return <Car size={20} style={{ color: '#111827' }} />;
      case DeviceType.EVCharger:
        return <PlugZap size={20} style={{ color: '#7c3aed' }} />;
      default:
        return <div style={{ width: 20, height: 20 }} />;
    }
  };

  const getDeviceTypeLabel = () => {
    switch (currentDevice.deviceType) {
      case DeviceType.SolarInverter:
        return 'Solar Inverter';
      case DeviceType.Battery:
        return 'Battery';
      case DeviceType.Appliance:
        return 'Appliance';
      case DeviceType.Meter:
        return 'Smart Meter';
      case DeviceType.HotWaterStorage:
        return 'Hot Water Storage';
      case DeviceType.EV:
        return 'EV';
      case DeviceType.EVCharger:
        return 'EV Charger';
      default:
        return device.deviceType;
    }
  };

  const renderMetrics = () => {
    switch (currentDevice.deviceType) {
      case DeviceType.SolarInverter: {
        const state = currentDevice.state as SolarInverterState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{state.powerW.toFixed(0)}</div>
              <div className="metric-label">Watts</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.energyTodayKwh.toFixed(2)}</div>
              <div className="metric-label">kWh Today</div>
            </div>
          </div>
        );
      }

      case DeviceType.Battery: {
        const state = currentDevice.state as BatteryState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{Math.round(state.batteryLevel * 100)}%</div>
              <div className="metric-label">Charge</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.powerW > 0 ? '+' : ''}{state.powerW.toFixed(0)}</div>
              <div className="metric-label">Watts</div>
            </div>
          </div>
        );
      }

      case DeviceType.Appliance: {
        const state = currentDevice.state as ApplianceState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{state.isOn ? 'ON' : 'OFF'}</div>
              <div className="metric-label">Status</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.powerW.toFixed(0)}</div>
              <div className="metric-label">Watts</div>
            </div>
          </div>
        );
      }

      case DeviceType.Meter: {
        const state = currentDevice.state as MeterState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{state.powerW > 0 ? '+' : ''}{state.powerW.toFixed(0)}</div>
              <div className="metric-label">{state.powerW > 0 ? 'Import' : 'Export'}</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.energyImportTodayKwh.toFixed(2)}</div>
              <div className="metric-label">kWh Today</div>
            </div>
          </div>
        );
      }

      case DeviceType.HotWaterStorage: {
        const state = currentDevice.state as HotWaterStorageState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{state.waterTemperatureC.toFixed(1)}°C</div>
              <div className="metric-label">Water Temp</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.targetTemperatureC.toFixed(1)}°C</div>
              <div className="metric-label">Target</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.power > 0 ? '+' : ''}{state.power.toFixed(0)}</div>
              <div className="metric-label">Watts</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.isHotWaterBoostOn ? 'BOOST ON' : 'BOOST OFF'}</div>
              <div className="metric-label">Boost</div>
            </div>
          </div>
        );
      }

      case DeviceType.EV: {
        const state = currentDevice.state as EVState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{Math.round(state.batteryLevel * 100)}%</div>
              <div className="metric-label">Battery</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.isCharging ? 'Charging' : 'Idle'}</div>
              <div className="metric-label">Status</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.powerW > 0 ? '+' : ''}{state.powerW.toFixed(0)}</div>
              <div className="metric-label">Watts</div>
            </div>
          </div>
        );
      }

      case DeviceType.EVCharger: {
        const state = currentDevice.state as EVChargerState;
        return (
          <div className="device-metrics">
            <div className="metric">
              <div className="metric-value">{state.isCharging ? 'ON' : 'OFF'}</div>
              <div className="metric-label">Charging</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.powerW > 0 ? '+' : ''}{state.powerW.toFixed(0)}</div>
              <div className="metric-label">Watts</div>
            </div>
            <div className="metric">
              <div className="metric-value">{state.targetPowerW ? state.targetPowerW.toFixed(0) : '-'}</div>
              <div className="metric-label">Target W</div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this device?')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteDevice(currentDevice.deviceId);
      onDeviceDeleted(currentDevice.deviceId);
    } catch (err) {
      alert('Failed to delete device: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBatteryControl = async (mode: BatteryControlMode, powerW?: number) => {
    try {
      setControlLoading(true);
      const command: BatteryControlCommand = { mode, powerW };
      await apiClient.controlBattery(currentDevice.deviceId, command);
      alert(`Battery control set to ${mode}${powerW ? ` at ${powerW}W` : ''}`);
    } catch (err) {
      alert('Failed to control battery: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setControlLoading(false);
    }
  };

  const handleApplianceControl = async (isOn: boolean) => {
    try {
      setControlLoading(true);
      const command: ApplianceControlCommand = { isOn };
      await apiClient.controlAppliance(currentDevice.deviceId, command);
      alert(`Appliance turned ${isOn ? 'ON' : 'OFF'}`);
    } catch (err) {
      alert('Failed to control appliance: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setControlLoading(false);
    }
  };

  const handleHotWaterControl = async (boostOn: boolean) => {
    try {
      setControlLoading(true);
      const command: HotWaterStorageControlCommand = { boostOn };
      await apiClient.controlHotWaterStorage(currentDevice.deviceId, command);
      alert(`Hot water boost turned ${boostOn ? 'ON' : 'OFF'}`);
    } catch (err) {
      alert('Failed to control hot water storage: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setControlLoading(false);
    }
  };

  const handleEVChargerControl = async (isCharging: boolean, targetPowerW?: number) => {
    try {
      setControlLoading(true);
      const command: EVChargerControlCommand = { isCharging, targetPowerW };
      await apiClient.controlEVCharger(currentDevice.deviceId, command);
      const updated = await apiClient.getDevice(currentDevice.deviceId);
      setCurrentDevice(updated);
      alert(`EV charger ${isCharging ? 'started' : 'stopped'}${targetPowerW ? ` at ${targetPowerW}W` : ''}`);
    } catch (err) {
      alert('Failed to control EV charger: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setControlLoading(false);
    }
  };

  const isOnline = currentDevice.state && 'isOnline' in currentDevice.state ? (currentDevice.state as any).isOnline : true;

  return (
    <div className="device-card">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {getDeviceIcon()}
          <div>
            <div className="device-type">{getDeviceTypeLabel()}</div>
            <div className="device-name">
              {device.name || `${getDeviceTypeLabel()} ${device.deviceId.slice(0, 8)}`}
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="btn btn-danger btn-sm"
          title="Delete device"
        >
          {loading ? (
            <div className="spinner" style={{ width: '12px', height: '12px' }} />
          ) : (
            <Trash2 size={12} />
          )}
        </button>
      </div>

      {/* Status */}
      <div className="device-status">
        <div className={isOnline ? 'status-online' : 'status-offline'} />
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Metrics */}
      {renderMetrics()}

      {/* Battery Controls */}
      {device.deviceType === DeviceType.Battery && (
        <div style={{ 
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            marginBottom: '0.5rem',
            color: '#374151'
          }}>
            Battery Control
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => handleBatteryControl('auto')}
              disabled={controlLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Auto
            </button>
            <button
              onClick={() => handleBatteryControl('idle')}
              disabled={controlLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Idle
            </button>
            <button
              onClick={() => {
                const power = prompt('Enter charge power (W):', '2000');
                if (power && !isNaN(Number(power))) {
                  handleBatteryControl('force_charge', Number(power));
                }
              }}
              disabled={controlLoading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Force Charge
            </button>
            <button
              onClick={() => {
                const power = prompt('Enter discharge power (W):', '2000');
                if (power && !isNaN(Number(power))) {
                  handleBatteryControl('force_discharge', Number(power));
                }
              }}
              disabled={controlLoading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Force Discharge
            </button>
          </div>
          {controlLoading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Sending command...
            </div>
          )}
        </div>
      )}

      {/* Appliance Controls */}
      {device.deviceType === DeviceType.Appliance && (
        <div style={{ 
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            marginBottom: '0.5rem',
            color: '#374151'
          }}>
            Appliance Control
          </div>
          {(() => {
            const config = device.config as ApplianceConfig;
            const state = device.state as ApplianceState;
            
            if (!config.isControllable) {
              return (
                <div style={{ 
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  fontStyle: 'italic'
                }}>
                  This appliance is not controllable
                </div>
              );
            }

            return (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem'
              }}>
                <button
                  onClick={() => handleApplianceControl(true)}
                  disabled={controlLoading || state.isOn}
                  className={`btn btn-sm ${state.isOn ? 'btn-success' : 'btn-primary'}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {state.isOn ? '✓ ON' : 'Turn ON'}
                </button>
                <button
                  onClick={() => handleApplianceControl(false)}
                  disabled={controlLoading || !state.isOn}
                  className={`btn btn-sm ${!state.isOn ? 'btn-secondary' : 'btn-danger'}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {!state.isOn ? '✓ OFF' : 'Turn OFF'}
                </button>
              </div>
            );
          })()}
          {controlLoading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Sending command...
            </div>
          )}
        </div>
      )}

      {/* Hot Water Storage Controls */}
      {currentDevice.deviceType === DeviceType.HotWaterStorage && (
        <div style={{ 
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            marginBottom: '0.5rem',
            color: '#374151'
          }}>
            Hot Water Boost
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => handleHotWaterControl(true)}
              disabled={controlLoading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Turn Boost On
            </button>
            <button
              onClick={() => handleHotWaterControl(false)}
              disabled={controlLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Turn Boost Off
            </button>
          </div>
          {controlLoading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Sending command...
            </div>
          )}
        </div>
      )}

      {/* EV Charger Controls */}
      {currentDevice.deviceType === DeviceType.EVCharger && (
        <div style={{ 
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            marginBottom: '0.5rem',
            color: '#374151'
          }}>
            EV Charger Control
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => handleEVChargerControl(true)}
              disabled={controlLoading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Start Charging
            </button>
            <button
              onClick={() => handleEVChargerControl(false)}
              disabled={controlLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Stop Charging
            </button>
            <button
              onClick={() => {
                const power = prompt('Set target power (W):', '7000');
                if (power && !isNaN(Number(power))) {
                  handleEVChargerControl(true, Number(power));
                }
              }}
              disabled={controlLoading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Set Power
            </button>
          </div>
          {controlLoading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Sending command...
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        fontSize: '0.75rem', 
        color: '#9ca3af', 
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #f3f4f6'
      }}>
        Updated: {format(new Date(currentDevice.updatedAt), 'HH:mm:ss')}
      </div>
    </div>
  );
};

export default DeviceCard; 