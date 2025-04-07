import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/main";
import axios from "axios";

interface FilterOption {
  name: string;
  count: number;
}

interface AttributeOption {
  value: string;
  count: number;
}

interface FeatureOption {
  key: string;
  name: string;
  count: number;
}

interface FilterParams {
  categoryUid?: string;
  subcategoryUid?: string;
  priceRange: {
    min: number | null;
    max: number | null;
  };
  brands: string[];
  ratings: number | null;
  attributes: Record<string, string[]>;
  availability: "all" | "in_stock" | "next_day";
  features: string[];
}

interface AvailableFilters {
  priceRange: {
    min: number;
    max: number;
  };
  brands: Array<{
    name: string;
    count: number;
  }>;
  attributes: Record<string, {
    name: string;
    options: Array<{
      value: string;
      count: number;
    }>;
  }>;
  features: Array<{
    key: string;
    name: string;
    count: number;
  }>;
}

interface AppliedFilter {
  type: "category" | "price" | "brand" | "rating" | "attribute" | "availability" | "feature";
  key: string;
  value: string;
  label: string;
}

const GV_SearchFilters: React.FC = () => {
  // URL and navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Component state
  const [filterParams, setFilterParams] = useState<FilterParams>({
    priceRange: { min: null, max: null },
    brands: [],
    ratings: null,
    attributes: {},
    availability: "all",
    features: []
  });

  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    priceRange: { min: 0, max: 1000 },
    brands: [],
    attributes: {},
    features: []
  });

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Track which filter sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: true,
    price: true,
    brand: true,
    rating: true,
    availability: true,
    features: true
  });

  // For save search functionality
  const [saveSearchName, setSaveSearchName] = useState<string>("");
  const [showSaveSearchModal, setShowSaveSearchModal] = useState<boolean>(false);

  // Reference for price range debounce
  const priceRangeDebounce = useRef<NodeJS.Timeout | null>(null);

  // Auth state for save search feature
  const { isAuthenticated } = useAppSelector(state => state.auth);

  // Initialize filters from URL parameters
  useEffect(() => {
    const categoryUid = searchParams.get("category_uid") || undefined;
    const minPrice = searchParams.get("min_price");
    const maxPrice = searchParams.get("max_price");
    const brandParam = searchParams.get("brand");
    const ratings = searchParams.get("rating");
    const availability = searchParams.get("availability") as "all" | "in_stock" | "next_day" | null;
    
    // Initialize filter params from URL
    const initialFilterParams: FilterParams = {
      categoryUid,
      priceRange: { 
        min: minPrice ? parseFloat(minPrice) : null, 
        max: maxPrice ? parseFloat(maxPrice) : null 
      },
      brands: brandParam ? brandParam.split(",") : [],
      ratings: ratings ? parseInt(ratings) : null,
      attributes: {},
      availability: availability || "all",
      features: []
    };

    // Handle attribute filters from URL
    searchParams.forEach((value, key) => {
      if (key.startsWith("attr_")) {
        const attributeKey = key.replace("attr_", "");
        initialFilterParams.attributes[attributeKey] = value.split(",");
      } else if (key.startsWith("feature_")) {
        const featureValue = key.replace("feature_", "");
        initialFilterParams.features.push(featureValue);
      }
    });

    setFilterParams(initialFilterParams);
    
    // Fetch filter options based on category or search query
    fetchFilterOptions(categoryUid, searchParams.get("q") || undefined);
  }, [location.pathname]);

  // Update applied filters when filterParams changes
  useEffect(() => {
    const newAppliedFilters: AppliedFilter[] = [];

    // Add category filter if applicable
    if (filterParams.categoryUid) {
      newAppliedFilters.push({
        type: "category",
        key: "category_uid",
        value: filterParams.categoryUid,
        label: "Category" // Would ideally show the category name
      });
    }

    // Add subcategory filter if applicable
    if (filterParams.subcategoryUid) {
      newAppliedFilters.push({
        type: "category",
        key: "subcategory_uid",
        value: filterParams.subcategoryUid,
        label: "Subcategory" // Would ideally show the subcategory name
      });
    }

    // Add price range filters
    if (filterParams.priceRange.min !== null) {
      newAppliedFilters.push({
        type: "price",
        key: "min_price",
        value: filterParams.priceRange.min.toString(),
        label: `Min Price: $${filterParams.priceRange.min}`
      });
    }

    if (filterParams.priceRange.max !== null) {
      newAppliedFilters.push({
        type: "price",
        key: "max_price",
        value: filterParams.priceRange.max.toString(),
        label: `Max Price: $${filterParams.priceRange.max}`
      });
    }

    // Add brand filters
    filterParams.brands.forEach(brand => {
      newAppliedFilters.push({
        type: "brand",
        key: "brand",
        value: brand,
        label: `Brand: ${brand}`
      });
    });

    // Add rating filter
    if (filterParams.ratings !== null) {
      newAppliedFilters.push({
        type: "rating",
        key: "rating",
        value: filterParams.ratings.toString(),
        label: `${filterParams.ratings}+ Stars`
      });
    }

    // Add availability filter if not "all"
    if (filterParams.availability !== "all") {
      newAppliedFilters.push({
        type: "availability",
        key: "availability",
        value: filterParams.availability,
        label: filterParams.availability === "in_stock" ? "In Stock" : "Next Day Delivery"
      });
    }

    // Add attribute filters
    Object.entries(filterParams.attributes).forEach(([key, values]) => {
      values.forEach(value => {
        const attributeName = availableFilters.attributes[key]?.name || key;
        newAppliedFilters.push({
          type: "attribute",
          key: `attr_${key}`,
          value,
          label: `${attributeName}: ${value}`
        });
      });
    });

    // Add feature filters
    filterParams.features.forEach(feature => {
      const featureOption = availableFilters.features.find(f => f.key === feature);
      newAppliedFilters.push({
        type: "feature",
        key: `feature_${feature}`,
        value: feature,
        label: featureOption ? featureOption.name : feature
      });
    });

    setAppliedFilters(newAppliedFilters);
    syncFiltersWithUrl();
  }, [filterParams]);

  // Fetch available filter options from the backend
  const fetchFilterOptions = async (categoryUid?: string, searchQuery?: string) => {
    setIsLoading(true);

    try {
      // Construct the API URL based on whether we have a category or search query
      let url = "http://localhost:1337/api/products?";
      const params = new URLSearchParams();
      
      if (categoryUid) {
        params.append("category_uid", categoryUid);
      }
      
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      
      // Limit to 1 result since we just need the filter options
      params.append("limit", "1");
      
      const response = await axios.get(`${url}${params.toString()}`);
      
      // Since we don't have a dedicated filter API, we'll extract filter info from products
      // In a real app, you'd have a dedicated endpoint for this
      
      // Extract price range
      const priceMin = Math.min(...response.data.products.map((p: any) => p.base_price || 0));
      const priceMax = Math.max(...response.data.products.map((p: any) => p.base_price || 0));
      
      // Extract brands
      const brandsSet = new Set<string>();
      response.data.products.forEach((product: any) => {
        if (product.brand) {
          brandsSet.add(product.brand);
        }
      });
      
      const brands = Array.from(brandsSet).map(brand => ({
        name: brand,
        count: response.data.products.filter((p: any) => p.brand === brand).length
      }));
      
      // For a real app, we would extract attributes and features here as well
      // For now, we'll use placeholders
      
      setAvailableFilters({
        priceRange: {
          min: priceMin || 0,
          max: priceMax || 1000
        },
        brands,
        attributes: {
          material: {
            name: "Material",
            options: [
              { value: "Wood", count: 12 },
              { value: "Metal", count: 8 },
              { value: "Plastic", count: 5 },
              { value: "Composite", count: 3 }
            ]
          },
          size: {
            name: "Size",
            options: [
              { value: "Small", count: 7 },
              { value: "Medium", count: 15 },
              { value: "Large", count: 10 },
              { value: "Extra Large", count: 5 }
            ]
          }
        },
        features: [
          { key: "eco_friendly", name: "Eco-Friendly", count: 8 },
          { key: "certified", name: "Certified", count: 12 },
          { key: "premium", name: "Premium", count: 6 },
          { key: "recyclable", name: "Recyclable", count: 4 }
        ]
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply a filter
  const applyFilter = (type: string, key: string, value: string | number | null) => {
    setFilterParams(prev => {
      const newFilterParams = { ...prev };
      
      switch (type) {
        case "category":
          if (key === "category_uid") {
            newFilterParams.categoryUid = value as string;
          } else if (key === "subcategory_uid") {
            newFilterParams.subcategoryUid = value as string;
          }
          break;
          
        case "price":
          if (key === "min_price") {
            newFilterParams.priceRange = {
              ...newFilterParams.priceRange,
              min: value as number
            };
          } else if (key === "max_price") {
            newFilterParams.priceRange = {
              ...newFilterParams.priceRange,
              max: value as number
            };
          }
          break;
          
        case "brand":
          if (value) {
            if (!newFilterParams.brands.includes(value as string)) {
              newFilterParams.brands = [...newFilterParams.brands, value as string];
            }
          }
          break;
          
        case "rating":
          newFilterParams.ratings = value as number;
          break;
          
        case "availability":
          newFilterParams.availability = value as "all" | "in_stock" | "next_day";
          break;
          
        case "attribute":
          const attributeKey = key.replace("attr_", "");
          if (!newFilterParams.attributes[attributeKey]) {
            newFilterParams.attributes[attributeKey] = [];
          }
          
          if (value && !newFilterParams.attributes[attributeKey].includes(value as string)) {
            newFilterParams.attributes[attributeKey] = [
              ...newFilterParams.attributes[attributeKey],
              value as string
            ];
          }
          break;
          
        case "feature":
          const featureKey = value as string;
          if (!newFilterParams.features.includes(featureKey)) {
            newFilterParams.features = [...newFilterParams.features, featureKey];
          }
          break;
      }
      
      return newFilterParams;
    });
  };

  // Remove a specific filter
  const removeFilter = (filter: AppliedFilter) => {
    setFilterParams(prev => {
      const newFilterParams = { ...prev };
      
      switch (filter.type) {
        case "category":
          if (filter.key === "category_uid") {
            newFilterParams.categoryUid = undefined;
          } else if (filter.key === "subcategory_uid") {
            newFilterParams.subcategoryUid = undefined;
          }
          break;
          
        case "price":
          if (filter.key === "min_price") {
            newFilterParams.priceRange = {
              ...newFilterParams.priceRange,
              min: null
            };
          } else if (filter.key === "max_price") {
            newFilterParams.priceRange = {
              ...newFilterParams.priceRange,
              max: null
            };
          }
          break;
          
        case "brand":
          newFilterParams.brands = newFilterParams.brands.filter(
            brand => brand !== filter.value
          );
          break;
          
        case "rating":
          newFilterParams.ratings = null;
          break;
          
        case "availability":
          newFilterParams.availability = "all";
          break;
          
        case "attribute":
          const attributeKey = filter.key.replace("attr_", "");
          if (newFilterParams.attributes[attributeKey]) {
            newFilterParams.attributes[attributeKey] = newFilterParams.attributes[attributeKey].filter(
              value => value !== filter.value
            );
            
            if (newFilterParams.attributes[attributeKey].length === 0) {
              delete newFilterParams.attributes[attributeKey];
            }
          }
          break;
          
        case "feature":
          const featureKey = filter.value;
          newFilterParams.features = newFilterParams.features.filter(
            feature => feature !== featureKey
          );
          break;
      }
      
      return newFilterParams;
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterParams({
      priceRange: { min: null, max: null },
      brands: [],
      ratings: null,
      attributes: {},
      availability: "all",
      features: []
    });
  };

  // Toggle mobile filters
  const toggleMobileFilters = () => {
    setIsExpanded(!isExpanded);
  };

  // Toggle a filter section expand/collapse
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle price range change with debounce
  const handlePriceRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    
    if (priceRangeDebounce.current) {
      clearTimeout(priceRangeDebounce.current);
    }
    
    priceRangeDebounce.current = setTimeout(() => {
      setFilterParams(prev => ({
        ...prev,
        priceRange: {
          ...prev.priceRange,
          [type]: numValue
        }
      }));
    }, 500);
  };

  // Sync filters with URL parameters
  const syncFiltersWithUrl = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    
    // Clear existing filter parameters
    newSearchParams.delete("category_uid");
    newSearchParams.delete("subcategory_uid");
    newSearchParams.delete("min_price");
    newSearchParams.delete("max_price");
    newSearchParams.delete("brand");
    newSearchParams.delete("rating");
    newSearchParams.delete("availability");
    
    // Remove attribute and feature params
    Array.from(newSearchParams.keys()).forEach(key => {
      if (key.startsWith("attr_") || key.startsWith("feature_")) {
        newSearchParams.delete(key);
      }
    });
    
    // Add current filter parameters
    if (filterParams.categoryUid) {
      newSearchParams.set("category_uid", filterParams.categoryUid);
    }
    
    if (filterParams.subcategoryUid) {
      newSearchParams.set("subcategory_uid", filterParams.subcategoryUid);
    }
    
    if (filterParams.priceRange.min !== null) {
      newSearchParams.set("min_price", filterParams.priceRange.min.toString());
    }
    
    if (filterParams.priceRange.max !== null) {
      newSearchParams.set("max_price", filterParams.priceRange.max.toString());
    }
    
    if (filterParams.brands.length > 0) {
      newSearchParams.set("brand", filterParams.brands.join(","));
    }
    
    if (filterParams.ratings !== null) {
      newSearchParams.set("rating", filterParams.ratings.toString());
    }
    
    if (filterParams.availability !== "all") {
      newSearchParams.set("availability", filterParams.availability);
    }
    
    // Add attribute filters
    Object.entries(filterParams.attributes).forEach(([key, values]) => {
      if (values.length > 0) {
        newSearchParams.set(`attr_${key}`, values.join(","));
      }
    });
    
    // Add feature filters
    filterParams.features.forEach(feature => {
      newSearchParams.set(`feature_${feature}`, "true");
    });
    
    // Update URL without navigating
    setSearchParams(newSearchParams);
  };

  // Save filter configuration
  const saveFilterConfiguration = async () => {
    if (!isAuthenticated) {
      return;
    }
    
    try {
      await axios.post("http://localhost:1337/api/users/saved-searches", {
        name: saveSearchName,
        filters: filterParams,
        url: window.location.pathname + window.location.search
      });
      
      setShowSaveSearchModal(false);
      setSaveSearchName("");
      
      // Show success message (would use a toast notification in a full app)
      alert("Search saved successfully");
    } catch (error) {
      console.error("Error saving search:", error);
      alert("Failed to save search");
    }
  };

  return (
    <>
      {/* Mobile filter button - only visible on mobile */}
      <div className="lg:hidden fixed bottom-4 right-4 z-10">
        <button
          onClick={toggleMobileFilters}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 6a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 6a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
          </svg>
          <span className="ml-2 font-medium">Filters</span>
        </button>
      </div>

      {/* Main filter container */}
      <div className={`
        lg:block lg:w-1/4 lg:min-w-[250px] lg:max-w-[300px] lg:pr-4 lg:pb-6
        fixed lg:relative lg:top-auto lg:left-auto lg:right-auto lg:bottom-auto
        inset-0 z-30 bg-white lg:bg-transparent transform transition-transform duration-300 ease-in-out
        ${isExpanded ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
      `}>
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button onClick={toggleMobileFilters} className="text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter content */}
        <div className="overflow-y-auto h-full lg:h-auto p-4 lg:p-0 pb-20 lg:pb-0">
          {/* Applied filters section */}
          {appliedFilters.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Applied Filters</h3>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {appliedFilters.map((filter, index) => (
                  <div
                    key={`${filter.type}-${filter.key}-${filter.value}-${index}`}
                    className="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{filter.label}</span>
                    <button
                      onClick={() => removeFilter(filter)}
                      className="ml-2 text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save search button (for authenticated users) */}
          {isAuthenticated && (
            <div className="mb-6">
              <button
                onClick={() => setShowSaveSearchModal(true)}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
              >
                Save This Search
              </button>
            </div>
          )}

          {/* Filter sections */}
          {/* Price Range */}
          <div className="mb-6 border-b pb-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('price')}
            >
              <h3 className="text-lg font-semibold">Price Range</h3>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${expandedSections.price ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {expandedSections.price && (
              <div className="mt-3">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-1">
                    <label htmlFor="min-price" className="block text-sm text-gray-600 mb-1">Min ($)</label>
                    <input
                      type="number"
                      id="min-price"
                      min={availableFilters.priceRange.min}
                      max={availableFilters.priceRange.max}
                      value={filterParams.priceRange.min !== null ? filterParams.priceRange.min : ''}
                      onChange={(e) => handlePriceRangeChange('min', e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="Min"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="max-price" className="block text-sm text-gray-600 mb-1">Max ($)</label>
                    <input
                      type="number"
                      id="max-price"
                      min={availableFilters.priceRange.min}
                      max={availableFilters.priceRange.max}
                      value={filterParams.priceRange.max !== null ? filterParams.priceRange.max : ''}
                      onChange={(e) => handlePriceRangeChange('max', e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="Max"
                    />
                  </div>
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min={availableFilters.priceRange.min}
                    max={availableFilters.priceRange.max}
                    value={filterParams.priceRange.max !== null ? filterParams.priceRange.max : availableFilters.priceRange.max}
                    onChange={(e) => handlePriceRangeChange('max', e.target.value)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>${availableFilters.priceRange.min}</span>
                    <span>${availableFilters.priceRange.max}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Brand Filter */}
          <div className="mb-6 border-b pb-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('brand')}
            >
              <h3 className="text-lg font-semibold">Brand</h3>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${expandedSections.brand ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {expandedSections.brand && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Search brands..."
                  className="w-full px-3 py-2 border rounded text-sm mb-3"
                />
                <div className="max-h-48 overflow-y-auto">
                  {availableFilters.brands.map(brand => (
                    <div key={brand.name} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={`brand-${brand.name}`}
                        checked={filterParams.brands.includes(brand.name)}
                        onChange={() => applyFilter('brand', 'brand', brand.name)}
                        className="mr-2"
                      />
                      <label htmlFor={`brand-${brand.name}`} className="text-sm flex-1">
                        {brand.name}
                      </label>
                      <span className="text-xs text-gray-500">({brand.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rating Filter */}
          <div className="mb-6 border-b pb-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('rating')}
            >
              <h3 className="text-lg font-semibold">Rating</h3>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${expandedSections.rating ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {expandedSections.rating && (
              <div className="mt-3 space-y-2">
                {[4, 3, 2, 1].map(rating => (
                  <div
                    key={`rating-${rating}`}
                    className="flex items-center cursor-pointer"
                    onClick={() => applyFilter('rating', 'rating', rating)}
                  >
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <svg
                          key={index}
                          className={`h-5 w-5 ${index < rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="ml-2 text-sm">& Up</span>
                    <input
                      type="radio"
                      name="rating"
                      checked={filterParams.ratings === rating}
                      onChange={() => {}}
                      className="ml-auto"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Availability Filter */}
          <div className="mb-6 border-b pb-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('availability')}
            >
              <h3 className="text-lg font-semibold">Availability</h3>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${expandedSections.availability ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {expandedSections.availability && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="availability-all"
                    name="availability"
                    checked={filterParams.availability === "all"}
                    onChange={() => applyFilter('availability', 'availability', 'all')}
                    className="mr-2"
                  />
                  <label htmlFor="availability-all" className="text-sm">All Items</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="availability-in-stock"
                    name="availability"
                    checked={filterParams.availability === "in_stock"}
                    onChange={() => applyFilter('availability', 'availability', 'in_stock')}
                    className="mr-2"
                  />
                  <label htmlFor="availability-in-stock" className="text-sm">In Stock</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="availability-next-day"
                    name="availability"
                    checked={filterParams.availability === "next_day"}
                    onChange={() => applyFilter('availability', 'availability', 'next_day')}
                    className="mr-2"
                  />
                  <label htmlFor="availability-next-day" className="text-sm">Next Day Delivery</label>
                </div>
              </div>
            )}
          </div>

          {/* Material (Attribute) Filter */}
          {availableFilters.attributes.material && (
            <div className="mb-6 border-b pb-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('material')}
              >
                <h3 className="text-lg font-semibold">Material</h3>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transform transition-transform ${expandedSections.material ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {expandedSections.material && (
                <div className="mt-3">
                  <div className="max-h-48 overflow-y-auto">
                    {availableFilters.attributes.material.options.map(option => (
                      <div key={option.value} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id={`material-${option.value}`}
                          checked={(filterParams.attributes.material || []).includes(option.value)}
                          onChange={() => applyFilter('attribute', 'attr_material', option.value)}
                          className="mr-2"
                        />
                        <label htmlFor={`material-${option.value}`} className="text-sm flex-1">
                          {option.value}
                        </label>
                        <span className="text-xs text-gray-500">({option.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Size (Attribute) Filter */}
          {availableFilters.attributes.size && (
            <div className="mb-6 border-b pb-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('size')}
              >
                <h3 className="text-lg font-semibold">Size</h3>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transform transition-transform ${expandedSections.size ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {expandedSections.size && (
                <div className="mt-3">
                  <div className="max-h-48 overflow-y-auto">
                    {availableFilters.attributes.size.options.map(option => (
                      <div key={option.value} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id={`size-${option.value}`}
                          checked={(filterParams.attributes.size || []).includes(option.value)}
                          onChange={() => applyFilter('attribute', 'attr_size', option.value)}
                          className="mr-2"
                        />
                        <label htmlFor={`size-${option.value}`} className="text-sm flex-1">
                          {option.value}
                        </label>
                        <span className="text-xs text-gray-500">({option.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Features Filter */}
          <div className="mb-6">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('features')}
            >
              <h3 className="text-lg font-semibold">Features</h3>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${expandedSections.features ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {expandedSections.features && (
              <div className="mt-3">
                <div className="max-h-48 overflow-y-auto">
                  {availableFilters.features.map(feature => (
                    <div key={feature.key} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={`feature-${feature.key}`}
                        checked={filterParams.features.includes(feature.key)}
                        onChange={() => applyFilter('feature', `feature_${feature.key}`, feature.key)}
                        className="mr-2"
                      />
                      <label htmlFor={`feature-${feature.key}`} className="text-sm flex-1">
                        {feature.name}
                      </label>
                      <span className="text-xs text-gray-500">({feature.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save search modal */}
      {showSaveSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Save This Search</h2>
            <p className="text-gray-600 mb-4">
              Give your search a name to save it for future use.
            </p>
            <input
              type="text"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              placeholder="My Search Name"
              className="w-full px-3 py-2 border rounded mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveSearchModal(false)}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={saveFilterConfiguration}
                disabled={!saveSearchName.trim()}
                className={`px-4 py-2 rounded text-white ${
                  saveSearchName.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile backdrop overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleMobileFilters}
        ></div>
      )}
    </>
  );
};

export default GV_SearchFilters;