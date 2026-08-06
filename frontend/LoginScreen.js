import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // REPLACE THIS with your computer's IPv4 address (e.g., 192.168.X.X)
  const BACKEND_URL = 'http://10.107.215.183:5000';

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Securely save the JWT to the device
        await SecureStore.setItemAsync('userToken', data.access_token);
        Alert.alert('Success!', 'You are now logged in.');
        
        // Use replace() so the user cannot swipe back to the login screen
        navigation.replace('MainTabs');
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
      console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to access your study planner</Text>

      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#757575"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#757575"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity 
        style={styles.loginButton} 
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>

      {/* Registration Navigation Link */}
      <TouchableOpacity 
        style={styles.linkButton} 
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.linkText}>Don't have an account? Sign up here.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  loginButton: {
    backgroundColor: '#BB86FC',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 24, 
  },
  buttonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
  },
  linkText: {
    color: '#BB86FC',
    fontSize: 14,
  },
});