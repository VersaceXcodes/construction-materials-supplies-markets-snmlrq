import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAppSelector } from '@/store/main';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { io, Socket } from 'socket.io-client';

const UV_OrderManagement: React.FC = () => {
  // URL params and navigation
  const { order_uid } = useParams<{ order_uid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Auth state from redux
  const { user, token } = useAppSelector((state) => state.auth);

  // Local state variables
  const [orders, setOrders] = useState<Array<any>>([]);
  const [orderFilters, setOrderFilters] = useState({
    status: searchParams.get('status') || null,
    dateRange: {
      startDate: null,
      endDate: null
    },
    search: null,
    paymentStatus: null,
    shippingMethod: null
  });
  const [pagination, setPagination] = useState({
    currentPage: Number(searchParams.get('page')) || 1,
    totalPages: 1,
    limit: Number(searchParams.get('limit')) || 15,
    totalItems: 0
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [shippingCarriers] = useState([
    {
      id: "usps",
      name: "USPS",
      trackingUrlTemplate: "https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}"
    },
    {
      id: "ups",
      name: "UPS",
      trackingUrlTemplate: "https://www.ups.com/track?tracknum={tracking_number}"
    },
    {
      id: "fedex",
      name: "FedEx",
      trackingUrlTemplate: "https://www.fedex.com/apps/fedextrack/?tracknumbers={tracking_number}"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [bulkActionSelection, setBulkActionSelection] = useState<string[]>([]);
  const [shippingLabelData, setShippingLabelData] = useState({
    carrier: null,
    service: null,
    packageType: null,
    weight: null,
    dimensions: {
      length: null,
      width: null,
      height: null
    },
    insuranceAmount: null,
    labelUrl: null,
    trackingNumber: null,
    error: null
  });

  // Form state for status updates and shipping information
  const [statusUpdateForm, setStatusUpdateForm] = useState({
    status: '',
    trackingNumber: '',
    shippingMethod: '',
    estimatedDeliveryDate: '',
    note: ''
  });

  // Order note form state
  const [noteForm, setNoteForm] = useState({
    content: '',
    isInternal: true
  });

  // State for shipping label form
  const [showShippingLabelForm, setShowShippingLabelForm] = useState(false);
  const [showBulkActionForm, setShowBulkActionForm] = useState(false);
  const [bulkActionStatus, setBulkActionStatus] = useState('');

  // Error and success messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // WebSocket reference
  const socketRef = useRef<Socket | null>(null);

  // Fetch orders based on current filters and pagination
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Build query params
      const params = new URLSearchParams();
      if (orderFilters.status) params.append('status', orderFilters.status);
      if (orderFilters.dateRange.startDate) params.append('start_date', orderFilters.dateRange.startDate);
      if (orderFilters.dateRange.endDate) params.append('end_date', orderFilters.dateRange.endDate);
      if (orderFilters.search) params.append('search', orderFilters.search);
      if (orderFilters.paymentStatus) params.append('payment_status', orderFilters.paymentStatus);
      if (orderFilters.shippingMethod) params.append('shipping_method', orderFilters.shippingMethod);
      params.append('page', pagination.currentPage.toString());
      params.append('limit', pagination.limit.toString());

      // Make API request
      const response = await axios.get(`http://localhost:1337/api/orders`, {
        params,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Update state with response data
      setOrders(response.data.orders);
      setPagination({
        ...pagination,
        totalPages: response.data.pagination.total_pages,
        totalItems: response.data.pagination.total_items
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      setErrorMessage('Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [orderFilters, pagination.currentPage, pagination.limit, token]);

  // Fetch details for a specific order
  const fetchOrderDetails = useCallback(async (orderId: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.get(`http://localhost:1337/api/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setSelectedOrder(response.data.order);
      
      // Pre-fill status update form with current values
      setStatusUpdateForm({
        status: response.data.order.status,
        trackingNumber: response.data.order.trackingNumber || '',
        shippingMethod: response.data.order.shippingMethod || '',
        estimatedDeliveryDate: response.data.order.estimatedDeliveryDate || '',
        note: ''
      });
    } catch (error) {
      console.error('Error fetching order details:', error);
      setErrorMessage('Failed to load order details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Update order status
  const updateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.put(
        `http://localhost:1337/api/orders/${selectedOrder.uid}/status`,
        statusUpdateForm,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update the local state
      setSelectedOrder({
        ...selectedOrder,
        status: statusUpdateForm.status,
        trackingNumber: statusUpdateForm.trackingNumber || selectedOrder.trackingNumber,
        shippingMethod: statusUpdateForm.shippingMethod || selectedOrder.shippingMethod,
        estimatedDeliveryDate: statusUpdateForm.estimatedDeliveryDate || selectedOrder.estimatedDeliveryDate,
        statusHistory: [
          {
            status: statusUpdateForm.status,
            timestamp: new Date().toISOString(),
            updatedBy: `${user?.firstName} ${user?.lastName}`,
            note: statusUpdateForm.note || null
          },
          ...(selectedOrder.statusHistory || [])
        ]
      });

      setSuccessMessage(`Order status updated to ${statusUpdateForm.status}`);
      
      // Clear the form note field
      setStatusUpdateForm({
        ...statusUpdateForm,
        note: ''
      });
      
      // Refresh the orders list to show the updated status
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      setErrorMessage('Failed to update order status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Process order
  const processOrder = async (orderId: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.put(
        `http://localhost:1337/api/orders/${orderId}/process`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // If we're on the order details page, update the selected order
      if (selectedOrder && selectedOrder.uid === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: 'processing',
          statusHistory: [
            {
              status: 'processing',
              timestamp: new Date().toISOString(),
              updatedBy: `${user?.firstName} ${user?.lastName}`,
              note: 'Order processed'
            },
            ...(selectedOrder.statusHistory || [])
          ]
        });
      }

      setSuccessMessage('Order processed successfully');
      
      // Refresh the orders list
      fetchOrders();
    } catch (error) {
      console.error('Error processing order:', error);
      setErrorMessage('Failed to process order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Ship order
  const shipOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const shipData = {
        shippingMethod: statusUpdateForm.shippingMethod,
        trackingNumber: statusUpdateForm.trackingNumber,
        estimatedDeliveryDate: statusUpdateForm.estimatedDeliveryDate
      };

      const response = await axios.put(
        `http://localhost:1337/api/orders/${selectedOrder.uid}/ship`,
        shipData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update the local state
      setSelectedOrder({
        ...selectedOrder,
        status: 'shipped',
        trackingNumber: statusUpdateForm.trackingNumber,
        shippingMethod: statusUpdateForm.shippingMethod,
        estimatedDeliveryDate: statusUpdateForm.estimatedDeliveryDate,
        statusHistory: [
          {
            status: 'shipped',
            timestamp: new Date().toISOString(),
            updatedBy: `${user?.firstName} ${user?.lastName}`,
            note: 'Order shipped'
          },
          ...(selectedOrder.statusHistory || [])
        ]
      });

      setSuccessMessage('Order marked as shipped');
      
      // Update status form state
      setStatusUpdateForm({
        ...statusUpdateForm,
        status: 'shipped'
      });
      
      // Refresh the orders list
      fetchOrders();
    } catch (error) {
      console.error('Error shipping order:', error);
      setErrorMessage('Failed to ship order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate shipping label
  const generateShippingLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // In a real implementation, this would call a shipping API
      // For now, we'll simulate a successful label generation
      setShippingLabelData({
        ...shippingLabelData,
        labelUrl: 'https://example.com/shipping-label.pdf',
        trackingNumber: Math.floor(Math.random() * 1000000000).toString(),
        error: null
      });

      setSuccessMessage('Shipping label generated successfully');
      
      // Hide the shipping label form
      setShowShippingLabelForm(false);
      
      // Update the tracking number in the status form
      setStatusUpdateForm({
        ...statusUpdateForm,
        trackingNumber: shippingLabelData.trackingNumber
      });
    } catch (error) {
      console.error('Error generating shipping label:', error);
      setErrorMessage('Failed to generate shipping label. Please try again.');
      setShippingLabelData({
        ...shippingLabelData,
        error: 'Failed to generate shipping label'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate packing slip
  const generatePackingSlip = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // In a real implementation, this would call an API endpoint
      // For demonstration, we'll open a new window that could display a PDF
      window.open(`http://localhost:1337/api/orders/${selectedOrder.uid}/packing-slip`, '_blank');

      setSuccessMessage('Packing slip generated');
    } catch (error) {
      console.error('Error generating packing slip:', error);
      setErrorMessage('Failed to generate packing slip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate invoice
  const generateInvoice = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // In a real implementation, this would call an API endpoint
      // For demonstration, we'll open a new window that could display a PDF
      window.open(`http://localhost:1337/api/orders/${selectedOrder.uid}/invoice`, '_blank');

      setSuccessMessage('Invoice generated');
    } catch (error) {
      console.error('Error generating invoice:', error);
      setErrorMessage('Failed to generate invoice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add order note
  const addOrderNote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.post(
        `http://localhost:1337/api/orders/${selectedOrder.uid}/notes`,
        noteForm,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update the local state
      setSelectedOrder({
        ...selectedOrder,
        notes: [
          {
            uid: response.data.note.uid || `note-${Date.now()}`,
            author: `${user?.firstName} ${user?.lastName}`,
            content: noteForm.content,
            isInternal: noteForm.isInternal,
            createdAt: new Date().toISOString()
          },
          ...(selectedOrder.notes || [])
        ]
      });

      setSuccessMessage('Note added successfully');
      
      // Reset the form
      setNoteForm({
        content: '',
        isInternal: true
      });
    } catch (error) {
      console.error('Error adding note:', error);
      setErrorMessage('Failed to add note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Contact buyer
  const contactBuyer = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.post(
        `http://localhost:1337/api/messages/thread`,
        {
          recipient_uid: selectedOrder.customerInfo.uid,
          subject: `Regarding your order #${selectedOrder.orderNumber}`,
          related_to_order_uid: selectedOrder.uid
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Navigate to the message thread
      navigate(`/messages/${response.data.thread_uid}`);
    } catch (error) {
      console.error('Error contacting buyer:', error);
      setErrorMessage('Failed to initiate message thread. Please try again.');
      setIsLoading(false);
    }
  };

  // Bulk update orders
  const bulkUpdateOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bulkActionStatus || bulkActionSelection.length === 0) {
      setErrorMessage('Please select a status and at least one order');
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await axios.put(
        `http://localhost:1337/api/orders/bulk/status`,
        {
          order_uids: bulkActionSelection,
          status: bulkActionStatus
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setSuccessMessage(`${bulkActionSelection.length} orders updated to status: ${bulkActionStatus}`);
      
      // Reset selections
      setBulkActionSelection([]);
      setBulkActionStatus('');
      setShowBulkActionForm(false);
      
      // Refresh the orders list
      fetchOrders();
    } catch (error) {
      console.error('Error updating orders in bulk:', error);
      setErrorMessage('Failed to update orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle selection of an order for bulk actions
  const toggleOrderSelection = (orderId: string) => {
    setBulkActionSelection(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  // Toggle selection of all orders for bulk actions
  const toggleSelectAll = () => {
    if (bulkActionSelection.length === orders.length) {
      setBulkActionSelection([]);
    } else {
      setBulkActionSelection(orders.map(order => order.uid));
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterName: string, value: any) => {
    setOrderFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    
    // Reset to first page when filters change
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  };

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
    
    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    navigate(`/seller/orders?${params.toString()}`);
  };

  // Set up WebSocket connection for real-time order notifications
  const subscribeToNewOrders = useCallback(() => {
    if (!token || !user?.companyUid) return;
    
    // Close any existing connection
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Create new connection
    const socket = io('http://localhost:1337', {
      auth: {
        token
      }
    });
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
      
      // Join the seller's company room for order notifications
      socket.emit('join', `sellers/${user.companyUid}/orders`);
    });
    
    socket.on('seller_order_notification', (notification) => {
      console.log('New order notification:', notification);
      
      // Show success message
      setSuccessMessage(`New order received: #${notification.order_number}`);
      
      // Refresh orders list
      fetchOrders();
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
    
    socketRef.current = socket;
    
    // Clean up on unmount
    return () => {
      socket.disconnect();
    };
  }, [token, user?.companyUid, fetchOrders]);

  // Initial load effect
  useEffect(() => {
    fetchOrders();
    subscribeToNewOrders();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [fetchOrders, subscribeToNewOrders]);

  // Effect to fetch order details when order_uid changes
  useEffect(() => {
    if (order_uid) {
      fetchOrderDetails(order_uid);
    } else {
      setSelectedOrder(null);
    }
  }, [order_uid, fetchOrderDetails]);

  // Effect to clear messages after a timeout
  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setSuccessMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  // Generate status badge color based on status
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'returned':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Urgent</span>;
      case 'high':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">High</span>;
      case 'standard':
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Standard</span>;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Date format error:', error);
      return dateString;
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  // Get tracking URL
  const getTrackingUrl = (carrier: string, trackingNumber: string) => {
    const carrierInfo = shippingCarriers.find(c => c.id === carrier || c.name.toLowerCase() === carrier.toLowerCase());
    if (carrierInfo && carrierInfo.trackingUrlTemplate && trackingNumber) {
      return carrierInfo.trackingUrlTemplate.replace('{tracking_number}', trackingNumber);
    }
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedOrder ? `Order #${selectedOrder.orderNumber}` : 'Order Management'}
        </h1>
        
        {selectedOrder ? (
          <button
            onClick={() => navigate('/seller/orders')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Back to Orders
          </button>
        ) : (
          bulkActionSelection.length > 0 && (
            <button
              onClick={() => setShowBulkActionForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Bulk Update ({bulkActionSelection.length})
            </button>
          )
        )}
      </div>
      
      {/* Success/Error Messages */}
      {errorMessage && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700"></div>
        </div>
      )}
      
      {/* Order Details View */}
      {selectedOrder ? (
        <div className="bg-white shadow rounded-lg">
          {/* Order Summary */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-wrap justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Order #{selectedOrder.orderNumber}</h2>
                <p className="text-sm text-gray-500">Placed on {formatDate(selectedOrder.orderDate)}</p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  {selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Order Content */}
          <div className="px-6 py-4">
            {/* Two-column layout for desktop */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left column - Customer, Products, Notes */}
              <div className="md:col-span-8">
                {/* Customer Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Customer Information</h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{selectedOrder.customerInfo.firstName} {selectedOrder.customerInfo.lastName}</p>
                        <p className="text-sm text-gray-600">{selectedOrder.customerInfo.email}</p>
                        {selectedOrder.customerInfo.phone && (
                          <p className="text-sm text-gray-600">{selectedOrder.customerInfo.phone}</p>
                        )}
                        {selectedOrder.customerInfo.companyName && (
                          <p className="text-sm text-gray-600">{selectedOrder.customerInfo.companyName}</p>
                        )}
                      </div>
                      <button
                        onClick={contactBuyer}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        Contact Buyer
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Order Items */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Order Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-b border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {selectedOrder.items.map((item: any) => (
                          <tr key={item.uid} className="hover:bg-gray-50">
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {item.primaryImageUrl ? (
                                  <img
                                    src={item.primaryImageUrl}
                                    alt={item.productName}
                                    className="h-10 w-10 object-cover rounded-md mr-3"
                                  />
                                ) : (
                                  <div className="h-10 w-10 bg-gray-200 rounded-md mr-3 flex items-center justify-center text-gray-400">
                                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 18a10 10 0 110-20 10 10 0 010 20z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                                  {item.variantInfo && (
                                    <div className="text-sm text-gray-500">{item.variantInfo}</div>
                                  )}
                                  <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(item.unitPrice, selectedOrder.currency)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(item.subtotal, selectedOrder.currency)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Order Notes */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Order Notes</h3>
                  <div className="bg-white border border-gray-200 rounded-md mb-4">
                    {selectedOrder.notes && selectedOrder.notes.length > 0 ? (
                      <div className="p-4 space-y-4">
                        {selectedOrder.notes.map((note: any) => (
                          <div key={note.uid} className={`p-3 rounded-md ${note.isInternal ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">
                                {note.author} 
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${note.isInternal ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800'}`}>
                                  {note.isInternal ? 'Internal' : 'Customer-facing'}
                                </span>
                              </span>
                              <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                            </div>
                            <p className="text-sm mt-1">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">No notes for this order</div>
                    )}
                  </div>
                  
                  {/* Add Note Form */}
                  <form onSubmit={addOrderNote} className="border border-gray-200 rounded-md p-4">
                    <div className="mb-4">
                      <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 mb-1">
                        Add a note
                      </label>
                      <textarea
                        id="note-content"
                        rows={3}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        required
                      ></textarea>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="internal-note"
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={noteForm.isInternal}
                          onChange={(e) => setNoteForm({ ...noteForm, isInternal: e.target.checked })}
                        />
                        <label htmlFor="internal-note" className="ml-2 block text-sm text-gray-700">
                          Internal note (not visible to customer)
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Add Note
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              
              {/* Right column - Order Info, Status, Actions */}
              <div className="md:col-span-4">
                {/* Order Summary */}
                <div className="bg-gray-50 rounded-md p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.subtotal, selectedOrder.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.taxAmount, selectedOrder.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.shippingAmount, selectedOrder.currency)}</span>
                    </div>
                    {selectedOrder.discountAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-medium text-green-600">-{formatCurrency(selectedOrder.discountAmount, selectedOrder.currency)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between text-base">
                        <span className="font-medium">Total:</span>
                        <span className="font-bold">{formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Shipping Information */}
                <div className="bg-gray-50 rounded-md p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Shipping Information</h3>
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Shipping Address</h4>
                    <p className="text-sm">{selectedOrder.shippingAddress.recipient}</p>
                    <p className="text-sm">{selectedOrder.shippingAddress.streetAddress1}</p>
                    {selectedOrder.shippingAddress.streetAddress2 && (
                      <p className="text-sm">{selectedOrder.shippingAddress.streetAddress2}</p>
                    )}
                    <p className="text-sm">
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}
                    </p>
                    <p className="text-sm">{selectedOrder.shippingAddress.country}</p>
                    {selectedOrder.shippingAddress.specialInstructions && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Special Instructions:</p>
                        <p className="text-sm text-gray-600">{selectedOrder.shippingAddress.specialInstructions}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-200 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Shipping Method</h4>
                    <p className="text-sm">{selectedOrder.shippingMethod || 'Not specified'}</p>
                    
                    {selectedOrder.trackingNumber && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Tracking Number:</p>
                        {getTrackingUrl(selectedOrder.shippingMethod, selectedOrder.trackingNumber) ? (
                          <a
                            href={getTrackingUrl(selectedOrder.shippingMethod, selectedOrder.trackingNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:text-indigo-500"
                          >
                            {selectedOrder.trackingNumber}
                          </a>
                        ) : (
                          <p className="text-sm">{selectedOrder.trackingNumber}</p>
                        )}
                      </div>
                    )}
                    
                    {selectedOrder.estimatedDeliveryDate && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Estimated Delivery:</p>
                        <p className="text-sm">{formatDate(selectedOrder.estimatedDeliveryDate)}</p>
                      </div>
                    )}
                    
                    {selectedOrder.actualDeliveryDate && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Delivered On:</p>
                        <p className="text-sm">{formatDate(selectedOrder.actualDeliveryDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Payment Information */}
                <div className="bg-gray-50 rounded-md p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Payment Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="font-medium">{selectedOrder.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className={`font-medium ${
                        selectedOrder.paymentStatus === 'paid' ? 'text-green-600' : 
                        selectedOrder.paymentStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Order Status & Actions */}
                <div className="bg-gray-50 rounded-md p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Update Order Status</h3>
                  <form onSubmit={updateOrderStatus}>
                    <div className="mb-4">
                      <label htmlFor="order-status" className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        id="order-status"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={statusUpdateForm.status}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                        required
                      >
                        <option value="" disabled>Select status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="returned">Returned</option>
                      </select>
                    </div>
                    
                    {(statusUpdateForm.status === 'shipped' || statusUpdateForm.status === 'delivered') && (
                      <>
                        <div className="mb-4">
                          <label htmlFor="tracking-number" className="block text-sm font-medium text-gray-700 mb-1">
                            Tracking Number
                          </label>
                          <input
                            type="text"
                            id="tracking-number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={statusUpdateForm.trackingNumber}
                            onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, trackingNumber: e.target.value })}
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="shipping-method" className="block text-sm font-medium text-gray-700 mb-1">
                            Shipping Carrier
                          </label>
                          <select
                            id="shipping-method"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            value={statusUpdateForm.shippingMethod}
                            onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, shippingMethod: e.target.value })}
                          >
                            <option value="">Select carrier</option>
                            {shippingCarriers.map((carrier) => (
                              <option key={carrier.id} value={carrier.id}>
                                {carrier.name}
                              </option>
                            ))}
                            <option value="other">Other</option>
                          </select>
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="delivery-date" className="block text-sm font-medium text-gray-700 mb-1">
                            Estimated Delivery Date
                          </label>
                          <input
                            type="date"
                            id="delivery-date"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={statusUpdateForm.estimatedDeliveryDate}
                            onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, estimatedDeliveryDate: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="mb-4">
                      <label htmlFor="status-note" className="block text-sm font-medium text-gray-700 mb-1">
                        Note (optional)
                      </label>
                      <textarea
                        id="status-note"
                        rows={2}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        value={statusUpdateForm.note}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, note: e.target.value })}
                      ></textarea>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Update Status
                    </button>
                  </form>
                </div>
                
                {/* Order Actions */}
                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Order Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowShippingLabelForm(true)}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-5a1 1 0 00-1-1h-4.05a2.5 2.5 0 01-4.9 0H3z" />
                      </svg>
                      Generate Shipping Label
                    </button>
                    
                    <button
                      onClick={generatePackingSlip}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      Print Packing Slip
                    </button>
                    
                    <button
                      onClick={generateInvoice}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                      </svg>
                      Print Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Status History */}
          <div className="border-t border-gray-200 px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Status History</h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {selectedOrder.statusHistory && selectedOrder.statusHistory.map((statusItem: any, index: number) => (
                  <li key={index}>
                    <div className="relative pb-8">
                      {index !== selectedOrder.statusHistory.length - 1 ? (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getStatusColor(statusItem.status)}`}>
                            <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Status changed to <span className="font-medium text-gray-900">{statusItem.status.charAt(0).toUpperCase() + statusItem.status.slice(1)}</span>
                              {statusItem.updatedBy && ` by ${statusItem.updatedBy}`}
                            </p>
                            {statusItem.note && (
                              <p className="mt-1 text-sm text-gray-500">{statusItem.note}</p>
                            )}
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {formatDate(statusItem.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Orders List View */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {/* Filters Section */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex flex-wrap gap-4">
                {/* Status Filter */}
                <div className="w-full sm:w-auto">
                  <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    id="status-filter"
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={orderFilters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value || null)}
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
                
                {/* Date Range Filter - Simplified for now */}
                <div className="w-full sm:w-auto">
                  <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <select
                    id="date-filter"
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    onChange={(e) => {
                      const today = new Date();
                      let startDate = null;
                      
                      switch (e.target.value) {
                        case 'today':
                          startDate = new Date().toISOString().split('T')[0];
                          break;
                        case 'yesterday':
                          const yesterday = new Date(today);
                          yesterday.setDate(yesterday.getDate() - 1);
                          startDate = yesterday.toISOString().split('T')[0];
                          break;
                        case 'last7days':
                          const last7Days = new Date(today);
                          last7Days.setDate(last7Days.getDate() - 7);
                          startDate = last7Days.toISOString().split('T')[0];
                          break;
                        case 'last30days':
                          const last30Days = new Date(today);
                          last30Days.setDate(last30Days.getDate() - 30);
                          startDate = last30Days.toISOString().split('T')[0];
                          break;
                        default:
                          startDate = null;
                      }
                      
                      handleFilterChange('dateRange', {
                        startDate,
                        endDate: startDate ? today.toISOString().split('T')[0] : null
                      });
                    }}
                  >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7days">Last 7 Days</option>
                    <option value="last30days">Last 30 Days</option>
                  </select>
                </div>
                
                {/* Search Filter */}
                <div className="w-full sm:w-auto flex-grow">
                  <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="text"
                      id="search-filter"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
                      placeholder="Order #, customer name or email"
                      value={orderFilters.search || ''}
                      onChange={(e) => handleFilterChange('search', e.target.value || null)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Advanced Filters Button */}
                <div className="w-full sm:w-auto flex items-end">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => {
                      // In a real implementation, this would open an advanced filters modal or expand the filters section
                      alert('Advanced filters would open here');
                    }}
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                    Advanced Filters
                  </button>
                </div>
              </div>
            </div>
            
            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          checked={bulkActionSelection.length === orders.length && orders.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.length > 0 ? (
                    orders.map((order) => (
                      <tr key={order.uid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              checked={bulkActionSelection.includes(order.uid)}
                              onChange={() => toggleOrderSelection(order.uid)}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link 
                            to={`/seller/orders/${order.uid}`} 
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            #{order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(order.orderDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.itemsCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(order.totalAmount, order.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPriorityBadge(order.fulfillmentPriority)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Link
                              to={`/seller/orders/${order.uid}`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View
                            </Link>
                            {order.status === 'pending' && (
                              <button
                                onClick={() => processOrder(order.uid)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Process
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/seller/orders/${order.uid}`)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
                        {isLoading ? 'Loading orders...' : 'No orders found matching your criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
                  disabled={pagination.currentPage <= 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    pagination.currentPage <= 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    pagination.currentPage >= pagination.totalPages 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(pagination.currentPage - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)}</span> of <span className="font-medium">{pagination.totalItems}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
                      disabled={pagination.currentPage <= 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                        pagination.currentPage <= 1 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, index) => {
                      let pageNumber = pagination.currentPage - 2 + index;
                      if (pageNumber < 1) pageNumber = 1 + index;
                      if (pageNumber > pagination.totalPages) pageNumber = pagination.totalPages - 4 + index;
                      if (pageNumber < 1 || pageNumber > pagination.totalPages) return null;
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          aria-current={pagination.currentPage === pageNumber ? 'page' : undefined}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.currentPage === pageNumber
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                      disabled={pagination.currentPage >= pagination.totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                        pagination.currentPage >= pagination.totalPages 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Shipping Label Form Modal */}
      {showShippingLabelForm && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Generate Shipping Label
                    </h3>
                    <div className="mt-4">
                      <form onSubmit={generateShippingLabel}>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="carrier" className="block text-sm font-medium text-gray-700">Carrier</label>
                            <select
                              id="carrier"
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                              value={shippingLabelData.carrier || ''}
                              onChange={(e) => setShippingLabelData({ ...shippingLabelData, carrier: e.target.value })}
                              required
                            >
                              <option value="">Select carrier</option>
                              {shippingCarriers.map((carrier) => (
                                <option key={carrier.id} value={carrier.id}>
                                  {carrier.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor="service" className="block text-sm font-medium text-gray-700">Service</label>
                            <select
                              id="service"
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                              value={shippingLabelData.service || ''}
                              onChange={(e) => setShippingLabelData({ ...shippingLabelData, service: e.target.value })}
                              required
                            >
                              <option value="">Select service</option>
                              <option value="standard">Standard</option>
                              <option value="express">Express</option>
                              <option value="priority">Priority</option>
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor="package-type" className="block text-sm font-medium text-gray-700">Package Type</label>
                            <select
                              id="package-type"
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                              value={shippingLabelData.packageType || ''}
                              onChange={(e) => setShippingLabelData({ ...shippingLabelData, packageType: e.target.value })}
                              required
                            >
                              <option value="">Select package type</option>
                              <option value="box">Box</option>
                              <option value="envelope">Envelope</option>
                              <option value="pallet">Pallet</option>
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor="weight" className="block text-sm font-medium text-gray-700">Weight (lbs)</label>
                            <input
                              type="number"
                              id="weight"
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              value={shippingLabelData.weight || ''}
                              onChange={(e) => setShippingLabelData({ ...shippingLabelData, weight: e.target.value })}
                              step="0.1"
                              min="0.1"
                              required
                            />
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label htmlFor="length" className="block text-sm font-medium text-gray-700">Length (in)</label>
                              <input
                                type="number"
                                id="length"
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={shippingLabelData.dimensions.length || ''}
                                onChange={(e) => setShippingLabelData({
                                  ...shippingLabelData,
                                  dimensions: {
                                    ...shippingLabelData.dimensions,
                                    length: e.target.value
                                  }
                                })}
                                step="0.1"
                                min="0.1"
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="width" className="block text-sm font-medium text-gray-700">Width (in)</label>
                              <input
                                type="number"
                                id="width"
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={shippingLabelData.dimensions.width || ''}
                                onChange={(e) => setShippingLabelData({
                                  ...shippingLabelData,
                                  dimensions: {
                                    ...shippingLabelData.dimensions,
                                    width: e.target.value
                                  }
                                })}
                                step="0.1"
                                min="0.1"
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="height" className="block text-sm font-medium text-gray-700">Height (in)</label>
                              <input
                                type="number"
                                id="height"
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={shippingLabelData.dimensions.height || ''}
                                onChange={(e) => setShippingLabelData({
                                  ...shippingLabelData,
                                  dimensions: {
                                    ...shippingLabelData.dimensions,
                                    height: e.target.value
                                  }
                                })}
                                step="0.1"
                                min="0.1"
                                required
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="insurance" className="block text-sm font-medium text-gray-700">Insurance Amount ($)</label>
                            <input
                              type="number"
                              id="insurance"
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              value={shippingLabelData.insuranceAmount || ''}
                              onChange={(e) => setShippingLabelData({ ...shippingLabelData, insuranceAmount: e.target.value })}
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                          <button
                            type="submit"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                          >
                            Generate Label
                          </button>
                          <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                            onClick={() => setShowShippingLabelForm(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Action Modal */}
      {showBulkActionForm && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Bulk Update Orders
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Update status for {bulkActionSelection.length} selected orders.
                      </p>
                    </div>
                    <div className="mt-4">
                      <form onSubmit={bulkUpdateOrders}>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="bulk-status" className="block text-sm font-medium text-gray-700">New Status</label>
                            <select
                              id="bulk-status"
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                              value={bulkActionStatus}
                              onChange={(e) => setBulkActionStatus(e.target.value)}
                              required
                            >
                              <option value="">Select status</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                          <button
                            type="submit"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                          >
                            Update Orders
                          </button>
                          <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                            onClick={() => setShowBulkActionForm(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UV_OrderManagement;