// ─── Input Types ──────────────────────────────────────────────────────────────

export type Period = 'early' | 'mid' | 'late';
export type TravelStyle = 'leisure' | 'city' | 'hiking' | 'food';
export type Companion = 'solo' | 'couple' | 'family' | 'friends';
export type TempSensitivity = 'cold' | 'normal' | 'hot'; // 추위 많이 탐 / 보통 / 더위 많이 탐

export const PERIOD_LABEL: Record<Period, string> = {
  early: '초',
  mid: '중',
  late: '말',
};

export const MONTH_LABEL: Record<number, string> = {
  1: '1월', 2: '2월', 3: '3월', 4: '4월',
  5: '5월', 6: '6월', 7: '7월', 8: '8월',
  9: '9월', 10: '10월', 11: '11월', 12: '12월',
};

export const STYLE_LABEL: Record<TravelStyle, string> = {
  leisure: '휴양',
  city: '도시관광',
  hiking: '하이킹/자연',
  food: '미식',
};

export const COMPANION_LABEL: Record<Companion, string> = {
  solo: '혼자',
  couple: '커플',
  family: '가족(키즈)',
  friends: '친구',
};

export interface TripInput {
  country: string;
  city: string;
  month: number; // 1-12
  period: Period;
  style?: TravelStyle;
  companion?: Companion;
  sensitivity?: TempSensitivity;
  departureDate?: string; // ISO date string e.g. '2025-07-15'
}

// ─── Geo Types ─────────────────────────────────────────────────────────────────

export interface GeoLocation {
  name: string;
  nameLocal?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  admin1?: string;
}

// ─── Weather/Climate Types ─────────────────────────────────────────────────────

export interface ClimateData {
  // 평균값 (5개년 평균)
  tempMin: number;      // °C — 평균 최저
  tempMax: number;      // °C — 평균 최고
  tempAvg: number;      // °C — 평균
  tempRange: number;    // 일교차 °C
  feelsLike: number;    // 체감온도 °C
  precipitation: number; // mm (period 합계 평균)
  precipDays: number;   // 강수 일수
  windSpeed: number;    // km/h (일 최대 평균)
  humidity: number;     // % (추정값)
  snowDays: number;     // 눈 일수

  // 범위값 (5개년 P10/P25/P75/P90 백분위)
  tempMinCold: number;    // P10 of daily min → 추운 해 시나리오
  tempMaxHot: number;     // P90 of daily max → 더운 해 시나리오
  tempMinTypical: number; // P25 of daily min → 전형적 서늘한 밤
  tempMaxTypical: number; // P75 of daily max → 전형적 따뜻한 낮
  precipMin: number;      // P10 of period total → 건조 해
  precipMax: number;      // P90 of period total → 강수 많은 해

  // 메타
  mode: 'climate' | 'forecast';
  dataYears: number;

  // 예보 모드일 때만 존재
  forecastDays?: ForecastDay[];
  currentWeather?: CurrentWeather;
}

export interface ForecastDay {
  date: string;           // ISO 날짜 'YYYY-MM-DD'
  tempMax: number;        // °C
  tempMin: number;        // °C
  precipProb: number;     // % (강수 확률)
  precipSum: number;      // mm
  weatherCode: number;    // WMO weather code
  windSpeed: number;      // km/h
}

/** 예보 모드 전용 — Open-Meteo current 섹션 */
export interface CurrentWeather {
  tempNow: number;          // °C 현재 기온
  weatherCode: number;      // WMO 날씨 코드
  windSpeed: number;        // km/h
  isDay: boolean;
  time: string;             // 목적지 현지 시각 'YYYY-MM-DDTHH:MM'
  timezone: string;         // e.g. 'Asia/Tokyo'
  timezoneAbbrev: string;   // e.g. 'JST'
}

export interface WeatherSummary {
  location: GeoLocation;
  climate: ClimateData;
  month: number;
  period: Period;
  periodLabel: string;
  alerts: WeatherAlert[];
}

export interface WeatherAlert {
  type: 'rain' | 'snow' | 'wind' | 'heat' | 'cold' | 'diurnal';
  severity: 'info' | 'warn' | 'danger';
  message: string;
}

// ─── Outfit Types ──────────────────────────────────────────────────────────────

export type TempBand =
  | 'very_cold'   // < 0°C
  | 'cold'        // 0–9°C
  | 'cool'        // 10–16°C
  | 'mild'        // 17–22°C
  | 'warm'        // 23–27°C
  | 'hot'         // 28–34°C
  | 'very_hot';   // 35°C+

export interface OutfitRecommendation {
  band: TempBand;
  tempDisplay: string;      // e.g. "23–30°C"
  top: string[];
  bottom: string[];
  outer: string[];
  shoes: string[];
  accessories: string[];
  keyPoints: string[];      // 핵심 포인트 (2–3개)
  layeringAdvice: string;   // 레이어링 조언
  precipAdvice: string;     // 강수 대비 조언
}

// ─── Place Types ───────────────────────────────────────────────────────────────

export type PlaceCategory = 'attraction' | 'food' | 'cafe' | 'restaurant';

export interface PlaceItem {
  id: string;
  name: string;
  nameKo?: string;
  description: string;
  category: PlaceCategory;
  tags: string[];
  rating?: number;
  ratingCount?: number;
  mapsUrl?: string;
  photoUrl?: string;
  priceLevel?: 1 | 2 | 3 | 4;   // $ ~  $$$$
  isLocalFavorite?: boolean;
  isTouristFavorite?: boolean;
}

export interface Recommendations {
  attractions: PlaceItem[];
  food: PlaceItem[];
  cafes: PlaceItem[];
  restaurants: PlaceItem[];
}

// ─── Result Types ──────────────────────────────────────────────────────────────

export interface TripResult {
  weather: WeatherSummary;
  outfit: OutfitRecommendation;
  recommendations: Recommendations;
  generatedAt: string;
  isForecastMode: boolean; // 출발일이 14일 이내면 true
}

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

// ─── 출발일 유틸 ───────────────────────────────────────────────────────────────

/** 출발일까지 남은 일수. 날짜 없으면 999 반환 */
export function getDepartureDays(departureDate?: string): number {
  if (!departureDate) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dep = new Date(departureDate);
  dep.setHours(0, 0, 0, 0);
  return Math.ceil((dep.getTime() - now.getTime()) / 86400000);
}

/** 14일 이내 → 'forecast', 그 외 → 'climate' */
export function getWeatherMode(departureDate?: string): 'forecast' | 'climate' {
  const days = getDepartureDays(departureDate);
  return days >= 0 && days <= 14 ? 'forecast' : 'climate';
}
