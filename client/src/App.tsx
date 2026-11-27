import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./context/AppContext.tsx";
import { Layout } from "./components/Layout.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { OverviewPage } from "./pages/OverviewPage.tsx";
import { ClubDirectoryPage, ClubPage } from "./pages/ClubPage.tsx";
import { TournamentPage } from "./pages/TournamentPage.tsx";
import { MatchDetailPage, MatchesListPage } from "./pages/MatchesPage.tsx";
import { ScorerPage } from "./pages/ScorerPage.tsx";
import { ArchiveHomePage, ArchiveSportPage } from "./pages/ArchivePage.tsx";
import { PlayerProfilePage } from "./pages/PlayerProfilePage.tsx";
import { RolesPage } from "./pages/RolesPage.tsx";
import { AuctionPage } from "./pages/AuctionPage.tsx";
import { LiveAuctionPage } from "./pages/LiveAuctionPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";

function RouteContent() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/clubs" element={<ClubDirectoryPage />} />
        <Route path="/clubs/:slug" element={<ClubPage />} />
        <Route
          path="/tournaments/current"
          element={
            <ErrorBoundary resetKey={location.pathname} featureName="Current Tournament">
              <TournamentPage />
            </ErrorBoundary>
          }
        />
        <Route path="/matches" element={<MatchesListPage />} />
        <Route path="/live" element={<Navigate to="/matches?tab=live" replace />} />
        <Route path="/upcoming" element={<Navigate to="/matches?tab=upcoming" replace />} />
        <Route path="/matches/:id" element={<MatchDetailPage />} />
        <Route
          path="/scorer"
          element={
            <ErrorBoundary resetKey={location.pathname} featureName="Match Scorer">
              <ScorerPage />
            </ErrorBoundary>
          }
        />
        <Route path="/archive" element={<ArchiveHomePage />} />
        <Route path="/archive/:year" element={<ArchiveHomePage />} />
        <Route path="/archive/:year/:tournamentId/:sportSlug" element={<ArchiveSportPage />} />
        <Route path="/players/:id" element={<PlayerProfilePage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route
          path="/auction"
          element={
            <ErrorBoundary resetKey={location.pathname} featureName="Auction Hub">
              <AuctionPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/auction/live"
          element={
            <ErrorBoundary resetKey={location.pathname} featureName="Live Auction">
              <LiveAuctionPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/live-auction"
          element={
            <ErrorBoundary resetKey={location.pathname} featureName="Live Auction">
              <LiveAuctionPage />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route
            path="/live-auction/projector"
            element={
              <ErrorBoundary resetKey="/live-auction/projector" featureName="Auction Projector">
                <div className="min-h-screen bg-[#08080A] text-[#F5F2EB]">
                  <LiveAuctionPage projectorMode />
                </div>
              </ErrorBoundary>
            }
          />
          <Route
            path="*"
            element={
              <Layout>
                <RouteContent />
              </Layout>
            }
          />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
