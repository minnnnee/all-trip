/**
 * 룰 기반 옷차림 추천 엔진
 *
 * 입력: ClimateData + TripInput(sensitivity, style, companion)
 * 출력: OutfitRecommendation
 *
 * 결정 트리:
 *   1. 평균 기온으로 TempBand 결정
 *   2. 체감온도(바람/습도) 보정
 *   3. 민감도(추위/더위 많이 탐) 보정
 *   4. 강수 modifier
 *   5. 일교차 modifier (레이어링)
 *   6. 스타일/동행 추가 항목
 */

import type {
  ClimateData,
  OutfitRecommendation,
  TempBand,
  TripInput,
} from './types';

// ─── 1. 체감온도 계산 ──────────────────────────────────────────────────────────

function calcFeelsLike(
  avgTemp: number,
  windSpeed: number,
  humidity: number
): number {
  let feels = avgTemp;

  // Wind Chill (기온 < 10°C, 풍속 > 5km/h)
  if (avgTemp < 10 && windSpeed > 5) {
    feels =
      13.12 +
      0.6215 * avgTemp -
      11.37 * Math.pow(windSpeed, 0.16) +
      0.3965 * avgTemp * Math.pow(windSpeed, 0.16);
  }

  // Heat Index (기온 > 27°C, 습도 > 40%)
  if (avgTemp > 27 && humidity > 40) {
    const e =
      (humidity / 100) *
      6.105 *
      Math.exp((17.27 * avgTemp) / (237.7 + avgTemp));
    feels = avgTemp + 0.33 * e - 4;
  }

  return Math.round(feels * 10) / 10;
}

// ─── 2. TempBand 결정 ──────────────────────────────────────────────────────────

function getTempBand(temp: number): TempBand {
  if (temp < 0) return 'very_cold';
  if (temp < 10) return 'cold';
  if (temp < 17) return 'cool';
  if (temp < 23) return 'mild';
  if (temp < 28) return 'warm';
  if (temp < 35) return 'hot';
  return 'very_hot';
}

// ─── 3. 밴드별 베이스 추천 ────────────────────────────────────────────────────

const BASE_OUTFITS: Record<
  TempBand,
  Pick<OutfitRecommendation, 'top' | 'bottom' | 'outer' | 'shoes'>
> = {
  very_cold: {
    top: ['기모 이너/히트텍', '두꺼운 울 니트 or 맨투맨'],
    bottom: ['기모 두꺼운 진', '히트텍 레깅스 레이어'],
    outer: ['구스다운 or 패딩 롱코트', '헤비 울 오버코트'],
    shoes: ['방한 부츠 (어그 / 워커)', '두꺼운 울 양말 필수'],
  },
  cold: {
    top: ['두꺼운 니트 or 맨투맨', '히트텍 이너'],
    bottom: ['두꺼운 진 / 치노 팬츠', '기모 레깅스'],
    outer: ['패딩 / 울 코트', '트렌치코트 + 내부 니트'],
    shoes: ['스니커즈 / 첼시 부츠', '두꺼운 양말'],
  },
  cool: {
    top: ['긴팔 티셔츠', '얇은 니트 / 셔츠'],
    bottom: ['진 / 치노 팬츠'],
    outer: ['가디건 / 경량 재킷', '트렌치코트'],
    shoes: ['스니커즈 / 로퍼'],
  },
  mild: {
    top: ['얇은 긴팔 or 반팔', '면 블라우스 / 셔츠'],
    bottom: ['진 / 면바지 / 스커트'],
    outer: ['얇은 가디건 (저녁 용)', '시어 재킷'],
    shoes: ['스니커즈 / 플랫 / 로퍼'],
  },
  warm: {
    top: ['반팔 티셔츠', '민소매 / 린넨 셔츠'],
    bottom: ['면바지 / 린넨 팬츠', '쇼츠 or 스커트'],
    outer: ['얇은 여름 재킷 (자외선 차단용)', '없어도 무관'],
    shoes: ['샌들 / 스니커즈'],
  },
  hot: {
    top: ['얇은 반팔', '민소매 / 린넨 소재 권장'],
    bottom: ['쇼츠 / 린넨 팬츠'],
    outer: ['쿨링 UV 차단 재킷 (선택)'],
    shoes: ['샌들 / 슬리퍼'],
  },
  very_hot: {
    top: ['흡습속건 기능성 반팔', '얇은 린넨 / 면 소재 반팔'],
    bottom: ['쇼츠 / 얇은 린넨 팬츠'],
    outer: ['UV 차단 쿨링 재킷 (외출 필수)'],
    shoes: ['샌들 / 슬리퍼', '끈 조리는 No — 장거리 주의'],
  },
};

// ─── 4. 기본 악세서리 ─────────────────────────────────────────────────────────

