import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

const screenWidth = Dimensions.get("window").width;

const chartData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      data: [15400, 15500, 15650, 15800, 15700, 15900, 16200],
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
      strokeWidth: 3,
    },
  ],
};

export default function PortfolioDashboard() {
  return (
    <ScrollView style={styles.container}>
      {/* Portfolio Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Total Balance</Text>
        <Text style={styles.headerBalance}>$16,200.00</Text>
        <Text style={styles.headerChange}>+$800.00 (5.19%) Past Week</Text>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={screenWidth - 32}
          height={220}
          chartConfig={{
            backgroundColor: "#0f172a",
            backgroundGradientFrom: "#0f172a",
            backgroundGradientTo: "#0f172a",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
            propsForDots: {
              r: "0",
            },
            propsForBackgroundLines: {
              strokeDasharray: "",
              stroke: "#1e293b",
            },
          }}
          bezier
          style={{ borderRadius: 16 }}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10b981" }]}>
          <Text style={styles.actionBtnText}>Claim Yield</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}>
          <Text style={styles.actionBtnText}>Invest</Text>
        </TouchableOpacity>
      </View>

      {/* Asset List */}
      <Text style={styles.sectionTitle}>Your Assets</Text>
      
      <View style={styles.assetCard}>
        <View>
          <Text style={styles.assetName}>Solar Farm Alpha</Text>
          <Text style={styles.assetShares}>1,500 Tokens</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.assetValue}>$15,000.00</Text>
          <Text style={styles.assetYield}>8% APY</Text>
        </View>
      </View>

      <View style={styles.assetCard}>
        <View>
          <Text style={styles.assetName}>NYC Commercial Bldg</Text>
          <Text style={styles.assetShares}>120 Tokens</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.assetValue}>$1,200.00</Text>
          <Text style={styles.assetYield}>5% APY</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  header: { marginBottom: 24, marginTop: 16 },
  headerLabel: { color: "#94a3b8", fontSize: 16 },
  headerBalance: { color: "#fff", fontSize: 40, fontWeight: "bold", marginVertical: 4 },
  headerChange: { color: "#10b981", fontSize: 16, fontWeight: "600" },
  chartContainer: { alignItems: "center", marginBottom: 24 },
  actionsContainer: { flexDirection: "row", gap: 16, marginBottom: 32 },
  actionBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  sectionTitle: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  assetCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  assetName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  assetShares: { color: "#94a3b8", fontSize: 14, marginTop: 4 },
  assetValue: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  assetYield: { color: "#10b981", fontSize: 14, marginTop: 4 },
});
