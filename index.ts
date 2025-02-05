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
    token: "0xbb072b81D265D4F574b324Cea7469C9369281Da0",
    staking: "0x13aB00A1Fae23DCC5618690480cfdE86B04Bbaeb",
    nameProject: "Uniswap"
  },
  USDC: {
    token: "0x8fD29CC673C16d0466D5eA0250dC3d040554F4a3",
    staking: "0x55C30Ff712b97B3692fd4f838D13D84DE8Be38B4",
    nameProject: "Aave"
  },
  USDT: {
    token: "0xaa7DcAae6C6e579A326B860572Da90A149Dc1266",
    staking: "0x71417c20c60eD165026336922925C4f25439B3a0",
    nameProject: "Compound"
  },
  DAI: {
    token: "0x9A410E847e6161c96C72a7C40beaDAD5c86ea6aE",
    staking: "0xdbE2c044D5F350807c437A1b3748191FE9D83250",
    nameProject: "Renzo"
  },
  WETH: {
    token: "0x1133c55280Be106f985622bF56dcc7Fb3C3D6Ee0",
    staking: "0x64D28469CAa42C51C57f42aCfD975E8AC4C1b0D2",
    nameProject: "Cardano"
  }
};

const LOGOS = {
  [MOCK_TOKENS.UNI.token]: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
  [MOCK_TOKENS.USDC.token]: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  [MOCK_TOKENS.USDT.token]: "https://cryptologos.cc/logos/tether-usdt-logo.png",
  [MOCK_TOKENS.DAI.token]: "https://cryptologos.cc/logos/dai-dai-logo.png",
  [MOCK_TOKENS.WETH.token]: "https://img.cryptorank.io/coins/weth1701090834118.png",
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

    const formattedTVL = Number(ethers.formatUnits(totalStaked, 6));
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
        nameToken: tokenKey,
        nameProject: MOCK_TOKENS[tokenKey].nameProject,
        chain: "Base Sepolia",
        apy: formattedAPY,
        stablecoin: tokenKey === "USDC" || tokenKey === "USDT" ? true : false,
        categories: ["Staking", tokenKey === "USDC" || tokenKey === "USDT" ? "Stablecoin" : ""].filter(Boolean),
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
    const updatePromises = Object.keys(MOCK_TOKENS).map((tokenKey) =>
      updateStakingData(tokenKey as keyof typeof MOCK_TOKENS)
    );

    await Promise.all(updatePromises);

    res.json({ message: "All staking data updated successfully" });
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