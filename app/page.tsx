'use client';

import { useState } from 'react';
import { ArrowLeft, Share2, Plane, RefreshCw, ChevronDown } from 'lucide-react';
import InputForm from '@/components/InputForm';
import WeatherCard from '@/components/WeatherCard';
import OutfitCard from '@/components/OutfitCard';
import RecommendationTabs from '@/components/RecommendationTabs';
import type { TripInput, TripResult, GeoLocation, WeatherSummary, Period } from '@/lib/types';
import { MONTH_LABEL, PERIOD_LABEL as PL, getWeatherMode, getDepartureDays } from '@/lib/types';
import { getOutfitRecommendation } from '@/lib/outfit-engine';

type Screen = 'input' | 'loading' | 'result' | 'error';

// ─── 로딩 스켈레톤 ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-slate-300 rounded-2xl" />
      <div className="h-64 bg-slate-200 rounded-2xl" />
      <div className="flex gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-10 flex-1 bg-slate-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── 에러 카드 ─────────────────────────────────────────────────────────────────

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <span className="text-5xl">😵</span>
      <div>
        <p className="text-lg font-semibold text-slate-700">정보를 불러오지 못했어요</p>
        <p className="text-sm text-slate-400 mt-1">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}

// ─── 결과 화면 상단 — 월/시기 빠른 변경 바 ────────────────────────────────────

