import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppSelector, useAppDispatch, notificationsActions, fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/store/main";
import { XMarkIcon, BellIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { BellAlertIcon, CheckIcon } from "@heroicons/react/24/solid";

const GV_NotificationSystem: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Selectors for global state
  const { items: notifications, unreadCount, toasts } = useAppSelector(state => state.notifications);
  const { isAuthenticated } = useAppSelector(state => state.auth);
  
  // Local component state
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'order_status' | 'messages' | 'price_alerts' | 'system'>('all');
  const notificationCenterRef = useRef<HTMLDivElement>(null);

  // Get system alert notifications (critical system notifications that should be shown as banners)
  const alertBanners = notifications.filter(
    notification => notification.type === 'system' && !notification.isRead
  ).slice(0, 1); // Only show the most recent one
  
  // Fetch notifications on component mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchNotifications());
    }
  }, [isAuthenticated, dispatch]);
  
  // Close notification center when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationCenterRef.current && !notificationCenterRef.current.contains(event.target as Node)) {
        setIsNotificationCenterOpen(false);
      }
    };
    
    if (isNotificationCenterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationCenterOpen]);
  
  // Handle notification click - navigate to entity and mark as read
  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      dispatch(markNotificationAsRead(notification.uid));
    }
    
    if (notification.relatedTo) {
      const { entityType, entityUid } = notification.relatedTo;
      
      // Navigate based on entity type
      switch (entityType) {
        case 'order':
          navigate(`/account/orders/${entityUid}`);
          break;
        case 'message':
          navigate(`/messages/${notification.relatedTo.thread_uid || entityUid}`);
          break;
        case 'product':
          navigate(`/products/${entityUid}`);
          break;
        case 'question':
          navigate(`/products/${notification.relatedTo.product_uid}?tab=questions`);
          break;
        case 'answer':
          navigate(`/products/${notification.relatedTo.product_uid}?tab=questions&question=${notification.relatedTo.question_uid}`);
          break;
        default:
          // Do nothing for unknown entity types
          break;
      }
    }
    
    setIsNotificationCenterOpen(false);
  };
  
  // Toggle notification center open/closed
  const toggleNotificationCenter = () => {
    setIsNotificationCenterOpen(prev => !prev);
  };
  
  // Handle marking all notifications as read
  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead());
  };
  
  // Handle filter change
  const handleFilterChange = (filter: 'all' | 'order_status' | 'messages' | 'price_alerts' | 'system') => {
    setActiveFilter(filter);
  };
  
  // Remove toast notification
  const removeToast = (uid: string) => {
    dispatch(notificationsActions.clearToastNotification(uid));
  };
  
  // Helper to get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_status':
        return <CheckCircleIcon className="h-6 w-6 text-blue-500" />;
      case 'new_message':
        return <InformationCircleIcon className="h-6 w-6 text-purple-500" />;
      case 'price_change':
        return <ExclamationCircleIcon className="h-6 w-6 text-amber-500" />;
      case 'back_in_stock':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'quote_response':
        return <InformationCircleIcon className="h-6 w-6 text-blue-500" />;
      case 'new_review':
        return <InformationCircleIcon className="h-6 w-6 text-gray-500" />;
      case 'payment_processed':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'return_approved':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'system':
        return <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <InformationCircleIcon className="h-6 w-6 text-gray-500" />;
    }
  };
  
  // Get toast icon based on type
  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="h-6 w-6 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-6 w-6 text-blue-500" />;
    }
  };
  
  // Filter notifications based on active filter
  const filteredNotifications = notifications.filter(notification => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'order_status' && notification.type === 'order_status') return true;
    if (activeFilter === 'messages' && notification.type === 'new_message') return true;
    if (activeFilter === 'price_alerts' && (notification.type === 'price_change' || notification.type === 'back_in_stock')) return true;
    if (activeFilter === 'system' && notification.type === 'system') return true;
    return false;
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // If it's today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If it's yesterday, show "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // If it's within the last 7 days, show day name
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    if (date > sixDaysAgo) {
      return date.toLocaleDateString([], { weekday: 'long' });
    }
    
    // Otherwise, show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  return (
    <>
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm" aria-live="polite">
        {toasts.map((toast) => (
          <div 
            key={toast.uid}
            className={`flex items-center p-4 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 ease-in-out bg-white dark:bg-gray-800 ${
              toast.type === 'success' ? 'border-green-500' :
              toast.type === 'error' ? 'border-red-500' :
              toast.type === 'warning' ? 'border-amber-500' :
              'border-blue-500'
            }`}
            role="alert"
          >
            <div className="flex-shrink-0 mr-3">
              {getToastIcon(toast.type)}
            </div>
            <div className="flex-1 mr-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.uid)}
              className="flex-shrink-0 ml-auto text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              aria-label="Dismiss notification"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
      
      {/* Alert Banners */}
      <div className="w-full">
        {alertBanners.map((alert) => (
          <div
            key={alert.uid}
            className={`w-full px-4 py-3 text-white ${
              alert.type === 'system' ? 'bg-red-600' : 'bg-blue-600'
            }`}
            role="alert"
          >
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                <span className="font-medium">{alert.title}: </span>
                <span className="ml-1">{alert.message}</span>
              </div>
              <button
                onClick={() => dispatch(markNotificationAsRead(alert.uid))}
                className="ml-auto text-white hover:text-gray-200"
                aria-label="Dismiss alert"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Notification Center Button & Dropdown */}
      <div className="relative inline-block" ref={notificationCenterRef}>
        {/* Bell Icon Button */}
        <button
          className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white focus:outline-none"
          onClick={toggleNotificationCenter}
          aria-expanded={isNotificationCenterOpen}
          aria-haspopup="true"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          {unreadCount > 0 ? (
            <BellAlertIcon className="h-6 w-6" />
          ) : (
            <BellIcon className="h-6 w-6" />
          )}
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none transform translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        
        {/* Notification Dropdown */}
        {isNotificationCenterOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50 max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700">
            {/* Dropdown Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mark all as read
                </button>
              )}
            </div>
            
            {/* Filter Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  activeFilter === 'all' 
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' 
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
                onClick={() => handleFilterChange('all')}
              >
                All
              </button>
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  activeFilter === 'order_status' 
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' 
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
                onClick={() => handleFilterChange('order_status')}
              >
                Orders
              </button>
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  activeFilter === 'messages' 
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' 
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
                onClick={() => handleFilterChange('messages')}
              >
                Messages
              </button>
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  activeFilter === 'price_alerts' 
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' 
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
                onClick={() => handleFilterChange('price_alerts')}
              >
                Alerts
              </button>
            </div>
            
            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <InformationCircleIcon className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-600 dark:text-gray-300">No notifications to show</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeFilter !== 'all' ? 'Try a different filter or check back later.' : 'Your notifications will appear here.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNotifications.map((notification) => (
                    <li 
                      key={notification.uid}
                      className={`relative hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        className="w-full text-left px-4 py-3 flex items-start"
                      >
                        <div className="flex-shrink-0 mt-0.5 mr-3">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${
                            !notification.isRead ? 'font-semibold' : ''
                          }`}>
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Dropdown Footer */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <Link
                to="/account/notifications"
                className="block w-full text-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => setIsNotificationCenterOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_NotificationSystem;