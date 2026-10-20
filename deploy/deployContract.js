const { ethers, FetchRequest } = require("ethers");
const axios = require("axios");

const zksyncConfig = {
provider_rpc_url:"",
user_private_key:"",
keycloak_token_url:"",
client_id:"",
client_secret:"",
username:"",
password:"",
}
const PROVIDER_RPC_URL = zksyncConfig.provider_rpc_url;

console.log(`🌐 Provider RPC URL: ${PROVIDER_RPC_URL}`);

const contractAbi = require(`../artifacts/contracts_Without_Gas/certification.sol/Certification.json`);

const originalSend = FetchRequest.prototype.send;
FetchRequest.prototype.send = async function () {
  try {
    const access_token =  await getAuthToken();
    this.setHeader("Authorization", `Bearer ${access_token}`);
    
    // Log headers before sending
    console.log("\n📋 Request Headers:");
    console.log("URL:", this.url);
    console.log("Method:", this.method || "POST");
    
    // Access headers directly from the private property
    const headers = {};
    if (this.headers) {
      for (const key of Object.keys(this.headers)) {
        // Mask the bearer token so it is not printed in full
        headers[key] = key.toLowerCase() === "authorization"
          ? `${String(this.headers[key]).substring(0, 20)}...`
          : this.headers[key];
      }
    }
    console.log("Headers:", JSON.stringify(headers, null, 2));
    
    // Show body preview if available
    if (this.body) {
      const bodyStr = typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      console.log("Body preview:", bodyStr.substring(0, 200) + (bodyStr.length > 200 ? "..." : ""));
    }
    console.log("─".repeat(80) + "\n");
    
  } catch (error) {
    console.error("❌ Error setting Authorization header:", error.message);
  }
  
  return originalSend.call(this);
};

async function getAuthToken() {
  try {
    const response = await axios.post(
      zksyncConfig.keycloak_token_url,
      new URLSearchParams({
        grant_type: 'password', 
        client_id: zksyncConfig.client_id,
        client_secret:  zksyncConfig.client_secret,
        username: zksyncConfig.username,
        password: zksyncConfig.password,
        scope: "openid email profile"
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'hardhat-deployment-script'
        }
      }
    );
    
    return response.data.id_token;
  } catch (error) {
    console.error("❌ Error getting JWT token:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

// Main
async function doDeploy(){ 
  console.log("Contract Name: ", contractAbi.contractName);

  const provider = new ethers.JsonRpcProvider(PROVIDER_RPC_URL);

  const signer = new ethers.Wallet(
    zksyncConfig.user_private_key,
    provider
  );

  const contractFactory = new ethers.ContractFactory(contractAbi.abi, contractAbi.bytecode, signer);
 
  const contract = await contractFactory.deploy();
  const receipt = await contract.deploymentTransaction()?.wait();  
  const contractAddress = receipt?.contractAddress;
  
  return contractAddress;
}

(async () => {
  try {
    console.log("🔄 Getting access token...");
    const token = await getAuthToken();
    console.log("✅ Token:", token.substring(0, 50) + "...");
    
    console.log("\n🔄 Transaction Origin...");
    console.log("✅ Origin Address:", ethers.computeAddress(`0x${zksyncConfig.user_private_key}`));  
    
    console.log("\n🔄 Deploying contract...");
    const contractAddress = await doDeploy();
    console.log("\n🎉 Deployed! At: ", contractAddress);
  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  }
})();