function QuickChangeBar({
  location,
  month,
  period,
  loading,
  onChange,
}: {
  location: GeoLocation;
  month: number;
  period: Period;
  loading: boolean;
  onChange: (month: number, period: Period) => void;
}) {
  const [m, setM] = useState(month);
  const [p, setP] = useState<Period>(period);
  const hasChanged = m !== month || p !== period;

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
      {/* 도시 */}
      <span className="text-xs font-semibold text-slate-500 shrink-0 truncate max-w-[80px]">
        {location.name}
      </span>

      <span className="text-slate-200">|</span>

      {/* 월 */}
      <div className="relative flex-1 min-w-0">
        <select
          value={m}
          onChange={e => setM(Number(e.target.value))}
          className="w-full appearance-none text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 pr-6 focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => (
            <option key={mo} value={mo}>{MONTH_LABEL[mo]}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
      </div>

      {/* 시기 */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
        {(['early', 'mid', 'late'] as Period[]).map(pd => (
          <button
            key={pd}
            onClick={() => setP(pd)}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
              p === pd ? 'bg-sky-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {PL[pd]}
          </button>
        ))}
      </div>

      {/* 재조회 버튼 */}
      <button
        onClick={() => onChange(m, p)}
        disabled={loading}
        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          hasChanged
            ? 'bg-sky-500 text-white shadow-sm active:scale-95'
            : 'bg-slate-100 text-slate-400'
        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        재조회
      </button>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState<Screen>('input');
  const [result, setResult] = useState<TripResult | null>(null);
  const [lastInput, setLastInput] = useState<{ input: TripInput; location: GeoLocation } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [reloading, setReloading] = useState(false); // 빠른 재조회 로딩

  // ─── 날씨 + 옷차림 fetch ─────────────────────────────────────────────────────

  const fetchWeatherAndOutfit = async (
    input: TripInput,
    location: GeoLocation
  ): Promise<TripResult> => {
    const mode = getWeatherMode(input.departureDate);
    const isForecastMode = mode === 'forecast';

    let apiUrl: string;
    if (isForecastMode) {
      const days = Math.min(16, Math.max(1, getDepartureDays(input.departureDate)));
      apiUrl = `/api/forecast?lat=${location.latitude}&lng=${location.longitude}&days=${days}`;
    } else {
      apiUrl = `/api/weather?lat=${location.latitude}&lng=${location.longitude}&month=${input.month}&period=${input.period}`;
    }

    const weatherRes = await fetch(apiUrl, { cache: 'no-store' });
    if (!weatherRes.ok) throw new Error('날씨 데이터를 가져오지 못했습니다');
    const { climate, alerts } = await weatherRes.json();

    const weather: WeatherSummary = {
      location,
      climate,
      month: input.month,
      period: input.period,
      periodLabel: PL[input.period],
      alerts: alerts ?? [],
    };

    const outfit = getOutfitRecommendation(climate, input);

    return {
      weather,
      outfit,
      recommendations: { attractions: [], food: [], cafes: [], restaurants: [] },
      generatedAt: new Date().toISOString(),
      isForecastMode,
    };
  };

  // ─── 첫 제출 (Input Form) ─────────────────────────────────────────────────────

  const handleSubmit = async (input: TripInput, location: GeoLocation) => {
    setLastInput({ input, location });
    setScreen('loading');
    setErrorMsg('');

    try {
      const tripResult = await fetchWeatherAndOutfit(input, location);
      setResult(tripResult);
      setScreen('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '알 수 없는 오류');
      setScreen('error');
    }
  };

  // ─── 결과 화면에서 월/시기만 바꿔 빠른 재조회 ──────────────────────────────

  const handleQuickReload = async (newMonth: number, newPeriod: Period) => {
    if (!lastInput) return;
    const newInput = { ...lastInput.input, month: newMonth, period: newPeriod };
    setLastInput({ ...lastInput, input: newInput });
    setReloading(true);

    try {
      const tripResult = await fetchWeatherAndOutfit(newInput, lastInput.location);
      setResult(tripResult);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // 실패해도 기존 결과는 유지
    } finally {
      setReloading(false);
    }
  };

  // ─── 뒤로가기 — lastInput 유지, form에 이전 값 전달 ──────────────────────────

  const handleBack = () => {
    setScreen('input');
    // result는 유지 (form에서 뒤로 빠져나왔을 때 재사용)
  };

  const handleShare = async () => {
    if (!result) return;
    const { location, month, period } = result.weather;
    const text = `${location.name}, ${location.country} ${MONTH_LABEL[month]} ${PL[period]} 여행 정보 — AllTrip`;
    if (navigator.share) {
      await navigator.share({ title: 'AllTrip', text, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100">

      {/* ── 헤더 ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        {screen !== 'input' && (
          <button
            onClick={handleBack}
            className="p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Plane className="w-5 h-5 text-sky-500 shrink-0" />
          <span className="font-bold text-slate-800 text-base shrink-0">AllTrip</span>
          {result && (
            <span className="text-xs text-slate-400 font-normal truncate">
              — {result.weather.location.name} {MONTH_LABEL[result.weather.month]}{PL[result.weather.period]}
            </span>
          )}
        </div>

        {screen === 'result' && (
          <button onClick={handleShare} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0">
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* ── 결과 화면 — 월/시기 빠른 변경 바 (sticky) ─────────────────────── */}
      {screen === 'result' && result && lastInput && (
        <div className="sticky top-[57px] z-30">
          <QuickChangeBar
            location={lastInput.location}
            month={lastInput.input.month}
            period={lastInput.input.period}
            loading={reloading}
            onChange={handleQuickReload}
          />
        </div>
      )}

      {/* ── 콘텐츠 ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-5">

        {/* 입력 화면 */}
        {screen === 'input' && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center py-4">
              <h1 className="text-2xl font-black text-slate-800 leading-tight">
                여행지 날씨 &<br />
                <span className="text-sky-500">옷차림·명소</span> 한 번에
              </h1>
              <p className="text-sm text-slate-400 mt-2">도시 + 달 + 초·중·말 입력만으로 끝</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              {/* 이전 검색 도시가 있으면 표시 */}
              {lastInput && (
                <div className="mb-3 p-2.5 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-sky-700">
                    이전: <strong>{lastInput.location.name}</strong> {MONTH_LABEL[lastInput.input.month]}{PL[lastInput.input.period]}
                  </span>
                  <button
                    onClick={() => handleSubmit(lastInput.input, lastInput.location)}
                    className="text-xs text-sky-500 font-semibold hover:underline"
                  >
                    다시 보기
                  </button>
                </div>
              )}
              <InputForm
                onSubmit={handleSubmit}
                loading={false}
                defaultLocation={lastInput?.location ?? null}
                defaultMonth={lastInput?.input.month ?? (new Date().getMonth() + 1)}
                defaultPeriod={lastInput?.input.period ?? 'early'}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { emoji: '🌤️', title: '날씨 요약', desc: '기온·강수·바람' },
                { emoji: '👕', title: '옷차림 추천', desc: '룰 기반 정확 분석' },
                { emoji: '🗺️', title: '명소·맛집', desc: '카테고리 4종' },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                  <div className="text-2xl mb-1">{item.emoji}</div>
                  <div className="text-xs font-semibold text-slate-700">{item.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 로딩 (첫 검색) */}
        {screen === 'loading' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <span className="w-4 h-4 border-2 border-sky-400/40 border-t-sky-500 rounded-full animate-spin" />
                날씨 데이터 분석 중...
              </div>
            </div>
            <LoadingSkeleton />
          </div>
        )}

        {/* 결과 */}
        {screen === 'result' && result && (
          <div className={`space-y-4 ${reloading ? 'opacity-60 pointer-events-none transition-opacity' : 'animate-fade-in'}`}>
            {/* 재조회 중 오버레이 */}
            {reloading && (
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-2 text-xs text-sky-500 bg-sky-50 px-3 py-1.5 rounded-full">
                  <span className="w-3 h-3 border-2 border-sky-300 border-t-sky-500 rounded-full animate-spin" />
                  {MONTH_LABEL[lastInput?.input.month ?? 1]} {PL[lastInput?.input.period ?? 'early']} 데이터 불러오는 중...
                </div>
              </div>
            )}

            <WeatherCard
              weather={result.weather}
              generatedAt={result.generatedAt}
              onRefresh={() => lastInput && handleQuickReload(lastInput.input.month, lastInput.input.period)}
              refreshing={reloading}
            />
            <OutfitCard
              outfit={result.outfit}
              city={result.weather.location.name}
              country={result.weather.location.country}
              month={result.weather.month}
              period={result.weather.period}
            />

            <div>
              <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                <span>🗺️</span> 추천 장소
              </h2>
              <RecommendationTabs
                key={`${result.weather.location.name}-${result.weather.location.country}`}
                city={result.weather.location.name}
                country={result.weather.location.country}
                style={lastInput?.input.style}
                companion={lastInput?.input.companion}
              />
            </div>
          </div>
        )}

        {/* 에러 */}
        {screen === 'error' && (
          <ErrorCard
            message={errorMsg}
            onRetry={() => {
              if (lastInput) handleSubmit(lastInput.input, lastInput.location);
            }}
          />
        )}
      </main>

      <div className="h-4" />
    </div>
  );
}
