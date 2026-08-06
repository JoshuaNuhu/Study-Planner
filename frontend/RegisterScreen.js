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

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const BACKEND_URL = 'http://10.107.215.183:5000';

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }), 
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        Alert.alert('Success!', 'Account created successfully. You can now log in.');
        navigation.navigate('Login'); 
      } else {
        Alert.alert('Registration Failed', data.error || 'Could not create account');
      }
    } catch (error) {
        Alert.alert('Network Error', error.message);
        console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Sign up to start planning your studies</Text>

      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#757575"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
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
        <TextInput 
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#757575"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity 
        style={styles.registerButton} 
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.linkButton} 
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.linkText}>Already have an account? Log in here.</Text>
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
  registerButton: {
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