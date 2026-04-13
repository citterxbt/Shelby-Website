import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  try {
    const collection = await aptos.getCollectionDataByCreatorAddressAndCollectionName({
      creatorAddress: "0xee3b246646436d17468215db6bacfc4f7085145ae5f04ec4d694ea42a9540955",
      collectionName: "CircleProfile"
    });
    console.log(collection);
  } catch (e) {
    console.error(e);
  }
}

main();
