import { apiKey } from "../constants";

const forecastEndpoint = params => {
    const { cityName, lat, lon, days } = params;
    const locationQuery = lat && lon ? `${lat},${lon}` : cityName;
    return `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${locationQuery}&days=${days}&aqi=yes&alerts=no`;
};

const locationsEndpoint = params => `https://api.weatherapi.com/v1/search.json?key=${apiKey}&q=${params.cityName}`;

const apiCall = async (endpoint) => {
    try {
        console.log('API Request URL:', endpoint); // Debug the request URL
        const response = await fetch(endpoint, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log('API Response:', data); // Debug the response
        return data;
    } catch (err) {
        console.error('Error:', err);
        return null;
    }
};

export const fetchWeatherForecast = params => {
    const defaultParams = { days: 7, aqi: 'yes', alerts: 'no', ...params };
    return apiCall(forecastEndpoint(defaultParams));
};

export const fetchLocations = params => {
    if (!params.cityName) {
        console.error('Error: cityName is required');
        return null;
    }
    return apiCall(locationsEndpoint(params));
};