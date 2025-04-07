import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/main";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

// Types for the component state
type OrderSummary = {
  uid: string;
  order_number: string;
  buyer_name: string;
  order_date: string;
  total_amount: number;
  currency: string;
  order_status: string;
  requires_attention: boolean;
  attention_reason?: string;
  item_count: number;
};

type InventoryAlert = {
  uid: string;
  product_uid: string;
  product_name: string;
  current_quantity: number;
  alert_type: "low_stock" | "out_of_stock" | "high_demand";
  threshold: number;
  restock_suggestion: number;
  variant_info?: string;
  primary_image_url?: string;
};

type MessageSummary = {
  uid: string;
  thread_uid: string;
  sender_name: string;
  subject: string;
  message_preview: string;
  created_at: string;
  related_to_order_uid?: string;
  related_to_product_uid?: string;
};

type ProductPerformance = {
  uid: string;
  name: string;
  total_sales: number;
  total_orders: number;
  average_rating: number;
  revenue: number;
  currency: string;
  primary_image_url?: string;
};

type DateRange = {
  startDate: string;
  endDate: string;
  preset: "today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "lastMonth" | "custom";
};

type DashboardMetrics = {
  totalSales: number;
  salesGrowth: number;
  orderCount: number;
  orderGrowth: number;
  averageOrderValue: number;
  aovGrowth: number;
  visitors: number;
  visitorGrowth: number;
  conversionRate: number;
  conversionGrowth: number;
};

type SalesChartData = {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
};

