/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AppPage from "./pages/AppPage";
import DirectoryPage from "./pages/DirectoryPage";
import UserProfilePage from "./pages/UserProfilePage";
import { WalletProvider } from "./components/WalletProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShelbyClientProvider } from "@shelby-protocol/react";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@aptos-labs/ts-sdk";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

// Create a Shelby client instance
const shelbyClient = new ShelbyClient({
  network: Network.TESTNET,
  apiKey: "AG-BCYPRGMTKWSF49T8JSV9QFSECATM1ZDBS"
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ShelbyClientProvider client={shelbyClient}>
        <WalletProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/app" element={<AppPage />} />
                <Route path="/directory" element={<DirectoryPage />} />
                <Route path="/directory/:userId" element={<UserProfilePage />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </WalletProvider>
      </ShelbyClientProvider>
    </QueryClientProvider>
  );
}
