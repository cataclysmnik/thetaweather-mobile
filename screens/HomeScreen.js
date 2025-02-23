import { View, Text, Image, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useCallback, useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { theme } from '../theme'
import { debounce } from 'lodash'

import { CalendarDaysIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline'
import { MapPinIcon } from 'react-native-heroicons/solid'
import { ScrollView } from 'react-native'
import { fetchLocations, fetchWeatherForecast } from '../api/weather'
import { weatherImages } from '../constants'

import * as Progress from 'react-native-progress';

export default function HomeScreen() {
    const [showSearch, toggleSearch] = useState(false);
    const [locations, setLocations] = useState([1,2,3]);
    const [weather, setWeather] = useState({});
    const [loading, setLoading] = useState(true);

    const handleLocation = (loc) => {
        console.log('location: ', loc);
        setLocations([]);
        toggleSearch(false);
        fetchWeatherForecast({
            cityName: loc.name,
            days: '7'
        }).then(data=>{
            setWeather(data);
            console.log("got forecast", data);
        })
    }

    const handleSearch = value => {
        // fetch locations
        if (value.length > 2) {
            fetchLocations({cityName: value}).then(data => {
                setLocations(data);
            })
        }
    }

    useEffect(() => {
        fetchMyWeatherData();
    }, [])

    const fetchMyWeatherData = async () => {
        fetchWeatherForecast({
            cityName: 'Chennai',
            days: '7'
        }).then(data => {
            setWeather(data);
        })
    }
    const handleTextDebounce = useCallback(debounce(handleSearch, 1000), []);

    const {current, location} = weather;

    return (
    <View className="flex-1 relative">
        <StatusBar style='light' />
        <Image blurRadius={70} source={require('../assets/images/bg.png')} className="absolute h-full w-full" />

        {/* {
            loading? (

            ): (
                
            )
        } */}

        <SafeAreaView className="flex flex-1">
            {/* Search section */}

            <View style={{height: '7%'}} className="mx-4 relative z-50">
                <View className="flex-row justify-end items-center rounded-full"
                style={{backgroundColor: showSearch ? theme.bgWhite(0.2) : theme.bgWhite(0.005)}}>
                    {
                        showSearch ? (
                            <TextInput 
                                onChangeText={handleTextDebounce}
                                placeholder='Search City' 
                                placeholderTextColor={'lightgray'}
                                className="pl-6 h-10 pb-2 flex-1 text-base text-white"
                            />
                        ):null
                    }
                    <TouchableOpacity
                    onPress={()=> toggleSearch(!showSearch)}
                        style={{backgroundColor: theme.bgWhite(0.3)}}
                        className="rounded-full p-3 m-1"
                    >
                        <MagnifyingGlassIcon size="25" color="white" />
                    </TouchableOpacity>
                </View>
            </View>
            <View>
                {
                    locations.length > 0 && showSearch? (
                        <View className="absolute self-center w-11/12 bg-gray-300 top-2 rounded-3xl" style={{ elevation: 10, zIndex:50}}>
                            {
                                locations.map((loc, index) => {
                                    let showBorder = index+1 != locations.length;
                                    let borderClass = showBorder ? 'border-b-2 border-b-gray-400' : '';
                                    return (
                                        <TouchableOpacity
                                            onPress={() => handleLocation(loc)}
                                            key={index}
                                            className={`flex-row items-center border-0 p-3 px-4 mb-1 ${borderClass}`}
                                        >
                                        <MapPinIcon size="20" color="gray" />
                                        <Text className="text-black text-lg ml-2">{loc?.name}, {loc?.country}</Text>
                                        </TouchableOpacity>
                                    )
                                })
                            }
                        </View>
                    ):null
                }
            </View>
            {/* Forecast section */}
            <View className="mx-4 flex justify-around flex-1 mb-2">
                {/* location */}
                <Text className="text-white text-center text-2xl font-bold">
                    {location?.name},{' '}
                    <Text className="text-lg font-semibold text-gray-300">{location?.country}</Text>
                </Text>
                {/* weather image */}
                <View className="flex-row justify-center">
                    <Image 
                        source={weatherImages[current?.condition?.text]}
                        className="w-52 h-52"
                    />
                </View>
                {/* degree celsius */}
                <View className="space-y-2">
                    <Text className="text-center font-bold text-white text-6xl ml-5">
                        {current?.temp_c}&#176;
                    </Text>
                    <Text className="text-center text-white text-2xl tracking-widest">
                        {current?.condition?.text}
                    </Text>
                </View>
                {/* other stats */}
                <View className="flex-row justify-between mx-4">
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
                    <View className="flex-row space-x-2 items-center">
                        <Image source={require('../assets/icons/sun.png')} className="h-6 w-6" />
                        <Text className="text-white font-semibold text-base ml-2">
                            6:09 AM
                        </Text>
                    </View>
                </View>
            </View>
            {/* forecast for next days */}
            <View className="mb-8 space-y-3">
                <View className="flex-row items-center mx-5 space-x-2 mb-4">
                    <CalendarDaysIcon size="22" color="white" />
                    <Text className="text-white text-base ml-2">Daily Forecast</Text>
                </View>
                <ScrollView
                    horizontal
                    contentContainerStyle={{paddingHorizontal: 15}}
                    showsHorizontalScrollIndicator={false}
                >
                    {
                        weather?.forecast?.forecastday?.map((item, index) => {
                            let date = new Date(item.date);
                            let options = {weekday: 'long'};
                            let dayName = date.toLocaleDateString('en-US', options);
                            return (
                                <View 
                                    className="flex justify-center items-center w-24 rounded-3xl py-3 space-y-1 mr-4" style={{backgroundColor: theme.bgWhite(0.15)}}>
                                    <Image source={weatherImages[item?.day?.condition?.text]} className="h-11 w-11" />
                                    <Text className="text-white">{dayName}</Text>
                                    <Text className="text-white text-xl font-semibold">
                                        {item?.day?.avgtemp_c}&#176;
                                    </Text>
                                </View>
                            )
                            
                        })
                    }
                </ScrollView>
            </View>
        </SafeAreaView>
    </View>
  )
}