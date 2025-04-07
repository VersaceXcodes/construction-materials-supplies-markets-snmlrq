import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useAppSelector } from "@/store/main";
import axios from "axios";
import { format, parseISO, isValid } from "date-fns";

// Constants
const PROMOTION_TYPES = [
  { value: "percentage", label: "Percentage Discount", description: "Deduct a percentage from the product's price" },
  { value: "fixed_amount", label: "Fixed Amount Discount", description: "Deduct a fixed amount from the product's price" },
  { value: "buy_x_get_y", label: "Buy X Get Y", description: "Buy X items, get Y items at a discount" },
  { value: "free_shipping", label: "Free Shipping", description: "Remove shipping costs for eligible orders" },
  { value: "bundle", label: "Bundle Discount", description: "Special pricing when buying specific products together" }
];

const CUSTOMER_GROUPS = [
  { value: "all", label: "All Customers" },
  { value: "new", label: "New Customers" },
  { value: "returning", label: "Returning Customers" },
  { value: "vip", label: "VIP Customers" }
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "draft", label: "Draft" }
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
];

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const UV_PromotionsManager: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { promotion_uid } = useParams<{ promotion_uid?: string }>();
  const searchParams = new URLSearchParams(location.search);
  const urlStatus = searchParams.get("status") || null;
  const urlPage = parseInt(searchParams.get("page") || "1");
  const urlLimit = parseInt(searchParams.get("limit") || "10");

  // Global state
  const { isAuthenticated, user, token } = useAppSelector((state) => state.auth);

  // Local state
  const [activeSection, setActiveSection] = useState<string>("basicInfo");
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promotionFilters, setPromotionFilters] = useState({
    status: urlStatus,
    dateRange: {
      startDate: null,
      endDate: null
    },
    type: null,
    search: null
  });
  const [pagination, setPagination] = useState({
    currentPage: urlPage,
    totalPages: 1,
    limit: urlLimit,
    totalItems: 0
  });
  const [selectedPromotion, setSelectedPromotion] = useState({
    uid: null,
    name: "",
    description: "",
    type: "percentage",
    discountType: "percentage",
    discountValue: 0,
    minimumPurchase: null,
    maximumDiscount: null,
    startDate: null,
    endDate: null,
    timeRestrictions: {
      daysOfWeek: [],
      startTime: null,
      endTime: null
    },
    eligibility: {
      allProducts: true,
      productUids: [],
      categoryUids: [],
      customerGroups: [],
      firstTimeCustomersOnly: false
    },
    usageLimits: {
      usesPerCustomer: null,
      totalUses: null,
      combinableWithOtherPromotions: true
    },
    couponCode: null,
    isActive: false,
    status: "draft"
  });
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [promotionPreview, setPromotionPreview] = useState({
    originalPrice: 100,
    discountedPrice: 100,
    discountAmount: 0,
    discountPercentage: 0,
    examples: []
  });
  const [validationErrors, setValidationErrors] = useState({
    basicInfo: [],
    discountConfig: [],
    eligibility: [],
    schedule: [],
    usageLimits: [],
    couponCode: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [bulkCouponCodes, setBulkCouponCodes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkCodeQuantity, setBulkCodeQuantity] = useState(10);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateMessage, setShowDuplicateMessage] = useState(false);
  const [selectedProductsSearch, setSelectedProductsSearch] = useState("");
  const [selectedCategoriesSearch, setSelectedCategoriesSearch] = useState("");

  // Determine which mode the component is in
  const isEditMode = !!promotion_uid && promotion_uid !== 'new';
  const isCreateMode = !isEditMode;
  const isListMode = !promotion_uid;

  // Fetch promotions list
  const fetchPromotions = useCallback(async () => {
    if (!isListMode) return;
    
    try {
      setIsLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (promotionFilters.status) params.append("status", promotionFilters.status);
      if (promotionFilters.type) params.append("type", promotionFilters.type);
      if (promotionFilters.search) params.append("search", promotionFilters.search);
      if (promotionFilters.dateRange.startDate) params.append("startDate", promotionFilters.dateRange.startDate);
      if (promotionFilters.dateRange.endDate) params.append("endDate", promotionFilters.dateRange.endDate);
      params.append("page", pagination.currentPage.toString());
      params.append("limit", pagination.limit.toString());
      
      const response = await axios.get(`http://localhost:1337/api/seller/promotions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPromotions(response.data.promotions || []);
      setPagination({
        currentPage: response.data.pagination.current_page,
        totalPages: response.data.pagination.total_pages,
        limit: response.data.pagination.limit,
        totalItems: response.data.pagination.total_items
      });
    } catch (error) {
      console.error("Error fetching promotions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isListMode, token, promotionFilters, pagination.currentPage, pagination.limit]);

  // Fetch promotion details
  const fetchPromotionDetails = useCallback(async () => {
    if (!isEditMode || !promotion_uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.get(`http://localhost:1337/api/seller/promotions/${promotion_uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.promotion) {
        setSelectedPromotion(response.data.promotion);
        
        // Pre-calculate preview
        calculatePromotionImpact(response.data.promotion);
      }
    } catch (error) {
      console.error("Error fetching promotion details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isEditMode, promotion_uid, token]);

  // Fetch eligible products
  const fetchEligibleProducts = useCallback(async () => {
    if (isListMode) return;
    
    try {
      const response = await axios.get(`http://localhost:1337/api/seller/products?fields=minimal&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.products) {
        setAvailableProducts(response.data.products);
      }
    } catch (error) {
      console.error("Error fetching eligible products:", error);
    }
  }, [isListMode, token]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (isListMode) return;
    
    try {
      const response = await axios.get(`http://localhost:1337/api/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.categories) {
        setAvailableCategories(response.data.categories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, [isListMode, token]);

  // Create promotion
  const createPromotion = async () => {
    if (!validatePromotionForm()) return;
    
    try {
      setIsSaving(true);
      
      const response = await axios.post(`http://localhost:1337/api/seller/promotions`, selectedPromotion, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.promotion) {
        navigate(`/seller/promotions/${response.data.promotion.uid}`);
      }
    } catch (error) {
      console.error("Error creating promotion:", error);
      if (axios.isAxiosError(error) && error.response?.data?.errors) {
        mapBackendErrorsToForm(error.response.data.errors);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Update promotion
  const updatePromotion = async () => {
    if (!validatePromotionForm()) return;
    
    try {
      setIsSaving(true);
      
      const response = await axios.put(`http://localhost:1337/api/seller/promotions/${promotion_uid}`, selectedPromotion, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Refresh promotion data
        fetchPromotionDetails();
      }
    } catch (error) {
      console.error("Error updating promotion:", error);
      if (axios.isAxiosError(error) && error.response?.data?.errors) {
        mapBackendErrorsToForm(error.response.data.errors);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete promotion
  const deletePromotion = async () => {
    if (!promotion_uid) return;
    
    try {
      setIsLoading(true);
      
      await axios.delete(`http://localhost:1337/api/seller/promotions/${promotion_uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      navigate("/seller/promotions");
    } catch (error) {
      console.error("Error deleting promotion:", error);
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // Duplicate promotion
  const duplicatePromotion = async () => {
    if (!promotion_uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.post(`http://localhost:1337/api/seller/promotions/${promotion_uid}/duplicate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.promotion) {
        navigate(`/seller/promotions/${response.data.promotion.uid}`);
        setShowDuplicateMessage(true);
      }
    } catch (error) {
      console.error("Error duplicating promotion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Activate promotion
  const activatePromotion = async () => {
    if (!promotion_uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.put(`http://localhost:1337/api/seller/promotions/${promotion_uid}/activate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Refresh promotion data
        fetchPromotionDetails();
      }
    } catch (error) {
      console.error("Error activating promotion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Deactivate promotion
  const deactivatePromotion = async () => {
    if (!promotion_uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.put(`http://localhost:1337/api/seller/promotions/${promotion_uid}/deactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Refresh promotion data
        fetchPromotionDetails();
      }
    } catch (error) {
      console.error("Error deactivating promotion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate promotion codes
  const generatePromotionCodes = async () => {
    if (!promotion_uid || !selectedPromotion.type.includes("coupon")) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.post(`http://localhost:1337/api/seller/promotions/${promotion_uid}/coupon-codes`, {
        quantity: bulkCodeQuantity,
        length: 8, // Default code length
        prefix: selectedPromotion.name.substring(0, 3).toUpperCase(), // Use first 3 chars of promotion name as prefix
        max_uses: selectedPromotion.usageLimits.usesPerCustomer || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.codes) {
        setBulkCouponCodes(response.data.codes);
      }
    } catch (error) {
      console.error("Error generating coupon codes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Export promotion codes
  const exportPromotionCodes = async () => {
    if (!promotion_uid || !bulkCouponCodes.length) return;
    
    try {
      const response = await axios.get(`http://localhost:1337/api/seller/promotions/${promotion_uid}/coupon-codes/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `promotion-codes-${promotion_uid}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error exporting coupon codes:", error);
    }
  };

  // Calculate promotion impact
  const calculatePromotionImpact = async (promoData = null) => {
    const promotionData = promoData || selectedPromotion;
    
    try {
      const response = await axios.post(`http://localhost:1337/api/seller/promotions/calculate-impact`, promotionData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.preview) {
        setPromotionPreview(response.data.preview);
      }
    } catch (error) {
      console.error("Error calculating promotion impact:", error);
    }
  };

  // Validate promotion form
  const validatePromotionForm = () => {
    const errors = {
      basicInfo: [],
      discountConfig: [],
      eligibility: [],
      schedule: [],
      usageLimits: [],
      couponCode: []
    };
    
    // Validate Basic Info
    if (!selectedPromotion.name || selectedPromotion.name.trim() === "") {
      errors.basicInfo.push("Promotion name is required");
    }
    
    // Validate Discount Configuration
    if (selectedPromotion.discountValue <= 0) {
      errors.discountConfig.push("Discount value must be greater than 0");
    }
    
    if (selectedPromotion.discountType === "percentage" && selectedPromotion.discountValue > 100) {
      errors.discountConfig.push("Percentage discount cannot exceed 100%");
    }
    
    // Validate Schedule
    if (selectedPromotion.startDate && selectedPromotion.endDate) {
      const start = new Date(selectedPromotion.startDate);
      const end = new Date(selectedPromotion.endDate);
      
      if (start > end) {
        errors.schedule.push("End date must be after start date");
      }
    }
    
    // Validate Eligibility
    if (!selectedPromotion.eligibility.allProducts &&
        selectedPromotion.eligibility.productUids.length === 0 &&
        selectedPromotion.eligibility.categoryUids.length === 0) {
      errors.eligibility.push("Select at least one product or category for eligibility");
    }
    
    // Set the validation errors
    setValidationErrors(errors);
    
    // Check if there are any errors
    return Object.values(errors).every(section => section.length === 0);
  };

  // Map backend errors to form sections
  const mapBackendErrorsToForm = (backendErrors) => {
    const errors = { ...validationErrors };
    
    Object.entries(backendErrors).forEach(([field, messages]) => {
      if (field.startsWith("name") || field.startsWith("description") || field.startsWith("type")) {
        errors.basicInfo = [...errors.basicInfo, ...messages];
      } else if (field.startsWith("discount") || field.startsWith("minimum") || field.startsWith("maximum")) {
        errors.discountConfig = [...errors.discountConfig, ...messages];
      } else if (field.startsWith("eligibility")) {
        errors.eligibility = [...errors.eligibility, ...messages];
      } else if (field.startsWith("start") || field.startsWith("end") || field.startsWith("time")) {
        errors.schedule = [...errors.schedule, ...messages];
      } else if (field.startsWith("usage")) {
        errors.usageLimits = [...errors.usageLimits, ...messages];
      } else if (field.startsWith("coupon")) {
        errors.couponCode = [...errors.couponCode, ...messages];
      }
    });
    
    setValidationErrors(errors);
  };

  // Handle input change
  const handleInputChange = (section, field, value) => {
    setSelectedPromotion(prev => {
      if (field.includes(".")) {
        // Handle nested fields (e.g., "eligibility.allProducts")
        const [parent, child] = field.split(".");
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      } else {
        // Handle direct fields
        return {
          ...prev,
          [field]: value
        };
      }
    });
    
    // Clear validation errors for this section
    setValidationErrors(prev => ({
      ...prev,
      [section]: []
    }));
  };

  // Update URL with filters and pagination
  const updateUrl = useCallback(() => {
    if (!isListMode) return;
    
    const params = new URLSearchParams();
    if (promotionFilters.status) params.append("status", promotionFilters.status);
    params.append("page", pagination.currentPage.toString());
    params.append("limit", pagination.limit.toString());
    
    // Replace current URL with updated parameters
    navigate(`/seller/promotions?${params.toString()}`);
  }, [isListMode, navigate, promotionFilters.status, pagination.currentPage, pagination.limit]);

  // Handle page change
  const handlePageChange = (page) => {
    setPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };

  // Handle limit change
  const handleLimitChange = (limit) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(limit),
      currentPage: 1
    }));
  };

  // Handle filter change
  const handleFilterChange = (filter, value) => {
    setPromotionFilters(prev => ({
      ...prev,
      [filter]: value
    }));
    
    // Reset to first page when filter changes
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isCreateMode) {
      createPromotion();
    } else if (isEditMode) {
      updatePromotion();
    }
  };

  // Format dates for display
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, "MMM d, yyyy") : "Invalid date";
    } catch (error) {
      return "Invalid date";
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get discount display text
  const getDiscountDisplay = (promotion) => {
    if (promotion.discountType === "percentage") {
      return `${promotion.discountValue}% off`;
    } else if (promotion.discountType === "fixed_amount") {
      return `$${promotion.discountValue.toFixed(2)} off`;
    } else if (promotion.type === "buy_x_get_y") {
      return `Buy ${promotion.buyQuantity} get ${promotion.getQuantity} free`;
    } else if (promotion.type === "free_shipping") {
      return "Free shipping";
    } else {
      return `${promotion.discountValue} discount`;
    }
  };

  // Effects
  // Initialize data loading
  useEffect(() => {
    if (!isAuthenticated || user?.userType !== 'vendor_admin') {
      // Redirect if not authenticated or not a seller
      navigate("/");
      return;
    }
    
    if (isListMode) {
      fetchPromotions();
    } else if (isEditMode) {
      fetchPromotionDetails();
      fetchEligibleProducts();
      fetchCategories();
    } else if (isCreateMode) {
      fetchEligibleProducts();
      fetchCategories();
      
      // Reset selected promotion to default for create mode
      setSelectedPromotion({
        uid: null,
        name: "",
        description: "",
        type: "percentage",
        discountType: "percentage",
        discountValue: 0,
        minimumPurchase: null,
        maximumDiscount: null,
        startDate: null,
        endDate: null,
        timeRestrictions: {
          daysOfWeek: [],
          startTime: null,
          endTime: null
        },
        eligibility: {
          allProducts: true,
          productUids: [],
          categoryUids: [],
          customerGroups: [],
          firstTimeCustomersOnly: false
        },
        usageLimits: {
          usesPerCustomer: null,
          totalUses: null,
          combinableWithOtherPromotions: true
        },
        couponCode: null,
        isActive: false,
        status: "draft"
      });
      
      // Reset validation errors
      setValidationErrors({
        basicInfo: [],
        discountConfig: [],
        eligibility: [],
        schedule: [],
        usageLimits: [],
        couponCode: []
      });
    }
  }, [isAuthenticated, user, navigate, isListMode, isEditMode, isCreateMode, fetchPromotions, fetchPromotionDetails, fetchEligibleProducts, fetchCategories]);

  // Update URL when filters or pagination change
  useEffect(() => {
    updateUrl();
  }, [pagination.currentPage, pagination.limit, promotionFilters.status, updateUrl]);

  // Calculate promotion impact when relevant fields change
  useEffect(() => {
    if (!isListMode && (isEditMode || isCreateMode)) {
      const debounceTimer = setTimeout(() => {
        calculatePromotionImpact();
      }, 500);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [isListMode, isEditMode, isCreateMode, selectedPromotion.discountType, selectedPromotion.discountValue, selectedPromotion.minimumPurchase, selectedPromotion.maximumDiscount]);

  // Auto-hide duplicate message after 5 seconds
  useEffect(() => {
    if (showDuplicateMessage) {
      const timer = setTimeout(() => {
        setShowDuplicateMessage(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showDuplicateMessage]);

  // Render the component
  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-sm">
        {/* Page Header */}
        <div className="border-b border-gray-200 pb-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isListMode ? "Promotions & Discounts" : 
                 isCreateMode ? "Create New Promotion" : 
                 "Edit Promotion"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {isListMode ? "Manage special offers and discounts for your products" : 
                 isCreateMode ? "Create a new promotional offer for your customers" : 
                 "Update the details of your promotional offer"}
              </p>
            </div>
            
            {isListMode && (
              <div className="mt-4 md:mt-0">
                <Link 
                  to="/seller/promotions/new" 
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Promotion
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {/* Duplicate success message */}
        {showDuplicateMessage && (
          <div className="mb-5 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Promotion successfully duplicated. You are now editing the copy.
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateMessage(false)}
                    className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* List View */}
        {isListMode && (
          <div>
            {/* Filters */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                <div className="flex-1">
                  <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    id="status-filter"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={promotionFilters.status || 'all'}
                    onChange={(e) => handleFilterChange('status', e.target.value === 'all' ? null : e.target.value)}
                  >
                    {STATUS_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex-1">
                  <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    id="type-filter"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={promotionFilters.type || ''}
                    onChange={(e) => handleFilterChange('type', e.target.value || null)}
                  >
                    <option value="">All Types</option>
                    {PROMOTION_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex-1">
                  <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="text"
                      id="search-filter"
                      className="block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Search promotions..."
                      value={promotionFilters.search || ''}
                      onChange={(e) => handleFilterChange('search', e.target.value || null)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Promotions Table */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="py-12 text-center">
                  <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-3 text-gray-600">Loading promotions...</p>
                </div>
              ) : promotions.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
                  <svg className="h-12 w-12 text-gray-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No promotions found</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating a new promotion.</p>
                  <div className="mt-6">
                    <Link
                      to="/seller/promotions/new"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Create Promotion
                    </Link>
                  </div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Promotion
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Range
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usage
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {promotions.map((promotion) => (
                      <tr key={promotion.uid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            <Link to={`/seller/promotions/${promotion.uid}`} className="hover:text-blue-600">
                              {promotion.name}
                            </Link>
                          </div>
                          {promotion.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {promotion.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {PROMOTION_TYPES.find(t => t.value === promotion.type)?.label || promotion.type}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">
                            {getDiscountDisplay(promotion)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(promotion.status)}`}>
                            {promotion.status.charAt(0).toUpperCase() + promotion.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(promotion.startDate)}
                            {promotion.endDate && ` — ${formatDate(promotion.endDate)}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {promotion.usageCount} uses
                          {promotion.usageLimits.totalUses && ` / ${promotion.usageLimits.totalUses}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-3">
                            <Link
                              to={`/seller/promotions/${promotion.uid}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => {
                                // Set the promotion_uid in state and navigate to duplicate
                                navigate(`/seller/promotions/${promotion.uid}/duplicate`);
                                duplicatePromotion();
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                              disabled={isLoading}
                            >
                              Duplicate
                            </button>
                            {promotion.isActive ? (
                              <button
                                onClick={() => {
                                  navigate(`/seller/promotions/${promotion.uid}`);
                                  deactivatePromotion();
                                }}
                                className="text-red-600 hover:text-red-900"
                                disabled={isLoading}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  navigate(`/seller/promotions/${promotion.uid}`);
                                  activatePromotion();
                                }}
                                className="text-green-600 hover:text-green-900"
                                disabled={isLoading || promotion.status === 'expired'}
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Pagination */}
            {promotions.length > 0 && (
              <div className="flex items-center justify-between mt-6 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 items-center justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
                    disabled={pagination.currentPage === 1}
                    className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${pagination.currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
                  >
                    Previous
                  </button>
                  <div className="text-sm text-gray-700">
                    Page <span className="font-medium">{pagination.currentPage}</span> of{' '}
                    <span className="font-medium">{pagination.totalPages}</span>
                  </div>
                  <button
                    onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${pagination.currentPage === pagination.totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{((pagination.currentPage - 1) * pagination.limit) + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)}
                      </span> of{' '}
                      <span className="font-medium">{pagination.totalItems}</span> results
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div>
                      <select
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={pagination.limit}
                        onChange={(e) => handleLimitChange(e.target.value)}
                      >
                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option} per page
                          </option>
                        ))}
                      </select>
                    </div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pagination.currentPage === 1}
                        className={`relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 ${pagination.currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="sr-only">First page</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M8.707 5.293a1 1 0 010 1.414L5.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePageChange(Math.max(1, pagination.currentPage - 1))}
                        disabled={pagination.currentPage === 1}
                        className={`relative inline-flex items-center border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 ${pagination.currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        // Calculate which page numbers to show
                        let pageNum;
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
                            className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium ${
                              pagination.currentPage === pageNum
                                ? 'z-10 border-blue-500 bg-blue-50 text-blue-600'
                                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className={`relative inline-flex items-center border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 ${pagination.currentPage === pagination.totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.totalPages)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className={`relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 ${pagination.currentPage === pagination.totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="sr-only">Last page</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M11.293 14.707a1 1 0 010-1.414L14.586 10l-3.293-3.293a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Edit/Create Form */}
        {(isEditMode || isCreateMode) && (
          <div>
            {/* Back to List Link */}
            <div className="mb-6">
              <Link to="/seller/promotions" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
                <svg className="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to all promotions
              </Link>
            </div>
            
            {/* Form Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveSection("basicInfo")}
                  className={`${
                    activeSection === 'basicInfo'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Basic Information
                </button>
                <button
                  onClick={() => setActiveSection("discountConfig")}
                  className={`${
                    activeSection === 'discountConfig'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Discount Configuration
                </button>
                <button
                  onClick={() => setActiveSection("eligibility")}
                  className={`${
                    activeSection === 'eligibility'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Eligibility Rules
                </button>
                <button
                  onClick={() => setActiveSection("schedule")}
                  className={`${
                    activeSection === 'schedule'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Schedule
                </button>
                <button
                  onClick={() => setActiveSection("usageLimits")}
                  className={`${
                    activeSection === 'usageLimits'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Usage Limits
                </button>
                {selectedPromotion.type === 'coupon' && (
                  <button
                    onClick={() => setActiveSection("couponCode")}
                    className={`${
                      activeSection === 'couponCode'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Coupon Codes
                  </button>
                )}
                <button
                  onClick={() => setActiveSection("preview")}
                  className={`${
                    activeSection === 'preview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Preview & Summary
                </button>
              </nav>
            </div>
            
            {/* Form Content */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information Section */}
              {activeSection === "basicInfo" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Basic Information</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Provide basic details about your promotion.
                    </p>
                  </div>
                  
                  {validationErrors.basicInfo.length > 0 && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationErrors.basicInfo.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="promotion-name" className="block text-sm font-medium text-gray-700">
                        Promotion Name*
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="promotion-name"
                          id="promotion-name"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="e.g. Summer Sale 2023"
                          value={selectedPromotion.name}
                          onChange={(e) => handleInputChange('basicInfo', 'name', e.target.value)}
                          required
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        This name will be visible to customers if the promotion is displayed on the site.
                      </p>
                    </div>
                    
                    <div>
                      <label htmlFor="promotion-description" className="block text-sm font-medium text-gray-700">
                        Internal Description
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="promotion-description"
                          name="promotion-description"
                          rows={3}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Enter a description to help you identify this promotion"
                          value={selectedPromotion.description}
                          onChange={(e) => handleInputChange('basicInfo', 'description', e.target.value)}
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        This description is for internal use only and won't be shown to customers.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Promotion Type*
                      </label>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {PROMOTION_TYPES.map((type) => (
                          <div
                            key={type.value}
                            className={`relative rounded-lg border ${
                              selectedPromotion.type === type.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 bg-white'
                            } p-4 shadow-sm focus:outline-none cursor-pointer`}
                            onClick={() => handleInputChange('basicInfo', 'type', type.value)}
                          >
                            <div className="flex items-center">
                              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                selectedPromotion.type === type.value ? 'bg-blue-500' : 'bg-gray-200'
                              }`}>
                                {selectedPromotion.type === type.value && (
                                  <svg className="h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor={`type-${type.value}`} className="font-medium text-gray-900">
                                  {type.label}
                                </label>
                                <p id={`type-${type.value}-description`} className="text-gray-500">
                                  {type.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-5">
                    <button
                      type="button"
                      onClick={() => setActiveSection("discountConfig")}
                      className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Next: Discount Configuration
                    </button>
                  </div>
                </div>
              )}
              
              {/* Discount Configuration Section */}
              {activeSection === "discountConfig" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Discount Configuration</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Set up the discount value and any requirements or limits.
                    </p>
                  </div>
                  
                  {validationErrors.discountConfig.length > 0 && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationErrors.discountConfig.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    {(selectedPromotion.type === 'percentage' || selectedPromotion.type === 'fixed_amount') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Discount Type*
                        </label>
                        <div className="mt-2 space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10">
                          <div className="flex items-center">
                            <input
                              id="discount-percentage"
                              name="discount-type"
                              type="radio"
                              checked={selectedPromotion.discountType === 'percentage'}
                              onChange={() => handleInputChange('discountConfig', 'discountType', 'percentage')}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="discount-percentage" className="ml-3 block text-sm font-medium text-gray-700">
                              Percentage
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="discount-fixed"
                              name="discount-type"
                              type="radio"
                              checked={selectedPromotion.discountType === 'fixed_amount'}
                              onChange={() => handleInputChange('discountConfig', 'discountType', 'fixed_amount')}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="discount-fixed" className="ml-3 block text-sm font-medium text-gray-700">
                              Fixed Amount
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {selectedPromotion.type === 'buy_x_get_y' && (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="buy-quantity" className="block text-sm font-medium text-gray-700">
                            Buy Quantity*
                          </label>
                          <div className="mt-1">
                            <input
                              type="number"
                              name="buy-quantity"
                              id="buy-quantity"
                              min="1"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              value={selectedPromotion.buyQuantity || ''}
                              onChange={(e) => handleInputChange('discountConfig', 'buyQuantity', parseInt(e.target.value) || 0)}
                              required
                            />
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Number of items customer must buy
                          </p>
                        </div>
                        
                        <div>
                          <label htmlFor="get-quantity" className="block text-sm font-medium text-gray-700">
                            Get Quantity*
                          </label>
                          <div className="mt-1">
                            <input
                              type="number"
                              name="get-quantity"
                              id="get-quantity"
                              min="1"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              value={selectedPromotion.getQuantity || ''}
                              onChange={(e) => handleInputChange('discountConfig', 'getQuantity', parseInt(e.target.value) || 0)}
                              required
                            />
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Number of items customer gets at a discount
                          </p>
                        </div>
                        
                        <div>
                          <label htmlFor="get-discount" className="block text-sm font-medium text-gray-700">
                            Discount on "Get" Items*
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <input
                              type="number"
                              name="get-discount"
                              id="get-discount"
                              min="0"
                              max="100"
                              className="block w-full rounded-md border-gray-300 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              value={selectedPromotion.discountValue || ''}
                              onChange={(e) => handleInputChange('discountConfig', 'discountValue', parseFloat(e.target.value) || 0)}
                              required
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">%</span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Percent discount applied to the "get" items (100% for free)
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {(selectedPromotion.type === 'percentage' || selectedPromotion.type === 'fixed_amount') && (
                      <div>
                        <label htmlFor="discount-value" className="block text-sm font-medium text-gray-700">
                          Discount Value*
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          {selectedPromotion.discountType === 'percentage' ? (
                            <>
                              <input
                                type="number"
                                name="discount-value"
                                id="discount-value"
                                min="0"
                                max="100"
                                step="0.01"
                                className="block w-full rounded-md border-gray-300 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={selectedPromotion.discountValue || ''}
                                onChange={(e) => handleInputChange('discountConfig', 'discountValue', parseFloat(e.target.value) || 0)}
                                required
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">%</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                              </div>
                              <input
                                type="number"
                                name="discount-value"
                                id="discount-value"
                                min="0"
                                step="0.01"
                                className="block w-full rounded-md border-gray-300 pl-7 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={selectedPromotion.discountValue || ''}
                                onChange={(e) => handleInputChange('discountConfig', 'discountValue', parseFloat(e.target.value) || 0)}
                                required
                              />
                            </>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          {selectedPromotion.discountType === 'percentage'
                            ? 'Enter a percentage discount (e.g., 10 for 10% off)'
                            : 'Enter a fixed amount discount (e.g., 5.00 for $5 off)'}
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="minimum-purchase" className="block text-sm font-medium text-gray-700">
                          Minimum Purchase
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            name="minimum-purchase"
                            id="minimum-purchase"
                            min="0"
                            step="0.01"
                            className="block w-full rounded-md border-gray-300 pl-7 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            value={selectedPromotion.minimumPurchase || ''}
                            onChange={(e) => handleInputChange('discountConfig', 'minimumPurchase', e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Minimum order amount required (leave blank for no minimum)
                        </p>
                      </div>
                      
                      {selectedPromotion.discountType === 'percentage' && (
                        <div>
                          <label htmlFor="maximum-discount" className="block text-sm font-medium text-gray-700">
                            Maximum Discount
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              name="maximum-discount"
                              id="maximum-discount"
                              min="0"
                              step="0.01"
                              className="block w-full rounded-md border-gray-300 pl-7 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              value={selectedPromotion.maximumDiscount || ''}
                              onChange={(e) => handleInputChange('discountConfig', 'maximumDiscount', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Highest possible discount amount (leave blank for no maximum)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-5">
                    <button
                      type="button"
                      onClick={() => setActiveSection("basicInfo")}
                      className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Previous: Basic Information
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection("eligibility")}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Next: Eligibility Rules
                    </button>
                  </div>
                </div>
              )}
              
              {/* Eligibility Rules Section */}
              {activeSection === "eligibility" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Eligibility Rules</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Define which products and customers qualify for this promotion.
                    </p>
                  </div>
                  
                  {validationErrors.eligibility.length > 0 && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationErrors.eligibility.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Product Eligibility
                      </label>
                      <div className="mt-2 space-y-4">
                        <div className="flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="all-products"
                              name="product-eligibility"
                              type="radio"
                              checked={selectedPromotion.eligibility.allProducts}
                              onChange={() => handleInputChange('eligibility', 'eligibility.allProducts', true)}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="all-products" className="font-medium text-gray-700">
                              Apply to all products
                            </label>
                            <p className="text-gray-500">The promotion will apply to all eligible products in your store.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="specific-products"
                              name="product-eligibility"
                              type="radio"
                              checked={!selectedPromotion.eligibility.allProducts}
                              onChange={() => handleInputChange('eligibility', 'eligibility.allProducts', false)}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="specific-products" className="font-medium text-gray-700">
                              Apply to specific products or categories
                            </label>
                            <p className="text-gray-500">Select individual products or entire categories to include in this promotion.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {!selectedPromotion.eligibility.allProducts && (
                      <div className="space-y-6 border-t border-gray-200 pt-6">
                        <div>
                          <h4 className="text-md font-medium text-gray-900">Select Products</h4>
                          <p className="mt-1 text-sm text-gray-500">
                            Choose specific products to include in this promotion.
                          </p>
                          
                          <div className="mt-3">
                            <div className="mb-3">
                              <label htmlFor="product-search" className="sr-only">Search Products</label>
                              <div className="relative rounded-md shadow-sm">
                                <input
                                  type="text"
                                  id="product-search"
                                  className="block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  placeholder="Search products..."
                                  value={selectedProductsSearch}
                                  onChange={(e) => setSelectedProductsSearch(e.target.value)}
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-white shadow overflow-hidden border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                              {availableProducts.length === 0 ? (
                                <div className="py-3 px-4 text-sm text-gray-500">
                                  No products available
                                </div>
                              ) : (
                                <div className="divide-y divide-gray-200">
                                  {availableProducts
                                    .filter(product => 
                                      !selectedProductsSearch || 
                                      product.name.toLowerCase().includes(selectedProductsSearch.toLowerCase()) ||
                                      product.sku.toLowerCase().includes(selectedProductsSearch.toLowerCase())
                                    )
                                    .map(product => (
                                      <div key={product.uid} className="p-3 flex items-center">
                                        <input
                                          id={`product-${product.uid}`}
                                          name="selected-products"
                                          type="checkbox"
                                          checked={selectedPromotion.eligibility.productUids.includes(product.uid)}
                                          onChange={() => {
                                            const productUids = [...selectedPromotion.eligibility.productUids];
                                            if (productUids.includes(product.uid)) {
                                              // Remove product
                                              const index = productUids.indexOf(product.uid);
                                              productUids.splice(index, 1);
                                            } else {
                                              // Add product
                                              productUids.push(product.uid);
                                            }
                                            handleInputChange('eligibility', 'eligibility.productUids', productUids);
                                          }}
                                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="ml-3 flex flex-grow items-center justify-between">
                                          <div>
                                            <label htmlFor={`product-${product.uid}`} className="text-sm font-medium text-gray-700">
                                              {product.name}
                                            </label>
                                            <p className="text-xs text-gray-500">
                                              SKU: {product.sku}
                                            </p>
                                          </div>
                                          <div className="text-sm font-medium text-gray-900">
                                            ${product.basePrice.toFixed(2)}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-md font-medium text-gray-900">Select Categories</h4>
                          <p className="mt-1 text-sm text-gray-500">
                            Choose entire categories to include in this promotion.
                          </p>
                          
                          <div className="mt-3">
                            <div className="mb-3">
                              <label htmlFor="category-search" className="sr-only">Search Categories</label>
                              <div className="relative rounded-md shadow-sm">
                                <input
                                  type="text"
                                  id="category-search"
                                  className="block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  placeholder="Search categories..."
                                  value={selectedCategoriesSearch}
                                  onChange={(e) => setSelectedCategoriesSearch(e.target.value)}
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-white shadow overflow-hidden border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                              {availableCategories.length === 0 ? (
                                <div className="py-3 px-4 text-sm text-gray-500">
                                  No categories available
                                </div>
                              ) : (
                                <div className="divide-y divide-gray-200">
                                  {availableCategories
                                    .filter(category => 
                                      !selectedCategoriesSearch || 
                                      category.name.toLowerCase().includes(selectedCategoriesSearch.toLowerCase())
                                    )
                                    .map(category => (
                                      <div key={category.uid} className="p-3 flex items-center">
                                        <input
                                          id={`category-${category.uid}`}
                                          name="selected-categories"
                                          type="checkbox"
                                          checked={selectedPromotion.eligibility.categoryUids.includes(category.uid)}
                                          onChange={() => {
                                            const categoryUids = [...selectedPromotion.eligibility.categoryUids];
                                            if (categoryUids.includes(category.uid)) {
                                              // Remove category
                                              const index = categoryUids.indexOf(category.uid);
                                              categoryUids.splice(index, 1);
                                            } else {
                                              // Add category
                                              categoryUids.push(category.uid);
                                            }
                                            handleInputChange('eligibility', 'eligibility.categoryUids', categoryUids);
                                          }}
                                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="ml-3 flex flex-grow items-center justify-between">
                                          <div>
                                            <label htmlFor={`category-${category.uid}`} className="text-sm font-medium text-gray-700">
                                              {category.name}
                                            </label>
                                            <p className="text-xs text-gray-500">
                                              {category.productCount} products
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-200 pt-6">
                      <label className="block text-sm font-medium text-gray-700">
                        Customer Eligibility
                      </label>
                      <div className="mt-3">
                        <div className="flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="first-time-customers"
                              name="first-time-customers"
                              type="checkbox"
                              checked={selectedPromotion.eligibility.firstTimeCustomersOnly}
                              onChange={(e) => handleInputChange('eligibility', 'eligibility.firstTimeCustomersOnly', e.target.checked)}
                              className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="first-time-customers" className="font-medium text-gray-700">
                              First-time customers only
                            </label>
                            <p className="text-gray-500">The promotion will only apply to customers who have never placed an order before.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Customer Groups
                      </label>
                      <div className="mt-2">
                        <select
                          id="customer-groups"
                          name="customer-groups"
                          multiple
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          value={selectedPromotion.eligibility.customerGroups}
                          onChange={(e) => {
                            const selectedGroups = Array.from(e.target.selectedOptions, option => option.value);
                            handleInputChange('eligibility', 'eligibility.customerGroups', selectedGroups);
                          }}
                        >
                          {CUSTOMER_GROUPS.map(group => (
                            <option key={group.value} value={group.value}>
                              {group.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        Select customer groups that qualify for this promotion. Hold Ctrl/Cmd to select multiple groups. Leave empty to apply to all customers.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-5">
                    <button
                      type="button"
                      onClick={() => setActiveSection("discountConfig")}
                      className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Previous: Discount Configuration
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection("schedule")}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Next: Schedule
                    </button>
                  </div>
                </div>
              )}
              
              {/* Schedule Section */}
              {activeSection === "schedule" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Schedule</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Set when this promotion will be active.
                    </p>
                  </div>
                  
                  {validationErrors.schedule.length > 0 && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationErrors.schedule.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                          Start Date
                        </label>
                        <div className="mt-1">
                          <input
                            type="date"
                            name="start-date"
                            id="start-date"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            value={selectedPromotion.startDate || ''}
                            onChange={(e) => handleInputChange('schedule', 'startDate', e.target.value || null)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          When the promotion will start (leave blank for immediate start)
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                          End Date
                        </label>
                        <div className="mt-1">
                          <input
                            type="date"
                            name="end-date"
                            id="end-date"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            value={selectedPromotion.endDate || ''}
                            onChange={(e) => handleInputChange('schedule', 'endDate', e.target.value || null)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          When the promotion will end (leave blank for no end date)
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="time-restrictions"
                            name="time-restrictions"
                            type="checkbox"
                            checked={selectedPromotion.timeRestrictions.startTime !== null || selectedPromotion.timeRestrictions.endTime !== null}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleInputChange('schedule', 'timeRestrictions', {
                                  ...selectedPromotion.timeRestrictions,
                                  startTime: "09:00",
                                  endTime: "17:00"
                                });
                              } else {
                                handleInputChange('schedule', 'timeRestrictions', {
                                  ...selectedPromotion.timeRestrictions,
                                  startTime: null,
                                  endTime: null
                                });
                              }
                            }}
                            className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="time-restrictions" className="font-medium text-gray-700">
                            Add time restrictions
                          </label>
                          <p className="text-gray-500">Limit promotion to specific times of day</p>
                        </div>
                      </div>
                      
                      {(selectedPromotion.timeRestrictions.startTime !== null || selectedPromotion.timeRestrictions.endTime !== null) && (
                        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                          <div>
                            <label htmlFor="start-time" className="block text-sm font-medium text-gray-700">
                              Start Time
                            </label>
                            <div className="mt-1">
                              <input
                                type="time"
                                name="start-time"
                                id="start-time"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={selectedPromotion.timeRestrictions.startTime || ''}
                                onChange={(e) => handleInputChange('schedule', 'timeRestrictions', {
                                  ...selectedPromotion.timeRestrictions,
                                  startTime: e.target.value
                                })}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="end-time" className="block text-sm font-medium text-gray-700">
                              End Time
                            </label>
                            <div className="mt-1">
                              <input
                                type="time"
                                name="end-time"
                                id="end-time"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={selectedPromotion.timeRestrictions.endTime || ''}
                                onChange={(e) => handleInputChange('schedule', 'timeRestrictions', {
                                  ...selectedPromotion.timeRestrictions,
                                  endTime: e.target.value
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="day-restrictions"
                            name="day-restrictions"
                            type="checkbox"
                            checked={selectedPromotion.timeRestrictions.daysOfWeek.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleInputChange('schedule', 'timeRestrictions', {
                                  ...selectedPromotion.timeRestrictions,
                                  daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday by default
                                });
                              } else {
                                handleInputChange('schedule', 'timeRestrictions', {
                                  ...selectedPromotion.timeRestrictions,
                                  daysOfWeek: []
                                });
                              }
                            }}
                            className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="day-restrictions" className="font-medium text-gray-700">
                            Add day restrictions
                          </label>
                          <p className="text-gray-500">Limit promotion to specific days of the week</p>
                        </div>
                      </div>
                      
                      {selectedPromotion.timeRestrictions.daysOfWeek.length > 0 && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700">
                            Days of Week
                          </label>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {DAYS_OF_WEEK.map((day) => (
                              <div key={day.value} className="flex items-center">
                                <input
                                  id={`day-${day.value}`}
                                  name="days-of-week"
                                  type="checkbox"
                                  checked={selectedPromotion.timeRestrictions.daysOfWeek.includes(day.value)}
                                  onChange={(e) => {
                                    const daysOfWeek = [...selectedPromotion.timeRestrictions.daysOfWeek];
                                    if (e.target.checked) {
                                      if (!daysOfWeek.includes(day.value)) {
                                        daysOfWeek.push(day.value);
                                      }
                                    } else {
                                      const index = daysOfWeek.indexOf(day.value);
                                      if (index > -1) {
                                        daysOfWeek.splice(index, 1);
                                      }
                                    }
                                    handleInputChange('schedule', 'timeRestrictions', {
                                      ...selectedPromotion.timeRestrictions,
                                      daysOfWeek
                                    });
                                  }}
                                  className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor={`day-${day.value}`} className="ml-2 text-sm text-gray-700">
                                  {day.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-5">
                    <button
                      type="button"
                      onClick={() => setActiveSection("eligibility")}
                      className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Previous: Eligibility Rules
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection("usageLimits")}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Next: Usage Limits
                    </button>
                  </div>
                </div>
              )}
              
              {/* Usage Limits Section */}
              {activeSection === "usageLimits" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Usage Limits</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Set limitations on how this promotion can be used.
                    </p>
                  </div>
                  
                  {validationErrors.usageLimits.length > 0 && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationErrors.usageLimits.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="uses-per-customer" className="block text-sm font-medium text-gray-700">
                          Uses Per Customer
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            name="uses-per-customer"
                            id="uses-per-customer"
                            min="1"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            value={selectedPromotion.usageLimits.usesPerCustomer || ''}
                            onChange={(e) => handleInputChange('usageLimits', 'usageLimits.usesPerCustomer', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Maximum number of times a customer can use this promotion (leave blank for unlimited)
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="total-uses" className="block text-sm font-medium text-gray-700">
                          Total Usage Limit
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            name="total-uses"
                            id="total-uses"
                            min="1"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            value={selectedPromotion.usageLimits.totalUses || ''}
                            onChange={(e) => handleInputChange('usageLimits', 'usageLimits.totalUses', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Maximum number of times this promotion can be used across all customers (leave blank for unlimited)
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="combinable"
                            name="combinable"
                            type="checkbox"
                            checked={selectedPromotion.usageLimits.combinableWithOtherPromotions}
                            onChange={(e) => handleInputChange('usageLimits', 'usageLimits.combinableWithOtherPromotions', e.target.checked)}
                            className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="combinable" className="font-medium text-gray-700">
                            Can be combined with other promotions
                          </label>
                          <p className="text-gray-500">Allow this promotion to be applied alongside other active promotions</p>
                        </div>
                      </div>
                    </div>
                    
                    {selectedPromotion.type === 'coupon' && (
                      <div>
                        <label htmlFor="coupon-code" className="block text-sm font-medium text-gray-700">
                          Coupon Code
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="coupon-code"
                            id="coupon-code"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="e.g. SUMMER23"
                            value={selectedPromotion.couponCode || ''}
                            onChange={(e) => handleInputChange('usageLimits', 'couponCode', e.target.value)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          The code that customers will enter at checkout to apply this promotion
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between pt-5">
                    <button
                      type="button"
                      onClick={() => setActiveSection("schedule")}
                      className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Previous: Schedule
                    </button>
                    {selectedPromotion.type === 'coupon' ? (
                      <button
                        type="button"
                        onClick={() => setActiveSection("couponCode")}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Next: Coupon Codes
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSection("preview")}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Next: Preview & Summary
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Coupon Codes Section */}
              {activeSection === "couponCode" && selectedPromotion.type === 'coupon' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Coupon Codes</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Generate and manage bulk coupon codes for this promotion.
                    </p>
                  </div>
                  
                  {validationErrors.couponCode.length > 0 && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationErrors.couponCode.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="coupon-code" className="block text-sm font-medium text-gray-700">
                        Main Coupon Code
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="coupon-code"
                          id="coupon-code"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="e.g. SUMMER23"
                          value={selectedPromotion.couponCode || ''}
                          onChange={(e) => handleInputChange('couponCode', 'couponCode', e.target.value)}
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        The primary code that customers will enter at checkout to apply this promotion
                      </p>
                    </div>
                    
                    {isEditMode && (
                      <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-md font-medium text-gray-900">Bulk Coupon Generation</h4>
                        <p className="mt-1 text-sm text-gray-500">
                          Generate multiple unique coupon codes for this promotion.
                        </p>
                        
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="col-span-1">
                            <label htmlFor="bulk-code-quantity" className="block text-sm font-medium text-gray-700">
                              Number of Codes to Generate
                            </label>
                            <div className="mt-1">
                              <input
                                type="number"
                                name="bulk-code-quantity"
                                id="bulk-code-quantity"
                                min="1"
                                max="1000"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={bulkCodeQuantity}
                                onChange={(e) => setBulkCodeQuantity(parseInt(e.target.value) || 10)}
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-1 flex items-end">
                            <button
                              type="button"
                              onClick={generatePromotionCodes}
                              disabled={isLoading}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              {isLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Generating...
                                </>
                              ) : (
                                <>Generate Codes</>
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {bulkCouponCodes.length > 0 && (
                          <div className="mt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h5 className="text-sm font-medium text-gray-900">Generated Coupon Codes</h5>
                              <button
                                type="button"
                                onClick={exportPromotionCodes}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <svg className="-ml-0.5 mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export as CSV
                              </button>
                            </div>
                            
                            <div className="bg-white shadow overflow-hidden border border-gray-200 rounded-md max-h-80 overflow-y-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Code
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Usage
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {bulkCouponCodes.map((code, index) => (
                                    <tr key={index}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {code.code}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {code.isActive ? (
                                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Active
                                          </span>
                                        ) : (
                                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                            Inactive
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {code.usageCount} {code.maxUses ? `/ ${code.maxUses}` : ''}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between pt-5">
                    <button
                      type="button"
                      onClick={() => setActiveSection("usageLimits")}
                      className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Previous: Usage Limits
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection("preview")}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Next: Preview & Summary
                    </button>
                  </div>
                </div>
              )}
              
              {/* Preview & Summary Section */}
              {activeSection === "preview" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Preview & Summary</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Review your promotion settings and see how it will appear to customers.
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 border border-gray-200 rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Promotion Summary</h4>
                      
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Basic Information</h5>
                          <dl className="mt-2 text-sm text-gray-900">
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Name:</dt>
                              <dd className="flex-grow">{selectedPromotion.name || "—"}</dd>
                            </div>
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Type:</dt>
                              <dd className="flex-grow">
                                {PROMOTION_TYPES.find(t => t.value === selectedPromotion.type)?.label || selectedPromotion.type}
                              </dd>
                            </div>
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Status:</dt>
                              <dd className="flex-grow">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(selectedPromotion.status)}`}>
                                  {selectedPromotion.status.charAt(0).toUpperCase() + selectedPromotion.status.slice(1)}
                                </span>
                              </dd>
                            </div>
                          </dl>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Discount Details</h5>
                          <dl className="mt-2 text-sm text-gray-900">
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Discount:</dt>
                              <dd className="flex-grow">{getDiscountDisplay(selectedPromotion)}</dd>
                            </div>
                            {selectedPromotion.minimumPurchase && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Minimum Purchase:</dt>
                                <dd className="flex-grow">${selectedPromotion.minimumPurchase.toFixed(2)}</dd>
                              </div>
                            )}
                            {selectedPromotion.discountType === 'percentage' && selectedPromotion.maximumDiscount && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Maximum Discount:</dt>
                                <dd className="flex-grow">${selectedPromotion.maximumDiscount.toFixed(2)}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Schedule</h5>
                          <dl className="mt-2 text-sm text-gray-900">
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Start Date:</dt>
                              <dd className="flex-grow">{formatDate(selectedPromotion.startDate) || "Immediately"}</dd>
                            </div>
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">End Date:</dt>
                              <dd className="flex-grow">{formatDate(selectedPromotion.endDate) || "No end date"}</dd>
                            </div>
                            
                            {selectedPromotion.timeRestrictions.daysOfWeek.length > 0 && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Days:</dt>
                                <dd className="flex-grow">
                                  {selectedPromotion.timeRestrictions.daysOfWeek
                                    .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label)
                                    .join(', ')}
                                </dd>
                              </div>
                            )}
                            
                            {selectedPromotion.timeRestrictions.startTime && selectedPromotion.timeRestrictions.endTime && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Hours:</dt>
                                <dd className="flex-grow">
                                  {selectedPromotion.timeRestrictions.startTime} - {selectedPromotion.timeRestrictions.endTime}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-gray-500">Usage Limits</h5>
                          <dl className="mt-2 text-sm text-gray-900">
                            {selectedPromotion.usageLimits.usesPerCustomer && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Per Customer:</dt>
                                <dd className="flex-grow">{selectedPromotion.usageLimits.usesPerCustomer} uses</dd>
                              </div>
                            )}
                            {selectedPromotion.usageLimits.totalUses && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Total Uses:</dt>
                                <dd className="flex-grow">{selectedPromotion.usageLimits.totalUses} uses</dd>
                              </div>
                            )}
                            <div className="mt-1 flex">
                              <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Combinable:</dt>
                              <dd className="flex-grow">{selectedPromotion.usageLimits.combinableWithOtherPromotions ? "Yes" : "No"}</dd>
                            </div>
                            {selectedPromotion.couponCode && (
                              <div className="mt-1 flex">
                                <dt className="flex-shrink-0 font-medium text-gray-500 mr-2">Coupon Code:</dt>
                                <dd className="flex-grow font-medium">{selectedPromotion.couponCode}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-6 border border-gray-200 rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Discount Preview</h4>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Sample Product Price</p>
                            <p className="text-lg font-bold text-blue-500 mt-1">
                              <span className="line-through text-gray-500 mr-2">${promotionPreview.originalPrice.toFixed(2)}</span>
                              ${promotionPreview.discountedPrice.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">You Save</p>
                            <p className="text-lg font-bold text-green-500 mt-1">
                              ${promotionPreview.discountAmount.toFixed(2)} ({promotionPreview.discountPercentage.toFixed(0)}%)
                            </p>
                          </div>
                        </div>
                        
                        {promotionPreview.examples.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Example Scenarios</h5>
                            <div className="space-y-2">
                              {promotionPreview.examples.map((example, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{example.scenario}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      <span className="line-through mr-2">${example.originalPrice.toFixed(2)}</span>
                                      ${example.discountedPrice.toFixed(2)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-green-500">
                                      Save ${example.savings.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-5">
                    <div className="flex items-center space-x-3">
                      {isEditMode && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <svg className="-ml-0.5 mr-1 h-4 w-4 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete
                          </button>
                          
                          <button
                            type="button"
                            onClick={duplicatePromotion}
                            disabled={isLoading}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <svg className="-ml-0.5 mr-1 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                            </svg>
                            Duplicate
                          </button>
                        </>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          const previousSection = selectedPromotion.type === 'coupon' ? "couponCode" : "usageLimits";
                          setActiveSection(previousSection);
                        }}
                        className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Previous: {selectedPromotion.type === 'coupon' ? "Coupon Codes" : "Usage Limits"}
                      </button>
                      
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {isSaving ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>Save Promotion</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
            
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="sm:flex sm:items-start">
                      <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                          Delete Promotion
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Are you sure you want to delete this promotion? This action cannot be undone.
                            All associated data including usage history will be permanently removed.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={deletePromotion}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UV_PromotionsManager;