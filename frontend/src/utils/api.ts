import axios, { AxiosInstance } from 'axios';
import { 
  ApiResponse, 
  AuthResponse, 
  User, 
  Dwelling, 
  Device, 
  LoginForm, 
  RegisterForm, 
  CreateDwellingForm,
  BatteryControlCommand,
  ApplianceControlCommand,
  CreateDeviceForm 
} from '../types/index.ts';

const API_BASE_URL = 'http://localhost:3001';
// const API_BASE_URL = 'https://emulator-187591119525.europe-west1.run.app';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async register(data: RegisterForm): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/register', {
      email: data.email,
      password: data.password
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Registration failed');
    }
    
    return response.data.data;
  }

  async login(data: LoginForm): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/login', data);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Login failed');
    }
    
    return response.data.data;
  }

  // Dwelling methods
  async getDwellings(): Promise<Dwelling[]> {
    const response = await this.client.get<ApiResponse<Dwelling[]>>('/dwellings');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch dwellings');
    }
    
    return response.data.data || [];
  }

  async getDwelling(dwellingId: string): Promise<Dwelling> {
    const response = await this.client.get<ApiResponse<Dwelling>>(`/dwellings/${dwellingId}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch dwelling');
    }
    
    return response.data.data;
  }

  async createDwelling(data: CreateDwellingForm): Promise<Dwelling> {
    const response = await this.client.post<ApiResponse<Dwelling>>('/dwellings', data);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create dwelling');
    }
    
    return response.data.data;
  }

  async updateDwelling(dwellingId: string, data: Partial<CreateDwellingForm>): Promise<Dwelling> {
    const response = await this.client.put<ApiResponse<Dwelling>>(`/dwellings/${dwellingId}`, data);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update dwelling');
    }
    
    return response.data.data;
  }

  async deleteDwelling(dwellingId: string): Promise<void> {
    const response = await this.client.delete<ApiResponse>(`/dwellings/${dwellingId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete dwelling');
    }
  }

  // Device methods
  async getDwellingDevices(dwellingId: string): Promise<Device[]> {
    const response = await this.client.get<ApiResponse<Device[]>>(`/dwellings/${dwellingId}/devices`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch devices');
    }
    
    return response.data.data || [];
  }

  async getDevice(deviceId: string): Promise<Device> {
    const response = await this.client.get<ApiResponse<Device>>(`/devices/${deviceId}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch device');
    }
    
    return response.data.data;
  }

  async createDevice(dwellingId: string, data: CreateDeviceForm): Promise<Device> {
    const response = await this.client.post<ApiResponse<Device>>(
      `/dwellings/${dwellingId}/devices`, 
      data
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create device');
    }
    
    return response.data.data;
  }

  async updateDevice(deviceId: string, config: Record<string, unknown>): Promise<Device> {
    const response = await this.client.put<ApiResponse<Device>>(`/devices/${deviceId}`, {
      config
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update device');
    }
    
    return response.data.data;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    const response = await this.client.delete<ApiResponse>(`/devices/${deviceId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete device');
    }
  }

  // Battery Control
  async controlBattery(deviceId: string, command: BatteryControlCommand): Promise<ApiResponse> {
    const response = await this.client.post(`/devices/${deviceId}/control`, command);
    return response.data;
  }

  // Appliance Control
  async controlAppliance(deviceId: string, command: ApplianceControlCommand): Promise<ApiResponse> {
    const response = await this.client.post(`/devices/${deviceId}/control`, command);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.success;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Authentication helpers
export const authUtils = {
  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setAuth(authResponse: AuthResponse): void {
    localStorage.setItem('auth_token', authResponse.token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
  },

  clearAuth(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },
}; 