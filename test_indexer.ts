import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const query = `
    query GetProfiles($collectionName: String) {
      current_collections_v2(
        where: {collection_name: {_eq: $collectionName}}
        limit: 100
      ) {
        creator_address
        description
      }
    }
  `;
  try {
    const res = await aptos.queryIndexer({
      query: {
        query,
        variables: { collectionName: "CircleProfile" }
      }
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
