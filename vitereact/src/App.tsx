import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch, initializeStore, uiActions } from "@/store/main";

// Global shared views
import GV_MainNavigation from '@/components/views/GV_MainNavigation.tsx';
import GV_Footer from '@/components/views/GV_Footer.tsx';
import GV_AuthenticationModal from '@/components/views/GV_AuthenticationModal.tsx';
import GV_CartSidebar from '@/components/views/GV_CartSidebar.tsx';
import GV_NotificationSystem from '@/components/views/GV_NotificationSystem.tsx';
import GV_SearchFilters from '@/components/views/GV_SearchFilters.tsx';

// Unique views
import UV_Landing from '@/components/views/UV_Landing.tsx';
import UV_CategoryBrowsing from '@/components/views/UV_CategoryBrowsing.tsx';
import UV_SearchResults from '@/components/views/UV_SearchResults.tsx';
import UV_ProductDetails from '@/components/views/UV_ProductDetails.tsx';
import UV_ShoppingCart from '@/components/views/UV_ShoppingCart.tsx';
import UV_Checkout from '@/components/views/UV_Checkout.tsx';
import UV_UserAccount from '@/components/views/UV_UserAccount.tsx';
import UV_OrderHistory from '@/components/views/UV_OrderHistory.tsx';
import UV_WishlistAndSaved from '@/components/views/UV_WishlistAndSaved.tsx';
import UV_SellerDashboard from '@/components/views/UV_SellerDashboard.tsx';
import UV_ProductManagement from '@/components/views/UV_ProductManagement.tsx';
import UV_OrderManagement from '@/components/views/UV_OrderManagement.tsx';
import UV_PromotionsManager from '@/components/views/UV_PromotionsManager.tsx';
import UV_HelpCenter from '@/components/views/UV_HelpCenter.tsx';
import UV_MessageCenter from '@/components/views/UV_MessageCenter.tsx';

// Protected route component
const ProtectedRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const location = useLocation();
  
  if (!isAuthenticated) {
    // Remember where the user was trying to go for redirect after login
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  return element;
};

// Seller route component (requires auth + seller role)
const SellerRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const location = useLocation();
  
  if (!isAuthenticated || user?.userType !== 'seller') {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  return element;
};

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  
  // UI state from Redux
  const { activeModals } = useAppSelector((state) => state.ui);
  
  // Initialize store and connections on app load
  useEffect(() => {
    initializeStore();
  }, []);
  
  // Update previous route when location changes
  useEffect(() => {
    dispatch(uiActions.setPreviousRoute(location.pathname));
  }, [location.pathname, dispatch]);
  
  // Determine if authentication modal should be shown
  const showAuthModal = activeModals.includes('authentication');
  
  // Determine if cart sidebar should be shown
  const showCartSidebar = activeModals.includes('cart');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Global Navigation - appears on all pages */}
      <GV_MainNavigation />
      
      {/* Global Notification System - appears on all pages */}
      <GV_NotificationSystem />
      
      {/* Main Content Area */}
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<UV_Landing />} />
          <Route path="/categories/:category_uid" element={<UV_CategoryBrowsing />} />
          <Route path="/search" element={<UV_SearchResults />} />
          <Route path="/products/:product_uid" element={<UV_ProductDetails />} />
          <Route path="/cart" element={<UV_ShoppingCart />} />
          <Route path="/checkout" element={<UV_Checkout />} />
          <Route path="/help" element={<UV_HelpCenter />} />
          
          {/* Protected Routes - User Account */}
          <Route path="/account" element={<ProtectedRoute element={<UV_UserAccount />} />} />
          <Route path="/account/profile" element={<ProtectedRoute element={<UV_UserAccount />} />} />
          <Route path="/account/addresses" element={<ProtectedRoute element={<UV_UserAccount />} />} />
          <Route path="/account/payment-methods" element={<ProtectedRoute element={<UV_UserAccount />} />} />
          
          {/* Protected Routes - Orders & Wishlists */}
          <Route path="/account/orders" element={<ProtectedRoute element={<UV_OrderHistory />} />} />
          <Route path="/account/orders/:order_uid" element={<ProtectedRoute element={<UV_OrderHistory />} />} />
          <Route path="/account/wishlists" element={<ProtectedRoute element={<UV_WishlistAndSaved />} />} />
          <Route path="/account/wishlists/:wishlist_uid" element={<ProtectedRoute element={<UV_WishlistAndSaved />} />} />
          
          {/* Protected Routes - Messages */}
          <Route path="/messages" element={<ProtectedRoute element={<UV_MessageCenter />} />} />
          <Route path="/messages/:thread_uid" element={<ProtectedRoute element={<UV_MessageCenter />} />} />
          
          {/* Seller Routes */}
          <Route path="/seller" element={<SellerRoute element={<UV_SellerDashboard />} />} />
          <Route path="/seller/products" element={<SellerRoute element={<UV_ProductManagement />} />} />
          <Route path="/seller/products/new" element={<SellerRoute element={<UV_ProductManagement />} />} />
          <Route path="/seller/products/:product_uid" element={<SellerRoute element={<UV_ProductManagement />} />} />
          <Route path="/seller/orders" element={<SellerRoute element={<UV_OrderManagement />} />} />
          <Route path="/seller/orders/:order_uid" element={<SellerRoute element={<UV_OrderManagement />} />} />
          <Route path="/seller/promotions" element={<SellerRoute element={<UV_PromotionsManager />} />} />
          <Route path="/seller/promotions/new" element={<SellerRoute element={<UV_PromotionsManager />} />} />
          <Route path="/seller/promotions/:promotion_uid" element={<SellerRoute element={<UV_PromotionsManager />} />} />
          
          {/* 404 Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Global Footer - appears on all pages */}
      <GV_Footer />
      
      {/* Modals and Sidebars */}
      {showAuthModal && <GV_AuthenticationModal />}
      {showCartSidebar && <GV_CartSidebar />}
    </div>
  );
};

export default App;