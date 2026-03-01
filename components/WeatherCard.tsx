'use client';

import { Thermometer, Droplets, Wind, CloudRain, Snowflake, AlertTriangle, Info } from 'lucide-react';
import type { WeatherSummary, WeatherAlert, ForecastDay } from '@/lib/types';
import { MONTH_LABEL, PERIOD_LABEL } from '@/lib/types';

interface Props {
  weather: WeatherSummary;
}

// ─── 기온 → 배경 그라디언트 ────────────────────────────────────────────────────
function getTempGradient(avg: number): string {
  if (avg < 0) return 'from-blue-900 to-slate-800';
  if (avg < 10) return 'from-blue-700 to-blue-500';
  if (avg < 17) return 'from-sky-600 to-sky-400';
  if (avg < 23) return 'from-sky-400 to-emerald-400';
  if (avg < 28) return 'from-amber-400 to-orange-300';
  if (avg < 35) return 'from-orange-500 to-red-400';
  return 'from-red-600 to-rose-500';
}

// ─── 기온 → 날씨 이모지 ────────────────────────────────────────────────────────
function getTempEmoji(avg: number, precipDays: number): string {
  if (precipDays >= 10) return '🌧️';
  if (avg < 0) return '🥶';
  if (avg < 10) return '🧥';
  if (avg < 17) return '🌤️';
  if (avg < 23) return '☀️';
  if (avg < 28) return '😎';
  if (avg < 35) return '🌡️';
  return '🔥';
}

// ─── WMO 날씨 코드 → 이모지 ──────────────────────────────────────────────────
function wmoEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code <= 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 59) return '🌦️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 84) return '🌧️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

// ─── Alert 스타일 ─────────────────────────────────────────────────────────────
const ALERT_STYLE: Record<WeatherAlert['severity'], string> = {
  info: 'bg-sky-50 border-sky-200 text-sky-700',
  warn: 'bg-amber-50 border-amber-200 text-amber-700',
  danger: 'bg-red-50 border-red-200 text-red-700',
};

const ALERT_ICON: Record<WeatherAlert['type'], React.ReactNode> = {
  rain: <CloudRain className="w-3.5 h-3.5 shrink-0" />,
  snow: <Snowflake className="w-3.5 h-3.5 shrink-0" />,
  wind: <Wind className="w-3.5 h-3.5 shrink-0" />,
  heat: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  cold: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  diurnal: <Info className="w-3.5 h-3.5 shrink-0" />,
};

