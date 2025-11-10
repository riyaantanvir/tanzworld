import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import Sidebar from "@/components/layout/Sidebar";
import { Progress } from "@/components/ui/progress";
import type { GherTag, GherPartner, GherEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type DateFilterType = "custom" | "thisMonth" | "lastMonth" | "thisYear";

type DashboardStats = {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  expenseByTag: Array<{ tagId: string | null; tagName: string; amount: number; percentage: number }>;
  incomeByTag: Array<{ tagId: string | null; tagName: string; amount: number; percentage: number }>;
};

export default function GherDashboard() {
  const today = new Date();
  const [dateFilter, setDateFilter] = useState<DateFilterType>("thisYear");
  const [startDate, setStartDate] = useState(format(startOfYear(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfYear(today), "yyyy-MM-dd"));
  const [partnerId, setPartnerId] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");

  const { data: partners = [] } = useQuery<GherPartner[]>({
    queryKey: ["/api/gher/partners"],
  });

  const { data: tags = [] } = useQuery<GherTag[]>({
    queryKey: ["/api/gher/tags"],
  });

  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter);
    const today = new Date();

    switch (filter) {
      case "thisMonth":
        setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
      case "thisYear":
        setStartDate(format(startOfYear(today), "yyyy-MM-dd"));
        setEndDate(format(endOfYear(today), "yyyy-MM-dd"));
        break;
      case "custom":
        break;
    }
  };

  const buildQueryString = (params: Record<string, string>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.append(key, value);
    });
    const query = urlParams.toString();
    return query ? `?${query}` : "";
  };

  const { data: stats = { 
    totalIncome: 0, 
    totalExpense: 0, 
    netBalance: 0,
    expenseByTag: [],
    incomeByTag: [],
  } } = useQuery<DashboardStats>({
    queryKey: ["/api/gher/dashboard-stats", { startDate, endDate, partnerId }],
    queryFn: async () => {
      const queryString = buildQueryString({ startDate, endDate, partnerId });
      const response = await apiRequest("GET", `/api/gher/dashboard-stats${queryString}`);
      return response.json();
    },
    enabled: true,
  });

  const { data: allEntries = [] } = useQuery<GherEntry[]>({
    queryKey: ["/api/gher/entries", { startDate, endDate, partnerId }],
    queryFn: async () => {
      const queryString = buildQueryString({ startDate, endDate, partnerId });
      const response = await apiRequest("GET", `/api/gher/entries${queryString}`);
      return response.json();
    },
  });

  const filteredEntriesByTag = useMemo(() => {
    if (!selectedTagId) return [];
    return allEntries.filter(entry => entry.tagId === selectedTagId);
  }, [allEntries, selectedTagId]);

  const handleReset = () => {
    const resetDate = new Date();
    setDateFilter("thisYear");
    setStartDate(format(startOfYear(resetDate), "yyyy-MM-dd"));
    setEndDate(format(endOfYear(resetDate), "yyyy-MM-dd"));
    setPartnerId("");
    setSelectedTagId("");
  };

  const getTagName = (tagId: string | null) => {
    if (!tagId) return "-";
    const tag = tags.find(t => t.id === tagId);
    return tag?.name || "-";
  };

  const getPartnerName = (partId: string | null) => {
    if (!partId) return "-";
    const partner = partners.find(p => p.id === partId);
    return partner?.name || "-";
  };

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Gher Management Dashboard</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={dateFilter === "thisMonth" ? "default" : "outline"}
                  onClick={() => handleDateFilterChange("thisMonth")}
                  data-testid="button-filter-this-month"
                >
                  This Month
                </Button>
                <Button
                  variant={dateFilter === "lastMonth" ? "default" : "outline"}
                  onClick={() => handleDateFilterChange("lastMonth")}
                  data-testid="button-filter-last-month"
                >
                  Last Month
                </Button>
                <Button
                  variant={dateFilter === "thisYear" ? "default" : "outline"}
                  onClick={() => handleDateFilterChange("thisYear")}
                  data-testid="button-filter-this-year"
                >
                  This Year
                </Button>
                <Button
                  variant={dateFilter === "custom" ? "default" : "outline"}
                  onClick={() => handleDateFilterChange("custom")}
                  data-testid="button-filter-custom"
                >
                  Custom
                </Button>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateFilter("custom");
                    }}
                    className="h-9 px-3 rounded-md border"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateFilter("custom");
                    }}
                    className="h-9 px-3 rounded-md border"
                    data-testid="input-end-date"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Partner</label>
                  <Select value={partnerId || "all"} onValueChange={(value) => setPartnerId(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-48" data-testid="select-partner">
                      <SelectValue placeholder="All Partners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {partners.map(partner => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Filter by Tag</label>
                  <Select value={selectedTagId || "all"} onValueChange={(value) => setSelectedTagId(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-48" data-testid="select-tag-filter">
                      <SelectValue placeholder="All Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={handleReset} data-testid="button-reset-filters">
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="text-total-income">
                  ৳{stats.totalIncome.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-total-expense">
                  ৳{stats.totalExpense.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Net Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-semibold ${
                    stats.netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                  data-testid="text-net-balance"
                >
                  ৳{stats.netBalance.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Expense Breakdown by Tag</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.expenseByTag.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expense data available</p>
                ) : (
                  stats.expenseByTag.map(item => (
                    <div key={item.tagId || "untagged"} className="space-y-2" data-testid={`expense-tag-${item.tagId}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{item.tagName}</span>
                        <span className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold text-red-600 dark:text-red-400">
                          ৳{item.amount.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Income Breakdown by Tag</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.incomeByTag.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No income data available</p>
                ) : (
                  stats.incomeByTag.map(item => (
                    <div key={item.tagId || "untagged"} className="space-y-2" data-testid={`income-tag-${item.tagId}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{item.tagName}</span>
                        <span className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold text-green-600 dark:text-green-400">
                          ৳{item.amount.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {selectedTagId && filteredEntriesByTag.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Filtered Results: {getTagName(selectedTagId)}
                  <span className="text-sm text-muted-foreground ml-2">
                    ({filteredEntriesByTag.length} entries)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntriesByTag.map(entry => (
                      <TableRow key={entry.id} data-testid={`filtered-entry-${entry.id}`}>
                        <TableCell>{format(new Date(entry.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              entry.type === "income"
                                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                            }`}
                          >
                            {entry.type}
                          </span>
                        </TableCell>
                        <TableCell>৳{parseFloat(entry.amount).toLocaleString()}</TableCell>
                        <TableCell>{getPartnerName(entry.partnerId)}</TableCell>
                        <TableCell className="max-w-xs truncate">{entry.details || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>All Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    allEntries.map(entry => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell>{format(new Date(entry.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              entry.type === "income"
                                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                            }`}
                          >
                            {entry.type}
                          </span>
                        </TableCell>
                        <TableCell>৳{parseFloat(entry.amount).toLocaleString()}</TableCell>
                        <TableCell>{getPartnerName(entry.partnerId)}</TableCell>
                        <TableCell>{getTagName(entry.tagId)}</TableCell>
                        <TableCell className="max-w-xs truncate">{entry.details || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}
