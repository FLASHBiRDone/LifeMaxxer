/**
 * Browser-side helpers for the device-location flow. Keeps the
 * navigator.geolocation + reverse-geocoding plumbing out of the
 * components so it's easy to share between the Settings card and the
 * /today prompt.
 */

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type ResolvedLocation = DeviceLocation & {
  city: string;
  country: string | null;
};

/**
 * Wraps navigator.geolocation in a Promise. Rejects with a friendly
 * message we can surface directly in the UI.
 */
export function getDeviceLocation(): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Posisjon støttes ikke i denne nettleseren.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Du må gi tilgang til posisjon.'));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('Posisjon er ikke tilgjengelig.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Det tok for lang tid å hente posisjon.'));
        } else {
          reject(new Error(err.message || 'Kunne ikke hente posisjon.'));
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  });
}

/**
 * Reverse geocode lat/lon to a city + country name using BigDataCloud's
 * free client-side endpoint (no key required, generous quota for
 * personal use). Falls back to a generic label if the response is
 * unhelpful.
 */
export async function reverseGeocodeBrowser(
  latitude: number,
  longitude: number,
): Promise<{ city: string; country: string | null }> {
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('localityLanguage', 'no');
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string | null;
    };
    const city =
      body.city ||
      body.locality ||
      body.principalSubdivision ||
      'Min posisjon';
    return { city, country: body.countryName ?? null };
  } catch {
    return { city: 'Min posisjon', country: null };
  }
}

export async function resolveDeviceLocation(): Promise<ResolvedLocation> {
  const dev = await getDeviceLocation();
  const { city, country } = await reverseGeocodeBrowser(dev.latitude, dev.longitude);
  return { ...dev, city, country };
}
