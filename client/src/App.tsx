import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Login from "@/pages/login";
import Home from "@/pages/home";
import CampaignsPage from "@/pages/campaigns";
import CampaignDetailsPage from "@/pages/campaign-details";
import ClientsPage from "@/pages/clients";
import AdAccountsPage from "@/pages/ad-accounts";
import WorkReportsPage from "@/pages/work-reports";
import ClientMailboxPage from "@/pages/client-mailbox";
import ClientAccountsPage from "@/pages/client-accounts";
import AdminPage from "@/pages/admin";
import FinanceDashboard from "@/pages/finance-dashboard";
import FinanceProjects from "@/pages/finance-projects";
import FinancePayments from "@/pages/finance-payments";
import FinanceExpenses from "@/pages/finance-expenses";
import FinanceSalaryManagement from "@/pages/finance-salary-management";
import FinanceReports from "@/pages/finance-reports";
import FBAdManagementPage from "@/pages/fb-ad-management";
import AdvantixAdsManager from "@/pages/advantix-ads-manager";
import NewCreatedPage from "@/pages/own-farming/new-created";
import FarmingAccountsPage from "@/pages/own-farming/farming-accounts";
import OwnFarmingDashboard from "@/pages/own-farming/dashboard";
import OwnFarmingSettings from "@/pages/own-farming/settings";
import MailManagementPage from "@/pages/own-farming/mail-management";
import GherDashboard from "@/pages/gher-dashboard";
import GherExpense from "@/pages/gher-expense";
import GherPartner from "@/pages/gher-partner";
import GherSettings from "@/pages/gher-settings";
import GherInvoice from "@/pages/gher-invoice";
import NotFound from "@/pages/not-found";

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("authToken");
      setIsAuthenticated(!!token);
    };

    // Check authentication on mount
    checkAuth();

    // Listen for storage changes (when token is added/removed)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "authToken") {
        checkAuth();
      }
    };

    // Listen for custom event when login happens in same tab
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Component />;
}

