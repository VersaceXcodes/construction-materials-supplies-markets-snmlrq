import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAppSelector, useAppDispatch, notificationsActions } from "@/store/main";
import { StarIcon, ShoppingCartIcon, GridIcon, ListIcon, SearchIcon } from "@heroicons/react/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/solid";

const UV_SearchResults: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get URL parameters
  const searchQuery = searchParams.get("q") || "";
  const categoryUid = searchParams.get("category_uid") || null;
  const sortOption = searchParams.get("sort") || "relevance";
  const currentPage = parseInt(searchParams.get("page") || "1");
  const itemsPerPage = parseInt(searchParams.get("limit") || "20");
  const minPrice = searchParams.get("min_price") ? parseFloat(searchParams.get("min_price") || "") : null;
  const maxPrice = searchParams.get("max_price") ? parseFloat(searchParams.get("max_price") || "") : null;
  const brand = searchParams.get("brand") || null;

  // Global state
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { viewportSize } = useAppSelector((state) => state.uiState);
  
  // Local state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20
  });
  const [availableFilters, setAvailableFilters] = useState({
    categories: [],
    brands: [],
    priceRanges: [],
    attributes: {}
  });
  const [suggestedSearches, setSuggestedSearches] = useState<string[]>([]);
  const [spellingCorrections, setSpellingCorrections] = useState<{ original: string, corrected: string } | null>(null);
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeFilters, setActiveFilters] = useState({
    categoryUid: categoryUid,
    brands: brand ? [brand] : [],
    priceRange: { 
      min: minPrice, 
      max: maxPrice 
    },
    attributes: {}
  });

  // Function to perform search
  const performSearch = useCallback(async () => {
    if (!searchQuery) {
      navigate("/");
      return;
    }

    setIsLoading(true);

    try {
      // Build query parameters
      const params: Record<string, string> = {
        q: searchQuery,
      };

      if (categoryUid) params.category_uid = categoryUid;
      if (sortOption) params.sort_by = sortOption;
      if (currentPage) params.page = currentPage.toString();
      if (itemsPerPage) params.limit = itemsPerPage.toString();
      if (minPrice) params.min_price = minPrice.toString();
      if (maxPrice) params.max_price = maxPrice.toString();
      if (brand) params.brand = brand;

      // Make API call to search endpoint
      const response = await axios.get("http://localhost:1337/api/search", { params });

      // Update state with search results
      setSearchResults(response.data.products || []);
      setPagination({
        currentPage: parseInt(response.data.pagination.current_page),
        totalPages: parseInt(response.data.pagination.total_pages),
        totalItems: parseInt(response.data.pagination.total_items),
        itemsPerPage: parseInt(response.data.pagination.limit)
      });

      // Generate suggested searches based on results
      generateSuggestedSearches(response.data.products);

      // Log search analytics
      logSearchAnalytics(searchQuery, response.data.pagination.total_items);

      // Fetch available filters
      fetchAvailableFilters();

    } catch (error) {
      console.error("Search error:", error);
      dispatch(
        notificationsActions.addToastNotification({
          message: "Error searching for products. Please try again.",
          type: "error"
        })
      );
      setSearchResults([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 20
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, categoryUid, sortOption, currentPage, itemsPerPage, minPrice, maxPrice, brand, dispatch, navigate]);

  // Function to fetch available filters
  const fetchAvailableFilters = async () => {
    try {
      // In a real implementation, this would be a separate API call
      // For now, we'll generate mock filters based on search results
      const categories = [
        { uid: "cat-1", name: "Building Materials", count: 45 },
        { uid: "cat-2", name: "Tools", count: 23 },
        { uid: "cat-3", name: "Electrical", count: 18 },
        { uid: "cat-4", name: "Plumbing", count: 12 },
      ];

      const brands = searchResults
        .reduce((acc: { name: string, count: number }[], product) => {
          const existingBrand = acc.find(b => b.name === product.brand);
          if (existingBrand) {
            existingBrand.count += 1;
          } else if (product.brand) {
            acc.push({ name: product.brand, count: 1 });
          }
          return acc;
        }, [])
        .sort((a, b) => b.count - a.count);

      const priceRanges = [
        { min: 0, max: 50, label: "Under $50" },
        { min: 50, max: 100, label: "$50 - $100" },
        { min: 100, max: 250, label: "$100 - $250" },
        { min: 250, max: 500, label: "$250 - $500" },
        { min: 500, max: null, label: "Over $500" }
      ];

      // Mock attributes based on search query
      const attributes: Record<string, { name: string, options: Array<{ value: string, count: number }> }> = {};
      
      if (searchQuery.includes("wood") || searchQuery.includes("lumber")) {
        attributes.material = {
          name: "Material",
          options: [
            { value: "Pine", count: 12 },
            { value: "Oak", count: 8 },
            { value: "Plywood", count: 15 },
            { value: "MDF", count: 6 }
          ]
        };
      } else if (searchQuery.includes("tool") || searchQuery.includes("drill")) {
        attributes.power_source = {
          name: "Power Source",
          options: [
            { value: "Cordless", count: 18 },
            { value: "Corded", count: 12 },
            { value: "Pneumatic", count: 4 }
          ]
        };
        attributes.voltage = {
          name: "Voltage",
          options: [
            { value: "12V", count: 8 },
            { value: "18V", count: 14 },
            { value: "20V", count: 6 }
          ]
        };
      }

      setAvailableFilters({
        categories,
        brands,
        priceRanges,
        attributes
      });
    } catch (error) {
      console.error("Error fetching filters:", error);
    }
  };

  // Function to fetch recently viewed products
  const fetchRecentlyViewedProducts = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // This would be a real API call in production
      // For now, we'll use mock data
      const mockRecentlyViewed = [
        {
          uid: "prod-recent-1",
          name: "Premium Plywood Sheet 4x8",
          primaryImageUrl: "https://picsum.photos/seed/plywood1/300/300",
          price: 37.99,
          currency: "USD"
        },
        {
          uid: "prod-recent-2",
          name: "Cordless Drill 18V",
          primaryImageUrl: "https://picsum.photos/seed/drill1/300/300",
          price: 129.99,
          currency: "USD"
        },
        {
          uid: "prod-recent-3",
          name: "PVC Pipe 10ft",
          primaryImageUrl: "https://picsum.photos/seed/pipe1/300/300",
          price: 12.49,
          currency: "USD"
        }
      ];

      setRecentlyViewedProducts(mockRecentlyViewed);
    } catch (error) {
      console.error("Error fetching recently viewed products:", error);
    }
  }, [isAuthenticated]);

  // Function to generate suggested searches based on results
  const generateSuggestedSearches = (products: any[]) => {
    // In a real implementation, this would come from the backend
    // For now, we'll generate some mock suggestions based on the query
    const suggestions: string[] = [];
    
    if (searchQuery.includes("wood")) {
      suggestions.push("plywood sheets", "lumber 2x4", "hardwood flooring");
    } else if (searchQuery.includes("tool")) {
      suggestions.push("power tools", "hand tools", "tool sets");
    } else if (searchQuery.includes("paint")) {
      suggestions.push("interior paint", "exterior paint", "paint brushes");
    } else {
      suggestions.push(
        `${searchQuery} tools`, 
        `${searchQuery} materials`, 
        `professional ${searchQuery}`
      );
    }
    
    // Check for potential spelling corrections
    const commonTerms = [
      { misspelled: "lumbar", correct: "lumber" },
      { misspelled: "concreate", correct: "concrete" },
      { misspelled: "screw drivers", correct: "screwdrivers" },
      { misspelled: "hammars", correct: "hammers" },
      { misspelled: "nales", correct: "nails" }
    ];
    
    const potentialCorrection = commonTerms.find(term => 
      searchQuery.toLowerCase().includes(term.misspelled)
    );
    
    if (potentialCorrection) {
      setSpellingCorrections({
        original: searchQuery,
        corrected: searchQuery.toLowerCase().replace(
          potentialCorrection.misspelled, 
          potentialCorrection.correct
        )
      });
    } else {
      setSpellingCorrections(null);
    }
    
    setSuggestedSearches(suggestions);
  };

  // Function to handle filter changes
  const handleFilterChange = (filterType: string, value: any) => {
    let newFilters = { ...activeFilters };
    
    switch (filterType) {
      case 'category':
        newFilters.categoryUid = value;
        break;
      case 'brand':
        if (newFilters.brands.includes(value)) {
          newFilters.brands = newFilters.brands.filter(b => b !== value);
        } else {
          newFilters.brands = [...newFilters.brands, value];
        }
        break;
      case 'priceMin':
        newFilters.priceRange.min = value;
        break;
      case 'priceMax':
        newFilters.priceRange.max = value;
        break;
      case 'attribute':
        const [attrName, attrValue] = value.split('|');
        if (!newFilters.attributes[attrName]) {
          newFilters.attributes[attrName] = [];
        }
        
        if (newFilters.attributes[attrName].includes(attrValue)) {
          newFilters.attributes[attrName] = newFilters.attributes[attrName].filter(v => v !== attrValue);
          if (newFilters.attributes[attrName].length === 0) {
            delete newFilters.attributes[attrName];
          }
        } else {
          newFilters.attributes[attrName] = [...newFilters.attributes[attrName], attrValue];
        }
        break;
    }
    
    setActiveFilters(newFilters);
    
    // Update URL parameters
    const newSearchParams = new URLSearchParams(searchParams);
    
    // Reset to first page when filters change
    newSearchParams.set('page', '1');
    
    if (newFilters.categoryUid) {
      newSearchParams.set('category_uid', newFilters.categoryUid);
    } else {
      newSearchParams.delete('category_uid');
    }
    
    if (newFilters.brands.length > 0) {
      newSearchParams.set('brand', newFilters.brands[0]); // Currently only supporting one brand in URL
    } else {
      newSearchParams.delete('brand');
    }
    
    if (newFilters.priceRange.min !== null) {
      newSearchParams.set('min_price', newFilters.priceRange.min.toString());
    } else {
      newSearchParams.delete('min_price');
    }
    
    if (newFilters.priceRange.max !== null) {
      newSearchParams.set('max_price', newFilters.priceRange.max.toString());
    } else {
      newSearchParams.delete('max_price');
    }
    
    setSearchParams(newSearchParams);
  };

  // Function to handle sort change
  const handleSortChange = (sortValue: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('sort', sortValue);
    setSearchParams(newSearchParams);
  };

  // Function to handle page change
  const handlePageChange = (page: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', page.toString());
    setSearchParams(newSearchParams);
  };

  // Function to toggle view mode (grid/list)
  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };

  // Function to quickly add product to cart
  const quickAddToCart = async (productUid: string, quantity = 1) => {
    if (!isAuthenticated) {
      dispatch(
        notificationsActions.addToastNotification({
          message: "Please sign in to add items to your cart",
          type: "info"
        })
      );
      return;
    }

    try {
      await axios.post("http://localhost:1337/api/cart/items", {
        product_uid: productUid,
        quantity
      });

      dispatch(
        notificationsActions.addToastNotification({
          message: "Item added to cart successfully",
          type: "success"
        })
      );
    } catch (error) {
      console.error("Add to cart error:", error);
      dispatch(
        notificationsActions.addToastNotification({
          message: "Failed to add item to cart. Please try again.",
          type: "error"
        })
      );
    }
  };

  // Function to save search query for authenticated users
  const saveSearchQuery = async () => {
    if (!isAuthenticated) {
      dispatch(
        notificationsActions.addToastNotification({
          message: "Please sign in to save searches",
          type: "info"
        })
      );
      return;
    }

    try {
      // This would be an actual API call in production
      // For now, we'll just show a success message
      dispatch(
        notificationsActions.addToastNotification({
          message: "Search saved successfully",
          type: "success"
        })
      );
    } catch (error) {
      console.error("Save search error:", error);
      dispatch(
        notificationsActions.addToastNotification({
          message: "Failed to save search. Please try again.",
          type: "error"
        })
      );
    }
  };

  // Function to log search analytics
  const logSearchAnalytics = (query: string, resultsCount: number) => {
    // In a real implementation, this would send data to the backend
    console.log(`Search Analytics - Query: ${query}, Results: ${resultsCount}`);
  };

  // Function to handle clicking on a spelling correction
  const handleSpellingCorrectionClick = (correctedQuery: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('q', correctedQuery);
    setSearchParams(newSearchParams);
  };

  // Effect to perform search when parameters change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Effect to fetch recently viewed products on mount and auth change
  useEffect(() => {
    fetchRecentlyViewedProducts();
  }, [fetchRecentlyViewedProducts]);

  // Function to render star ratings
  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star}>
            {star <= Math.round(rating) ? (
              <StarIconSolid className="h-4 w-4 text-yellow-400" />
            ) : (
              <StarIcon className="h-4 w-4 text-gray-300" />
            )}
          </span>
        ))}
      </div>
    );
  };

  // Function to render pagination
  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Previous button
    pages.push(
      <button
        key="prev"
        onClick={() => handlePageChange(pagination.currentPage - 1)}
        disabled={pagination.currentPage === 1}
        className="px-3 py-1 rounded border border-gray-300 mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        &laquo;
      </button>
    );
    
    // First page if not included in visible range
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className={`px-3 py-1 rounded border border-gray-300 mr-1`}
        >
          1
        </button>
      );
      
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="px-2 py-1">
            ...
          </span>
        );
      }
    }
    
    // Visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 rounded border mr-1 ${
            i === pagination.currentPage
              ? "bg-blue-600 text-white border-blue-600"
              : "border-gray-300"
          }`}
        >
          {i}
        </button>
      );
    }
    
    // Last page if not included in visible range
    if (endPage < pagination.totalPages) {
      if (endPage < pagination.totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="px-2 py-1">
            ...
          </span>
        );
      }
      
      pages.push(
        <button
          key={pagination.totalPages}
          onClick={() => handlePageChange(pagination.totalPages)}
          className={`px-3 py-1 rounded border border-gray-300 mr-1`}
        >
          {pagination.totalPages}
        </button>
      );
    }
    
    // Next button
    pages.push(
      <button
        key="next"
        onClick={() => handlePageChange(pagination.currentPage + 1)}
        disabled={pagination.currentPage === pagination.totalPages}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        &raquo;
      </button>
    );
    
    return (
      <div className="flex flex-wrap justify-center my-6">
        {pages}
      </div>
    );
  };

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {/* Search header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            Search results for "{searchQuery}"
          </h1>
          
          {/* Spelling corrections */}
          {spellingCorrections && (
            <p className="text-gray-600 mb-2">
              Did you mean:{" "}
              <button
                onClick={() => handleSpellingCorrectionClick(spellingCorrections.corrected)}
                className="text-blue-600 hover:underline"
              >
                {spellingCorrections.corrected}
              </button>
            </p>
          )}
          
          {/* Results count */}
          <p className="text-gray-600">
            {isLoading 
              ? "Searching..." 
              : `${pagination.totalItems} results found`
            }
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row">
          {/* Filters sidebar */}
          <div className="lg:w-1/4 mb-6 lg:mb-0 lg:pr-6">
            <div className="bg-white rounded-lg shadow p-4 sticky top-4">
              <h2 className="font-bold text-lg mb-4">Filters</h2>
              
              {/* Category filter */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Categories</h3>
                <ul className="space-y-1">
                  {availableFilters.categories.map((category) => (
                    <li key={category.uid} className="flex items-center">
                      <input
                        type="radio"
                        id={`category-${category.uid}`}
                        name="category"
                        checked={activeFilters.categoryUid === category.uid}
                        onChange={() => handleFilterChange('category', category.uid)}
                        className="mr-2"
                      />
                      <label htmlFor={`category-${category.uid}`} className="text-sm flex-grow">
                        {category.name} <span className="text-gray-500">({category.count})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Price range filter */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Price Range</h3>
                <div className="flex items-center mb-2">
                  <span className="mr-2">$</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={activeFilters.priceRange.min || ''}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value ? parseFloat(e.target.value) : null)}
                    className="border rounded px-2 py-1 w-20 text-sm"
                    min="0"
                  />
                  <span className="mx-2">-</span>
                  <span className="mr-2">$</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={activeFilters.priceRange.max || ''}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value ? parseFloat(e.target.value) : null)}
                    className="border rounded px-2 py-1 w-20 text-sm"
                    min="0"
                  />
                </div>
                <div className="space-y-1">
                  {availableFilters.priceRanges.map((range, index) => (
                    <div key={index} className="flex items-center">
                      <input
                        type="radio"
                        id={`price-${index}`}
                        name="price-range"
                        checked={activeFilters.priceRange.min === range.min && activeFilters.priceRange.max === range.max}
                        onChange={() => {
                          handleFilterChange('priceMin', range.min);
                          handleFilterChange('priceMax', range.max);
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={`price-${index}`} className="text-sm">
                        {range.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Brand filter */}
              {availableFilters.brands.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Brands</h3>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {availableFilters.brands.map((brand, index) => (
                      <li key={index} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`brand-${index}`}
                          checked={activeFilters.brands.includes(brand.name)}
                          onChange={() => handleFilterChange('brand', brand.name)}
                          className="mr-2"
                        />
                        <label htmlFor={`brand-${index}`} className="text-sm flex-grow">
                          {brand.name} <span className="text-gray-500">({brand.count})</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Dynamic attribute filters */}
              {Object.entries(availableFilters.attributes).map(([attrKey, attribute]) => (
                <div key={attrKey} className="mb-4">
                  <h3 className="font-semibold mb-2">{attribute.name}</h3>
                  <ul className="space-y-1">
                    {attribute.options.map((option, index) => (
                      <li key={index} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`attr-${attrKey}-${index}`}
                          checked={activeFilters.attributes[attrKey]?.includes(option.value) || false}
                          onChange={() => handleFilterChange('attribute', `${attrKey}|${option.value}`)}
                          className="mr-2"
                        />
                        <label htmlFor={`attr-${attrKey}-${index}`} className="text-sm flex-grow">
                          {option.value} <span className="text-gray-500">({option.count})</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              
              {/* Save search button (for authenticated users) */}
              {isAuthenticated && (
                <button
                  onClick={saveSearchQuery}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded flex items-center justify-center mt-4"
                >
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Save this search
                </button>
              )}
            </div>
          </div>
          
          {/* Search results */}
          <div className="lg:w-3/4">
            {/* Results header with sorting and view options */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 bg-white rounded-lg shadow p-4">
              <div className="mb-2 sm:mb-0">
                <label htmlFor="sort" className="mr-2 font-medium">Sort by:</label>
                <select
                  id="sort"
                  value={sortOption}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating_desc">Highest Rated</option>
                  <option value="newest">Newest Arrivals</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <span className="mr-2 text-sm">View:</span>
                <button
                  onClick={toggleViewMode}
                  className={`p-1 mr-1 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                  aria-label="Grid view"
                >
                  <GridIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={toggleViewMode}
                  className={`p-1 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                  aria-label="List view"
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Loading state */}
            {isLoading && (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
            
            {/* No results state */}
            {!isLoading && searchResults.length === 0 && (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <h2 className="text-xl font-semibold mb-4">No results found for "{searchQuery}"</h2>
                <p className="text-gray-600 mb-6">Try checking your spelling or using more general terms.</p>
                
                {suggestedSearches.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-medium mb-2">Suggestions:</h3>
                    <ul className="list-disc list-inside">
                      {suggestedSearches.map((suggestion, index) => (
                        <li key={index}>
                          <Link
                            to={`/search?q=${encodeURIComponent(suggestion)}`}
                            className="text-blue-600 hover:underline"
                          >
                            {suggestion}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div>
                  <h3 className="font-medium mb-2">Browse popular categories:</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {availableFilters.categories.slice(0, 4).map((category) => (
                      <Link
                        key={category.uid}
                        to={`/categories/${category.uid}`}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-full"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Results grid/list */}
            {!isLoading && searchResults.length > 0 && (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                {searchResults.map((product) => (
                  <div
                    key={product.uid}
                    className={`bg-white rounded-lg shadow overflow-hidden ${
                      viewMode === 'grid' ? '' : 'flex'
                    }`}
                  >
                    {/* Product image */}
                    <Link
                      to={`/products/${product.uid}`}
                      className={viewMode === 'grid' ? 'block' : 'flex-shrink-0 w-48 h-48'}
                    >
                      <img
                        src={product.primary_image_url || `https://picsum.photos/seed/${product.uid}/300/300`}
                        alt={product.name}
                        className={`w-full h-48 object-cover ${viewMode === 'grid' ? '' : 'h-full w-full'}`}
                      />
                    </Link>
                    
                    {/* Product details */}
                    <div className="p-4 flex flex-col h-full">
                      {/* Category */}
                      <div className="text-xs text-gray-500 mb-1">
                        {product.category_name || "Uncategorized"}
                      </div>
                      
                      {/* Product name */}
                      <Link to={`/products/${product.uid}`} className="text-lg font-semibold hover:text-blue-600 mb-1">
                        {product.name}
                      </Link>
                      
                      {/* Brand */}
                      {product.brand && (
                        <div className="text-sm text-gray-600 mb-1">
                          By <span className="font-medium">{product.brand}</span>
                        </div>
                      )}
                      
                      {/* Rating */}
                      <div className="flex items-center mb-2">
                        {renderStars(product.average_rating || 0)}
                        <span className="text-xs text-gray-500 ml-1">
                          ({product.review_count || 0})
                        </span>
                      </div>
                      
                      {/* Short description */}
                      <p className="text-sm text-gray-600 mb-4 flex-grow">
                        {product.short_description?.substring(0, 100) || "No description available"}
                        {product.short_description?.length > 100 ? "..." : ""}
                      </p>
                      
                      {/* Price and add to cart */}
                      <div className="flex items-center justify-between mt-auto">
                        <div className="text-lg font-bold">
                          ${product.base_price.toFixed(2)}
                        </div>
                        <button
                          onClick={() => quickAddToCart(product.uid)}
                          className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded flex items-center"
                        >
                          <ShoppingCartIcon className="h-4 w-4 mr-1" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination */}
            {!isLoading && searchResults.length > 0 && pagination.totalPages > 1 && renderPagination()}
            
            {/* Related searches */}
            {!isLoading && searchResults.length > 0 && suggestedSearches.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow p-4">
                <h2 className="font-bold text-lg mb-2">Related Searches</h2>
                <div className="flex flex-wrap gap-2">
                  {suggestedSearches.map((suggestion, index) => (
                    <Link
                      key={index}
                      to={`/search?q=${encodeURIComponent(suggestion)}`}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-3 rounded-full text-sm"
                    >
                      {suggestion}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {/* Recently viewed products */}
            {isAuthenticated && recentlyViewedProducts.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow p-4">
                <h2 className="font-bold text-lg mb-4">Recently Viewed</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4">
                  {recentlyViewedProducts.map((product) => (
                    <Link
                      key={product.uid}
                      to={`/products/${product.uid}`}
                      className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <img
                        src={product.primaryImageUrl}
                        alt={product.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        <h3 className="text-sm font-medium truncate">{product.name}</h3>
                        <p className="text-sm font-bold">${product.price.toFixed(2)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SearchResults;