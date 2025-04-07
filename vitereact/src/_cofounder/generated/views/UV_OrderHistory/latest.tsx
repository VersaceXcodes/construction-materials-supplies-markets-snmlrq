import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { useAppSelector } from "@/store/main";
import { format, parseISO } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const UV_OrderHistory: React.FC = () => {
  const { order_uid } = useParams<{ order_uid?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get params from URL
  const statusParam = searchParams.get("status") || null;
  const pageParam = parseInt(searchParams.get("page") || "1");
  const limitParam = parseInt(searchParams.get("limit") || "10");
  
  // Global state
  const { isAuthenticated, token, user } = useAppSelector((state) => state.auth);
  const { cartUid } = useAppSelector((state) => state.cart);
  
  // Local state
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderFilters, setOrderFilters] = useState({
    status: statusParam,
    dateRange: {
      from: null as Date | null,
      to: null as Date | null
    },
    search: null as string | null
  });
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 0,
    currentPage: pageParam,
    limit: limitParam
  });
  const [returnRequestData, setReturnRequestData] = useState({
    orderItemUids: [] as string[],
    reason: "",
    condition: "",
    comments: "",
    returnMethod: "shipping_label"
  });
  const [trackingInfo, setTrackingInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showTrackingDetails, setShowTrackingDetails] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'tracking' | 'returns'>('details');

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (isAuthenticated && token) {
      const newSocket = io("http://localhost:1337/ws", {
        auth: { token }
      });
      
      setSocket(newSocket);
      
      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, token]);

  // Subscribe to updates for the selected order
  useEffect(() => {
    if (socket && selectedOrder) {
      socket.emit("join_order", { order_uid: selectedOrder.uid });
      
      socket.on("order_status_update", (update: any) => {
        if (update.order_uid === selectedOrder.uid) {
          // Update the order status in real-time
          setSelectedOrder(prev => ({
            ...prev,
            order_status: update.new_status,
            status_history: [
              { 
                status: update.new_status, 
                timestamp: update.updated_at, 
                note: update.note || "Status updated" 
              },
              ...(prev.status_history || [])
            ]
          }));
          
          // Also update in the orders list
          setOrders(prev => 
            prev.map(order => 
              order.uid === update.order_uid 
                ? { ...order, order_status: update.new_status } 
                : order
            )
          );
        }
      });
      
      socket.on("delivery_update", (update: any) => {
        if (update.order_uid === selectedOrder.uid) {
          setTrackingInfo(prev => prev ? {
            ...prev,
            status: update.update_type,
            estimatedDelivery: update.estimated_delivery,
            trackingHistory: [
              {
                status: update.update_type,
                location: update.location || "N/A",
                timestamp: update.updated_at,
                description: update.notes || `Package ${update.update_type}`
              },
              ...(prev.trackingHistory || [])
            ]
          } : null);
        }
      });
      
      return () => {
        socket.off("order_status_update");
        socket.off("delivery_update");
      };
    }
  }, [socket, selectedOrder]);

  // Fetch orders when component mounts or filters change
  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    
    try {
      let url = `http://localhost:1337/api/orders?page=${pagination.currentPage}&limit=${pagination.limit}`;
      
      if (orderFilters.status) {
        url += `&status=${orderFilters.status}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setOrders(response.data.orders);
      setPagination({
        totalItems: response.data.pagination.total_items,
        totalPages: response.data.pagination.total_pages,
        currentPage: response.data.pagination.current_page,
        limit: response.data.pagination.limit
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token, pagination.currentPage, pagination.limit, orderFilters.status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch order details when order_uid changes
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!order_uid || !isAuthenticated) return;
      
      setIsLoading(true);
      
      try {
        const response = await axios.get(`http://localhost:1337/api/orders/${order_uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setSelectedOrder(response.data.order);
        
        // Check if we need to switch to tracking tab based on URL
        if (searchParams.get("tab") === "tracking") {
          setActiveTab("tracking");
          fetchTrackingInfo(response.data.order);
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [order_uid, isAuthenticated, token, searchParams]);

  // Fetch tracking info
  const fetchTrackingInfo = async (order: any) => {
    if (!order || !order.tracking_number) return;
    
    setIsLoading(true);
    
    try {
      // In a real app, you would call a tracking API endpoint
      // This is a mock implementation for demonstration
      setTrackingInfo({
        carrier: order.shipping_method || "Standard Shipping",
        trackingNumber: order.tracking_number,
        status: order.order_status === "delivered" ? "delivered" : "in_transit",
        estimatedDelivery: order.estimated_delivery_date,
        trackingUrl: `https://track.carrier.com/${order.tracking_number}`,
        trackingHistory: [
          {
            status: order.order_status === "delivered" ? "delivered" : "in_transit",
            location: "Distribution Center",
            timestamp: new Date().toISOString(),
            description: order.order_status === "delivered" 
              ? "Package delivered" 
              : "Package in transit to destination"
          },
          {
            status: "shipped",
            location: "Shipping Center",
            timestamp: order.updated_at,
            description: "Package shipped"
          }
        ]
      });
    } catch (error) {
      console.error("Error fetching tracking info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update filters
  const handleFilterChange = (filterType: string, value: any) => {
    const newFilters = { ...orderFilters, [filterType]: value };
    setOrderFilters(newFilters);
    
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    
    // Update URL params
    if (filterType === "status") {
      if (value) {
        searchParams.set("status", value);
      } else {
        searchParams.delete("status");
      }
      setSearchParams(searchParams);
    }
  };

  // Handle pagination change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    searchParams.set("page", newPage.toString());
    setSearchParams(searchParams);
  };

  // Reset filters
  const resetFilters = () => {
    setOrderFilters({
      status: null,
      dateRange: { from: null, to: null },
      search: null
    });
    
    // Update URL by removing filter params
    searchParams.delete("status");
    setSearchParams(searchParams);
  };

  // Handle order selection
  const handleOrderSelect = (order: any) => {
    navigate(`/account/orders/${order.uid}`);
  };

  // Handle tab change
  const handleTabChange = (tab: 'details' | 'tracking' | 'returns') => {
    setActiveTab(tab);
    
    if (tab === "tracking" && selectedOrder && !trackingInfo) {
      fetchTrackingInfo(selectedOrder);
    }
    
    if (tab === "returns") {
      setShowReturnForm(true);
    } else {
      setShowReturnForm(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    
    if (window.confirm("Are you sure you want to cancel this order?")) {
      setIsSubmitting(true);
      
      try {
        await axios.put(
          `http://localhost:1337/api/orders/${selectedOrder.uid}/status`,
          { status: "cancelled", note: "Cancelled by customer" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Order status will be updated by WebSocket event
      } catch (error) {
        console.error("Error cancelling order:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Download invoice
  const handleDownloadInvoice = async () => {
    if (!selectedOrder) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await axios.get(
        `http://localhost:1337/api/orders/${selectedOrder.uid}/invoice`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${selectedOrder.order_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading invoice:", error);
      alert("Failed to download invoice. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reorder items
  const handleReorderItems = async () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      // Add each item to cart
      for (const item of selectedOrder.items) {
        await axios.post(
          "http://localhost:1337/api/cart/items",
          {
            product_uid: item.product_uid,
            variant_uid: item.variant_uid,
            quantity: item.quantity
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      // Navigate to cart
      navigate("/cart");
    } catch (error) {
      console.error("Error reordering items:", error);
      alert("Some items could not be added to your cart. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle return item selection
  const handleReturnItemSelect = (item_uid: string, isSelected: boolean) => {
    if (isSelected) {
      setReturnRequestData(prev => ({
        ...prev,
        orderItemUids: [...prev.orderItemUids, item_uid]
      }));
    } else {
      setReturnRequestData(prev => ({
        ...prev,
        orderItemUids: prev.orderItemUids.filter(id => id !== item_uid)
      }));
    }
  };

  // Submit return request
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOrder) return;
    if (returnRequestData.orderItemUids.length === 0) {
      alert("Please select at least one item to return");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await axios.post(
        `http://localhost:1337/api/orders/${selectedOrder.uid}/returns`,
        returnRequestData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert("Return request submitted successfully");
      setShowReturnForm(false);
      setReturnRequestData({
        orderItemUids: [],
        reason: "",
        condition: "",
        comments: "",
        returnMethod: "shipping_label"
      });
      
      // Refresh order details
      const response = await axios.get(
        `http://localhost:1337/api/orders/${selectedOrder.uid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedOrder(response.data.order);
    } catch (error) {
      console.error("Error submitting return request:", error);
      alert("Failed to submit return request. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contact seller
  const handleContactSeller = () => {
    if (!selectedOrder) return;
    
    // Navigate to messages with pre-filled data
    navigate(`/messages?order=${selectedOrder.uid}`);
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    let bgColor = "bg-gray-200";
    let textColor = "text-gray-800";
    
    switch (status) {
      case "pending":
        bgColor = "bg-blue-100";
        textColor = "text-blue-800";
        break;
      case "processing":
        bgColor = "bg-purple-100";
        textColor = "text-purple-800";
        break;
      case "shipped":
        bgColor = "bg-yellow-100";
        textColor = "text-yellow-800";
        break;
      case "delivered":
        bgColor = "bg-green-100";
        textColor = "text-green-800";
        break;
      case "cancelled":
        bgColor = "bg-red-100";
        textColor = "text-red-800";
        break;
      case "returned":
        bgColor = "bg-orange-100";
        textColor = "text-orange-800";
        break;
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return format(parseISO(dateString), "MMM d, yyyy");
    } catch (e) {
      return "Invalid date";
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(amount);
  };

  // Check if order is eligible for cancellation
  const isEligibleForCancellation = (order: any) => {
    return order && ["pending", "processing"].includes(order.order_status);
  };

  // Check if order is eligible for return
  const isEligibleForReturn = (order: any) => {
    if (!order || !order.order_date) return false;
    
    // Check if order is delivered and within 30 days
    const orderDate = new Date(order.order_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return order.order_status === "delivered" && orderDate > thirtyDaysAgo;
  };

  return (
    <>
      <div className="bg-white">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-5">
            <h1 className="text-2xl font-semibold text-gray-900">Order History</h1>
            
            {/* Only show filters in list view */}
            {!order_uid && (
              <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
                <div className="flex-grow sm:flex-grow-0">
                  <label htmlFor="status-filter" className="sr-only">Filter by status</label>
                  <select
                    id="status-filter"
                    value={orderFilters.status || ""}
                    onChange={(e) => handleFilterChange("status", e.target.value || null)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>
                
                <div className="flex-grow sm:flex-grow-0 flex gap-2">
                  <div>
                    <label htmlFor="date-from" className="sr-only">From Date</label>
                    <DatePicker
                      id="date-from"
                      selected={orderFilters.dateRange.from}
                      onChange={(date) => handleFilterChange("dateRange", { ...orderFilters.dateRange, from: date })}
                      placeholderText="From Date"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="date-to" className="sr-only">To Date</label>
                    <DatePicker
                      id="date-to"
                      selected={orderFilters.dateRange.to}
                      onChange={(date) => handleFilterChange("dateRange", { ...orderFilters.dateRange, to: date })}
                      placeholderText="To Date"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex-grow sm:flex-grow-0">
                  <label htmlFor="search-filter" className="sr-only">Search orders</label>
                  <input
                    type="text"
                    id="search-filter"
                    placeholder="Search order #, product..."
                    value={orderFilters.search || ""}
                    onChange={(e) => handleFilterChange("search", e.target.value || null)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Reset
                </button>
              </div>
            )}
            
            {/* Back button in detail view */}
            {order_uid && (
              <Link 
                to="/account/orders"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Back to Orders
              </Link>
            )}
          </div>
          
          {isLoading && !selectedOrder && (
            <div className="py-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
              <p className="mt-3 text-gray-500">Loading your orders...</p>
            </div>
          )}
          
          {/* List View */}
          {!isLoading && !selectedOrder && (
            <>
              {orders.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-gray-500">You haven't placed any orders yet.</p>
                  <Link 
                    to="/"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Continue Shopping
                  </Link>
                </div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block mt-8 overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Items
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map((order) => (
                          <tr 
                            key={order.uid} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleOrderSelect(order)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                              {order.order_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(order.order_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(order.total_amount, order.currency)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {renderStatusBadge(order.order_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOrderSelect(order);
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                View Details
                              </button>
                              {order.tracking_number && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/account/orders/${order.uid}?tab=tracking`);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Track
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Mobile View */}
                  <div className="md:hidden space-y-4 mt-4">
                    {orders.map((order) => (
                      <div 
                        key={order.uid}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
                        onClick={() => handleOrderSelect(order)}
                      >
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-blue-600">{order.order_number}</p>
                            <p className="text-xs text-gray-500">{formatDate(order.order_date)}</p>
                          </div>
                          <div>
                            {renderStatusBadge(order.order_status)}
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-500">Items:</span>
                            <span className="text-sm text-gray-900">{order.item_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Total:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(order.total_amount, order.currency)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50 flex justify-between">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOrderSelect(order);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                          {order.tracking_number && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/account/orders/${order.uid}?tab=tracking`);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-900"
                            >
                              Track Shipment
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="mt-6 flex justify-center">
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
                          disabled={pagination.currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                            pagination.currentPage === 1 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          Previous
                        </button>
                        
                        {[...Array(pagination.totalPages)].map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => handlePageChange(idx + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pagination.currentPage === idx + 1
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                        
                        <button
                          onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                          disabled={pagination.currentPage === pagination.totalPages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                            pagination.currentPage === pagination.totalPages 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          
          {/* Detail View */}
          {selectedOrder && (
            <div className="mt-6">
              {isLoading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
                  <p className="mt-3 text-gray-500">Loading order details...</p>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Order #{selectedOrder.order_number}
                      </h2>
                      <p className="text-sm text-gray-500">Placed on {formatDate(selectedOrder.order_date)}</p>
                    </div>
                    
                    <div className="mt-3 sm:mt-0 flex flex-wrap gap-2">
                      {isEligibleForCancellation(selectedOrder) && (
                        <button
                          type="button"
                          onClick={handleCancelOrder}
                          disabled={isSubmitting}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          {isSubmitting ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        disabled={isSubmitting}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {isSubmitting ? 'Downloading...' : 'Download Invoice'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleReorderItems}
                        disabled={isSubmitting}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {isSubmitting ? 'Processing...' : 'Reorder Items'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-b border-gray-200 py-4 flex overflow-x-auto">
                    <div className="border-b border-transparent px-1 py-2 whitespace-nowrap text-sm font-medium mr-8">
                      <span className="text-gray-500">Status:</span>{' '}
                      {renderStatusBadge(selectedOrder.order_status)}
                    </div>
                    
                    {selectedOrder.payment_method && (
                      <div className="border-b border-transparent px-1 py-2 whitespace-nowrap text-sm font-medium mr-8">
                        <span className="text-gray-500">Payment:</span>{' '}
                        <span className="text-gray-900">{selectedOrder.payment_method}</span>
                      </div>
                    )}
                    
                    {selectedOrder.tracking_number && (
                      <div className="border-b border-transparent px-1 py-2 whitespace-nowrap text-sm font-medium mr-8">
                        <span className="text-gray-500">Tracking:</span>{' '}
                        <span className="text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => handleTabChange('tracking')}>
                          {selectedOrder.tracking_number}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Tabs */}
                  <div className="border-b border-gray-200 mt-6">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                      <button
                        onClick={() => handleTabChange('details')}
                        className={`${
                          activeTab === 'details'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                      >
                        Order Details
                      </button>
                      
                      {selectedOrder.tracking_number && (
                        <button
                          onClick={() => handleTabChange('tracking')}
                          className={`${
                            activeTab === 'tracking'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                          Shipment Tracking
                        </button>
                      )}
                      
                      {isEligibleForReturn(selectedOrder) && (
                        <button
                          onClick={() => handleTabChange('returns')}
                          className={`${
                            activeTab === 'returns'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                          Returns
                        </button>
                      )}
                    </nav>
                  </div>
                  
                  {/* Tab Content */}
                  <div className="mt-6">
                    {/* Order Details Tab */}
                    {activeTab === 'details' && (
                      <div>
                        {/* Order Items */}
                        <div className="mb-8">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Items in Your Order</h3>
                          
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="divide-y divide-gray-200">
                              {selectedOrder.items && selectedOrder.items.map((item: any) => (
                                <div key={item.uid} className="p-6 flex items-center">
                                  <div className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-lg overflow-hidden">
                                    {item.primary_image_url ? (
                                      <img
                                        src={item.primary_image_url}
                                        alt={item.product_name}
                                        className="w-full h-full object-center object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        No image
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="ml-6 flex-1">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-900">{item.product_name}</h4>
                                        {item.variant_type && (
                                          <p className="mt-1 text-sm text-gray-500">{item.variant_type}: {item.variant_value}</p>
                                        )}
                                        <p className="mt-1 text-sm text-gray-500">Quantity: {item.quantity}</p>
                                      </div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {formatCurrency(item.unit_price)} each
                                      </p>
                                    </div>
                                    
                                    <div className="mt-2 flex items-center text-sm text-gray-500">
                                      <p>Sold by: {item.seller_name}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Order Summary */}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
                            
                            <div className="bg-gray-50 rounded-lg p-6">
                              <dl className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <dt className="text-sm text-gray-600">Subtotal</dt>
                                  <dd className="text-sm font-medium text-gray-900">{formatCurrency(selectedOrder.subtotal)}</dd>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <dt className="text-sm text-gray-600">Shipping</dt>
                                  <dd className="text-sm font-medium text-gray-900">{formatCurrency(selectedOrder.shipping_amount)}</dd>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <dt className="text-sm text-gray-600">Tax</dt>
                                  <dd className="text-sm font-medium text-gray-900">{formatCurrency(selectedOrder.tax_amount)}</dd>
                                </div>
                                
                                {selectedOrder.discount_amount > 0 && (
                                  <div className="flex items-center justify-between">
                                    <dt className="text-sm text-gray-600">Discount</dt>
                                    <dd className="text-sm font-medium text-green-600">-{formatCurrency(selectedOrder.discount_amount)}</dd>
                                  </div>
                                )}
                                
                                <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                                  <dt className="text-base font-medium text-gray-900">Order Total</dt>
                                  <dd className="text-base font-medium text-gray-900">{formatCurrency(selectedOrder.total_amount)}</dd>
                                </div>
                              </dl>
                            </div>
                          </div>
                          
                          {/* Shipping & Billing */}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping & Billing Information</h3>
                            
                            <div className="bg-gray-50 rounded-lg p-6">
                              <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900">Shipping Address</h4>
                                  <div className="mt-1 text-sm text-gray-500">
                                    <p>{selectedOrder.shipping_recipient}</p>
                                    <p>{selectedOrder.shipping_street_address_1}</p>
                                    {selectedOrder.shipping_street_address_2 && (
                                      <p>{selectedOrder.shipping_street_address_2}</p>
                                    )}
                                    <p>
                                      {selectedOrder.shipping_city}, {selectedOrder.shipping_state} {selectedOrder.shipping_postal_code}
                                    </p>
                                    <p>{selectedOrder.shipping_country}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900">Billing Address</h4>
                                  <div className="mt-1 text-sm text-gray-500">
                                    <p>{selectedOrder.billing_recipient}</p>
                                    <p>{selectedOrder.billing_street_address_1}</p>
                                    {selectedOrder.billing_street_address_2 && (
                                      <p>{selectedOrder.billing_street_address_2}</p>
                                    )}
                                    <p>
                                      {selectedOrder.billing_city}, {selectedOrder.billing_state} {selectedOrder.billing_postal_code}
                                    </p>
                                    <p>{selectedOrder.billing_country}</p>
                                  </div>
                                </div>
                                
                                <div className="sm:col-span-2 border-t border-gray-200 pt-4">
                                  <h4 className="text-sm font-medium text-gray-900">Shipping Method</h4>
                                  <p className="mt-1 text-sm text-gray-500">{selectedOrder.shipping_method || "Standard Shipping"}</p>
                                  
                                  {selectedOrder.special_instructions && (
                                    <>
                                      <h4 className="mt-4 text-sm font-medium text-gray-900">Special Instructions</h4>
                                      <p className="mt-1 text-sm text-gray-500">{selectedOrder.special_instructions}</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Status History Timeline */}
                        {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
                          <div className="mt-8">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Order Status Timeline</h3>
                            
                            <div className="flow-root">
                              <ul className="-mb-8">
                                {selectedOrder.status_history.map((event: any, eventIdx: number) => (
                                  <li key={eventIdx}>
                                    <div className="relative pb-8">
                                      {eventIdx !== selectedOrder.status_history.length - 1 ? (
                                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                                      ) : null}
                                      <div className="relative flex space-x-3">
                                        <div>
                                          <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white bg-blue-500">
                                            <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                          <div>
                                            <p className="text-sm text-gray-500">
                                              Order <span className="font-medium text-gray-900">{event.status}</span>
                                            </p>
                                            {event.note && (
                                              <p className="mt-1 text-sm text-gray-500">{event.note}</p>
                                            )}
                                          </div>
                                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                            {formatDate(event.timestamp)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                        
                        {/* Contact Seller */}
                        <div className="mt-8 border-t border-gray-200 pt-8">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">Need help with this order?</h3>
                            <button
                              type="button"
                              onClick={handleContactSeller}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Contact Seller
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Tracking Tab */}
                    {activeTab === 'tracking' && (
                      <div>
                        {isLoading ? (
                          <div className="py-20 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
                            <p className="mt-3 text-gray-500">Loading tracking information...</p>
                          </div>
                        ) : trackingInfo ? (
                          <div>
                            <div className="bg-gray-50 rounded-lg p-6 mb-8">
                              <div className="grid grid-cols-1 gap-y-6 md:grid-cols-2 md:gap-x-4">
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">Carrier</h3>
                                  <p className="mt-1 text-sm text-gray-500">{trackingInfo.carrier}</p>
                                </div>
                                
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">Tracking Number</h3>
                                  <p className="mt-1 text-sm text-gray-500">{trackingInfo.trackingNumber}</p>
                                </div>
                                
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">Current Status</h3>
                                  <p className="mt-1 text-sm font-medium text-blue-600">
                                    {trackingInfo.status.charAt(0).toUpperCase() + trackingInfo.status.slice(1).replace('_', ' ')}
                                  </p>
                                </div>
                                
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">Estimated Delivery</h3>
                                  <p className="mt-1 text-sm text-gray-500">
                                    {trackingInfo.estimatedDelivery ? formatDate(trackingInfo.estimatedDelivery) : 'Not available'}
                                  </p>
                                </div>
                                
                                {trackingInfo.trackingUrl && (
                                  <div className="md:col-span-2">
                                    <a
                                      href={trackingInfo.trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      Track on Carrier Website
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Tracking History */}
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Tracking History</h3>
                            
                            <div className="flow-root">
                              <ul className="-mb-8">
                                {trackingInfo.trackingHistory.map((event: any, eventIdx: number) => (
                                  <li key={eventIdx}>
                                    <div className="relative pb-8">
                                      {eventIdx !== trackingInfo.trackingHistory.length - 1 ? (
                                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                                      ) : null}
                                      <div className="relative flex space-x-3">
                                        <div>
                                          <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white bg-blue-500">
                                            <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11a1 1 0 11-2 0 1 1 0 012 0zm-1-3a1 1 0 00-1 1v.5a.5.5 0 001 0V11a1 1 0 10-1-1z" clipRule="evenodd" />
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                          <div>
                                            <p className="text-sm text-gray-500">
                                              <span className="font-medium text-gray-900">
                                                {event.status.charAt(0).toUpperCase() + event.status.slice(1).replace('_', ' ')}
                                              </span>
                                              {event.location && ` - ${event.location}`}
                                            </p>
                                            <p className="mt-1 text-sm text-gray-500">{event.description}</p>
                                          </div>
                                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                            {formatDate(event.timestamp)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="py-10 text-center">
                            <p className="text-gray-500">No tracking information available for this order yet.</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Returns Tab */}
                    {activeTab === 'returns' && (
                      <div>
                        {isEligibleForReturn(selectedOrder) ? (
                          <div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                              <div className="flex">
                                <div className="flex-shrink-0">
                                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="ml-3 flex-1 md:flex md:justify-between">
                                  <p className="text-sm text-blue-700">
                                    Items are eligible for return within 30 days of delivery. Please select the items you wish to return below.
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <form onSubmit={handleReturnSubmit}>
                              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Items to Return</h3>
                              
                              <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                                <div className="divide-y divide-gray-200">
                                  {selectedOrder.items && selectedOrder.items.map((item: any) => (
                                    <div key={item.uid} className="p-6 flex items-center">
                                      <div className="mr-4">
                                        <input
                                          type="checkbox"
                                          id={`return-item-${item.uid}`}
                                          name={`return-item-${item.uid}`}
                                          checked={returnRequestData.orderItemUids.includes(item.uid)}
                                          onChange={(e) => handleReturnItemSelect(item.uid, e.target.checked)}
                                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                      </div>
                                      
                                      <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                                        {item.primary_image_url ? (
                                          <img
                                            src={item.primary_image_url}
                                            alt={item.product_name}
                                            className="w-full h-full object-center object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                                            No image
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="ml-6 flex-1">
                                        <h4 className="text-sm font-medium text-gray-900">{item.product_name}</h4>
                                        {item.variant_type && (
                                          <p className="mt-1 text-sm text-gray-500">{item.variant_type}: {item.variant_value}</p>
                                        )}
                                        <p className="mt-1 text-sm text-gray-500">Quantity: {item.quantity}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="space-y-6">
                                <div>
                                  <label htmlFor="return-reason" className="block text-sm font-medium text-gray-700">
                                    Reason for Return
                                  </label>
                                  <select
                                    id="return-reason"
                                    name="return-reason"
                                    required
                                    value={returnRequestData.reason}
                                    onChange={(e) => setReturnRequestData({ ...returnRequestData, reason: e.target.value })}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                  >
                                    <option value="">Select a reason</option>
                                    <option value="defective">Item is defective/damaged</option>
                                    <option value="wrong_item">Received wrong item</option>
                                    <option value="not_as_described">Not as described</option>
                                    <option value="no_longer_needed">No longer needed</option>
                                    <option value="better_price">Found better price elsewhere</option>
                                    <option value="other">Other reason</option>
                                  </select>
                                </div>
                                
                                <div>
                                  <label htmlFor="item-condition" className="block text-sm font-medium text-gray-700">
                                    Item Condition
                                  </label>
                                  <select
                                    id="item-condition"
                                    name="item-condition"
                                    required
                                    value={returnRequestData.condition}
                                    onChange={(e) => setReturnRequestData({ ...returnRequestData, condition: e.target.value })}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                  >
                                    <option value="">Select condition</option>
                                    <option value="unopened">Unopened/unused</option>
                                    <option value="opened">Opened but unused</option>
                                    <option value="used">Used</option>
                                    <option value="damaged">Damaged</option>
                                  </select>
                                </div>
                                
                                <div>
                                  <label htmlFor="return-comments" className="block text-sm font-medium text-gray-700">
                                    Additional Comments
                                  </label>
                                  <textarea
                                    id="return-comments"
                                    name="return-comments"
                                    rows={3}
                                    value={returnRequestData.comments}
                                    onChange={(e) => setReturnRequestData({ ...returnRequestData, comments: e.target.value })}
                                    className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border border-gray-300 rounded-md"
                                    placeholder="Please provide any additional details about your return request"
                                  ></textarea>
                                </div>
                                
                                <div>
                                  <label htmlFor="return-method" className="block text-sm font-medium text-gray-700">
                                    Return Method
                                  </label>
                                  <div className="mt-2 space-y-4">
                                    <div className="flex items-center">
                                      <input
                                        id="return-method-shipping-label"
                                        name="return-method"
                                        type="radio"
                                        checked={returnRequestData.returnMethod === "shipping_label"}
                                        onChange={() => setReturnRequestData({ ...returnRequestData, returnMethod: "shipping_label" })}
                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                                      />
                                      <label htmlFor="return-method-shipping-label" className="ml-3 block text-sm font-medium text-gray-700">
                                        Prepaid Shipping Label (We'll email you a shipping label)
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        id="return-method-dropoff"
                                        name="return-method"
                                        type="radio"
                                        checked={returnRequestData.returnMethod === "dropoff"}
                                        onChange={() => setReturnRequestData({ ...returnRequestData, returnMethod: "dropoff" })}
                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                                      />
                                      <label htmlFor="return-method-dropoff" className="ml-3 block text-sm font-medium text-gray-700">
                                        Drop-off at Authorized Location
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-8 space-x-4">
                                <button
                                  type="submit"
                                  disabled={isSubmitting || returnRequestData.orderItemUids.length === 0}
                                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                    (isSubmitting || returnRequestData.orderItemUids.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {isSubmitting ? 'Processing...' : 'Submit Return Request'}
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('details')}
                                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <div className="py-10 text-center">
                            <p className="text-gray-500">This order is not eligible for returns. Orders can only be returned within 30 days of delivery.</p>
                            <button
                              type="button"
                              onClick={() => setActiveTab('details')}
                              className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Back to Order Details
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_OrderHistory;