// Protected route with permission checking
function ProtectedRoute({ component: Component, pageKey }: { component: React.ComponentType, pageKey: string }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [, setLocation] = useState(window.location.pathname);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("authToken");
      const userStr = localStorage.getItem("user");
      setIsAuthenticated(!!token);
      setUser(userStr ? JSON.parse(userStr) : null);
    };

    checkAuth();

    // Listen for auth changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "authToken" || e.key === "user") {
        checkAuth();
      }
    };

    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  // Check page permissions
  const { data: hasPermission, isLoading: permissionLoading, isError } = useQuery({
    queryKey: [`/api/permissions/check/${pageKey}`],
    enabled: !!isAuthenticated && !!user,
    retry: false,
    select: (data: any) => data?.hasPermission ?? false,
  });

  // Check alternative pages if current page is denied and it's the dashboard
  const { data: campaignsPermission } = useQuery({
    queryKey: [`/api/permissions/check/campaigns`],
    enabled: !!isAuthenticated && !!user && pageKey === 'dashboard' && !permissionLoading && !hasPermission,
    retry: false,
    select: (data: any) => data?.hasPermission ?? false,
  });

  const { data: clientsPermission } = useQuery({
    queryKey: [`/api/permissions/check/clients`],
    enabled: !!isAuthenticated && !!user && pageKey === 'dashboard' && !permissionLoading && !hasPermission,
    retry: false,
    select: (data: any) => data?.hasPermission ?? false,
  });

  const { data: adAccountsPermission } = useQuery({
    queryKey: [`/api/permissions/check/ad_accounts`],
    enabled: !!isAuthenticated && !!user && pageKey === 'dashboard' && !permissionLoading && !hasPermission,
    retry: false,
    select: (data: any) => data?.hasPermission ?? false,
  });

  const { data: workReportsPermission } = useQuery({
    queryKey: [`/api/permissions/check/work_reports`],
    enabled: !!isAuthenticated && !!user && pageKey === 'dashboard' && !permissionLoading && !hasPermission,
    retry: false,
    select: (data: any) => data?.hasPermission ?? false,
  });

  const { data: financePermission } = useQuery({
    queryKey: [`/api/permissions/check/finance`],
    enabled: !!isAuthenticated && !!user && pageKey === 'dashboard' && !permissionLoading && !hasPermission,
    retry: false,
    select: (data: any) => data?.hasPermission ?? false,
  });

  // Redirect to first accessible page if dashboard is denied
  useEffect(() => {
    if (pageKey === 'dashboard' && !permissionLoading && !hasPermission && isAuthenticated) {
      if (campaignsPermission) {
        window.location.href = '/campaigns';
      } else if (clientsPermission) {
        window.location.href = '/clients';
      } else if (adAccountsPermission) {
        window.location.href = '/ad-accounts';
      } else if (workReportsPermission) {
        window.location.href = '/work-reports';
      } else if (financePermission) {
        window.location.href = '/finance/dashboard';
      }
    }
  }, [pageKey, permissionLoading, hasPermission, isAuthenticated, campaignsPermission, clientsPermission, adAccountsPermission, workReportsPermission, financePermission]);

  if (isAuthenticated === null || (isAuthenticated && permissionLoading)) {
    // Loading state
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Super Admin bypass only for admin page (emergency access)
  if (user?.role === 'super_admin' && pageKey === 'admin') {
    return <Component />;
  }

  // Check if user has permission for this page
  if (isError || !hasPermission) {
    // For dashboard, show loading while checking alternative pages
    if (pageKey === 'dashboard' && (campaignsPermission === undefined || clientsPermission === undefined)) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    const handleLogout = () => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-change"));
      window.location.href = "/login";
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => window.history.back()} 
              className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium border border-blue-600 rounded hover-elevate"
              data-testid="button-go-back"
            >
              Go Back
            </button>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2 bg-red-600 text-white rounded hover-elevate"
              data-testid="button-logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/campaigns/:id" component={() => <ProtectedRoute component={CampaignDetailsPage} pageKey="campaigns" />} />
      <Route path="/campaigns" component={() => <ProtectedRoute component={CampaignsPage} pageKey="campaigns" />} />
      <Route path="/clients" component={() => <ProtectedRoute component={ClientsPage} pageKey="clients" />} />
      <Route path="/ad-accounts" component={() => <ProtectedRoute component={AdAccountsPage} pageKey="ad_accounts" />} />
      <Route path="/work-reports" component={() => <ProtectedRoute component={WorkReportsPage} pageKey="work_reports" />} />
      <Route path="/client-mailbox" component={() => <ProtectedRoute component={ClientMailboxPage} pageKey="client_mailbox" />} />
      <Route path="/client-accounts" component={() => <ProtectedRoute component={ClientAccountsPage} pageKey="admin" />} />
      <Route path="/finance/dashboard" component={() => <ProtectedRoute component={FinanceDashboard} pageKey="finance" />} />
      <Route path="/finance/projects" component={() => <ProtectedRoute component={FinanceProjects} pageKey="finance" />} />
      <Route path="/finance/payments" component={() => <ProtectedRoute component={FinancePayments} pageKey="finance" />} />
      <Route path="/finance/expenses" component={() => <ProtectedRoute component={FinanceExpenses} pageKey="finance" />} />
      <Route path="/finance/salary-management" component={() => <ProtectedRoute component={FinanceSalaryManagement} pageKey="salary_management" />} />
      <Route path="/finance/reports" component={() => <ProtectedRoute component={FinanceReports} pageKey="finance" />} />
      <Route path="/fb-ad-management" component={() => <ProtectedRoute component={FBAdManagementPage} pageKey="fb_ad_management" />} />
      <Route path="/advantix-ads" component={() => <ProtectedRoute component={AdvantixAdsManager} pageKey="advantix_ads_manager" />} />
      <Route path="/own-farming/dashboard" component={() => <ProtectedRoute component={OwnFarmingDashboard} pageKey="ownFarmingDashboard" />} />
      <Route path="/own-farming/new-created" component={() => <ProtectedRoute component={NewCreatedPage} pageKey="newCreated" />} />
      <Route path="/own-farming/farming-accounts" component={() => <ProtectedRoute component={FarmingAccountsPage} pageKey="farmingAccounts" />} />
      <Route path="/own-farming/settings" component={() => <ProtectedRoute component={OwnFarmingSettings} pageKey="ownFarmingSettings" />} />
      <Route path="/own-farming/mail-management" component={() => <ProtectedRoute component={MailManagementPage} pageKey="mailManagement" />} />
      <Route path="/gher/dashboard" component={() => <ProtectedRoute component={GherDashboard} pageKey="gher_management" />} />
      <Route path="/gher/expense" component={() => <ProtectedRoute component={GherExpense} pageKey="gher_management" />} />
      <Route path="/gher/partner" component={() => <ProtectedRoute component={GherPartner} pageKey="gher_management" />} />
      <Route path="/gher/invoice" component={() => <ProtectedRoute component={GherInvoice} pageKey="gher_invoices" />} />
      <Route path="/gher/settings" component={() => <ProtectedRoute component={GherSettings} pageKey="gher_management" />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} pageKey="admin" />} />
      <Route path="/" component={() => <ProtectedRoute component={Home} pageKey="dashboard" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
