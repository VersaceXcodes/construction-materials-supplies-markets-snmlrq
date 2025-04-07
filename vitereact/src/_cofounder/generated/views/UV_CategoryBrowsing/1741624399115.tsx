import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAppSelector, useAppDispatch, cartActions, notificationsActions } from '@/store/main';
import { FaList, FaThLarge, FaShoppingCart, FaExchangeAlt, FaHeart, FaStar, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { LuFilterX } from 'react-icons/lu';

const UV_CategoryBrowsing: React.FC = () => {
  // Get URL parameters
  const { category_uid } = useParams<{ category_uid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Get parameters from URL
  const sort = searchParams.get('sort') || 'popularity';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '24');
  const brand = searchParams.get('brand') || '';
  const min_price = searchParams.get('min_price') ? parseFloat(searchParams.get('min_price') || '0') : null;
  const max_price = searchParams.get('max_price') ? parseFloat(searchParams.get('max_price') || '0') : null;

  // Global state
  const { isAuthenticated, user } = useAppSelector(state => state.auth);
  const { viewportSize } = useAppSelector(state => state.ui);
  const isProfessionalBuyer = isAuthenticated && user?.userType === 'professional_buyer';

  // Component state
  const [categoryData, setCategoryData] = useState<{
    uid: string;
    name: string;
    description: string;
    imageUrl: string;
    parentUid: string | null;
    parentName: string | null;
  } | null>(null);

  const [subcategories, setSubcategories] = useState<Array<{
    uid: string;
    name: string;
    imageUrl: string;
    productCount: number;
  }>>([]);

  const [products, setProducts] = useState<Array<{
    uid: string;
    name: string;
    shortDescription: string;
    price: number;
    currency: string;
    primaryImageUrl: string;
    averageRating: number;
    reviewCount: number;
    inStock: boolean;
    brand: string;
  }>>([]);

  const [pagination, setPagination] = useState({
    currentPage: page,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: limit
  });

  const [activeFilters, setActiveFilters] = useState<{
    brands: string[];
    priceRange: { min: number | null; max: number | null };
    attributes: Record<string, string[]>;
  }>({
    brands: brand ? [brand] : [],
    priceRange: { min: min_price, max: max_price },
    attributes: {}
  });

  const [sortOption, setSortOption] = useState<string>(sort);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [productsToCompare, setProductsToCompare] = useState<string[]>([]);
  
  const [availableFilters, setAvailableFilters] = useState<{
    brands: Array<{ name: string; count: number }>;
    priceRanges: Array<{ min: number; max: number; label: string }>;
    attributes: Record<string, { name: string; options: Array<{ value: string; count: number }> }>;
  }>({
    brands: [],
    priceRanges: [],
    attributes: {}
  });

  const [isLoading, setIsLoading] = useState(true);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);

  // Fetch category data
  const fetchCategoryData = useCallback(async () => {
    if (!category_uid) return;
    
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/categories/${category_uid}`);
      
      if (response.data && response.data.success) {
        setCategoryData({
          uid: response.data.category.uid,
          name: response.data.category.name,
          description: response.data.category.description || '',
          imageUrl: response.data.category.image_url || 'https://picsum.photos/seed/category123/1200/300',
          parentUid: response.data.category.parent_uid,
          parentName: response.data.category.parent_name
        });
        
        // Map subcategories
        const subcats = response.data.category.subcategories.map((subcat: any) => ({
          uid: subcat.uid,
          name: subcat.name,
          imageUrl: subcat.image_url || `https://picsum.photos/seed/${subcat.uid}/100/100`,
          productCount: subcat.product_count || 0
        }));
        
        setSubcategories(subcats);
      }
    } catch (error) {
      console.error('Error fetching category data:', error);
      dispatch(notificationsActions.addToastNotification({
        message: 'Failed to load category details',
        type: 'error'
      }));
    } finally {
      setIsLoading(false);
    }
  }, [category_uid, dispatch]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!category_uid) return;
    
    try {
      setIsLoading(true);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('category_uid', category_uid);
      
      if (sortOption) {
        const [sort_by, sort_order] = sortOption.includes('_') 
          ? sortOption.split('_') 
          : [sortOption, 'desc'];
        
        queryParams.append('sort_by', sort_by);
        queryParams.append('sort_order', sort_order);
      }
      
      queryParams.append('page', String(pagination.currentPage));
      queryParams.append('limit', String(pagination.itemsPerPage));
      
      if (activeFilters.brands.length > 0) {
        queryParams.append('brand', activeFilters.brands[0]); // API currently supports single brand
      }
      
      if (activeFilters.priceRange.min !== null) {
        queryParams.append('min_price', String(activeFilters.priceRange.min));
      }
      
      if (activeFilters.priceRange.max !== null) {
        queryParams.append('max_price', String(activeFilters.priceRange.max));
      }
      
      // Make API call
      const response = await axios.get(`/api/products?${queryParams.toString()}`);
      
      if (response.data && response.data.success) {
        // Map products
        const mappedProducts = response.data.products.map((product: any) => ({
          uid: product.uid,
          name: product.name,
          shortDescription: product.short_description || '',
          price: product.base_price,
          currency: product.currency || 'USD',
          primaryImageUrl: product.primary_image_url || `https://picsum.photos/seed/${product.uid}/300/300`,
          averageRating: product.average_rating || 0,
          reviewCount: product.review_count || 0,
          inStock: product.quantity_available > 0,
          brand: product.brand || ''
        }));
        
        setProducts(mappedProducts);
        
        // Update pagination
        setPagination({
          currentPage: parseInt(response.data.pagination.current_page),
          totalPages: parseInt(response.data.pagination.total_pages),
          totalItems: parseInt(response.data.pagination.total_items),
          itemsPerPage: parseInt(response.data.pagination.limit)
        });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      dispatch(notificationsActions.addToastNotification({
        message: 'Failed to load products',
        type: 'error'
      }));
    } finally {
      setIsLoading(false);
    }
  }, [category_uid, sortOption, pagination.currentPage, pagination.itemsPerPage, activeFilters, dispatch]);

  // Fetch available filters
  const fetchAvailableFilters = useCallback(async () => {
    if (!category_uid) return;
    
    try {
      // In a real implementation, we would call an API endpoint to get filter options
      // For now, we'll simulate it with a timeout
      
      // This would be the actual API call in a real implementation:
      // const response = await axios.get(`/api/categories/${category_uid}/filters`);
      
      // Since our backend doesn't have a dedicated filters endpoint, we'll create mock data
      const mockBrands = [
        { name: 'DeWalt', count: 28 },
        { name: 'Stanley', count: 22 },
        { name: 'Milwaukee', count: 19 },
        { name: 'Makita', count: 16 },
        { name: 'Bosch', count: 15 }
      ];
      
      const mockPriceRanges = [
        { min: 0, max: 50, label: 'Under $50' },
        { min: 50, max: 100, label: '$50 - $100' },
        { min: 100, max: 250, label: '$100 - $250' },
        { min: 250, max: 500, label: '$250 - $500' },
        { min: 500, max: null, label: 'Over $500' }
      ];
      
      const mockAttributes = {
        material: {
          name: 'Material',
          options: [
            { value: 'Wood', count: 42 },
            { value: 'Steel', count: 37 },
            { value: 'Concrete', count: 25 },
            { value: 'Plastic', count: 18 }
          ]
        },
        weight: {
          name: 'Weight',
          options: [
            { value: 'Light', count: 31 },
            { value: 'Medium', count: 28 },
            { value: 'Heavy', count: 15 }
          ]
        }
      };
      
      setAvailableFilters({
        brands: mockBrands,
        priceRanges: mockPriceRanges,
        attributes: mockAttributes
      });
      
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  }, [category_uid]);

  // Handler functions
  const handleSortChange = (newSortOption: string) => {
    setSortOption(newSortOption);
    
    // Update URL parameters
    searchParams.set('sort', newSortOption);
    setSearchParams(searchParams);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };

  const handleFilterChange = (filterType: string, value: string | { min: number | null, max: number | null }) => {
    let updatedFilters = { ...activeFilters };
    
    if (filterType === 'brand') {
      const brandValue = value as string;
      
      if (updatedFilters.brands.includes(brandValue)) {
        // Remove brand
        updatedFilters.brands = updatedFilters.brands.filter(b => b !== brandValue);
      } else {
        // Add brand
        updatedFilters.brands = [...updatedFilters.brands, brandValue];
      }
      
      // Update URL parameter
      if (updatedFilters.brands.length > 0) {
        searchParams.set('brand', updatedFilters.brands[0]);
      } else {
        searchParams.delete('brand');
      }
    } else if (filterType === 'priceRange') {
      const priceRange = value as { min: number | null, max: number | null };
      updatedFilters.priceRange = priceRange;
      
      // Update URL parameters
      if (priceRange.min !== null) {
        searchParams.set('min_price', String(priceRange.min));
      } else {
        searchParams.delete('min_price');
      }
      
      if (priceRange.max !== null) {
        searchParams.set('max_price', String(priceRange.max));
      } else {
        searchParams.delete('max_price');
      }
    } else if (Object.keys(updatedFilters.attributes).includes(filterType)) {
      const attrValue = value as string;
      
      if (updatedFilters.attributes[filterType].includes(attrValue)) {
        // Remove attribute value
        updatedFilters.attributes[filterType] = updatedFilters.attributes[filterType].filter(v => v !== attrValue);
      } else {
        // Add attribute value
        updatedFilters.attributes[filterType] = [...updatedFilters.attributes[filterType], attrValue];
      }
    }
    
    setActiveFilters(updatedFilters);
    
    // Reset to first page when filters change
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    
    searchParams.set('page', String(newPage));
    setSearchParams(searchParams);
  };

  const addToCompare = (productId: string) => {
    if (!productsToCompare.includes(productId)) {
      if (productsToCompare.length < 4) {
        setProductsToCompare([...productsToCompare, productId]);
      } else {
        dispatch(notificationsActions.addToastNotification({
          message: 'You can compare up to 4 products',
          type: 'warning'
        }));
      }
    }
  };

  const removeFromCompare = (productId: string) => {
    setProductsToCompare(productsToCompare.filter(id => id !== productId));
  };

  const navigateToCompare = () => {
    if (productsToCompare.length < 2) {
      dispatch(notificationsActions.addToastNotification({
        message: 'Please select at least 2 products to compare',
        type: 'warning'
      }));
      return;
    }
    
    const queryString = productsToCompare.map(id => `product=${id}`).join('&');
    navigate(`/compare?${queryString}`);
  };

  const quickAddToCart = async (productId: string) => {
    try {
      // First, check if user is authenticated
      if (!isAuthenticated) {
        dispatch(notificationsActions.addToastNotification({
          message: 'Please log in to add items to your cart',
          type: 'warning'
        }));
        return;
      }
      
      // Add item to cart
      const response = await axios.post('/api/cart/items', {
        product_uid: productId,
        quantity: 1
      });
      
      if (response.data && response.data.success) {
        // Display success notification
        dispatch(notificationsActions.addToastNotification({
          message: 'Item added to cart successfully',
          type: 'success'
        }));
        
        // Notify cart component about the update (handled by backend websocket)
        // The global store subscribes to these events
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      
      // Display error notification
      dispatch(notificationsActions.addToastNotification({
        message: 'Failed to add item to cart',
        type: 'error'
      }));
    }
  };

  const clearAllFilters = () => {
    setActiveFilters({
      brands: [],
      priceRange: { min: null, max: null },
      attributes: {}
    });
    
    // Reset URL parameters
    const newParams = new URLSearchParams();
    newParams.set('sort', sortOption);
    newParams.set('page', '1');
    newParams.set('limit', String(pagination.itemsPerPage));
    setSearchParams(newParams);
  };

  // Filter sidebar toggle for mobile
  const toggleFilterSidebar = () => {
    setFilterSidebarOpen(!filterSidebarOpen);
  };

  // Effect hooks
  // Load category data and initial products when component mounts or category changes
  useEffect(() => {
    if (category_uid) {
      fetchCategoryData();
      fetchAvailableFilters();
    }
  }, [category_uid, fetchCategoryData, fetchAvailableFilters]);

  // Load products when filters, sorting, or pagination change
  useEffect(() => {
    if (category_uid) {
      fetchProducts();
    }
  }, [category_uid, sortOption, pagination.currentPage, pagination.itemsPerPage, activeFilters, fetchProducts]);

  // Update local state when URL parameters change
  useEffect(() => {
    setSortOption(searchParams.get('sort') || 'popularity');
    setPagination(prev => ({
      ...prev,
      currentPage: parseInt(searchParams.get('page') || '1')
    }));
    
    const brandParam = searchParams.get('brand');
    const minPriceParam = searchParams.get('min_price');
    const maxPriceParam = searchParams.get('max_price');
    
    setActiveFilters({
      brands: brandParam ? [brandParam] : [],
      priceRange: {
        min: minPriceParam ? parseFloat(minPriceParam) : null,
        max: maxPriceParam ? parseFloat(maxPriceParam) : null
      },
      attributes: {}
    });
  }, [searchParams]);

  const hasActiveFilters = activeFilters.brands.length > 0 || 
                         activeFilters.priceRange.min !== null || 
                         activeFilters.priceRange.max !== null ||
                         Object.values(activeFilters.attributes).some(attrs => attrs.length > 0);

  // Render the component
  return (
    <>
      {/* Category Header */}
      <div className="relative w-full bg-gray-100 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800/60 to-gray-800/20">
          {categoryData?.imageUrl && (
            <img 
              src={categoryData.imageUrl} 
              alt={categoryData?.name} 
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 text-white">
          <div className="max-w-3xl">
            <nav className="flex mb-4" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-1 text-sm text-gray-300">
                <li>
                  <Link to="/" className="hover:text-white">Home</Link>
                </li>
                <li className="flex items-center">
                  <FaChevronRight className="h-4 w-4 mx-1" />
                  {categoryData?.parentName ? (
                    <Link to={`/categories/${categoryData.parentUid}`} className="hover:text-white">
                      {categoryData.parentName}
                    </Link>
                  ) : (
                    <span>Categories</span>
                  )}
                </li>
                <li className="flex items-center">
                  <FaChevronRight className="h-4 w-4 mx-1" />
                  <span className="font-medium">{categoryData?.name}</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {categoryData?.name || 'Loading category...'}
            </h1>
            <p className="mt-4 text-xl text-gray-200">
              {categoryData?.description || ''}
            </p>
          </div>
        </div>
      </div>

      {/* Subcategories Navigation */}
      {subcategories.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-8 py-4 overflow-x-auto scrollbar-hide">
              {subcategories.map(subcat => (
                <Link 
                  key={subcat.uid}
                  to={`/categories/${subcat.uid}`}
                  className="flex flex-col items-center flex-shrink-0 group"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 group-hover:border-blue-500">
                    <img 
                      src={subcat.imageUrl} 
                      alt={subcat.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="mt-2 text-sm font-medium text-gray-700 group-hover:text-blue-600">
                    {subcat.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({subcat.productCount})
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Filter Sidebar - Desktop */}
          <div className={`md:block ${viewportSize === 'mobile' ? 'hidden' : ''} w-full md:w-64 flex-shrink-0`}>
            <div className="sticky top-4">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <LuFilterX className="mr-1" /> Clear all
                    </button>
                  )}
                </div>

                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Brand</h3>
                  <div className="space-y-2">
                    {availableFilters.brands.map(brand => (
                      <div key={brand.name} className="flex items-center">
                        <input
                          id={`brand-${brand.name}`}
                          name={`brand-${brand.name}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={activeFilters.brands.includes(brand.name)}
                          onChange={() => handleFilterChange('brand', brand.name)}
                        />
                        <label htmlFor={`brand-${brand.name}`} className="ml-3 text-sm text-gray-700">
                          {brand.name} ({brand.count})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Price</h3>
                  <div className="space-y-2">
                    {availableFilters.priceRanges.map(range => (
                      <div key={range.label} className="flex items-center">
                        <input
                          id={`price-${range.label}`}
                          name="price-range"
                          type="radio"
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={
                            activeFilters.priceRange.min === range.min && 
                            activeFilters.priceRange.max === range.max
                          }
                          onChange={() => handleFilterChange('priceRange', { min: range.min, max: range.max })}
                        />
                        <label htmlFor={`price-${range.label}`} className="ml-3 text-sm text-gray-700">
                          {range.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.entries(availableFilters.attributes).map(([attrKey, attr]) => (
                  <div key={attrKey} className="p-4 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">{attr.name}</h3>
                    <div className="space-y-2">
                      {attr.options.map(option => (
                        <div key={option.value} className="flex items-center">
                          <input
                            id={`${attrKey}-${option.value}`}
                            name={`${attrKey}-${option.value}`}
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={
                              activeFilters.attributes[attrKey] &&
                              activeFilters.attributes[attrKey].includes(option.value)
                            }
                            onChange={() => handleFilterChange(attrKey, option.value)}
                          />
                          <label htmlFor={`${attrKey}-${option.value}`} className="ml-3 text-sm text-gray-700">
                            {option.value} ({option.count})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Filter Button */}
          {viewportSize === 'mobile' && (
            <div className="md:hidden mb-4">
              <button
                onClick={toggleFilterSidebar}
                className="w-full bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {filterSidebarOpen ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
          )}

          {/* Filter Sidebar - Mobile */}
          {viewportSize === 'mobile' && filterSidebarOpen && (
            <div className="md:hidden">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-4">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <LuFilterX className="mr-1" /> Clear all
                    </button>
                  )}
                </div>

                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Brand</h3>
                  <div className="space-y-2">
                    {availableFilters.brands.map(brand => (
                      <div key={brand.name} className="flex items-center">
                        <input
                          id={`mobile-brand-${brand.name}`}
                          name={`mobile-brand-${brand.name}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={activeFilters.brands.includes(brand.name)}
                          onChange={() => handleFilterChange('brand', brand.name)}
                        />
                        <label htmlFor={`mobile-brand-${brand.name}`} className="ml-3 text-sm text-gray-700">
                          {brand.name} ({brand.count})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Price</h3>
                  <div className="space-y-2">
                    {availableFilters.priceRanges.map(range => (
                      <div key={range.label} className="flex items-center">
                        <input
                          id={`mobile-price-${range.label}`}
                          name="mobile-price-range"
                          type="radio"
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={
                            activeFilters.priceRange.min === range.min && 
                            activeFilters.priceRange.max === range.max
                          }
                          onChange={() => handleFilterChange('priceRange', { min: range.min, max: range.max })}
                        />
                        <label htmlFor={`mobile-price-${range.label}`} className="ml-3 text-sm text-gray-700">
                          {range.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.entries(availableFilters.attributes).map(([attrKey, attr]) => (
                  <div key={attrKey} className="p-4 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">{attr.name}</h3>
                    <div className="space-y-2">
                      {attr.options.map(option => (
                        <div key={option.value} className="flex items-center">
                          <input
                            id={`mobile-${attrKey}-${option.value}`}
                            name={`mobile-${attrKey}-${option.value}`}
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={
                              activeFilters.attributes[attrKey] &&
                              activeFilters.attributes[attrKey].includes(option.value)
                            }
                            onChange={() => handleFilterChange(attrKey, option.value)}
                          />
                          <label htmlFor={`mobile-${attrKey}-${option.value}`} className="ml-3 text-sm text-gray-700">
                            {option.value} ({option.count})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Results */}
          <div className="flex-1">
            {/* Results Controls */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-medium text-gray-900 truncate">
                    {pagination.totalItems} {pagination.totalItems === 1 ? 'product' : 'products'} found
                  </h2>
                  {hasActiveFilters && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {activeFilters.brands.map(brand => (
                        <span 
                          key={brand} 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {brand}
                          <button 
                            type="button" 
                            className="ml-1.5 inline-flex flex-shrink-0 h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white"
                            onClick={() => handleFilterChange('brand', brand)}
                          >
                            <span className="sr-only">Remove filter for {brand}</span>
                            <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                              <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      {activeFilters.priceRange.min !== null || activeFilters.priceRange.max !== null ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Price: 
                          {activeFilters.priceRange.min !== null ? ` $${activeFilters.priceRange.min}` : ' $0'} 
                          {' - '} 
                          {activeFilters.priceRange.max !== null ? `$${activeFilters.priceRange.max}` : 'Any'}
                          <button 
                            type="button" 
                            className="ml-1.5 inline-flex flex-shrink-0 h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white"
                            onClick={() => handleFilterChange('priceRange', { min: null, max: null })}
                          >
                            <span className="sr-only">Remove price filter</span>
                            <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                              <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                            </svg>
                          </button>
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="mt-4 sm:mt-0 flex items-center">
                  <div className="mr-4">
                    <label htmlFor="sort" className="sr-only">Sort by</label>
                    <select
                      id="sort"
                      name="sort"
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={sortOption}
                      onChange={(e) => handleSortChange(e.target.value)}
                    >
                      <option value="popularity">Most Popular</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="average_rating_desc">Highest Rated</option>
                      <option value="created_at_desc">Newest</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-500'}`}
                      onClick={() => setViewMode('grid')}
                      aria-label="Grid view"
                    >
                      <FaThLarge className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className={`ml-2 p-2 rounded-md ${viewMode === 'list' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-500'}`}
                      onClick={() => setViewMode('list')}
                      aria-label="List view"
                    >
                      <FaList className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}

            {/* No Results */}
            {!isLoading && products.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">No products found</h3>
                <p className="text-gray-500 mb-6">
                  We couldn't find any products matching your criteria. Try adjusting your filters or search terms.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Product Grid */}
            {!isLoading && products.length > 0 && viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map(product => (
                  <div 
                    key={product.uid} 
                    className="group bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="relative">
                      <Link to={`/products/${product.uid}`} className="block aspect-w-3 aspect-h-2">
                        <img 
                          src={product.primaryImageUrl} 
                          alt={product.name} 
                          className="w-full h-48 object-cover"
                        />
                      </Link>
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <button
                          onClick={() => quickAddToCart(product.uid)}
                          className="p-2 bg-blue-600 text-white rounded-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          aria-label="Add to cart"
                          title="Add to cart"
                        >
                          <FaShoppingCart className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => productsToCompare.includes(product.uid) 
                            ? removeFromCompare(product.uid) 
                            : addToCompare(product.uid)
                          }
                          className={`p-2 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                            productsToCompare.includes(product.uid)
                              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                          aria-label={productsToCompare.includes(product.uid) ? "Remove from compare" : "Add to compare"}
                          title={productsToCompare.includes(product.uid) ? "Remove from compare" : "Add to compare"}
                        >
                          <FaExchangeAlt className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => console.log('Add to wishlist:', product.uid)}
                          className="p-2 bg-gray-200 text-gray-600 rounded-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          aria-label="Add to wishlist"
                          title="Add to wishlist"
                        >
                          <FaHeart className="h-4 w-4" />
                        </button>
                      </div>
                      {!product.inStock && (
                        <div className="absolute top-2 left-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Out of stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900">
                        <Link to={`/products/${product.uid}`} className="hover:text-blue-600">
                          {product.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {product.shortDescription}
                      </p>
                      <div className="mt-2 flex items-center">
                        <div className="flex items-center">
                          {[0, 1, 2, 3, 4].map((rating) => (
                            <FaStar
                              key={rating}
                              className={`h-4 w-4 flex-shrink-0 ${
                                product.averageRating > rating
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <p className="ml-2 text-xs text-gray-500">
                          ({product.reviewCount} reviews)
                        </p>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-lg font-medium text-gray-900">
                          {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)}
                        </p>
                        {isProfessionalBuyer && (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                            Bulk pricing available
                          </span>
                        )}
                      </div>
                      {product.brand && (
                        <p className="mt-1 text-xs text-gray-500">
                          Brand: {product.brand}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Product List */}
            {!isLoading && products.length > 0 && viewMode === 'list' && (
              <div className="space-y-4">
                {products.map(product => (
                  <div 
                    key={product.uid} 
                    className="group bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="p-4 sm:p-6 flex flex-col sm:flex-row">
                      <div className="flex-shrink-0 relative">
                        <Link to={`/products/${product.uid}`} className="block">
                          <img 
                            src={product.primaryImageUrl} 
                            alt={product.name} 
                            className="w-full sm:w-40 h-40 object-cover rounded-lg"
                          />
                        </Link>
                        {!product.inStock && (
                          <div className="absolute top-2 left-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Out of stock
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 sm:mt-0 sm:ml-6 flex-1">
                        <div className="flex justify-between">
                          <h3 className="text-lg font-medium text-gray-900">
                            <Link to={`/products/${product.uid}`} className="hover:text-blue-600">
                              {product.name}
                            </Link>
                          </h3>
                          <p className="text-lg font-medium text-gray-900">
                            {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center">
                          <div className="flex items-center">
                            {[0, 1, 2, 3, 4].map((rating) => (
                              <FaStar
                                key={rating}
                                className={`h-4 w-4 flex-shrink-0 ${
                                  product.averageRating > rating
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                          <p className="ml-2 text-sm text-gray-500">
                            ({product.reviewCount} reviews)
                          </p>
                          {product.brand && (
                            <p className="ml-4 text-sm text-gray-500">
                              Brand: {product.brand}
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          {product.shortDescription}
                        </p>
                        {isProfessionalBuyer && (
                          <p className="mt-2 text-sm font-medium text-green-700">
                            Bulk pricing available • Minimum order: 10 units
                          </p>
                        )}
                        <div className="mt-4 flex space-x-2">
                          <button
                            onClick={() => quickAddToCart(product.uid)}
                            disabled={!product.inStock}
                            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                              product.inStock
                                ? 'text-white bg-blue-600 hover:bg-blue-700'
                                : 'text-gray-500 bg-gray-200 cursor-not-allowed'
                            }`}
                          >
                            <FaShoppingCart className="mr-2 h-4 w-4" />
                            {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                          </button>
                          <button
                            onClick={() => productsToCompare.includes(product.uid) 
                              ? removeFromCompare(product.uid) 
                              : addToCompare(product.uid)
                            }
                            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                              productsToCompare.includes(product.uid)
                                ? 'text-white bg-yellow-500 hover:bg-yellow-600'
                                : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            <FaExchangeAlt className="mr-2 h-4 w-4" />
                            {productsToCompare.includes(product.uid) ? 'Remove Compare' : 'Compare'}
                          </button>
                          <button
                            onClick={() => console.log('Add to wishlist:', product.uid)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FaHeart className="mr-2 h-4 w-4" />
                            Wishlist
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!isLoading && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6 rounded-lg shadow-sm">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage <= 1}
                    className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                      pagination.currentPage <= 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage >= pagination.totalPages}
                    className={`relative ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                      pagination.currentPage >= pagination.totalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(pagination.currentPage - 1) * pagination.itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.totalItems}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage <= 1}
                        className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                          pagination.currentPage <= 1
                            ? 'cursor-not-allowed'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        <FaChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                      {/* Page buttons */}
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        
                        // Logic to show pages around the current page
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              pagination.currentPage === pageNum
                                ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage >= pagination.totalPages}
                        className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                          pagination.currentPage >= pagination.totalPages
                            ? 'cursor-not-allowed'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Next</span>
                        <FaChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compare Products Bar */}
      {productsToCompare.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg p-4 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 font-medium">
                  {productsToCompare.length} {productsToCompare.length === 1 ? 'product' : 'products'} selected
                </span>
                <div className="flex -space-x-2">
                  {productsToCompare.map(productId => {
                    const product = products.find(p => p.uid === productId);
                    return (
                      <div key={productId} className="relative">
                        <img 
                          src={product?.primaryImageUrl || `https://picsum.photos/seed/${productId}/100/100`} 
                          alt={product?.name || 'Selected product'} 
                          className="h-10 w-10 rounded-full border border-white object-cover"
                        />
                        <button
                          onClick={() => removeFromCompare(productId)}
                          className="absolute -top-1 -right-1 h-4 w-4 bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 flex items-center justify-center"
                          aria-label="Remove from comparison"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 9L9 3M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setProductsToCompare([])}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear all
                </button>
                <button
                  onClick={navigateToCompare}
                  disabled={productsToCompare.length < 2}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    productsToCompare.length < 2
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <FaExchangeAlt className="mr-2 h-4 w-4" />
                  Compare Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_CategoryBrowsing;