import { Aptos, AptosConfig, Network, Account } from "@aptos-labs/ts-sdk";

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const account = Account.generate();
  
  await aptos.fundAccount({ accountAddress: account.accountAddress, amount: 100_000_000 }).catch(() => {});

  const payload = {
    data: {
      function: "0x4::aptos_token::set_collection_description",
      typeArguments: [],
      functionArguments: [
        "CircleProfile", // name
        "new description" // description
      ]
    }
  };
  try {
    const res = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: payload.data as any
    });
    const sim = await aptos.transaction.simulate.simple({
      signerPublicKey: account.publicKey,
      transaction: res
    });
    console.log("Simulate result:", sim[0].success, sim[0].vm_status);
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
