const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type KakaoRegionDocument = {
  region_type: 'H' | 'B';
  code: string;
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const { latitude, longitude } = await request.json();
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: 'invalid_coordinates' }, 400);
    }

    const kakaoRestApiKey = Deno.env.get('KAKAO_REST_API_KEY');
    if (!kakaoRestApiKey) {
      return json({ error: 'missing_kakao_key' }, 500);
    }

    const url = new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
    url.searchParams.set('x', String(lng));
    url.searchParams.set('y', String(lat));

    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${kakaoRestApiKey}`,
      },
    });

    if (!response.ok) {
      return json({ error: 'reverse_geocode_failed' }, 502);
    }

    const data = await response.json();
    const documents = Array.isArray(data?.documents) ? data.documents as KakaoRegionDocument[] : [];
    const administrative = documents.find((item) => item.region_type === 'H');
    const legal = documents.find((item) => item.region_type === 'B');
    const region = administrative ?? legal;

    if (!region?.region_1depth_name || !region.region_2depth_name) {
      return json({ error: 'neighborhood_not_found' }, 404);
    }

    const neighborhoodName = normalizeName(region.region_3depth_name) || normalizeName(region.region_2depth_name);
    if (!neighborhoodName) {
      return json({ error: 'neighborhood_not_found' }, 404);
    }

    return json({
      neighborhood_name: neighborhoodName,
      neighborhood_code: region.code || `${region.region_1depth_name}-${region.region_2depth_name}-${neighborhoodName}`,
      district_name: region.region_2depth_name,
      district_code: region.code ? region.code.slice(0, 5) : region.region_2depth_name,
      region_name: region.region_1depth_name,
      region_code: region.code ? region.code.slice(0, 2) : region.region_1depth_name,
      source: administrative ? 'administrative' : 'legal',
    });
  } catch (error) {
    console.error('[reverse-geocode] failed', error);
    return json({ error: 'reverse_geocode_failed' }, 500);
  }
});

function normalizeName(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
