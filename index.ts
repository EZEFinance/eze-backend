import express from "express";
import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

app.use(cors());

const STAKING_UNI = "0x3aFe03488D537BCB7E5F54140574598d310058a6";
const STAKING_USDC = "0x14337d818c67e888Cb8015AbEcD6E3A1a5A824a3";

const stakingABI = [
  "function fixedAPY() public view returns (uint8)",
  "function totalAmountStaked() public view returns (uint256)",
];

const LOGOS = {
  [STAKING_UNI]: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
  [STAKING_USDC]: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
};

async function updateStakingData(contractAddress: keyof typeof LOGOS) {
  try {
    const contract = new ethers.Contract(contractAddress, stakingABI, provider);
    const apy = await contract.fixedAPY();
    const totalStaked = await contract.totalAmountStaked();
    
    const formattedTVL = Number(ethers.formatUnits(totalStaked, 18));
    const formattedAPY = Number(apy);

    await prisma.staking.upsert({
      where: { address: contractAddress },
      update: { tvl: formattedTVL, apy: formattedAPY, updatedAt: new Date() },
      create: {
        address: contractAddress,
        chain: "Base Sepolia",
        apy: formattedAPY,
        logo: LOGOS[contractAddress] || "",
        tvl: formattedTVL,
      },
    });

    console.log(`Updated staking data for ${contractAddress}`);
  } catch (error) {
    console.error(`Error updating staking data for ${contractAddress}:`, error);
  }
}

app.get("/staking", async (req, res) => {
  try {
    const data = await prisma.staking.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
});

app.get("/staking/:address", async (req, res) => {
  try {
    const data = await prisma.staking.findUnique({
      where: { address: req.params.address },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
});

app.post("/staking/update", async (req, res) => {
  try {
    await updateStakingData(STAKING_UNI);
    await updateStakingData(STAKING_USDC);
    res.json({ message: "Staking data updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update staking data" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});