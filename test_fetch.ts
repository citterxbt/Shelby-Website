async function main() {
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
    const res = await fetch("https://api.testnet.aptoslabs.com/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        variables: { collectionName: "CircleProfile" }
      })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
