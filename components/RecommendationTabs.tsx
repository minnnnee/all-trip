'use client';

import { useState, useEffect, useCallback } from 'react';
import { Map, Star, Bookmark, ExternalLink, ChevronDown } from 'lucide-react';
import type { PlaceCategory, PlaceItem, TravelStyle, Companion } from '@/lib/types';

interface Props {
  city: string;
  country: string;
  style?: TravelStyle;
  companion?: Companion;
}

const TABS: { key: PlaceCategory; label: string; emoji: string; color: string }[] = [
  { key: 'attraction', label: '명소',     emoji: '🏛️', color: 'sky' },
  { key: 'activity',   label: '액티비티', emoji: '🎯', color: 'green' },
  { key: 'cafe',       label: '카페',     emoji: '☕', color: 'amber' },
  { key: 'restaurant', label: '맛집',     emoji: '🍽️', color: 'rose' },
];

const TAB_ACTIVE: Record<string, string> = {
  sky:   'bg-sky-500 text-white border-sky-500',
  green: 'bg-green-500 text-white border-green-500',
  amber: 'bg-amber-500 text-white border-amber-500',
  rose:  'bg-rose-500 text-white border-rose-500',
};

const BADGE_COLOR: Record<string, string> = {
  sky:   'bg-sky-100 text-sky-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  rose:  'bg-rose-100 text-rose-700',
};

const PAGE_SIZE = 4;
const MAX_VISIBLE = 40;

// ─── 가격 레벨 표시 ───────────────────────────────────────────────────────────

function PriceDots({ level }: { level?: 1 | 2 | 3 | 4 }) {
  if (!level) return null;
  return (
    <span className="text-xs text-slate-400">
      {'₩'.repeat(level)}
    </span>
  );
}

// ─── 별점 표시 ────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
      <Star className="w-3 h-3 fill-amber-400" />
      {rating.toFixed(1)}
    </span>
  );
}

// ─── 장소 카드 ────────────────────────────────────────────────────────────────

function PlaceCard({
  place,
  colorKey,
  onSave,
  saved,
}: {
  place: PlaceItem;
  colorKey: string;
  onSave: (id: string) => void;
  saved: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
      {/* 이미지 */}
      {place.photoUrl ? (
        <img
          src={place.photoUrl}
          alt={place.name}
          className="w-full h-32 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl">
          {TABS.find((t) => t.key === place.category)?.emoji ?? '📍'}
        </div>
      )}

      <div className="p-3">
        {/* 이름 + 뱃지 */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1">{place.name}</h3>
          <div className="flex gap-1 shrink-0">
            {place.isLocalFavorite && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${BADGE_COLOR[colorKey]}`}>현지</span>
            )}
            {place.isTouristFavorite && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">인기</span>
            )}
          </div>
        </div>

        {/* 설명 */}
        <p className="text-xs text-slate-500 line-clamp-2 mb-2">{place.description}</p>

        {/* 태그 */}
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {place.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 하단 액션 바 */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Stars rating={place.rating} />
            <PriceDots level={place.priceLevel} />
          </div>
          <div className="flex items-center gap-1">
            {place.mapsUrl && (
              <a
                href={place.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-500 transition-colors"
                title="지도에서 보기"
              >
                <Map className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => onSave(place.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                saved ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-50'
              }`}
              title="저장"
            >
              <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 스켈레톤 ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer bg-[length:200%_100%]" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-slate-200 rounded w-3/4 animate-pulse" />
        <div className="h-2.5 bg-slate-100 rounded w-full animate-pulse" />
        <div className="h-2.5 bg-slate-100 rounded w-2/3 animate-pulse" />
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function RecommendationTabs({ city, country, style, companion }: Props) {
  const [activeTab, setActiveTab] = useState<PlaceCategory>('attraction');
  const [places, setPlaces] = useState<Partial<Record<PlaceCategory, PlaceItem[]>>>({});
  const [loading, setLoading] = useState<Partial<Record<PlaceCategory, boolean>>>({});
  const [visibleCount, setVisibleCount] = useState<Partial<Record<PlaceCategory, number>>>({});
  const [isMock, setIsMock] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const fetchCategory = useCallback(
    async (category: PlaceCategory) => {
      if ((places[category]?.length ?? 0) > 0 || loading[category]) return;

      setLoading((prev) => ({ ...prev, [category]: true }));
      try {
        const params = new URLSearchParams({
          city,
          country,
          category,
          ...(style ? { style } : {}),
          ...(companion ? { companion } : {}),
        });
        const res = await fetch(`/api/places?${params}`);
        const data = await res.json();
        setPlaces((prev) => ({ ...prev, [category]: data.places ?? [] }));
        if (data.isMock) setIsMock(true);
      } catch {
        // graceful degradation
      } finally {
        setLoading((prev) => ({ ...prev, [category]: false }));
      }
    },
    [city, country, style, companion, places, loading]
  );

  // 첫 탭 자동 로드 (key prop으로 도시 변경 시 컴포넌트 리마운트됨)
  useEffect(() => {
    fetchCategory('attraction');
  }, []); // eslint-disable-line

  const handleTabChange = (tab: PlaceCategory) => {
    setActiveTab(tab);
    fetchCategory(tab);
  };

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const currentTab = TABS.find((t) => t.key === activeTab)!;
  const currentPlaces = places[activeTab] ?? [];
  const isLoading = loading[activeTab] ?? false;
  const visible = visibleCount[activeTab] ?? PAGE_SIZE;
  const shownPlaces = currentPlaces.slice(0, visible);
  const hasMore = currentPlaces.length > visible && visible < MAX_VISIBLE;

  const showMore = () => {
    setVisibleCount((prev) => ({
      ...prev,
      [activeTab]: Math.min((prev[activeTab] ?? PAGE_SIZE) + PAGE_SIZE, MAX_VISIBLE),
    }));
  };

  return (
    <div className="animate-fade-up">
      {/* 탭 바 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? TAB_ACTIVE[tab.color]
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 목업 안내 */}
      {isMock && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <ExternalLink className="w-3 h-3 shrink-0" />
          Google Places API 키 미설정 — 예시 데이터가 표시됩니다. <code className="bg-amber-100 px-1 rounded">.env.local</code> 참고
        </div>
      )}

      {/* 카드 그리드 */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => <Skeleton key={i} />)
          : shownPlaces.length > 0
          ? shownPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                colorKey={currentTab.color}
                onSave={toggleSave}
                saved={saved.has(place.id)}
              />
            ))
          : (
            <div className="col-span-2 py-12 text-center text-slate-400">
              <p className="text-3xl mb-2">{currentTab.emoji}</p>
              <p className="text-sm">추천 장소를 불러오는 중...</p>
            </div>
          )}
      </div>

      {/* 더 보기 버튼 */}
      {!isLoading && hasMore && (
        <button
          onClick={showMore}
          className="mt-3 w-full py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          <ChevronDown className="w-4 h-4" />
          4개 더 보기 ({currentPlaces.length - visible}개 남음)
        </button>
      )}
    </div>
  );
}
