import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Edit3, Trash2, Users, Shield, RefreshCw, Settings, Lock, DollarSign, Tag as TagIcon, Plus, Database, Download, Upload, FileText, AlertCircle, Send, MessageSquare, Bot, Mail, Bell } from "lucide-react";
import type { User, InsertUserWithRole, Page, RolePermission, Tag, InsertTag, UserMenuPermission, InsertUserMenuPermission, Employee, InsertEmployee, TelegramConfig, InsertTelegramConfig, TelegramChatId, InsertTelegramChatId } from "@shared/schema";

interface UserFormData {
  name: string;
  username: string;
  password: string;
  role: string;
}

function UserManagement() {
  const { toast } = useToast();
  
  // User creation state
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createUserFormData, setCreateUserFormData] = useState({
    name: "",
    username: "",
    password: "",
    role: "user",
    menuPermissions: {
      dashboard: false,
      campaignManagement: false,
      clientManagement: false,
      adAccounts: false,
      workReports: false,
      ownFarming: false,
      newCreated: false,
      farmingAccounts: false,
      advantixDashboard: false,
      projects: false,
      payments: false,
      expensesSalaries: false,
      salaryManagement: false,
      reports: false,
      adminPanel: false,
    }
  });

  // User editing state
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserFormData, setEditUserFormData] = useState({
    name: "",
    username: "",
    password: "",
    role: "user",
  });

  // User deletion state
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Get current user to check permissions
  const { data: currentUser } = useQuery<{ id: string; username: string; role: string }>({
    queryKey: ["/api/auth/user"],
  });

  // Fetch all users
  const { 
    data: users = [], 
    isLoading: usersLoading,
    refetch: refetchUsers 
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch all user menu permissions
  const { 
    data: userMenuPermissions = [], 
    isLoading: permissionsLoading,
    refetch: refetchPermissions 
  } = useQuery<UserMenuPermission[]>({
    queryKey: ["/api/user-menu-permissions"],
  });

  // Update user menu permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ userId, permission, value }: { userId: string; permission: string; value: boolean }) => {
      // Get existing permissions for this user
      const existing = userMenuPermissions.find(p => p.userId === userId);
      
      if (existing) {
        // Update existing permission
        const updateData = { [permission]: value };
        const response = await apiRequest("PUT", `/api/user-menu-permissions/${userId}`, updateData);
        return response.json();
      } else {
        // Create new permission record
        const newPermission = {
          userId,
          dashboard: permission === 'dashboard' ? value : false,
          campaignManagement: permission === 'campaignManagement' ? value : false,
          clientManagement: permission === 'clientManagement' ? value : false,
          adAccounts: permission === 'adAccounts' ? value : false,
          workReports: permission === 'workReports' ? value : false,
          ownFarming: permission === 'ownFarming' ? value : false,
          newCreated: permission === 'newCreated' ? value : false,
          farmingAccounts: permission === 'farmingAccounts' ? value : false,
          advantixDashboard: permission === 'advantixDashboard' ? value : false,
          projects: permission === 'projects' ? value : false,
          payments: permission === 'payments' ? value : false,
          expensesSalaries: permission === 'expensesSalaries' ? value : false,
          salaryManagement: permission === 'salaryManagement' ? value : false,
          reports: permission === 'reports' ? value : false,
          adminPanel: permission === 'adminPanel' ? value : false,
          gherManagement: permission === 'gherManagement' ? value : false,
        };
        const response = await apiRequest("POST", "/api/user-menu-permissions", newPermission);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-menu-permissions"] });
      toast({
        title: "Permission updated",
        description: "User menu permission has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update permission",
        variant: "destructive",
      });
    },
  });

  const getUserPermissions = (userId: string) => {
    const permission = userMenuPermissions.find(p => p.userId === userId);
    if (!permission) {
      return {
        dashboard: false,
        campaignManagement: false,
        clientManagement: false,
        adAccounts: false,
        workReports: false,
        ownFarming: false,
        newCreated: false,
        farmingAccounts: false,
        advantixDashboard: false,
        projects: false,
        payments: false,
        expensesSalaries: false,
        salaryManagement: false,
        reports: false,
        adminPanel: false,
        gherManagement: false,
      };
    }
    return permission;
  };

  const handlePermissionToggle = (userId: string, permission: string, value: boolean) => {
    updatePermissionMutation.mutate({ userId, permission, value });
  };

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; username: string; password: string; role: string }) => {
      const response = await apiRequest("POST", "/api/users", userData);
      return response.json();
    },
    onSuccess: async (newUser) => {
      // Create menu permissions for the new user
      const menuPermissionsData = {
        userId: newUser.id,
        ...createUserFormData.menuPermissions
      };
      
      const permissionsResponse = await apiRequest("POST", "/api/user-menu-permissions", menuPermissionsData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-menu-permissions"] });
      
      toast({
        title: "User created successfully",
        description: `User ${newUser.username} has been created with the selected permissions.`,
      });
      
      setIsCreateUserOpen(false);
      resetCreateUserForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (userData: { id: string; name: string; username: string; password?: string; role: string }) => {
      const response = await apiRequest("PUT", `/api/users/${userData.id}`, userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User updated successfully",
        description: "User information has been updated.",
      });
      setIsEditUserOpen(false);
      setEditingUser(null);
      resetEditUserForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-menu-permissions"] });
      toast({
        title: "User deleted successfully",
        description: "User has been removed from the system.",
      });
      setIsDeleteUserOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting user",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const resetCreateUserForm = () => {
    setCreateUserFormData({
      name: "",
      username: "",
      password: "",
      role: "user",
      menuPermissions: {
        dashboard: false,
        campaignManagement: false,
        clientManagement: false,
        adAccounts: false,
        workReports: false,
        ownFarming: false,
        newCreated: false,
        farmingAccounts: false,
        advantixDashboard: false,
        projects: false,
        payments: false,
        expensesSalaries: false,
        salaryManagement: false,
        reports: false,
        adminPanel: false,
      }
    });
  };

  const resetEditUserForm = () => {
    setEditUserFormData({
      name: "",
      username: "",
      password: "",
      role: "user",
    });
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserFormData({
      name: user.name || "",
      username: user.username,
      password: "",
      role: user.role,
    });
    setIsEditUserOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
  };

  const handleEditUserSubmit = () => {
    if (!editUserFormData.username.trim()) {
      toast({
        title: "Validation Error",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }

    if (!editingUser) return;

    const updateData: any = {
      id: editingUser.id,
      name: editUserFormData.name,
      username: editUserFormData.username,
      role: editUserFormData.role
    };

    // Only include password if it's provided
    if (editUserFormData.password.trim()) {
      updateData.password = editUserFormData.password;
    }

    editUserMutation.mutate(updateData);
  };

  const handleDeleteUserConfirm = () => {
    if (!userToDelete) return;
    deleteUserMutation.mutate(userToDelete.id);
  };

  const handleCreateUser = () => {
    if (!createUserFormData.username.trim() || !createUserFormData.password.trim()) {
      toast({
        title: "Validation Error",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      name: createUserFormData.name,
      username: createUserFormData.username,
      password: createUserFormData.password,
      role: createUserFormData.role
    });
  };

  const handleMenuPermissionChange = (permission: string, value: boolean) => {
    setCreateUserFormData(prev => ({
      ...prev,
      menuPermissions: {
        ...prev.menuPermissions,
        [permission]: value
      }
    }));
  };

  // Check if current user is Super Admin
  const isSupeAdmin = currentUser?.role === 'super_admin';

  if (!isSupeAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Only Super Admins can access the Admin Panel.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (usersLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading user management...</span>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage user access to different menu options
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsCreateUserOpen(true)}
                className="flex items-center gap-2"
                data-testid="button-create-user"
              >
                <UserPlus className="h-4 w-4" />
                Create New User
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchUsers();
                  refetchPermissions();
                }}
                disabled={usersLoading || permissionsLoading}
                data-testid="button-refresh-permissions"
              >
                <RefreshCw className={`h-4 w-4 ${usersLoading || permissionsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Username</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="text-center font-semibold">Dashboard</TableHead>
                  <TableHead className="text-center font-semibold">Campaign Mgmt</TableHead>
                  <TableHead className="text-center font-semibold">Client Mgmt</TableHead>
                  <TableHead className="text-center font-semibold">Ad Accounts</TableHead>
                  <TableHead className="text-center font-semibold">Work Reports</TableHead>
                  <TableHead className="text-center font-semibold">Advantix Dashboard</TableHead>
                  <TableHead className="text-center font-semibold">Projects</TableHead>
                  <TableHead className="text-center font-semibold">Payments</TableHead>
                  <TableHead className="text-center font-semibold">Expenses & Salaries</TableHead>
                  <TableHead className="text-center font-semibold">Salary Management</TableHead>
                  <TableHead className="text-center font-semibold">Reports</TableHead>
                  <TableHead className="text-center font-semibold">Own Farming</TableHead>
                  <TableHead className="text-center font-semibold">New Created</TableHead>
                  <TableHead className="text-center font-semibold">Farming Accounts</TableHead>
                  <TableHead className="text-center font-semibold">Admin Panel</TableHead>
                  <TableHead className="text-center font-semibold">Gher Management</TableHead>
                  <TableHead className="text-center font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-8 text-gray-500">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const permissions = getUserPermissions(user.id);
                    const getRoleBadgeVariant = (role: string) => {
                      switch (role) {
                        case 'super_admin': return 'destructive';
                        case 'admin': return 'default';
                        case 'manager': return 'secondary';
                        default: return 'outline';
                      }
                    };
                    const getRoleLabel = (role: string) => {
                      switch (role) {
                        case 'super_admin': return 'Super Admin';
                        case 'admin': return 'Admin';
                        case 'manager': return 'Manager';
                        case 'user': return 'User';
                        default: return role;
                      }
                    };
                    return (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                          {user.username}
                        </TableCell>
                        <TableCell data-testid={`text-role-${user.id}`}>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.dashboard || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'dashboard', checked)}
                              data-testid={`switch-dashboard-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.dashboard ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.dashboard ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.campaignManagement || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'campaignManagement', checked)}
                              data-testid={`switch-campaign-management-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.campaignManagement ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.campaignManagement ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.clientManagement || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'clientManagement', checked)}
                              data-testid={`switch-client-management-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.clientManagement ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.clientManagement ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.adAccounts || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'adAccounts', checked)}
                              data-testid={`switch-ad-accounts-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.adAccounts ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.adAccounts ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.workReports || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'workReports', checked)}
                              data-testid={`switch-work-reports-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.workReports ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.workReports ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.advantixDashboard || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'advantixDashboard', checked)}
                              data-testid={`switch-advantix-dashboard-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.advantixDashboard ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.advantixDashboard ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.projects || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'projects', checked)}
                              data-testid={`switch-projects-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.projects ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.projects ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.payments || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'payments', checked)}
                              data-testid={`switch-payments-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.payments ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.payments ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.expensesSalaries || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'expensesSalaries', checked)}
                              data-testid={`switch-expenses-salaries-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.expensesSalaries ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.expensesSalaries ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.salaryManagement || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'salaryManagement', checked)}
                              data-testid={`switch-salary-management-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.salaryManagement ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.salaryManagement ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.reports || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'reports', checked)}
                              data-testid={`switch-reports-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.reports ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.reports ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.ownFarming || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'ownFarming', checked)}
                              data-testid={`switch-own-farming-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.ownFarming ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.ownFarming ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.newCreated || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'newCreated', checked)}
                              data-testid={`switch-new-created-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.newCreated ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.newCreated ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.farmingAccounts || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'farmingAccounts', checked)}
                              data-testid={`switch-farming-accounts-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.farmingAccounts ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.farmingAccounts ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.adminPanel || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'adminPanel', checked)}
                              data-testid={`switch-admin-panel-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.adminPanel ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.adminPanel ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={permissions.gherManagement || false}
                              onCheckedChange={(checked) => handlePermissionToggle(user.id, 'gherManagement', checked)}
                              data-testid={`switch-gher-management-${user.id}`}
                            />
                          </div>
                          <span className={`text-sm font-medium ${permissions.gherManagement ? 'text-green-600' : 'text-red-600'}`}>
                            {permissions.gherManagement ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                              data-testid={`button-edit-permissions-${user.id}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteUser(user)}
                              data-testid={`button-delete-permissions-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create New User Dialog */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user and assign menu permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* User Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Full Name</Label>
                <Input
                  id="create-name"
                  value={createUserFormData.name}
                  onChange={(e) => setCreateUserFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  data-testid="input-create-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-username">Username *</Label>
                <Input
                  id="create-username"
                  value={createUserFormData.username}
                  onChange={(e) => setCreateUserFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                  data-testid="input-create-username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Password *</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createUserFormData.password}
                  onChange={(e) => setCreateUserFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  data-testid="input-create-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Role</Label>
                <Select value={createUserFormData.role} onValueChange={(value) => setCreateUserFormData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger data-testid="select-create-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Menu Permissions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <Label className="text-base font-semibold">Menu Access Permissions</Label>
              </div>
              <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Main Navigation</h4>
                  {[
                    { key: 'dashboard', label: 'Dashboard' },
                    { key: 'campaignManagement', label: 'Campaign Management' },
                    { key: 'clientManagement', label: 'Client Management' },
                    { key: 'adAccounts', label: 'Ad Accounts' },
                    { key: 'workReports', label: 'Work Reports' },
                    { key: 'ownFarming', label: 'Own Farming' },
                  ].map((permission) => (
                    <div key={permission.key} className="flex items-center justify-between">
                      <Label htmlFor={`create-${permission.key}`} className="text-sm">
                        {permission.label}
                      </Label>
                      <Switch
                        id={`create-${permission.key}`}
                        checked={createUserFormData.menuPermissions[permission.key as keyof typeof createUserFormData.menuPermissions]}
                        onCheckedChange={(checked) => handleMenuPermissionChange(permission.key, checked)}
                        data-testid={`switch-create-${permission.key}`}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Advantix Finance</h4>
                  {[
                    { key: 'advantixDashboard', label: 'Advantix Dashboard' },
                    { key: 'projects', label: 'Projects' },
                    { key: 'payments', label: 'Payments' },
                    { key: 'expensesSalaries', label: 'Expenses & Salaries' },
                    { key: 'reports', label: 'Reports' },
                    { key: 'adminPanel', label: 'Admin Panel' },
                  ].map((permission) => (
                    <div key={permission.key} className="flex items-center justify-between">
                      <Label htmlFor={`create-${permission.key}`} className="text-sm">
                        {permission.label}
                      </Label>
                      <Switch
                        id={`create-${permission.key}`}
                        checked={createUserFormData.menuPermissions[permission.key as keyof typeof createUserFormData.menuPermissions]}
                        onCheckedChange={(checked) => handleMenuPermissionChange(permission.key, checked)}
                        data-testid={`switch-create-${permission.key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              data-testid="button-confirm-create-user"
            >
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editUserFormData.name}
                onChange={(e) => setEditUserFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username *</Label>
              <Input
                id="edit-username"
                value={editUserFormData.username}
                onChange={(e) => setEditUserFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter username"
                data-testid="input-edit-username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={editUserFormData.password}
                onChange={(e) => setEditUserFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Leave empty to keep current password"
                data-testid="input-edit-password"
              />
              <p className="text-xs text-gray-500">Leave empty to keep current password</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editUserFormData.role} onValueChange={(value) => setEditUserFormData(prev => ({ ...prev, role: value }))}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditUserOpen(false)}
              data-testid="button-cancel-edit-user"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditUserSubmit}
              disabled={editUserMutation.isPending}
              data-testid="button-confirm-edit-user"
            >
              {editUserMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user "{userToDelete?.username}"? This action cannot be undone and will remove all associated permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUserConfirm}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Access Control Component
function AccessControl() {
  const { toast } = useToast();
  
  // Fetch pages and role permissions
  const { data: pages = [], isLoading: pagesLoading } = useQuery<Page[]>({
    queryKey: ["/api/pages"],
  });

  const { data: rolePermissions = [], isLoading: permissionsLoading, refetch } = useQuery<RolePermission[]>({
    queryKey: ["/api/role-permissions"],
  });

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ id, canView, canEdit, canDelete }: { id: string, canView?: boolean, canEdit?: boolean, canDelete?: boolean }) => {
      const response = await apiRequest("PUT", `/api/role-permissions/${id}`, {
        canView,
        canEdit,
        canDelete,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-permissions"] });
      toast({
        title: "Permission updated",
        description: "Role permission has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update permission",
        variant: "destructive",
      });
    },
  });

  const roles = ["user", "manager", "admin", "super_admin"];

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "user": return "User";
      case "manager": return "Manager";
      case "admin": return "Admin";
      case "super_admin": return "Super Admin";
      default: return role;
    }
  };

  const getPermissionForRoleAndPage = (role: string, pageId: string) => {
    return rolePermissions.find(p => p.role === role && p.pageId === pageId);
  };

  const handlePermissionToggle = (permissionId: string, action: 'view' | 'edit' | 'delete', value: boolean) => {
    const updateData: any = { id: permissionId };
    updateData[`can${action.charAt(0).toUpperCase() + action.slice(1)}`] = value;
    updatePermissionMutation.mutate(updateData);
  };

  if (pagesLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading access control settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-6 h-6" />
            Access Control
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage page visibility and permissions for each role
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role-Based Page Permissions</CardTitle>
          <CardDescription>
            Configure which pages each role can access and what actions they can perform.
            Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop View - Full Table with Proper Scrolling */}
          <div className="hidden lg:block">
            <div className="h-[calc(100vh-24rem)] min-h-[400px] max-h-[600px] overflow-auto border-t relative">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-white dark:bg-gray-900 z-30 shadow-sm border-b">
                  <TableRow>
                    <TableHead className="w-56 bg-white dark:bg-gray-900 sticky left-0 z-40 border-r shadow-sm">
                      <div className="font-semibold">Page</div>
                    </TableHead>
                    {roles.map(role => (
                      <TableHead key={role} className="text-center min-w-[200px] bg-white dark:bg-gray-900 px-4">
                        <div className="flex flex-col items-center gap-1">
                          <Shield className="w-4 h-4" />
                          <span className="font-medium">{getRoleDisplayName(role)}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page, index) => (
                    <TableRow key={page.id} className={index % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-800/50" : ""}>
                      <TableCell className="font-medium bg-white dark:bg-gray-900 sticky left-0 z-20 border-r shadow-sm w-56">
                        <div className="flex flex-col py-2 pr-4">
                          <span className="font-semibold text-sm">{page.displayName}</span>
                          <span className="text-xs text-gray-500">{page.path}</span>
                          {page.description && (
                            <span className="text-xs text-gray-400 mt-1 line-clamp-2">{page.description}</span>
                          )}
                        </div>
                      </TableCell>
                      {roles.map(role => {
                        const permission = getPermissionForRoleAndPage(role, page.id);
                        if (!permission) return (
                          <TableCell key={role} className="text-center text-gray-400 px-4">
                            <div className="py-4">No permission found</div>
                          </TableCell>
                        );

                        return (
                          <TableCell key={role} className="text-center px-4">
                            <div className="grid grid-cols-3 gap-2 py-3">
                              {/* View Permission */}
                              <div className="flex flex-col items-center space-y-1">
                                <Switch
                                  checked={permission.canView ?? false}
                                  onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'view', checked)}
                                  disabled={updatePermissionMutation.isPending}
                                  data-testid={`switch-view-${role}-${page.pageKey}`}

                                />
                                <span className="text-xs text-gray-600 font-medium">View</span>
                              </div>
                              
                              {/* Edit Permission */}
                              <div className="flex flex-col items-center space-y-1">
                                <Switch
                                  checked={permission.canEdit ?? false}
                                  onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'edit', checked)}
                                  disabled={updatePermissionMutation.isPending || !permission.canView}
                                  data-testid={`switch-edit-${role}-${page.pageKey}`}

                                />
                                <span className="text-xs text-gray-600 font-medium">Edit</span>
                              </div>
                              
                              {/* Delete Permission */}
                              <div className="flex flex-col items-center space-y-1">
                                <Switch
                                  checked={permission.canDelete ?? false}
                                  onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'delete', checked)}
                                  disabled={updatePermissionMutation.isPending || !permission.canView}
                                  data-testid={`switch-delete-${role}-${page.pageKey}`}

                                />
                                <span className="text-xs text-gray-600 font-medium">Delete</span>
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Tablet View - Horizontally Scrollable */}
          <div className="hidden md:block lg:hidden">
            <div className="h-[calc(100vh-24rem)] min-h-[400px] max-h-[500px] overflow-auto border-t">
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-48 bg-white dark:bg-gray-900 sticky left-0 z-20 border-r">Page</TableHead>
                      {roles.map(role => (
                        <TableHead key={role} className="text-center min-w-[150px] bg-white dark:bg-gray-900">
                          <div className="flex flex-col items-center">
                            <Shield className="w-4 h-4 mb-1" />
                            {getRoleDisplayName(role)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map(page => (
                      <TableRow key={page.id}>
                        <TableCell className="font-medium bg-white dark:bg-gray-900 sticky left-0 z-10 border-r w-48">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{page.displayName}</span>
                            <span className="text-xs text-gray-500">{page.path}</span>
                          </div>
                        </TableCell>
                        {roles.map(role => {
                          const permission = getPermissionForRoleAndPage(role, page.id);
                          if (!permission) return (
                            <TableCell key={role} className="text-center text-gray-400">
                              No permission found
                            </TableCell>
                          );

                          return (
                            <TableCell key={role} className="text-center">
                              <div className="flex justify-center space-x-1 py-2">
                                <div className="flex flex-col items-center space-y-1">
                                  <Switch
                                    checked={permission.canView ?? false}
                                    onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'view', checked)}
                                    disabled={updatePermissionMutation.isPending}
                                    data-testid={`switch-view-${role}-${page.pageKey}`}
  
                                  />
                                  <span className="text-xs">V</span>
                                </div>
                                <div className="flex flex-col items-center space-y-1">
                                  <Switch
                                    checked={permission.canEdit ?? false}
                                    onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'edit', checked)}
                                    disabled={updatePermissionMutation.isPending || !permission.canView}
                                    data-testid={`switch-edit-${role}-${page.pageKey}`}
  
                                  />
                                  <span className="text-xs">E</span>
                                </div>
                                <div className="flex flex-col items-center space-y-1">
                                  <Switch
                                    checked={permission.canDelete ?? false}
                                    onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'delete', checked)}
                                    disabled={updatePermissionMutation.isPending || !permission.canView}
                                    data-testid={`switch-delete-${role}-${page.pageKey}`}
  
                                  />
                                  <span className="text-xs">D</span>
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Mobile View - Stacked Cards */}
          <div className="md:hidden">
            <div className="h-[calc(100vh-20rem)] min-h-[400px] overflow-y-auto p-4 space-y-4">
              {pages.map(page => (
                <div key={page.id} className="border rounded-lg p-4 space-y-4 bg-white dark:bg-gray-800">
                  <div className="border-b pb-3">
                    <h3 className="font-semibold text-lg">{page.displayName}</h3>
                    <p className="text-sm text-gray-500">{page.path}</p>
                    {page.description && (
                      <p className="text-xs text-gray-400 mt-1">{page.description}</p>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {roles.map(role => {
                      const permission = getPermissionForRoleAndPage(role, page.id);
                      if (!permission) return (
                        <div key={role} className="text-center text-gray-400 p-2">
                          <div className="font-medium mb-2">{getRoleDisplayName(role)}</div>
                          <div>No permission found</div>
                        </div>
                      );

                      return (
                        <div key={role} className="border rounded p-3 bg-gray-50 dark:bg-gray-700">
                          <div className="font-medium text-center mb-3 flex items-center justify-center gap-1">
                            <Shield className="w-4 h-4" />
                            {getRoleDisplayName(role)}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {/* View Permission */}
                            <div className="flex flex-col items-center space-y-2">
                              <Switch
                                checked={permission.canView ?? false}
                                onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'view', checked)}
                                disabled={updatePermissionMutation.isPending}
                                data-testid={`switch-view-${role}-${page.pageKey}`}
                              />
                              <span className="text-sm text-gray-600 text-center">View</span>
                            </div>
                            
                            {/* Edit Permission */}
                            <div className="flex flex-col items-center space-y-2">
                              <Switch
                                checked={permission.canEdit ?? false}
                                onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'edit', checked)}
                                disabled={updatePermissionMutation.isPending || !permission.canView}
                                data-testid={`switch-edit-${role}-${page.pageKey}`}
                              />
                              <span className="text-sm text-gray-600 text-center">Edit</span>
                            </div>
                            
                            {/* Delete Permission */}
                            <div className="flex flex-col items-center space-y-2">
                              <Switch
                                checked={permission.canDelete ?? false}
                                onCheckedChange={(checked) => handlePermissionToggle(permission.id, 'delete', checked)}
                                disabled={updatePermissionMutation.isPending || !permission.canView}
                                data-testid={`switch-delete-${role}-${page.pageKey}`}
                              />
                              <span className="text-sm text-gray-600 text-center">Delete</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permission Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>• <strong>View:</strong> Access to view the page content</p>
            <p>• <strong>Edit:</strong> Ability to modify content (requires View permission)</p>
            <p>• <strong>Delete:</strong> Ability to delete content (requires View permission)</p>
            <p>• <strong>Super Admin:</strong> Always has full access to all pages regardless of settings</p>
            <p>• Changes are automatically saved and will take effect immediately for users</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceAccessControl() {
  const { toast } = useToast();
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagFormData, setTagFormData] = useState({ name: "", description: "", color: "#3B82F6" });
  
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({ name: "", department: "", position: "", notes: "" });
  
  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch tags
  const { data: tags = [], isLoading: tagsLoading, refetch: refetchTags } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Fetch employees (dedicated employees table)
  const { data: employees = [], isLoading: employeesLoading, refetch: refetchEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch finance page and role permissions
  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["/api/pages"],
  });

  const { data: rolePermissions = [], refetch: refetchPermissions } = useQuery<RolePermission[]>({
    queryKey: ["/api/role-permissions"],
  });

  // Find the finance page
  const financePage = pages.find(p => p.pageKey === 'finance');

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ userId, hasAccess }: { userId: string, hasAccess: boolean }) => {
      const user = users.find(u => u.id === userId);
      if (!user || !financePage) return;

      // Find existing permission for this user's role and finance page
      const existingPermission = rolePermissions.find(p => 
        p.role === user.role && p.pageId === financePage.id
      );

      if (existingPermission) {
        // Update existing permission
        const response = await apiRequest("PUT", `/api/role-permissions/${existingPermission.id}`, {
          canView: hasAccess,
          canEdit: hasAccess,
          canDelete: hasAccess,
        });
        return response.json();
      } else if (hasAccess) {
        // Create new permission
        const response = await apiRequest("POST", "/api/role-permissions", {
          role: user.role,
          pageId: financePage.id,
          canView: true,
          canEdit: true,
          canDelete: true,
        });
        return response.json();
      }
    },
    onSuccess: () => {
      refetchPermissions();
      toast({
        title: "Success",
        description: "Finance access updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update finance access",
        variant: "destructive",
      });
    },
  });

  // Helper to check if user has finance access
  const getUserFinanceAccess = (user: User) => {
    if (!financePage) return false;
    if (user.role === 'super_admin') return true; // Super admins always have access
    
    const permission = rolePermissions.find(p => 
      p.role === user.role && p.pageId === financePage.id
    );
    return permission?.canView ?? false;
  };

  const handleAccessToggle = (userId: string, hasAccess: boolean) => {
    updatePermissionMutation.mutate({ userId, hasAccess });
  };

  // Tag mutations
  const createTagMutation = useMutation({
    mutationFn: async (tagData: InsertTag) => {
      const response = await apiRequest("POST", "/api/tags", tagData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsCreateTagOpen(false);
      resetTagForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, tagData }: { id: string; tagData: Partial<InsertTag> }) => {
      const response = await apiRequest("PUT", `/api/tags/${id}`, tagData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsEditTagOpen(false);
      setEditingTag(null);
      resetTagForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/tags/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const resetTagForm = () => {
    setTagFormData({ name: "", description: "", color: "#3B82F6" });
  };

  const handleCreateTag = () => {
    if (!tagFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Tag name is required",
        variant: "destructive",
      });
      return;
    }
    createTagMutation.mutate({
      name: tagFormData.name,
      description: tagFormData.description || null,
      color: tagFormData.color,
    });
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagFormData({
      name: tag.name,
      description: tag.description || "",
      color: tag.color || "#3B82F6",
    });
    setIsEditTagOpen(true);
  };

  const handleUpdateTag = () => {
    if (!editingTag || !tagFormData.name.trim()) return;
    updateTagMutation.mutate({
      id: editingTag.id,
      tagData: {
        name: tagFormData.name,
        description: tagFormData.description || null,
        color: tagFormData.color,
      },
    });
  };

  const handleDeleteTag = (id: string) => {
    deleteTagMutation.mutate(id);
  };

  // Employee mutations
  const createEmployeeMutation = useMutation({
    mutationFn: async (employeeData: InsertEmployee) => {
      const response = await apiRequest("POST", "/api/employees", employeeData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsCreateEmployeeOpen(false);
      resetEmployeeForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, employeeData }: { id: string; employeeData: Partial<InsertEmployee> }) => {
      const response = await apiRequest("PUT", `/api/employees/${id}`, employeeData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsEditEmployeeOpen(false);
      setEditingEmployee(null);
      resetEmployeeForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/employees/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    },
  });

  const resetEmployeeForm = () => {
    setEmployeeFormData({ name: "", department: "", position: "", notes: "" });
  };

  const handleCreateEmployee = () => {
    if (!employeeFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Employee name is required",
        variant: "destructive",
      });
      return;
    }
    createEmployeeMutation.mutate({
      name: employeeFormData.name,
      department: employeeFormData.department || null,
      position: employeeFormData.position || null,
      notes: employeeFormData.notes || null,
    });
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeFormData({
      name: employee.name,
      department: employee.department || "",
      position: employee.position || "",
      notes: employee.notes || "",
    });
    setIsEditEmployeeOpen(true);
  };

  const handleUpdateEmployee = () => {
    if (!editingEmployee || !employeeFormData.name.trim()) return;
    updateEmployeeMutation.mutate({
      id: editingEmployee.id,
      employeeData: {
        name: employeeFormData.name,
        department: employeeFormData.department || null,
        position: employeeFormData.position || null,
        notes: employeeFormData.notes || null,
      },
    });
  };

  const handleDeleteEmployee = (id: string) => {
    deleteEmployeeMutation.mutate(id);
  };

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Advantix Finance Access Control
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Control which users can access the Finance module and all its features
          </p>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Finance Access</CardTitle>
          <CardDescription>
            Grant or revoke access to Advantix Finance for specific users. Users with access will see all Finance submenus (Dashboard, Projects, Payments, Expenses & Salaries, Reports).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Finance Access</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const hasAccess = getUserFinanceAccess(user);
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.role === 'super_admin' ? 'default' : 'secondary'}
                        className={user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : ''}
                      >
                        {user.role === 'super_admin' ? 'Super Admin' : 
                         user.role === 'admin' ? 'Admin' :
                         user.role === 'manager' ? 'Manager' : 'User'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hasAccess ? "default" : "secondary"}>
                        {hasAccess ? "Granted" : "Denied"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.role === 'super_admin' ? (
                          <span className="text-sm text-gray-500">Always has access</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={hasAccess}
                              onCheckedChange={(checked) => handleAccessToggle(user.id, checked)}
                              disabled={updatePermissionMutation.isPending}
                              data-testid={`switch-finance-access-${user.id}`}
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {hasAccess ? "Granted" : "Denied"}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            How Finance Access Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>• <strong>Granted Access:</strong> User can see and access all Finance features including Dashboard, Projects, Payments, Expenses & Salaries, and Reports</p>
            <p>• <strong>Denied Access:</strong> User cannot see any Finance menu items or access any Finance pages</p>
            <p>• <strong>Super Admin:</strong> Always has full access to all Finance features regardless of settings</p>
            <p>• <strong>Role-based:</strong> Access is granted per user role (all users with the same role share the same access level)</p>
            <p>• Changes take effect immediately and will be reflected in the user's sidebar menu</p>
          </div>
        </CardContent>
      </Card>

      {/* Tag Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TagIcon className="w-5 h-5" />
                Tag Management
              </CardTitle>
              <CardDescription>
                Create and manage tags for categorizing finance data
              </CardDescription>
            </div>
            <Dialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-tag">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tag</DialogTitle>
                  <DialogDescription>
                    Create a new tag for categorizing finance data
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tag-name">Tag Name</Label>
                    <Input
                      id="tag-name"
                      value={tagFormData.name}
                      onChange={(e) => setTagFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter tag name"
                      data-testid="input-tag-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tag-description">Description (optional)</Label>
                    <Input
                      id="tag-description"
                      value={tagFormData.description}
                      onChange={(e) => setTagFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter tag description"
                      data-testid="input-tag-description"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tag-color">Color</Label>
                    <Input
                      id="tag-color"
                      type="color"
                      value={tagFormData.color}
                      onChange={(e) => setTagFormData(prev => ({ ...prev, color: e.target.value }))}
                      data-testid="input-tag-color"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateTagOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateTag}
                    disabled={createTagMutation.isPending}
                    data-testid="button-save-tag"
                  >
                    {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {tagsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No tags found
                    </TableCell>
                  </TableRow>
                ) : (
                  tags.map((tag) => (
                    <TableRow key={tag.id} data-testid={`row-tag-${tag.id}`}>
                      <TableCell className="font-medium" data-testid={`text-tag-name-${tag.id}`}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: tag.color || "#3B82F6" }}
                          />
                          {tag.name}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-tag-description-${tag.id}`}>
                        {tag.description || "No description"}
                      </TableCell>
                      <TableCell data-testid={`text-tag-color-${tag.id}`}>
                        {tag.color || "#3B82F6"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tag.isActive ? "default" : "secondary"} data-testid={`badge-tag-status-${tag.id}`}>
                          {tag.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTag(tag)}
                            data-testid={`button-edit-tag-${tag.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-tag-${tag.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{tag.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTag(tag.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid={`button-confirm-delete-tag-${tag.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Employee Name Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Employee Name Management
              </CardTitle>
              <CardDescription>
                Create and manage employee names for finance tracking (no registration required)
              </CardDescription>
            </div>
            <Dialog open={isCreateEmployeeOpen} onOpenChange={setIsCreateEmployeeOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-employee">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Employee</DialogTitle>
                  <DialogDescription>
                    Add a new employee name that will sync with Expenses & Salaries
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="employee-name">Employee Name *</Label>
                    <Input
                      id="employee-name"
                      value={employeeFormData.name}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter employee name"
                      data-testid="input-employee-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="employee-department">Department (optional)</Label>
                    <Input
                      id="employee-department"
                      value={employeeFormData.department}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter department"
                      data-testid="input-employee-department"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="employee-position">Position (optional)</Label>
                    <Input
                      id="employee-position"
                      value={employeeFormData.position}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, position: e.target.value }))}
                      placeholder="Enter position"
                      data-testid="input-employee-position"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="employee-notes">Notes (optional)</Label>
                    <Input
                      id="employee-notes"
                      value={employeeFormData.notes}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Enter notes"
                      data-testid="input-employee-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateEmployeeOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateEmployee}
                    disabled={createEmployeeMutation.isPending}
                    data-testid="button-save-employee"
                  >
                    {createEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {employeesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No employees found. Click "Add Employee" to create your first employee.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                      <TableCell className="font-medium" data-testid={`text-employee-name-${employee.id}`}>
                        {employee.name}
                      </TableCell>
                      <TableCell data-testid={`text-employee-department-${employee.id}`}>
                        {employee.department || "N/A"}
                      </TableCell>
                      <TableCell data-testid={`text-employee-position-${employee.id}`}>
                        {employee.position || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? "default" : "secondary"} data-testid={`badge-employee-status-${employee.id}`}>
                          {employee.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEmployee(employee)}
                            data-testid={`button-edit-employee-${employee.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-employee-${employee.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{employee.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteEmployee(employee.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid={`button-confirm-delete-employee-${employee.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditEmployeeOpen} onOpenChange={setIsEditEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-employee-name">Employee Name *</Label>
              <Input
                id="edit-employee-name"
                value={employeeFormData.name}
                onChange={(e) => setEmployeeFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter employee name"
                data-testid="input-edit-employee-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-employee-department">Department (optional)</Label>
              <Input
                id="edit-employee-department"
                value={employeeFormData.department}
                onChange={(e) => setEmployeeFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Enter department"
                data-testid="input-edit-employee-department"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-employee-position">Position (optional)</Label>
              <Input
                id="edit-employee-position"
                value={employeeFormData.position}
                onChange={(e) => setEmployeeFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="Enter position"
                data-testid="input-edit-employee-position"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-employee-notes">Notes (optional)</Label>
              <Input
                id="edit-employee-notes"
                value={employeeFormData.notes}
                onChange={(e) => setEmployeeFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter notes"
                data-testid="input-edit-employee-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditEmployeeOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateEmployee}
              disabled={updateEmployeeMutation.isPending}
              data-testid="button-update-employee"
            >
              {updateEmployeeMutation.isPending ? "Updating..." : "Update Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={isEditTagOpen} onOpenChange={setIsEditTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update tag information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-tag-name">Tag Name</Label>
              <Input
                id="edit-tag-name"
                value={tagFormData.name}
                onChange={(e) => setTagFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter tag name"
                data-testid="input-edit-tag-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tag-description">Description (optional)</Label>
              <Input
                id="edit-tag-description"
                value={tagFormData.description}
                onChange={(e) => setTagFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter tag description"
                data-testid="input-edit-tag-description"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tag-color">Color</Label>
              <Input
                id="edit-tag-color"
                type="color"
                value={tagFormData.color}
                onChange={(e) => setTagFormData(prev => ({ ...prev, color: e.target.value }))}
                data-testid="input-edit-tag-color"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTagOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTag}
              disabled={updateTagMutation.isPending}
              data-testid="button-update-tag"
            >
              {updateTagMutation.isPending ? "Updating..." : "Update Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataImportExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);

  // Get current user to check permissions
  const { data: currentUser } = useQuery<{ id: string; username: string; role: string }>({
    queryKey: ["/api/auth/user"],
  });

  const isAdminOrSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Export data function
  const handleExport = async () => {
    if (!isAdminOrSuperAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admin users can export data.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await apiRequest("GET", "/api/data/export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "All data has been exported successfully.",
      });
    } catch (error: any) {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Import data function
  const handleImport = async () => {
    if (!isAdminOrSuperAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admin users can import data.",
        variant: "destructive",
      });
      return;
    }

    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a JSON file to import.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResults(null);
    
    try {
      const fileContent = await importFile.text();
      const importData = JSON.parse(fileContent);

      const response = await apiRequest("POST", "/api/data/import", importData);
      const results = await response.json();
      
      setImportResults(results);
      
      toast({
        title: "Import Completed",
        description: `Imported: ${results.results.imported}, Updated: ${results.results.updated}, Errors: ${results.results.errors.length}`,
      });

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      
    } catch (error: any) {
      console.error("Import failed:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // File input handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setImportFile(file);
      setImportResults(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid JSON file.",
        variant: "destructive",
      });
      setImportFile(null);
    }
  };

  if (!isAdminOrSuperAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-500">
                Data Import/Export is only available to Admin and Super Admin users.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Import/Export
          </CardTitle>
          <CardDescription>
            Export all site data to JSON format or import previously exported data back into the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Export Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Download className="w-4 h-4" />
              <h3 className="font-semibold">Export Data</h3>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Export All Data</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Download a complete backup of all site data including users, campaigns, clients, 
                    finance records, and settings in JSON format.
                  </p>
                  <ul className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                    <li>• Passwords are automatically redacted for security</li>
                    <li>• All data relationships are preserved</li>
                    <li>• Compatible with the import function below</li>
                  </ul>
                </div>
              </div>
              
              <Button 
                onClick={handleExport}
                disabled={isExporting}
                className="mt-4"
                data-testid="button-export"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export All Data
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Upload className="w-4 h-4" />
              <h3 className="font-semibold">Import Data</h3>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100">Import Previously Exported Data</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Upload a JSON file exported from this system to restore data. Existing records will be 
                    updated and new records will be created.
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-400 mt-2 space-y-1">
                    <li>• Duplicate handling: Updates existing records instead of creating duplicates</li>
                    <li>• Maintains data integrity and relationships</li>
                    <li>• Shows detailed import results</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 space-y-3">
                <div>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    disabled={isImporting}
                    data-testid="input-import-file"
                  />
                  {importFile && (
                    <p className="text-sm text-green-600 mt-1">
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                
                <Button 
                  onClick={handleImport}
                  disabled={isImporting || !importFile}
                  variant="secondary"
                  data-testid="button-import"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FileText className="w-4 h-4" />
                <h3 className="font-semibold">Import Results</h3>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{importResults.results.imported}</div>
                    <div className="text-sm text-gray-600">New Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{importResults.results.updated}</div>
                    <div className="text-sm text-gray-600">Updated Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{importResults.results.skipped}</div>
                    <div className="text-sm text-gray-600">Errors/Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{importResults.results.totalProcessed}</div>
                    <div className="text-sm text-gray-600">Total Processed</div>
                  </div>
                </div>
                
                {importResults.results.errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">Errors:</h4>
                    <div className="text-sm text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                      {importResults.results.errors.map((error: string, index: number) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mt-4">
                  Import completed at {new Date(importResults.importedAt).toLocaleString()}
                  {importResults.importedBy && ` by ${importResults.importedBy}`}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TelegramManagement() {
  const { toast } = useToast();
  
  // State for token management
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  
  // State for chat ID management
  const [chatIdInput, setChatIdInput] = useState("");
  const [chatNameInput, setChatNameInput] = useState("");
  const [chatDescriptionInput, setChatDescriptionInput] = useState("");
  const [isAddChatIdOpen, setIsAddChatIdOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<TelegramChatId | null>(null);
  const [isEditChatIdOpen, setIsEditChatIdOpen] = useState(false);
  
  // State for test message
  const [testMessageInput, setTestMessageInput] = useState("");
  
  // Fetch Telegram configuration
  const { 
    data: telegramConfig, 
    isLoading: configLoading,
    refetch: refetchConfig 
  } = useQuery<TelegramConfig>({
    queryKey: ["/api/telegram/config"],
  });

  // Fetch chat IDs
  const { 
    data: chatIds = [], 
    isLoading: chatIdsLoading,
    refetch: refetchChatIds 
  } = useQuery<TelegramChatId[]>({
    queryKey: ["/api/telegram/chat-ids"],
  });

  // Token mutations
  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const method = telegramConfig ? "PUT" : "POST";
      const response = await apiRequest(method, "/api/telegram/config", { 
        botToken: token, 
        isActive: true 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/config"] });
      toast({
        title: "Bot token saved",
        description: "Telegram bot token has been saved successfully.",
      });
      setTokenInput("");
    },
    onError: (error: any) => {
      toast({
        title: "Error saving token",
        description: error.message || "Failed to save bot token",
        variant: "destructive",
      });
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/telegram/config");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/config"] });
      toast({
        title: "Bot token deleted",
        description: "Telegram bot token has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting token",
        description: error.message || "Failed to delete bot token",
        variant: "destructive",
      });
    },
  });

  // Chat ID mutations
  const addChatIdMutation = useMutation({
    mutationFn: async (data: { chatId: string; name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/telegram/chat-ids", {
        chatId: data.chatId,
        name: data.name,
        description: data.description,
        isActive: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/chat-ids"] });
      toast({
        title: "Chat ID added",
        description: "Telegram chat ID has been added successfully.",
      });
      setIsAddChatIdOpen(false);
      resetChatIdForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error adding chat ID",
        description: error.message || "Failed to add chat ID",
        variant: "destructive",
      });
    },
  });

  const updateChatIdMutation = useMutation({
    mutationFn: async (data: { id: string; chatId: string; name: string; description?: string }) => {
      const response = await apiRequest("PUT", `/api/telegram/chat-ids/${data.id}`, {
        chatId: data.chatId,
        name: data.name,
        description: data.description
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/chat-ids"] });
      toast({
        title: "Chat ID updated",
        description: "Telegram chat ID has been updated successfully.",
      });
      setIsEditChatIdOpen(false);
      setEditingChatId(null);
      resetChatIdForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating chat ID",
        description: error.message || "Failed to update chat ID",
        variant: "destructive",
      });
    },
  });

  const deleteChatIdMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/telegram/chat-ids/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/chat-ids"] });
      toast({
        title: "Chat ID deleted",
        description: "Telegram chat ID has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting chat ID",
        description: error.message || "Failed to delete chat ID",
        variant: "destructive",
      });
    },
  });

  // Test message mutation
  const sendTestMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/telegram/test-message", {
        message: message
      });
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Test message sent",
        description: `Message sent successfully to ${result.sentCount} chat(s).`,
      });
      setTestMessageInput("");
    },
    onError: (error: any) => {
      toast({
        title: "Error sending test message",
        description: error.message || "Failed to send test message",
        variant: "destructive",
      });
    },
  });

  const resetChatIdForm = () => {
    setChatIdInput("");
    setChatNameInput("");
    setChatDescriptionInput("");
  };

  const handleEditChatId = (chatId: TelegramChatId) => {
    setEditingChatId(chatId);
    setChatIdInput(chatId.chatId);
    setChatNameInput(chatId.name);
    setChatDescriptionInput(chatId.description || "");
    setIsEditChatIdOpen(true);
  };

  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Bot token is required",
        variant: "destructive",
      });
      return;
    }
    saveTokenMutation.mutate(tokenInput.trim());
  };

  const handleAddChatId = () => {
    if (!chatIdInput.trim() || !chatNameInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Chat ID and name are required",
        variant: "destructive",
      });
      return;
    }
    addChatIdMutation.mutate({
      chatId: chatIdInput.trim(),
      name: chatNameInput.trim(),
      description: chatDescriptionInput.trim() || undefined
    });
  };

  const handleUpdateChatId = () => {
    if (!editingChatId || !chatIdInput.trim() || !chatNameInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Chat ID and name are required",
        variant: "destructive",
      });
      return;
    }
    updateChatIdMutation.mutate({
      id: editingChatId.id,
      chatId: chatIdInput.trim(),
      name: chatNameInput.trim(),
      description: chatDescriptionInput.trim() || undefined
    });
  };

  const handleSendTestMessage = () => {
    if (!testMessageInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Test message is required",
        variant: "destructive",
      });
      return;
    }

    if (!telegramConfig?.botToken) {
      toast({
        title: "Configuration Error",
        description: "Please set up a bot token first",
        variant: "destructive",
      });
      return;
    }

    if (chatIds.length === 0) {
      toast({
        title: "Configuration Error",
        description: "Please add at least one chat ID first",
        variant: "destructive",
      });
      return;
    }

    sendTestMessageMutation.mutate(testMessageInput.trim());
  };

  if (configLoading || chatIdsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading Telegram configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token Setup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Bot Token Setup
          </CardTitle>
          <CardDescription>
            Configure your Telegram bot token for sending notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramConfig?.botToken ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Bot Token Configured</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Token: {showToken ? telegramConfig.botToken : '••••••••••••••••••••••••••••••••••••••••••••'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                    data-testid="button-toggle-token-visibility"
                  >
                    {showToken ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteTokenMutation.mutate()}
                    disabled={deleteTokenMutation.isPending}
                    data-testid="button-delete-token"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-token">Bot Token</Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder="Enter your Telegram bot token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  data-testid="input-bot-token"
                />
                <p className="text-sm text-gray-500">
                  Get your bot token from @BotFather on Telegram
                </p>
              </div>
              <Button
                onClick={handleSaveToken}
                disabled={saveTokenMutation.isPending}
                data-testid="button-save-token"
              >
                {saveTokenMutation.isPending ? "Saving..." : "Save Token"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat ID Setup Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat ID Management
              </CardTitle>
              <CardDescription>
                Manage Telegram chat IDs for sending notifications
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddChatIdOpen(true)}
              data-testid="button-add-chat-id"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Chat ID
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chatIds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No chat IDs configured</p>
              <p className="text-sm">Add chat IDs to send notifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatIds.map((chatId) => (
                <div
                  key={chatId.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`chat-id-item-${chatId.id}`}
                >
                  <div>
                    <h4 className="font-medium">{chatId.name}</h4>
                    <p className="text-sm text-gray-500">ID: {chatId.chatId}</p>
                    {chatId.description && (
                      <p className="text-sm text-gray-400 mt-1">{chatId.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditChatId(chatId)}
                      data-testid={`button-edit-chat-id-${chatId.id}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteChatIdMutation.mutate(chatId.id)}
                      disabled={deleteChatIdMutation.isPending}
                      data-testid={`button-delete-chat-id-${chatId.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Message Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Message
          </CardTitle>
          <CardDescription>
            Send a test notification to all configured chat IDs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-message">Test Message</Label>
            <Input
              id="test-message"
              placeholder="Enter test message"
              value={testMessageInput}
              onChange={(e) => setTestMessageInput(e.target.value)}
              data-testid="input-test-message"
            />
          </div>
          <Button
            onClick={handleSendTestMessage}
            disabled={sendTestMessageMutation.isPending || !telegramConfig?.botToken || chatIds.length === 0}
            data-testid="button-send-test-message"
          >
            {sendTestMessageMutation.isPending ? "Sending..." : "Send Test Message"}
          </Button>
          {(!telegramConfig?.botToken || chatIds.length === 0) && (
            <p className="text-sm text-amber-600">
              {!telegramConfig?.botToken && "Please configure a bot token first. "}
              {chatIds.length === 0 && "Please add at least one chat ID first."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Automation Settings
          </CardTitle>
          <CardDescription>
            Configure automatic notifications for work reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Work Report Notifications</h4>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Automatically send notifications when users submit work reports
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={true}
                disabled={!telegramConfig?.botToken || chatIds.length === 0}
                data-testid="switch-work-report-automation"
              />
              <span className="text-sm font-medium text-green-600">Active</span>
            </div>
          </div>
          {(!telegramConfig?.botToken || chatIds.length === 0) && (
            <p className="text-sm text-amber-600 mt-2">
              Configure bot token and chat IDs to enable automation
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Chat ID Dialog */}
      <Dialog open={isAddChatIdOpen} onOpenChange={setIsAddChatIdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Chat ID</DialogTitle>
            <DialogDescription>
              Add a new Telegram chat ID for notifications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chat-id">Chat ID</Label>
              <Input
                id="chat-id"
                placeholder="Enter chat ID (e.g., -1001234567890)"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
                data-testid="input-add-chat-id"
              />
            </div>
            <div>
              <Label htmlFor="chat-name">Name</Label>
              <Input
                id="chat-name"
                placeholder="Enter friendly name"
                value={chatNameInput}
                onChange={(e) => setChatNameInput(e.target.value)}
                data-testid="input-add-chat-name"
              />
            </div>
            <div>
              <Label htmlFor="chat-description">Description (Optional)</Label>
              <Input
                id="chat-description"
                placeholder="Enter description"
                value={chatDescriptionInput}
                onChange={(e) => setChatDescriptionInput(e.target.value)}
                data-testid="input-add-chat-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddChatIdOpen(false);
              resetChatIdForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddChatId}
              disabled={addChatIdMutation.isPending}
              data-testid="button-confirm-add-chat-id"
            >
              {addChatIdMutation.isPending ? "Adding..." : "Add Chat ID"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Chat ID Dialog */}
      <Dialog open={isEditChatIdOpen} onOpenChange={setIsEditChatIdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Chat ID</DialogTitle>
            <DialogDescription>
              Update the chat ID information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-chat-id">Chat ID</Label>
              <Input
                id="edit-chat-id"
                placeholder="Enter chat ID"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
                data-testid="input-edit-chat-id"
              />
            </div>
            <div>
              <Label htmlFor="edit-chat-name">Name</Label>
              <Input
                id="edit-chat-name"
                placeholder="Enter friendly name"
                value={chatNameInput}
                onChange={(e) => setChatNameInput(e.target.value)}
                data-testid="input-edit-chat-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-chat-description">Description (Optional)</Label>
              <Input
                id="edit-chat-description"
                placeholder="Enter description"
                value={chatDescriptionInput}
                onChange={(e) => setChatDescriptionInput(e.target.value)}
                data-testid="input-edit-chat-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditChatIdOpen(false);
              setEditingChatId(null);
              resetChatIdForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateChatId}
              disabled={updateChatIdMutation.isPending}
              data-testid="button-confirm-edit-chat-id"
            >
              {updateChatIdMutation.isPending ? "Updating..." : "Update Chat ID"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FacebookSettings() {
  const { toast } = useToast();
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Fetch Facebook settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/facebook/settings"],
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/facebook/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ appId, appSecret, accessToken }),
      });
      if (!response.ok) {
        let errorMessage = "Failed to save settings";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Facebook settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/settings"] });
    },
    onError: (error: any) => {
      console.error("Save settings error details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/facebook/test-connection", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Connection failed");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setIsConnected(data.success);
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: `Connected as: ${data.userName || 'User'}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/settings"] });
    },
    onError: (error: any) => {
      setIsConnected(false);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Facebook",
        variant: "destructive",
      });
    },
  });

  // Sync ad accounts mutation
  const syncAdAccountsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/facebook/sync-accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Sync failed");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sync Successful",
        description: data.message || `Synced ${data.count} ad account(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/ad-accounts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync ad accounts",
        variant: "destructive",
      });
    },
  });

  // Disconnect Facebook mutation
  const disconnectFacebookMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/facebook/disconnect", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Disconnect failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "Facebook account has been disconnected",
      });
      setAppId("");
      setAppSecret("");
      setAccessToken("");
      setIsConnected(false);
      setLastTestedAt(null);
      setConnectionError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    },
  });

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setAppId(settings.appId || "");
      setAppSecret(settings.appSecret === '••••••••' ? "" : settings.appSecret || "");
      setAccessToken(settings.accessToken || "");
      setIsConnected(settings.isConnected || false);
      setLastTestedAt(settings.lastTestedAt || null);
      setConnectionError(settings.connectionError || null);
    }
  }, [settings]);

  const handleSaveSettings = () => {
    if (!appId || !appSecret || !accessToken) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    saveSettingsMutation.mutate();
  };

  const handleTestConnection = () => {
    if (!settings) {
      toast({
        title: "Error",
        description: "Please save settings first",
        variant: "destructive",
      });
      return;
    }
    testConnectionMutation.mutate();
  };

  const handleSyncAdAccounts = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Please test connection first",
        variant: "destructive",
      });
      return;
    }
    syncAdAccountsMutation.mutate();
  };

  const handleDisconnect = () => {
    if (!settings) {
      toast({
        title: "Error",
        description: "No settings to disconnect",
        variant: "destructive",
      });
      return;
    }
    disconnectFacebookMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook App Settings
          </CardTitle>
          <CardDescription>
            Configure your Facebook App credentials to enable FB Ad Management features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {isConnected ? 'Connected' : 'Not Connected'}
                </p>
                {lastTestedAt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last tested: {new Date(lastTestedAt).toLocaleString()}
                  </p>
                )}
                {connectionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Error: {connectionError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending || !settings}
                variant="outline"
                data-testid="button-test-fb-connection"
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                onClick={handleSyncAdAccounts}
                disabled={syncAdAccountsMutation.isPending || !isConnected}
                variant={isConnected ? "default" : "outline"}
                data-testid="button-sync-fb-accounts"
              >
                {syncAdAccountsMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Ad Accounts
                  </>
                )}
              </Button>
              {settings && (
                <Button
                  onClick={handleDisconnect}
                  disabled={disconnectFacebookMutation.isPending}
                  variant="destructive"
                  data-testid="button-disconnect-fb"
                >
                  {disconnectFacebookMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect"
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Settings Form */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="fb-app-id">Facebook App ID</Label>
              <Input
                id="fb-app-id"
                type="text"
                placeholder="Enter your Facebook App ID"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                data-testid="input-fb-app-id"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Find this in Meta for Developers → Your App → Settings → Basic
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-app-secret">Facebook App Secret</Label>
              <Input
                id="fb-app-secret"
                type="password"
                placeholder="Enter your Facebook App Secret"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                data-testid="input-fb-app-secret"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Find this in Meta for Developers → Your App → Settings → Basic → Show
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-access-token">Access Token (Long-Lived)</Label>
              <Input
                id="fb-access-token"
                type="password"
                placeholder="Enter your Facebook Access Token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                data-testid="input-fb-access-token"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate a long-lived token with ads_read, ads_management, and read_insights permissions
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
                className="flex-1"
                data-testid="button-save-fb-settings"
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How to Get Your Credentials:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">developers.facebook.com</a></li>
              <li>Create or select your app</li>
              <li>Go to Settings → Basic to find App ID and App Secret</li>
              <li>Generate a long-lived access token with required permissions</li>
              <li>Paste the credentials here and click "Save Settings"</li>
              <li>Click "Test Connection" to verify everything works</li>
              <li>Click "Sync Ad Accounts" to import your Facebook ad accounts</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmailSettings() {
  const { toast } = useToast();
  const [provider, setProvider] = useState("resend");
  const [apiKey, setApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [enableNewAdAlerts, setEnableNewAdAlerts] = useState(true);
  const [enableDailySummary, setEnableDailySummary] = useState(true);
  const [dailySummaryTime, setDailySummaryTime] = useState("07:00");
  const [isConfigured, setIsConfigured] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");

  // Fetch Email settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/email/settings"],
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ 
          provider,
          apiKey, 
          senderEmail, 
          senderName, 
          enableNotifications, 
          enableNewAdAlerts, 
          enableDailySummary, 
          dailySummaryTime 
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save settings");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email/test-connection", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Connection failed");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setIsConfigured(data.success);
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: `Email service configured with ${data.provider}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/email/settings"] });
    },
    onError: (error: any) => {
      setIsConfigured(false);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to email service",
        variant: "destructive",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email/test-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ recipientEmail: testEmailRecipient }),
      });
      if (!response.ok) {
        let errorMessage = "Failed to send test email";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.substring(0, 200) || errorMessage;
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Email Sent",
        description: data.message || "Test email sent successfully",
      });
      setTestEmailRecipient("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider || "resend");
      setApiKey(settings.apiKey || "");
      setSenderEmail(settings.senderEmail || "");
      setSenderName(settings.senderName || "");
      setEnableNotifications(settings.enableNotifications || false);
      setEnableNewAdAlerts(settings.enableNewAdAlerts ?? true);
      setEnableDailySummary(settings.enableDailySummary ?? true);
      setDailySummaryTime(settings.dailySummaryTime || "07:00");
      setIsConfigured(settings.isConfigured || false);
      setLastTestedAt(settings.lastTestedAt || null);
      setConnectionError(settings.connectionError || null);
    }
  }, [settings]);

  const handleSaveSettings = () => {
    if (!provider || !apiKey || !senderEmail || !senderName) {
      toast({
        title: "Validation Error",
        description: "Provider, API key, sender email, and sender name are required",
        variant: "destructive",
      });
      return;
    }
    saveSettingsMutation.mutate();
  };

  const handleTestConnection = () => {
    if (!settings) {
      toast({
        title: "Error",
        description: "Please save settings first",
        variant: "destructive",
      });
      return;
    }
    testConnectionMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Automation Settings
          </CardTitle>
          <CardDescription>
            Configure email service for automated client notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {isConfigured ? 'Configured' : 'Not Configured'}
                </p>
                {lastTestedAt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last tested: {new Date(lastTestedAt).toLocaleString()}
                  </p>
                )}
                {connectionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Error: {connectionError}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={handleTestConnection}
              disabled={testConnectionMutation.isPending || !settings}
              variant="outline"
              data-testid="button-test-email-connection"
            >
              {testConnectionMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </div>

          {/* Settings Form */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="email-provider">Email Service Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="email-provider" data-testid="select-email-provider">
                  <SelectValue placeholder="Select email provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="mailgun">Mailgun</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose your email service provider
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-api-key">API Key</Label>
              <Input
                id="email-api-key"
                type="password"
                placeholder="Enter your email service API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                data-testid="input-email-api-key"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your email service API key for sending notifications
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-email">Sender Email Address</Label>
              <Input
                id="sender-email"
                type="email"
                placeholder="notifications@yourcompany.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                data-testid="input-sender-email"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Email address that will appear as the sender
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-name">Sender Name</Label>
              <Input
                id="sender-name"
                type="text"
                placeholder="Advantix Notifications"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                data-testid="input-sender-name"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Name that will appear as the sender
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Notification Settings</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Master toggle for all email notifications
                  </p>
                </div>
                <Switch
                  checked={enableNotifications}
                  onCheckedChange={setEnableNotifications}
                  data-testid="switch-enable-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Ad Alerts</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Notify clients when new ads are created
                  </p>
                </div>
                <Switch
                  checked={enableNewAdAlerts}
                  onCheckedChange={setEnableNewAdAlerts}
                  disabled={!enableNotifications}
                  data-testid="switch-enable-new-ad-alerts"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Summary Emails</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Send daily performance summaries to clients
                  </p>
                </div>
                <Switch
                  checked={enableDailySummary}
                  onCheckedChange={setEnableDailySummary}
                  disabled={!enableNotifications}
                  data-testid="switch-enable-daily-summary"
                />
              </div>

              {enableDailySummary && (
                <div className="space-y-2 pl-4">
                  <Label htmlFor="summary-time">Daily Summary Time</Label>
                  <Input
                    id="summary-time"
                    type="time"
                    value={dailySummaryTime}
                    onChange={(e) => setDailySummaryTime(e.target.value)}
                    disabled={!enableNotifications}
                    data-testid="input-daily-summary-time"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
                className="flex-1"
                data-testid="button-save-email-settings"
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              How to Get Your API Key
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Sign up for an email service provider (we recommend <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">Resend</a>)</li>
              <li>Go to your account dashboard and find the API Keys section</li>
              <li>Create a new API key and copy it</li>
              <li>Paste the API key in the field above</li>
              <li>Fill in your sender email and name</li>
              <li>Click "Save Settings" and then "Test Connection" to verify</li>
            </ol>
          </div>

          {/* Send Test Email Section */}
          {isConfigured && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Test Email
              </h4>
              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                Send a test email to verify your email service is working correctly.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  disabled={sendTestEmailMutation.isPending}
                  data-testid="input-test-email-recipient"
                  className="flex-1"
                />
                <Button
                  onClick={() => sendTestEmailMutation.mutate()}
                  disabled={!testEmailRecipient || sendTestEmailMutation.isPending}
                  data-testid="button-send-test-email"
                >
                  {sendTestEmailMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SmsSettings() {
  const { toast } = useToast();
  const [provider, setProvider] = useState("sms_in_bd");
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [enableAdActiveAlerts, setEnableAdActiveAlerts] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testMessage, setTestMessage] = useState("Test SMS from Advantix Admin. Your SMS service is configured correctly!");

  // Fetch SMS settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/sms/settings"],
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sms/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ 
          provider,
          apiKey, 
          senderId, 
          enableNotifications, 
          enableAdActiveAlerts
        }),
      });
      if (!response.ok) {
        let errorMessage = "Failed to save settings";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } else {
            const text = await response.text();
            console.error("Non-JSON response:", text.substring(0, 200));
            errorMessage = "Server returned an unexpected response";
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SMS settings saved successfully. Click 'Send Test SMS' to verify and activate.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Send test SMS mutation
  const sendTestSmsMutation = useMutation({
    mutationFn: async () => {
      console.log("Sending test SMS to:", testPhoneNumber);
      const authToken = localStorage.getItem("authToken");
      console.log("Auth token exists:", !!authToken);
      
      const response = await fetch("/api/sms/test-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ 
          phoneNumber: testPhoneNumber,
          message: testMessage 
        }),
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers.get("content-type"));
      if (!response.ok) {
        let errorMessage = "Failed to send test SMS";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } else {
            const text = await response.text();
            console.error("Non-JSON response:", text.substring(0, 200));
            errorMessage = "Server returned an unexpected response. Please check your session.";
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMessage);
      }
      
      // Parse JSON response safely
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return response.json();
        } else {
          const text = await response.text();
          console.error("Non-JSON success response:", text.substring(0, 200));
          throw new Error("Server returned an unexpected response format. Please refresh and try again.");
        }
      } catch (e) {
        console.error("Error parsing success response:", e);
        throw new Error("Failed to parse server response. Please refresh the page and try again.");
      }
    },
    onSuccess: (data: any) => {
      toast({
        title: "SMS Sent",
        description: data.message || "Test SMS sent successfully",
      });
      setTestPhoneNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/sms/settings"] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to send test SMS";
      
      // Check if it's a session expiration error
      if (errorMessage.includes("unexpected response") || errorMessage.includes("session")) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        toast({
          title: "Failed to Send",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider || "sms_in_bd");
      setApiKey(settings.apiKey || "");
      setSenderId(settings.senderId || "");
      setEnableNotifications(settings.enableNotifications || false);
      setEnableAdActiveAlerts(settings.enableAdActiveAlerts ?? true);
      setIsConfigured(settings.isConfigured || false);
      setLastTestedAt(settings.lastTestedAt || null);
      setConnectionError(settings.connectionError || null);
    }
  }, [settings]);

  const handleSaveSettings = () => {
    if (!provider || !apiKey || !senderId) {
      toast({
        title: "Validation Error",
        description: "Provider, API key, and sender ID are required",
        variant: "destructive",
      });
      return;
    }
    saveSettingsMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS Notifications Settings
          </CardTitle>
          <CardDescription>
            Configure SMS service for automated text alerts to Bangladesh clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {isConfigured ? 'Configured' : 'Not Configured'}
                </p>
                {lastTestedAt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last tested: {new Date(lastTestedAt).toLocaleString()}
                  </p>
                )}
                {connectionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Error: {connectionError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="sms-provider">SMS Service Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="sms-provider" data-testid="select-sms-provider">
                  <SelectValue placeholder="Select SMS provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms_in_bd">SMS in BD (0.16-0.17 BDT/SMS)</SelectItem>
                  <SelectItem value="bd_bulk_sms">BD Bulk SMS (0.16-0.17 BDT/SMS)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose your Bangladesh SMS service provider
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sms-api-key">API Key</Label>
              <Input
                id="sms-api-key"
                type="password"
                placeholder="Enter your SMS service API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                data-testid="input-sms-api-key"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your SMS service API key for sending notifications
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-phone">Sender ID / Brand Name</Label>
              <Input
                id="sender-phone"
                type="text"
                placeholder="Your registered sender ID or brand name"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                data-testid="input-sender-id"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Note: For SMS in BD, sender ID is configured in your dashboard (enter anything here for testing)
              </p>
            </div>

            {/* Notification Options */}
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Label className="text-base font-semibold">Notification Settings</Label>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <Label htmlFor="enable-sms-notifications" className="font-medium">
                    Enable SMS Notifications
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Master toggle for all SMS notifications
                  </p>
                </div>
                <Switch
                  id="enable-sms-notifications"
                  checked={enableNotifications}
                  onCheckedChange={setEnableNotifications}
                  data-testid="switch-enable-sms-notifications"
                />
              </div>

              {enableNotifications && (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div>
                    <Label htmlFor="enable-ad-active-alerts" className="font-medium text-blue-900 dark:text-blue-100">
                      Ad Active Alerts
                    </Label>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Send SMS when ads become active in Bangladesh
                    </p>
                  </div>
                  <Switch
                    id="enable-ad-active-alerts"
                    checked={enableAdActiveAlerts}
                    onCheckedChange={setEnableAdActiveAlerts}
                    disabled={!enableNotifications}
                    data-testid="switch-enable-ad-active-alerts"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
                className="flex-1"
                data-testid="button-save-sms-settings"
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              How to Get Your API Key
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Sign up for an SMS provider (<a href="https://sms.net.bd" target="_blank" rel="noopener noreferrer" className="underline">SMS in BD</a> or <a href="https://bdbulksms.com" target="_blank" rel="noopener noreferrer" className="underline">BD Bulk SMS</a>)</li>
              <li>Go to your account dashboard and find the API Keys section</li>
              <li>Create a new API key and copy it</li>
              <li>Register your Sender ID (brand name) if required</li>
              <li>Paste the API key and Sender ID above</li>
              <li>Click "Save Settings" and then "Send Test SMS" to verify</li>
            </ol>
          </div>

          {/* Send Test SMS Section */}
          {settings && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Test SMS
              </h4>
              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                Send a test SMS to verify your SMS service is working correctly. Use Bangladesh format: +8801XXXXXXXXX or 01XXXXXXXXX
              </p>
              <div className="space-y-3">
                <Input
                  type="tel"
                  placeholder="+8801XXXXXXXXX or 01XXXXXXXXX"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  disabled={sendTestSmsMutation.isPending}
                  data-testid="input-test-sms-recipient"
                />
                <Input
                  type="text"
                  placeholder="Custom test message (optional)"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  disabled={sendTestSmsMutation.isPending}
                  data-testid="input-test-sms-message"
                />
                <Button
                  onClick={() => sendTestSmsMutation.mutate()}
                  disabled={!testPhoneNumber || sendTestSmsMutation.isPending}
                  data-testid="button-send-test-sms"
                  className="w-full"
                >
                  {sendTestSmsMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Test SMS
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientEmailNotifications() {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [enableAdAccountActivationAlerts, setEnableAdAccountActivationAlerts] = useState(false);
  const [enableAdAccountSuspensionAlerts, setEnableAdAccountSuspensionAlerts] = useState(false);
  const [enableSpendWarnings, setEnableSpendWarnings] = useState(false);
  const [spendWarningThreshold, setSpendWarningThreshold] = useState(80);

  // Fetch all clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch email settings to check if email is configured
  const { data: emailSettings } = useQuery<any>({
    queryKey: ["/api/email/settings"],
  });

  // Fetch client email preferences when a client is selected
  const { data: preferences, isLoading: preferencesLoading, refetch: refetchPreferences } = useQuery<any>({
    queryKey: ["/api/clients", selectedClientId, "email-preferences"],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const response = await fetch(`/api/clients/${selectedClientId}/email-preferences`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch preferences");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Update form when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setEnableNotifications(preferences.enableNotifications || false);
      setEnableAdAccountActivationAlerts(preferences.enableAdAccountActivationAlerts || false);
      setEnableAdAccountSuspensionAlerts(preferences.enableAdAccountSuspensionAlerts || false);
      setEnableSpendWarnings(preferences.enableSpendWarnings || false);
      setSpendWarningThreshold(preferences.spendWarningThreshold || 80);
    }
  }, [preferences]);

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("No client selected");
      
      const response = await fetch(`/api/clients/${selectedClientId}/email-preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          enableNotifications,
          enableAdAccountActivationAlerts,
          enableAdAccountSuspensionAlerts,
          enableSpendWarnings,
          spendWarningThreshold,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save preferences");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email notification preferences saved successfully",
      });
      refetchPreferences();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive",
      });
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("No client selected");
      
      const response = await fetch(`/api/clients/${selectedClientId}/email-preferences/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send test email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test email sent successfully! Check the client's inbox.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
  };

  const handleSave = () => {
    savePreferencesMutation.mutate();
  };

  const handleSendTestEmail = () => {
    sendTestEmailMutation.mutate();
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Client Email Notifications
          </CardTitle>
          <CardDescription>
            Configure email notification preferences for each client. Clients will receive automated emails for ad account status changes when enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!emailSettings?.isConfigured && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">Email Service Not Configured</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    Please configure your email settings in the "Email Settings" tab before enabling client notifications.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="client-select">Select Client</Label>
              <Select value={selectedClientId || ""} onValueChange={handleClientSelect}>
                <SelectTrigger id="client-select" data-testid="select-client">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.clientName} {client.email ? `(${client.email})` : "(No email)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClientId && selectedClient && (
              <div className="border rounded-lg p-4 space-y-6 bg-gray-50 dark:bg-gray-800/50">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{selectedClient.clientName}</h3>
                  {selectedClient.email ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4 inline mr-1" />
                      {selectedClient.email}
                    </p>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        No contact email set for this client. Please add an email address in the Clients page.
                      </p>
                    </div>
                  )}
                </div>

                {preferencesLoading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Loading preferences...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="enable-notifications" className="text-base">
                          Enable Email Notifications
                        </Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Master switch for all email notifications for this client
                        </p>
                      </div>
                      <Switch
                        id="enable-notifications"
                        checked={enableNotifications}
                        onCheckedChange={setEnableNotifications}
                        disabled={!emailSettings?.isConfigured || !selectedClient.email}
                        data-testid="switch-enable-notifications"
                      />
                    </div>

                    {enableNotifications && (
                      <>
                        <div className="border-t pt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="activation-alerts" className="text-base">
                                Ad Account Activation Alerts
                              </Label>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Send email when an ad account is activated
                              </p>
                            </div>
                            <Switch
                              id="activation-alerts"
                              checked={enableAdAccountActivationAlerts}
                              onCheckedChange={setEnableAdAccountActivationAlerts}
                              data-testid="switch-activation-alerts"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="suspension-alerts" className="text-base">
                                Ad Account Suspension Alerts
                              </Label>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Send email when an ad account is suspended
                              </p>
                            </div>
                            <Switch
                              id="suspension-alerts"
                              checked={enableAdAccountSuspensionAlerts}
                              onCheckedChange={setEnableAdAccountSuspensionAlerts}
                              data-testid="switch-suspension-alerts"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="spend-warnings" className="text-base">
                                Spend Warning Alerts
                              </Label>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Send email when ad spend reaches threshold
                              </p>
                            </div>
                            <Switch
                              id="spend-warnings"
                              checked={enableSpendWarnings}
                              onCheckedChange={setEnableSpendWarnings}
                              data-testid="switch-spend-warnings"
                            />
                          </div>

                          {enableSpendWarnings && (
                            <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                              <Label htmlFor="threshold">Spend Warning Threshold (%)</Label>
                              <Input
                                id="threshold"
                                type="number"
                                min="0"
                                max="100"
                                value={spendWarningThreshold}
                                onChange={(e) => setSpendWarningThreshold(parseInt(e.target.value) || 80)}
                                className="w-32 mt-2"
                                data-testid="input-spend-threshold"
                              />
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Alert when spend reaches {spendWarningThreshold}% of limit
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={handleSendTestEmail}
                        disabled={sendTestEmailMutation.isPending || !selectedClient.email || !emailSettings?.isConfigured}
                        data-testid="button-send-test-email"
                      >
                        {sendTestEmailMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Send Test Email
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={savePreferencesMutation.isPending || !selectedClient.email}
                        data-testid="button-save-preferences"
                      >
                        {savePreferencesMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Save Preferences
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedClientId && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Select a client to configure their email notification preferences</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-8 h-8" />
              Admin Panel
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage users, permissions, and system settings
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7 max-w-7xl">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                User Management
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Data Import/Export
              </TabsTrigger>
              <TabsTrigger value="telegram" className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </TabsTrigger>
              <TabsTrigger value="facebook" className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                FB Settings
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Settings
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                SMS Settings
              </TabsTrigger>
              <TabsTrigger value="client-email" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Client Emails
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
            
            <TabsContent value="data">
              <DataImportExport />
            </TabsContent>
            
            <TabsContent value="telegram">
              <TelegramManagement />
            </TabsContent>

            <TabsContent value="facebook">
              <FacebookSettings />
            </TabsContent>

            <TabsContent value="email">
              <EmailSettings />
            </TabsContent>

            <TabsContent value="sms">
              <SmsSettings />
            </TabsContent>

            <TabsContent value="client-email">
              <ClientEmailNotifications />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Sidebar>
  );
}