import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../utils/supabase';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Input Error", "Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
      navigation.replace('Tabs');
    } catch (e) {
      Alert.alert("Registration Failed", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join JukeBox</Text>
      
      <View style={styles.form}>
        <TextInput
          placeholder="Email"
          placeholderTextColor="grey"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="grey"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />

        {isLoading ? (
          <ActivityIndicator size="large" color="#1DB954" style={styles.loader} />
        ) : (
          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
            <Text style={styles.btnText}>Register</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#3e3e3e',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 16,
    backgroundColor: '#181818',
  },
  registerBtn: {
    height: 54,
    backgroundColor: '#1DB954',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 16,
  },
  link: {
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    color: '#1DB954',
    fontSize: 14,
  },
});