// ─── 막대 게이지 ─────────────────────────────────────────────────────────────
function Gauge({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── 예보 일별 카드 ────────────────────────────────────────────────────────────
function ForecastStrip({ days }: { days: ForecastDay[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 pb-3 pt-1">
      {days.map((d) => {
        const dateLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' });
        return (
          <div
            key={d.date}
            className="flex-shrink-0 w-16 flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-xl py-2 px-1 shadow-sm"
          >
            <span className="text-[10px] text-slate-400 font-medium text-center leading-tight">{dateLabel}</span>
            <span className="text-lg">{wmoEmoji(d.weatherCode)}</span>
            <span className="text-xs font-bold text-red-500">{Math.round(d.tempMax)}°</span>
            <span className="text-xs text-sky-500">{Math.round(d.tempMin)}°</span>
            {d.precipProb > 20 && (
              <span className="text-[10px] text-sky-600 font-medium">{d.precipProb}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 기온 범위 바 ─────────────────────────────────────────────────────────────
function TempRangeBar({
  minCold, minTypical, maxTypical, maxHot,
}: {
  minCold: number; minTypical: number; maxTypical: number; maxHot: number;
}) {
  // 전체 범위를 -20~50°C 기준으로 정규화
  const BASE = -20;
  const SPAN = 70;
  const toPos = (v: number) => Math.max(0, Math.min(100, ((v - BASE) / SPAN) * 100));

  return (
    <div className="mt-3 mb-1">
      <div className="flex justify-between text-[10px] text-white/60 mb-1.5">
        <span>추운 해 {Math.round(minCold)}°</span>
        <span>전형적 범위 {Math.round(minTypical)}–{Math.round(maxTypical)}°</span>
        <span>더운 해 {Math.round(maxHot)}°</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/20">
        {/* 극한 범위 (P10–P90) */}
        <div
          className="absolute h-2 rounded-full bg-white/30"
          style={{ left: `${toPos(minCold)}%`, width: `${toPos(maxHot) - toPos(minCold)}%` }}
        />
        {/* 전형적 범위 (P25–P75) */}
        <div
          className="absolute h-2 rounded-full bg-white/70"
          style={{ left: `${toPos(minTypical)}%`, width: `${toPos(maxTypical) - toPos(minTypical)}%` }}
        />
        {/* 평균 점 */}
        <div
          className="absolute w-2.5 h-2.5 -top-0.5 rounded-full bg-white border-2 border-white/80 shadow"
          style={{ left: `calc(${toPos((minTypical + maxTypical) / 2)}% - 5px)` }}
        />
      </div>
    </div>
  );
}

export default function WeatherCard({ weather }: Props) {
  const { climate, location, month, period, alerts } = weather;
  const gradient = getTempGradient(climate.tempAvg);
  const emoji = getTempEmoji(climate.tempAvg, climate.precipDays);
  const isForecast = climate.mode === 'forecast';

  return (
    <div className="rounded-2xl overflow-hidden shadow-md animate-fade-up">
      {/* 헤더 — 그라디언트 */}
      <div className={`bg-gradient-to-br ${gradient} p-5 text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white/80 text-sm font-medium">
                {MONTH_LABEL[month]} {PERIOD_LABEL[period]}
              </p>
              {/* 모드 뱃지 */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                isForecast
                  ? 'bg-emerald-400/30 text-emerald-100 border border-emerald-300/40'
                  : 'bg-white/20 text-white/70 border border-white/20'
              }`}>
                {isForecast ? '🟢 실시간 예보' : '📊 기후통계'}
              </span>
            </div>
            <h2 className="text-2xl font-bold mt-0.5">
              {location.name}
              <span className="text-base font-normal text-white/70 ml-2">{location.country}</span>
            </h2>
          </div>
          <span className="text-4xl">{emoji}</span>
        </div>

        {/* 기온 — 평균 + 범위 */}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-5xl font-black">{Math.round(climate.tempAvg)}°</span>
          <div className="text-white/80 text-sm leading-tight">
            <div>
              {isForecast
                ? `${Math.round(climate.tempMin)}° / ${Math.round(climate.tempMax)}°`
                : `전형적 ${Math.round(climate.tempMinTypical)}–${Math.round(climate.tempMaxTypical)}°`
              }
            </div>
            <div>체감 {Math.round(climate.feelsLike)}°C</div>
          </div>
        </div>

        {/* 기후통계 모드 — 범위 바 표시 */}
        {!isForecast && (
          <TempRangeBar
            minCold={climate.tempMinCold}
            minTypical={climate.tempMinTypical}
            maxTypical={climate.tempMaxTypical}
            maxHot={climate.tempMaxHot}
          />
        )}

        {/* 기후통계 모드 — 데이터 출처 */}
        {!isForecast && climate.dataYears > 0 && (
          <p className="text-[10px] text-white/50 mt-1">
            최근 {climate.dataYears}개년 통계 기반
          </p>
        )}
      </div>

      {/* 예보 모드 — 일별 예보 스트립 */}
      {isForecast && climate.forecastDays && climate.forecastDays.length > 0 && (
        <div className="bg-slate-50 border-b border-slate-100">
          <p className="text-[10px] text-slate-400 font-medium px-4 pt-2">일별 예보</p>
          <ForecastStrip days={climate.forecastDays} />
        </div>
      )}

      {/* 상세 지표 */}
      <div className="bg-white p-4 space-y-3">
        {/* 강수 */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-sky-500" />
              {isForecast ? '예보 기간 강수량' : '강수량 (기간 합계)'}
            </span>
            <span className="font-semibold text-slate-700">
              {climate.precipitation}mm · {climate.precipDays}일
              {!isForecast && climate.precipMin !== climate.precipMax && (
                <span className="text-slate-400 font-normal ml-1">
                  ({Math.round(climate.precipMin)}–{Math.round(climate.precipMax)}mm)
                </span>
              )}
            </span>
          </div>
          <Gauge value={climate.precipitation} max={200} color="bg-sky-400" />
        </div>

        {/* 풍속 */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-slate-400" />
              평균 최대 풍속
            </span>
            <span className="font-semibold text-slate-700">{climate.windSpeed} km/h</span>
          </div>
          <Gauge value={climate.windSpeed} max={60} color="bg-slate-300" />
        </div>

        {/* 일교차 */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-500" />
              일교차
            </span>
            <span className="font-semibold text-slate-700">{Math.round(climate.tempRange)}°C</span>
          </div>
          <Gauge value={climate.tempRange} max={25} color="bg-amber-400" />
        </div>

        {/* 습도 */}
        <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 mt-1">
          <span>추정 습도</span>
          <span className="font-semibold text-slate-700">{climate.humidity}%</span>
        </div>

        {climate.snowDays > 0 && (
          <div className="flex justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Snowflake className="w-3 h-3 text-sky-300" />
              눈 예상 일수
            </span>
            <span className="font-semibold text-slate-700">{Math.round(climate.snowDays)}일</span>
          </div>
        )}
      </div>

      {/* 알림 */}
      {alerts.length > 0 && (
        <div className="bg-slate-50 px-4 pb-4 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${ALERT_STYLE[alert.severity]}`}
            >
              {ALERT_ICON[alert.type]}
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
