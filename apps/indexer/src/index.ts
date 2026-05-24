import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb, pool } from "./db";
import { createPublicClient, http, parseAbiItem } from "viem";
import { localhost } from "viem/chains";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// API Routes
app.get("/api/events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { rows } = await pool.query(
      "SELECT * FROM events ORDER BY block_number DESC LIMIT $1",
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get("/api/analytics/tvl", async (req, res) => {
  // Mock TVL Analytics
  res.json({ success: true, data: { tvlUsd: 15400000, treasuryReserves: 2500000 } });
});

// Start Server & Listeners
app.listen(PORT, async () => {
  console.log(`Indexer API running on port ${PORT}`);
  await initDb();
  
  console.log("Started Viem blockchain listeners...");
  // In a real environment, we would connect `viem` to watchContractEvent
  // Example:
  /*
  const client = createPublicClient({ chain: localhost, transport: http() });
  client.watchEvent({
    onLogs: async (logs) => {
      // Save logs to DB
    }
  });
  */
});
