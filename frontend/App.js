import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import UploadScreen from './UploadScreen';
import HistoryScreen from './HistoryScreen';
import CalendarScreen from './CalendarScreen';
import DashboardScreen from './DashboardScreen';
import QuestionsScreen from './QuestionsScreen';

// 1. Configure how notifications present when app is open (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function LogoutButton({ navigation }) {
  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('userToken');
          navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  return (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
      <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShadowVisible: false,
        headerRight: () => <LogoutButton navigation={navigation} />,
        tabBarStyle: { backgroundColor: '#121212', borderTopColor: '#333333' },
        tabBarActiveTintColor: '#BB86FC',
        tabBarInactiveTintColor: '#757575',
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Upload') iconName = 'cloud-upload-outline';
          else if (route.name === 'History') iconName = 'time-outline';
          else if (route.name === 'Calendar') iconName = 'calendar-outline';
          else if (route.name === 'Dashboard') iconName = 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Upload" component={UploadScreen} options={{ title: 'Study Planner' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'My Handouts' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setupApp = async () => {
      try {
        // 2. Setup Android Notification Channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('study-reminders', {
            name: 'Study Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#BB86FC',
          });
        }

        // 3. Request permissions on launch
        await Notifications.requestPermissionsAsync();

        // 4. Check Auth Token
        const token = await SecureStore.getItemAsync('userToken');
        setInitialRoute(token ? 'MainTabs' : 'Login');
      } catch (error) {
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };

    setupApp();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: '#121212' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Sign Up', headerBackTitleVisible: false }} />
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Questions" component={QuestionsScreen} options={{ title: 'Review', headerBackTitleVisible: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
});