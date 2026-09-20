import React, { useState } from "react";
import { PlatformProvider, usePlatform } from "./contexts/PlatformContext.tsx";
import { AppLayout, ViewTab } from "./layouts/AppLayout.tsx";
import { LauncherView } from "./views/LauncherView.tsx";
import { MonitorView } from "./views/MonitorView.tsx";
import { RegistryView } from "./views/RegistryView.tsx";
import { FinancialsView } from "./views/FinancialsView.tsx";
import { StatsOverview } from "./components/dashboard/StatsOverview.tsx";

const DashboardContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ViewTab>("launcher");
  const { setActiveSessionId } = usePlatform();

  const handleTaskDispatched = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentTab("monitor");
  };

  const handleSelectSpokeAction = (_spokeId: string, _actionId: string) => {
    setCurrentTab("launcher");
  };

  return (
    <AppLayout currentTab={currentTab} onTabChange={setCurrentTab}>
      <div className="space-y-6">
        {/* Global Stats Overview Banner on Top */}
        <StatsOverview />

        {/* View Switcher */}
        {currentTab === "launcher" && (
          <LauncherView onTaskDispatched={handleTaskDispatched} />
        )}
        {currentTab === "monitor" && <MonitorView />}
        {currentTab === "registry" && (
          <RegistryView onSelectAction={handleSelectSpokeAction} />
        )}
        {currentTab === "financials" && <FinancialsView />}
      </div>
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <PlatformProvider>
      <DashboardContent />
    </PlatformProvider>
  );
};

export default App;
