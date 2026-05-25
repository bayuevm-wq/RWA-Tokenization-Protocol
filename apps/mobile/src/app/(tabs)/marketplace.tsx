import { ScrollView, View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";

const marketplaceAssets = [
  { id: "1", name: "Miami Beachfront Villa", type: "Real Estate", apy: "10.5%", price: "$50.00/token", available: "Available" },
  { id: "2", name: "Texas Solar Farm", type: "Energy", apy: "12.0%", price: "$10.00/token", available: "Available" },
  { id: "3", name: "Swiss Gold Vault", type: "Commodity", apy: "4.2%", price: "$100.00/token", available: "Sold Out" },
];

export default function MarketplaceTab() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Explore Assets</Text>
      
      {marketplaceAssets.map((asset) => (
        <View key={asset.id} style={styles.card}>
          <View style={styles.imagePlaceholder}>
            <Text style={{ color: "#475569" }}>{asset.type} Image</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.assetName}>{asset.name}</Text>
            <Text style={styles.assetType}>{asset.type}</Text>
            
            <View style={styles.metricsRow}>
              <View>
                <Text style={styles.metricLabel}>Proj. APY</Text>
                <Text style={styles.metricValue}>{asset.apy}</Text>
              </View>
              <View>
                <Text style={styles.metricLabel}>Price</Text>
                <Text style={styles.metricValue}>{asset.price}</Text>
              </View>
              <View>
                <Text style={styles.metricLabel}>Status</Text>
                <Text style={[styles.metricValue, { color: asset.available === "Available" ? "#10b981" : "#ef4444" }]}>
                  {asset.available}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.buyBtn, asset.available !== "Available" && styles.buyBtnDisabled]}
              disabled={asset.available !== "Available"}
            >
              <Text style={styles.buyBtnText}>{asset.available === "Available" ? "Invest Now" : "Waitlist"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  card: { backgroundColor: "#1e293b", borderRadius: 16, overflow: "hidden", marginBottom: 20 },
  imagePlaceholder: { height: 160, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  cardContent: { padding: 16 },
  assetName: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  assetType: { color: "#94a3b8", fontSize: 14, marginTop: 4, marginBottom: 16 },
  metricsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metricLabel: { color: "#94a3b8", fontSize: 12 },
  metricValue: { color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 4 },
  buyBtn: { backgroundColor: "#3b82f6", padding: 14, borderRadius: 12, alignItems: "center" },
  buyBtnDisabled: { backgroundColor: "#475569" },
  buyBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
