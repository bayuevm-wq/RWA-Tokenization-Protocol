import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { useWeb3Modal } from "@web3modal/wagmi-react-native";
import { useAccount } from "wagmi";

export default function OnboardingScreen() {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuth = async () => {
    setIsAuthenticating(true);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock RWA Dashboard",
        fallbackLabel: "Use PIN",
      });

      if (result.success) {
        // Route to Tabs
        router.replace("/(tabs)");
      } else {
        setIsAuthenticating(false);
      }
    } else {
      // Fallback for emulators without biometrics
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>RWA Institutional</Text>
        <Text style={styles.subtitle}>Secure Tokenized Asset Management</Text>
      </View>

      <View style={styles.footer}>
        {!isConnected ? (
          <TouchableOpacity style={styles.button} onPress={() => open()}>
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={isAuthenticating}>
            {isAuthenticating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Unlock Dashboard</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "space-between", padding: 24 },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#94a3b8", textAlign: "center" },
  footer: { paddingBottom: 40 },
  button: { backgroundColor: "#1d4ed8", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
