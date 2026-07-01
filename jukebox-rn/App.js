import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { View, Text, StyleSheet } from 'react-native';
import { isSupabaseConfigured } from './src/utils/supabase';

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.fallbackContainer}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>SUPABASE CONFIGURATION REQUIRED</Text>
          <Text style={styles.subtitle}>
            Please configure your credentials in:
          </Text>
          <Text style={styles.code}>src/utils/supabase.js</Text>
          <Text style={styles.desc}>
            Once you fill in the supabaseUrl and supabaseAnonKey variables, the app will hot-reload automatically.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffd700',
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 16,
  },
  subtitle: {
    color: '#b3b3b3',
    fontSize: 14,
    textAlign: 'center',
  },
  code: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 20,
  },
  desc: {
    color: 'grey',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
