import fs from "node:fs";
import path from "node:path";
import Web3 from "web3";

const root = process.cwd();
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const networkName = process.env.NETWORK_NAME || "Local Ganache";
const privateKey = process.env.PRIVATE_KEY;
const artifactPath = path.join(root, "artifacts", "LogisticsChain.json");

if (!fs.existsSync(artifactPath)) {
  throw new Error("Artifact not found. Run npm run compile first.");
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const web3 = new Web3(rpcUrl);

let from;
if (privateKey) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  from = account.address;
} else {
  const accounts = await web3.eth.getAccounts();
  if (!accounts.length) {
    throw new Error("No unlocked RPC accounts found. Start Ganache or set PRIVATE_KEY.");
  }
  from = accounts[0];
}

console.log(`Deploying from ${from} to ${rpcUrl}`);

const contract = new web3.eth.Contract(artifact.abi);
const instance = await contract
  .deploy({ data: artifact.bytecode })
  .send({ from, gas: "6500000" });

const chainId = Number(await web3.eth.getChainId());
const deployedAddress = instance.options.address;

const publicConfig = {
  deployed: true,
  networkName,
  chainId,
  rpcUrl,
  address: deployedAddress,
  artifactPath: "LogisticsChain.json",
  deployedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(root, "public", "contracts.json"),
  `${JSON.stringify(publicConfig, null, 2)}\n`
);

console.log(`LogisticsChain deployed at ${deployedAddress}`);
console.log("Updated public/contracts.json");
