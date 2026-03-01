/**
 * GET /api/forecast?lat=&lng=&days=
 *
 * Open-Meteo Forecast API (무료, API 키 불필요)
 * 최대 16일 예보 → ForecastDay[] + ClimateData(mode:'forecast') 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ClimateData, ForecastDay } from '@/lib/types';
import { buildWeatherAlerts } from '@/lib/weather-utils';

interface ForecastResponse {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    windspeed_10m_max: number[];
    weathercode: number[];
    snowfall_sum?: number[];
  };
  error?: boolean;
  reason?: string;
}

function avg(arr: number[]): number {
  const valid = arr.filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function estimateHumidity(lat: number, precipitation: number): number {
  const absLat = Math.abs(lat);
  let base = 60;
  if (absLat < 15) base = 78;
  else if (absLat < 30) base = 65;
  else if (absLat < 45) base = 60;
  else if (absLat < 60) base = 65;
  else base = 70;
  const precipBonus = Math.min(20, precipitation / 10);
  return Math.min(95, Math.max(20, Math.round(base + precipBonus)));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const days = Math.min(16, Math.max(1, parseInt(searchParams.get('days') ?? '14')));

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: '위도/경도 필요' }, { status: 400 });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,weathercode,snowfall_sum` +
      `&forecast_days=${days}` +
      `&timezone=auto`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('forecast api error');

    const data: ForecastResponse = await res.json();
    const daily = data.daily;
    if (!daily || !daily.time?.length) {
      throw new Error('예보 데이터 없음');
    }

    const forecastDays: ForecastDay[] = daily.time.map((date, i) => ({
      date,
      tempMax: r1(daily.temperature_2m_max[i] ?? 0),
      tempMin: r1(daily.temperature_2m_min[i] ?? 0),
      precipProb: Math.round(daily.precipitation_probability_max[i] ?? 0),
      precipSum: r1(daily.precipitation_sum[i] ?? 0),
      weatherCode: daily.weathercode[i] ?? 0,
      windSpeed: r1(daily.windspeed_10m_max[i] ?? 0),
    }));

    // ClimateData 집계 (예보 기간 전체 평균)
    const tempMax = avg(daily.temperature_2m_max);
    const tempMin = avg(daily.temperature_2m_min);
    const tempAvg = (tempMax + tempMin) / 2;
    const tempRange = tempMax - tempMin;
    const precipitation = daily.precipitation_sum.reduce((a, b) => a + (b ?? 0), 0);
    const precipDays = daily.precipitation_sum.filter((v) => v > 1).length;
    const windSpeed = avg(daily.windspeed_10m_max);
    const snowDays = (daily.snowfall_sum ?? []).filter((v) => v > 0.5).length;
    const humidity = estimateHumidity(lat, precipitation);

    let feelsLike = tempAvg;
    if (tempAvg < 10 && windSpeed > 5) {
      feelsLike =
        13.12 +
        0.6215 * tempAvg -
        11.37 * Math.pow(windSpeed, 0.16) +
        0.3965 * tempAvg * Math.pow(windSpeed, 0.16);
    } else if (tempAvg > 27 && humidity > 40) {
      const e = (humidity / 100) * 6.105 * Math.exp((17.27 * tempAvg) / (237.7 + tempAvg));
      feelsLike = tempAvg + 0.33 * e - 4;
    }

    const climate: ClimateData = {
      tempMin: r1(tempMin),
      tempMax: r1(tempMax),
      tempAvg: r1(tempAvg),
      tempRange: r1(tempRange),
      feelsLike: r1(feelsLike),
      precipitation: r1(precipitation),
      precipDays,
      windSpeed: r1(windSpeed),
      humidity,
      snowDays,
      // 예보 모드에서는 실제 값 = 범위값 (단일 예보이므로)
      tempMinCold: r1(Math.min(...daily.temperature_2m_min)),
      tempMaxHot: r1(Math.max(...daily.temperature_2m_max)),
      tempMinTypical: r1(tempMin),
      tempMaxTypical: r1(tempMax),
      precipMin: r1(Math.min(...daily.precipitation_sum)),
      precipMax: r1(Math.max(...daily.precipitation_sum)),
      mode: 'forecast',
      dataYears: 0,
      forecastDays,
    };

    const alerts = buildWeatherAlerts(climate);

    return NextResponse.json(
      { climate, alerts, forecastDays },
      {
        headers: { 'Cache-Control': 'public, s-maxage=1800' }, // 30분 캐시
      }
    );
  } catch (e) {
    console.error('[forecast]', e);
    return NextResponse.json({ error: '예보 데이터 로드 실패' }, { status: 500 });
  }
}
