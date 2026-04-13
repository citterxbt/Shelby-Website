import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PropsWithChildren } from "react";

export function WalletProvider({ children }: PropsWithChildren) {
  return (
    <AptosWalletAdapterProvider plugins={[]} autoConnect={true}>
      {children}
    </AptosWalletAdapterProvider>
  );
}
