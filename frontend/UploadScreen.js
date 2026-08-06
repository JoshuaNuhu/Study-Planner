import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet, 
  Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';

export default function UploadScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // Your computer's IPv4 address
  const BACKEND_URL = 'http://10.107.215.183:5000';

  // Automatically refresh XP & Streak whenever returning to this screen
  useFocusEffect(
    useCallback(() => {
      fetchUserStats();
    }, [])
  );

  const fetchUserStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setXp(data.xp_total || 0);
        setStreak(data.streak_count || 0);
      }
    } catch (error) {
      console.log('Error fetching user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const pickAndUploadDocument = async () => {
    try {
      // 1. Open the phone's file picker
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setLoading(true);

      // 2. Prepare the file for upload (multipart/form-data)
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      });
      formData.append('course_name', 'Mobile Upload Test');

      // 3. Retrieve the secure token from the device
      const token = await SecureStore.getItemAsync('userToken');

      if (!token) {
        Alert.alert('Authentication Error', 'You must be logged in to upload files.');
        setLoading(false);
        return;
      }

      // 4. Send to your Flask Backend
      const response = await fetch(`${BACKEND_URL}/handouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        navigation.navigate('Questions', { handoutId: data.handout_id });
      } else {
        Alert.alert('Upload Failed', data.error || 'Something went wrong');
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
      {/* XP & Streak Banner Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🔥</Text>
          <View>
            <Text style={styles.statValue}>{loadingStats ? '...' : streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⚡</Text>
          <View>
            <Text style={styles.statValue}>{loadingStats ? '...' : xp}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Study Planner</Text>
        <Text style={styles.subtitle}>Upload a handout to generate practice questions.</Text>
      </View>

      <TouchableOpacity 
        style={styles.uploadButton} 
        onPress={pickAndUploadDocument}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.buttonText}>Select PDF Document</Text>
        )}
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  statIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#A0A0A0',
  },
  header: {
    marginBottom: 40,
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
    lineHeight: 24,
  },
  uploadButton: {
    backgroundColor: '#BB86FC',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#BB86FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: 'bold',
  },
});