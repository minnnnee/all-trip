/**
 * GET /api/weather?lat={lat}&lng={lng}&month={1-12}&period={early|mid|late}
 *
 * Open-Meteo Archive API 기반 기후 데이터 조회 (무료, 키 불필요)
 * 최근 3년치 동일 월/시기 평균 → ClimateData + WeatherAlert[]
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchClimateData, buildWeatherAlerts } from '@/lib/weather-utils';
import type { Period } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const month = parseInt(searchParams.get('month') ?? '');
  const period = searchParams.get('period') as Period | null;

  if (isNaN(lat) || isNaN(lng) || isNaN(month) || !period) {
    return NextResponse.json(
      { error: '필수 파라미터 누락 (lat, lng, month, period)' },
      { status: 400 }
    );
  }

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month는 1–12 사이' }, { status: 400 });
  }

  if (!['early', 'mid', 'late'].includes(period)) {
    return NextResponse.json({ error: 'period는 early|mid|late' }, { status: 400 });
  }

  try {
    const climate = await fetchClimateData(lat, lng, month, period);
    const alerts = buildWeatherAlerts(climate);

    return NextResponse.json(
      { climate, alerts },
      {
        headers: {
          // 결과를 1시간 캐시 (vercel edge / browser 공통)
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (e) {
    console.error('[weather]', e);
    return NextResponse.json({ error: '날씨 데이터 조회 실패' }, { status: 500 });
  }
}
