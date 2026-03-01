/**
 * Open-Meteo Archive API 호출 + 기후 데이터 집계 유틸
 *
 * - 최근 5년치 동일 월/시기 데이터 → 백분위(P10/P25/P75/P90) 범위 제공
 * - period 'early'  → 1–10일, 'mid' → 11–20일, 'late' → 21–말일
 */

import type { ClimateData, Period } from './types';

// ─── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function getPeriodDays(period: Period): [number, number] {
  if (period === 'early') return [1, 10];
  if (period === 'mid') return [11, 20];
  return [21, 31]; // 'late' — 실제 말일은 연도/월에 따라 조정
}

function buildDateRange(
  year: number,
  month: number,
  period: Period
): { start: string; end: string } {
  const [startDay, endDayRaw] = getPeriodDays(period);
  const endDay =
    period === 'late' ? lastDayOfMonth(year, month) : Math.min(endDayRaw, lastDayOfMonth(year, month));

  return {
    start: `${year}-${pad(month)}-${pad(startDay)}`,
    end: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

// ─── Open-Meteo Archive API ────────────────────────────────────────────────────

interface DailyRaw {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  windspeed_10m_max: number[];
  snowfall_sum?: number[];
}

interface ArchiveResponse {
  daily?: DailyRaw;
  error?: boolean;
  reason?: string;
}

async function fetchArchive(
  lat: number,
  lng: number,
  start: string,
  end: string
): Promise<DailyRaw | null> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lng}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,snowfall_sum` +
    `&timezone=UTC`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data: ArchiveResponse = await res.json();
    return data.daily ?? null;
  } catch {
    return null;
  }
}

// ─── 통계 함수 ────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  const valid = arr.filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sum(arr: number[]): number {
  return arr.filter((v) => v !== null && !isNaN(v)).reduce((a, b) => a + b, 0);
}

/** 백분위수 계산 (선형 보간) */
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].filter((v) => v !== null && !isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 습도 추정 (위도 기반 간단 추정 — MVP용) */
function estimateHumidity(lat: number, month: number, precipitation: number): number {
  const absLat = Math.abs(lat);
  let base = 60;

  if (absLat < 15) base = 78;          // 열대
  else if (absLat < 30) base = 65;     // 아열대
  else if (absLat < 45) base = 60;     // 온대
  else if (absLat < 60) base = 65;     // 냉대
  else base = 70;                       // 극지

  const precipBonus = Math.min(20, precipitation / 10);

  const isSummer =
    (lat > 0 && month >= 6 && month <= 8) ||
    (lat < 0 && (month <= 2 || month === 12));
  const seasonBonus = isSummer ? 5 : 0;

  return Math.min(95, Math.max(20, Math.round(base + precipBonus + seasonBonus)));
}

// ─── 메인 함수 ────────────────────────────────────────────────────────────────

export async function fetchClimateData(
  lat: number,
  lng: number,
  month: number,
  period: Period
): Promise<ClimateData> {
  const currentYear = new Date().getFullYear();
  // 최근 5년 데이터 (현재 연도는 아직 집계 안 됐을 수 있으니 -1~-5)
  const years = [
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
    currentYear - 4,
    currentYear - 5,
  ];

  // 각 연도별 일별 데이터
  const allDailyMax: number[] = [];
  const allDailyMin: number[] = [];
  const allDailyPrecip: number[] = [];
  const allDailyWind: number[] = [];
  const allDailySnow: number[] = [];

  // 연도별 period 합계 강수량 (백분위 계산용)
  const yearlyPrecipTotals: number[] = [];

  let successYears = 0;

  await Promise.all(
    years.map(async (year) => {
      const { start, end } = buildDateRange(year, month, period);
      const daily = await fetchArchive(lat, lng, start, end);
      if (!daily) return;

      successYears++;
      allDailyMax.push(...daily.temperature_2m_max);
      allDailyMin.push(...daily.temperature_2m_min);
      allDailyPrecip.push(...daily.precipitation_sum);
      allDailyWind.push(...daily.windspeed_10m_max);
      if (daily.snowfall_sum) allDailySnow.push(...daily.snowfall_sum);

      yearlyPrecipTotals.push(sum(daily.precipitation_sum));
    })
  );

  // 데이터가 없는 경우 기본값 처리
  if (allDailyMax.length === 0) {
    return {
      tempMin: 15, tempMax: 25, tempAvg: 20,
      tempRange: 10, feelsLike: 20,
      precipitation: 30, precipDays: 4,
      windSpeed: 15, humidity: 60, snowDays: 0,
      tempMinCold: 12, tempMaxHot: 28,
      tempMinTypical: 14, tempMaxTypical: 26,
      precipMin: 15, precipMax: 60,
      mode: 'climate',
      dataYears: 0,
    };
  }

  const tempMax = avg(allDailyMax);
  const tempMin = avg(allDailyMin);
  const tempAvg = (tempMax + tempMin) / 2;
  const tempRange = tempMax - tempMin;
  const precipitation = avg(yearlyPrecipTotals);
  const windSpeed = avg(allDailyWind);
  const precipDays = allDailyPrecip.filter((v) => v > 1).length / Math.max(successYears, 1);
  const snowDays = allDailySnow.filter((v) => v > 0.5).length / Math.max(successYears, 1);
  const humidity = estimateHumidity(lat, month, precipitation);

  // 체감온도
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

  // 백분위 범위
  const tempMinCold = percentile(allDailyMin, 10);
  const tempMaxHot = percentile(allDailyMax, 90);
  const tempMinTypical = percentile(allDailyMin, 25);
  const tempMaxTypical = percentile(allDailyMax, 75);

  const precipMin = yearlyPrecipTotals.length > 0 ? percentile(yearlyPrecipTotals, 10) : 0;
  const precipMax = yearlyPrecipTotals.length > 0 ? percentile(yearlyPrecipTotals, 90) : 0;

  return {
    tempMin: r1(tempMin),
    tempMax: r1(tempMax),
    tempAvg: r1(tempAvg),
    tempRange: r1(tempRange),
    feelsLike: r1(feelsLike),
    precipitation: r1(precipitation),
    precipDays: Math.round(precipDays),
    windSpeed: r1(windSpeed),
    humidity,
    snowDays: Math.round(snowDays),
    tempMinCold: r1(tempMinCold),
    tempMaxHot: r1(tempMaxHot),
    tempMinTypical: r1(tempMinTypical),
    tempMaxTypical: r1(tempMaxTypical),
    precipMin: r1(precipMin),
    precipMax: r1(precipMax),
    mode: 'climate',
    dataYears: successYears,
  };
}

// ─── 날씨 Alert 생성 ──────────────────────────────────────────────────────────

import type { WeatherAlert } from './types';

export function buildWeatherAlerts(climate: ClimateData): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  if (climate.tempMax >= 35) {
    alerts.push({ type: 'heat', severity: 'danger', message: '폭염 주의 — 낮 시간대 야외 활동 자제 권장' });
  } else if (climate.tempMax >= 30) {
    alerts.push({ type: 'heat', severity: 'warn', message: '고온 — 자외선 차단 및 수분 보충 중요' });
  }

  if (climate.tempMin <= -10) {
    alerts.push({ type: 'cold', severity: 'danger', message: '혹한 — 완전 방한 장비 필수, 동상 주의' });
  } else if (climate.tempMin <= 0) {
    alerts.push({ type: 'cold', severity: 'warn', message: '영하 — 방한 장갑/모자/목도리 챙기세요' });
  }

  if (climate.precipitation >= 120) {
    alerts.push({ type: 'rain', severity: 'danger', message: '우기 시즌 — 방수 의류 완비 필요' });
  } else if (climate.precipitation >= 60) {
    alerts.push({ type: 'rain', severity: 'warn', message: '비가 자주 옴 — 우산 필수' });
  }

  if (climate.snowDays >= 5) {
    alerts.push({ type: 'snow', severity: 'warn', message: '강설 가능 — 방수 부츠 필요' });
  }

  if (climate.windSpeed >= 40) {
    alerts.push({ type: 'wind', severity: 'warn', message: '강풍 주의 — 방풍 아우터 필수' });
  }

  if (climate.tempRange >= 15) {
    alerts.push({ type: 'diurnal', severity: 'info', message: `일교차 ${Math.round(climate.tempRange)}°C — 탈착 아우터 필수` });
  }

  return alerts;
}
