import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppSelector, useAppDispatch, uiActions, cartActions, fetchCart, updateCartItem, removeCartItem } from '@/store/main';

// Cart sidebar component
const GV_CartSidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Global state from Redux
  const { isAuthenticated, user } = useAppSelector(state => state.auth);
  const { items, summary, isLoading: globalCartLoading } = useAppSelector(state => state.cart);
  
  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [localCartItems, setLocalCartItems] = useState(items);
  const [localCartSummary, setLocalCartSummary] = useState(summary);
  const [activeCartUid, setActiveCartUid] = useState<string | null>(null);
  const [availableCarts, setAvailableCarts] = useState<Array<{ uid: string; name: string }>>([]);
  const [quantityUpdateInProgress, setQuantityUpdateInProgress] = useState<Record<string, boolean>>({});
  
  // Refs
  const cartItemsRef = useRef<HTMLDivElement>(null);
  
  // Effect to sync local state with global state
  useEffect(() => {
    setLocalCartItems(items);
    setLocalCartSummary(summary);
  }, [items, summary]);
  
  // Effect to fetch cart data when sidebar opens
  useEffect(() => {
    fetchCartItems();
    
    // Check for multiple carts if user is professional buyer
    if (isAuthenticated && user?.userType === 'professional_buyer') {
      fetchAvailableCarts();
    }
    
    // Subscribe to cart updates
    subscribeToCartUpdates();
    
    // Cleanup on unmount
    return () => {
      // Any cleanup needed for subscriptions
    };
  }, [isAuthenticated, user]);
  
  // Fetch cart items from backend
  const fetchCartItems = async () => {
    if (globalCartLoading) return;
    
    setIsLoading(true);
    try {
      await dispatch(fetchCart()).unwrap();
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch available carts for professional buyers
  const fetchAvailableCarts = async () => {
    if (!isAuthenticated || user?.userType !== 'professional_buyer') return;
    
    try {
      const response = await axios.get('/api/carts');
      if (response.data.success && response.data.carts) {
        setAvailableCarts(response.data.carts);
        
        // Set active cart if none is selected
        if (!activeCartUid && response.data.carts.length > 0) {
          setActiveCartUid(response.data.carts[0].uid);
        }
      }
    } catch (error) {
      console.error('Failed to fetch available carts:', error);
    }
  };
  
  // Subscribe to real-time cart updates
  const subscribeToCartUpdates = () => {
    // This is handled globally through the Redux store
    // The cartActions.handleCartUpdate action is dispatched by the socket middleware
  };
  
  // Update item quantity
  const updateItemQuantity = async (itemUid: string, newQuantity: number) => {
    if (quantityUpdateInProgress[itemUid] || newQuantity < 1) return;
    
    setQuantityUpdateInProgress(prev => ({ ...prev, [itemUid]: true }));
    
    // Optimistic update for immediate UI feedback
    const updatedItems = localCartItems.map(item => 
      item.uid === itemUid ? { ...item, quantity: newQuantity } : item
    );
    setLocalCartItems(updatedItems);
    
    // Calculate new totals
    updateLocalSummary(updatedItems);
    
    try {
      await dispatch(updateCartItem({ item_uid: itemUid, quantity: newQuantity })).unwrap();
    } catch (error) {
      console.error('Failed to update item quantity:', error);
      
      // Revert to original state on error
      setLocalCartItems(items);
      setLocalCartSummary(summary);
    } finally {
      setQuantityUpdateInProgress(prev => ({ ...prev, [itemUid]: false }));
    }
  };
  
  // Handle quantity input change
  const handleQuantityChange = (itemUid: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value, 10);
    if (!isNaN(newQuantity) && newQuantity > 0) {
      updateItemQuantity(itemUid, newQuantity);
    }
  };
  
  // Remove item from cart
  const handleRemoveItem = async (itemUid: string) => {
    // Optimistic update
    const updatedItems = localCartItems.filter(item => item.uid !== itemUid);
    setLocalCartItems(updatedItems);
    
    // Calculate new totals
    updateLocalSummary(updatedItems);
    
    try {
      await dispatch(removeCartItem(itemUid)).unwrap();
    } catch (error) {
      console.error('Failed to remove item:', error);
      
      // Revert to original state on error
      setLocalCartItems(items);
      setLocalCartSummary(summary);
    }
  };
  
  // Save item for later
  const saveForLater = async (itemUid: string) => {
    // Find the item
    const item = localCartItems.find(item => item.uid === itemUid);
    if (!item) return;
    
    // Optimistic update
    const updatedItems = localCartItems.map(item => 
      item.uid === itemUid ? { ...item, isSavedForLater: true } : item
    );
    setLocalCartItems(updatedItems);
    
    // Calculate new totals
    updateLocalSummary(updatedItems);
    
    try {
      await dispatch(updateCartItem({ item_uid: itemUid, is_saved_for_later: true })).unwrap();
    } catch (error) {
      console.error('Failed to save item for later:', error);
      
      // Revert to original state on error
      setLocalCartItems(items);
      setLocalCartSummary(summary);
    }
  };
  
  // Move saved item back to cart
  const moveToCart = async (itemUid: string) => {
    // Find the item
    const item = localCartItems.find(item => item.uid === itemUid);
    if (!item) return;
    
    // Optimistic update
    const updatedItems = localCartItems.map(item => 
      item.uid === itemUid ? { ...item, isSavedForLater: false } : item
    );
    setLocalCartItems(updatedItems);
    
    // Calculate new totals
    updateLocalSummary(updatedItems);
    
    try {
      await dispatch(updateCartItem({ item_uid: itemUid, is_saved_for_later: false })).unwrap();
    } catch (error) {
      console.error('Failed to move item to cart:', error);
      
      // Revert to original state on error
      setLocalCartItems(items);
      setLocalCartSummary(summary);
    }
  };
  
  // Switch between multiple carts (for professional buyers)
  const switchCart = async (cartUid: string) => {
    if (activeCartUid === cartUid) return;
    
    setActiveCartUid(cartUid);
    setIsLoading(true);
    
    try {
      const response = await axios.get(`/api/cart?cart_uid=${cartUid}`);
      if (response.data.success) {
        // Update local cart with the selected cart's data
        setLocalCartItems(response.data.cart.items);
        setLocalCartSummary(response.data.cart.summary);
      }
    } catch (error) {
      console.error('Failed to switch cart:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Navigate to checkout
  const navigateToCheckout = () => {
    // Close sidebar first
    closeSidebar();
    
    // Then navigate
    navigate('/checkout');
  };
  
  // Close the cart sidebar
  const closeSidebar = () => {
    dispatch(uiActions.closeModal('cart'));
  };
  
  // Helper to update local summary when items change
  const updateLocalSummary = (updatedItems: typeof localCartItems) => {
    const activeItems = updatedItems.filter(item => !item.isSavedForLater);
    
    // Calculate subtotal
    const subtotal = activeItems.reduce(
      (sum, item) => sum + (item.priceSnapshot * item.quantity), 
      0
    );
    
    // Calculate total items
    const itemCount = activeItems.reduce(
      (count, item) => count + item.quantity, 
      0
    );
    
    // For now, use simplified tax calculation (10%)
    // In a real app, this would come from the backend based on location
    const taxAmount = subtotal * 0.1;
    
    // For now, use fixed shipping
    // In a real app, this would be calculated based on address and shipping method
    const shippingAmount = subtotal > 0 ? 15 : 0;
    
    setLocalCartSummary({
      ...localCartSummary,
      subtotal,
      taxAmount,
      shippingAmount,
      totalAmount: subtotal + taxAmount + shippingAmount - (localCartSummary?.discountAmount || 0),
      itemCount
    });
  };
  
  // Organize items into active and saved-for-later groups
  const activeItems = localCartItems.filter(item => !item.isSavedForLater);
  const savedItems = localCartItems.filter(item => item.isSavedForLater);
  
  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        onClick={closeSidebar}
      />
      
      {/* Sidebar Panel */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white z-50 shadow-lg transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            Your Cart 
            {localCartSummary.itemCount > 0 && (
              <span className="ml-2 text-sm text-gray-600">
                ({localCartSummary.itemCount} {localCartSummary.itemCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </h2>
          <button 
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            onClick={closeSidebar}
            aria-label="Close cart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Cart Selector for Professional Buyers */}
        {isAuthenticated && user?.userType === 'professional_buyer' && availableCarts.length > 1 && (
          <div className="p-4 border-b border-gray-200">
            <label htmlFor="cart-selector" className="block text-sm font-medium text-gray-700 mb-1">
              Select Cart
            </label>
            <select
              id="cart-selector"
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={activeCartUid || ''}
              onChange={(e) => switchCart(e.target.value)}
            >
              {availableCarts.map(cart => (
                <option key={cart.uid} value={cart.uid}>
                  {cart.name || `Cart ${cart.uid.substring(5, 9)}`}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* Empty Cart State */}
        {!isLoading && activeItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center flex-grow">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
            <p className="text-gray-600 mb-6">
              Looks like you haven't added any construction materials to your cart yet.
            </p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={closeSidebar}
            >
              Continue Shopping
            </button>
          </div>
        )}
        
        {/* Cart Items */}
        {!isLoading && activeItems.length > 0 && (
          <div className="flex-grow overflow-y-auto" ref={cartItemsRef}>
            <ul className="divide-y divide-gray-200">
              {activeItems.map(item => (
                <li key={item.uid} className="p-4">
                  <div className="flex space-x-4">
                    {/* Product Image */}
                    <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded overflow-hidden">
                      {item.primaryImageUrl ? (
                        <img
                          src={item.primaryImageUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {item.productName}
                      </h4>
                      {item.variantInfo && (
                        <p className="text-sm text-gray-500">{item.variantInfo}</p>
                      )}
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        ${item.priceSnapshot.toFixed(2)} each
                      </p>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center mt-2">
                        <button
                          className="p-1 border border-gray-300 rounded-l bg-gray-100 hover:bg-gray-200 focus:outline-none"
                          onClick={() => updateItemQuantity(item.uid, Math.max(1, item.quantity - 1))}
                          disabled={quantityUpdateInProgress[item.uid] || item.quantity <= 1}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <input
                          type="text"
                          className="w-10 border-t border-b border-gray-300 text-center focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.uid, e)}
                          disabled={quantityUpdateInProgress[item.uid]}
                        />
                        <button
                          className="p-1 border border-gray-300 rounded-r bg-gray-100 hover:bg-gray-200 focus:outline-none"
                          onClick={() => updateItemQuantity(item.uid, item.quantity + 1)}
                          disabled={quantityUpdateInProgress[item.uid]}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm font-medium text-gray-700">
                          Subtotal: ${(item.priceSnapshot * item.quantity).toFixed(2)}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                            onClick={() => saveForLater(item.uid)}
                          >
                            Save for later
                          </button>
                          <button
                            className="text-sm text-red-600 hover:text-red-800 focus:outline-none"
                            onClick={() => handleRemoveItem(item.uid)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            
            {/* Saved For Later Items */}
            {savedItems.length > 0 && (
              <div className="border-t border-gray-200 pt-4 mt-2">
                <h3 className="text-lg font-medium text-gray-900 px-4 mb-2">Saved for Later ({savedItems.length})</h3>
                <ul className="divide-y divide-gray-200">
                  {savedItems.map(item => (
                    <li key={item.uid} className="p-4 bg-gray-50">
                      <div className="flex space-x-4">
                        {/* Product Image */}
                        <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded overflow-hidden">
                          {item.primaryImageUrl ? (
                            <img
                              src={item.primaryImageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {item.productName}
                          </h4>
                          {item.variantInfo && (
                            <p className="text-xs text-gray-500">{item.variantInfo}</p>
                          )}
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            ${item.priceSnapshot.toFixed(2)}
                          </p>
                          
                          <div className="flex justify-between items-center mt-2">
                            <button
                              className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                              onClick={() => moveToCart(item.uid)}
                            >
                              Move to Cart
                            </button>
                            <button
                              className="text-sm text-red-600 hover:text-red-800 focus:outline-none"
                              onClick={() => handleRemoveItem(item.uid)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Cart Summary and Actions */}
        {!isLoading && activeItems.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {/* Order Summary */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${localCartSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax (estimated)</span>
                <span className="font-medium">${localCartSummary.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping (estimated)</span>
                <span className="font-medium">${localCartSummary.shippingAmount.toFixed(2)}</span>
              </div>
              {localCartSummary.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-${localCartSummary.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>${localCartSummary.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Link 
                to="/cart"
                className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
                onClick={closeSidebar}
              >
                View Cart
              </Link>
              <button
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={navigateToCheckout}
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_CartSidebar;