import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useState } from "react";
import * as Notifications from "expo-notifications";

export default function AdminTab() {
  const [address, setAddress] = useState("");

  const triggerYieldAlert = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💰 Yield Deposited!",
        body: "New MockUSDC yield has been deposited to Solar Farm Alpha.",
        sound: true,
      },
      trigger: null, // Send immediately
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Admin & Compliance</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>KYC Whitelist Management</Text>
        <Text style={styles.cardDesc}>Approve investors to trade restricted RWA tokens.</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder="0x..." 
          placeholderTextColor="#64748b"
          value={address}
          onChangeText={setAddress}
        />
        
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#10b981" }]}>
            <Text style={styles.btnText}>Approve KYC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#ef4444" }]}>
            <Text style={styles.btnText}>Blacklist</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Simulate Yield Distribution</Text>
        <Text style={styles.cardDesc}>Trigger epoch yield to push MockUSDC to token holders.</Text>
        
        <TouchableOpacity style={styles.actionBtn} onPress={triggerYieldAlert}>
          <Text style={styles.actionBtnText}>Deposit Yield (Broadcast Notification)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Protocol Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Total Assets</Text>
          <Text style={styles.statusValue}>12 Active</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Treasury TVL</Text>
          <Text style={styles.statusValue}>$2.5M USDC</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Global Pause</Text>
          <Text style={[styles.statusValue, { color: "#10b981" }]}>Operational</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  card: { backgroundColor: "#1e293b", padding: 16, borderRadius: 16, marginBottom: 20 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  cardDesc: { color: "#94a3b8", fontSize: 14, marginBottom: 16 },
  input: { backgroundColor: "#0f172a", color: "#fff", padding: 12, borderRadius: 8, marginBottom: 16 },
  btnRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },
  actionBtn: { backgroundColor: "#3b82f6", padding: 14, borderRadius: 8, alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  statusLabel: { color: "#94a3b8", fontSize: 16 },
  statusValue: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