const UV_SellerDashboard: React.FC = () => {
  // Access global state
  const { user, token } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  // Component state
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([]);
  const [customerMessages, setCustomerMessages] = useState<MessageSummary[]>([]);
  const [salesChartData, setSalesChartData] = useState<SalesChartData | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly" | "quarterly" | "yearly">("weekly");
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [trafficSources, setTrafficSources] = useState<Array<{source: string, visits: number, percentage: number}>>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "inventory" | "analytics" | "messages">("overview");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "",
    endDate: "",
    preset: "last30days"
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryToUpdate, setInventoryToUpdate] = useState<{[key: string]: number}>({});
  
  // WebSocket reference
  const socketRef = useRef<Socket | null>(null);

  // Effect to fetch initial data on component mount
  useEffect(() => {
    if (!user?.companyUid) {
      setError("Seller company information not found. Please complete your profile setup.");
      return;
    }

    // Set date range based on preset
    updateDateRangeFromPreset(dateRange.preset);
    
    // Load all dashboard data
    fetchDashboardData();
    fetchRecentOrders();
    fetchInventoryAlerts();
    fetchCustomerMessages();
    fetchTopProducts();
    fetchTrafficSources();
    
    // Subscribe to real-time notifications
    subscribeToSellerNotifications();
    
    // Cleanup function to disconnect socket
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyUid]);

  // Effect to refresh data when date range or chart period changes
  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      fetchDashboardData();
      fetchSalesChartData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, chartPeriod]);

  // Function to update date range based on preset
  const updateDateRangeFromPreset = (preset: DateRange["preset"]) => {
    const today = new Date();
    let startDate = new Date();
    const endDate = new Date();
    
    switch (preset) {
      case "today":
        startDate = new Date(today.setHours(0, 0, 0, 0));
        break;
      case "yesterday":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "last7days":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "last30days":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "thisMonth":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate.setDate(0); // Last day of previous month
        break;
      case "custom":
        // Don't modify dates for custom preset
        return;
    }
    
    setDateRange({
      ...dateRange,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      preset
    });
  };

  // Fetch dashboard metrics and KPI data
  const fetchDashboardData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/api/sellers/dashboard`, {
        params: {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          company_uid: user?.companyUid
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setDashboardMetrics(response.data.metrics);
      setIsLoading(false);
      
      // Also fetch chart data when dashboard metrics are fetched
      fetchSalesChartData();
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("Failed to load dashboard metrics. Please try again.");
      setIsLoading(false);
    }
  };

  // Fetch chart data for sales visualization
  const fetchSalesChartData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/sellers/analytics/sales`, {
        params: {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          period: chartPeriod,
          company_uid: user?.companyUid
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSalesChartData(response.data.chart_data);
    } catch (err) {
      console.error("Failed to fetch sales chart data:", err);
      // Don't set global error for chart data failure
    }
  };

  // Fetch recent orders that need attention
  const fetchRecentOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/orders/recent`, {
        params: {
          company_uid: user?.companyUid,
          limit: 5
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setRecentOrders(response.data.orders);
    } catch (err) {
      console.error("Failed to fetch recent orders:", err);
      // Don't set global error for this secondary data
    }
  };

  // Fetch inventory alerts for low stock products
  const fetchInventoryAlerts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/inventory/alerts`, {
        params: {
          company_uid: user?.companyUid
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setInventoryAlerts(response.data.alerts);
    } catch (err) {
      console.error("Failed to fetch inventory alerts:", err);
      // Don't set global error for this secondary data
    }
  };

  // Fetch unread customer messages
  const fetchCustomerMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/messages/unread`, {
        params: {
          company_uid: user?.companyUid,
          limit: 5
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setCustomerMessages(response.data.messages);
    } catch (err) {
      console.error("Failed to fetch customer messages:", err);
      // Don't set global error for this secondary data
    }
  };

  // Fetch top-selling products
  const fetchTopProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/analytics/top-products`, {
        params: {
          company_uid: user?.companyUid,
          start_date: dateRange.startDate || undefined,
          end_date: dateRange.endDate || undefined,
          limit: 5
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setTopProducts(response.data.products);
    } catch (err) {
      console.error("Failed to fetch top products:", err);
      // Don't set global error for this secondary data
    }
  };

  // Fetch traffic sources breakdown
  const fetchTrafficSources = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/analytics/traffic-sources`, {
        params: {
          company_uid: user?.companyUid,
          start_date: dateRange.startDate || undefined,
          end_date: dateRange.endDate || undefined
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setTrafficSources(response.data.sources);
    } catch (err) {
      console.error("Failed to fetch traffic sources:", err);
      // Don't set global error for this secondary data
    }
  };

  // Update chart period
  const updateChartPeriod = (period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly") => {
    setChartPeriod(period);
  };

  // Update date range
  const updateDateRange = (preset: DateRange["preset"]) => {
    updateDateRangeFromPreset(preset);
  };
  
  // Handle custom date range selection
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>, field: "startDate" | "endDate") => {
    setDateRange({
      ...dateRange,
      [field]: e.target.value,
      preset: "custom"
    });
  };

  // Generate sales report
  const generateSalesReport = async (format: "pdf" | "csv" | "excel") => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/reports/sales`, {
        params: {
          company_uid: user?.companyUid,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          format
        },
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: "blob"
      });
      
      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `sales-report-${dateRange.startDate}-to-${dateRange.endDate}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to generate sales report:", err);
      setError("Failed to generate report. Please try again.");
    }
  };

  // Navigate to order details
  const handleOrderClick = (orderUid: string) => {
    navigate(`/seller/orders/${orderUid}`);
  };

  // Navigate to product editing for inventory update
  const handleInventoryAlertClick = (productUid: string) => {
    navigate(`/seller/products/${productUid}`);
  };

  // Navigate to message thread
  const handleMessageClick = (threadUid: string) => {
    navigate(`/messages/${threadUid}`);
  };

  // Export dashboard data in selected format
  const exportReports = async (reportType: string, format: "pdf" | "csv" | "excel") => {
    try {
      const response = await axios.get(`${API_URL}/api/sellers/reports/${reportType}`, {
        params: {
          company_uid: user?.companyUid,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          format
        },
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: "blob"
      });
      
      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${reportType}-report-${dateRange.startDate}-to-${dateRange.endDate}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(`Failed to generate ${reportType} report:`, err);
      setError("Failed to generate report. Please try again.");
    }
  };

  // Manually refresh all dashboard data
  const refreshData = () => {
    fetchDashboardData();
    fetchRecentOrders();
    fetchInventoryAlerts();
    fetchCustomerMessages();
    fetchTopProducts();
    fetchTrafficSources();
  };

  // Handle inventory quantity input change
  const handleInventoryChange = (productUid: string, quantity: number) => {
    setInventoryToUpdate({
      ...inventoryToUpdate,
      [productUid]: quantity
    });
  };

  // Update inventory levels for products with alerts
  const updateInventory = async (productUid: string) => {
    if (!inventoryToUpdate[productUid]) return;
    
    try {
      await axios.post(`${API_URL}/api/sellers/products/${productUid}/inventory`, {
        quantity: inventoryToUpdate[productUid]
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Remove updated product from alerts and reset input
      setInventoryAlerts(inventoryAlerts.filter(alert => alert.product_uid !== productUid));
      setInventoryToUpdate({
        ...inventoryToUpdate,
        [productUid]: 0
      });
      
      // Show success message
      setError("Inventory updated successfully.");
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error("Failed to update inventory:", err);
      setError("Failed to update inventory. Please try again.");
    }
  };

  // Subscribe to real-time notifications via WebSocket
  const subscribeToSellerNotifications = () => {
    if (!token || !user?.companyUid) return;
    
    // Create socket connection
    const socket = io(`${API_URL}/ws`, {
      auth: {
        token
      }
    });
    
    socketRef.current = socket;
    
    // Listen for seller order notifications
    socket.on(`sellers/${user.companyUid}/orders`, (data) => {
      // Add new order to the list and show notification
      setRecentOrders(prevOrders => [data, ...prevOrders.slice(0, 4)]);
    });
    
    // Listen for inventory alerts
    socket.on(`sellers/${user.companyUid}/inventory_alerts`, (data) => {
      // Add new alert to the list
      setInventoryAlerts(prevAlerts => [data, ...prevAlerts.filter(alert => alert.product_uid !== data.product_uid)]);
    });
    
    // Listen for new messages
    socket.on(`messages/new`, (data) => {
      if (data.recipient_uid === user.uid) {
        // Add new message to the list
        setCustomerMessages(prevMessages => [data, ...prevMessages.slice(0, 4)]);
      }
    });
    
    // Handle connection errors
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
  };

  // Prepare chart options for consistent styling
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  // Prepare traffic sources data for doughnut chart
  const trafficSourcesChartData = {
    labels: trafficSources.map(source => source.source),
    datasets: [
      {
        data: trafficSources.map(source => source.visits),
        backgroundColor: [
          '#4F46E5', // Indigo
          '#059669', // Green
          '#D97706', // Amber
          '#DC2626', // Red
          '#7C3AED', // Purple
          '#2563EB', // Blue
        ],
        borderWidth: 1,
      },
    ],
  };

  // Format currency for display
  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Render loading skeleton for metrics
  const renderMetricsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {Array(5).fill(0).map((_, index) => (
        <div key={index} className="bg-white p-4 rounded-lg shadow animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {/* Header and Actions Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Seller Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.firstName}! Here's an overview of your marketplace performance.</p>
          </div>
          
          {/* Date Range Selector */}
          <div className="mt-4 md:mt-0 flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <div className="flex items-center space-x-2">
              <label htmlFor="date-preset" className="text-sm font-medium text-gray-700">Date Range:</label>
              <select
                id="date-preset"
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                value={dateRange.preset}
                onChange={(e) => updateDateRange(e.target.value as DateRange["preset"])}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {dateRange.preset === "custom" && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  value={dateRange.startDate}
                  onChange={(e) => handleCustomDateChange(e, "startDate")}
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  value={dateRange.endDate}
                  onChange={(e) => handleCustomDateChange(e, "endDate")}
                />
              </div>
            )}
            
            <button
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={refreshData}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Performance Metrics Cards */}
        {isLoading ? renderMetricsSkeleton() : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Total Sales Card */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Sales</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardMetrics ? formatCurrency(dashboardMetrics.totalSales) : "-"}
              </p>
              <p className={`text-sm ${dashboardMetrics && dashboardMetrics.salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardMetrics ? formatPercentage(dashboardMetrics.salesGrowth) : ""} from previous period
              </p>
            </div>
            
            {/* Order Count Card */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardMetrics ? dashboardMetrics.orderCount : "-"}
              </p>
              <p className={`text-sm ${dashboardMetrics && dashboardMetrics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardMetrics ? formatPercentage(dashboardMetrics.orderGrowth) : ""} from previous period
              </p>
            </div>
            
            {/* Average Order Value Card */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Avg. Order Value</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardMetrics ? formatCurrency(dashboardMetrics.averageOrderValue) : "-"}
              </p>
              <p className={`text-sm ${dashboardMetrics && dashboardMetrics.aovGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardMetrics ? formatPercentage(dashboardMetrics.aovGrowth) : ""} from previous period
              </p>
            </div>
            
            {/* Visitors Card */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Product Views</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardMetrics ? dashboardMetrics.visitors.toLocaleString() : "-"}
              </p>
              <p className={`text-sm ${dashboardMetrics && dashboardMetrics.visitorGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardMetrics ? formatPercentage(dashboardMetrics.visitorGrowth) : ""} from previous period
              </p>
            </div>
            
            {/* Conversion Rate Card */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Conversion Rate</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardMetrics ? `${dashboardMetrics.conversionRate.toFixed(2)}%` : "-"}
              </p>
              <p className={`text-sm ${dashboardMetrics && dashboardMetrics.conversionGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardMetrics ? formatPercentage(dashboardMetrics.conversionGrowth) : ""} from previous period
              </p>
            </div>
          </div>
        )}
        
        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Link
            to="/seller/products/new"
            className="flex flex-col items-center justify-center bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-sm font-medium">Add New Product</span>
          </Link>
          
          <Link
            to="/seller/orders"
            className="flex flex-col items-center justify-center bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-sm font-medium">View Orders</span>
          </Link>
          
          <Link
            to="/messages"
            className="flex flex-col items-center justify-center bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-sm font-medium">Message Center</span>
          </Link>
          
          <Link
            to="/seller/promotions"
            className="flex flex-col items-center justify-center bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-sm font-medium">Manage Promotions</span>
          </Link>
        </div>
        
        {/* Main Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Alerts */}
          <div className="lg:col-span-1 space-y-6">
            {/* Recent Orders Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Orders</h2>
                <Link to="/seller/orders" className="text-sm text-indigo-600 hover:text-indigo-800">View All</Link>
              </div>
              
              <div className="divide-y divide-gray-200">
                {recentOrders.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No recent orders to display</div>
                ) : (
                  recentOrders.map((order) => (
                    <div 
                      key={order.uid}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleOrderClick(order.uid)}
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Order #{order.order_number}</p>
                          <p className="text-sm text-gray-600">{order.buyer_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(order.total_amount, order.currency)}</p>
                          <p className="text-sm text-gray-600">{new Date(order.order_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.order_status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          order.order_status === "processing" ? "bg-blue-100 text-blue-800" :
                          order.order_status === "shipped" ? "bg-purple-100 text-purple-800" :
                          order.order_status === "delivered" ? "bg-green-100 text-green-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                        </span>
                        <span className="text-sm text-gray-600">{order.item_count} {order.item_count === 1 ? "item" : "items"}</span>
                      </div>
                      {order.requires_attention && (
                        <div className="mt-2">
                          <p className="text-sm text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {order.attention_reason || "Requires attention"}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Inventory Alerts Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Inventory Alerts</h2>
                <Link to="/seller/products" className="text-sm text-indigo-600 hover:text-indigo-800">Manage Inventory</Link>
              </div>
              
              <div className="divide-y divide-gray-200">
                {inventoryAlerts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No inventory alerts to display</div>
                ) : (
                  inventoryAlerts.map((alert) => (
                    <div key={alert.uid} className="p-4">
                      <div className="flex items-start">
                        {alert.primary_image_url ? (
                          <img src={alert.primary_image_url} alt={alert.product_name} className="h-10 w-10 rounded object-cover mr-3" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-200 mr-3 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 cursor-pointer hover:text-indigo-600" onClick={() => handleInventoryAlertClick(alert.product_uid)}>
                            {alert.product_name}
                          </p>
                          {alert.variant_info && (
                            <p className="text-sm text-gray-600">{alert.variant_info}</p>
                          )}
                          <div className="mt-1 flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              alert.alert_type === "out_of_stock" ? "bg-red-100 text-red-800" :
                              alert.alert_type === "low_stock" ? "bg-yellow-100 text-yellow-800" :
                              "bg-blue-100 text-blue-800"
                            }`}>
                              {alert.alert_type === "out_of_stock" ? "Out of Stock" :
                               alert.alert_type === "low_stock" ? "Low Stock" : "High Demand"}
                            </span>
                            <span className="ml-2 text-sm text-gray-600">
                              {alert.current_quantity} in stock
                              {alert.alert_type === "low_stock" && ` (below ${alert.threshold})`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center">
                        <input
                          type="number"
                          min="0"
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                          placeholder="Add quantity"
                          value={inventoryToUpdate[alert.product_uid] || ""}
                          onChange={(e) => handleInventoryChange(alert.product_uid, parseInt(e.target.value) || 0)}
                        />
                        <button
                          className="ml-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => updateInventory(alert.product_uid)}
                          disabled={!inventoryToUpdate[alert.product_uid]}
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Customer Messages Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Customer Messages</h2>
                <Link to="/messages" className="text-sm text-indigo-600 hover:text-indigo-800">View All</Link>
              </div>
              
              <div className="divide-y divide-gray-200">
                {customerMessages.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No unread messages to display</div>
                ) : (
                  customerMessages.map((message) => (
                    <div 
                      key={message.uid}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleMessageClick(message.thread_uid)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{message.subject || "New Message"}</p>
                          <p className="text-sm text-gray-600">From: {message.sender_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{new Date(message.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{message.message_preview}</p>
                      {(message.related_to_order_uid || message.related_to_product_uid) && (
                        <div className="mt-2">
                          {message.related_to_order_uid && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                              Order Related
                            </span>
                          )}
                          {message.related_to_product_uid && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Product Related
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Center and Right Columns - Charts and Analytics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sales Chart Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Sales Performance</h2>
                  <div className="flex items-center space-x-2">
                    <button
                      className={`px-3 py-1 text-xs font-medium rounded-md ${chartPeriod === "daily" ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-800"}`}
                      onClick={() => updateChartPeriod("daily")}
                    >
                      Daily
                    </button>
                    <button
                      className={`px-3 py-1 text-xs font-medium rounded-md ${chartPeriod === "weekly" ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-800"}`}
                      onClick={() => updateChartPeriod("weekly")}
                    >
                      Weekly
                    </button>
                    <button
                      className={`px-3 py-1 text-xs font-medium rounded-md ${chartPeriod === "monthly" ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-800"}`}
                      onClick={() => updateChartPeriod("monthly")}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="h-80">
                  {salesChartData ? (
                    <Line options={chartOptions} data={salesChartData} />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-500">No sales data available for the selected period.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Top Products and Traffic Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Products Section */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Top Products</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {topProducts.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No product data available</div>
                  ) : (
                    topProducts.map((product, index) => (
                      <div key={product.uid} className="p-4 flex items-start">
                        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-800 font-medium text-sm mr-3">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link to={`/seller/products/${product.uid}`} className="block font-medium text-gray-900 truncate hover:text-indigo-600">
                            {product.name}
                          </Link>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm text-gray-600">{product.total_orders} orders</span>
                            <span className="font-medium text-gray-900">{formatCurrency(product.revenue, product.currency)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Traffic Sources Section */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Traffic Sources</h2>
                </div>
                <div className="p-4">
                  {trafficSources.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-gray-500">No traffic data available</div>
                  ) : (
                    <>
                      <div className="h-40">
                        <Doughnut data={trafficSourcesChartData} options={{ ...chartOptions, cutout: '70%' }} />
                      </div>
                      <div className="mt-4">
                        <ul className="space-y-2">
                          {trafficSources.map((source) => (
                            <li key={source.source} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className={`inline-block h-3 w-3 rounded-full mr-2`} style={{ 
                                  backgroundColor: trafficSourcesChartData.datasets[0].backgroundColor[
                                    trafficSources.findIndex(s => s.source === source.source) % 
                                    trafficSourcesChartData.datasets[0].backgroundColor.length
                                  ]
                                }}></span>
                                <span className="text-sm text-gray-600">{source.source}</span>
                              </div>
                              <div className="flex space-x-2">
                                <span className="text-sm font-medium text-gray-900">{source.visits.toLocaleString()}</span>
                                <span className="text-sm text-gray-500">({source.percentage.toFixed(1)}%)</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Order Status Summary */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Order Status</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link
                    to="/seller/orders?status=pending"
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors"
                  >
                    <p className="text-xl font-bold text-yellow-700">
                      {recentOrders.filter(order => order.order_status === "pending").length}
                    </p>
                    <p className="text-sm text-yellow-700">Pending</p>
                  </Link>
                  
                  <Link
                    to="/seller/orders?status=processing"
                    className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
                  >
                    <p className="text-xl font-bold text-blue-700">
                      {recentOrders.filter(order => order.order_status === "processing").length}
                    </p>
                    <p className="text-sm text-blue-700">Processing</p>
                  </Link>
                  
                  <Link
                    to="/seller/orders?status=shipped"
                    className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors"
                  >
                    <p className="text-xl font-bold text-purple-700">
                      {recentOrders.filter(order => order.order_status === "shipped").length}
                    </p>
                    <p className="text-sm text-purple-700">Shipped</p>
                  </Link>
                  
                  <Link
                    to="/seller/orders?status=delivered"
                    className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
                  >
                    <p className="text-xl font-bold text-green-700">
                      {recentOrders.filter(order => order.order_status === "delivered").length}
                    </p>
                    <p className="text-sm text-green-700">Delivered</p>
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Export Reports Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Export Reports</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Sales Report</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => generateSalesReport("pdf")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => generateSalesReport("csv")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => generateSalesReport("excel")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Excel
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Inventory Report</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => exportReports("inventory", "pdf")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => exportReports("inventory", "csv")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => exportReports("inventory", "excel")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Excel
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Customer Report</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => exportReports("customers", "pdf")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => exportReports("customers", "csv")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => exportReports("customers", "excel")}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Excel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SellerDashboard;