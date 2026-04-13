import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  try {
    const collection = await aptos.getCollectionDataByCreatorAddressAndCollectionName({
      creatorAddress: "0xb79959d5aa6efcfa5dcecb8fe8a9c485c9d5a6b6c66baac8d521947862d588c0",
      collectionName: "CircleProfile"
    });
    console.log("Collection:", collection);
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
