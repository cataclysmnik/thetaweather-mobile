import { View, Text, Image, TextInput, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { debounce } from 'lodash';

import { CalendarDaysIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import { MapPinIcon } from 'react-native-heroicons/solid';
import { ScrollView } from 'react-native';
import { fetchLocations, fetchWeatherForecast } from '../api/weather';
import { weatherImages } from '../constants';

import * as Progress from 'react-native-progress';
import { getData, storeData } from '../utils/asyncStorage';
import * as Location from 'expo-location';

export default function HomeScreen() {
    const [showSearch, toggleSearch] = useState(false);
    const [locations, setLocations] = useState([]);
    const [weather, setWeather] = useState({});
    const [loading, setLoading] = useState(true);

    // Animated values
    const translateX = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0.7)).current;

    useEffect(() => {
        // Opacity pulsing animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacityAnim, {
                    toValue: 0.5, // Decrease opacity
                    duration: 3000,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0.7, // Increase opacity
                    duration: 3000,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const handleLocation = (loc) => {
        setLocations([]);
        toggleSearch(false);
        setLoading(true);
        fetchWeatherForecast({
            cityName: loc.name,
            days: '7'
        }).then(data => {
            setWeather(data);
            setLoading(false);
            storeData('city', loc.name);
        });
    };

    const handleSearch = value => {
        if (value.length > 2) {
            fetchLocations({ cityName: value }).then(data => {
                setLocations(data);
            });
        }
    };

    useEffect(() => {
        fetchMyWeatherData();
    }, []);

    const fetchMyWeatherData = async () => {
        let myCity = await getData('city');
        if (myCity) {
            fetchWeatherForecast({
                cityName: myCity,
                days: '7'
            }).then(data => {
                setWeather(data);
                setLoading(false);
            });
        } else {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.error('Permission to access location was denied');
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            fetchWeatherForecast({
                lat: latitude,
                lon: longitude,
                days: '7'
            }).then(data => {
                setWeather(data);
                setLoading(false);
                storeData('city', data.location.name);
            });
        }
    };

    const handleTextDebounce = useCallback(debounce(handleSearch, 500), []);

    const { current, location } = weather;
    const formatLocalTime = (timeEpoch, timezone) => {
        return new Date(timeEpoch * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone,
        });
    };

    return (
        <View className="flex-1 relative">
            <StatusBar style='light' />
            
            {/* Animated Background */}
            <Animated.Image
                blurRadius={70}
                source={weatherImages[current?.condition?.text]}
                className="absolute h-full w-full"
            />

            {/* Animated Overlay */}
            <Animated.View
                style={{ opacity: opacityAnim }}
                className="absolute h-full w-full bg-black"
            />
            {
                loading ? (
                    <View className="flex-1 flex-row justify-center items-center">
                        <Progress.CircleSnail thickness={10} size={140} color="#cccccc" />
                    </View>
                ) : (
                    <SafeAreaView className="flex flex-1">
                        {/* Search section */}
                        <View style={{ height: '7%' }} className="mx-4 relative z-50 top-10">
                            <View className="flex-row justify-end items-center rounded-full"
                                style={{ backgroundColor: showSearch ? theme.bgWhite(0.2) : theme.bgWhite(0.005) }}>
                                {
                                    showSearch ? (
                                        <TextInput
                                            onChangeText={handleTextDebounce}
                                            placeholder='Search City'
                                            placeholderTextColor={'lightgray'}
                                            className="pl-6 h-10 pb-2 pt-2 flex-1 text-base text-white"
                                        />
                                    ) : null
                                }
                                <TouchableOpacity
                                    onPress={() => toggleSearch(!showSearch)}
                                    style={{ backgroundColor: theme.bgWhite(0.3) }}
                                    className="rounded-full p-3 m-1"
                                >
                                    <MagnifyingGlassIcon size="25" color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View>
                            {
                                locations.length > 0 && showSearch ? (
                                    <View className="absolute self-center w-11/12 bg-gray-300 top-10 rounded-3xl" style={{ elevation: 10, zIndex: 50 }}>
                                        {
                                            locations.map((loc, index) => {
                                                if (!loc?.name) return null; // Skip invalid locations

                                                return (
                                                    <TouchableOpacity
                                                        key={loc.id ? `loc-${loc.id}` : `loc-${loc.name}-${index}`} // Ensure unique key
                                                        onPress={() => handleLocation(loc)}
                                                        className="flex-row items-center border-0 p-3 px-4 mb-1"
                                                    >
                                                        <MapPinIcon size="20" color="gray" />
                                                        <Text className="text-black text-lg ml-2">{loc?.name}, {loc?.country}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        }
                                    </View>
                                ) : null
                            }
                        </View>
                        {/* Forecast section */}
                        <View className="mx-6 flex gap-4 justify-end bottom-10 flex-1">
                            {/* weather image */}
                            {/* <View className="flex-row">
                                <Image
                                    source={weatherImages[current?.condition?.text]}
                                    className="w-52 h-52"
                                />
                            </View> */}
                            {/* location */}
                            <Text className="text-white text-2xl font-bold">
                                {location?.name},{' '}
                                <Text className="text-lg font-semibold text-gray-300">{location?.country}</Text>
                            </Text>
                            
                            {/* degree celsius */}
                            <View className="space-y-2 gap-2">
                                <Text className="font-bold text-white text-8xl">
                                    {current?.temp_c}<Text className="text-gray-300 font-light text-8xl">&#176;C</Text>
                                </Text>
                                <Text className=" text-white text-2xl tracking-widest">
                                    {current?.condition?.text}
                                </Text>
                                <Text className=" text-gray-300 text-2xl">
                                    Feels like <Text className=" text-white font-semibold text-2xl">{current?.feelslike_c}</Text>
                                    &#176;C
                                </Text>
                            </View>
                            </View>
                            
                            {/* other stats */}
                            {/* <View className='pb-6'>
                                <View className="flex-row justify-between mx-20 bottom-4">
                                    <View className="flex-row space-x-2 items-center">
                                        <Image source={require('../assets/icons/wind.png')} className="h-6 w-6" />
                                        <Text className="text-white font-semibold text-base ml-2">
                                            {current?.wind_kph}kph
                                        </Text>
                                    </View>
                                    <View className="flex-row space-x-2 items-center">
                                        <Image source={require('../assets/icons/drop.png')} className="h-6 w-6" />
                                        <Text className="text-white font-semibold text-base ml-2">
                                            {current?.humidity}%
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                        {/* Hourly Forecast Section */}
                        <View className="mb-8 space-y-3">
                            <View className="flex-row items-center mx-5 space-x-2 mb-4">
                                <CalendarDaysIcon size="22" color="white" />
                                <Text className="text-white text-base ml-2">Hourly Forecast</Text>
                            </View>
                            <ScrollView
                                horizontal
                                contentContainerStyle={{ paddingHorizontal: 15 }}
                                showsHorizontalScrollIndicator={false}
                            >
                                {
                                    weather?.forecast?.forecastday[0]?.hour?.map((hour, index) => {
                                        const time = formatLocalTime(hour.time_epoch, location?.tz_id); // Use local timezone

                                        return (
                                            <View
                                                key={hour.time_epoch} // Use the unique time_epoch as the key
                                                className="flex justify-center items-center w-24 rounded-3xl py-3 space-y-1 mr-4"
                                                style={{ backgroundColor: theme.bgWhite(0.15) }}
                                            >
                                                <Text className="text-white">{time}</Text>
                                                <Image source={weatherImages[hour?.condition?.text]} className="h-11 w-11 m-4" />
                                                <Text className="text-white text-xl font-semibold">
                                                    {hour?.temp_c}&#176;
                                                </Text>
                                            </View>
                                        );
                                    })
                                }
                            </ScrollView>
                        </View>
                    </SafeAreaView>
                )
            }
        </View>
    );
}