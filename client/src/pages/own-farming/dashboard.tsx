import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, XCircle, Clock, Mail, TrendingUp } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";

export default function OwnFarmingDashboard() {
  const { data: farmingAccounts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/farming-accounts"],
  });

  const totalAccounts = farmingAccounts?.length || 0;
  const activeAccounts = farmingAccounts?.filter(acc => acc.status === 'active').length || 0;
  const disabledAccounts = farmingAccounts?.filter(acc => acc.status === 'disabled').length || 0;
  const pendingAccounts = farmingAccounts?.filter(acc => acc.status === 'pending').length || 0;

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Own Farming Dashboard</h1>
        <p className="text-muted-foreground mt-2">Monitor your farming accounts and performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-accounts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-accounts">{totalAccounts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All farming accounts
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-accounts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-accounts">{activeAccounts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-disabled-accounts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disabled Accounts</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-disabled-accounts">{disabledAccounts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Not active
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-accounts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Accounts</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-accounts">{pendingAccounts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting setup
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Farming Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-recent-accounts">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Password</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {farmingAccounts && farmingAccounts.length > 0 ? (
                  farmingAccounts.slice(0, 5).map((account: any) => (
                    <tr key={account.id} className="border-b hover-elevate" data-testid={`row-account-${account.id}`}>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{account.email}</span>
                        </div>
                      </td>
                      <td className="p-2 text-muted-foreground">{account.password?.substring(0, 10)}...</td>
                      <td className="p-2">
                        <span 
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            account.status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : account.status === 'disabled'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {account.status}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{account.purpose || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No farming accounts found. Create your first account to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Account Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Active</span>
                  <span className="text-sm text-muted-foreground">{totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${totalAccounts > 0 ? (activeAccounts / totalAccounts) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Disabled</span>
                  <span className="text-sm text-muted-foreground">{totalAccounts > 0 ? Math.round((disabledAccounts / totalAccounts) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full" 
                    style={{ width: `${totalAccounts > 0 ? (disabledAccounts / totalAccounts) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Pending</span>
                  <span className="text-sm text-muted-foreground">{totalAccounts > 0 ? Math.round((pendingAccounts / totalAccounts) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-yellow-600 h-2 rounded-full" 
                    style={{ width: `${totalAccounts > 0 ? (pendingAccounts / totalAccounts) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="text-lg font-bold">{totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Managed</span>
                <span className="text-lg font-bold">{totalAccounts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Need Attention</span>
                <span className="text-lg font-bold text-red-600">{disabledAccounts + pendingAccounts}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </div>
    </Sidebar>
  );
}
