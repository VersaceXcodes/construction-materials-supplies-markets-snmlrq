import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAppSelector, useAppDispatch, cartActions } from "@/store/main";
import { io } from "socket.io-client";

const UV_ShoppingCart: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Get auth and cart state from Redux store
  const { isAuthenticated, token, user } = useAppSelector((state) => state.auth);
  const globalCart = useAppSelector((state) => state.cart);
  const { viewportSize } = useAppSelector((state) => state.ui);
  
  // Local state for cart data
  const [cartData, setCartData] = useState<{
    uid: string;
    name: string | null;
    projectUid: string | null;
    notes: string | null;
    createdAt: string;
    lastActivity: string;
  } | null>(null);
  
  const [cartItems, setCartItems] = useState<Array<{
    uid: string;
    productUid: string;
    productName: string;
    shortDescription: string;
    variantUid: string | null;
    variantType: string | null;
    variantValue: string | null;
    quantity: number;
    priceSnapshot: number;
    unitOfMeasure: string;
    currentPrice: number | null;
    primaryImageUrl: string;
    isSavedForLater: boolean;
  }>>([]);
  
  const [savedItems, setSavedItems] = useState<Array<{
    uid: string;
    productUid: string;
    productName: string;
    shortDescription: string;
    variantUid: string | null;
    variantType: string | null;
    variantValue: string | null;
    quantity: number;
    priceSnapshot: number;
    unitOfMeasure: string;
    currentPrice: number | null;
    primaryImageUrl: string;
    isSavedForLater: boolean;
  }>>([]);
  
  const [cartSummary, setCartSummary] = useState<{
    subtotal: number;
    taxAmount: number;
    shippingAmount: number;
    discountAmount: number;
    totalAmount: number;
    currency: string;
    itemCount: number;
  }>({
    subtotal: 0,
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    currency: 'USD',
    itemCount: 0
  });
  
  const [appliedPromotions, setAppliedPromotions] = useState<Array<{
    code: string;
    description: string;
    discountAmount: number;
    type: string;
  }>>([]);
  
  const [shippingOptions, setShippingOptions] = useState<Array<{
    uid: string;
    name: string;
    description: string;
    estimatedDelivery: string;
    price: number;
    currency: string;
  }>>([]);
  
  const [selectedShippingOption, setSelectedShippingOption] = useState<string | null>(null);
  const [promotionCode, setPromotionCode] = useState<string>("");
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [cartNotes, setCartNotes] = useState<string>("");
  
  const [recommendedProducts, setRecommendedProducts] = useState<Array<{
    uid: string;
    name: string;
    shortDescription: string;
    price: number;
    currency: string;
    primaryImageUrl: string;
    averageRating: number;
  }>>([]);
  
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<Array<{
    uid: string;
    name: string;
    price: number;
    currency: string;
    primaryImageUrl: string;
  }>>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cartSaving, setCartSaving] = useState<boolean>(false);
  const [cartNameInput, setCartNameInput] = useState<string>("");
  const [showSaveCartModal, setShowSaveCartModal] = useState<boolean>(false);
  const [quantityErrors, setQuantityErrors] = useState<{[key: string]: string}>({});
  
  // Fetch cart details
  const fetchCartDetails = async () => {
    try {
      setIsLoading(true);
      
      // Only make API call if user is authenticated
      if (isAuthenticated && token) {
        const response = await axios.get('http://localhost:1337/api/cart', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          const cart = response.data.cart;
          setCartData({
            uid: cart.uid,
            name: cart.name,
            projectUid: cart.project_uid,
            notes: cart.notes,
            createdAt: cart.created_at,
            lastActivity: cart.last_activity
          });
          
          // Separate active items from saved items
          const activeItems = cart.items.filter((item: any) => !item.is_saved_for_later);
          const itemsSavedForLater = cart.items.filter((item: any) => item.is_saved_for_later);
          
          setCartItems(activeItems);
          setSavedItems(itemsSavedForLater);
          
          // Set cart summary
          setCartSummary({
            subtotal: cart.subtotal || 0,
            taxAmount: 0, // Will be calculated when shipping is selected
            shippingAmount: 0, // Will be set when shipping is selected
            discountAmount: 0, // Will be set when promotions are applied
            totalAmount: cart.subtotal || 0, // Initial total is just subtotal
            currency: 'USD',
            itemCount: cart.item_count || 0
          });
          
          // Set cart notes if present
          if (cart.notes) {
            setCartNotes(cart.notes);
          }
          
          // Also update the Redux cart store
          dispatch(cartActions.handleCartUpdate({
            update_type: 'full_update',
            cart_total: cart.subtotal,
            item_count: cart.item_count
          }));
        }
      } else {
        // If not authenticated, check localStorage for cart data
        const localCart = localStorage.getItem('cart');
        if (localCart) {
          const parsedCart = JSON.parse(localCart);
          setCartItems(parsedCart.items || []);
          setSavedItems(parsedCart.savedItems || []);
          calculateCartTotals(parsedCart.items || []);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cart details:', error);
      setIsLoading(false);
    }
  };
  
  // Calculate cart totals based on current items
  const calculateCartTotals = (items: any[]) => {
    const subtotal = items.reduce((total, item) => total + (item.priceSnapshot * item.quantity), 0);
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);
    
    setCartSummary(prev => ({
      ...prev,
      subtotal,
      itemCount,
      totalAmount: subtotal + prev.shippingAmount + prev.taxAmount - prev.discountAmount
    }));
  };
  
  // Fetch shipping options
  const fetchShippingOptions = async () => {
    if (cartItems.length === 0) return;
    
    try {
      // Make API call to get shipping options based on cart contents
      // This would typically require location information, but we'll use dummy data for now
      
      // Simulated shipping options
      const dummyShippingOptions = [
        {
          uid: 'shipping-standard',
          name: 'Standard Shipping',
          description: 'Delivery in 3-5 business days',
          estimatedDelivery: '3-5 business days',
          price: 15.00,
          currency: 'USD'
        },
        {
          uid: 'shipping-express',
          name: 'Express Shipping',
          description: 'Delivery in 2 business days',
          estimatedDelivery: '2 business days',
          price: 25.00,
          currency: 'USD'
        },
        {
          uid: 'shipping-overnight',
          name: 'Overnight Shipping',
          description: 'Delivery next business day',
          estimatedDelivery: 'Next business day',
          price: 35.00,
          currency: 'USD'
        }
      ];
      
      setShippingOptions(dummyShippingOptions);
      
      // Set the first option as default if none is selected
      if (!selectedShippingOption && dummyShippingOptions.length > 0) {
        setSelectedShippingOption(dummyShippingOptions[0].uid);
        updateShippingMethod(dummyShippingOptions[0].uid);
      }
    } catch (error) {
      console.error('Error fetching shipping options:', error);
    }
  };
  
  // Fetch recommended products
  const fetchRecommendedProducts = async () => {
    if (cartItems.length === 0) return;
    
    try {
      // In a real implementation, this would call a recommendations API with the cart items
      // For now, we'll use dummy data
      
      // Simulated recommended products based on cart contents
      const dummyRecommendedProducts = [
        {
          uid: 'prod-rec1',
          name: 'Premium Work Gloves',
          shortDescription: 'Heavy-duty leather work gloves for construction',
          price: 29.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/gloves/300/300',
          averageRating: 4.7
        },
        {
          uid: 'prod-rec2',
          name: 'Construction Level Tool',
          shortDescription: 'Professional-grade level with digital display',
          price: 45.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/level/300/300',
          averageRating: 4.5
        },
        {
          uid: 'prod-rec3',
          name: 'Safety Harness',
          shortDescription: 'Full-body safety harness for construction work',
          price: 89.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/harness/300/300',
          averageRating: 4.8
        },
        {
          uid: 'prod-rec4',
          name: 'Concrete Mix - 80 lbs',
          shortDescription: 'High-quality concrete mix for various applications',
          price: 15.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/concrete/300/300',
          averageRating: 4.2
        }
      ];
      
      setRecommendedProducts(dummyRecommendedProducts);
    } catch (error) {
      console.error('Error fetching recommended products:', error);
    }
  };
  
  // Fetch recently viewed products
  const fetchRecentlyViewedProducts = async () => {
    if (!isAuthenticated) return;
    
    try {
      // In a real implementation, this would call an API to get the user's recently viewed products
      // For now, we'll use dummy data
      
      // Simulated recently viewed products
      const dummyRecentlyViewedProducts = [
        {
          uid: 'prod-recent1',
          name: 'Circular Saw 7-1/4"',
          price: 129.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/saw/300/300'
        },
        {
          uid: 'prod-recent2',
          name: 'Hammer Drill Kit',
          price: 199.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/drill/300/300'
        },
        {
          uid: 'prod-recent3',
          name: 'Measuring Tape 25ft',
          price: 12.99,
          currency: 'USD',
          primaryImageUrl: 'https://picsum.photos/seed/tape/300/300'
        }
      ];
      
      setRecentlyViewedProducts(dummyRecentlyViewedProducts);
    } catch (error) {
      console.error('Error fetching recently viewed products:', error);
    }
  };
  
  // Update item quantity
  const updateItemQuantity = async (itemUid: string, newQuantity: number) => {
    // Clear previous error for this item
    setQuantityErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[itemUid];
      return newErrors;
    });
    
    // Validate quantity
    if (newQuantity < 1) {
      setQuantityErrors(prev => ({
        ...prev,
        [itemUid]: 'Quantity must be at least 1'
      }));
      return;
    }
    
    try {
      if (isAuthenticated && token) {
        const response = await axios.put(`http://localhost:1337/api/cart/items/${itemUid}`, {
          quantity: newQuantity
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          // Update local cart items
          setCartItems(prevItems => 
            prevItems.map(item => 
              item.uid === itemUid ? {...item, quantity: newQuantity} : item
            )
          );
          
          // Update cart summary
          const updatedCartSummary = response.data.cart_summary;
          if (updatedCartSummary) {
            setCartSummary(prev => ({
              ...prev,
              subtotal: updatedCartSummary.subtotal,
              itemCount: updatedCartSummary.item_count,
              totalAmount: updatedCartSummary.subtotal + prev.shippingAmount + prev.taxAmount - prev.discountAmount
            }));
          }
        }
      } else {
        // Update local storage for non-authenticated users
        setCartItems(prevItems => {
          const newItems = prevItems.map(item => 
            item.uid === itemUid ? {...item, quantity: newQuantity} : item
          );
          
          // Save to localStorage
          localStorage.setItem('cart', JSON.stringify({
            items: newItems,
            savedItems
          }));
          
          // Calculate new totals
          calculateCartTotals(newItems);
          
          return newItems;
        });
      }
    } catch (error) {
      console.error('Error updating item quantity:', error);
      
      // Show error message if API provides one
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        setQuantityErrors(prev => ({
          ...prev,
          [itemUid]: error.response?.data?.message
        }));
      } else {
        setQuantityErrors(prev => ({
          ...prev,
          [itemUid]: 'Error updating quantity'
        }));
      }
    }
  };
  
  // Remove item from cart
  const removeItem = async (itemUid: string) => {
    try {
      if (isAuthenticated && token) {
        const response = await axios.delete(`http://localhost:1337/api/cart/items/${itemUid}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          // Update local cart items
          setCartItems(prevItems => prevItems.filter(item => item.uid !== itemUid));
          
          // Update cart summary
          const updatedCartSummary = response.data.cart_summary;
          if (updatedCartSummary) {
            setCartSummary(prev => ({
              ...prev,
              subtotal: updatedCartSummary.subtotal,
              itemCount: updatedCartSummary.item_count,
              totalAmount: updatedCartSummary.subtotal + prev.shippingAmount + prev.taxAmount - prev.discountAmount
            }));
          }
        }
      } else {
        // Update local storage for non-authenticated users
        setCartItems(prevItems => {
          const newItems = prevItems.filter(item => item.uid !== itemUid);
          
          // Save to localStorage
          localStorage.setItem('cart', JSON.stringify({
            items: newItems,
            savedItems
          }));
          
          // Calculate new totals
          calculateCartTotals(newItems);
          
          return newItems;
        });
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };
  
  // Move item to saved for later
  const moveToSavedForLater = async (itemUid: string) => {
    try {
      if (isAuthenticated && token) {
        const response = await axios.put(`http://localhost:1337/api/cart/items/${itemUid}`, {
          is_saved_for_later: true
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          // Find the item to move
          const itemToMove = cartItems.find(item => item.uid === itemUid);
          
          if (itemToMove) {
            // Update local cart items
            setCartItems(prevItems => prevItems.filter(item => item.uid !== itemUid));
            
            // Add to saved items
            setSavedItems(prevSaved => [...prevSaved, {...itemToMove, isSavedForLater: true}]);
            
            // Update cart summary
            const updatedCartSummary = response.data.cart_summary;
            if (updatedCartSummary) {
              setCartSummary(prev => ({
                ...prev,
                subtotal: updatedCartSummary.subtotal,
                itemCount: updatedCartSummary.item_count,
                totalAmount: updatedCartSummary.subtotal + prev.shippingAmount + prev.taxAmount - prev.discountAmount
              }));
            }
          }
        }
      } else {
        // Update local storage for non-authenticated users
        const itemToMove = cartItems.find(item => item.uid === itemUid);
        
        if (itemToMove) {
          setCartItems(prevItems => {
            const newItems = prevItems.filter(item => item.uid !== itemUid);
            
            setSavedItems(prevSaved => {
              const newSaved = [...prevSaved, {...itemToMove, isSavedForLater: true}];
              
              // Save to localStorage
              localStorage.setItem('cart', JSON.stringify({
                items: newItems,
                savedItems: newSaved
              }));
              
              return newSaved;
            });
            
            // Calculate new totals
            calculateCartTotals(newItems);
            
            return newItems;
          });
        }
      }
    } catch (error) {
      console.error('Error moving item to saved for later:', error);
    }
  };
  
  // Move item from saved to cart
  const moveToCart = async (itemUid: string) => {
    try {
      if (isAuthenticated && token) {
        const response = await axios.put(`http://localhost:1337/api/cart/items/${itemUid}`, {
          is_saved_for_later: false
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          // Find the item to move
          const itemToMove = savedItems.find(item => item.uid === itemUid);
          
          if (itemToMove) {
            // Update saved items
            setSavedItems(prevSaved => prevSaved.filter(item => item.uid !== itemUid));
            
            // Add to cart items
            setCartItems(prevItems => [...prevItems, {...itemToMove, isSavedForLater: false}]);
            
            // Update cart summary
            const updatedCartSummary = response.data.cart_summary;
            if (updatedCartSummary) {
              setCartSummary(prev => ({
                ...prev,
                subtotal: updatedCartSummary.subtotal,
                itemCount: updatedCartSummary.item_count,
                totalAmount: updatedCartSummary.subtotal + prev.shippingAmount + prev.taxAmount - prev.discountAmount
              }));
            }
          }
        }
      } else {
        // Update local storage for non-authenticated users
        const itemToMove = savedItems.find(item => item.uid === itemUid);
        
        if (itemToMove) {
          setSavedItems(prevSaved => {
            const newSaved = prevSaved.filter(item => item.uid !== itemUid);
            
            setCartItems(prevItems => {
              const newItems = [...prevItems, {...itemToMove, isSavedForLater: false}];
              
              // Save to localStorage
              localStorage.setItem('cart', JSON.stringify({
                items: newItems,
                savedItems: newSaved
              }));
              
              // Calculate new totals
              calculateCartTotals(newItems);
              
              return newItems;
            });
            
            return newSaved;
          });
        }
      }
    } catch (error) {
      console.error('Error moving item to cart:', error);
    }
  };
  
  // Apply promotion code
  const applyPromotionCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!promotionCode.trim()) {
      setPromotionError('Please enter a promotion code');
      return;
    }
    
    try {
      setPromotionError(null);
      
      if (isAuthenticated && token) {
        // In a real implementation, this would call an API to validate and apply the promotion code
        // For now, we'll simulate a successful promotion application
        
        // Simulated response with discount
        const simulatedDiscount = 10.00;
        
        // Add promotion to applied promotions
        setAppliedPromotions(prev => [
          ...prev,
          {
            code: promotionCode,
            description: 'Discount code applied',
            discountAmount: simulatedDiscount,
            type: 'percentage'
          }
        ]);
        
        // Update cart summary with discount
        setCartSummary(prev => {
          const newDiscountAmount = prev.discountAmount + simulatedDiscount;
          return {
            ...prev,
            discountAmount: newDiscountAmount,
            totalAmount: prev.subtotal + prev.shippingAmount + prev.taxAmount - newDiscountAmount
          };
        });
        
        // Clear promotion code input
        setPromotionCode('');
      } else {
        setPromotionError('You must be logged in to apply promotion codes');
      }
    } catch (error) {
      console.error('Error applying promotion code:', error);
      
      // Show error message if API provides one
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        setPromotionError(error.response.data.message);
      } else {
        setPromotionError('Invalid promotion code');
      }
    }
  };
  
  // Remove promotion code
  const removePromotionCode = async (code: string) => {
    try {
      const promotionToRemove = appliedPromotions.find(promo => promo.code === code);
      
      if (!promotionToRemove) return;
      
      if (isAuthenticated && token) {
        // In a real implementation, this would call an API to remove the promotion code
        // For now, we'll just update the local state
        
        // Update applied promotions
        setAppliedPromotions(prev => prev.filter(promo => promo.code !== code));
        
        // Update cart summary
        setCartSummary(prev => {
          const newDiscountAmount = prev.discountAmount - promotionToRemove.discountAmount;
          return {
            ...prev,
            discountAmount: newDiscountAmount,
            totalAmount: prev.subtotal + prev.shippingAmount + prev.taxAmount - newDiscountAmount
          };
        });
      }
    } catch (error) {
      console.error('Error removing promotion code:', error);
    }
  };
  
  // Update shipping method
  const updateShippingMethod = (shippingUid: string) => {
    // Find selected shipping option
    const selectedOption = shippingOptions.find(option => option.uid === shippingUid);
    
    if (selectedOption) {
      setSelectedShippingOption(shippingUid);
      
      // Update cart summary with shipping cost
      setCartSummary(prev => {
        // Calculate estimated tax (for demonstration - in reality would be from API)
        const estimatedTax = prev.subtotal * 0.08; // 8% tax rate
        
        return {
          ...prev,
          shippingAmount: selectedOption.price,
          taxAmount: estimatedTax,
          totalAmount: prev.subtotal + selectedOption.price + estimatedTax - prev.discountAmount
        };
      });
    }
  };
  
  // Update cart notes
  const updateCartNotes = async (notes: string) => {
    setCartNotes(notes);
    
    // In a real implementation, this would call an API to update the cart notes
    if (isAuthenticated && token && cartData) {
      try {
        // Simulated API call to update cart notes
        console.log('Updating cart notes:', notes);
      } catch (error) {
        console.error('Error updating cart notes:', error);
      }
    }
  };
  
  // Save cart for later
  const saveCart = async () => {
    if (!isAuthenticated) {
      // Show login prompt
      return;
    }
    
    try {
      setCartSaving(true);
      
      if (token && cartData) {
        // In a real implementation, this would call an API to save the cart with a name
        // For now, we'll just update the local state
        
        setCartData(prev => {
          if (prev) {
            return {
              ...prev,
              name: cartNameInput
            };
          }
          return prev;
        });
        
        // Close modal and reset input
        setShowSaveCartModal(false);
        setCartNameInput('');
      }
      
      setCartSaving(false);
    } catch (error) {
      console.error('Error saving cart:', error);
      setCartSaving(false);
    }
  };
  
  // Clear cart
  const clearCart = async () => {
    if (window.confirm('Are you sure you want to remove all items from your cart?')) {
      try {
        if (isAuthenticated && token && cartData) {
          // In a real implementation, this would call an API to clear the cart
          // For example: await axios.delete(`/api/cart/${cartData.uid}/items`);
          
          // Update local state
          setCartItems([]);
          setCartSummary(prev => ({
            ...prev,
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0,
            itemCount: 0
          }));
        } else {
          // Clear local storage cart
          localStorage.removeItem('cart');
          setCartItems([]);
          setCartSummary(prev => ({
            ...prev,
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0,
            itemCount: 0
          }));
        }
      } catch (error) {
        console.error('Error clearing cart:', error);
      }
    }
  };
  
  // Navigate to checkout
  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      return;
    }
    
    if (!isAuthenticated) {
      // Redirect to login or show login modal
      // For now, just show an alert
      alert('Please log in to proceed to checkout');
      return;
    }
    
    // Navigate to checkout page
    navigate('/checkout');
  };
  
  // Request quote for cart
  const requestQuote = async () => {
    if (!isAuthenticated) {
      // Redirect to login or show login modal
      alert('Please log in to request a quote');
      return;
    }
    
    if (cartItems.length === 0) {
      return;
    }
    
    try {
      // In a real implementation, this would call an API to request a quote
      // For now, just show a success message
      alert('Quote request submitted! A representative will contact you shortly.');
    } catch (error) {
      console.error('Error requesting quote:', error);
    }
  };
  
  // Subscribe to cart updates via WebSocket
  const subscribeToCartUpdates = () => {
    if (!isAuthenticated || !token) return;
    
    // In a real implementation, this would establish a WebSocket connection for real-time cart updates
    const socket = io('http://localhost:1337', {
      auth: {
        token
      }
    });
    
    socket.on('cart_update', (update) => {
      console.log('Received cart update:', update);
      // Handle cart updates based on the update type
      
      // This would trigger a refetch of cart data in a real implementation
      fetchCartDetails();
    });
    
    // Clean up socket on component unmount
    return () => {
      socket.disconnect();
    };
  };
  
  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };
  
  // Effects
  
  // Fetch cart details on mount and when auth state changes
  useEffect(() => {
    fetchCartDetails();
  }, [isAuthenticated]);
  
  // Fetch shipping options when cart items change
  useEffect(() => {
    if (cartItems.length > 0) {
      fetchShippingOptions();
    }
  }, [cartItems]);
  
  // Fetch recommendations when cart items change
  useEffect(() => {
    if (cartItems.length > 0) {
      fetchRecommendedProducts();
    }
  }, [cartItems]);
  
  // Fetch recently viewed products on mount
  useEffect(() => {
    fetchRecentlyViewedProducts();
  }, [isAuthenticated]);
  
  // Subscribe to cart updates on mount
  useEffect(() => {
    const cleanup = subscribeToCartUpdates();
    return cleanup;
  }, [isAuthenticated, token]);
  
  return (
    <>
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Your Shopping Cart</h1>
            <Link 
              to="/" 
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Continue Shopping
            </Link>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-600" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            // Empty cart state
            <div className="text-center py-16 bg-gray-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-6">Looks like you haven't added any items to your cart yet.</p>
              <Link 
                to="/categories" 
                className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Start Shopping
              </Link>
              
              {/* Recommended categories for browsing */}
              {isAuthenticated && (
                <div className="mt-16">
                  <h3 className="text-xl font-semibold mb-4">Browse Popular Categories</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                      <div className="h-24 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-gray-500">⚒️</span>
                      </div>
                      <h4 className="font-medium text-gray-900">Tools</h4>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                      <div className="h-24 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-gray-500">🪵</span>
                      </div>
                      <h4 className="font-medium text-gray-900">Lumber</h4>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                      <div className="h-24 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-gray-500">🧰</span>
                      </div>
                      <h4 className="font-medium text-gray-900">Hardware</h4>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                      <div className="h-24 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-gray-500">🔌</span>
                      </div>
                      <h4 className="font-medium text-gray-900">Electrical</h4>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Previous purchases for returning users */}
              {isAuthenticated && recentlyViewedProducts.length > 0 && (
                <div className="mt-16">
                  <h3 className="text-xl font-semibold mb-4">Recently Viewed Items</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {recentlyViewedProducts.map(product => (
                      <div key={product.uid} className="bg-white rounded-lg shadow p-4 flex">
                        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded">
                          <img 
                            src={product.primaryImageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                        <div className="ml-4 flex-grow">
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <p className="text-gray-600 mt-1">{formatCurrency(product.price, product.currency)}</p>
                          <Link 
                            to={`/products/${product.uid}`}
                            className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Cart with items
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left section - Cart items */}
              <div className="w-full lg:w-2/3 space-y-6">
                {/* Active cart items */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Cart Items ({cartSummary.itemCount})</h2>
                  </div>
                  
                  <ul className="divide-y divide-gray-200">
                    {cartItems.map(item => (
                      <li key={item.uid} className="p-6">
                        <div className="flex flex-col sm:flex-row">
                          {/* Product image */}
                          <div className="flex-shrink-0 w-full sm:w-32 h-32 mb-4 sm:mb-0">
                            <img 
                              src={item.primaryImageUrl || 'https://picsum.photos/seed/product/300/300'} 
                              alt={item.productName} 
                              className="h-full w-full object-cover object-center rounded-md"
                            />
                          </div>
                          
                          {/* Product details */}
                          <div className="flex-grow sm:ml-6">
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">
                                  <Link to={`/products/${item.productUid}`} className="hover:text-blue-600">
                                    {item.productName}
                                  </Link>
                                </h3>
                                
                                {item.variantType && item.variantValue && (
                                  <p className="mt-1 text-sm text-gray-500">
                                    {item.variantType}: {item.variantValue}
                                  </p>
                                )}
                                
                                <p className="mt-1 text-sm text-gray-500">
                                  {formatCurrency(item.priceSnapshot, cartSummary.currency)} / {item.unitOfMeasure}
                                </p>
                                
                                {item.currentPrice && item.currentPrice !== item.priceSnapshot && (
                                  <p className="mt-1 text-sm text-red-600">
                                    Current price: {formatCurrency(item.currentPrice, cartSummary.currency)}
                                  </p>
                                )}
                              </div>
                              
                              <div className="mt-4 sm:mt-0 flex flex-col sm:items-end">
                                <div className="flex items-center">
                                  <label htmlFor={`quantity-${item.uid}`} className="sr-only">Quantity</label>
                                  <div className="flex border border-gray-300 rounded-md">
                                    <button
                                      type="button"
                                      className="px-2 py-1 text-gray-600 hover:text-gray-700 focus:outline-none"
                                      onClick={() => updateItemQuantity(item.uid, Math.max(1, item.quantity - 1))}
                                    >
                                      <span className="sr-only">Decrease</span>
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                                      </svg>
                                    </button>
                                    <input
                                      id={`quantity-${item.uid}`}
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItemQuantity(item.uid, parseInt(e.target.value) || 1)}
                                      className="w-12 text-center border-x border-gray-300 py-1 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      className="px-2 py-1 text-gray-600 hover:text-gray-700 focus:outline-none"
                                      onClick={() => updateItemQuantity(item.uid, item.quantity + 1)}
                                    >
                                      <span className="sr-only">Increase</span>
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                
                                {quantityErrors[item.uid] && (
                                  <p className="mt-1 text-sm text-red-600">{quantityErrors[item.uid]}</p>
                                )}
                                
                                <p className="mt-2 text-base font-medium text-gray-900">
                                  {formatCurrency(item.priceSnapshot * item.quantity, cartSummary.currency)}
                                </p>
                                
                                <div className="mt-4 flex space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => moveToSavedForLater(item.uid)}
                                    className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 underline"
                                  >
                                    Save for Later
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.uid)}
                                    className="px-2 py-1 text-sm text-red-600 hover:text-red-800 underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">Subtotal</h3>
                      <p className="text-lg font-medium text-gray-900">
                        {formatCurrency(cartSummary.subtotal, cartSummary.currency)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Special instructions */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Special Instructions</h3>
                  <textarea
                    rows={3}
                    value={cartNotes}
                    onChange={(e) => updateCartNotes(e.target.value)}
                    placeholder="Add any special instructions or notes about your order here..."
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                {/* Saved for later items */}
                {savedItems.length > 0 && (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Saved for Later ({savedItems.length})</h2>
                    </div>
                    
                    <ul className="divide-y divide-gray-200">
                      {savedItems.map(item => (
                        <li key={item.uid} className="p-6">
                          <div className="flex flex-col sm:flex-row">
                            {/* Product image */}
                            <div className="flex-shrink-0 w-full sm:w-24 h-24 mb-4 sm:mb-0">
                              <img 
                                src={item.primaryImageUrl || 'https://picsum.photos/seed/saved/300/300'} 
                                alt={item.productName} 
                                className="h-full w-full object-cover object-center rounded-md"
                              />
                            </div>
                            
                            {/* Product details */}
                            <div className="flex-grow sm:ml-6">
                              <div className="flex flex-col sm:flex-row sm:justify-between">
                                <div>
                                  <h3 className="text-base font-medium text-gray-900">
                                    <Link to={`/products/${item.productUid}`} className="hover:text-blue-600">
                                      {item.productName}
                                    </Link>
                                  </h3>
                                  
                                  {item.variantType && item.variantValue && (
                                    <p className="mt-1 text-sm text-gray-500">
                                      {item.variantType}: {item.variantValue}
                                    </p>
                                  )}
                                  
                                  <p className="mt-1 text-sm text-gray-900">
                                    {formatCurrency(item.priceSnapshot, cartSummary.currency)}
                                  </p>
                                </div>
                                
                                <div className="mt-4 sm:mt-0">
                                  <div className="flex space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => moveToCart(item.uid)}
                                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                      Move to Cart
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.uid)}
                                      className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Right section - Order summary */}
              <div className="w-full lg:w-1/3 space-y-6">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Order Summary</h2>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(cartSummary.subtotal, cartSummary.currency)}</span>
                    </div>
                    
                    {/* Shipping options */}
                    {shippingOptions.length > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <span className="block text-gray-600 mb-2">Shipping</span>
                        <div className="space-y-2">
                          {shippingOptions.map(option => (
                            <div key={option.uid} className="flex items-start">
                              <input
                                id={`shipping-${option.uid}`}
                                name="shipping-option"
                                type="radio"
                                checked={selectedShippingOption === option.uid}
                                onChange={() => updateShippingMethod(option.uid)}
                                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-1"
                              />
                              <label htmlFor={`shipping-${option.uid}`} className="ml-3 flex flex-col">
                                <span className="text-gray-900">{option.name} - {formatCurrency(option.price, option.currency)}</span>
                                <span className="text-gray-500 text-sm">{option.description}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Estimated tax */}
                    <div className="flex justify-between pt-4 border-t border-gray-200">
                      <span className="text-gray-600">Estimated Tax</span>
                      <span className="font-medium">{formatCurrency(cartSummary.taxAmount, cartSummary.currency)}</span>
                    </div>
                    
                    {/* Applied promotions */}
                    {appliedPromotions.length > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <span className="block text-gray-600 mb-2">Applied Promotions</span>
                        <ul className="space-y-2">
                          {appliedPromotions.map(promo => (
                            <li key={promo.code} className="flex justify-between items-center">
                              <div className="flex-grow">
                                <span className="text-gray-900">{promo.code}</span>
                                <p className="text-gray-500 text-sm">{promo.description}</p>
                              </div>
                              <div className="flex items-center">
                                <span className="text-green-600 mr-2">-{formatCurrency(promo.discountAmount, cartSummary.currency)}</span>
                                <button
                                  type="button"
                                  onClick={() => removePromotionCode(promo.code)}
                                  className="text-gray-400 hover:text-gray-500"
                                >
                                  <span className="sr-only">Remove promotion</span>
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Total */}
                    <div className="flex justify-between pt-4 border-t border-gray-200 text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(cartSummary.totalAmount, cartSummary.currency)}</span>
                    </div>
                    
                    {/* Promo code form */}
                    <div className="pt-6 border-t border-gray-200">
                      <form onSubmit={applyPromotionCode} className="flex">
                        <input
                          type="text"
                          value={promotionCode}
                          onChange={(e) => setPromotionCode(e.target.value)}
                          placeholder="Promotion code"
                          className="block w-full border border-gray-300 rounded-l-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                        <button
                          type="submit"
                          className="bg-gray-200 hover:bg-gray-300 px-4 rounded-r-md font-medium text-gray-700"
                        >
                          Apply
                        </button>
                      </form>
                      {promotionError && (
                        <p className="mt-2 text-sm text-red-600">{promotionError}</p>
                      )}
                    </div>
                    
                    {/* Checkout and quote buttons */}
                    <div className="pt-6 space-y-3">
                      <button
                        type="button"
                        onClick={proceedToCheckout}
                        className="w-full bg-blue-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Proceed to Checkout
                      </button>
                      
                      {user?.userType === 'professional_buyer' && (
                        <button
                          type="button"
                          onClick={requestQuote}
                          className="w-full bg-white border border-gray-300 rounded-md shadow-sm py-3 px-4 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Request Quote
                        </button>
                      )}
                    </div>
                    
                    {/* Additional cart actions */}
                    <div className="pt-6 border-t border-gray-200 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSaveCartModal(true)}
                        className="text-sm text-gray-600 hover:text-gray-900 underline"
                      >
                        Save Cart
                      </button>
                      
                      {user?.userType === 'professional_buyer' && (
                        <button
                          type="button"
                          className="text-sm text-gray-600 hover:text-gray-900 underline"
                        >
                          Share Cart
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-sm text-red-600 hover:text-red-800 underline ml-auto"
                      >
                        Clear Cart
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Recommended products section */}
          {cartItems.length > 0 && recommendedProducts.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Recommended for You</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommendedProducts.map(product => (
                  <div key={product.uid} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow">
                    <Link to={`/products/${product.uid}`} className="block">
                      <div className="h-48 bg-gray-200">
                        <img 
                          src={product.primaryImageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{product.shortDescription}</p>
                        <div className="mt-2 flex items-center">
                          <div className="flex items-center">
                            {[0, 1, 2, 3, 4].map((rating) => (
                              <svg
                                key={rating}
                                className={`h-5 w-5 ${
                                  product.averageRating > rating ? 'text-yellow-400' : 'text-gray-300'
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <p className="ml-2 text-sm text-gray-500">{product.averageRating.toFixed(1)}</p>
                        </div>
                        <p className="mt-2 text-lg font-medium text-gray-900">
                          {formatCurrency(product.price, product.currency)}
                        </p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Recently viewed products */}
          {isAuthenticated && recentlyViewedProducts.length > 0 && cartItems.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Recently Viewed</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {recentlyViewedProducts.map(product => (
                  <Link key={product.uid} to={`/products/${product.uid}`} className="block group">
                    <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={product.primaryImageUrl} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {formatCurrency(product.price, product.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Save Cart Modal */}
      {showSaveCartModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Save Cart
                    </h3>
                    <div className="mt-4">
                      <label htmlFor="cart-name" className="block text-sm font-medium text-gray-700">
                        Cart Name
                      </label>
                      <input
                        type="text"
                        id="cart-name"
                        value={cartNameInput}
                        onChange={(e) => setCartNameInput(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="e.g. Kitchen Renovation"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={saveCart}
                  disabled={cartSaving || !cartNameInput.trim()}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${
                    (cartSaving || !cartNameInput.trim()) && 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {cartSaving ? 'Saving...' : 'Save Cart'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveCartModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_ShoppingCart;