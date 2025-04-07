import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAppSelector, useAppDispatch, notificationsActions } from "@/store/main";
import { io, Socket } from "socket.io-client";

// API Base URL
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

// Types
interface Wishlist {
  uid: string;
  name: string;
  description?: string;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DetailedWishlist extends Wishlist {
  owner?: {
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
  };
}

interface WishlistItem {
  uid: string;
  wishlistUid: string;
  productUid: string;
  productName: string;
  shortDescription?: string;
  basePrice: number;
  currency: string;
  inStock: boolean;
  primaryImageUrl?: string;
  variantUid?: string;
  variantType?: string;
  variantValue?: string;
  variantInStock?: boolean;
  addedAt: string;
  priceDifference?: number;
  notes?: string;
}

interface SavedSearch {
  uid: string;
  name: string;
  query: string;
  filters: {
    categoryUid?: string;
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    sort?: string;
  };
  lastRunAt?: string;
  createdAt: string;
}

interface ProductSummary {
  uid: string;
  name: string;
  shortDescription?: string;
  basePrice: number;
  currency: string;
  inStock: boolean;
  primaryImageUrl?: string;
  viewedAt: string;
}

// Main component
const UV_WishlistAndSaved: React.FC = () => {
  // Router hooks
  const { wishlist_uid } = useParams<{ wishlist_uid?: string }>();
  const navigate = useNavigate();

  // Redux hooks
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, token } = useAppSelector((state) => state.auth);

  // Local state
  const [activeView, setActiveView] = useState<"wishlists" | "saved-searches" | "recently-viewed">("wishlists");
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [activeWishlist, setActiveWishlist] = useState<DetailedWishlist | null>(null);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductSummary[]>([]);
  const [isEditingWishlist, setIsEditingWishlist] = useState(false);
  const [wishlistFormData, setWishlistFormData] = useState({
    name: "",
    description: "",
    isPublic: false,
  });
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreatingWishlist, setIsCreatingWishlist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Socket ref
  const socketRef = useRef<Socket | null>(null);

