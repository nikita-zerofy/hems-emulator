import axios from 'axios';
import { WeatherData, Location } from '../types';
import { logger } from '../config/logger';

const OPEN_METEO_API_URL = 'https://api.open-meteo.com/v1/forecast';

export class WeatherService {
  /**
   * Fetch current weather and solar irradiance data for a location
   */
  static async getCurrentWeatherData(location: Location): Promise<WeatherData> {
    try {
      const response = await axios.get(OPEN_METEO_API_URL, {
        params: {
          latitude: location.lat,
          longitude: location.lng,
          current: [
            'temperature_2m',
            'cloud_cover',
            'shortwave_radiation'
          ].join(','),
          timezone: 'auto',
          forecast_days: 1
        },
        timeout: 5000 // 5 second timeout
      });

      const { current } = response.data;
      
      if (!current) {
        throw new Error('No current weather data available');
      }

      return {
        solarIrradianceWm2: current.shortwave_radiation ?? 0,
        temperatureC: current.temperature_2m ?? 20,
        cloudCover: current.cloud_cover ?? 0,
        timestamp: current.time ?? new Date().toISOString()
      };
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        location 
      }, 'Weather API error');
      
      // Return fallback data if API fails
      return this.getFallbackWeatherData();
    }
  }

  /**
   * Get weather data for multiple locations in batch
   */
  static async getWeatherDataBatch(locations: Array<{ dwellingId: string; location: Location }>): Promise<Map<string, WeatherData>> {
    const results = new Map<string, WeatherData>();
    
    // Process locations in parallel but with limited concurrency
    const BATCH_SIZE = 3;
    
    for (let i = 0; i < locations.length; i += BATCH_SIZE) {
      const batch = locations.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async ({ dwellingId, location }) => {
        try {
          const weatherData = await this.getCurrentWeatherData(location);
          return { dwellingId, weatherData };
        } catch (error) {
          logger.error({ 
            dwellingId,
            error: error instanceof Error ? error.message : 'Unknown error' 
          }, 'Weather fetch failed for dwelling');
          return { dwellingId, weatherData: this.getFallbackWeatherData() };
        }
      });

      const batchResults = await Promise.all(promises);
      
      for (const { dwellingId, weatherData } of batchResults) {
        results.set(dwellingId, weatherData);
      }
    }

    return results;
  }

  /**
   * Calculate solar power generation based on irradiance and panel configuration
   */
  static calculateSolarPower(
    irradianceWm2: number,
    kwPeak: number,
    efficiency: number = 0.85,
    temperatureC: number = 25,
    cloudCover: number = 0
  ): number {
    if (irradianceWm2 <= 0) {
      return 0;
    }

    // Standard Test Conditions (STC): 1000 W/m² irradiance
    const standardIrradiance = 1000;
    
    // Temperature coefficient (typical for silicon panels: -0.4%/°C above 25°C)
    const temperatureCoeff = -0.004;
    const temperatureFactor = 1 + temperatureCoeff * (temperatureC - 25);
    
    // Cloud cover reduces irradiance
    const cloudFactor = 1 - (cloudCover / 100) * 0.8; // 80% reduction at 100% cloud cover
    const effectiveIrradiance = irradianceWm2 * cloudFactor;
    
    // Calculate power output
    const powerKw = kwPeak * (effectiveIrradiance / standardIrradiance) * efficiency * temperatureFactor;
    
    // Convert to watts and ensure non-negative
    return Math.max(0, powerKw * 1000);
  }

  /**
   * Get fallback weather data when API is unavailable
   */
  private static getFallbackWeatherData(): WeatherData {
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour <= 18;
    
    // Simulate basic solar irradiance based on time of day
    let irradiance = 0;
    if (isDay) {
      // Simple sine wave for daytime irradiance (peak around noon)
      const dayProgress = (hour - 6) / 12; // 0 to 1 from 6 AM to 6 PM
      irradiance = 600 * Math.sin(dayProgress * Math.PI); // Peak 600 W/m²
    }

    return {
      solarIrradianceWm2: Math.max(0, irradiance),
      temperatureC: 22,
      cloudCover: 30,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simulate seasonal and daily variations for demonstration
   */
  static getSimulatedWeatherData(_location: Location): WeatherData {
    const now = new Date();
    const hour = now.getHours();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    
    // Seasonal factor (higher in summer)
    const seasonalFactor = 0.5 + 0.5 * Math.cos((dayOfYear - 172) * 2 * Math.PI / 365); // Peak around June 21
    
    // Daily solar curve
    const isDay = hour >= 6 && hour <= 18;
    let irradiance = 0;
    
    if (isDay) {
      const dayProgress = (hour - 6) / 12;
      irradiance = 800 * seasonalFactor * Math.sin(dayProgress * Math.PI);
    }
    
    // Add some randomness
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% variation
    irradiance *= randomFactor;
    
    // Temperature variation
    const baseTemp = 20 + 15 * seasonalFactor; // 20-35°C range
    const dailyTempVar = 5 * Math.sin((hour - 6) * Math.PI / 12); // ±5°C daily variation
    const temperature = baseTemp + dailyTempVar + (Math.random() - 0.5) * 4; // ±2°C random
    
    return {
      solarIrradianceWm2: Math.max(0, Math.round(irradiance)),
      temperatureC: Math.round(temperature * 10) / 10,
      cloudCover: Math.round(Math.random() * 60), // 0-60% cloud cover
      timestamp: now.toISOString()
    };
  }
} 