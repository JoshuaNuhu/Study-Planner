import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function CalendarScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  
  // Date/Time Picker State
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');

  // Event Type State
  const [eventType, setEventType] = useState('class');
  const [customType, setCustomType] = useState('');
  
  const [notifyBefore, setNotifyBefore] = useState('30');
  const [saving, setSaving] = useState(false);

  const BACKEND_URL = 'http://10.107.215.183:5000';

  const getLocalISOString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const fetchEvents = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/events`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setEvents(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to load events.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchEvents();
    }, [])
  );

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowPicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const showMode = (currentMode) => {
    setShowPicker(true);
    setPickerMode(currentMode);
  };

  // Helper to trigger the local device notification
  const scheduleLocalNotification = async (eventTitle, eventDate, reminderMinutes, typeLabel) => {
    try {
      // 1. Check Permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Allow notification permissions to receive event alerts.');
        return;
      }

      // 2. Calculate Reminder Trigger Time (eventDate minus notifyBefore minutes)
      const triggerTime = new Date(eventDate.getTime() - (reminderMinutes * 60 * 1000));
      const now = new Date();

      if (triggerTime <= now) {
        Alert.alert('Notice', 'The notification time has already passed. Event created without reminder.');
        return;
      }

      // 3. Schedule Notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Upcoming ${typeLabel.toUpperCase()}: ${eventTitle}`,
          body: `Starts in ${reminderMinutes} minutes!`,
          sound: true,
        },
        trigger: {
          date: triggerTime,
          channelId: 'study-reminders',
        },
      });
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
    }
  };

  const handleAddEvent = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title.');
      return;
    }

    const finalEventType = eventType === 'others' ? customType.trim() : eventType;
    if (eventType === 'others' && !finalEventType) {
      Alert.alert('Missing Info', 'Please specify the custom event type.');
      return;
    }

    const minutesBefore = parseInt(notifyBefore, 10) || 30;

    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          event_date: getLocalISOString(date),
          type: finalEventType.toLowerCase(),
          notify_before: minutesBefore,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        // Schedule notification locally on the phone
        await scheduleLocalNotification(title.trim(), date, minutesBefore, finalEventType);

        setTitle('');
        setDate(new Date());
        setEventType('class');
        setCustomType('');
        setNotifyBefore('30');
        setModalVisible(false);
        fetchEvents();
      } else {
        Alert.alert('Error', data.error || 'Could not create event.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = (id) => {
    Alert.alert('Delete Event', 'Remove this event from your calendar?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await fetch(`${BACKEND_URL}/events/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) fetchEvents();
          } catch (error) {
            Alert.alert('Network Error', 'Could not connect to the server.');
          }
        },
      },
    ]);
  };

  const formatEventDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
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
        data={events}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No upcoming events. Tap + to schedule one.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onLongPress={() => handleDeleteEvent(item.id)}>
            <View style={styles.typeTag}>
              <Text style={styles.typeText}>{item.type}</Text>
            </View>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventDate}>{formatEventDate(item.event_date)}</Text>
            <Text style={styles.hint}>Hold to delete • Notifies {item.notify_before}m before</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Event</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Event title (e.g., IFT 304 Class)"
              placeholderTextColor="#757575"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Date & Time</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity style={styles.pickerButton} onPress={() => showMode('date')}>
                <Text style={styles.pickerButtonText}>
                  {date.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerButton} onPress={() => showMode('time')}>
                <Text style={styles.pickerButtonText}>
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            {showPicker && (
              <DateTimePicker
                value={date}
                mode={pickerMode}
                is24Hour={false}
                display="default"
                onChange={onChangeDate}
              />
            )}
            
            {showPicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.closePickerButton} onPress={() => setShowPicker(false)}>
                <Text style={styles.closePickerText}>Confirm Date/Time</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Event Type</Text>
            <View style={styles.typeSelector}>
              {['class', 'exams', 'test', 'others'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, eventType === type && styles.typeOptionActive]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={[styles.typeOptionText, eventType === type && styles.typeOptionTextActive]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {eventType === 'others' && (
              <TextInput
                style={styles.input}
                placeholder="Type custom event (e.g. Defense)"
                placeholderTextColor="#757575"
                value={customType}
                onChangeText={setCustomType}
              />
            )}

            <Text style={styles.label}>Remind me before (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              placeholderTextColor="#757575"
              keyboardType="numeric"
              value={notifyBefore}
              onChangeText={setNotifyBefore}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddEvent} disabled={saving}>
                {saving ? <ActivityIndicator color="#121212" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 24, paddingBottom: 100 },
  emptyText: { color: '#A0A0A0', fontSize: 15, textAlign: 'center', marginTop: 40, lineHeight: 22 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#333333' },
  typeTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(187, 134, 252, 0.15)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, marginBottom: 10 },
  typeText: { color: '#BB86FC', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  eventTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  eventDate: { color: '#A0A0A0', fontSize: 14, marginBottom: 4 },
  hint: { color: '#555555', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  fab: { position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#BB86FC', justifyContent: 'center', alignItems: 'center', shadowColor: '#BB86FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#121212', fontSize: 28, fontWeight: 'bold', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#A0A0A0', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#2C2C2C', color: '#FFFFFF', borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#333333' },
  dateTimeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  pickerButton: { flex: 0.48, backgroundColor: '#2C2C2C', borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#333333' },
  pickerButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  closePickerButton: { backgroundColor: '#333333', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  closePickerText: { color: '#BB86FC', fontWeight: 'bold' },
  typeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  typeOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#2C2C2C', marginHorizontal: 4, borderWidth: 1, borderColor: '#333333' },
  typeOptionActive: { backgroundColor: 'rgba(187, 134, 252, 0.2)', borderColor: '#BB86FC' },
  typeOptionText: { color: '#A0A0A0', fontSize: 12, fontWeight: '600' },
  typeOptionTextActive: { color: '#BB86FC' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 8 },
  saveButton: { backgroundColor: '#BB86FC', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, minWidth: 80, alignItems: 'center' },
  buttonText: { color: '#A0A0A0', fontSize: 15, fontWeight: '600' },
  saveButtonText: { color: '#121212', fontSize: 15, fontWeight: 'bold' },
});