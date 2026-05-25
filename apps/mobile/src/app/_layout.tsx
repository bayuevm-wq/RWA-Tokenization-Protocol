import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defaultWagmiConfig } from "@web3modal/wagmi-react-native";
import { createWeb3Modal } from "@web3modal/wagmi-react-native";
import { WagmiProvider } from "wagmi";
import { sepolia, hardhat } from "viem/chains";
import { SafeAreaProvider } from "react-native-safe-area-context";

// 1. Setup QueryClient
const queryClient = new QueryClient();

// 2. Setup Web3Modal & Wagmi
const projectId = "1234567890abcdef1234567890abcdef"; // Use a real WalletConnect project ID in production

const metadata = {
  name: "RWA Institutional",
  description: "Real-World Asset Tokenization Protocol",
  url: "https://rwa-protocol.com",
  icons: ["https://rwa-protocol.com/icon.png"],
  redirect: {
    native: "rwamobile://",
    universal: "https://rwa-protocol.com",
  },
};

const chains = [sepolia, hardhat] as const;
const wagmiConfig = defaultWagmiConfig({ chains, projectId, metadata });

createWeb3Modal({
  projectId,
  wagmiConfig,
  defaultChain: sepolia,
});

export default function RootLayout() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#0f172a" },
              headerTintColor: "#fff",
              headerTitleStyle: { fontWeight: "bold" },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
