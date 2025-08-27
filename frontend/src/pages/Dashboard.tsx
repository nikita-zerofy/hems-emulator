import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Home, MapPin, Clock, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { apiClient } from '../utils/api.ts';
import { useDashboardWebSocket } from '../hooks/useWebSocket.ts';
import { Dwelling } from '../types/index.ts';
import CreateDwellingModal from '../components/CreateDwellingModal.tsx';

const Dashboard: React.FC = () => {
  const [dwellings, setDwellings] = useState<Dwelling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // WebSocket connection for real-time dwelling updates
  const { isConnected, dwellingUpdates } = useDashboardWebSocket();

  useEffect(() => {
    loadDwellings();
  }, []);

  const loadDwellings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDwellings();
      setDwellings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dwellings');
    } finally {
      setLoading(false);
    }
  };

  const handleDwellingCreated = (newDwelling: Dwelling) => {
    setDwellings(prev => [...prev, newDwelling]);
    setShowCreateModal(false);
  };

  const handleDeleteDwelling = async (dwellingId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to dwelling details
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this dwelling? This action cannot be undone and will delete all devices.')) {
      return;
    }

    try {
      await apiClient.deleteDwelling(dwellingId);
      setDwellings(prev => prev.filter(d => d.dwellingId !== dwellingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dwelling');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
            HEMS Dashboard
          </h1>
          {/* WebSocket Status Indicator */}
          <div className="flex items-center gap-1" title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}>
            {isConnected ? (
              <Wifi size={18} style={{ color: '#10b981' }} />
            ) : (
              <WifiOff size={18} style={{ color: '#ef4444' }} />
            )}
            <span style={{ fontSize: '0.875rem', color: isConnected ? '#10b981' : '#ef4444' }}>
              {isConnected ? 'Live Updates' : 'Offline'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          Create Dwelling
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {dwellings.length === 0 ? (
        <div className="empty-state">
          <Home className="empty-state-icon" />
          <h2>No dwellings found</h2>
          <p>Create your first dwelling to start simulating energy flows</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary mt-4"
          >
            <Plus size={16} />
            Create Your First Dwelling
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {dwellings.map((dwelling) => (
            <div key={dwelling.dwellingId} className="card">
              <div className="card-header">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Home size={20} style={{ color: '#2563eb' }} />
                    <h3 className="card-title">
                      Dwelling {dwelling.dwellingId.slice(0, 8)}...
                    </h3>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDwelling(dwelling.dwellingId, e)}
                    className="btn-icon btn-danger"
                    title="Delete dwelling"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <Link
                to={`/dwelling/${dwelling.dwellingId}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card-content">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={16} style={{ color: '#6b7280' }} />
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {dwelling.location.lat.toFixed(4)}, {dwelling.location.lng.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} style={{ color: '#6b7280' }} />
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {dwelling.timeZone}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div style={{ 
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      background: '#f0fdf4',
                      color: '#166534',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      {dwellingUpdates.get(dwelling.dwellingId)?.deviceCount ?? dwelling.devices?.length ?? 0} devices
                    </div>
                    
                    {dwellingUpdates.has(dwelling.dwellingId) && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#10b981'
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#10b981',
                          borderRadius: '50%',
                          animation: 'pulse 2s infinite'
                        }} />
                        Active
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateDwellingModal
          onClose={() => setShowCreateModal(false)}
          onDwellingCreated={handleDwellingCreated}
        />
      )}
    </div>
  );
};

export default Dashboard; 