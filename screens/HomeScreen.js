import * as Location from 'expo-location'; // Import expo-location


import { View, Text, Image, TextInput, TouchableOpacity, Animated, ScrollView, Dimensions, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { debounce } from 'lodash';

import { CalendarDaysIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import { MapPinIcon } from 'react-native-heroicons/solid';
import { fetchLocations, fetchWeatherForecast } from '../api/weather';
import { weatherImages } from '../constants';

import * as Progress from 'react-native-progress';
import { getData, storeData } from '../utils/asyncStorage';

const { width } = Dimensions.get('window'); // Get screen width for horizontal paging

export default function HomeScreen() {
    const [showSearch, toggleSearch] = useState(false);
    const [locations, setLocations] = useState([]);
    const [weather, setWeather] = useState({ current: {}, location: {}, forecast: {} });
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [firstSuggestion, setFirstSuggestion] = useState(null);
    const [recentSearches, setRecentSearches] = useState([]);
    const [currentLocation, setCurrentLocation] = useState(null);

    const searchInputRef = useRef(null);

    const translateX = useRef(new Animated.Value(0)).current;
    const blurRadius = useRef(new Animated.Value(0)).current;
    const searchBarOpacity = useRef(new Animated.Value(0)).current;
    const searchBarScaleY = useRef(new Animated.Value(0)).current;
    const textFadeAnim = useRef(new Animated.Value(0)).current;
    const suggestionsOpacity = useRef(new Animated.Value(0)).current;
    const suggestionsTranslateY = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
        if (showSearch) {
            // Focus the input immediately
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }

            // Run animations in parallel
            Animated.parallel([
                Animated.timing(searchBarOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(searchBarScaleY, {
                    toValue: 1,
                    speed: 10,
                    bounciness: 10,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Dismiss keyboard first
            Keyboard.dismiss();

            Animated.parallel([
                Animated.timing(searchBarOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(searchBarScaleY, {
                    toValue: 0,
                    speed: 10,
                    bounciness: 10,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [showSearch]);

    useEffect(() => {
        if (!loading) {
            Animated.timing(textFadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }).start();
        } else {
            textFadeAnim.setValue(0);
        }
    }, [loading]);

    useEffect(() => {
        if (showSearch) {
            // Reset position before animating in
            suggestionsTranslateY.setValue(-20);
            Animated.parallel([
                Animated.timing(suggestionsOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(suggestionsTranslateY, {
                    toValue: 0,
                    speed: 12,
                    bounciness: 4,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(suggestionsOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(suggestionsTranslateY, {
                    toValue: -20,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [showSearch]);

    const handleLocation = async (loc) => {
        setLocations([]);
        setFirstSuggestion(null);
        toggleSearch(false);
        setLoading(true);

        // Update recent searches
        const newSearch = {
            id: loc.id || Date.now(),
            name: loc.name,
            country: loc.country
        };

        let updatedSearches = [newSearch];
        if (recentSearches.length > 0) {
            // Remove if already exists
            updatedSearches = [
                newSearch,
                ...recentSearches.filter(item => item.name !== loc.name)
            ].slice(0, 5); // Keep only last 5
        }

        setRecentSearches(updatedSearches);
        await storeData('recentSearches', updatedSearches);

        fetchWeatherForecast({
            cityName: loc.name,
            days: '7'
        }).then(data => {
            setWeather(data);
            setLoading(false);
            storeData('city', loc.name);
        });
    };

    const handleCurrentLocation = async () => {
        toggleSearch(false);
        setLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                setLoading(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Fetch weather data using latitude and longitude
            const data = await fetchWeatherForecast({
                lat: latitude,
                lon: longitude,
                days: '7'
            });

            if (data) {
                setWeather(data);
                setCurrentLocation({
                    name: data.location.name,
                    country: data.location.country
                });
                setLoading(false);
            }
        } catch (error) {
            console.error('Error getting current location:', error);
            setLoading(false);
        }
    };

    const handleSearch = value => {
        if (value.length > 2) {
            setSearching(true);
            fetchLocations({ cityName: value }).then(data => {
                setLocations(data);
                setFirstSuggestion(data?.[0] || null); // Set first suggestion
                setSearching(false);
            });
        } else {
            setLocations([]);
            setFirstSuggestion(null);
            setSearching(false);
        }
    };

    useEffect(() => {
        fetchMyWeatherData();
        // Load recent searches
        getData('recentSearches').then(searches => {
            if (searches && searches.length > 0) {
                setRecentSearches(searches);
            }
        });
    }, []);

    const fetchMyWeatherData = async () => {
        let myCity = await getData('city');
        let cityName = 'Chennai'; // Default city
        try {
            // Try to get the user's current location
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                // If permission is denied, use the last saved location
                if (myCity) cityName = myCity;
            } else {
                let location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;
                // Fetch weather data using latitude and longitude
                const data = await fetchWeatherForecast({
                    lat: latitude,
                    lon: longitude,
                    days: '7'
                });
                if (data) {
                    setWeather(data);
                    setCurrentLocation({
                        name: data.location.name,
                        country: data.location.country
                    });
                    setLoading(false);
                    return; // Exit early if current location is used
                }
            }
            // If current location is unavailable or fails, use the last saved location
            if (myCity) cityName = myCity;
            const data = await fetchWeatherForecast({
                cityName,
                days: '7'
            });
            if (data) {
                setWeather(data);
            } else {
                setWeather({ current: {}, location: {}, forecast: {} }); // Fallback to empty state
            }
        } catch (error) {
            console.error('Error fetching weather data:', error);
            setWeather({ current: {}, location: {}, forecast: {} }); // Fallback to empty state
        } finally {
            setLoading(false);
        }
    };

    const handleTextDebounce = useCallback(debounce(handleSearch, 500), []);
    const { current, location, forecast } = weather;

    const formatLocalTime = (timeEpoch, timezone) => {
        return new Date(timeEpoch * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone,
        });
    };

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: translateX } } }],
        { useNativeDriver: false }
    );

    const interpolatedBlurRadius = translateX.interpolate({
        inputRange: [0, width],
        outputRange: [70, 70],
    });

    const interpolatedOpacity = translateX.interpolate({
        inputRange: [0, width],
        outputRange: [0.7, 0.9],
    });

    return (
        <View className="flex-1 relative">
            <StatusBar style='light' />
            {/* Animated Background */}
            {weather.current && (
                <Animated.Image
                    blurRadius={interpolatedBlurRadius}
                    source={weatherImages[weather.current.condition?.text?.trim().toLowerCase()]}
                    className="absolute h-full w-full"
                />
            )}
            {/* Animated Overlay */}
            <Animated.View
                style={{ opacity: interpolatedOpacity }}
                className="absolute h-full w-full bg-black"
            />
            {loading ? (
                <View className="flex-1 flex-row justify-center items-center">
                    <Progress.CircleSnail thickness={10} size={140} color="#cccccc" />
                </View>
            ) : (
                <SafeAreaView className="flex flex-1">
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        <Animated.View
                            style={{
                                opacity: textFadeAnim,
                                width,
                            }}
                            className="flex-1"
                        >
                            {/* Search section */}
                            <Animated.View
                                style={{
                                    opacity: searchBarOpacity,
                                    transform: [{ scaleY: searchBarScaleY }],
                                }}
                                className="mx-4 relative z-50 top-10"
                            >
                                <View className="relative flex-row justify-end items-center rounded-full"
                                    style={{ backgroundColor: theme.bgWhite(0.2) }}>
                                    <View className='pl-6 h-14 p-4' style={{ position: 'absolute', left: 0, top: 1 }}>
                                        {firstSuggestion && !searching && (
                                            <Text
                                                style={{ color: 'rgba(255,255,255,0.3)' }}
                                                numberOfLines={1}
                                            >
                                                {firstSuggestion?.name}, {firstSuggestion?.country}
                                            </Text>
                                        )}
                                    </View>
                                    <TextInput
                                        ref={searchInputRef}
                                        onChangeText={(text) => {
                                            handleTextDebounce(text);
                                            if (!text) setFirstSuggestion(null);
                                        }}
                                        onSubmitEditing={() => {
                                            if (firstSuggestion) {
                                                handleLocation(firstSuggestion);
                                            }
                                        }}
                                        returnKeyType="search"
                                        placeholder='Search City'
                                        placeholderTextColor={'lightgray'}
                                        className="pl-6 h-14 pb-2 p-4 pt-2 flex-1 text-base text-white"
                                    />
                                    {searching ? (
                                        <ActivityIndicator size="small" color="white" className="mr-4" />
                                    ) : null}
                                </View>
                            </Animated.View>
                            <View>
                                {locations.length > 0 && showSearch ? (
                                    <Animated.View
                                        className="absolute self-center w-11/12 top-12 rounded-3xl overflow-hidden"
                                        style={{
                                            opacity: suggestionsOpacity,
                                            transform: [{ translateY: suggestionsTranslateY }],
                                            elevation: 10,
                                            zIndex: 50,
                                            backgroundColor: theme.bgWhite(1),
                                        }}
                                    >
                                        {locations.map((loc, index) => {
                                            if (!loc?.name) return null;
                                            return (
                                                <TouchableOpacity
                                                    key={loc.id ? `loc-${loc.id}` : `loc-${loc.name}-${index}`}
                                                    onPress={() => handleLocation(loc)}
                                                    className="flex-row items-center border-0 p-3 px-4 mb-1"
                                                >
                                                    <MapPinIcon size="20" color="gray" />
                                                    <Text className="text-black text-lg ml-2">{loc?.name}, {loc?.country}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </Animated.View>
                                ) : showSearch && (recentSearches.length > 0 || currentLocation) ? (
                                    <Animated.View
                                        className="absolute self-center w-11/12 top-12 rounded-3xl overflow-hidden"
                                        style={{
                                            opacity: suggestionsOpacity,
                                            transform: [{ translateY: suggestionsTranslateY }],
                                            elevation: 10,
                                            zIndex: 50,
                                            backgroundColor: theme.bgWhite(1),
                                        }}
                                    >
                                        {/* Your Location Option */}
                                        {currentLocation && (
                                            <>
                                                <Text className="text-gray-500 text-sm px-4 pt-3">Your Location</Text>
                                                <TouchableOpacity
                                                    onPress={handleCurrentLocation}
                                                    className="flex-row items-center border-0 p-3 px-4 mb-1"
                                                >
                                                    <MapPinIcon size="20" color="gray" />
                                                    <Text className="text-black text-lg ml-2">{currentLocation.name}, {currentLocation.country}</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        {/* Recent Searches */}
                                        {recentSearches.length > 0 && (
                                            <>
                                                <Text className="text-gray-500 text-sm px-4 pt-3">Recent searches</Text>
                                                {recentSearches.map((loc, index) => {
                                                    return (
                                                        <TouchableOpacity
                                                            key={`recent-${loc.id || index}`}
                                                            onPress={() => handleLocation(loc)}
                                                            className="flex-row items-center border-0 p-3 px-4 mb-1"
                                                        >
                                                            <MapPinIcon size="20" color="gray" />
                                                            <Text className="text-black text-lg ml-2">{loc?.name}, {loc?.country}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </Animated.View>
                                ) : null}
                            </View>
                            {/* Forecast section */}
                            <View className="mx-6 flex gap-4 justify-center flex-1">
                                <Text className="text-center text-white text-2xl font-bold">
                                    {location?.name},{' '}
                                    <Text className="text-lg font-semibold text-gray-300">{location?.country}</Text>
                                </Text>
                                <View className="space-y-2 gap-2">
                                    <Text className="text-center font-bold text-white text-8xl">
                                        {current?.temp_c}<Text className="text-gray-300 font-light text-8xl">&#176;</Text>
                                    </Text>
                                    <Text className="text-center text-white text-3xl tracking-widest">
                                        {current?.condition?.text}
                                    </Text>
                                </View>
                                <View className='items-center mt-10'>
                                    <TouchableOpacity
                                        onPress={() => toggleSearch(!showSearch)}
                                        style={{ backgroundColor: theme.bgWhite(0.3) }}
                                        className="rounded-full p-3"
                                    >
                                        <MagnifyingGlassIcon size="25" color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View
                            style={{
                                opacity: textFadeAnim,
                                width,
                            }}
                            className="flex-1 justify-center"
                        >
                            <Text className="text-white text-2xl font-bold px-4 my-2">Weather Details</Text>
                            {/* Weather Details Cards */}
                            <View className="flex-row flex-wrap px-4 justify-between">
                                {/* Humidity */}
                                <View className="w-[48%] bg-white/10 rounded-lg p-4 mb-4">
                                    <Text className="text-white text-lg">Humidity</Text>
                                    <Text className="text-white text-2xl font-bold">{current?.humidity}%</Text>
                                </View>
                                {/* UV Index */}
                                <View className="w-[48%] bg-white/10 rounded-lg p-4 mb-4">
                                    <Text className="text-white text-lg">UV Index</Text>
                                    <Text className="text-white text-2xl font-bold">{current?.uv}</Text>
                                </View>
                                {/* Precipitation */}
                                <View className="w-[48%] bg-white/10 rounded-lg p-4 mb-4">
                                    <Text className="text-white text-lg">Precipitation</Text>
                                    <Text className="text-white text-2xl font-bold">{current?.precip_mm}mm</Text>
                                </View>
                                <View className="w-[48%] bg-white/10 rounded-lg p-4 mb-4">
                                    <Text className="text-white text-lg">Air Quality Index</Text>
                                    <Text className="text-white text-2xl font-bold">{current?.air_quality?.["us-epa-index"]}</Text>
                                </View>
                                <View className="w-[48%] rounded-lg">
                                    <View className="bg-white/10 rounded-lg p-4 mb-4">
                                        <Text className="text-white text-lg">Wind Speed</Text>
                                        <Text className="text-white text-2xl font-bold">{current?.wind_kph} km/h</Text>
                                    </View>
                                    <View className="bg-white/10 rounded-lg p-4 mb-4">
                                        <Text className="text-white text-lg mt-2">Feels like</Text>
                                        <Text className="text-white text-2xl font-bold">{current?.feelslike_c}&#176;C</Text>
                                    </View>
                                </View>
                                {/* Sunrise & Sunset */}
                                <View className="w-[48%] bg-white/10 rounded-lg py-3 px-4 mb-4">
                                    <Text className="text-white text-lg">Sunrise</Text>
                                    <Text className="text-white text-xl font-bold">{forecast?.forecastday[0]?.astro?.sunrise}</Text>
                                    <Text className="text-white text-lg mt-2">Sunset</Text>
                                    <Text className="text-white text-xl font-bold">{forecast?.forecastday[0]?.astro?.sunset}</Text>
                                    <Text className="text-white text-lg mt-2">Moonphase</Text>
                                    <Text className="text-white text-xl font-bold">{forecast?.forecastday?.[0]?.astro?.moon_phase}</Text>
                                </View>
                            </View>
                            {/* Hourly Forecast */}
                            <View className="mb-8 space-y-3">
                                <View className="flex-row items-center mx-4 space-x-2 mb-4">
                                    <CalendarDaysIcon size="22" color="white" />
                                    <Text className="text-white text-base ml-2">Hourly Forecast</Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    contentContainerStyle={{ paddingLeft: 16, paddingRight: 0 }}
                                    showsHorizontalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                >
                                    {weather?.forecast?.forecastday[0]?.hour?.map((hour, index) => {
                                        const time = formatLocalTime(hour.time_epoch, location?.tz_id);
                                        return (
                                            <View
                                                key={hour.time_epoch}
                                                className="flex justify-center items-center w-24 rounded-3xl py-3 space-y-1 mr-4"
                                                style={{ backgroundColor: theme.bgWhite(0.15) }}
                                            >
                                                <Text className="text-white">{time}</Text>
                                                <Image source={weatherImages[hour?.condition?.text?.trim().toLowerCase()]} className="h-11 w-11 m-4" />
                                                <Text className="text-white text-xl font-semibold">
                                                    {hour?.temp_c}&#176;
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                            {/* Daily Forecast */}
                            <View className="mb-8 space-y-3">
                                <View className="flex-row items-center mx-4 space-x-2 mb-4">
                                    <CalendarDaysIcon size="22" color="white" />
                                    <Text className="text-white text-base ml-2">3-day Forecast</Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    contentContainerStyle={{ paddingLeft: 16, paddingRight: 0 }}
                                    showsHorizontalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                >
                                    {weather?.forecast?.forecastday?.map((item, index) => {
                                        let date = new Date(item.date);
                                        let options = { weekday: 'long' };
                                        let dayName = date.toLocaleDateString('en-US', options);
                                        return (
                                            <View
                                                key={item.date}
                                                className="flex justify-center items-center w-36 rounded-3xl py-3 space-y-1 mr-4"
                                                style={{ backgroundColor: theme.bgWhite(0.15) }}
                                            >
                                                <Text className="text-white">{dayName}</Text>
                                                <Image source={weatherImages[item?.day?.condition?.text?.trim().toLowerCase()]} className="h-11 w-11" />
                                                <Text className="text-white text-xl font-semibold">
                                                    {item?.day?.avgtemp_c}&#176;
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </SafeAreaView>
            )}
        </View>
    );
}