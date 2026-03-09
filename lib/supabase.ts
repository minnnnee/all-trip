import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = url && key ? createClient(url, key) : null;

export async function submitOutfitFeedback(data: {
  city: string;
  country: string;
  month: number;
  period: string;
  tempBand: string;
  tempDisplay: string;
  feedback: 'cold' | 'ok' | 'hot';
}) {
  if (!supabase) return;
  await supabase.from('outfit_feedback').insert({
    city: data.city,
    country: data.country,
    month: data.month,
    period: data.period,
    temp_band: data.tempBand,
    temp_display: data.tempDisplay,
    feedback: data.feedback,
  });
}
