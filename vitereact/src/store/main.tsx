import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// API base URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:1337';

// Configure axios defaults
axios.defaults.baseURL = API_URL;

// Types
// Auth types
interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  profilePictureUrl: string | null;
  companyUid: string | null;
  isVerified: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  tokenExpiry: number | null;
  loading: boolean;
  error: string | null;
}

// Cart types
interface CartItem {
  uid: string;
  productUid: string;
  productName: string;
  variantUid: string | null;
  variantInfo: string | null;
  quantity: number;
  priceSnapshot: number;
  isSavedForLater: boolean;
  primaryImageUrl: string | null;
}

interface CartSummary {
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  itemCount: number;
}

interface CartState {
  cartUid: string | null;
  items: CartItem[];
  summary: CartSummary;
  isLoading: boolean;
  error: string | null;
}

// Notification types
interface NotificationRelatedTo {
  entityType: string;
  entityUid: string;
}

interface Notification {
  uid: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  relatedTo?: NotificationRelatedTo;
}

interface ToastNotification {
  uid: string;
  type: string;
  message: string;
  duration: number;
}

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  toasts: ToastNotification[];
  loading: boolean;
  error: string | null;
}

// UI types
type ThemePreference = 'light' | 'dark' | 'system';
type ViewportSize = 'mobile' | 'tablet' | 'desktop';

interface UIState {
  isMobileMenuOpen: boolean;
  activeModals: string[];
  themePreference: ThemePreference;
  viewportSize: ViewportSize;
  previousRoute: string | null;
}

// Socket interface
interface SocketState {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
}

// Async Thunks
// Auth thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string; remember_me?: boolean }, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/auth/login', credentials);
      
      // Set auth token for future requests
      if (response.data.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'An unexpected error occurred' });
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    // Remove token from axios headers
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear socket connection
    dispatch(disconnectSocket());
    
    return null;
  }
);

// Cart thunks
export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated) {
        return {
          cartUid: null,
          items: [],
          summary: {
            subtotal: 0,
            taxAmount: 0,
            shippingAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            currency: 'USD',
            itemCount: 0
          }
        };
      }
      
      const response = await axios.get('/api/cart');
      return response.data.cart;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to fetch cart' });
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async (payload: { product_uid: string; variant_uid?: string; quantity: number }, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/cart/items', payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to add item to cart' });
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async (payload: { item_uid: string; quantity?: number; is_saved_for_later?: boolean }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/cart/items/${payload.item_uid}`, {
        quantity: payload.quantity,
        is_saved_for_later: payload.is_saved_for_later
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to update cart item' });
    }
  }
);

export const removeCartItem = createAsyncThunk(
  'cart/removeCartItem',
  async (item_uid: string, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`/api/cart/items/${item_uid}`);
      return { item_uid, ...response.data };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to remove cart item' });
    }
  }
);

// Notification thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated) {
        return { items: [], unreadCount: 0 };
      }
      
      const response = await axios.get('/api/notifications');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to fetch notifications' });
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notification_uid: string, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/notifications/${notification_uid}/read`);
      return { notification_uid, ...response.data };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to mark notification as read' });
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.put('/api/notifications/read-all');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ message: 'Failed to mark all notifications as read' });
    }
  }
);

// Socket thunks
export const connectSocket = createAsyncThunk(
  'socket/connect',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    
    if (!state.auth.isAuthenticated || !state.auth.token) {
      return { connected: false };
    }
    
    try {
      // Initialize socket connection
      const socket = io(`${API_URL}/ws`, {
        auth: {
          token: state.auth.token
        }
      });
      
      // Store socket reference for later use
      socketInstance = socket;
      
      // Set up socket event handlers
      socket.on('connect', () => {
        dispatch(socketActions.setConnected(true));
        console.log('Socket connected');
        
        // Join user-specific room for personalized updates
        if (state.auth.user?.uid) {
          socket.emit('join_user', { user_uid: state.auth.user.uid });
        }
      });
      
      socket.on('disconnect', () => {
        dispatch(socketActions.setConnected(false));
        console.log('Socket disconnected');
      });
      
      socket.on('reconnecting', () => {
        dispatch(socketActions.setReconnecting(true));
      });
      
      socket.on('connect_error', (error) => {
        dispatch(socketActions.setError(error.message));
        console.error('Socket connection error:', error);
      });
      
      // Handle notifications
      socket.on('notification', (notification: Notification) => {
        dispatch(notificationsActions.addNotification(notification));
      });
      
      // Handle cart updates
      socket.on('cart_update', (update) => {
        dispatch(cartActions.handleCartUpdate(update));
      });
      
      // Handle order status updates
      socket.on('order_status_update', (update) => {
        // Add notification about order status change
        dispatch(notificationsActions.addNotification({
          uid: `order-status-${Date.now()}`,
          type: 'order_status',
          title: 'Order Status Updated',
          message: `Order ${update.order_number} status changed to ${update.new_status}`,
          createdAt: new Date().toISOString(),
          isRead: false,
          relatedTo: {
            entityType: 'order',
            entityUid: update.order_uid
          }
        }));
      });
      
      return { connected: true };
    } catch (error) {
      console.error('Socket connection failed:', error);
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
);

export const disconnectSocket = createAsyncThunk(
  'socket/disconnect',
  async () => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
    return { connected: false };
  }
);

