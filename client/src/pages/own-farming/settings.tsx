import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OwnFarmingSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    autoSync: true,
    syncInterval: "30",
    enableNotifications: true,
    maxAccountsPerDay: "5",
    defaultAccountStatus: "pending",
  });

  const handleSave = () => {
    // In a real app, this would save to the backend
    toast({ title: "Settings saved successfully" });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Own Farming Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your farming account preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>Manage your farming account preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Auto Sync</Label>
                <p className="text-sm text-muted-foreground">Automatically sync accounts periodically</p>
              </div>
              <Switch
                id="auto-sync"
                checked={settings.autoSync}
                onCheckedChange={(checked) => setSettings({ ...settings, autoSync: checked })}
                data-testid="switch-auto-sync"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
              <Input
                id="sync-interval"
                type="number"
                value={settings.syncInterval}
                onChange={(e) => setSettings({ ...settings, syncInterval: e.target.value })}
                data-testid="input-sync-interval"
              />
              <p className="text-sm text-muted-foreground">How often to sync accounts automatically</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>Configure how you receive updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive alerts for account status changes</p>
              </div>
              <Switch
                id="notifications"
                checked={settings.enableNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Limits</CardTitle>
            <CardDescription>Set limits for account creation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="max-accounts">Max Accounts Per Day</Label>
              <Input
                id="max-accounts"
                type="number"
                value={settings.maxAccountsPerDay}
                onChange={(e) => setSettings({ ...settings, maxAccountsPerDay: e.target.value })}
                data-testid="input-max-accounts"
              />
              <p className="text-sm text-muted-foreground">Maximum number of accounts to create daily</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-status">Default Account Status</Label>
              <select
                id="default-status"
                className="w-full p-2 border rounded-md bg-background"
                value={settings.defaultAccountStatus}
                onChange={(e) => setSettings({ ...settings, defaultAccountStatus: e.target.value })}
                data-testid="select-default-status"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="disabled">Disabled</option>
              </select>
              <p className="text-sm text-muted-foreground">Default status for newly created accounts</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-settings">
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