const BASE_ACCESSORIES: Record<TempBand, string[]> = {
  very_cold: ['장갑', '비니 / 털 모자', '머플러 / 두꺼운 목도리', '핫팩'],
  cold: ['머플러', '얇은 장갑 (바람 강할 때)', '귀마개'],
  cool: ['스카프 (저녁 / 바람)', '선글라스'],
  mild: ['선글라스', '작은 가방 (레이어 넣기 용)'],
  warm: ['선글라스', '선크림 SPF 30+', '모자'],
  hot: ['선글라스', '선크림 SPF 50+', '모자 (챙 넓은)', '부채 / 쿨링 스프레이'],
  very_hot: [
    '자외선 차단 양산 / 우산',
    '선크림 SPF 50+ PA++++',
    '선글라스',
    '챙 넓은 모자',
    '쿨링 스프레이',
    '물통 (수분 보충 필수)',
  ],
};

// ─── 5. 강수 modifier ─────────────────────────────────────────────────────────

type PrecipBand = 'dry' | 'light' | 'moderate' | 'heavy';

function getPrecipBand(precipMm: number, precipDays: number): PrecipBand {
  if (precipMm < 15 || precipDays < 2) return 'dry';
  if (precipMm < 60 || precipDays < 5) return 'light';
  if (precipMm < 120 || precipDays < 10) return 'moderate';
  return 'heavy';
}

const PRECIP_ADVICE: Record<PrecipBand, string> = {
  dry: '강수 가능성 낮음 — 우산 없이도 OK.',
  light: '간간이 소나기 가능. 접이식 우산 or 방수 재킷 권장.',
  moderate: '비가 자주 옴. 방수 재킷 + 방수 신발 추천, 우산 필수.',
  heavy: '강수량 많음. 완전 방수 아우터 + 방수 부츠 + 우산 필수. 귀중품 방수백 보관.',
};

function applyPrecipModifier(
  accessories: string[],
  shoes: string[],
  outer: string[],
  band: PrecipBand,
  tempBand: TempBand
): void {
  if (band === 'dry') return;

  if (band === 'light') {
    accessories.push('접이식 우산');
    if (!outer.some((o) => o.includes('방수') || o.includes('레인'))) {
      outer.push('얇은 방수 재킷 (가방에 넣어두기)');
    }
  }

  if (band === 'moderate') {
    accessories.push('우산 (필수)');
    if (!outer.some((o) => o.includes('방수'))) {
      outer.push('방수 재킷 (필수)');
    }
    // 샌들은 비 올 때 부적합
    const sandal = shoes.findIndex((s) => s.includes('샌들') || s.includes('슬리퍼'));
    if (sandal > -1) shoes[sandal] = '방수 스니커즈 or 방수 샌들';
  }

  if (band === 'heavy') {
    accessories.push('우산 (대형 / 튼튼한 것)', '방수 파우치 (귀중품 보호)');
    if (!outer.some((o) => o.includes('방수'))) {
      outer.splice(0, outer.length, '완전 방수 아우터 (고어텍스 등)');
    }
    const sandal = shoes.findIndex((s) => s.includes('샌들') || s.includes('슬리퍼'));
    if (sandal > -1) shoes[sandal] = '방수 트레킹화 or 레인부츠';
    else if (!shoes.some((s) => s.includes('방수'))) {
      shoes.push('방수 신발 권장');
    }
    if (tempBand === 'very_hot' || tempBand === 'hot') {
      accessories.push('빠른 건조 소재 의류 추천');
    }
  }
}

// ─── 6. 레이어링 조언 ─────────────────────────────────────────────────────────

function getLayeringAdvice(tempRange: number, tempBand: TempBand): string {
  if (tempRange >= 15) {
    return `일교차가 ${Math.round(tempRange)}°C로 큼. 탈착 가능한 아우터(가디건/경량 재킷)를 꼭 챙기세요.`;
  }
  if (tempRange >= 10) {
    return `일교차 ${Math.round(tempRange)}°C — 낮과 밤 온도 차이가 있어요. 얇은 겉옷 하나 여유 있게 챙기세요.`;
  }
  if (tempBand === 'very_cold' || tempBand === 'cold') {
    return '내복 → 중간 옷 → 두꺼운 아우터 순으로 껴입어 보온성을 높이세요.';
  }
  return '기온이 비교적 일정해 아침저녁에 두꺼운 겉옷 따로 챙길 필요 없어요.';
}

// ─── 7. 스타일 / 동행 추가 항목 ───────────────────────────────────────────────

