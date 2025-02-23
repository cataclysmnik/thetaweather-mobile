import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import "./global.css"
import AppNavigation from './navigation/appNavigation';

export default function App() {
  return (
    <AppNavigation />
  );
}

