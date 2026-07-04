declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

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

type NaverRegion = {
  area1?: { name?: string };
  area2?: { name?: string };
  area3?: { name?: string };
};

type NaverResult = {
  code?: { id?: string; type?: string };
  region?: NaverRegion;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return json({ success: true });
  }

  if (request.method !== 'POST') {
    return json({ success: false, error: 'METHOD_NOT_ALLOWED', detail: 'POST only', status: 405 }, 405);
  }

  const bodyResult = await parseRequestBody(request);
  if (!bodyResult.success) {
    return json(bodyResult, 400);
  }

  const lat = Number(bodyResult.body.latitude ?? bodyResult.body.lat);
  const lng = Number(bodyResult.body.longitude ?? bodyResult.body.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({
      success: false,
      error: 'INVALID_COORDINATES',
      detail: 'latitude/longitude 또는 lat/lng 숫자가 필요합니다.',
      status: 400,
    }, 400);
  }

  const kakaoRestApiKey = Deno.env.get('KAKAO_REST_API_KEY');
  const naverClientId = Deno.env.get('NAVER_CLIENT_ID') ?? Deno.env.get('NAVER_MAPS_CLIENT_ID');
  const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET') ?? Deno.env.get('NAVER_MAPS_CLIENT_SECRET');

  console.log('[reverse-geocode] env', {
    hasKakaoRestApiKey: Boolean(kakaoRestApiKey),
    hasNaverClientId: Boolean(naverClientId),
    hasNaverClientSecret: Boolean(naverClientSecret),
  });

  if (kakaoRestApiKey) {
    const kakaoResult = await fetchKakaoRegion(lat, lng, kakaoRestApiKey);
    if (kakaoResult.success) {
      return json(regionResponse(kakaoResult.region, kakaoResult.source));
    }

    if (!naverClientId || !naverClientSecret) {
      return json(kakaoResult);
    }
  } else {
    console.log('[reverse-geocode] Kakao skipped: missing KAKAO_REST_API_KEY');
  }

  if (naverClientId && naverClientSecret) {
    const naverResult = await fetchNaverRegion(lat, lng, naverClientId, naverClientSecret);
    if (naverResult.success) {
      return json(regionResponse(naverResult.region, naverResult.source));
    }

    return json(naverResult);
  }

  return json({
    success: false,
    error: 'MISSING_REVERSE_GEOCODE_KEY',
    detail: 'KAKAO_REST_API_KEY 또는 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 환경변수가 필요합니다.',
    status: 500,
  });
});

async function parseRequestBody(request: Request) {
  try {
    const body = await request.json();
    return { success: true as const, body };
  } catch (error) {
    console.log('[reverse-geocode] request.json failed', errorMessage(error));
    return {
      success: false as const,
      error: 'INVALID_JSON',
      detail: errorMessage(error),
      status: 400,
    };
  }
}

async function fetchKakaoRegion(latitude: number, longitude: number, apiKey: string) {
  const url = new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
  url.searchParams.set('x', String(longitude));
  url.searchParams.set('y', String(latitude));

  const result = await fetchText('KAKAO', url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
  });

  if (!result.ok) {
    return result;
  }

  const data = parseJsonText(result.body);
  const documents = Array.isArray(data?.documents) ? data.documents as KakaoRegionDocument[] : [];
  const administrative = documents.find((item) => item.region_type === 'H');
  const legal = documents.find((item) => item.region_type === 'B');
  const region = administrative ?? legal;

  if (!region?.region_1depth_name || !region.region_2depth_name) {
    return {
      success: false as const,
      error: 'KAKAO_REGION_NOT_FOUND',
      detail: result.body,
      status: result.status,
    };
  }

  const neighborhoodName = normalizeName(region.region_3depth_name) || normalizeName(region.region_2depth_name);
  if (!neighborhoodName) {
    return {
      success: false as const,
      error: 'KAKAO_NEIGHBORHOOD_NOT_FOUND',
      detail: result.body,
      status: result.status,
    };
  }

  return {
    success: true as const,
    source: administrative ? 'kakao_administrative' : 'kakao_legal',
    region: {
      neighborhoodName,
      neighborhoodCode: region.code || `${region.region_1depth_name}-${region.region_2depth_name}-${neighborhoodName}`,
      districtName: region.region_2depth_name,
      districtCode: region.code ? region.code.slice(0, 5) : region.region_2depth_name,
      regionName: region.region_1depth_name,
      regionCode: region.code ? region.code.slice(0, 2) : region.region_1depth_name,
    },
  };
}

async function fetchNaverRegion(latitude: number, longitude: number, clientId: string, clientSecret: string) {
  const url = new URL('https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc');
  url.searchParams.set('coords', `${longitude},${latitude}`);
  url.searchParams.set('orders', 'admcode,legalcode');
  url.searchParams.set('output', 'json');

  const result = await fetchText('NAVER', url, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
    },
  });

  if (!result.ok) {
    return result;
  }

  const data = parseJsonText(result.body);
  const results = Array.isArray(data?.results) ? data.results as NaverResult[] : [];
  const administrative = results.find((item) => item.code?.type === 'A');
  const legal = results.find((item) => item.code?.type === 'L');
  const item = administrative ?? legal ?? results[0];
  const region = item?.region;
  const regionName = normalizeName(region?.area1?.name);
  const districtName = normalizeName(region?.area2?.name);
  const neighborhoodName = normalizeName(region?.area3?.name) || districtName;

  if (!regionName || !districtName || !neighborhoodName) {
    return {
      success: false as const,
      error: 'NAVER_REGION_NOT_FOUND',
      detail: result.body,
      status: result.status,
    };
  }

  return {
    success: true as const,
    source: administrative ? 'naver_administrative' : 'naver_legal',
    region: {
      neighborhoodName,
      neighborhoodCode: item?.code?.id || `${regionName}-${districtName}-${neighborhoodName}`,
      districtName,
      districtCode: item?.code?.id ? item.code.id.slice(0, 5) : districtName,
      regionName,
      regionCode: item?.code?.id ? item.code.id.slice(0, 2) : regionName,
    },
  };
}

async function fetchText(provider: 'KAKAO' | 'NAVER', url: URL, init: RequestInit) {
  try {
    const response = await fetch(url, init);
    const body = await response.text();
    console.log(`[reverse-geocode] ${provider} status`, response.status);
    console.log(`[reverse-geocode] ${provider} response body`, body);

    if (!response.ok) {
      return {
        ok: false as const,
        success: false as const,
        error: `${provider}_API_FAILED`,
        detail: body,
        status: response.status,
      };
    }

    return {
      ok: true as const,
      status: response.status,
      body,
    };
  } catch (error) {
    const detail = errorMessage(error);
    console.log(`[reverse-geocode] ${provider} fetch failed`, detail);
    return {
      ok: false as const,
      success: false as const,
      error: `${provider}_FETCH_FAILED`,
      detail,
      status: 0,
    };
  }
}

function regionResponse(region: {
  neighborhoodName: string;
  neighborhoodCode: string;
  districtName: string;
  districtCode: string;
  regionName: string;
  regionCode: string;
}, source: string) {
  return {
    success: true,
    neighborhood: region.neighborhoodName,
    city: region.districtName,
    neighborhood_name: region.neighborhoodName,
    neighborhood_code: region.neighborhoodCode,
    district_name: region.districtName,
    district_code: region.districtCode,
    region_name: region.regionName,
    region_code: region.regionCode,
    source,
  };
}

function parseJsonText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeName(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
