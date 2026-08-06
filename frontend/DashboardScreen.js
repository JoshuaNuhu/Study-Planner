import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function DashboardScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const BACKEND_URL = 'http://10.107.215.183:5000';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setName(data.name || '');
        setEmail(data.email || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setUpdatingProfile(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email })
      });
      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', data.error || 'Failed to update profile.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error while updating profile.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Validation Error', 'Please fill in both password fields.');
      return;
    }

    setChangingPassword(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        Alert.alert('Error', data.error || 'Failed to change password.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error while changing password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This action cannot be undone. All your handouts, XP, and study history will be permanently deleted.",
      [
        { 
          text: "Cancel", 
          style: "cancel" 
        },
        {
          text: "Delete My Account",
          style: "destructive", 
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const token = await SecureStore.getItemAsync('userToken');
              
              const response = await fetch(`${BACKEND_URL}/auth/delete-account`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (response.ok) {
                // Wipe the token from secure storage
                await SecureStore.deleteItemAsync('userToken');
                
                // Route user back to the login screen
                if (navigation) {
                  navigation.replace('Login'); 
                } else {
                  Alert.alert("Success", "Account deleted. Please restart the app.");
                }
              } else {
                const data = await response.json();
                Alert.alert("Error", data.error || "Failed to delete account.");
              }
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Could not connect to the server.");
            } finally {
              setDeletingAccount(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Student Biodata</Text>
        
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter full name"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Enter email"
          placeholderTextColor="#666"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateProfile} disabled={updatingProfile}>
          <Text style={styles.buttonText}>{updatingProfile ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Security & Password</Text>

        <Text style={styles.label}>Current Password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#666"
        />

        <TouchableOpacity style={styles.secondaryButton} onPress={handleChangePassword} disabled={changingPassword}>
          <Text style={styles.buttonText}>{changingPassword ? 'Updating...' : 'Change Password'}</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={[styles.sectionTitle, styles.dangerTextTitle]}>Danger Zone</Text>
        <Text style={styles.warningText}>Once you delete your account, there is no going back. Please be certain.</Text>
        
        <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount} disabled={deletingAccount}>
          <Text style={styles.buttonText}>{deletingAccount ? 'Deleting...' : 'Delete Account'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { padding: 24, marginTop: 24 },
  loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 24, marginTop: 12 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#BB86FC', marginBottom: 16 },
  label: { color: '#A0A0A0', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#2C2C2C', color: '#FFFFFF', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  primaryButton: { backgroundColor: '#BB86FC', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  secondaryButton: { backgroundColor: '#333333', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  
  // Danger Zone Styles
  dangerCard: { borderColor: '#CF6679', borderWidth: 1, marginTop: 10 },
  dangerTextTitle: { color: '#CF6679' },
  warningText: { color: '#A0A0A0', fontSize: 13, marginBottom: 16, lineHeight: 20 },
  dangerButton: { backgroundColor: '#CF6679', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 }
});