// Store socket instance
let socketInstance: Socket | null = null;

// Create slices
// Auth slice
const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  tokenExpiry: null,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    // Helper reducers for non-async operations
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        
        // Set token expiry (default to 24 hours if not specified)
        const expiresIn = action.payload.expiresIn || 86400; // seconds
        state.tokenExpiry = Date.now() + expiresIn * 1000;
        
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.tokenExpiry = null;
        state.loading = false;
        state.error = action.payload ? (action.payload as any).message : action.error.message || 'Login failed';
      })
      
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.tokenExpiry = null;
        state.error = null;
      });
  }
});

// Cart slice
const initialCartState: CartState = {
  cartUid: null,
  items: [],
  summary: {
    subtotal: 0,
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    currency: 'USD',
    itemCount: 0
  },
  isLoading: false,
  error: null
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCartState,
  reducers: {
    clearCart: (state) => {
      state.items = [];
      state.summary = {
        subtotal: 0,
        taxAmount: 0,
        shippingAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        currency: 'USD',
        itemCount: 0
      };
    },
    clearCartError: (state) => {
      state.error = null;
    },
    handleCartUpdate: (state, action: PayloadAction<any>) => {
      const update = action.payload;
      
      switch (update.update_type) {
        case 'item_added':
          // Optimistic update - server will confirm with fetchCart
          break;
        
        case 'item_removed':
          state.items = state.items.filter(item => item.uid !== update.item_uid);
          state.summary.itemCount = update.item_count;
          state.summary.subtotal = update.cart_total;
          // Re-calculate total
          state.summary.totalAmount = 
            state.summary.subtotal + 
            state.summary.taxAmount + 
            state.summary.shippingAmount - 
            state.summary.discountAmount;
          break;
        
        case 'quantity_changed':
          const itemToUpdate = state.items.find(item => item.uid === update.item_uid);
          if (itemToUpdate) {
            itemToUpdate.quantity = update.new_quantity;
          }
          state.summary.itemCount = update.item_count;
          state.summary.subtotal = update.cart_total;
          // Re-calculate total
          state.summary.totalAmount = 
            state.summary.subtotal + 
            state.summary.taxAmount + 
            state.summary.shippingAmount - 
            state.summary.discountAmount;
          break;
        
        case 'moved_to_saved':
          const itemToSave = state.items.find(item => item.uid === update.item_uid);
          if (itemToSave) {
            itemToSave.isSavedForLater = true;
          }
          state.summary.itemCount = update.item_count;
          state.summary.subtotal = update.cart_total;
          // Re-calculate total
          state.summary.totalAmount = 
            state.summary.subtotal + 
            state.summary.taxAmount + 
            state.summary.shippingAmount - 
            state.summary.discountAmount;
          break;
        
        case 'price_changed':
          // Full cart refresh needed for price changes
          break;
        
        case 'item_unavailable':
          // Mark item as unavailable or show notification
          break;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch cart
      .addCase(fetchCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        if (action.payload) {
          state.cartUid = action.payload.uid;
          state.items = action.payload.items;
          state.summary = action.payload.summary || {
            subtotal: 0,
            taxAmount: 0,
            shippingAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            currency: 'USD',
            itemCount: 0
          };
        }
        state.isLoading = false;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ? (action.payload as any).message : action.error.message || 'Failed to fetch cart';
      })
      
      // Add to cart
      .addCase(addToCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        // Optimistic UI update handled by real-time cart_update event
        // This just handles the completion of the API call
        state.isLoading = false;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ? (action.payload as any).message : action.error.message || 'Failed to add item to cart';
      })
      
      // Update cart item
      .addCase(updateCartItem.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCartItem.fulfilled, (state, action) => {
        // Updates handled by real-time cart_update event
        state.isLoading = false;
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ? (action.payload as any).message : action.error.message || 'Failed to update cart item';
      })
      
      // Remove cart item
      .addCase(removeCartItem.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeCartItem.fulfilled, (state, action) => {
        // Optimistic UI update
        state.items = state.items.filter(item => item.uid !== action.payload.item_uid);
        
        // Update summary using returned data
        if (action.payload.cart_summary) {
          state.summary = action.payload.cart_summary;
        }
        
        state.isLoading = false;
      })
      .addCase(removeCartItem.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ? (action.payload as any).message : action.error.message || 'Failed to remove cart item';
      })
      
      // Clear cart on logout
      .addCase(logout.fulfilled, (state) => {
        state.cartUid = null;
        state.items = [];
        state.summary = {
          subtotal: 0,
          taxAmount: 0,
          shippingAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          currency: 'USD',
          itemCount: 0
        };
      });
  }
});