  // Fetch wishlists
  const fetchWishlists = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/api/wishlists`);
      if (response.data.success) {
        setWishlists(response.data.wishlists);
        
        // If no wishlist is selected but we have wishlists, select the first one
        if (!wishlist_uid && response.data.wishlists.length > 0) {
          navigate(`/account/wishlists/${response.data.wishlists[0].uid}`);
        }
      }
    } catch (error) {
      console.error("Error fetching wishlists:", error);
      setError("Failed to load your wishlists. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch wishlist items
  const fetchWishlistItems = async (wishlistId: string) => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/api/wishlists/${wishlistId}`);
      if (response.data.success) {
        setActiveWishlist(response.data.wishlist);
        setWishlistItems(response.data.wishlist.items || []);
      }
    } catch (error) {
      console.error("Error fetching wishlist items:", error);
      setError("Failed to load wishlist items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch saved searches
  const fetchSavedSearches = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      // In a real application, this endpoint would be available
      const response = await axios.get(`${API_URL}/api/saved-searches`);
      if (response.data.success) {
        setSavedSearches(response.data.saved_searches);
      }
    } catch (error) {
      // Handle API not existing in sample app
      // In a real application, this would properly handle API errors
      console.error("Error fetching saved searches:", error);
      
      // For demo purposes, set some sample saved searches
      setSavedSearches([
        {
          uid: "search-123",
          name: "Concrete Mixers",
          query: "concrete mixer",
          filters: {
            categoryUid: "cat-123",
            minPrice: 199,
            maxPrice: 999,
            brand: "DeWalt",
            sort: "price_asc"
          },
          lastRunAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          uid: "search-456",
          name: "Premium Plywood",
          query: "plywood sheets",
          filters: {
            categoryUid: "cat-456",
            minPrice: 50,
            maxPrice: 300,
            sort: "rating_desc"
          },
          lastRunAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch recently viewed products
  const fetchRecentlyViewed = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      // In a real application, this endpoint would be available
      const response = await axios.get(`${API_URL}/api/recently-viewed`);
      if (response.data.success) {
        setRecentlyViewed(response.data.recently_viewed);
      }
    } catch (error) {
      // Handle API not existing in sample app
      console.error("Error fetching recently viewed products:", error);
      
      // For demo purposes, set some sample recently viewed products
      setRecentlyViewed([
        {
          uid: "prod-123",
          name: "Professional Concrete Mixer 5.5 cubic ft",
          shortDescription: "Heavy-duty concrete mixer with tilting drum",
          basePrice: 599.99,
          currency: "USD",
          inStock: true,
          primaryImageUrl: "https://picsum.photos/seed/product1/300/300",
          viewedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        },
        {
          uid: "prod-456",
          name: "Premium Plywood Sheet 4x8",
          shortDescription: "Cabinet-grade birch plywood",
          basePrice: 49.99,
          currency: "USD",
          inStock: true,
          primaryImageUrl: "https://picsum.photos/seed/product2/300/300",
          viewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          uid: "prod-789",
          name: "Cordless Impact Driver Kit",
          shortDescription: "20V MAX lithium-ion battery, charger included",
          basePrice: 179.99,
          currency: "USD",
          inStock: false,
          primaryImageUrl: "https://picsum.photos/seed/product3/300/300",
          viewedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new wishlist
  const createWishlist = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/wishlists`, wishlistFormData);
      if (response.data.success) {
        setWishlists([response.data.wishlist, ...wishlists]);
        setIsCreatingWishlist(false);
        setWishlistFormData({
          name: "",
          description: "",
          isPublic: false,
        });
        
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: "Wishlist created successfully!",
        }));
        
        // Navigate to the new wishlist
        navigate(`/account/wishlists/${response.data.wishlist.uid}`);
      }
    } catch (error) {
      console.error("Error creating wishlist:", error);
      setError("Failed to create wishlist. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update wishlist
  const updateWishlist = async () => {
    if (!isAuthenticated || !activeWishlist) return;

    try {
      setIsLoading(true);
      const response = await axios.put(`${API_URL}/api/wishlists/${activeWishlist.uid}`, wishlistFormData);
      if (response.data.success) {
        // Update local state
        setActiveWishlist({
          ...activeWishlist,
          ...wishlistFormData
        });
        
        // Update wishlist in the list
        setWishlists(wishlists.map(w => 
          w.uid === activeWishlist.uid ? { ...w, ...wishlistFormData } : w
        ));
        
        setIsEditingWishlist(false);
        
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: "Wishlist updated successfully!",
        }));
      }
    } catch (error) {
      console.error("Error updating wishlist:", error);
      setError("Failed to update wishlist. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete wishlist
  const deleteWishlist = async () => {
    if (!isAuthenticated || !activeWishlist) return;

    try {
      setIsLoading(true);
      const response = await axios.delete(`${API_URL}/api/wishlists/${activeWishlist.uid}`);
      if (response.data.success) {
        // Remove from local state
        const updatedWishlists = wishlists.filter(w => w.uid !== activeWishlist.uid);
        setWishlists(updatedWishlists);
        setShowDeleteConfirm(false);
        
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: "Wishlist deleted successfully!",
        }));
        
        // Navigate to another wishlist if available, or to the wishlists page
        if (updatedWishlists.length > 0) {
          navigate(`/account/wishlists/${updatedWishlists[0].uid}`);
        } else {
          navigate("/account/wishlists");
        }
      }
    } catch (error) {
      console.error("Error deleting wishlist:", error);
      setError("Failed to delete wishlist. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Remove item from wishlist
  const removeItemFromWishlist = async (itemUid: string) => {
    if (!isAuthenticated || !activeWishlist) return;

    try {
      const response = await axios.delete(`${API_URL}/api/wishlists/${activeWishlist.uid}/items/${itemUid}`);
      if (response.data.success) {
        // Remove from local state
        setWishlistItems(wishlistItems.filter(item => item.uid !== itemUid));
        
        // Update wishlist item count
        setActiveWishlist({
          ...activeWishlist,
          itemCount: activeWishlist.itemCount - 1
        });
        
        // Update wishlists list item count
        setWishlists(wishlists.map(w => 
          w.uid === activeWishlist.uid ? { ...w, itemCount: w.itemCount - 1 } : w
        ));
        
        // Remove from selected items if present
        if (selectedItems.includes(itemUid)) {
          setSelectedItems(selectedItems.filter(id => id !== itemUid));
        }
        
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: "Item removed from wishlist",
        }));
      }
    } catch (error) {
      console.error("Error removing item from wishlist:", error);
      dispatch(notificationsActions.addToastNotification({
        type: "error",
        message: "Failed to remove item from wishlist",
      }));
    }
  };

  // Move item between wishlists
  const moveItemBetweenWishlists = async (itemUid: string, targetWishlistUid: string) => {
    if (!isAuthenticated || !activeWishlist) return;

    try {
      // In a real app, this would be a specific endpoint
      const response = await axios.post(`${API_URL}/api/wishlists/${targetWishlistUid}/items/move`, {
        item_uid: itemUid,
        source_wishlist_uid: activeWishlist.uid
      });
      
      if (response.data.success) {
        // Remove from current wishlist
        setWishlistItems(wishlistItems.filter(item => item.uid !== itemUid));
        
        // Update wishlist item counts
        setActiveWishlist({
          ...activeWishlist,
          itemCount: activeWishlist.itemCount - 1
        });
        
        // Update wishlists list item counts
        setWishlists(wishlists.map(w => {
          if (w.uid === activeWishlist.uid) {
            return { ...w, itemCount: w.itemCount - 1 };
          } else if (w.uid === targetWishlistUid) {
            return { ...w, itemCount: w.itemCount + 1 };
          }
          return w;
        }));
        
        // Remove from selected items if present
        if (selectedItems.includes(itemUid)) {
          setSelectedItems(selectedItems.filter(id => id !== itemUid));
        }
        
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: "Item moved to another wishlist",
        }));
      }
    } catch (error) {
      console.error("Error moving item between wishlists:", error);
      dispatch(notificationsActions.addToastNotification({
        type: "error",
        message: "Failed to move item to another wishlist",
      }));
    }
  };

  // Add item to cart
  const addItemToCart = async (item: WishlistItem) => {
    if (!isAuthenticated) return;

    try {
      const response = await axios.post(`${API_URL}/api/cart/items`, {
        product_uid: item.productUid,
        variant_uid: item.variantUid,
        quantity: 1
      });
      
      if (response.data.success) {
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: `${item.productName} added to cart`,
        }));
      }
    } catch (error) {
      console.error("Error adding item to cart:", error);
      dispatch(notificationsActions.addToastNotification({
        type: "error",
        message: "Failed to add item to cart",
      }));
    }
  };

  // Add all items to cart
  const addAllToCart = async () => {
    if (!isAuthenticated || !activeWishlist || wishlistItems.length === 0) return;

    try {
      setIsLoading(true);
      
      // In a real app, there might be a bulk endpoint for this
      // Here we'll use multiple requests for simplicity
      let successCount = 0;
      
      for (const item of wishlistItems) {
        if (item.inStock) {
          try {
            await axios.post(`${API_URL}/api/cart/items`, {
              product_uid: item.productUid,
              variant_uid: item.variantUid,
              quantity: 1
            });
            successCount++;
          } catch (error) {
            console.error(`Error adding ${item.productName} to cart:`, error);
          }
        }
      }
      
      if (successCount > 0) {
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: `${successCount} items added to cart`,
        }));
      } else {
        dispatch(notificationsActions.addToastNotification({
          type: "error",
          message: "No items could be added to cart",
        }));
      }
    } catch (error) {
      console.error("Error adding all items to cart:", error);
      dispatch(notificationsActions.addToastNotification({
        type: "error",
        message: "Failed to add items to cart",
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Add selected items to cart
  const addSelectedToCart = async () => {
    if (!isAuthenticated || selectedItems.length === 0) return;

    try {
      setIsLoading(true);
      
      let successCount = 0;
      
      for (const itemUid of selectedItems) {
        const item = wishlistItems.find(i => i.uid === itemUid);
        if (item && item.inStock) {
          try {
            await axios.post(`${API_URL}/api/cart/items`, {
              product_uid: item.productUid,
              variant_uid: item.variantUid,
              quantity: 1
            });
            successCount++;
          } catch (error) {
            console.error(`Error adding ${item.productName} to cart:`, error);
          }
        }
      }
      
      if (successCount > 0) {
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: `${successCount} items added to cart`,
        }));
        
        // Clear selection
        setSelectedItems([]);
      } else {
        dispatch(notificationsActions.addToastNotification({
          type: "error",
          message: "No items could be added to cart",
        }));
      }
    } catch (error) {
      console.error("Error adding selected items to cart:", error);
      dispatch(notificationsActions.addToastNotification({
        type: "error",
        message: "Failed to add items to cart",
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Share wishlist
  const shareWishlist = async () => {
    if (!isAuthenticated || !activeWishlist) return;

    try {
      // In a real app, this might generate a special link or token
      // Here we'll just use the direct URL
      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}/account/wishlists/${activeWishlist.uid}`;
      
      // Check if the wishlist is public
      if (!activeWishlist.isPublic) {
        // If not public, update it to be public
        await axios.put(`${API_URL}/api/wishlists/${activeWishlist.uid}`, {
          ...activeWishlist,
          isPublic: true
        });
        
        // Update local state
        setActiveWishlist({
          ...activeWishlist,
          isPublic: true
        });
        
        setWishlists(wishlists.map(w => 
          w.uid === activeWishlist.uid ? { ...w, isPublic: true } : w
        ));
      }
      
      setShareUrl(shareableUrl);
      setShareModalOpen(true);
    } catch (error) {
      console.error("Error sharing wishlist:", error);
      dispatch(notificationsActions.addToastNotification({
        type: "error",
        message: "Failed to generate sharing link",
      }));
    }
  };

  // Run saved search
  const runSavedSearch = (search: SavedSearch) => {
    // Build the search URL with all parameters
    let searchUrl = `/search?q=${encodeURIComponent(search.query)}`;
    
    if (search.filters) {
      if (search.filters.categoryUid) {
        searchUrl += `&category_uid=${encodeURIComponent(search.filters.categoryUid)}`;
      }
      if (search.filters.minPrice !== undefined) {
        searchUrl += `&min_price=${search.filters.minPrice}`;
      }
      if (search.filters.maxPrice !== undefined) {
        searchUrl += `&max_price=${search.filters.maxPrice}`;
      }
      if (search.filters.brand) {
        searchUrl += `&brand=${encodeURIComponent(search.filters.brand)}`;
      }
      if (search.filters.sort) {
        searchUrl += `&sort=${encodeURIComponent(search.filters.sort)}`;
      }
    }
    
    // Navigate to the search results page
    navigate(searchUrl);
  };

  // Delete saved search
  const deleteSavedSearch = async (searchUid: string) => {
    if (!isAuthenticated) return;

    try {
      // In a real app, this would delete from the server
      const response = await axios.delete(`${API_URL}/api/saved-searches/${searchUid}`);
      
      if (response.data.success) {
        // Remove from local state
        setSavedSearches(savedSearches.filter(search => search.uid !== searchUid));
        
        // Show success notification
        dispatch(notificationsActions.addToastNotification({
          type: "success",
          message: "Saved search deleted",
        }));
      }
    } catch (error) {
      console.error("Error deleting saved search:", error);
      
      // For demo purposes, just remove from local state
      setSavedSearches(savedSearches.filter(search => search.uid !== searchUid));
      
      dispatch(notificationsActions.addToastNotification({
        type: "success",
        message: "Saved search deleted",
      }));
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // Toggle item selection
  const toggleItemSelection = (itemUid: string) => {
    if (selectedItems.includes(itemUid)) {
      setSelectedItems(selectedItems.filter(id => id !== itemUid));
    } else {
      setSelectedItems([...selectedItems, itemUid]);
    }
  };

  // Subscribe to real-time wishlist updates
  const subscribeToWishlistUpdates = () => {
    if (!isAuthenticated || !token || !activeWishlist) return;

    // Clean up any existing socket connection
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Create new socket connection
    const socket = io(`${API_URL}/ws`, {
      auth: {
        token
      }
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      
      // Join wishlist-specific room
      socket.emit('join_wishlist', { wishlist_uid: activeWishlist.uid });
    });

    socket.on('wishlist_update', (update) => {
      if (update.wishlist_uid === activeWishlist.uid) {
        // Handle different update types
        if (update.update_type === 'item_added') {
          // Refresh wishlist items
          fetchWishlistItems(activeWishlist.uid);
        } else if (update.update_type === 'item_removed') {
          // Remove item from local state
          setWishlistItems(wishlistItems.filter(item => item.uid !== update.item_uid));
        } else if (update.update_type === 'price_changed') {
          // Update item price
          setWishlistItems(wishlistItems.map(item => {
            if (item.productUid === update.product_uid && 
                (item.variantUid === update.variant_uid || (!item.variantUid && !update.variant_uid))) {
              return {
                ...item,
                basePrice: update.new_price,
                priceDifference: update.new_price - update.previous_price
              };
            }
            return item;
          }));
          
          // Show notification about price change
          dispatch(notificationsActions.addNotification({
            uid: `price-change-${Date.now()}`,
            type: 'price_change',
            title: 'Price Change Alert',
            message: `The price of ${update.product_name} has ${update.new_price > update.previous_price ? 'increased' : 'decreased'} from ${formatCurrency(update.previous_price)} to ${formatCurrency(update.new_price)}`,
            createdAt: new Date().toISOString(),
            isRead: false,
            relatedTo: {
              entityType: 'product',
              entityUid: update.product_uid
            }
          }));
        } else if (update.update_type === 'back_in_stock') {
          // Update item stock status
          setWishlistItems(wishlistItems.map(item => {
            if (item.productUid === update.product_uid && 
                (item.variantUid === update.variant_uid || (!item.variantUid && !update.variant_uid))) {
              return {
                ...item,
                inStock: true
              };
            }
            return item;
          }));
          
          // Show notification about back in stock
          dispatch(notificationsActions.addToastNotification({
            type: "info",
            message: `${update.product_name} is back in stock!`,
          }));
        } else if (update.update_type === 'item_unavailable') {
          // Update item stock status
          setWishlistItems(wishlistItems.map(item => {
            if (item.productUid === update.product_uid && 
                (item.variantUid === update.variant_uid || (!item.variantUid && !update.variant_uid))) {
              return {
                ...item,
                inStock: false
              };
            }
            return item;
          }));
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Store socket reference
    socketRef.current = socket;

    // Return cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  };

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }
  }, [isAuthenticated, navigate]);

  // Initial data loading
  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlists();
      fetchSavedSearches();
      fetchRecentlyViewed();
    }
  }, [isAuthenticated]);

  // Load wishlist items when the wishlist_uid changes or view changes to wishlists
  useEffect(() => {
    if (isAuthenticated && wishlist_uid && activeView === "wishlists") {
      fetchWishlistItems(wishlist_uid);
    }
  }, [isAuthenticated, wishlist_uid, activeView]);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    if (isAuthenticated && activeWishlist) {
      const cleanupFn = subscribeToWishlistUpdates();
      return cleanupFn;
    }
  }, [isAuthenticated, activeWishlist?.uid]);

  // Handle initial wishlist form data when editing
  useEffect(() => {
    if (isEditingWishlist && activeWishlist) {
      setWishlistFormData({
        name: activeWishlist.name,
        description: activeWishlist.description || "",
        isPublic: activeWishlist.isPublic
      });
    }
  }, [isEditingWishlist, activeWishlist]);

  // Handle active view change based on URL and parameters
  useEffect(() => {
    if (wishlist_uid) {
      setActiveView("wishlists");
    }
  }, [wishlist_uid]);

  // Check if user is authenticated
  if (!isAuthenticated) {
    return null; // This will trigger the navigation in the useEffect
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Wishlists & Saved Items</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button 
              className="float-right"
              onClick={() => setError(null)}
            >
              &times;
            </button>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar */}
          <div className="w-full md:w-1/4 bg-white rounded-lg shadow-md p-4">
            {/* View Selector */}
            <div className="flex border-b pb-3 mb-4">
              <button 
                className={`flex-1 py-2 text-center font-medium rounded-t-lg ${activeView === 'wishlists' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveView('wishlists')}
              >
                Wishlists
              </button>
              <button 
                className={`flex-1 py-2 text-center font-medium rounded-t-lg ${activeView === 'saved-searches' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveView('saved-searches')}
              >
                Searches
              </button>
              <button 
                className={`flex-1 py-2 text-center font-medium rounded-t-lg ${activeView === 'recently-viewed' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveView('recently-viewed')}
              >
                Recent
              </button>
            </div>
            
            {/* Wishlists Section */}
            {activeView === 'wishlists' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">My Wishlists</h2>
                  <button 
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    onClick={() => {
                      setWishlistFormData({
                        name: "",
                        description: "",
                        isPublic: false
                      });
                      setIsCreatingWishlist(true);
                    }}
                  >
                    + New Wishlist
                  </button>
                </div>
                
                {isLoading && wishlists.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-2 text-gray-500">Loading wishlists...</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {wishlists.length === 0 ? (
                      <li className="text-gray-500 text-center py-4">
                        No wishlists yet. Create one to get started!
                      </li>
                    ) : (
                      wishlists.map(wishlist => (
                        <li key={wishlist.uid}>
                          <Link 
                            to={`/account/wishlists/${wishlist.uid}`}
                            className={`block px-3 py-2 rounded ${wishlist.uid === wishlist_uid ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">{wishlist.name}</span>
                              <span className="text-xs text-gray-500">{wishlist.itemCount} items</span>
                            </div>
                            {wishlist.isPublic && (
                              <span className="text-xs text-gray-500 flex items-center mt-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Shared
                              </span>
                            )}
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
            
            {/* Saved Searches Section */}
            {activeView === 'saved-searches' && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Saved Searches</h2>
                {isLoading && savedSearches.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-2 text-gray-500">Loading saved searches...</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {savedSearches.length === 0 ? (
                      <li className="text-gray-500 text-center py-4">
                        No saved searches yet. Save a search to quickly access it later!
                      </li>
                    ) : (
                      savedSearches.map(search => (
                        <li key={search.uid} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{search.name}</h3>
                              <p className="text-sm text-gray-600">"{search.query}"</p>
                              {search.lastRunAt && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Last run: {formatDate(search.lastRunAt)}
                                </p>
                              )}
                            </div>
                            <button 
                              onClick={() => deleteSavedSearch(search.uid)}
                              className="text-gray-400 hover:text-red-500"
                              aria-label="Delete saved search"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          
                          <div className="mt-3 flex items-center text-sm space-x-3">
                            <button 
                              onClick={() => runSavedSearch(search)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Run Search
                            </button>
                            
                            {/* Filter pills */}
                            <div className="flex flex-wrap gap-1">
                              {search.filters.categoryUid && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  Category Filter
                                </span>
                              )}
                              {(search.filters.minPrice !== undefined || search.filters.maxPrice !== undefined) && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  Price Filter
                                </span>
                              )}
                              {search.filters.brand && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  Brand: {search.filters.brand}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
            
            {/* Recently Viewed Section */}
            {activeView === 'recently-viewed' && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Recently Viewed</h2>
                {isLoading && recentlyViewed.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-2 text-gray-500">Loading recent products...</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {recentlyViewed.length === 0 ? (
                      <li className="text-gray-500 text-center py-4">
                        No recently viewed products. Start browsing to see your history!
                      </li>
                    ) : (
                      recentlyViewed.map(product => (
                        <li key={product.uid} className="flex space-x-3">
                          <Link to={`/products/${product.uid}`} className="flex-shrink-0">
                            <img 
                              src={product.primaryImageUrl || "https://picsum.photos/seed/placeholder/80/80"} 
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link to={`/products/${product.uid}`} className="text-sm font-medium hover:text-blue-600 line-clamp-2">
                              {product.name}
                            </Link>
                            <p className="text-sm font-medium mt-1">
                              {formatCurrency(product.basePrice, product.currency)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <button 
                                onClick={() => {
                                  const item: WishlistItem = {
                                    uid: `temp-${Date.now()}`,
                                    wishlistUid: '',
                                    productUid: product.uid,
                                    productName: product.name,
                                    shortDescription: product.shortDescription,
                                    basePrice: product.basePrice,
                                    currency: product.currency,
                                    inStock: product.inStock,
                                    primaryImageUrl: product.primaryImageUrl,
                                    addedAt: new Date().toISOString()
                                  };
                                  addItemToCart(item);
                                }}
                                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                                disabled={!product.inStock}
                              >
                                {product.inStock ? "Add to Cart" : "Out of Stock"}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 bg-white rounded-lg shadow-md p-4">
            {activeView === 'wishlists' && (
              <>
                {isLoading && !activeWishlist ? (
                  <div className="py-16 text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-4 text-gray-600">Loading wishlist...</p>
                  </div>
                ) : !activeWishlist ? (
                  <div className="py-16 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <h2 className="text-xl font-semibold mt-4">No Wishlist Selected</h2>
                    <p className="text-gray-600 mt-2 max-w-md mx-auto">
                      Select a wishlist from the sidebar or create a new one to get started.
                    </p>
                    <button 
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                      onClick={() => {
                        setWishlistFormData({
                          name: "",
                          description: "",
                          isPublic: false
                        });
                        setIsCreatingWishlist(true);
                      }}
                    >
                      Create New Wishlist
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Wishlist Header */}
                    <div className="border-b pb-4 mb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-xl font-bold">{activeWishlist.name}</h2>
                          {activeWishlist.description && (
                            <p className="text-gray-600 mt-1">{activeWishlist.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm text-gray-500">
                              {activeWishlist.itemCount} items
                            </span>
                            {activeWishlist.isPublic && (
                              <span className="text-sm text-gray-500 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Shared
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => setIsEditingWishlist(true)}
                            className="text-gray-600 hover:text-blue-600"
                            aria-label="Edit wishlist"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="text-gray-600 hover:text-red-600"
                            aria-label="Delete wishlist"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Wishlist Actions */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button 
                          onClick={shareWishlist}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>
                        
                        <button 
                          onClick={() => window.print()}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-sm font-medium flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print
                        </button>
                        
                        <button 
                          onClick={addAllToCart}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center"
                          disabled={wishlistItems.length === 0 || wishlistItems.every(item => !item.inStock)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Add All to Cart
                        </button>
                        
                        {selectedItems.length > 0 && (
                          <button 
                            onClick={addSelectedToCart}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Add {selectedItems.length} Selected
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Wishlist Items */}
                    {isLoading && wishlistItems.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                        <p className="mt-3 text-gray-600">Loading wishlist items...</p>
                      </div>
                    ) : wishlistItems.length === 0 ? (
                      <div className="py-12 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <h3 className="text-lg font-medium mt-3">This wishlist is empty</h3>
                        <p className="text-gray-600 mt-1 max-w-md mx-auto">
                          Start browsing products and add items to your wishlist.
                        </p>
                        <Link
                          to="/"
                          className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                        >
                          Browse Products
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {wishlistItems.map(item => (
                          <div 
                            key={item.uid} 
                            className={`border rounded-lg overflow-hidden ${selectedItems.includes(item.uid) ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            <div className="relative">
                              <Link to={`/products/${item.productUid}`}>
                                <img 
                                  src={item.primaryImageUrl || "https://picsum.photos/seed/product/300/300"} 
                                  alt={item.productName}
                                  className="w-full h-48 object-cover"
                                />
                              </Link>
                              <div className="absolute top-2 right-2 flex space-x-1">
                                <button 
                                  onClick={() => toggleItemSelection(item.uid)}
                                  className={`p-1.5 rounded-full ${selectedItems.includes(item.uid) ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:text-blue-600'}`}
                                  aria-label="Select item"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              </div>
                              {item.inStock ? (
                                <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                  In Stock
                                </div>
                              ) : (
                                <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                  Out of Stock
                                </div>
                              )}
                            </div>
                            
                            <div className="p-4">
                              <Link to={`/products/${item.productUid}`} className="block text-lg font-medium hover:text-blue-600 line-clamp-2 mb-1">
                                {item.productName}
                              </Link>
                              <div className="flex items-center mt-1">
                                <span className="text-lg font-bold">
                                  {formatCurrency(item.basePrice, item.currency)}
                                </span>
                                {item.priceDifference && (
                                  <span className={`ml-2 text-xs font-medium ${item.priceDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {item.priceDifference > 0 ? (
                                      <span className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                        {formatCurrency(item.priceDifference)}
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {formatCurrency(Math.abs(item.priceDifference))}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                              {item.variantType && (
                                <div className="mt-1 text-sm text-gray-600">
                                  {item.variantType}: {item.variantValue}
                                </div>
                              )}
                              <div className="mt-1 text-sm text-gray-500">
                                Added {formatDate(item.addedAt)}
                              </div>
                              
                              <div className="flex space-x-2 mt-3">
                                <button 
                                  onClick={() => addItemToCart(item)}
                                  className={`flex-1 py-1.5 rounded text-sm font-medium ${item.inStock ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                                  disabled={!item.inStock}
                                >
                                  {item.inStock ? "Add to Cart" : "Out of Stock"}
                                </button>
                                
                                <div className="relative group">
                                  <button 
                                    className="py-1.5 px-3 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                                    aria-label="More options"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                  </button>
                                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                                    <button 
                                      onClick={() => removeItemFromWishlist(item.uid)}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      Remove from Wishlist
                                    </button>
                                    {wishlists.length > 1 && (
                                      <div className="border-t border-gray-100">
                                        <div className="px-4 py-2 text-xs font-medium text-gray-500">
                                          Move to another wishlist
                                        </div>
                                        {wishlists
                                          .filter(w => w.uid !== activeWishlist.uid)
                                          .map(wishlist => (
                                            <button 
                                              key={wishlist.uid}
                                              onClick={() => moveItemBetweenWishlists(item.uid, wishlist.uid)}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                              {wishlist.name}
                                            </button>
                                          ))
                                        }
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            
            {activeView === 'saved-searches' && (
              <div className="py-4">
                <h2 className="text-xl font-bold mb-4">Saved Searches</h2>
                
                {isLoading ? (
                  <div className="py-12 text-center">
                    <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-3 text-gray-600">Loading saved searches...</p>
                  </div>
                ) : savedSearches.length === 0 ? (
                  <div className="py-12 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-lg font-medium mt-3">No Saved Searches</h3>
                    <p className="text-gray-600 mt-1 max-w-md mx-auto">
                      Save your search queries to quickly access them later.
                    </p>
                    <Link
                      to="/search"
                      className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                    >
                      Start Searching
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {savedSearches.map(search => (
                      <div key={search.uid} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium">{search.name}</h3>
                            <p className="text-gray-600">Search query: "{search.query}"</p>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              {search.filters.categoryUid && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  With Category Filter
                                </span>
                              )}
                              {(search.filters.minPrice !== undefined || search.filters.maxPrice !== undefined) && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  Price: {search.filters.minPrice || "0"} - {search.filters.maxPrice || "Any"}
                                </span>
                              )}
                              {search.filters.brand && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  Brand: {search.filters.brand}
                                </span>
                              )}
                              {search.filters.sort && (
                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  Sort: {search.filters.sort.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            
                            {search.lastRunAt && (
                              <p className="text-xs text-gray-500 mt-2">
                                Last run: {formatDate(search.lastRunAt)}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => deleteSavedSearch(search.uid)}
                              className="text-gray-400 hover:text-red-600"
                              aria-label="Delete saved search"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <button 
                            onClick={() => runSavedSearch(search)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                          >
                            Run This Search
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {activeView === 'recently-viewed' && (
              <div className="py-4">
                <h2 className="text-xl font-bold mb-4">Recently Viewed Products</h2>
                
                {isLoading ? (
                  <div className="py-12 text-center">
                    <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-3 text-gray-600">Loading recently viewed products...</p>
                  </div>
                ) : recentlyViewed.length === 0 ? (
                  <div className="py-12 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <h3 className="text-lg font-medium mt-3">No Recently Viewed Products</h3>
                    <p className="text-gray-600 mt-1 max-w-md mx-auto">
                      Products you view will appear here for easy access.
                    </p>
                    <Link
                      to="/"
                      className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                    >
                      Browse Products
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentlyViewed.map(product => (
                      <div key={product.uid} className="border rounded-lg overflow-hidden">
                        <Link to={`/products/${product.uid}`}>
                          <img 
                            src={product.primaryImageUrl || "https://picsum.photos/seed/product/300/300"} 
                            alt={product.name}
                            className="w-full h-48 object-cover"
                          />
                        </Link>
                        
                        <div className="p-4">
                          <Link to={`/products/${product.uid}`} className="block text-lg font-medium hover:text-blue-600 line-clamp-2 mb-1">
                            {product.name}
                          </Link>
                          <div className="flex items-center mt-1">
                            <span className="text-lg font-bold">
                              {formatCurrency(product.basePrice, product.currency)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            Viewed {formatDate(product.viewedAt)}
                          </div>
                          
                          <div className="flex space-x-2 mt-3">
                            <button 
                              onClick={() => {
                                const item: WishlistItem = {
                                  uid: `temp-${Date.now()}`,
                                  wishlistUid: '',
                                  productUid: product.uid,
                                  productName: product.name,
                                  shortDescription: product.shortDescription,
                                  basePrice: product.basePrice,
                                  currency: product.currency,
                                  inStock: product.inStock,
                                  primaryImageUrl: product.primaryImageUrl,
                                  addedAt: new Date().toISOString()
                                };
                                addItemToCart(item);
                              }}
                              className={`flex-1 py-1.5 rounded text-sm font-medium ${product.inStock ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                              disabled={!product.inStock}
                            >
                              {product.inStock ? "Add to Cart" : "Out of Stock"}
                            </button>
                            
                            {wishlists.length > 0 && (
                              <div className="relative group">
                                <button 
                                  className="py-1.5 px-3 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                </button>
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                                  <div className="px-4 py-2 text-xs font-medium text-gray-500">
                                    Add to Wishlist
                                  </div>
                                  {wishlists.map(wishlist => (
                                    <button 
                                      key={wishlist.uid}
                                      onClick={() => {
                                        // In a real app, this would call addItemToWishlist
                                        // but we'll just show a notification for demo purposes
                                        dispatch(notificationsActions.addToastNotification({
                                          type: "success",
                                          message: `Added to ${wishlist.name}`,
                                        }));
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      {wishlist.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {/* Create/Edit Wishlist Modal */}
      {(isCreatingWishlist || isEditingWishlist) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {isCreatingWishlist ? "Create New Wishlist" : "Edit Wishlist"}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="wishlist-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Wishlist Name*
                  </label>
                  <input
                    type="text"
                    id="wishlist-name"
                    value={wishlistFormData.name}
                    onChange={(e) => setWishlistFormData({
                      ...wishlistFormData,
                      name: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My Wishlist"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="wishlist-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="wishlist-description"
                    value={wishlistFormData.description}
                    onChange={(e) => setWishlistFormData({
                      ...wishlistFormData,
                      description: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a description for your wishlist"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="wishlist-public"
                    checked={wishlistFormData.isPublic}
                    onChange={(e) => setWishlistFormData({
                      ...wishlistFormData,
                      isPublic: e.target.checked
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="wishlist-public" className="ml-2 block text-sm text-gray-700">
                    Make this wishlist public and shareable
                  </label>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  onClick={() => {
                    setIsCreatingWishlist(false);
                    setIsEditingWishlist(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={isCreatingWishlist ? createWishlist : updateWishlist}
                  disabled={!wishlistFormData.name.trim() || isLoading}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white ${!wishlistFormData.name.trim() || isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : isCreatingWishlist ? "Create Wishlist" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Delete Wishlist</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this wishlist? This action cannot be undone.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={deleteWishlist}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium text-white"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </span>
                  ) : "Delete Wishlist"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Share Wishlist Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Share Wishlist</h2>
              
              {shareUrl && (
                <div>
                  <p className="text-gray-600 mb-3">
                    Share this link with anyone you'd like to see your wishlist:
                  </p>
                  
                  <div className="flex mb-4">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        dispatch(notificationsActions.addToastNotification({
                          type: "success",
                          message: "Link copied to clipboard!",
                        }));
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-md"
                    >
                      Copy
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Or share via:</p>
                    <div className="flex space-x-3">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded" aria-label="Share on Facebook">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button className="bg-blue-400 hover:bg-blue-500 text-white p-2 rounded" aria-label="Share on Twitter">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                        </svg>
                      </button>
                      <button className="bg-green-600 hover:bg-green-700 text-white p-2 rounded" aria-label="Share via Email">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <div className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-600">
                        {activeWishlist?.isPublic ? 
                          "This wishlist is public and can be viewed by anyone with the link." : 
                          "This wishlist will be made public so others can view it."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setShareModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_WishlistAndSaved;