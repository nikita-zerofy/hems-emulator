import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, MapPin, Clock, Wifi, WifiOff } from 'lucide-react';
import { apiClient } from '../utils/api';
import { Dwelling, Device } from '../types';
import DeviceCard from '../components/DeviceCard';
import CreateDeviceModal from '../components/CreateDeviceModal';
import { useDwellingWebSocket } from '../hooks/useWebSocket';

const DwellingDetails: React.FC = () => {
  const { dwellingId } = useParams<{ dwellingId: string }>();
  const [dwelling, setDwelling] = useState<Dwelling | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // WebSocket connection for real-time updates
  const { isConnected, lastUpdate } = useDwellingWebSocket(dwellingId);

  useEffect(() => {
    if (dwellingId) {
      loadDwellingDetails();
    }
  }, [dwellingId]);

  const loadDwellingDetails = async () => {
    if (!dwellingId) return;

    try {
      setLoading(true);
      const [dwellingData, devicesData] = await Promise.all([
        apiClient.getDwelling(dwellingId),
        apiClient.getDwellingDevices(dwellingId)
      ]);
      setDwelling(dwellingData);
      setDevices(devicesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dwelling details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceCreated = (newDevice: Device) => {
    setDevices(prev => [...prev, newDevice]);
    setShowCreateModal(false);
  };

  const handleDeviceDeleted = (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
  };

  // Handle real-time updates from WebSocket
  useEffect(() => {
    if (lastUpdate) {
      console.log('📡 Received real-time update:', lastUpdate);
      setDevices(lastUpdate.devices);
    }
  }, [lastUpdate]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error || !dwelling) {
    return (
      <div className="container">
        <div className="alert alert-error">
          {error || 'Dwelling not found'}
        </div>
        <Link to="/" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link to="/" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className="flex-1">
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
            Dwelling Details
          </h1>
          <div className="flex items-center gap-4 text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin size={16} />
              <span>{dwelling.location.lat.toFixed(4)}, {dwelling.location.lng.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={16} />
              <span>{dwelling.timeZone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* WebSocket Status Indicator */}
          <div className="flex items-center gap-1" title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}>
            {isConnected ? (
              <Wifi size={16} style={{ color: '#10b981' }} />
            ) : (
              <WifiOff size={16} style={{ color: '#ef4444' }} />
            )}
            <span style={{ fontSize: '0.75rem', color: isConnected ? '#10b981' : '#ef4444' }}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Add Device
          </button>
        </div>
      </div>

      {/* Devices Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Devices ({devices.length})
          </h2>
        </div>

        <div className="card-content">
          {devices.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }}>🏠</div>
              <h3>No devices found</h3>
              <p>Add devices to start simulating energy flows</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary mt-3"
              >
                <Plus size={16} />
                Add Your First Device
              </button>
            </div>
          ) : (
            <div className="device-grid">
              {devices.map((device) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  onDeviceDeleted={handleDeviceDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Device Modal */}
      {showCreateModal && dwellingId && (
        <CreateDeviceModal
          dwellingId={dwellingId}
          onClose={() => setShowCreateModal(false)}
          onDeviceCreated={handleDeviceCreated}
        />
      )}
    </div>
  );
};

export default DwellingDetails; 