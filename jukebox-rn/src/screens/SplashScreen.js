import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../utils/supabase';
import { playClickSFX } from '../utils/sfxHelper';

export default function SplashScreen({ navigation }) {
  const [connectionError, setConnectionError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const timerRef = useRef(null);

  const startSessionCheck = () => {
    setConnectionError(false);
    setIsRetrying(true);

    // 2-second initial retro delay before executing session check
    timerRef.current = setTimeout(() => {
      const checkSession = async () => {
        try {
          // Wrap supabase getSession in a 5-second timeout race
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network Timeout')), 5000)
          );

          const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
          
          navigation.replace(session ? 'Tabs' : 'Login');
        } catch (e) {
          console.log("Authentication check timed out or failed", e);
          setConnectionError(true);
        } finally {
          setIsRetrying(false);
        }
      };
      checkSession();
    }, 2000);
  };

  useEffect(() => {
    startSessionCheck();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleRetry = () => {
    playClickSFX();
    startSessionCheck();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>JUKEBOX</Text>
      
      {!connectionError ? (
        <ActivityIndicator size="large" color="#1DB954" style={styles.loader} />
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>📶⚠️</Text>
          <Text style={styles.errorTitle}>CONNECTION TIMEOUT</Text>
          <Text style={styles.errorSub}>COULD NOT CONNECT TO RETRO SERVERS</Text>
          
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryText}>RETRY CONNECT</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    color: '#1DB954',
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  loader: {
    marginTop: 40,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 24,
  },
  errorEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  errorTitle: {
    color: '#ff4d4d',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  errorSub: {
    color: 'grey',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#ff4d4d',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
});
