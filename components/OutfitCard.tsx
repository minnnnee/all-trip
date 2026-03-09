'use client';

import { useState } from 'react';
import { Shirt, Footprints, Package, Layers, CloudRain } from 'lucide-react';
import type { OutfitRecommendation, TempBand } from '@/lib/types';
import { submitOutfitFeedback } from '@/lib/supabase';

interface Props {
  outfit: OutfitRecommendation;
  city: string;
  country: string;
  month: number;
  period: string;
}

// ─── 밴드별 컬러 테마 ─────────────────────────────────────────────────────────
const BAND_THEME: Record<TempBand, { bg: string; text: string; badge: string; label: string }> = {
  very_cold: { bg: 'bg-blue-900', text: 'text-white', badge: 'bg-blue-700 text-blue-100', label: '매우 추움' },
  cold:      { bg: 'bg-blue-600', text: 'text-white', badge: 'bg-blue-500 text-blue-100', label: '추움' },
  cool:      { bg: 'bg-sky-500',  text: 'text-white', badge: 'bg-sky-400 text-sky-100',   label: '선선함' },
  mild:      { bg: 'bg-emerald-500', text: 'text-white', badge: 'bg-emerald-400 text-emerald-100', label: '쾌적' },
  warm:      { bg: 'bg-amber-400', text: 'text-white', badge: 'bg-amber-300 text-amber-900', label: '따뜻함' },
  hot:       { bg: 'bg-orange-500', text: 'text-white', badge: 'bg-orange-400 text-orange-100', label: '더움' },
  very_hot:  { bg: 'bg-red-600',  text: 'text-white', badge: 'bg-red-500 text-red-100',   label: '매우 더움' },
};

interface SectionProps {
  icon: React.ReactNode;
  label: string;
  items: string[];
  accent?: string;
}

function Section({ icon, label, items, accent = 'text-slate-700' }: SectionProps) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`${accent}`}>{icon}</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OutfitCard({ outfit, city, country, month, period }: Props) {
  const theme = BAND_THEME[outfit.band];
  const [selected, setSelected] = useState<string | null>(null);

  const handleFeedback = async (label: string, value: 'cold' | 'ok' | 'hot') => {
    setSelected(label);
    await submitOutfitFeedback({ city, country, month, period, tempBand: outfit.band, tempDisplay: outfit.tempDisplay, feedback: value });
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-md animate-fade-up">
      {/* 헤더 */}
      <div className={`${theme.bg} ${theme.text} px-5 py-4 flex items-center justify-between`}>
        <div>
          <p className="text-white/70 text-xs font-medium mb-0.5">옷차림 추천</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black">{outfit.tempDisplay}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${theme.badge}`}>
              {theme.label}
            </span>
          </div>
        </div>
        <span className="text-3xl">👕</span>
      </div>

      {/* 핵심 포인트 */}
      {outfit.keyPoints.length > 0 && (
        <div className="bg-sky-50 border-b border-sky-100 px-4 py-3 space-y-1">
          {outfit.keyPoints.map((pt, i) => (
            <p key={i} className="text-xs text-sky-700 flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">•</span>
              {pt}
            </p>
          ))}
        </div>
      )}

      {/* 옷차림 섹션들 */}
      <div className="bg-white px-4 py-4 space-y-4 divide-y divide-slate-100">
        <Section
          icon={<Shirt className="w-4 h-4" />}
          label="상의"
          items={outfit.top}
          accent="text-sky-500"
        />
        <div className="pt-3">
          <Section
            icon={<span className="text-sm">👖</span>}
            label="하의"
            items={outfit.bottom}
            accent="text-slate-500"
          />
        </div>
        {outfit.outer.length > 0 && outfit.outer[0] !== '없어도 무관' && (
          <div className="pt-3">
            <Section
              icon={<Layers className="w-4 h-4" />}
              label="아우터"
              items={outfit.outer}
              accent="text-indigo-500"
            />
          </div>
        )}
        <div className="pt-3">
          <Section
            icon={<Footprints className="w-4 h-4" />}
            label="신발"
            items={outfit.shoes}
            accent="text-amber-500"
          />
        </div>
        {outfit.accessories.length > 0 && (
          <div className="pt-3">
            <Section
              icon={<Package className="w-4 h-4" />}
              label="소지품 & 악세서리"
              items={outfit.accessories}
              accent="text-emerald-500"
            />
          </div>
        )}
      </div>

      {/* 레이어링 + 강수 조언 */}
      <div className="bg-slate-50 px-4 py-3 space-y-2 border-t border-slate-100">
        <div className="flex items-start gap-2 text-xs text-slate-600">
          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          {outfit.layeringAdvice}
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-600">
          <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          {outfit.precipAdvice}
        </div>
      </div>

      {/* 피드백 버튼 */}
      <div className="bg-white px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        <span className="text-xs text-slate-400">
          {selected ? '피드백 감사해요!' : '이 추천이 도움됐나요?'}
        </span>
        <div className="flex gap-2 ml-auto">
          {(['😰 추웠음', '👍 적당', '🥵 더웠음'] as const).map((label) => {
            const value = label.includes('추') ? 'cold' : label.includes('적') ? 'ok' : 'hot';
            const isSelected = selected === label;
            return (
              <button
                key={label}
                disabled={!!selected}
                onClick={() => handleFeedback(label, value as 'cold' | 'ok' | 'hot')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-600 disabled:opacity-40'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
