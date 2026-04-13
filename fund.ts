import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  console.log("Funding account...");
  try {
    await aptos.fundAccount({ accountAddress: "0xee3b246646436d17468215db6bacfc4f7085145ae5f04ec4d694ea42a9540955", amount: 100000000 });
    console.log("Success!");
  } catch (e) {
    console.error(e);
  }
}

main();
