const axios = require("axios");
const {
  Keypair,
  Connection,
  PublicKey,
  VersionedTransaction,
} = require("@solana/web3.js");
const { encrypt, decrypt } = require("./encryption");
const { ContractAddress, User } = require("./db");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const bs58 = require("bs58");

const connection = new Connection(
  "https://mainnet.helius-rpc.com/?api-key=583d91b3-eb6f-4709-a405-0a4847761829"
);

const getTokenBalance = async (walletPublicKey, tokenMintAddress) => {
  try {
    // Create a public key object for the token mint
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    // Get all token accounts by owner
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    // Find the token account for the specified token mint
    const tokenAccount = tokenAccounts.value.find(
      (account) =>
        account.account.data.parsed.info.mint === tokenMintPublicKey.toString()
    );

    if (tokenAccount) {
      // Get the token balance in atomic units
      const balance = tokenAccount.account.data.parsed.info.tokenAmount.amount;
      console.log(`Token Balance (atomic units): ${balance}`);
      return balance;
    } else {
      console.log("Token account not found.");
    }
  } catch (error) {
    console.error("Error fetching token balance:", error);
  }
};

const fetchMarketCap = async (contractAddress) => {
  try {
    console.log("------------fetch market cap---------------");
    let tokenAddress = contractAddress;
    const fetch = (await import("node-fetch")).default;
    const res = await fetch("https://api.raydium.io/pairs");
    const pairs = await res.json();
    const pair = await pairs.find(
      (pair) => pair.amm_id.toLowerCase() === contractAddress || pair.amm_id === contractAddress
    );
    if(pair)
    {
      const pair_id = pair.pair_id;
      const baseToken = pair_id.split("-")[0];
      const quoteToken = pair_id.split("-")[1];
      if(baseToken == "So11111111111111111111111111111111111111112")
        tokenAddress = quoteToken;
      else tokenAddress = baseToken;
    }

    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const marketCap = response.data.pairs[0].fdv;
    return {marketCap, tokenAddress};
  } catch (error) {
    console.error("Error fetching market cap:", error);
    return null;
  }
};

const extractContractAddress = (text) => {
  const match = text.match(/\b[A-Za-z0-9]{32,44}\b/);
  return match ? match[0] : null;
};

const getQuote = async (inputMint, outputMint, amount) => {
  try {
    console.log("------------getQuote---------------");
    const response = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint,
        outputMint,
        amount: amount,
        slippageBps: 50,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching quote:", error);
    return null;
  }
};

const executeSwap = async (quoteResponse, userPublicKey) => {
  try {
    console.log("------------executeSwap---------------");
    const response = await axios.post("https://quote-api.jup.ag/v6/swap", {
      userPublicKey,
      quoteResponse,
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: 250000,
    });
    return response.data;
  } catch (error) {
    console.error("Error executing swap:", error);
    return null;
  }
};

const buyToken = async (amount, contractAddress, wallet) => {
  try {
    console.log("------------buyToken---------------");
    const publicKey = wallet.publicKey.toString();
    const inputMint = "So11111111111111111111111111111111111111112";
    const outputMint = contractAddress;
    const quoteResponse = await getQuote(
      inputMint,
      outputMint,
      Math.floor(amount * 1e9)
    );

    if (quoteResponse) {
      const swapResult = await executeSwap(quoteResponse, publicKey);
      return swapResult;
    }
    return null;
  } catch (error) {
    console.error("Error buying token:", error);
    return null;
  }
};

const sellToken = async (amount, contractAddress, wallet) => {
  try {
    console.log("------------sellToken---------------");
    const publicKey = wallet.publicKey.toString();
    const inputMint = contractAddress;
    const outputMint = "So11111111111111111111111111111111111111112";
    const quoteResponse = await getQuote(
      inputMint,
      outputMint,
      Math.floor(amount)
    );
    if (quoteResponse) {
      const swapResult = await executeSwap(quoteResponse, publicKey);
      return swapResult;
    }
    return null;
  } catch (error) {
    console.error("Error selling token:", error);
    return null;
  }
};

const deserializeAndExecute = async (swapTransaction, wallet) => {
  try {
    console.log("------------deserializeAndExecute---------------");
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    transaction.sign([wallet]);
    const rawTransaction = transaction.serialize();
    console.log("-------rawTransaction-------");
    const response = await connection.sendRawTransaction(rawTransaction);
    console.log(response);
    const result = await connection.confirmTransaction(response);
    console.log(`Transaction confirmed: ${response}`);
    return response;
  } catch (error) {
    console.error("Error in transaction execution:", error);
    return null;
  }
};

const tradeWithStrategy = async (message) => {
  const users = await User.find();
  if (!users) return;
  const user = users[0];

  const contractAddress = extractContractAddress(message);

  if (contractAddress) {
    let existingRecord = await ContractAddress.findOne({
      userId: user.userId,
      address: contractAddress,
    });
    const wallet = Keypair.fromSecretKey(
      bs58.default.decode(decrypt(user.privateKey))
    );
    if (!existingRecord) {
      const {marketCap, tokenAddress} = await fetchMarketCap(contractAddress);
      if (marketCap !== null) {
        const setting = user.strategy[0].settings.find((s) => marketCap < s.MC);
        if (setting) {
          const buyResult = await buyToken(
            setting.Buy,
            tokenAddress,
            wallet
          );
          if (buyResult) {
            const txid = await deserializeAndExecute(
              buyResult.swapTransaction,
              wallet
            );
            if (txid)
              await ContractAddress.create({
                userId: user.userId,
                address: tokenAddress,
                marketCap,
                buyAmount: setting.Buy,
              });
          } else {
          }
        } else {
        }
      } else {
      }
    } else {
      const {marketCap, tokenAddress} = await fetchMarketCap(contractAddress);
      if (marketCap !== null) {
        if (marketCap < existingRecord.marketCap * 0.5) {
          const sellAmount = await getTokenBalance(
            wallet.publicKey,
            tokenAddress
          );
          const sellResult = await sellToken(
            Math.floor(sellAmount),
            tokenAddress,
            wallet
          );
          if (sellResult) {
            const txid = await deserializeAndExecute(
              sellResult.swapTransaction,
              wallet
            );
          } else {
          }
        } else {
          for (const sellSetting of user.strategy[0].sell) {
            if (
              marketCap >=
              sellSetting.multiplier * existingRecord.marketCap
            ) {
              const sellAmount =
                ((await getTokenBalance(wallet.publicKey, tokenAddress)) *
                  sellSetting.percentage) /
                100;
              if (sellAmount) {
                const sellResult = await sellToken(
                  Math.floor(sellAmount),
                  tokenAddress,
                  wallet
                );
                if (sellResult) {
                  const txid = await deserializeAndExecute(
                    sellResult.swapTransaction,
                    wallet
                  );
                  if (txid) {
                  }
                } else {
                }
              } else {
                console.log("no balance");
              }
            }
          }
        }
      } else {
      }
    }
  } else {
    console.log("No valid contract address found in the message.");
  }
};

module.exports = {
  tradeWithStrategy,
};
