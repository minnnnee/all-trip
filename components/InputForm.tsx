'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, ChevronDown, Sliders } from 'lucide-react';
import type { GeoLocation, TripInput, Period, TravelStyle, Companion, TempSensitivity } from '@/lib/types';
import { MONTH_LABEL, PERIOD_LABEL, STYLE_LABEL as STYLE_MAP, COMPANION_LABEL as COMP_MAP, getDepartureDays, getWeatherMode } from '@/lib/types';

interface Props {
  onSubmit: (input: TripInput, location: GeoLocation) => void;
  loading: boolean;
  // 이전 검색값 전달 → 폼 초기값으로 사용
  defaultLocation?: GeoLocation | null;
  defaultMonth?: number;
  defaultPeriod?: Period;
}

const SENSITIVITY_LABELS: Record<TempSensitivity, string> = {
  cold: '추위 많이 탐',
  normal: '보통',
  hot: '더위 많이 탐',
};

export default function InputForm({
  onSubmit,
  loading,
  defaultLocation = null,
  defaultMonth,
  defaultPeriod = 'early',
}: Props) {
  const initMonth = defaultMonth ?? (new Date().getMonth() + 1);

  // 이전 도시가 있으면 미리 채워두기
  const [query, setQuery] = useState(
    defaultLocation ? `${defaultLocation.name}, ${defaultLocation.country}` : ''
  );
  const [suggestions, setSuggestions] = useState<GeoLocation[]>([]);
  const [selected, setSelected] = useState<GeoLocation | null>(defaultLocation ?? null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [month, setMonth] = useState<number>(initMonth);
  const [period, setPeriod] = useState<Period>(defaultPeriod);

  // 출발일
  const [departureDate, setDepartureDate] = useState<string>('');

  // 확장 옵션
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [style, setStyle] = useState<TravelStyle>('city');
  const [companion, setCompanion] = useState<Companion>('solo');
  const [sensitivity, setSensitivity] = useState<TempSensitivity>('normal');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 도시 자동완성
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.results ?? []);
      setShowSuggestions(true);
    } catch { setSuggestions([]); }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null); // 직접 입력 시 선택 해제
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (loc: GeoLocation) => {
    setSelected(loc);
    setQuery(`${loc.name}, ${loc.country}`);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const forecastDays = getDepartureDays(departureDate || undefined);
  const isForecastMode = getWeatherMode(departureDate || undefined) === 'forecast';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    onSubmit(
      { country: selected.country, city: selected.name, month, period, style, companion, sensitivity, departureDate: departureDate || undefined },
      selected
    );
  };

  const canSubmit = !!selected && !loading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 도시 검색 */}
      <div ref={wrapperRef} className="relative">
        <label className="block text-sm font-medium text-slate-600 mb-1.5">여행 도시</label>
        <div className="relative">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="도시 또는 나라 검색... (예: Tokyo, 파리)"
            className="w-full pl-10 pr-9 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all text-sm"
            autoComplete="off"
          />
          {selected && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-emerald-500 font-bold">✓</span>
          )}
        </div>

        {/* 자동완성 드롭다운 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            {suggestions.map((loc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(loc)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sky-50 text-left transition-colors border-b border-slate-100 last:border-0"
              >
                <span className="text-base">{countryEmoji(loc.countryCode)}</span>
                <div>
                  <div className="text-sm font-medium text-slate-800">{loc.name}</div>
                  <div className="text-xs text-slate-400">{[loc.admin1, loc.country].filter(Boolean).join(', ')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 월 + 시기 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">월</label>
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full appearance-none pl-3 pr-8 py-3 rounded-xl border border-slate-200 bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MONTH_LABEL[m]}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">시기</label>
          <div className="flex gap-1.5">
            {(['early', 'mid', 'late'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${
                  period === p
                    ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                }`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 출발일 (선택) */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">
          출발일 <span className="text-slate-400 font-normal">(선택 — 14일 이내 시 실시간 예보)</span>
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full pl-3 pr-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all text-sm"
            />
          </div>
          {departureDate ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                isForecastMode
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {isForecastMode ? `🟢 D-${forecastDays} 예보` : `📊 기후통계`}
              </span>
              <button
                type="button"
                onClick={() => setDepartureDate('')}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors text-base leading-none"
                aria-label="출발일 초기화"
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* 고급 옵션 토글 */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-500 transition-colors"
      >
        <Sliders className="w-3.5 h-3.5" />
        {showAdvanced ? '옵션 접기' : '여행 스타일 설정 (선택)'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {showAdvanced && (
        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">여행 스타일</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STYLE_MAP) as TravelStyle[]).map((s) => (
                <button key={s} type="button" onClick={() => setStyle(s)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${style === s ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
                  {STYLE_MAP[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">동행</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(COMP_MAP) as Companion[]).map((c) => (
                <button key={c} type="button" onClick={() => setCompanion(c)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${companion === c ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
                  {COMP_MAP[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">체온 민감도</label>
            <div className="flex gap-1.5">
              {(Object.keys(SENSITIVITY_LABELS) as TempSensitivity[]).map((s) => (
                <button key={s} type="button" onClick={() => setSensitivity(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${sensitivity === s ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}>
                  {SENSITIVITY_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
          canSubmit
            ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />날씨 & 추천 불러오는 중...</>
        ) : (
          <><Search className="w-4 h-4" />여행 정보 알아보기</>
        )}
      </button>
    </form>
  );
}

function countryEmoji(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))).join('');
}