// Notifications slice
const initialNotificationsState: NotificationsState = {
  items: [],
  unreadCount: 0,
  toasts: [],
  loading: false,
  error: null
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: initialNotificationsState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.items.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    addToastNotification: (state, action: PayloadAction<{ message: string; type: string; duration?: number }>) => {
      const { message, type, duration = 5000 } = action.payload;
      
      state.toasts.push({
        uid: `toast-${Date.now()}`,
        type,
        message,
        duration
      });
    },
    clearToastNotification: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.uid !== action.payload);
    },
    clearNotification: (state, action: PayloadAction<string>) => {
      const notification = state.items.find(item => item.uid === action.payload);
      
      if (notification && !notification.isRead) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
      
      state.items = state.items.filter(item => item.uid !== action.payload);
    },
    clearNotificationsError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        if (action.payload) {
          state.items = action.payload.items || [];
          state.unreadCount = action.payload.unreadCount || 0;
        }
        state.loading = false;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ? (action.payload as any).message : action.error.message || 'Failed to fetch notifications';
      })
      
      // Mark notification as read
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notification = state.items.find(item => item.uid === action.payload.notification_uid);
        
        if (notification && !notification.isRead) {
          notification.isRead = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      
      // Mark all notifications as read
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.items.forEach(item => {
          item.isRead = true;
        });
        state.unreadCount = 0;
      })
      
      // Clear notifications on logout
      .addCase(logout.fulfilled, (state) => {
        state.items = [];
        state.unreadCount = 0;
      });
  }
});

// UI slice
const initialUIState: UIState = {
  isMobileMenuOpen: false,
  activeModals: [],
  themePreference: 'system',
  viewportSize: 'desktop',
  previousRoute: null
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUIState,
  reducers: {
    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },
    setMobileMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isMobileMenuOpen = action.payload;
    },
    openModal: (state, action: PayloadAction<string>) => {
      if (!state.activeModals.includes(action.payload)) {
        state.activeModals.push(action.payload);
      }
    },
    closeModal: (state, action: PayloadAction<string>) => {
      state.activeModals = state.activeModals.filter(modal => modal !== action.payload);
    },
    closeAllModals: (state) => {
      state.activeModals = [];
    },
    setThemePreference: (state, action: PayloadAction<ThemePreference>) => {
      state.themePreference = action.payload;
    },
    updateViewportSize: (state, action: PayloadAction<ViewportSize>) => {
      state.viewportSize = action.payload;
    },
    setPreviousRoute: (state, action: PayloadAction<string>) => {
      state.previousRoute = action.payload;
    }
  }
});

// Socket slice
const initialSocketState: SocketState = {
  connected: false,
  reconnecting: false,
  error: null
};

const socketSlice = createSlice({
  name: 'socket',
  initialState: initialSocketState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
      if (action.payload) {
        state.reconnecting = false;
        state.error = null;
      }
    },
    setReconnecting: (state, action: PayloadAction<boolean>) => {
      state.reconnecting = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(connectSocket.fulfilled, (state, action) => {
        state.connected = action.payload.connected;
        state.error = action.payload.error || null;
      })
      .addCase(disconnectSocket.fulfilled, (state) => {
        state.connected = false;
        state.reconnecting = false;
      });
  }
});

// Export actions
export const authActions = authSlice.actions;
export const cartActions = cartSlice.actions;
export const notificationsActions = notificationsSlice.actions;
export const uiActions = uiSlice.actions;
export const socketActions = socketSlice.actions;

// Configure persistence
const authPersistConfig = {
  key: 'auth',
  storage,
  // Don't persist loading and error states
  blacklist: ['loading', 'error']
};

const cartPersistConfig = {
  key: 'cart',
  storage,
  // Don't persist loading and error states
  blacklist: ['isLoading', 'error']
};

const notificationsPersistConfig = {
  key: 'notifications',
  storage,
  // Only persist unread count
  whitelist: ['unreadCount']
};

const uiPersistConfig = {
  key: 'ui',
  storage,
  // Don't persist mobile menu state
  blacklist: ['isMobileMenuOpen', 'activeModals']
};

// Create and export reducers
export const authReducer = persistReducer(authPersistConfig, authSlice.reducer);
export const cartReducer = persistReducer(cartPersistConfig, cartSlice.reducer);
export const notificationsReducer = persistReducer(notificationsPersistConfig, notificationsSlice.reducer);
export const uiReducer = persistReducer(uiPersistConfig, uiSlice.reducer);
export const socketReducer = socketSlice.reducer;

// Create the store
const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    notifications: notificationsReducer,
    ui: uiReducer,
    socket: socketReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Set up auth token on app initialization
store.subscribe(() => {
  const state = store.getState();
  const token = state.auth.token;
  
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Function to initialize the store with active connections if user is authenticated
export const initializeStore = async () => {
  const state = store.getState();
  
  if (state.auth.isAuthenticated && state.auth.token) {
    // Connect socket for real-time updates
    store.dispatch(connectSocket());
    
    // Fetch initial data
    store.dispatch(fetchCart());
    store.dispatch(fetchNotifications());
  }
};

// Export the store as default
export default store;