function applyStyleModifier(
  top: string[],
  outer: string[],
  accessories: string[],
  shoes: string[],
  input: TripInput,
  band: TempBand
): void {
  // ── 스타일별 ────────────────────────────────────────────────────────────────
  if (input.style === 'hiking') {
    shoes.push('트레킹화 / 등산화 (필수)');
    accessories.push('방수 배낭', '스틱 (장거리 하이킹)', '행동식/에너지바');
    if (band === 'warm' || band === 'hot' || band === 'very_hot') {
      top.push('흡습속건 기능성 티셔츠 (등산 전용)');
    }
    if (band === 'cold' || band === 'very_cold' || band === 'cool') {
      outer.push('방풍 소프트쉘 재킷');
    }
  }

  if (input.style === 'leisure') {
    if (band === 'warm' || band === 'hot' || band === 'very_hot') {
      top.push('수영복 / 래쉬가드 (해변·풀 대비)');
      accessories.push('비치백', '방수 슬리퍼');
    }
    accessories.push('여행용 파우치 (소지품 정리)');
  }

  if (input.style === 'food') {
    accessories.push('여유로운 핏 복장 권장 (식사 과식 대비)', '습식 티슈 / 손 소독제');
  }

  if (input.style === 'city') {
    accessories.push('크로스백 or 슬링백 (도시 이동 편리)');
  }

  // ── 동행별 ─────────────────────────────────────────────────────────────────
  if (input.companion === 'family') {
    accessories.push('어린이 선크림 (키즈용 SPF 50+)', '모기 기피제', '여분 속옷/옷 (아이용)', '간식 파우치');
  }

  if (input.companion === 'couple') {
    accessories.push('저녁 외출용 스마트 캐주얼 1벌 (파인다이닝·야경 투어 대비)');
  }

  if (input.companion === 'friends') {
    accessories.push('편한 신발 필수 (장시간 이동·활동)', '보조배터리');
  }
}

// ─── 8. 핵심 포인트 생성 ──────────────────────────────────────────────────────

function buildKeyPoints(
  tempBand: TempBand,
  feelsLike: number,
  precipBand: PrecipBand,
  tempRange: number
): string[] {
  const pts: string[] = [];

  const bandMessages: Record<TempBand, string> = {
    very_cold: `체감 ${feelsLike}°C 이하 — 노출 최소화, 완전 방한 필수`,
    cold: `체감 ${feelsLike}°C — 두꺼운 아우터에 옷 껴입어 보온`,
    cool: `체감 ${feelsLike}°C — 가디건/재킷 하나면 충분`,
    mild: `체감 ${feelsLike}°C — 활동하기 가장 쾌적한 기온`,
    warm: `체감 ${feelsLike}°C — 가벼운 옷으로, 자외선 차단 시작`,
    hot: `체감 ${feelsLike}°C — 통기성 우선, 자외선 차단 필수`,
    very_hot: `체감 ${feelsLike}°C 이상 — 열사병 주의, 수분 보충 자주`,
  };
  pts.push(bandMessages[tempBand]);

  if (precipBand === 'heavy') pts.push('우기 시즌 — 방수 장비 전부 챙기기');
  else if (precipBand === 'moderate') pts.push('비 자주 옴 — 우산/방수 재킷 필수');

  if (tempRange >= 15) pts.push(`일교차 ${Math.round(tempRange)}°C — 겉옷 탈착 필수`);

  return pts.slice(0, 3);
}

// ─── 메인 엔진 함수 ────────────────────────────────────────────────────────────

export function getOutfitRecommendation(
  climate: ClimateData,
  input: TripInput
): OutfitRecommendation {
  // 1. 체감온도 계산
  const feelsLike = calcFeelsLike(climate.tempAvg, climate.windSpeed, climate.humidity);

  // 2. 민감도 보정
  let effectiveTemp = feelsLike;
  if (input.sensitivity === 'cold') effectiveTemp -= 3;   // 추위 많이 탐 → 더 춥게 느낌
  if (input.sensitivity === 'hot') effectiveTemp += 3;    // 더위 많이 탐 → 더 덥게 느낌

  // 3. TempBand 결정
  const band = getTempBand(effectiveTemp);

  // 4. 베이스 아이템 (deep copy)
  const base = BASE_OUTFITS[band];
  const top = [...base.top];
  const bottom = [...base.bottom];
  const outer = [...base.outer];
  const shoes = [...base.shoes];
  const accessories = [...BASE_ACCESSORIES[band]];

  // 5. 최저기온 낮으면 반바지 후순위 처리
  // warm 밴드(23-27°C)인데 아침 최저가 18°C 미만이면 반바지는 낮에만 가능
  if (band === 'warm' && climate.tempMin < 18) {
    const shortsIdx = bottom.findIndex((b) => b.includes('쇼츠'));
    if (shortsIdx !== -1) bottom[shortsIdx] = '쇼츠 (낮에만, 아침저녁엔 면바지)';
  }

  // 5. 강수 modifier
  const precipBand = getPrecipBand(climate.precipitation, climate.precipDays);
  applyPrecipModifier(accessories, shoes, outer, precipBand, band);

  // 6. 스타일/동행 modifier
  applyStyleModifier(top, outer, accessories, shoes, input, band);

  // 7. 눈 대비
  if (climate.snowDays > 2) {
    if (!shoes.some((s) => s.includes('부츠') || s.includes('방수'))) {
      shoes.push('방수 부츠 (눈길 대비)');
    }
    accessories.push('방수 장갑');
  }

  return {
    band,
    tempDisplay: `${Math.round(climate.tempMin)}–${Math.round(climate.tempMax)}°C`,
    top,
    bottom,
    outer,
    shoes,
    accessories,
    keyPoints: buildKeyPoints(band, Math.round(feelsLike), precipBand, climate.tempRange),
    layeringAdvice: getLayeringAdvice(climate.tempRange, band),
    precipAdvice: PRECIP_ADVICE[precipBand],
  };
}
