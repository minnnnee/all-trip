/**
 * GET /api/places?city={city}&country={country}&category={attraction|food|cafe|restaurant}&style={...}&companion={...}
 *
 * Google Places API (New) — Text Search
 * 환경변수: GOOGLE_PLACES_API_KEY
 *
 * API 키 미설정 시 목업 데이터 반환 (개발/데모용)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PlaceCategory, PlaceItem } from '@/lib/types';

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.editorialSummary',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.primaryType',
  'places.priceLevel',
  'places.photos',
].join(',');

// ─── 카테고리별 쿼리 템플릿 (style + companion 반영) ─────────────────────────

const QUERY_TEMPLATES: Record<
  PlaceCategory,
  (city: string, country: string, style?: string, companion?: string) => string
> = {
  attraction: (city, country, style, companion) => {
    if (style === 'hiking')
      return `hiking trails national parks nature reserves outdoor activities in ${city} ${country}`;
    if (style === 'leisure')
      return `beach resort spa relaxation scenic viewpoints in ${city} ${country}`;
    if (companion === 'family')
      return `family friendly kid activities theme parks zoo aquarium in ${city} ${country}`;
    if (companion === 'couple')
      return `romantic scenic spots sunset viewpoints historic landmarks in ${city} ${country}`;
    if (companion === 'friends')
      return `fun activities experiences nightlife popular spots in ${city} ${country}`;
    return `top tourist attractions landmarks museums in ${city} ${country}`;
  },
  food: (city, country, style, companion) => {
    if (style === 'food')
      return `must-try authentic local street food traditional dishes in ${city} ${country}`;
    if (companion === 'family')
      return `family friendly kid menu local food restaurants in ${city} ${country}`;
    if (companion === 'couple')
      return `romantic local dining authentic cuisine in ${city} ${country}`;
    return `local traditional food dishes restaurants in ${city} ${country}`;
  },
  cafe: (city, country, style, companion) => {
    if (style === 'leisure' || companion === 'couple')
      return `cozy romantic aesthetic cafes dessert patisserie in ${city} ${country}`;
    if (companion === 'friends')
      return `trendy popular cafes instagrammable specialty coffee in ${city} ${country}`;
    return `best cafes specialty coffee in ${city} ${country}`;
  },
  restaurant: (city, country, style, companion) => {
    if (style === 'food')
      return `michelin star local famous gourmet restaurants in ${city} ${country}`;
    if (companion === 'couple')
      return `romantic fine dining rooftop restaurants in ${city} ${country}`;
    if (companion === 'family')
      return `family friendly restaurants kids menu spacious in ${city} ${country}`;
    if (companion === 'friends')
      return `lively popular group dining restaurants bars in ${city} ${country}`;
    return `best local restaurants popular with locals in ${city} ${country}`;
  },
};

// ─── 가격 레벨 변환 ────────────────────────────────────────────────────────────

function toPriceLevel(raw?: string): 1 | 2 | 3 | 4 | undefined {
  const map: Record<string, 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return raw ? map[raw] : undefined;
}

// ─── Google Places API 호출 ────────────────────────────────────────────────────

const MIN_RATING = 4.0;   // 1차 필터 기준
const FALLBACK_RATING = 3.5; // 결과 부족 시 완화 기준
const RETURN_COUNT = 10;  // 최종 반환 개수

async function searchPlaces(
  query: string,
  category: PlaceCategory
): Promise<PlaceItem[]> {
  const body = {
    textQuery: query,
    languageCode: 'ko',
    maxResultCount: 20, // 필터링 여유분을 위해 넉넉히 요청
  };

  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 * 24 }, // 24h 캐시
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[places] Google API error', res.status, err);
    throw new Error(`Google Places API ${res.status}`);
  }

  const data = await res.json();
  const places = (data.places ?? []) as Record<string, unknown>[];

  const parsed: PlaceItem[] = places.map((p, i): PlaceItem => {
    const display = (p.displayName as { text?: string } | undefined)?.text ?? 'Unknown';
    const summary = (p.editorialSummary as { text?: string } | undefined)?.text ?? '';
    const mapsUri = typeof p.googleMapsUri === 'string' ? p.googleMapsUri : undefined;
    const rating = typeof p.rating === 'number' ? p.rating : undefined;
    const ratingCount = typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined;
    const priceLevel = toPriceLevel(typeof p.priceLevel === 'string' ? p.priceLevel : undefined);
    const primaryType = typeof p.primaryType === 'string' ? p.primaryType : '';

    const photos = (p.photos as { name?: string }[] | undefined) ?? [];
    const photoUrl =
      photos.length > 0 && GOOGLE_KEY && photos[0].name
        ? `https://places.googleapis.com/v1/${photos[0].name}/media?maxWidthPx=400&key=${GOOGLE_KEY}`
        : undefined;

    return {
      id: `${category}-${i}`,
      name: display,
      description: summary || `${display} — ${primaryType.replace(/_/g, ' ')}`,
      category,
      tags: primaryType ? [primaryType.replace(/_/g, ' ')] : [],
      rating,
      ratingCount,
      mapsUrl: mapsUri,
      photoUrl,
      priceLevel,
      isLocalFavorite: category === 'restaurant' && (ratingCount ?? 0) > 1000,
      isTouristFavorite: category === 'attraction' && (rating ?? 0) >= 4.5,
    };
  });

  // 별점 기준 필터 + 내림차순 정렬
  // 1차: MIN_RATING 이상, 결과가 5개 미만이면 FALLBACK_RATING으로 완화
  const byRating = (a: PlaceItem, b: PlaceItem) => (b.rating ?? 0) - (a.rating ?? 0);
  let filtered = parsed.filter((p) => (p.rating ?? 0) >= MIN_RATING).sort(byRating);
  if (filtered.length < 5) {
    filtered = parsed.filter((p) => (p.rating ?? 0) >= FALLBACK_RATING).sort(byRating);
  }
  if (filtered.length === 0) {
    filtered = [...parsed].sort(byRating); // 별점 데이터 자체가 없는 경우 전체 반환
  }

  return filtered.slice(0, RETURN_COUNT);
}

// ─── 목업 데이터 (API 키 없을 때) ─────────────────────────────────────────────

function getMockPlaces(city: string, category: PlaceCategory): PlaceItem[] {
  const demos: Record<PlaceCategory, PlaceItem[]> = {
    attraction: [
      { id: 'a1', name: `${city} 대표 랜드마크`, description: '현지인과 관광객 모두 즐겨 찾는 상징적 명소', category: 'attraction', tags: ['랜드마크'], rating: 4.7, isTouristFavorite: true },
      { id: 'a2', name: `${city} 역사 박물관`, description: '지역 역사와 문화를 한눈에 볼 수 있는 박물관', category: 'attraction', tags: ['박물관', '역사'] },
      { id: 'a3', name: `${city} 중앙공원`, description: '현지인이 즐겨 찾는 도심 속 공원', category: 'attraction', tags: ['자연', '공원'] },
    ],
    food: [
      { id: 'f1', name: `${city} 전통 요리`, description: '현지 전통 방식으로 조리된 대표 음식', category: 'food', tags: ['현지 음식', '전통'], priceLevel: 2 },
      { id: 'f2', name: `${city} 길거리 음식 거리`, description: '다양한 현지 길거리 음식을 맛볼 수 있는 거리', category: 'food', tags: ['길거리 음식', '야시장'], priceLevel: 1 },
    ],
    cafe: [
      { id: 'c1', name: `${city} 스페셜티 카페`, description: '현지 로스팅 원두와 감성적인 인테리어의 카페', category: 'cafe', tags: ['스페셜티', '감성'], rating: 4.5, priceLevel: 2 },
      { id: 'c2', name: `${city} 전통 찻집`, description: '전통 방식의 차와 디저트를 즐길 수 있는 공간', category: 'cafe', tags: ['전통', '차'], priceLevel: 2 },
    ],
    restaurant: [
      { id: 'r1', name: `${city} 로컬 맛집`, description: '현지인이 오랫동안 사랑해온 진짜 맛집', category: 'restaurant', tags: ['현지 인기', '가성비'], rating: 4.6, priceLevel: 2, isLocalFavorite: true },
      { id: 'r2', name: `${city} 파인 다이닝`, description: '미식가들이 즐겨 찾는 고급 레스토랑', category: 'restaurant', tags: ['파인다이닝', '고급'], priceLevel: 4 },
    ],
  };
  return demos[category];
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get('city')?.trim() ?? '';
  const country = searchParams.get('country')?.trim() ?? '';
  const category = (searchParams.get('category') ?? 'attraction') as PlaceCategory;
  const style = searchParams.get('style') ?? undefined;
  const companion = searchParams.get('companion') ?? undefined;

  if (!city) {
    return NextResponse.json({ error: 'city 파라미터 필요' }, { status: 400 });
  }

  // API 키 미설정 → 목업 반환
  if (!GOOGLE_KEY) {
    console.warn('[places] GOOGLE_PLACES_API_KEY 미설정 — 목업 데이터 반환');
    return NextResponse.json({ places: getMockPlaces(city, category), isMock: true });
  }

  try {
    const query = QUERY_TEMPLATES[category](city, country, style, companion);
    const places = await searchPlaces(query, category);
    return NextResponse.json({ places, isMock: false });
  } catch (e) {
    console.error('[places]', e);
    // 에러 시에도 목업으로 graceful fallback
    return NextResponse.json({ places: getMockPlaces(city, category), isMock: true });
  }
}
