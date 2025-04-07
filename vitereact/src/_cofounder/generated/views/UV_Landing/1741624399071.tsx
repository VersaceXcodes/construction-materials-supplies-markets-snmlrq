import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAppSelector, useAppDispatch, notificationsActions, addToCart } from "@/store/main";

const UV_Landing: React.FC = () => {
  // URL parameters
  const [searchParams] = useSearchParams();
  const promoParam = searchParams.get("promo");

  // Global state
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  
  // Local state for landing page content
  const [featuredCollections, setFeaturedCollections] = useState<Array<{
    uid: string;
    name: string;
    description: string;
    imageUrl: string;
    productCount: number;
  }>>([]);
  
  const [newArrivals, setNewArrivals] = useState<Array<{
    uid: string;
    name: string;
    shortDescription: string;
    price: number;
    currency: string;
    primaryImageUrl: string;
    averageRating: number;
  }>>([]);
  
  const [topRatedProducts, setTopRatedProducts] = useState<Array<{
    uid: string;
    name: string;
    shortDescription: string;
    price: number;
    currency: string;
    primaryImageUrl: string;
    averageRating: number;
    reviewCount: number;
  }>>([]);
  
  const [promotionalBanners, setPromotionalBanners] = useState<Array<{
    uid: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    linkUrl: string;
    backgroundColor: string;
    textColor: string;
    priority: number;
  }>>([]);
  
  const [popularCategories, setPopularCategories] = useState<Array<{
    uid: string;
    name: string;
    imageUrl: string;
    productCount: number;
  }>>([]);
  
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState<Array<{
    uid: string;
    name: string;
    shortDescription: string;
    price: number;
    currency: string;
    primaryImageUrl: string;
    reasonForRecommendation: string;
  }>>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);
  
  // Error states
  const [error, setError] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  // Function to fetch landing page data
  const fetchLandingPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch featured collections (using categories as a proxy since there's no specific collections endpoint)
      const collectionsResponse = await axios.get('http://localhost:1337/api/categories', {
        params: { 
          parent_uid: null // Get top-level categories
        }
      });
      
      if (collectionsResponse.data.success && collectionsResponse.data.categories) {
        // Transform categories to our collection format
        const collections = collectionsResponse.data.categories.map((category: any) => ({
          uid: category.uid,
          name: category.name,
          description: category.description || `Browse our selection of ${category.name}`,
          imageUrl: category.image_url || `https://picsum.photos/seed/${category.uid}/800/600`,
          productCount: category.product_count || 0
        }));
        
        setFeaturedCollections(collections);
      }
      
      // Fetch new arrivals
      const newArrivalsResponse = await axios.get('http://localhost:1337/api/products', {
        params: {
          sort_by: 'created_at',
          sort_order: 'desc',
          limit: 8
        }
      });
      
      if (newArrivalsResponse.data.success && newArrivalsResponse.data.products) {
        setNewArrivals(newArrivalsResponse.data.products.map((product: any) => ({
          uid: product.uid,
          name: product.name,
          shortDescription: product.short_description,
          price: product.base_price,
          currency: product.currency || 'USD',
          primaryImageUrl: product.primary_image_url || `https://picsum.photos/seed/${product.uid}/400/400`,
          averageRating: product.average_rating || 0
        })));
      }
      
      // Fetch top-rated products
      const topRatedResponse = await axios.get('http://localhost:1337/api/products', {
        params: {
          sort_by: 'average_rating',
          sort_order: 'desc',
          limit: 8
        }
      });
      
      if (topRatedResponse.data.success && topRatedResponse.data.products) {
        setTopRatedProducts(topRatedResponse.data.products.map((product: any) => ({
          uid: product.uid,
          name: product.name,
          shortDescription: product.short_description,
          price: product.base_price,
          currency: product.currency || 'USD',
          primaryImageUrl: product.primary_image_url || `https://picsum.photos/seed/${product.uid}/400/400`,
          averageRating: product.average_rating || 0,
          reviewCount: product.review_count || 0
        })));
      }
      
      // Fetch popular categories
      const popularCategoriesResponse = await axios.get('http://localhost:1337/api/categories', {
        params: {
          sort_by: 'product_count',
          sort_order: 'desc',
          limit: 6
        }
      });
      
      if (popularCategoriesResponse.data.success && popularCategoriesResponse.data.categories) {
        setPopularCategories(popularCategoriesResponse.data.categories.map((category: any) => ({
          uid: category.uid,
          name: category.name,
          imageUrl: category.image_url || `https://picsum.photos/seed/${category.uid}/200/200`,
          productCount: category.product_count || 0
        })));
      }
      
      // Create sample promotional banners (since we don't have a backend endpoint for these)
      // In a real application, these would come from the server
      const banners = [
        {
          uid: 'promo-summer',
          title: 'Summer Sale',
          subtitle: 'Save up to 25% on selected outdoor construction materials',
          imageUrl: 'https://picsum.photos/seed/summer-promo/1200/400',
          linkUrl: '/search?q=outdoor',
          backgroundColor: '#f0f9ff',
          textColor: '#0369a1',
          priority: 1
        },
        {
          uid: 'promo-tools',
          title: 'Professional Tools',
          subtitle: 'Find the right tools for your next big project',
          imageUrl: 'https://picsum.photos/seed/tools-promo/1200/400',
          linkUrl: '/categories/tools',
          backgroundColor: '#fef2f2',
          textColor: '#b91c1c',
          priority: 2
        }
      ];
      
      // If there's a promo param, filter to show only that promo
      if (promoParam) {
        const filteredBanners = banners.filter(banner => banner.uid === promoParam || banner.uid.includes(promoParam));
        setPromotionalBanners(filteredBanners.length > 0 ? filteredBanners : banners);
      } else {
        setPromotionalBanners(banners);
      }
      
    } catch (err) {
      console.error('Error fetching landing page data:', err);
      setError('Failed to load content. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [promoParam]);

  // Function to fetch personalized recommendations
  const fetchPersonalizedRecommendations = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    
    setIsLoadingRecommendations(true);
    setRecommendationsError(null);
    
    try {
      // In a real application, we would call an endpoint that returns personalized recommendations
      // For now, we'll use a modified product search as a placeholder
      const recommendationsResponse = await axios.get('http://localhost:1337/api/products', {
        params: {
          limit: 4,
          sort_by: 'total_views',
          sort_order: 'desc'
        }
      });
      
      if (recommendationsResponse.data.success && recommendationsResponse.data.products) {
        // Add a reason for recommendation to each product
        const reasons = [
          'Based on your recent purchases',
          'Similar to items you viewed',
          'Popular in your area',
          'Frequently bought together'
        ];
        
        const personalizedProducts = recommendationsResponse.data.products.map((product: any, index: number) => ({
          uid: product.uid,
          name: product.name,
          shortDescription: product.short_description,
          price: product.base_price,
          currency: product.currency || 'USD',
          primaryImageUrl: product.primary_image_url || `https://picsum.photos/seed/${product.uid}/400/400`,
          reasonForRecommendation: reasons[index % reasons.length]
        }));
        
        setPersonalizedRecommendations(personalizedProducts);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setRecommendationsError('Failed to load personalized recommendations.');
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [isAuthenticated, user]);

  // Track banner click for analytics
  const trackBannerClick = useCallback((bannerUid: string, linkUrl: string) => {
    // In a real app, we would send this data to the analytics endpoint
    console.log(`Banner clicked: ${bannerUid}, URL: ${linkUrl}`);
    
    // Here we would make a call to the backend to track this click
    try {
      // This is a mock implementation since the backend endpoint isn't specified
      axios.post('http://localhost:1337/api/analytics/banner-click', {
        banner_uid: bannerUid,
        user_uid: user?.uid || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error tracking banner click:', err);
      // Non-critical error, so we don't need to show it to the user
    }
  }, [user]);

  // Handle quick add to cart
  const handleQuickAddToCart = useCallback(async (productUid: string, productName: string) => {
    try {
      // Dispatch the addToCart action from our global store
      const resultAction = await dispatch(addToCart({
        product_uid: productUid,
        quantity: 1
      }));
      
      if (addToCart.fulfilled.match(resultAction)) {
        // Show success toast
        dispatch(notificationsActions.addToastNotification({
          type: 'success',
          message: `${productName} added to cart!`,
          duration: 3000
        }));
      } else {
        // Show error toast
        dispatch(notificationsActions.addToastNotification({
          type: 'error',
          message: 'Failed to add item to cart. Please try again.',
          duration: 5000
        }));
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
      dispatch(notificationsActions.addToastNotification({
        type: 'error',
        message: 'Failed to add item to cart. Please try again.',
        duration: 5000
      }));
    }
  }, [dispatch]);

  // Handle collection click - not implemented in this component,
  // we use Link from react-router-dom instead

  // Fetch data when component mounts or promo param changes
  useEffect(() => {
    fetchLandingPageData();
  }, [fetchLandingPageData]);

  // Fetch personalized recommendations when auth state changes
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchPersonalizedRecommendations();
    }
  }, [isAuthenticated, isLoading, fetchPersonalizedRecommendations]);

  return (
    <>
      {/* Hero Section with Promotional Banner */}
      <section className="relative">
        {isLoading ? (
          <div className="h-96 bg-gray-200 animate-pulse flex items-center justify-center">
            <p className="text-gray-500">Loading promotions...</p>
          </div>
        ) : error ? (
          <div className="h-96 bg-red-50 flex items-center justify-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : promotionalBanners.length > 0 ? (
          // If we have promotional banners, show the first one as the hero
          <div 
            className="relative h-96 bg-cover bg-center flex items-center"
            style={{ 
              backgroundImage: `url(${promotionalBanners[0].imageUrl})`,
              backgroundColor: promotionalBanners[0].backgroundColor 
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"></div>
            <div className="container mx-auto px-4 lg:px-8 relative z-10">
              <div className="max-w-lg">
                <h1 
                  className="text-4xl md:text-5xl font-bold mb-4"
                  style={{ color: promotionalBanners[0].textColor || 'white' }}
                >
                  {promotionalBanners[0].title}
                </h1>
                <p 
                  className="text-xl mb-8"
                  style={{ color: promotionalBanners[0].textColor || 'white' }}
                >
                  {promotionalBanners[0].subtitle}
                </p>
                <Link 
                  to={promotionalBanners[0].linkUrl}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                  onClick={() => trackBannerClick(promotionalBanners[0].uid, promotionalBanners[0].linkUrl)}
                >
                  Shop Now
                </Link>
              </div>
            </div>
          </div>
        ) : (
          // Default hero if no promotions available
          <div className="h-96 bg-cover bg-center flex items-center" style={{ backgroundImage: `url(https://picsum.photos/seed/constructmart/1200/400)` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"></div>
            <div className="container mx-auto px-4 lg:px-8 relative z-10">
              <div className="max-w-lg">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Quality Construction Materials
                </h1>
                <p className="text-xl text-white mb-8">
                  Find everything you need for your next building project.
                </p>
                <Link 
                  to="/categories"
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Browse Categories
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Popular Categories Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-8 text-center">Browse Popular Categories</h2>
          
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-4 h-40 animate-pulse">
                  <div className="h-24 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {popularCategories.map(category => (
                <Link 
                  key={category.uid}
                  to={`/categories/${category.uid}`}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden flex flex-col items-center text-center p-4 hover:bg-blue-50"
                >
                  <img 
                    src={category.imageUrl} 
                    alt={category.name}
                    className="w-20 h-20 object-contain mb-3"
                  />
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-500">{category.productCount} products</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Collections Section */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Featured Collections</h2>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse h-64 rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCollections.slice(0, 3).map(collection => (
                <Link 
                  key={collection.uid}
                  to={`/categories/${collection.uid}`}
                  className="group relative h-64 overflow-hidden rounded-lg shadow-md"
                >
                  <img 
                    src={collection.imageUrl} 
                    alt={collection.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-xl text-white font-bold">{collection.name}</h3>
                    <p className="text-white/90 mb-2">{collection.description}</p>
                    <span className="text-sm text-white/80">{collection.productCount} products</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">New Arrivals</h2>
          
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-5 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {newArrivals.slice(0, 4).map(product => (
                <div key={product.uid} className="bg-white rounded-lg shadow overflow-hidden group hover:shadow-md transition-shadow">
                  <Link to={`/products/${product.uid}`} className="block relative">
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      <img 
                        src={product.primaryImageUrl} 
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">New</span>
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link to={`/products/${product.uid}`} className="block">
                      <h3 className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{product.name}</h3>
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{product.shortDescription}</p>
                    </Link>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-gray-900">
                        {product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => handleQuickAddToCart(product.uid, product.name)}
                        className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors"
                        aria-label={`Add ${product.name} to cart`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-8 text-center">
            <Link to="/search?sort=created_at_desc" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
              View All New Arrivals
            </Link>
          </div>
        </div>
      </section>

      {/* Top Rated Products Section */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Top Rated Products</h2>
          
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-5 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {topRatedProducts.slice(0, 4).map(product => (
                <div key={product.uid} className="bg-white rounded-lg shadow overflow-hidden group hover:shadow-md transition-shadow">
                  <Link to={`/products/${product.uid}`} className="block relative">
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      <img 
                        src={product.primaryImageUrl} 
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      {/* Star rating */}
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${i < Math.round(product.averageRating) ? 'text-yellow-400' : 'text-gray-300'}`} viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-gray-600 ml-2">({product.reviewCount} reviews)</span>
                    </div>
                    <Link to={`/products/${product.uid}`} className="block">
                      <h3 className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{product.name}</h3>
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{product.shortDescription}</p>
                    </Link>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-gray-900">
                        {product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => handleQuickAddToCart(product.uid, product.name)}
                        className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors"
                        aria-label={`Add ${product.name} to cart`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-8 text-center">
            <Link to="/search?sort=average_rating_desc" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
              View All Top Rated Products
            </Link>
          </div>
        </div>
      </section>

      {/* Additional Promotional Banner (if there's more than one) */}
      {!isLoading && promotionalBanners.length > 1 && (
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4 lg:px-8">
            <div 
              className="relative rounded-xl overflow-hidden"
              style={{ 
                backgroundColor: promotionalBanners[1].backgroundColor 
              }}
            >
              <div className="md:flex items-center">
                <div className="md:w-1/2 p-8 md:p-12">
                  <h2 
                    className="text-3xl font-bold mb-4"
                    style={{ color: promotionalBanners[1].textColor || 'black' }}
                  >
                    {promotionalBanners[1].title}
                  </h2>
                  <p 
                    className="text-lg mb-6"
                    style={{ color: promotionalBanners[1].textColor || 'black' }}
                  >
                    {promotionalBanners[1].subtitle}
                  </p>
                  <Link 
                    to={promotionalBanners[1].linkUrl}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors inline-block"
                    onClick={() => trackBannerClick(promotionalBanners[1].uid, promotionalBanners[1].linkUrl)}
                  >
                    Explore Now
                  </Link>
                </div>
                <div className="md:w-1/2">
                  <img 
                    src={promotionalBanners[1].imageUrl} 
                    alt={promotionalBanners[1].title}
                    className="w-full h-60 md:h-72 object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Personalized Recommendations (for authenticated users) */}
      {isAuthenticated && (
        <section className="py-12">
          <div className="container mx-auto px-4 lg:px-8">
            <h2 className="text-3xl font-bold mb-2">Recommended for You</h2>
            <p className="text-gray-600 mb-8">Based on your browsing history and previous purchases</p>
            
            {isLoadingRecommendations ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                    <div className="h-48 bg-gray-200 rounded mb-4"></div>
                    <div className="h-5 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : recommendationsError ? (
              <div className="p-4 bg-red-50 text-red-800 rounded-lg">
                {recommendationsError}
              </div>
            ) : personalizedRecommendations.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {personalizedRecommendations.map(product => (
                  <div key={product.uid} className="bg-white rounded-lg shadow overflow-hidden group hover:shadow-md transition-shadow">
                    <Link to={`/products/${product.uid}`} className="block">
                      <div className="aspect-square overflow-hidden bg-gray-100">
                        <img 
                          src={product.primaryImageUrl} 
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </Link>
                    <div className="p-4">
                      <Link to={`/products/${product.uid}`} className="block">
                        <h3 className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{product.name}</h3>
                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">{product.shortDescription}</p>
                      </Link>
                      <div className="mt-2 bg-blue-50 text-blue-700 text-xs p-1 rounded inline-block">
                        {product.reasonForRecommendation}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-lg font-bold text-gray-900">
                          {product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}
                        </span>
                        <button 
                          onClick={() => handleQuickAddToCart(product.uid, product.name)}
                          className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors"
                          aria-label={`Add ${product.name} to cart`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-gray-100 text-center rounded-lg">
                <p className="text-lg text-gray-600">We'll show personalized recommendations as you browse and shop!</p>
                <Link to="/categories" className="mt-4 inline-block text-blue-600 hover:underline">
                  Start exploring our products
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Professional Services Section */}
      <section className="py-12 bg-gray-900 text-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="md:flex items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h2 className="text-3xl font-bold mb-4">Professional Contractor Benefits</h2>
              <p className="text-xl mb-6">Unlock special features designed for construction professionals</p>
              
              <ul className="space-y-4">
                <li className="flex">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Bulk ordering with volume discounts</span>
                </li>
                <li className="flex">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Project-based material organization</span>
                </li>
                <li className="flex">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Dedicated account management</span>
                </li>
                <li className="flex">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Flexible payment options including purchase orders</span>
                </li>
              </ul>
              
              <div className="mt-8">
                {isAuthenticated && user?.userType === 'professional_buyer' ? (
                  <Link to="/account" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors inline-block">
                    Manage Your Professional Account
                  </Link>
                ) : (
                  <Link to="/account/profile" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors inline-block">
                    Sign Up for Business Account
                  </Link>
                )}
              </div>
            </div>
            <div className="md:w-1/2 md:pl-12">
              <img 
                src="https://picsum.photos/seed/construction-pro/600/400" 
                alt="Professional contractor using ConstructMart"
                className="rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Project Inspiration Gallery */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-2">Project Inspiration</h2>
          <p className="text-gray-600 mb-8">Discover ideas for your next construction or renovation project</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group relative rounded-lg overflow-hidden shadow">
              <img 
                src="https://picsum.photos/seed/project-kitchen/600/400" 
                alt="Kitchen Renovation" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-4">
                <h3 className="text-white text-xl font-bold">Kitchen Renovation</h3>
                <p className="text-white/80">Create your dream kitchen with quality materials</p>
              </div>
            </div>
            
            <div className="group relative rounded-lg overflow-hidden shadow">
              <img 
                src="https://picsum.photos/seed/project-deck/600/400" 
                alt="Outdoor Deck" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-4">
                <h3 className="text-white text-xl font-bold">Outdoor Deck</h3>
                <p className="text-white/80">Build the perfect backyard entertainment space</p>
              </div>
            </div>
            
            <div className="group relative rounded-lg overflow-hidden shadow">
              <img 
                src="https://picsum.photos/seed/project-bathroom/600/400" 
                alt="Bathroom Remodel" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-4">
                <h3 className="text-white text-xl font-bold">Bathroom Remodel</h3>
                <p className="text-white/80">Transform your bathroom with modern fixtures</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <Link to="/categories" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
              Explore Project Materials
            </Link>
          </div>
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-2 text-center">What Our Customers Say</h2>
          <p className="text-gray-600 mb-12 text-center">Trusted by professionals and DIY enthusiasts</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <blockquote className="text-gray-700 mb-4">
                "ConstructMart has been a game-changer for our renovation business. Their wide selection of quality materials and reliable delivery have helped us complete projects on time and within budget."
              </blockquote>
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  JD
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold">John Doe</h4>
                  <p className="text-gray-500 text-sm">Contractor, Ace Renovations</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <blockquote className="text-gray-700 mb-4">
                "As a DIY enthusiast, I appreciate the detailed product descriptions and helpful customer service. They guided me through my basement remodel with expert advice and quality materials."
              </blockquote>
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  JS
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold">Jane Smith</h4>
                  <p className="text-gray-500 text-sm">Home Improvement Enthusiast</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${i < 4 ? 'text-yellow-400' : 'text-gray-300'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <blockquote className="text-gray-700 mb-4">
                "The bulk ordering feature and business account benefits have streamlined our procurement process. Their competitive pricing and reliable delivery schedule have made them our go-to supplier."
              </blockquote>
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  RJ
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold">Robert Johnson</h4>
                  <p className="text-gray-500 text-sm">Purchasing Manager, BuildRight Construction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Content & Resources */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Tips & Resources</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <img 
                src="https://picsum.photos/seed/material-guide/600/300" 
                alt="Guide to Building Materials" 
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <h3 className="font-bold text-xl mb-2">Guide to Building Materials</h3>
                <p className="text-gray-600 mb-4">Learn about different types of building materials and their applications in construction projects.</p>
                <Link to="/help" className="text-blue-600 hover:underline inline-flex items-center">
                  Read More
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <img 
                src="https://picsum.photos/seed/diy-tips/600/300" 
                alt="DIY Project Tips" 
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <h3 className="font-bold text-xl mb-2">DIY Project Tips</h3>
                <p className="text-gray-600 mb-4">Expert advice and techniques to help you complete your home improvement projects like a pro.</p>
                <Link to="/help" className="text-blue-600 hover:underline inline-flex items-center">
                  Read More
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <img 
                src="https://picsum.photos/seed/tools-guide/600/300" 
                alt="Essential Tools Guide" 
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <h3 className="font-bold text-xl mb-2">Essential Tools Guide</h3>
                <p className="text-gray-600 mb-4">Discover the must-have tools for different construction and renovation projects.</p>
                <Link to="/help" className="text-blue-600 hover:underline inline-flex items-center">
                  Read More
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Your Project?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">Browse our extensive catalog of quality construction materials and supplies at competitive prices.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/categories" className="px-8 py-4 bg-white text-blue-600 font-bold rounded-md hover:bg-gray-100 transition-colors">
              Shop Now
            </Link>
            <Link to="/help" className="px-8 py-4 bg-blue-700 text-white font-bold rounded-md hover:bg-blue-800 transition-colors">
              Get Help
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default UV_Landing;