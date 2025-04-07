import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAppSelector, useAppDispatch, addToCart, notificationsActions } from "@/store/main";
import axios from "axios";
import { io, Socket } from "socket.io-client";

const API_URL = "http://localhost:1337";

// Rating star component
const StarRating: React.FC<{ rating: number; size?: string }> = ({ rating, size = "w-5 h-5" }) => {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${size} ${
            star <= rating ? "text-yellow-400" : "text-gray-300"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

const UV_ProductDetails: React.FC = () => {
  const { product_uid } = useParams<{ product_uid: string }>();
  const [searchParams] = useSearchParams();
  const variantParam = searchParams.get("variant");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Global state
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const { viewportSize } = useAppSelector((state) => state.uiState);

  // Local state
  const [isLoading, setIsLoading] = useState(true);
  const [productData, setProductData] = useState<any>(null);
  const [productImages, setProductImages] = useState<Array<any>>([]);
  const [productVariants, setProductVariants] = useState<Array<any>>([]);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [productSpecifications, setProductSpecifications] = useState<Array<any>>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'documents' | 'reviews' | 'questions'>('description');
  const [reviews, setReviews] = useState<any>({
    summary: {
      averageRating: 0,
      totalReviews: 0,
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStars: 0
    },
    items: []
  });
  const [questions, setQuestions] = useState<Array<any>>([]);
  const [relatedProducts, setRelatedProducts] = useState<Array<any>>([]);
  const [frequentlyBoughtTogether, setFrequentlyBoughtTogether] = useState<Array<any>>([]);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [userWishlists, setUserWishlists] = useState<Array<any>>([]);
  const [selectedWishlist, setSelectedWishlist] = useState<string>("");
  const [isWishlistDropdownOpen, setIsWishlistDropdownOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  
  // Form states
  const [reviewForm, setReviewForm] = useState({
    rating: null as number | null,
    title: '',
    content: '',
    pros: '',
    cons: '',
    images: [] as File[]
  });
  
  const [questionForm, setQuestionForm] = useState({
    questionText: ''
  });

  // Loading states
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  
  // Error states
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  
  // Refs
  const mainImageRef = useRef<HTMLImageElement>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Organize variants by type for display
  const variantsByType: Record<string, any[]> = productVariants.reduce((acc, variant) => {
    const type = variant.variantType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(variant);
    return acc;
  }, {});

  // Format product specifications by group
  const specificationsByGroup = productSpecifications.reduce((acc, spec) => {
    if (!acc[spec.specificationGroup]) {
      acc[spec.specificationGroup] = [];
    }
    acc[spec.specificationGroup].push(spec);
    return acc;
  }, {} as Record<string, any[]>);

  // Format price including currency
  const formatPrice = (price: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(price);
  };

  // Fetch product details
  const fetchProductDetails = async () => {
    if (!product_uid) return;
    
    setIsLoading(true);
    setLoadingError(null);
    
    try {
      const response = await axios.get(`${API_URL}/api/products/${product_uid}`);
      
      if (response.data.success) {
        const { product } = response.data;
        setProductData(product);
        setProductImages(product.images || []);
        setProductVariants(product.variants || []);
        setProductSpecifications(product.specifications || []);
        
        // Set primary image as first gallery image
        const primaryImageIndex = product.images.findIndex((img: any) => img.is_primary);
        setGalleryIndex(primaryImageIndex !== -1 ? primaryImageIndex : 0);
        
        // If variant param exists, select the matching variant
        if (variantParam && product.variants) {
          const matchingVariant = product.variants.find((v: any) => v.uid === variantParam);
          if (matchingVariant) {
            setSelectedVariant(matchingVariant);
          }
        }
        
        setRelatedProducts(product.related_products || []);
        
        // Generate frequently bought together based on related products
        // In a real app, this would come from the backend
        if (product.related_products && product.related_products.length > 0) {
          const randomProducts = [...product.related_products]
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map((p: any) => ({
              ...p,
              isInCart: cartItems.some(item => item.productUid === p.uid)
            }));
          
          setFrequentlyBoughtTogether(randomProducts);
        }
      } else {
        setLoadingError("Failed to load product details");
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
      setLoadingError("Failed to load product details. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch reviews
  const fetchReviews = async () => {
    if (!product_uid) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/products/${product_uid}/reviews`);
      
      if (response.data.success) {
        const reviewData = {
          summary: response.data.product?.review_stats || {
            averageRating: 0,
            totalReviews: 0,
            fiveStars: 0,
            fourStars: 0,
            threeStars: 0,
            twoStars: 0,
            oneStars: 0
          },
          items: response.data.reviews || []
        };
        
        setReviews(reviewData);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      // Not setting global error since this is less critical
    }
  };

  // Fetch questions
  const fetchQuestions = async () => {
    if (!product_uid) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/products/${product_uid}/questions`);
      
      if (response.data.success) {
        setQuestions(response.data.questions || []);
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
      // Not setting global error since this is less critical
    }
  };

  // Check if product is in any wishlist
  const checkWishlistStatus = async () => {
    if (!isAuthenticated || !product_uid) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/wishlists`);
      
      if (response.data.success) {
        // For each wishlist, check if it contains the current product
        const wishlists = response.data.wishlists || [];
        
        // We'd need a separate API to check if product is in wishlist, but
        // since it's not in the API spec, we'll simulate it by checking wishlist items
        let inWishlist = false;
        
        for (const wishlist of wishlists) {
          try {
            const itemsResponse = await axios.get(`${API_URL}/api/wishlists/${wishlist.uid}`);
            if (itemsResponse.data.success) {
              const items = itemsResponse.data.wishlist.items || [];
              if (items.some((item: any) => item.product_uid === product_uid)) {
                inWishlist = true;
                break;
              }
            }
          } catch (error) {
            console.error("Error checking wishlist items:", error);
          }
        }
        
        setIsInWishlist(inWishlist);
      }
    } catch (error) {
      console.error("Error checking wishlist status:", error);
    }
  };

  // Fetch user's wishlists
  const fetchUserWishlists = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/wishlists`);
      
      if (response.data.success) {
        setUserWishlists(response.data.wishlists || []);
        
        // Set first wishlist as selected if exists
        if (response.data.wishlists && response.data.wishlists.length > 0) {
          setSelectedWishlist(response.data.wishlists[0].uid);
        }
      }
    } catch (error) {
      console.error("Error fetching wishlists:", error);
    }
  };

  // Setup websocket for real-time inventory and price updates
  const setupWebsocketConnections = () => {
    if (!product_uid || socketRef.current) return;
    
    try {
      // Get auth token from local storage (assuming it's stored there by the auth system)
      const token = localStorage.getItem('auth_token');
      
      socketRef.current = io(`${API_URL}/ws`, {
        auth: { token }
      });
      
      // Join product-specific room for updates
      socketRef.current.emit('join_product', { product_uid });
      
      // Listen for inventory updates
      socketRef.current.on('inventory_update', (update) => {
        if (update.product_uid === product_uid) {
          // Update product inventory in state
          setProductData((prev: any) => ({
            ...prev,
            quantity_available: update.new_quantity
          }));
          
          // If update is for a variant, update the variant inventory
          if (update.variant_uid) {
            setProductVariants(prev => {
              return prev.map(variant => {
                if (variant.uid === update.variant_uid) {
                  return { ...variant, quantity_available: update.new_quantity };
                }
                return variant;
              });
            });
            
            // Also update selected variant if it's the one that changed
            if (selectedVariant && selectedVariant.uid === update.variant_uid) {
              setSelectedVariant(prev => ({
                ...prev,
                quantity_available: update.new_quantity
              }));
            }
          }
          
          // Show notification for back in stock
          if (update.back_in_stock) {
            dispatch(notificationsActions.addToastNotification({
              message: `${productData?.name} is now back in stock!`,
              type: 'success'
            }));
          }
        }
      });
      
      // Listen for price updates
      socketRef.current.on('price_update', (update) => {
        if (update.product_uid === product_uid) {
          // Update product price in state
          setProductData((prev: any) => ({
            ...prev,
            base_price: update.new_price
          }));
          
          // If update is for a variant, update the variant price
          if (update.variant_uid) {
            setProductVariants(prev => {
              return prev.map(variant => {
                if (variant.uid === update.variant_uid) {
                  return { 
                    ...variant,
                    additional_price: update.new_price - (productData?.base_price || 0)
                  };
                }
                return variant;
              });
            });
            
            // Also update selected variant if it's the one that changed
            if (selectedVariant && selectedVariant.uid === update.variant_uid) {
              setSelectedVariant(prev => ({
                ...prev,
                additional_price: update.new_price - (productData?.base_price || 0)
              }));
            }
          }
          
          // Show notification for price change if significant
          if (Math.abs(update.price_change_percentage) > 5) {
            const direction = update.price_change_percentage > 0 ? 'increased' : 'decreased';
            dispatch(notificationsActions.addToastNotification({
              message: `The price of ${productData?.name} has ${direction} by ${Math.abs(update.price_change_percentage)}%`,
              type: direction === 'decreased' ? 'success' : 'info'
            }));
          }
        }
      });
    } catch (error) {
      console.error("Error setting up websocket:", error);
    }
  };

  // Handle variant change
  const handleVariantChange = (variant: any) => {
    setSelectedVariant(variant);
    
    // Update URL with selected variant
    const newParams = new URLSearchParams(searchParams);
    newParams.set('variant', variant.uid);
    navigate(`/products/${product_uid}?${newParams.toString()}`, { replace: true });
    
    // If variant has an image, switch to it
    if (variant.imageUrl) {
      const variantImageIndex = productImages.findIndex(img => img.imageUrl === variant.imageUrl);
      if (variantImageIndex !== -1) {
        setGalleryIndex(variantImageIndex);
      }
    }
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    // Enforce min quantity of 1
    if (newQuantity < 1) newQuantity = 1;
    
    // Enforce max quantity based on inventory
    const maxAvailable = selectedVariant 
      ? selectedVariant.quantity_available 
      : (productData?.quantity_available || 1);
      
    if (newQuantity > maxAvailable) newQuantity = maxAvailable;
    
    setSelectedQuantity(newQuantity);
  };

  // Handle tab change
  const handleTabChange = (tab: 'description' | 'specifications' | 'documents' | 'reviews' | 'questions') => {
    setActiveTab(tab);
    
    // Fetch data for specific tabs if needed
    if (tab === 'reviews' && reviews.items.length === 0) {
      fetchReviews();
    } else if (tab === 'questions' && questions.length === 0) {
      fetchQuestions();
    }
  };

  // Handle gallery navigation
  const handleGalleryNavigation = (index: number) => {
    if (index >= 0 && index < productImages.length) {
      setGalleryIndex(index);
    }
  };

  // Handle image zoom
  const handleImageZoom = (isEntering: boolean, e?: React.MouseEvent) => {
    if (!e || !zoomContainerRef.current || !mainImageRef.current) {
      setIsZoomed(false);
      return;
    }
    
    if (isEntering) {
      setIsZoomed(true);
      
      // Calculate position
      const rect = zoomContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setZoomPosition({ x, y });
    } else {
      setIsZoomed(false);
    }
  };

  // Handle zoom position update during mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isZoomed || !zoomContainerRef.current) return;
    
    const rect = zoomContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setZoomPosition({ x, y });
  };

  // Add to cart
  const handleAddToCart = async () => {
    if (!productData) return;
    
    // Check if product requires variant selection
    if (productData.hasVariants && !selectedVariant) {
      setCartError("Please select a variant before adding to cart");
      return;
    }
    
    setIsAddingToCart(true);
    setCartError(null);
    
    try {
      // Use the addToCart action from global state
      const resultAction = await dispatch(addToCart({
        product_uid: productData.uid,
        variant_uid: selectedVariant?.uid,
        quantity: selectedQuantity
      }));
      
      if (addToCart.fulfilled.match(resultAction)) {
        // Success - show toast notification
        dispatch(notificationsActions.addToastNotification({
          message: `${productData.name} added to your cart`,
          type: 'success'
        }));
      } else {
        // Handle errors
        if (resultAction.payload) {
          setCartError((resultAction.payload as any).message);
        } else {
          setCartError("Failed to add item to cart. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      setCartError("Failed to add item to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Buy now (add to cart and redirect to checkout)
  const handleBuyNow = async () => {
    if (!productData) return;
    
    // First add to cart
    await handleAddToCart();
    
    // Then redirect to checkout if no error
    if (!cartError) {
      navigate('/checkout');
    }
  };

  // Add to wishlist
  const handleAddToWishlist = async () => {
    if (!productData) return;
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Show auth modal (assuming this is defined in the global UI state)
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    // If no wishlists loaded yet, fetch them
    if (userWishlists.length === 0) {
      await fetchUserWishlists();
      setIsWishlistDropdownOpen(true);
      return;
    }
    
    // If user has no wishlists, create one
    if (userWishlists.length === 0) {
      try {
        const response = await axios.post(`${API_URL}/api/wishlists`, {
          name: "My Wishlist",
          description: "My default wishlist",
          is_public: false
        });
        
        if (response.data.success) {
          setUserWishlists([response.data.wishlist]);
          setSelectedWishlist(response.data.wishlist.uid);
        }
      } catch (error) {
        console.error("Error creating wishlist:", error);
        setWishlistError("Failed to create wishlist");
        return;
      }
    }
    
    // If wishlist dropdown is open, close it and proceed
    if (isWishlistDropdownOpen) {
      setIsWishlistDropdownOpen(false);
      
      // If no wishlist selected, show error
      if (!selectedWishlist) {
        setWishlistError("Please select a wishlist");
        return;
      }
    } else {
      // If dropdown not open and we have wishlists, open it
      if (userWishlists.length > 1) {
        setIsWishlistDropdownOpen(true);
        return;
      }
    }
    
    // Now add to the selected wishlist
    setIsAddingToWishlist(true);
    setWishlistError(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/wishlists/${selectedWishlist}/items`, {
        product_uid: productData.uid,
        variant_uid: selectedVariant?.uid || null,
        notes: ""
      });
      
      if (response.data.success) {
        setIsInWishlist(true);
        dispatch(notificationsActions.addToastNotification({
          message: `${productData.name} added to your wishlist`,
          type: 'success'
        }));
      } else {
        setWishlistError("Failed to add to wishlist");
      }
    } catch (error: any) {
      console.error("Error adding to wishlist:", error);
      setWishlistError(error.response?.data?.message || "Failed to add to wishlist");
    } finally {
      setIsAddingToWishlist(false);
    }
  };

  // Submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    // Validate form
    if (!reviewForm.rating || !reviewForm.content) {
      setReviewError("Please provide a rating and review content");
      return;
    }
    
    setIsSubmittingReview(true);
    setReviewError(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/products/${product_uid}/reviews`, {
        rating: reviewForm.rating,
        title: reviewForm.title,
        content: reviewForm.content,
        pros: reviewForm.pros || null,
        cons: reviewForm.cons || null
      });
      
      if (response.data.success) {
        // Reset form
        setReviewForm({
          rating: null,
          title: '',
          content: '',
          pros: '',
          cons: '',
          images: []
        });
        
        // Reload reviews
        fetchReviews();
        
        dispatch(notificationsActions.addToastNotification({
          message: "Your review has been submitted",
          type: 'success'
        }));
      } else {
        setReviewError(response.data.message || "Failed to submit review");
      }
    } catch (error: any) {
      console.error("Error submitting review:", error);
      setReviewError(error.response?.data?.message || "Failed to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Submit question
  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    // Validate form
    if (!questionForm.questionText.trim()) {
      setQuestionError("Please enter your question");
      return;
    }
    
    setIsSubmittingQuestion(true);
    setQuestionError(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/products/${product_uid}/questions`, {
        question_text: questionForm.questionText
      });
      
      if (response.data.success) {
        // Reset form
        setQuestionForm({ questionText: '' });
        
        dispatch(notificationsActions.addToastNotification({
          message: "Your question has been submitted",
          type: 'success'
        }));
        
        // Reload questions (in a real app we'd optimistically add the question)
        fetchQuestions();
      } else {
        setQuestionError(response.data.message || "Failed to submit question");
      }
    } catch (error: any) {
      console.error("Error submitting question:", error);
      setQuestionError(error.response?.data?.message || "Failed to submit question");
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  // Mark review as helpful
  const handleMarkReviewHelpful = async (reviewUid: string) => {
    if (!isAuthenticated) {
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    try {
      // For this example, we'll assume an API endpoint for marking reviews as helpful
      // In a real app, you would have a proper endpoint
      await axios.post(`${API_URL}/api/products/${product_uid}/reviews/${reviewUid}/helpful`);
      
      // Optimistically update UI
      setReviews(prev => {
        const updatedItems = prev.items.map((review: any) => {
          if (review.uid === reviewUid) {
            return {
              ...review,
              helpfulVotesCount: review.helpfulVotesCount + 1
            };
          }
          return review;
        });
        
        return {
          ...prev,
          items: updatedItems
        };
      });
    } catch (error) {
      console.error("Error marking review as helpful:", error);
    }
  };

  // Mark answer as helpful
  const handleMarkAnswerHelpful = async (questionUid: string, answerUid: string) => {
    if (!isAuthenticated) {
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    try {
      // For this example, we'll assume an API endpoint for marking answers as helpful
      await axios.post(`${API_URL}/api/products/${product_uid}/questions/${questionUid}/answers/${answerUid}/helpful`);
      
      // Optimistically update UI
      setQuestions(prev => {
        return prev.map(question => {
          if (question.uid === questionUid) {
            const updatedAnswers = question.answers.map((answer: any) => {
              if (answer.uid === answerUid) {
                return {
                  ...answer,
                  helpfulVotesCount: answer.helpfulVotesCount + 1
                };
              }
              return answer;
            });
            
            return {
              ...question,
              answers: updatedAnswers
            };
          }
          return question;
        });
      });
    } catch (error) {
      console.error("Error marking answer as helpful:", error);
    }
  };

  // Request quote (for professional buyers)
  const handleRequestQuote = () => {
    if (!isAuthenticated) {
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    // In a real app, this would navigate to a quote request form or open a modal
    dispatch(notificationsActions.addToastNotification({
      message: "Quote request feature coming soon",
      type: 'info'
    }));
  };

  // Answer a question
  const handleAnswerQuestion = async (questionUid: string, answerText: string) => {
    if (!isAuthenticated) {
      dispatch({ type: 'ui/openModal', payload: 'authentication' });
      return;
    }
    
    try {
      const response = await axios.post(`${API_URL}/api/products/${product_uid}/questions/${questionUid}/answers`, {
        answer_text: answerText
      });
      
      if (response.data.success) {
        // Reload questions
        fetchQuestions();
        
        dispatch(notificationsActions.addToastNotification({
          message: "Your answer has been submitted",
          type: 'success'
        }));
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      dispatch(notificationsActions.addToastNotification({
        message: "Failed to submit answer",
        type: 'error'
      }));
    }
  };

  // Effect: Fetch product details on mount and when product_uid changes
  useEffect(() => {
    if (product_uid) {
      fetchProductDetails();
      fetchReviews();
      fetchQuestions();
      
      // Clean up function to cancel requests if component unmounts
      return () => {
        // Disconnect socket if it exists
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, [product_uid]);

  // Effect: Check wishlist status when product loads and auth state changes
  useEffect(() => {
    if (isAuthenticated && productData) {
      checkWishlistStatus();
      fetchUserWishlists();
    }
  }, [isAuthenticated, productData]);

  // Effect: Setup websocket connections when product data loads
  useEffect(() => {
    if (productData) {
      setupWebsocketConnections();
    }
  }, [productData]);

  // Effect: Handle variant parameter from URL
  useEffect(() => {
    if (variantParam && productVariants.length > 0) {
      const matchingVariant = productVariants.find(v => v.uid === variantParam);
      if (matchingVariant) {
        setSelectedVariant(matchingVariant);
      }
    }
  }, [variantParam, productVariants]);
  
  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
          </div>
          <p className="mt-2 text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  // If error, show error state
  if (loadingError || !productData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
          <p className="font-medium">{loadingError || "Failed to load product details"}</p>
          <button 
            onClick={fetchProductDetails}
            className="mt-2 text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate final price with selected variant
  const finalPrice = selectedVariant
    ? productData.base_price + selectedVariant.additional_price
    : productData.base_price;

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb Navigation */}
        <nav className="mb-4 text-sm">
          <ol className="flex flex-wrap items-center">
            <li>
              <Link to="/" className="text-gray-500 hover:text-gray-700">Home</Link>
              <span className="mx-2 text-gray-400">/</span>
            </li>
            {productData.categoryName && (
              <li>
                <Link to={`/categories/${productData.categoryUid}`} className="text-gray-500 hover:text-gray-700">
                  {productData.categoryName}
                </Link>
                <span className="mx-2 text-gray-400">/</span>
              </li>
            )}
            {productData.subcategoryName && (
              <li>
                <Link to={`/categories/${productData.subcategoryUid}`} className="text-gray-500 hover:text-gray-700">
                  {productData.subcategoryName}
                </Link>
                <span className="mx-2 text-gray-400">/</span>
              </li>
            )}
            <li className="font-medium text-gray-900 truncate max-w-xs">
              {productData.name}
            </li>
          </ol>
        </nav>

        {/* Product Main Content */}
        <div className="lg:flex lg:gap-8">
          {/* Left Column - Product Images */}
          <div className="lg:w-1/2 mb-6 lg:mb-0">
            {/* Main Image */}
            <div 
              ref={zoomContainerRef}
              className="relative h-96 md:h-[500px] overflow-hidden bg-gray-100 border border-gray-200 rounded-lg mb-4"
              onMouseEnter={(e) => handleImageZoom(true, e)}
              onMouseLeave={() => handleImageZoom(false)}
              onMouseMove={handleMouseMove}
            >
              {productImages.length > 0 ? (
                <>
                  <img
                    ref={mainImageRef}
                    src={productImages[galleryIndex]?.imageUrl}
                    alt={productImages[galleryIndex]?.altText || productData.name}
                    className={`w-full h-full object-contain transition-opacity ${isZoomed ? 'opacity-0' : 'opacity-100'}`}
                  />
                  {isZoomed && (
                    <div 
                      className="absolute inset-0 bg-no-repeat bg-origin-content"
                      style={{
                        backgroundImage: `url(${productImages[galleryIndex]?.imageUrl})`,
                        backgroundSize: '200%',
                        backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`
                      }}
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              
              {/* Image Navigation Arrows */}
              {productImages.length > 1 && (
                <>
                  <button 
                    onClick={() => handleGalleryNavigation(galleryIndex - 1)}
                    disabled={galleryIndex === 0}
                    className={`absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 ${galleryIndex === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-100'}`}
                    aria-label="Previous image"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleGalleryNavigation(galleryIndex + 1)}
                    disabled={galleryIndex === productImages.length - 1}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 ${galleryIndex === productImages.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-100'}`}
                    aria-label="Next image"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Thumbnails */}
            {productImages.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-hide">
                {productImages.map((image, index) => (
                  <button
                    key={image.uid || index}
                    onClick={() => setGalleryIndex(index)}
                    className={`h-20 w-20 flex-shrink-0 border rounded-md overflow-hidden focus:outline-none ${
                      galleryIndex === index 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img 
                      src={image.imageUrl} 
                      alt={image.altText || `Product view ${index + 1}`} 
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Right Column - Product Information */}
          <div className="lg:w-1/2">
            {/* Basic Product Info */}
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <span className="text-sm text-gray-500 border border-gray-300 rounded px-2 py-1 mr-2">
                  {productData.brand}
                </span>
                {productData.averageRating > 0 && (
                  <div className="flex items-center">
                    <StarRating rating={productData.averageRating} />
                    <span className="text-sm text-gray-600 ml-2">
                      ({productData.reviewCount || 0} {productData.reviewCount === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                )}
              </div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {productData.name}
              </h1>
              
              <p className="text-gray-700 mb-4">
                {productData.shortDescription}
              </p>
              
              <div className="flex items-center mb-4">
                <span className="text-sm text-gray-500 mr-2">SKU:</span>
                <span className="text-sm font-medium">{productData.sku}</span>
                {productData.modelNumber && (
                  <>
                    <span className="text-gray-300 mx-2">|</span>
                    <span className="text-sm text-gray-500 mr-2">Model:</span>
                    <span className="text-sm font-medium">{productData.modelNumber}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center mb-2">
                <div className="flex items-center">
                  <img
                    src={productData.sellerLogoUrl || "https://picsum.photos/seed/seller/40"}
                    alt={productData.sellerName}
                    className="w-6 h-6 mr-2 rounded-full object-cover"
                  />
                  <span className="text-sm text-gray-600">Sold by {productData.sellerName}</span>
                </div>
              </div>
            </div>
            
            {/* Pricing & Availability */}
            <div className="mb-6">
              <div className="flex items-baseline mb-2">
                <span className="text-2xl md:text-3xl font-bold text-gray-900">
                  {formatPrice(finalPrice, productData.currency)}
                </span>
                <span className="text-sm text-gray-600 ml-2">
                  /{productData.unitOfMeasure}
                </span>
              </div>
              
              {user?.userType === 'professional_buyer' && (
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-1">Professional Pricing</h3>
                  <ul className="text-sm text-blue-700">
                    <li className="flex justify-between mb-1">
                      <span>10+ units:</span>
                      <span className="font-medium">{formatPrice(finalPrice * 0.95, productData.currency)}/{productData.unitOfMeasure}</span>
                    </li>
                    <li className="flex justify-between mb-1">
                      <span>25+ units:</span>
                      <span className="font-medium">{formatPrice(finalPrice * 0.90, productData.currency)}/{productData.unitOfMeasure}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>50+ units:</span>
                      <span className="font-medium">{formatPrice(finalPrice * 0.85, productData.currency)}/{productData.unitOfMeasure}</span>
                    </li>
                  </ul>
                </div>
              )}
              
              {/* Availability */}
              <div className="mb-4">
                {(selectedVariant ? selectedVariant.quantityAvailable > 0 : productData.quantityAvailable > 0) ? (
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">In Stock</span>
                    <span className="text-gray-600 text-sm ml-2">
                      {selectedVariant 
                        ? `${selectedVariant.quantityAvailable} units available` 
                        : `${productData.quantityAvailable} units available`
                      }
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Out of Stock</span>
                    <span className="text-gray-600 text-sm ml-2">Expected back in 2-3 weeks</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Variants */}
            {Object.keys(variantsByType).length > 0 && (
              <div className="mb-6">
                {Object.entries(variantsByType).map(([type, variants]) => (
                  <div key={type} className="mb-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {variants.map(variant => (
                        <button
                          key={variant.uid}
                          onClick={() => handleVariantChange(variant)}
                          disabled={variant.quantityAvailable <= 0}
                          className={`
                            px-3 py-2 rounded-md text-sm border
                            ${selectedVariant?.uid === variant.uid 
                              ? 'bg-blue-50 border-blue-500 text-blue-700' 
                              : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'}
                            ${variant.quantityAvailable <= 0 ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          {variant.variantValue}
                          {variant.additionalPrice > 0 && (
                            <span className="ml-1 text-xs text-gray-500">
                              (+{formatPrice(variant.additionalPrice, productData.currency)})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                
                {productData.hasVariants && !selectedVariant && (
                  <p className="text-sm text-red-600 mt-2">
                    * Please select from the available options
                  </p>
                )}
              </div>
            )}
            
            {/* Quantity & Add to Cart */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-4">
                {/* Quantity Selector */}
                <div className="flex items-center">
                  <label htmlFor="quantity" className="mr-2 text-sm font-medium text-gray-700">
                    Quantity:
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-md">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(selectedQuantity - 1)}
                      disabled={selectedQuantity <= 1}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      min="1"
                      max={selectedVariant?.quantityAvailable || productData.quantityAvailable}
                      value={selectedQuantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      className="w-12 text-center border-x border-gray-300 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(selectedQuantity + 1)}
                      disabled={selectedQuantity >= (selectedVariant?.quantityAvailable || productData.quantityAvailable)}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
                
                {/* Available Per Unit */}
                <div className="text-sm text-gray-600">
                  {(selectedVariant?.quantityAvailable || productData.quantityAvailable)} {productData.unitOfMeasure}s available
                </div>
              </div>
              
              {/* Cart Actions */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart || productData.quantityAvailable <= 0 || (productData.hasVariants && !selectedVariant)}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isAddingToCart ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Add to Cart
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleBuyNow}
                  disabled={isAddingToCart || productData.quantityAvailable <= 0 || (productData.hasVariants && !selectedVariant)}
                  className="bg-gray-800 hover:bg-gray-900 text-white py-3 px-6 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  Buy Now
                </button>
                
                {user?.userType === 'professional_buyer' && (
                  <button
                    onClick={handleRequestQuote}
                    className="bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 py-3 px-6 rounded-md font-medium flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Request Quote
                  </button>
                )}
                
                <div className="relative">
                  <button
                    onClick={handleAddToWishlist}
                    disabled={isAddingToWishlist}
                    className="bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 py-3 px-6 rounded-md font-medium w-full flex items-center justify-center"
                  >
                    {isAddingToWishlist ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </>
                    ) : isInWishlist ? (
                      <>
                        <svg className="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                        In Wishlist
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        Add to Wishlist
                      </>
                    )}
                  </button>
                  
                  {/* Wishlist dropdown */}
                  {isWishlistDropdownOpen && userWishlists.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                      <div className="p-3">
                        <h4 className="font-medium text-gray-900 mb-2">Select a wishlist:</h4>
                        <div className="space-y-2">
                          {userWishlists.map(wishlist => (
                            <div key={wishlist.uid} className="flex items-center">
                              <input
                                type="radio"
                                id={`wishlist-${wishlist.uid}`}
                                name="wishlist"
                                value={wishlist.uid}
                                checked={selectedWishlist === wishlist.uid}
                                onChange={() => setSelectedWishlist(wishlist.uid)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor={`wishlist-${wishlist.uid}`} className="ml-2 text-gray-700">
                                {wishlist.name}
                              </label>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex justify-end space-x-2">
                          <button
                            onClick={() => setIsWishlistDropdownOpen(false)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddToWishlist}
                            disabled={!selectedWishlist}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {cartError && (
                <div className="mt-2 text-sm text-red-600">
                  {cartError}
                </div>
              )}
              
              {wishlistError && (
                <div className="mt-2 text-sm text-red-600">
                  {wishlistError}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabbed Content */}
        <div className="mt-10">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => handleTabChange('description')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'description'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Description
              </button>
              <button
                onClick={() => handleTabChange('specifications')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'specifications'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Specifications
              </button>
              <button
                onClick={() => handleTabChange('documents')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documents
              </button>
              <button
                onClick={() => handleTabChange('reviews')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reviews'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reviews {reviews.summary.totalReviews > 0 && `(${reviews.summary.totalReviews})`}
              </button>
              <button
                onClick={() => handleTabChange('questions')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Questions & Answers {questions.length > 0 && `(${questions.length})`}
              </button>
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="py-6">
            {/* Description Tab */}
            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: productData.longDescription }} />
              </div>
            )}
            
            {/* Specifications Tab */}
            {activeTab === 'specifications' && (
              <div>
                {Object.keys(specificationsByGroup).length > 0 ? (
                  Object.entries(specificationsByGroup).map(([group, specs]) => (
                    <div key={group} className="mb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">{group}</h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <tbody className="divide-y divide-gray-200">
                            {specs.map((spec, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-1/3">
                                  {spec.name}
                                </td>
                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">
                                  {spec.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No specifications available for this product.</p>
                )}
              </div>
            )}
            
            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* This is a placeholder document - in a real app, these would come from the API */}
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      dispatch(notificationsActions.addToastNotification({
                        message: "Document download feature coming soon",
                        type: 'info'
                      }));
                    }}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-shrink-0 bg-gray-100 p-3 rounded-md">
                      <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Product Specification Sheet</p>
                      <p className="text-sm text-gray-500">PDF, 2.4 MB</p>
                    </div>
                  </a>
                  
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      dispatch(notificationsActions.addToastNotification({
                        message: "Document download feature coming soon",
                        type: 'info'
                      }));
                    }}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-shrink-0 bg-gray-100 p-3 rounded-md">
                      <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Installation Guide</p>
                      <p className="text-sm text-gray-500">PDF, 1.2 MB</p>
                    </div>
                  </a>
                  
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      dispatch(notificationsActions.addToastNotification({
                        message: "Document download feature coming soon",
                        type: 'info'
                      }));
                    }}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-shrink-0 bg-gray-100 p-3 rounded-md">
                      <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Safety Data Sheet</p>
                      <p className="text-sm text-gray-500">PDF, 890 KB</p>
                    </div>
                  </a>
                </div>
              </div>
            )}
            
            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                {/* Reviews Summary */}
                <div className="mb-8">
                  <div className="lg:flex lg:items-center lg:justify-between">
                    <div className="lg:w-1/3">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {reviews.summary.averageRating.toFixed(1)}
                        <span className="ml-1 text-lg font-normal text-gray-500">out of 5</span>
                      </h3>
                      <div className="flex items-center mt-1">
                        <StarRating rating={reviews.summary.averageRating} />
                        <span className="ml-2 text-sm text-gray-600">
                          {reviews.summary.totalReviews} {reviews.summary.totalReviews === 1 ? 'review' : 'reviews'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 lg:mt-0 lg:w-2/3">
                      <div className="space-y-2">
                        {[
                          { stars: 5, count: reviews.summary.fiveStars },
                          { stars: 4, count: reviews.summary.fourStars },
                          { stars: 3, count: reviews.summary.threeStars },
                          { stars: 2, count: reviews.summary.twoStars },
                          { stars: 1, count: reviews.summary.oneStars }
                        ].map(({ stars, count }) => {
                          const percentage = reviews.summary.totalReviews > 0
                            ? (count / reviews.summary.totalReviews) * 100
                            : 0;
                          
                          return (
                            <div key={stars} className="flex items-center">
                              <div className="w-12 text-sm font-medium text-gray-900">
                                {stars} star{stars !== 1 && 's'}
                              </div>
                              <div className="w-full h-4 mx-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-4 bg-yellow-400 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="w-12 text-sm font-medium text-gray-500 text-right">
                                {count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        if (isAuthenticated) {
                          // Scroll to review form
                          document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          dispatch({ type: 'ui/openModal', payload: 'authentication' });
                        }
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Write a Review
                    </button>
                  </div>
                </div>
                
                {/* Review List */}
                <div className="space-y-6">
                  {reviews.items.length > 0 ? (
                    reviews.items.map((review: any) => (
                      <div key={review.uid} className="border-b border-gray-200 pb-6">
                        <div className="flex items-center mb-2">
                          <StarRating rating={review.rating} size="w-4 h-4" />
                          <h4 className="ml-2 font-medium text-gray-900">{review.title || "Review"}</h4>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{review.content}</p>
                        
                        {(review.pros || review.cons) && (
                          <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {review.pros && (
                              <div>
                                <h5 className="text-sm font-medium text-green-700 mb-1">Pros</h5>
                                <p className="text-sm text-gray-600">{review.pros}</p>
                              </div>
                            )}
                            
                            {review.cons && (
                              <div>
                                <h5 className="text-sm font-medium text-red-700 mb-1">Cons</h5>
                                <p className="text-sm text-gray-600">{review.cons}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {review.images && review.images.length > 0 && (
                          <div className="flex space-x-2 mb-3">
                            {review.images.map((image: any) => (
                              <img
                                key={image.uid}
                                src={image.imageUrl}
                                alt="Review image"
                                className="h-20 w-20 object-cover rounded-md"
                              />
                            ))}
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            {review.authorPictureUrl ? (
                              <img
                                src={review.authorPictureUrl}
                                alt={review.authorName}
                                className="h-6 w-6 rounded-full"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  {review.authorName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="ml-2 text-sm text-gray-600">
                              {review.authorName}
                              {review.verifiedPurchase && (
                                <span className="ml-2 text-xs text-green-600 font-medium">
                                  Verified Purchase
                                </span>
                              )}
                            </span>
                          </div>
                          
                          <div className="flex space-x-6">
                            <button
                              onClick={() => handleMarkReviewHelpful(review.uid)}
                              className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              Helpful ({review.helpfulVotesCount})
                            </button>
                            
                            <span className="text-sm text-gray-400">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">
                      No reviews yet. Be the first to review this product!
                    </div>
                  )}
                </div>
                
                {/* Review Form */}
                {isAuthenticated && (
                  <div id="review-form" className="mt-10 bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Write a Review</h3>
                    
                    <form onSubmit={handleSubmitReview}>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rating <span className="text-red-500">*</span>
                        </label>
                        <div className="flex space-x-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                              className="p-1 focus:outline-none"
                            >
                              <svg
                                className={`w-8 h-8 ${
                                  star <= (reviewForm.rating || 0) ? "text-yellow-400" : "text-gray-300"
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="review-title" className="block text-sm font-medium text-gray-700 mb-1">
                          Review Title
                        </label>
                        <input
                          type="text"
                          id="review-title"
                          value={reviewForm.title}
                          onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="Summarize your experience"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="review-content" className="block text-sm font-medium text-gray-700 mb-1">
                          Review <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="review-content"
                          value={reviewForm.content}
                          onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                          rows={4}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="Share your experience with this product"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="review-pros" className="block text-sm font-medium text-gray-700 mb-1">
                            Pros
                          </label>
                          <textarea
                            id="review-pros"
                            value={reviewForm.pros}
                            onChange={(e) => setReviewForm(prev => ({ ...prev, pros: e.target.value }))}
                            rows={2}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="What did you like about this product?"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="review-cons" className="block text-sm font-medium text-gray-700 mb-1">
                            Cons
                          </label>
                          <textarea
                            id="review-cons"
                            value={reviewForm.cons}
                            onChange={(e) => setReviewForm(prev => ({ ...prev, cons: e.target.value }))}
                            rows={2}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="What could be improved?"
                          />
                        </div>
                      </div>
                      
                      {reviewError && (
                        <div className="mb-4 text-sm text-red-600">
                          {reviewError}
                        </div>
                      )}
                      
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmittingReview}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
            
            {/* Questions Tab */}
            {activeTab === 'questions' && (
              <div>
                {/* Questions List */}
                {questions.length > 0 ? (
                  <div className="space-y-6 mb-8">
                    {questions.map((question: any) => (
                      <div key={question.uid} className="border-b border-gray-200 pb-6">
                        <div className="flex items-start mb-4">
                          <div className="flex-shrink-0 mr-3">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{question.questionText}</p>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <span>Asked by {question.askerName}</span>
                              <span className="mx-1">•</span>
                              <span>{new Date(question.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Answers */}
                        {question.answers && question.answers.length > 0 ? (
                          <div className="ml-8 space-y-4">
                            {question.answers.map((answer: any) => (
                              <div key={answer.uid} className="bg-gray-50 rounded-lg p-4">
                                <p className="text-gray-800">{answer.answerText}</p>
                                <div className="mt-2 flex justify-between items-center">
                                  <div className="flex items-center">
                                    {answer.answererProfilePicture ? (
                                      <img
                                        src={answer.answererProfilePicture}
                                        alt={answer.answererName}
                                        className="h-5 w-5 rounded-full"
                                      />
                                    ) : (
                                      <div className="h-5 w-5 rounded-full bg-gray-300 flex items-center justify-center">
                                        <span className="text-xs text-gray-600">
                                          {answer.answererName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                    <span className="ml-1.5 text-sm text-gray-600">
                                      {answer.answererName}
                                      {answer.isSeller && (
                                        <span className="ml-1 text-xs font-medium text-blue-600">
                                          Seller
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  
                                  <div className="flex space-x-4">
                                    <button
                                      onClick={() => handleMarkAnswerHelpful(question.uid, answer.uid)}
                                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                                    >
                                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                      </svg>
                                      Helpful ({answer.helpfulVotesCount})
                                    </button>
                                    
                                    <span className="text-xs text-gray-400">
                                      {new Date(answer.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="ml-8 text-sm text-gray-500">
                            No answers yet. Be the first to answer this question!
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 mb-8">
                    No questions yet. Be the first to ask a question about this product!
                  </div>
                )}
                
                {/* Ask Question Form */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Ask a Question</h3>
                  
                  <form onSubmit={handleSubmitQuestion}>
                    <div className="mb-4">
                      <label htmlFor="question-text" className="block text-sm font-medium text-gray-700 mb-1">
                        Your Question <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="question-text"
                        value={questionForm.questionText}
                        onChange={(e) => setQuestionForm({ questionText: e.target.value })}
                        rows={3}
                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="Ask a question about this product"
                        required
                      />
                    </div>
                    
                    {questionError && (
                      <div className="mb-4 text-sm text-red-600">
                        {questionError}
                      </div>
                    )}
                    
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingQuestion || !isAuthenticated}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {isSubmittingQuestion ? 'Submitting...' : 'Submit Question'}
                      </button>
                    </div>
                    
                    {!isAuthenticated && (
                      <p className="mt-2 text-sm text-gray-500">
                        Please <button 
                          type="button" 
                          onClick={() => dispatch({ type: 'ui/openModal', payload: 'authentication' })}
                          className="text-blue-600 hover:text-blue-500"
                        >
                          sign in
                        </button> to ask a question.
                      </p>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((product) => (
                <div key={product.uid} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <Link to={`/products/${product.uid}`} className="block">
                    <div className="h-48 bg-gray-100 flex items-center justify-center">
                      {product.primaryImageUrl ? (
                        <img
                          src={product.primaryImageUrl}
                          alt={product.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{product.shortDescription}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {formatPrice(product.price, product.currency)}
                        </span>
                        {product.averageRating > 0 && (
                          <div className="flex items-center">
                            <StarRating rating={product.averageRating} size="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Frequently Bought Together */}
        {frequentlyBoughtTogether.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Bought Together</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="flex items-center space-x-4">
                    {/* Current product image */}
                    <div className="w-20 h-20 border border-gray-200 rounded-md bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={productImages.length > 0 ? productImages[0].imageUrl : "https://picsum.photos/seed/product/80"}
                        alt={productData.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    
                    {/* Plus signs and other product images */}
                    {frequentlyBoughtTogether.map((product, index) => (
                      <React.Fragment key={product.uid}>
                        <span className="text-gray-500 font-medium">+</span>
                        <div className="w-20 h-20 border border-gray-200 rounded-md bg-white flex items-center justify-center overflow-hidden">
                          <img
                            src={product.primaryImageUrl || `https://picsum.photos/seed/${product.uid}/80`}
                            alt={product.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">This item: {productData.name}</span>
                      <span className="font-medium">{formatPrice(finalPrice, productData.currency)}</span>
                    </div>
                    
                    {frequentlyBoughtTogether.map((product) => (
                      <div key={product.uid} className="flex items-center justify-between">
                        <Link to={`/products/${product.uid}`} className="text-blue-600 hover:underline">
                          {product.name}
                        </Link>
                        <span>{formatPrice(product.price, product.currency)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium text-gray-900">Price for all</span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatPrice(
                          finalPrice + frequentlyBoughtTogether.reduce((sum, p) => sum + p.price, 0),
                          productData.currency
                        )}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        // Add all to cart logic
                        handleAddToCart();
                        
                        // Also add the other products
                        frequentlyBoughtTogether.forEach(product => {
                          if (!product.isInCart) {
                            dispatch(addToCart({
                              product_uid: product.uid,
                              quantity: 1
                            }));
                          }
                        });
                      }}
                      disabled={isAddingToCart || productData.quantityAvailable <= 0 || (productData.hasVariants && !selectedVariant)}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
                    >
                      {isAddingToCart ? "Adding..." : "Add All to Cart"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ProductDetails;