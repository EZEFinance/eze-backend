import express from "express";
import type { Request, Response } from "express";
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
app.use(express.json());

const MOCK_TOKENS = {
  UNI: {
    token: "0xd3B8E3280baa0af587614a011CD81c592FA8312d",
    staking: "0x3aFe03488D537BCB7E5F54140574598d310058a6"
  },
  USDC: {
    token: "0xE94beF2B81147e984aF42A30052BD7D1E3438B94",
    staking: "0x14337d818c67e888Cb8015AbEcD6E3A1a5A824a3"
  }
};

const LOGOS = {
  [MOCK_TOKENS.UNI.token]: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
  [MOCK_TOKENS.USDC.token]: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
};

const stakingABI = [
  "function fixedAPY() public view returns (uint8)",
  "function totalAmountStaked() public view returns (uint256)",
];

async function updateStakingData(tokenKey: keyof typeof MOCK_TOKENS) {
  try {
    const { token, staking } = MOCK_TOKENS[tokenKey];
    const contract = new ethers.Contract(staking, stakingABI, provider);

    const apy = await contract.fixedAPY();
    const totalStaked = await contract.totalAmountStaked();

    const formattedTVL = Number(ethers.formatUnits(totalStaked, 18));
    const formattedAPY = Number(apy);

    await prisma.staking.upsert({
      where: { addressToken: token },
      update: {
        tvl: formattedTVL,
        apy: formattedAPY,
        updatedAt: new Date()
      },
      create: {
        addressToken: token,
        addressStaking: staking,
        nameToken: tokenKey === "UNI" ? "UNI" : "USDC",
        nameProject: tokenKey === "UNI" ? "Uniswap V3" : ["AAVE V3", "Compound"].sort(() => Math.random() - 0.5)[0],
        chain: "Base Sepolia",
        apy: formattedAPY,
        stablecoin: tokenKey === "USDC",
        categories: ["Staking", tokenKey === "USDC" ? "Stablecoin" : ""].filter(Boolean),
        logo: LOGOS[token] || "",
        tvl: formattedTVL,
      },
    });

    console.log(`Updated staking data for ${tokenKey}`);
  } catch (error) {
    console.error(`Error updating staking data for ${tokenKey}:`, error);
  }
}

const getStakingData = async (req: Request, res: Response) => {
  try {
    const data = await prisma.staking.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const getStakingByAddress = async (req: any, res: any) => {
  try {
    const data = await prisma.staking.findUnique({
      where: { addressToken: req.params.address },
    });

    if (!data) {
      return res.status(404).json({ error: "Staking data not found" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const updateStaking = async (req: Request, res: Response) => {
  try {
    await updateStakingData("UNI");
    await updateStakingData("USDC");
    res.json({ message: "Staking data updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update staking data" });
  }
};

app.get("/staking", getStakingData);
app.get("/staking/:address", getStakingByAddress);
app.post("/staking/update", updateStaking);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;