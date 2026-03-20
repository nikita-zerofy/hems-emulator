import axios from 'axios';
import {DateTime} from 'luxon';
import { WeatherData, Location } from '../types';
import { logger } from '../config/logger';

const OPEN_METEO_API_URL = 'https://api.open-meteo.com/v1/forecast';
const WeatherCacheTtlMs = 15 * 60 * 1000;
const WeatherBatchSize = 3;
const WeatherLocationToleranceKm = 50;

type CachedWeatherEntry = {
  location: Location;
  weatherData: WeatherData;
  expiresAtMs: number;
  source: 'provider';
};

export class WeatherService {
  private static weatherCache = new Map<string, CachedWeatherEntry>();

  /**
   * Get weather data for a location using the cache first.
   */
  static async getCurrentWeatherData(location: Location): Promise<WeatherData> {
    const cachedWeather = this.getCachedWeatherData(location);

    if (cachedWeather) {
      logger.debug({
        location,
        source: cachedWeather.source
      }, 'Using cached weather data');

      return cachedWeather.weatherData;
    }

    try {
      const weatherData = await this.fetchCurrentWeatherData(location);
      this.setCachedWeatherData(location, weatherData);

      logger.debug({
        location,
        source: 'provider'
      }, 'Fetched weather data from provider');

      return weatherData;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        location
      }, 'Weather API error');

      const weatherData = this.getSimulatedWeatherData(location);

      logger.warn({
        location,
        source: 'simulated'
      }, 'Using simulated weather fallback');

      return weatherData;
    }
  }

  /**
   * Get weather data for multiple locations in batch.
   */
  static async getWeatherDataBatch(locations: Array<{ dwellingId: string; location: Location }>): Promise<Map<string, WeatherData>> {
    const results = new Map<string, WeatherData>();
    const groupedLocations = new Map<string, { location: Location; dwellingIds: string[] }>();

    for (const {dwellingId, location} of locations) {
      const groupedLocationKey = this.findMatchingLocationKey(location, groupedLocations.values());
      const existingLocation = groupedLocationKey ? groupedLocations.get(groupedLocationKey) : null;

      if (existingLocation) {
        existingLocation.dwellingIds.push(dwellingId);
        continue;
      }

      const cacheKey = this.getLocationCacheKey(location);
      groupedLocations.set(cacheKey, {
        location,
        dwellingIds: [dwellingId]
      });
    }

    const uniqueLocations = Array.from(groupedLocations.values());

    for (let i = 0; i < uniqueLocations.length; i += WeatherBatchSize) {
      const batch = uniqueLocations.slice(i, i + WeatherBatchSize);
      const batchResults = await Promise.all(
        batch.map(async ({location, dwellingIds}) => ({
          dwellingIds,
          weatherData: await this.getCurrentWeatherData(location)
        }))
      );

      for (const {dwellingIds, weatherData} of batchResults) {
        for (const dwellingId of dwellingIds) {
          results.set(dwellingId, weatherData);
        }
      }
    }

    return results;
  }

  /**
   * Fetch current weather and solar irradiance data from the provider.
   */
  private static async fetchCurrentWeatherData(location: Location): Promise<WeatherData> {
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
      timestamp: current.time ?? DateTime.now().toISO() ?? new Date().toISOString()
    };
  }

  /**
   * Get a stable cache key for a location.
   */
  private static getLocationCacheKey(location: Location): string {
    return `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
  }

  /**
   * Return a fresh cached weather entry when available.
   */
  private static getCachedWeatherData(location: Location): CachedWeatherEntry | null {
    const cacheKey = this.findReusableCacheKey(location);

    if (!cacheKey) {
      return null;
    }

    const cachedWeather = this.weatherCache.get(cacheKey);

    if (!cachedWeather) {
      return null;
    }

    if (cachedWeather.expiresAtMs <= DateTime.now().toMillis()) {
      this.weatherCache.delete(cacheKey);
      return null;
    }

    return cachedWeather;
  }

  /**
   * Store weather data in the process-local cache.
   */
  private static setCachedWeatherData(
    location: Location,
    weatherData: WeatherData
  ): void {
    const cacheKey = this.findReusableCacheKey(location) ?? this.getLocationCacheKey(location);

    this.weatherCache.set(cacheKey, {
      location,
      weatherData,
      source: 'provider',
      expiresAtMs: DateTime.now().plus({milliseconds: WeatherCacheTtlMs}).toMillis()
    });
  }

  /**
   * Find an existing location within the configured distance tolerance.
   */
  private static findMatchingLocationKey<T extends { location: Location }>(
    location: Location,
    entries: Iterable<T>
  ): string | null {
    for (const entry of entries) {
      const distanceKm = this.calculateDistanceKm(location, entry.location);

      if (distanceKm <= WeatherLocationToleranceKm) {
        return this.getLocationCacheKey(entry.location);
      }
    }

    return null;
  }

  /**
   * Find a fresh cached location within the configured distance tolerance.
   */
  private static findReusableCacheKey(location: Location): string | null {
    const nowMs = DateTime.now().toMillis();

    for (const [cacheKey, entry] of this.weatherCache.entries()) {
      if (entry.expiresAtMs <= nowMs) {
        this.weatherCache.delete(cacheKey);
        continue;
      }

      const distanceKm = this.calculateDistanceKm(location, entry.location);
      if (distanceKm <= WeatherLocationToleranceKm) {
        return cacheKey;
      }
    }

    return null;
  }

  /**
   * Calculate great-circle distance between two coordinates.
   */
  private static calculateDistanceKm(a: Location, b: Location): number {
    const EarthRadiusKm = 6371;
    const dLat = this.toRadians(b.lat - a.lat);
    const dLng = this.toRadians(b.lng - a.lng);
    const lat1 = this.toRadians(a.lat);
    const lat2 = this.toRadians(b.lat);

    const haversine =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * EarthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  /**
   * Convert degrees to radians.
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
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
   * Simulate seasonal and daily variations for demonstration
   */
  static getSimulatedWeatherData(_location: Location): WeatherData {
    const now = DateTime.now();
    const hour = now.hour;
    const dayOfYear = now.ordinal;
    
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
      timestamp: now.toISO() ?? new Date().toISOString()
    };
  }
} 