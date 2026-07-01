import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './src/utils/supabase';
import { usePlayerStore } from './src/store/usePlayerStore';
import { makeRedirectUri } from 'expo-auth-session';

export default function App() {
  const spotifyToken = usePlayerStore(state => state.spotifyToken);
  const setSpotifyToken = usePlayerStore(state => state.setSpotifyToken);

  const exchangeCodeForToken = async (code, codeVerifier) => {
    try {
      const details = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : makeRedirectUri({
              scheme: 'jukebox',
              useProxy: true,
            }),
        client_id: '1fb2261355cd4979af85a0c79a225fd2',
        code_verifier: codeVerifier,
      };

      const formBody = Object.keys(details)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key]))
        .join('&');

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      });

      const data = await res.json();
      if (data.access_token) {
        setSpotifyToken(data.access_token);
        alert("Connected to Spotify Premium successfully!");
      } else {
        alert("Spotify Exchange failed: " + JSON.stringify(data));
      }
    } catch (e) {
      console.log("Token exchange error at root", e);
      alert("Spotify Exchange request failed: " + e.message);
    }
  };

  const fetchSharedSpotifyToken = async () => {
    try {
      const { data, error } = await supabase
        .from('spotify_config')
        .select('refresh_token')
        .eq('id', 'developer')
        .maybeSingle();

      if (data && data.refresh_token) {
        const details = {
          grant_type: 'refresh_token',
          refresh_token: data.refresh_token,
          client_id: '1fb2261355cd4979af85a0c79a225fd2',
        };

        const formBody = Object.keys(details)
          .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key]))
          .join('&');

        const res = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody,
        });

        const tokenData = await res.json();
        if (tokenData.access_token) {
          setSpotifyToken(tokenData.access_token);
        }
      }
    } catch (e) {
      console.log("Error loading shared Spotify token", e);
    }
  };

  const exchangeInProgress = useRef(false);

  useEffect(() => {
    fetchSharedSpotifyToken();
    const interval = setInterval(fetchSharedSpotifyToken, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const savedVerifier = localStorage.getItem('spotify_code_verifier');
      if (code && savedVerifier && !exchangeInProgress.current) {
        exchangeInProgress.current = true;
        exchangeCodeForToken(code, savedVerifier);
        // Clear url params to avoid loops
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

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
