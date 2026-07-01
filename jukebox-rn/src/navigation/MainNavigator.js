import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet } from 'react-native';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import JamLobbyScreen from '../screens/JamLobbyScreen';
import PixelBlendScreen from '../screens/PixelBlendScreen';
import MiniPlayer from '../components/MiniPlayer';
import { usePlayerStore } from '../store/usePlayerStore';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#ff00ff',
        tabBarInactiveTintColor: 'grey',
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 0,
          height: 60,
          paddingBottom: 8,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const loadCachedRegistry = usePlayerStore(state => state.loadCachedRegistry);

  // Initialize cached songs list on app start
  useEffect(() => {
    loadCachedRegistry();
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="JamLobby" component={JamLobbyScreen} />
        <Stack.Screen name="PixelBlend" component={PixelBlendScreen} />
      </Stack.Navigator>

      {/* Persistent MiniPlayer Overlay */}
      {currentTrack && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 60, // Sits directly on top of Tab Navigation
    left: 0,
    right: 0,
    paddingHorizontal: 8,
  },
});
