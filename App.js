// ============================================================
// Experiment 8: Connectivity-Based Cross-Platform Application
//
// Screen parts (see Part 5 of the lab sheet):
//   1. Title area              - "Connectivity Status"
//   2. Status indicator        - green circle = online, red = offline
//   3. Connection type label   - Wi-Fi / Cellular / No Connection
//   4. Internet reachability   - is the internet actually reachable?
//   5. Refresh button          - manual re-check on demand
//
// Logic:
//   - NetInfo.fetch()            -> initial one-time snapshot on mount
//   - NetInfo.addEventListener() -> live updates, removed on unmount
//   - NetInfo.refresh()          -> manual refresh (Refresh button)
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

const GREEN = '#16A34A';
const RED = '#DC2626';
const GREY = '#64748B';

// Converts the NetInfo "type" value into a readable label.
const TYPE_LABELS = {
  wifi: 'Wi-Fi',
  cellular: 'Cellular (Mobile Data)',
  ethernet: 'Ethernet',
  bluetooth: 'Bluetooth',
  vpn: 'VPN',
  wimax: 'WiMAX',
  other: 'Other',
  unknown: 'Unknown',
  none: 'No Connection',
};

// Converts a NetInfo state object into the values the screen needs.
function toStatus(state) {
  return {
    type: state.type,
    isConnected: state.isConnected === true,
    // isInternetReachable is null while still being determined
    isInternetReachable: state.isInternetReachable,
    generation:
      state.type === 'cellular' ? state.details?.cellularGeneration : null,
    updatedAt: new Date(),
  };
}

// ------------------------------------------------------------
// StatusIndicator widget - big coloured circle
// ------------------------------------------------------------
function StatusIndicator({ online, pulse }) {
  const color = online ? GREEN : RED;

  return (
    <Animated.View
      style={[
        styles.indicatorOuter,
        { backgroundColor: color + '22', transform: [{ scale: pulse }] },
      ]}
    >
      <View style={[styles.indicatorInner, { backgroundColor: color }]}>
        <Text style={styles.indicatorIcon}>{online ? '✓' : '✕'}</Text>
      </View>
    </Animated.View>
  );
}

// ------------------------------------------------------------
// InfoRow widget - one "label : value" line
// ------------------------------------------------------------
function InfoRow({ label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------
// Root screen
// ------------------------------------------------------------
function ConnectivityScreen() {
  const [status, setStatus] = useState(null); // null until first snapshot
  const [refreshing, setRefreshing] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const lastOnline = useRef(null);

  // Short animation + vibration when the state changes (optional cue)
  const playCue = useCallback(
    (online) => {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 160, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true }),
      ]).start();

      if (Platform.OS !== 'web') {
        Vibration.vibrate(online ? 60 : [0, 80, 60, 80]);
      }
    },
    [pulse],
  );

  const applyState = useCallback(
    (state) => {
      const next = toStatus(state);
      setStatus(next);

      // only play the cue when online/offline actually changes
      if (lastOnline.current !== null && lastOnline.current !== next.isConnected) {
        playCue(next.isConnected);
      }
      lastOnline.current = next.isConnected;
    },
    [playCue],
  );

  useEffect(() => {
    // Step 2: one-time snapshot of the current network state
    NetInfo.fetch().then(applyState);

    // Step 3: subscribe to live changes
    const unsubscribe = NetInfo.addEventListener(applyState);

    // clean up when the screen closes (no leaks / duplicate callbacks)
    return () => unsubscribe();
  }, [applyState]);

  // Step 5: manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const state = await NetInfo.refresh(); // forces a fresh check
      applyState(state);
    } finally {
      setRefreshing(false);
    }
  };

  // ---------- values shown on screen ----------
  const online = status?.isConnected === true;

  const typeLabel = status
    ? online
      ? TYPE_LABELS[status.type] ?? status.type
      : 'No Connection'
    : 'Checking...';

  let reachableText = 'Checking...';
  let reachableColor = GREY;
  if (status) {
    if (status.isInternetReachable === true) {
      reachableText = 'Internet is reachable';
      reachableColor = GREEN;
    } else if (status.isInternetReachable === false) {
      reachableText = 'Connected, but no internet access';
      reachableColor = RED;
    } else if (!online) {
      reachableText = 'Internet is not reachable';
      reachableColor = RED;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* 1. Title */}
      <Text style={styles.title}>Connectivity Status</Text>

      <View style={styles.center}>
        {/* 2. Status indicator */}
        <StatusIndicator online={online} pulse={pulse} />

        <Text style={[styles.onlineText, { color: online ? GREEN : RED }]}>
          {status ? (online ? 'ONLINE' : 'OFFLINE') : '...'}
        </Text>

        {/* 3. Connection type */}
        <Text style={styles.typeText}>{typeLabel}</Text>

        {/* 4. Internet reachability */}
        <Text style={[styles.reachableText, { color: reachableColor }]}>
          {reachableText}
        </Text>
      </View>

      {/* details card */}
      <View style={styles.card}>
        <InfoRow
          label="Connected"
          value={status ? (online ? 'Yes' : 'No') : '-'}
          valueColor={status ? (online ? GREEN : RED) : undefined}
        />
        <InfoRow label="Type" value={status ? status.type : '-'} />
        {status?.generation ? (
          <InfoRow label="Cellular generation" value={status.generation.toUpperCase()} />
        ) : null}
        <InfoRow
          label="Internet reachable"
          value={
            status
              ? status.isInternetReachable === null
                ? 'Checking...'
                : status.isInternetReachable
                ? 'Yes'
                : 'No'
              : '-'
          }
        />
        <InfoRow
          label="Last updated"
          value={status ? status.updatedAt.toLocaleTimeString() : '-'}
        />
      </View>

      {/* 5. Refresh button */}
      <TouchableOpacity
        style={[styles.button, refreshing && { opacity: 0.6 }]}
        onPress={handleRefresh}
        disabled={refreshing}
      >
        <Text style={styles.buttonText}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Turn Wi-Fi off/on or toggle Airplane Mode – the screen updates automatically.
      </Text>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ConnectivityScreen />
    </SafeAreaProvider>
  );
}

// ------------------------------------------------------------
// STYLES
// ------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 20 },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 8,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  indicatorOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorIcon: { color: '#FFFFFF', fontSize: 56, fontWeight: '800' },

  onlineText: { marginTop: 22, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  typeText: { marginTop: 8, fontSize: 18, fontWeight: '600', color: '#0F172A' },
  reachableText: { marginTop: 6, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  infoLabel: { color: '#64748B', fontSize: 14 },
  infoValue: { color: '#0F172A', fontSize: 14, fontWeight: '600' },

  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  hint: {
    marginTop: 12,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
  },
});
