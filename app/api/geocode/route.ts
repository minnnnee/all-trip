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
/**
 * 한국어 도시명 → 영문 검색어 매핑
 * Open-Meteo 검색 정확도 보완 (한국 도시 동명 소도시 문제, 외국 도시 한글명 무결과 문제)
 */
const CITY_SEARCH_ALIAS: Record<string, string> = {
  // ── 한국 특별시 / 광역시 ──────────────────────────────────────────────────
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

  // ── 일본 ────────────────────────────────────────────────────────────────
  '도쿄': 'Tokyo', '오사카': 'Osaka', '삿포로': 'Sapporo',
  '후쿠오카': 'Fukuoka', '오키나와': 'Naha', '나하': 'Naha', '센다이': 'Sendai',
  '교토': 'Kyoto', '나고야': 'Nagoya', '고베': 'Kobe', '요코하마': 'Yokohama',
  '나라': 'Nara', '히로시마': 'Hiroshima', '가고시마': 'Kagoshima',
  '나가사키': 'Nagasaki', '구마모토': 'Kumamoto', '마쓰야마': 'Matsuyama',

  // ── 중국 ────────────────────────────────────────────────────────────────
  '베이징': 'Beijing', '상하이': 'Shanghai', '우한': 'Wuhan',
  '다롄': 'Dalian', '칭다오': 'Qingdao', '난징': 'Nanjing',
  '샤먼': 'Xiamen', '정저우': 'Zhengzhou', '창사': 'Changsha',
  '청두': 'Chengdu', '충칭': 'Chongqing', '광저우': 'Guangzhou',
  '선전': 'Shenzhen', '항저우': 'Hangzhou', '시안': 'Xian',
  '쿤밍': 'Kunming', '구이린': 'Guilin', '하얼빈': 'Harbin',

  // ── 대만 ────────────────────────────────────────────────────────────────
  '타이베이': 'Taipei', '타이페이': 'Taipei', '가오슝': 'Kaohsiung',
  '타이중': 'Taichung', '타이난': 'Tainan',

  // ── 동남아 ──────────────────────────────────────────────────────────────
  // 태국
  '방콕': 'Bangkok', '치앙마이': 'Chiang Mai', '푸켓': 'Phuket', '푸껫': 'Phuket',
  '코사무이': 'Ko Samui', '파타야': 'Pattaya', '끄라비': 'Krabi',
  // 베트남
  '호치민': 'Ho Chi Minh City', '하노이': 'Hanoi', '다낭': 'Da Nang',
  '호이안': 'Hoi An', '나트랑': 'Nha Trang', '달랏': 'Da Lat', '무이네': 'Mui Ne',
  // 필리핀
  '마닐라': 'Manila', '세부': 'Cebu', '보라카이': 'Boracay',
  '팔라완': 'Puerto Princesa', '보홀': 'Tagbilaran', '다바오': 'Davao',
  '수빅': 'Subic',
  // 싱가포르 / 말레이시아 / 인도네시아
  '싱가포르': 'Singapore',
  '쿠알라룸푸르': 'Kuala Lumpur', '조호르바루': 'Johor Bahru',
  '코타키나발루': 'Kota Kinabalu', '랑카위': 'Langkawi', '페낭': 'Penang',
  '발리': 'Denpasar', '자카르타': 'Jakarta', '롬복': 'Mataram',
  // 캄보디아 / 라오스 / 미얀마
  '씨엠립': 'Siem Reap', '프놈펜': 'Phnom Penh',
  '루앙프라방': 'Luang Prabang', '비엔티안': 'Vientiane',
  '양곤': 'Yangon', '만달레이': 'Mandalay', '바간': 'Bagan',

  // ── 미국 ────────────────────────────────────────────────────────────────
  '뉴욕': 'New York', '라스베가스': 'Las Vegas', '올랜도': 'Orlando',
  '워싱턴': 'Washington', '애틀랜타': 'Atlanta', '피닉스': 'Phoenix',
  'LA': 'Los Angeles', '엘에이': 'Los Angeles',
  '하와이': 'Honolulu', '뉴올리언스': 'New Orleans',
  '샌프란시스코': 'San Francisco', '샌디에이고': 'San Diego',
  '마이애미': 'Miami', '시카고': 'Chicago', '보스턴': 'Boston',
  '시애틀': 'Seattle', '덴버': 'Denver', '포틀랜드': 'Portland',

  // ── 유럽 ────────────────────────────────────────────────────────────────
  '런던': 'London', '파리': 'Paris', '로마': 'Rome',
  '암스테르담': 'Amsterdam', '베를린': 'Berlin', '바르셀로나': 'Barcelona',
  '프라하': 'Prague', '니스': 'Nice', '모나코': 'Monaco',
  '빈': 'Vienna', '뮌헨': 'Munich', '프랑크푸르트': 'Frankfurt',
  '취리히': 'Zurich', '제네바': 'Geneva', '브뤼셀': 'Brussels',
  '리스본': 'Lisbon', '포르투': 'Porto', '마드리드': 'Madrid',
  '세비야': 'Seville', '발렌시아': 'Valencia', '말라가': 'Malaga',
  '플로렌스': 'Florence', '피렌체': 'Florence', '베네치아': 'Venice',
  '베니스': 'Venice', '밀라노': 'Milan', '나폴리': 'Naples',
  '아테네': 'Athens', '이스탄불': 'Istanbul', '두브로브니크': 'Dubrovnik',
  '부다페스트': 'Budapest', '바르샤바': 'Warsaw', '크라쿠프': 'Krakow',
  '에든버러': 'Edinburgh', '더블린': 'Dublin', '코펜하겐': 'Copenhagen',
  '스톡홀름': 'Stockholm', '헬싱키': 'Helsinki', '오슬로': 'Oslo',
  '레이캬비크': 'Reykjavik',

  // ── 괌 / 태평양 ─────────────────────────────────────────────────────────
  '괌': 'Guam', '사이판': 'Saipan',

  // ── 중동 / 아프리카 / 기타 ───────────────────────────────────────────────
  '두바이': 'Dubai', '아부다비': 'Abu Dhabi', '도하': 'Doha', '무스카트': 'Muscat',
  '텔아비브': 'Tel Aviv', '암만': 'Amman',
  '모로코': 'Marrakech', '마라케시': 'Marrakech', '카이로': 'Cairo',
  '케이프타운': 'Cape Town', '나이로비': 'Nairobi',
  '뭄바이': 'Mumbai', '뉴델리': 'New Delhi', '방갈로르': 'Bangalore',

  // ── 오세아니아 ──────────────────────────────────────────────────────────
  '시드니': 'Sydney', '멜버른': 'Melbourne', '브리즈번': 'Brisbane',
  '골드코스트': 'Gold Coast', '케언즈': 'Cairns',
  '오클랜드': 'Auckland', '퀸스타운': 'Queenstown', '크라이스트처치': 'Christchurch',

  // ── 중남미 ──────────────────────────────────────────────────────────────
  '리우데자네이루': 'Rio de Janeiro', '상파울루': 'São Paulo',
  '부에노스아이레스': 'Buenos Aires', '멕시코시티': 'Mexico City',
  '칸쿤': 'Cancun',
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
  const q = searchParams.get('q')?.trim() ?? '';
  const lang = searchParams.get('lang') ?? 'ko';

  // 별칭 먼저 조회 (1글자 도시명도 허용: 빈→Vienna, 괌→Guam 등)
  const searchQuery = CITY_SEARCH_ALIAS[q] ?? q;

  if (!q || (searchQuery === q && searchQuery.length < 2)) {
    return NextResponse.json({ results: [] });
  }

  try {
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
