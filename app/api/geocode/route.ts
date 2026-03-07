/**
 * GET /api/geocode?q={query}&lang={ko|en}
 *
 * Open-Meteo Geocoding API (무료, 키 불필요)
 * → 도시 자동완성 & 위경도 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import type { GeoLocation } from '@/lib/types';

interface OpenMeteoGeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
  feature_code?: string; // e.g. 'PPLC', 'PPL', 'PPLA', 'ADM1', 'PCLI'
}

/**
 * 한국 도시 한글명 → 영문명 매핑
 * Open-Meteo 한국어 검색 시 동명 소도시가 먼저 반환되는 문제 우회용
 * (예: "부산" → 전라남도 소도시, 실제 부산광역시는 "Busan" 검색 필요)
 */
const KOREAN_CITY_TO_EN: Record<string, string> = {
  // 특별시 / 광역시
  '서울': 'Seoul', '부산': 'Busan', '대구': 'Daegu', '인천': 'Incheon',
  '광주': 'Gwangju', '대전': 'Daejeon', '울산': 'Ulsan', '세종': 'Sejong',
  // 경기도
  '수원': 'Suwon', '성남': 'Seongnam', '고양': 'Goyang', '용인': 'Yongin',
  '부천': 'Bucheon', '안산': 'Ansan', '안양': 'Anyang', '평택': 'Pyeongtaek',
  '시흥': 'Siheung', '화성': 'Hwaseong', '의정부': 'Uijeongbu', '파주': 'Paju',
  // 강원도
  '춘천': 'Chuncheon', '강릉': 'Gangneung', '원주': 'Wonju', '속초': 'Sokcho',
  // 충청도
  '청주': 'Cheongju', '충주': 'Chungju', '천안': 'Cheonan', '아산': 'Asan',
  // 전라도
  '전주': 'Jeonju', '익산': 'Iksan', '군산': 'Gunsan', '순천': 'Suncheon',
  '여수': 'Yeosu', '목포': 'Mokpo',
  // 경상도
  '창원': 'Changwon', '포항': 'Pohang', '경주': 'Gyeongju', '구미': 'Gumi',
  '김해': 'Gimhae', '진주': 'Jinju', '거제': 'Geoje', '통영': 'Tongyeong',
  '안동': 'Andong',
  // 제주
  '제주': 'Jeju', '서귀포': 'Seogwipo',
};

/**
 * country 필드가 없는 특별 행정구/영토 — country_code → 표시명
 * Open-Meteo는 이 지역들에 country 필드를 반환하지 않음
 */
const TERRITORY_NAMES: Record<string, string> = {
  GU: '괌',
  MP: '북마리아나 제도',
  HK: '홍콩',
  MO: '마카오',
  PR: '푸에르토리코',
  VI: '미국령 버진아일랜드',
  AS: '아메리카사모아',
  NC: '뉴칼레도니아',
  PF: '프랑스령 폴리네시아',
  CW: '퀴라소',
  AW: '아루바',
  GP: '과들루프',
  MQ: '마르티니크',
  RE: '레위니옹',
  YT: '마요트',
  TF: '프랑스령 남방 영토',
};

/** 도시 우선 정렬 가중치 — 낮을수록 먼저 */
function featureCodePriority(code?: string): number {
  if (!code) return 5;
  if (code === 'PPLC') return 0;              // 수도
  if (code === 'PCLD' || code === 'PCLS' || code === 'PCLF') return 0; // 속령/종속지역 (괌, 사이판 등)
  if (code.startsWith('PPLA')) return 1;      // 주요 도시 (PPLA, PPLA2, ...)
  if (code === 'PPL' || code === 'PPLX') return 2; // 일반 도시/마을
  if (code.startsWith('ADM')) return 3;       // 행정구역
  if (code === 'PCLI') return 4;              // 국가
  return 5;
}

interface OpenMeteoGeoResponse {
  results?: OpenMeteoGeoResult[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim();
  const lang = searchParams.get('lang') ?? 'ko';

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // 한국 도시 한글명 → 영문명 변환 (Open-Meteo 한국어 검색 정확도 보완)
    const searchQuery = KOREAN_CITY_TO_EN[q] ?? q;

    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(searchQuery)}&count=8&language=${lang}&format=json`;

    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24h 캐시
    if (!res.ok) throw new Error('geocoding api error');

    const data: OpenMeteoGeoResponse = await res.json();
    const locations: GeoLocation[] = (data.results ?? [])
      .sort((a, b) => featureCodePriority(a.feature_code) - featureCodePriority(b.feature_code))
      .map((r) => {
        const code = r.country_code?.toUpperCase() ?? '';
        const countryRaw = r.country ?? TERRITORY_NAMES[code] ?? code;
        // name과 country가 같으면 중복 표시 방지 (예: 괌, 홍콩)
        const country = countryRaw === r.name ? '' : countryRaw;
        return {
          name: r.name,
          country,
          countryCode: code,
          latitude: r.latitude,
          longitude: r.longitude,
          admin1: r.admin1,
        };
      });

    return NextResponse.json({ results: locations });
  } catch (e) {
    console.error('[geocode]', e);
    return NextResponse.json({ error: '도시 검색 실패', results: [] }, { status: 500 });
  }
}
