import React, { useState } from 'react';
import { X, Home } from 'lucide-react';
import { apiClient } from '../utils/api.ts';
import { Dwelling, CreateDwellingForm } from '../types/index.ts';

interface CreateDwellingModalProps {
  onClose: () => void;
  onDwellingCreated: (dwelling: Dwelling) => void;
}

const CreateDwellingModal: React.FC<CreateDwellingModalProps> = ({
  onClose,
  onDwellingCreated
}) => {
  const [formData, setFormData] = useState<CreateDwellingForm>({
    timeZone: 'America/New_York',
    location: {
      lat: 40.7128,
      lng: -74.0060
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'lat' || name === 'lng') {
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [name]: parseFloat(value) || 0
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const dwelling = await apiClient.createDwelling(formData);
      onDwellingCreated(dwelling);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dwelling');
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
      <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h2 className="card-title">
              <Home size={20} />
              Create New Dwelling
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
              <label htmlFor="timeZone" className="form-label">
                Time Zone
              </label>
              <select
                id="timeZone"
                name="timeZone"
                value={formData.timeZone}
                onChange={handleChange}
                className="form-select"
                required
                disabled={loading}
              >
                <option value="America/New_York">Eastern Time (New York)</option>
                <option value="America/Chicago">Central Time (Chicago)</option>
                <option value="America/Denver">Mountain Time (Denver)</option>
                <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                <option value="Europe/London">GMT (London)</option>
                <option value="Europe/Berlin">CET (Berlin)</option>
                <option value="Asia/Tokyo">JST (Tokyo)</option>
                <option value="Australia/Sydney">AEST (Sydney)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="lat" className="form-label">
                  Latitude
                </label>
                <input
                  type="number"
                  id="lat"
                  name="lat"
                  value={formData.location.lat}
                  onChange={handleChange}
                  className="form-input"
                  step="0.0001"
                  min="-90"
                  max="90"
                  required
                  disabled={loading}
                  placeholder="40.7128"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lng" className="form-label">
                  Longitude
                </label>
                <input
                  type="number"
                  id="lng"
                  name="lng"
                  value={formData.location.lng}
                  onChange={handleChange}
                  className="form-input"
                  step="0.0001"
                  min="-180"
                  max="180"
                  required
                  disabled={loading}
                  placeholder="-74.0060"
                />
              </div>
            </div>

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
                    <Home size={16} />
                    Create Dwelling
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

export default CreateDwellingModal; 