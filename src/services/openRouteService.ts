const ORS_MATRIX_URL =
  'https://api.openrouteservice.org/v2/matrix/driving-car';

interface Coordinates {
  latitude: number;
  longitude: number;
}

export const getDrivingDistances = async (
  customer: Coordinates,
  electricians: Coordinates[],
) => {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENROUTESERVICE_API_KEY is not configured',
    );
  }

  const locations = [
    [
      customer.longitude,
      customer.latitude,
    ],
    ...electricians.map((electrician) => [
      electrician.longitude,
      electrician.latitude,
    ]),
  ];

  const response = await fetch(
    ORS_MATRIX_URL,
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locations,
        sources: ['0'],
        destinations: electricians.map(
          (_, index) => index + 1,
        ),
        metrics: ['distance', 'duration'],
        units: 'km',
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `OpenRouteService error: ${response.status} ${errorText}`,
    );
  }

  return response.json();
};