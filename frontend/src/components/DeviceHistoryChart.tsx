import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { format } from 'date-fns';
import { DeviceHistorySeries, DeviceType } from '../types';

type DeviceHistoryChartProps = {
  series: DeviceHistorySeries;
};

const DeviceHistoryChart: React.FC<DeviceHistoryChartProps> = ({ series }) => {
  const hasSoc = series.datapoints.some((point) => point.soc != null);
  const hasTemperature = series.datapoints.some((point) => point.temperatureC != null);

  const chartData = series.datapoints.map((point) => ({
    timeLabel: format(new Date(point.recordedAt), 'MM-dd HH:mm'),
    powerW: point.powerW,
    socPercent: point.soc != null ? point.soc * 100 : null,
    temperatureC: point.temperatureC ?? null,
    isCharging: point.isCharging ?? null
  }));

  const title = series.deviceName || `${series.deviceType} (${series.deviceId.slice(0, 8)})`;
  const showChargeSeries = hasSoc && (series.deviceType === DeviceType.Battery || series.deviceType === DeviceType.EV);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timeLabel" minTickGap={30} />
            <YAxis yAxisId="power" label={{ value: 'W', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="power"
              type="monotone"
              dataKey="powerW"
              stroke="#2563eb"
              dot={false}
              name="Power (W)"
              strokeWidth={2}
            />
            {showChargeSeries ? (
              <Line
                yAxisId="power"
                type="monotone"
                dataKey="socPercent"
                stroke="#16a34a"
                dot={false}
                name="SoC (%)"
                strokeWidth={2}
              />
            ) : null}
            {hasTemperature ? (
              <Line
                yAxisId="power"
                type="monotone"
                dataKey="temperatureC"
                stroke="#ea580c"
                dot={false}
                name="Temperature (C)"
                strokeWidth={2}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DeviceHistoryChart;
