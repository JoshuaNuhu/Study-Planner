import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';

export default function HistoryScreen({ navigation }) {
  const [handouts, setHandouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const BACKEND_URL = 'http://10.107.215.183:5000';

  const fetchHandouts = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/handouts`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setHandouts(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to load handouts.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHandouts();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHandouts();
  };

  const handleDeleteHandout = (handoutId, courseName) => {
    Alert.alert(
      'Delete Handout',
      `Are you sure you want to delete "${courseName}" and all its recorded history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('userToken');
              const response = await fetch(`${BACKEND_URL}/handouts/${handoutId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (response.ok) {
                setHandouts((prev) => prev.filter((h) => h.id !== handoutId));
              } else {
                const data = await response.json();
                Alert.alert('Error', data.error || 'Failed to delete handout.');
              }
            } catch (error) {
              Alert.alert('Network Error', 'Could not delete handout.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={handouts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BB86FC" />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No handouts uploaded yet. Head to the Upload tab to get started.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardContent}
              onPress={() => navigation.navigate('Questions', { handoutId: item.id })}
            >
              <Text style={styles.courseName}>{item.course_name}</Text>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteHandout(item.id, item.course_name)}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 24 },
  emptyText: { color: '#A0A0A0', fontSize: 15, textAlign: 'center', marginTop: 40, lineHeight: 22 },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  courseName: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', marginBottom: 6 },
  date: { color: '#A0A0A0', fontSize: 13 },
  deleteButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
    marginLeft: 12,
  },
  deleteText: { color: '#F44336', fontSize: 13, fontWeight: 'bold' },
});