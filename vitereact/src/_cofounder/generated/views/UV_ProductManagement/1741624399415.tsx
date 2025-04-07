import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAppSelector } from '@/store/main';
import axios from 'axios';
import { Editor } from '@tinymce/tinymce-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const UV_ProductManagement: React.FC = () => {
  // URL parameters and navigation
  const { product_uid } = useParams<{ product_uid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Auth state
  const { user, token } = useAppSelector((state) => state.auth);
  
  // Determine if we're in edit mode or list mode
  const isEditMode = !!product_uid || window.location.pathname.includes('/new');
  const isNewProduct = window.location.pathname.includes('/new');
  
  // State variables defined in the datamap
  const [products, setProducts] = useState<Array<{
    uid: string;
    name: string;
    sku: string;
    basePrice: number;
    inventoryStatus: string;
    category: string;
    listingStatus: string;
    totalViews: number;
    conversionRate: number;
    primaryImageUrl: string | null;
  }>>([]);
  
  const [productFilters, setProductFilters] = useState<{
    status: string | null;
    category: string | null;
    search: string | null;
    inventoryLevel: string | null;
  }>({
    status: searchParams.get('status'),
    category: searchParams.get('category'),
    search: null,
    inventoryLevel: null,
  });
  
  const [pagination, setPagination] = useState<{
    currentPage: number;
    totalPages: number;
    limit: number;
    totalItems: number;
  }>({
    currentPage: parseInt(searchParams.get('page') || '1'),
    totalPages: 1,
    limit: parseInt(searchParams.get('limit') || '25'),
    totalItems: 0,
  });
  
  const [selectedProduct, setSelectedProduct] = useState<{
    uid: string | null;
    name: string;
    brand: string;
    sku: string;
    upc: string | null;
    mainCategoryUid: string | null;
    subcategoryUid: string | null;
    shortDescription: string;
    longDescription: string;
    basePrice: number;
    cost: number | null;
    currency: string;
    quantityAvailable: number;
    lowStockThreshold: number;
    backorderAllowed: boolean;
    dimensions: {
      length: number | null;
      width: number | null;
      height: number | null;
      weight: number | null;
      unitOfMeasure: string;
    };
    shippingDetails: {
      shippingClass: string | null;
      requiresSpecialHandling: boolean;
      restrictedLocations: Array<string>;
    };
    seo: {
      metaTitle: string;
      metaDescription: string;
      urlKey: string;
      searchKeywords: Array<string>;
    };
    listingStatus: string;
    isActive: boolean;
  }>({
    uid: null,
    name: "",
    brand: "",
    sku: "",
    upc: null,
    mainCategoryUid: null,
    subcategoryUid: null,
    shortDescription: "",
    longDescription: "",
    basePrice: 0,
    cost: null,
    currency: "USD",
    quantityAvailable: 0,
    lowStockThreshold: 5,
    backorderAllowed: false,
    dimensions: {
      length: null,
      width: null,
      height: null,
      weight: null,
      unitOfMeasure: "inches"
    },
    shippingDetails: {
      shippingClass: null,
      requiresSpecialHandling: false,
      restrictedLocations: []
    },
    seo: {
      metaTitle: "",
      metaDescription: "",
      urlKey: "",
      searchKeywords: []
    },
    listingStatus: "draft",
    isActive: true
  });
  
  const [productImages, setProductImages] = useState<Array<{
    uid: string;
    imageUrl: string;
    displayOrder: number;
    isPrimary: boolean;
    altText: string | null;
  }>>([]);
  
  const [productVariants, setProductVariants] = useState<Array<{
    uid: string;
    variantType: string;
    variantValue: string;
    sku: string;
    additionalPrice: number;
    quantityAvailable: number;
    isActive: boolean;
    imageUrl: string | null;
  }>>([]);
  
  const [productSpecifications, setProductSpecifications] = useState<Array<{
    uid: string;
    specificationGroup: string;
    name: string;
    value: string;
    displayOrder: number;
    isHighlighted: boolean;
  }>>([]);
  
  const [validationErrors, setValidationErrors] = useState<{
    basicInfo: Array<string>;
    description: Array<string>;
    images: Array<string>;
    pricing: Array<string>;
    inventory: Array<string>;
    shipping: Array<string>;
    variants: Array<string>;
    seo: Array<string>;
  }>({
    basicInfo: [],
    description: [],
    images: [],
    pricing: [],
    inventory: [],
    shipping: [],
    variants: [],
    seo: []
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('basicInfo');
  const [bulkActionSelection, setBulkActionSelection] = useState<Array<string>>([]);
  
  // Additional state for UI functionality
  const [searchInput, setSearchInput] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showBulkActionModal, setShowBulkActionModal] = useState<boolean>(false);
  const [bulkActionType, setBulkActionType] = useState<string>('');
  const [bulkPriceAdjustment, setBulkPriceAdjustment] = useState<{
    type: 'fixed' | 'percentage';
    value: number;
    operation: 'increase' | 'decrease' | 'set';
  }>({
    type: 'percentage',
    value: 0,
    operation: 'increase'
  });
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('active');
  
  const [newVariant, setNewVariant] = useState<{
    variantType: string;
    variantValue: string;
    sku: string;
    additionalPrice: number;
    quantityAvailable: number;
  }>({
    variantType: '',
    variantValue: '',
    sku: '',
    additionalPrice: 0,
    quantityAvailable: 0
  });
  
  const [isAddingVariant, setIsAddingVariant] = useState<boolean>(false);
  const [isEditingVariant, setIsEditingVariant] = useState<string | null>(null);
  
  const [newSpecification, setNewSpecification] = useState<{
    specificationGroup: string;
    name: string;
    value: string;
    isHighlighted: boolean;
  }>({
    specificationGroup: '',
    name: '',
    value: '',
    isHighlighted: false
  });
  
  const [isAddingSpecification, setIsAddingSpecification] = useState<boolean>(false);
  
  const [categories, setCategories] = useState<Array<{
    uid: string;
    name: string;
    subcategories?: Array<{ uid: string; name: string }>;
  }>>([]);
  
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    total: number;
    success: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  
  // Load products on initial render and when filters change
  useEffect(() => {
    if (!isEditMode) {
      fetchProducts();
    }
  }, [
    productFilters.status,
    productFilters.category,
    productFilters.inventoryLevel,
    pagination.currentPage,
    pagination.limit
  ]);
  
  // Load product details when in edit mode
  useEffect(() => {
    if (product_uid && product_uid !== 'new') {
      fetchProductDetails(product_uid);
    }
  }, [product_uid]);
  
  // Load categories on initial render
  useEffect(() => {
    fetchCategories();
  }, []);
  
  // Update URL when filters or pagination changes
  useEffect(() => {
    if (!isEditMode) {
      const params = new URLSearchParams();
      
      if (productFilters.status) params.set('status', productFilters.status);
      if (productFilters.category) params.set('category', productFilters.category);
      if (pagination.currentPage > 1) params.set('page', pagination.currentPage.toString());
      if (pagination.limit !== 25) params.set('limit', pagination.limit.toString());
      
      navigate({
        pathname: '/seller/products',
        search: params.toString()
      }, { replace: true });
    }
  }, [productFilters, pagination]);
  
  // Reset validation errors when changing sections
  useEffect(() => {
    setValidationErrors({
      basicInfo: [],
      description: [],
      images: [],
      pricing: [],
      inventory: [],
      shipping: [],
      variants: [],
      seo: []
    });
  }, [activeSection]);
  
  // Display success message briefly
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);
  
  // API calls
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams();
      if (productFilters.status) params.append('status', productFilters.status);
      if (productFilters.category) params.append('category', productFilters.category);
      if (productFilters.search) params.append('search', productFilters.search);
      if (productFilters.inventoryLevel) params.append('inventory_level', productFilters.inventoryLevel);
      params.append('page', pagination.currentPage.toString());
      params.append('limit', pagination.limit.toString());
      
      const response = await axios.get(`http://localhost:1337/api/seller/products?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setProducts(response.data.products);
        setPagination({
          currentPage: response.data.pagination.current_page,
          totalPages: response.data.pagination.total_pages,
          limit: response.data.pagination.limit,
          totalItems: response.data.pagination.total_items
        });
      } else {
        console.error('Failed to fetch products:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchProductDetails = async (productId: string) => {
    try {
      setIsLoading(true);
      
      const response = await axios.get(`http://localhost:1337/api/seller/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        const productData = response.data.product;
        
        // Transform backend data to component state structure
        setSelectedProduct({
          uid: productData.uid,
          name: productData.name,
          brand: productData.brand || "",
          sku: productData.sku || "",
          upc: productData.upc || null,
          mainCategoryUid: productData.main_category_uid || null,
          subcategoryUid: productData.subcategory_uid || null,
          shortDescription: productData.short_description || "",
          longDescription: productData.long_description || "",
          basePrice: productData.base_price || 0,
          cost: productData.cost || null,
          currency: productData.currency || "USD",
          quantityAvailable: productData.quantity_available || 0,
          lowStockThreshold: productData.low_stock_threshold || 5,
          backorderAllowed: productData.backorder_allowed || false,
          dimensions: {
            length: productData.length || null,
            width: productData.width || null,
            height: productData.height || null,
            weight: productData.weight || null,
            unitOfMeasure: productData.unit_of_measure || "inches"
          },
          shippingDetails: {
            shippingClass: productData.shipping_class || null,
            requiresSpecialHandling: productData.requires_special_handling || false,
            restrictedLocations: productData.restricted_locations || []
          },
          seo: {
            metaTitle: productData.meta_title || productData.name || "",
            metaDescription: productData.meta_description || "",
            urlKey: productData.url_key || "",
            searchKeywords: productData.search_keywords || []
          },
          listingStatus: productData.listing_status || "draft",
          isActive: productData.is_active
        });
        
        if (productData.images) {
          setProductImages(productData.images.map((img: any) => ({
            uid: img.uid,
            imageUrl: img.image_url,
            displayOrder: img.display_order,
            isPrimary: img.is_primary,
            altText: img.alt_text
          })));
        }
        
        if (productData.variants) {
          setProductVariants(productData.variants.map((variant: any) => ({
            uid: variant.uid,
            variantType: variant.variant_type,
            variantValue: variant.variant_value,
            sku: variant.sku,
            additionalPrice: variant.additional_price,
            quantityAvailable: variant.quantity_available,
            isActive: variant.is_active,
            imageUrl: variant.image_url
          })));
        }
        
        if (productData.specifications) {
          setProductSpecifications(productData.specifications.map((spec: any) => ({
            uid: spec.uid,
            specificationGroup: spec.specification_group,
            name: spec.name,
            value: spec.value,
            displayOrder: spec.display_order,
            isHighlighted: spec.is_highlighted
          })));
        }
      } else {
        console.error('Failed to fetch product details:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:1337/api/categories', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        // Fetch subcategories for each main category
        const categoriesWithSubs = await Promise.all(
          response.data.categories.map(async (category: any) => {
            if (category.subcategory_count > 0) {
              const subResponse = await axios.get(`http://localhost:1337/api/categories?parent_uid=${category.uid}`);
              return {
                ...category,
                subcategories: subResponse.data.success ? subResponse.data.categories : []
              };
            }
            return {
              ...category,
              subcategories: []
            };
          })
        );
        
        setCategories(categoriesWithSubs);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };
  
  const createProduct = async () => {
    if (!validateProductForm()) return;
    
    try {
      setIsLoading(true);
      
      const productData = transformProductDataForApi();
      
      const response = await axios.post('http://localhost:1337/api/seller/products', productData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setSaveSuccess(true);
        
        // Redirect to edit mode with the new product ID
        navigate(`/seller/products/${response.data.product.uid}`);
      } else {
        setSaveError(response.data.message || 'Failed to create product');
      }
    } catch (error: any) {
      setSaveError(error.response?.data?.message || 'An error occurred while creating the product');
      console.error('Error creating product:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateProduct = async () => {
    if (!validateProductForm()) return;
    if (!selectedProduct.uid) return;
    
    try {
      setIsLoading(true);
      
      const productData = transformProductDataForApi();
      
      const response = await axios.put(`http://localhost:1337/api/seller/products/${selectedProduct.uid}`, productData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setSaveSuccess(true);
        
        // Refresh product data
        fetchProductDetails(selectedProduct.uid);
      } else {
        setSaveError(response.data.message || 'Failed to update product');
      }
    } catch (error: any) {
      setSaveError(error.response?.data?.message || 'An error occurred while updating the product');
      console.error('Error updating product:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteProduct = async () => {
    if (!selectedProduct.uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.delete(`http://localhost:1337/api/seller/products/${selectedProduct.uid}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        // Redirect to product list
        navigate('/seller/products');
      } else {
        setSaveError(response.data.message || 'Failed to delete product');
      }
    } catch (error: any) {
      setSaveError(error.response?.data?.message || 'An error occurred while deleting the product');
      console.error('Error deleting product:', error);
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };
  
  const duplicateProduct = async (productId: string) => {
    try {
      setIsLoading(true);
      
      const response = await axios.post(`http://localhost:1337/api/seller/products/${productId}/duplicate`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success && response.data.product?.uid) {
        navigate(`/seller/products/${response.data.product.uid}`);
      } else {
        console.error('Failed to duplicate product:', response.data.message);
      }
    } catch (error) {
      console.error('Error duplicating product:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const uploadProductImages = async (files: FileList) => {
    if (!selectedProduct.uid) {
      setValidationErrors(prev => ({
        ...prev,
        images: [...prev.images, 'Please save the product before adding images']
      }));
      return;
    }
    
    try {
      setIsLoading(true);
      
      const formData = new FormData();
      
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });
      
      const response = await axios.post(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/images`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        // Update product images
        setProductImages(prev => [
          ...prev,
          ...response.data.images.map((img: any, index: number) => ({
            uid: img.uid,
            imageUrl: img.image_url,
            displayOrder: prev.length + index,
            isPrimary: prev.length === 0 && index === 0, // Make first image primary if no other images
            altText: null
          }))
        ]);
      } else {
        setValidationErrors(prev => ({
          ...prev,
          images: [...prev.images, response.data.message || 'Failed to upload images']
        }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({
        ...prev,
        images: [...prev.images, error.response?.data?.message || 'Error uploading images']
      }));
      console.error('Error uploading images:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteProductImage = async (imageUid: string) => {
    if (!selectedProduct.uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.delete(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/images/${imageUid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        // Remove image from state
        setProductImages(prev => {
          const newImages = prev.filter(img => img.uid !== imageUid);
          
          // If we deleted the primary image, make the first remaining image primary
          if (newImages.length > 0 && !newImages.some(img => img.isPrimary)) {
            newImages[0].isPrimary = true;
          }
          
          return newImages;
        });
      } else {
        console.error('Failed to delete image:', response.data.message);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const reorderProductImages = async (result: any) => {
    if (!result.destination || !selectedProduct.uid) return;
    
    const items = Array.from(productImages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update display order
    const updatedImages = items.map((item, index) => ({
      ...item,
      displayOrder: index
    }));
    
    setProductImages(updatedImages);
    
    try {
      const response = await axios.put(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/images/order`,
        {
          imageOrder: updatedImages.map(img => ({
            uid: img.uid,
            displayOrder: img.displayOrder
          }))
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data.success) {
        console.error('Failed to update image order:', response.data.message);
      }
    } catch (error) {
      console.error('Error updating image order:', error);
    }
  };
  
  const setPrimaryImage = async (imageUid: string) => {
    if (!selectedProduct.uid) return;
    
    setProductImages(prev => prev.map(img => ({
      ...img,
      isPrimary: img.uid === imageUid
    })));
    
    try {
      const response = await axios.put(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/images/${imageUid}/primary`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (!response.data.success) {
        console.error('Failed to set primary image:', response.data.message);
      }
    } catch (error) {
      console.error('Error setting primary image:', error);
    }
  };
  
  const createProductVariant = async () => {
    if (!selectedProduct.uid) return;
    
    if (!newVariant.variantType || !newVariant.variantValue) {
      setValidationErrors(prev => ({
        ...prev,
        variants: [...prev.variants, 'Variant type and value are required']
      }));
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await axios.post(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/variants`,
        newVariant,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        setProductVariants(prev => [...prev, {
          uid: response.data.variant.uid,
          variantType: newVariant.variantType,
          variantValue: newVariant.variantValue,
          sku: newVariant.sku,
          additionalPrice: newVariant.additionalPrice,
          quantityAvailable: newVariant.quantityAvailable,
          isActive: true,
          imageUrl: null
        }]);
        
        // Reset new variant form
        setNewVariant({
          variantType: '',
          variantValue: '',
          sku: '',
          additionalPrice: 0,
          quantityAvailable: 0
        });
        
        setIsAddingVariant(false);
      } else {
        setValidationErrors(prev => ({
          ...prev,
          variants: [...prev.variants, response.data.message || 'Failed to create variant']
        }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({
        ...prev,
        variants: [...prev.variants, error.response?.data?.message || 'Error creating variant']
      }));
      console.error('Error creating variant:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateProductVariant = async (variant: any) => {
    if (!selectedProduct.uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.put(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/variants/${variant.uid}`,
        variant,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        setProductVariants(prev => prev.map(v => 
          v.uid === variant.uid ? { ...v, ...variant } : v
        ));
        
        setIsEditingVariant(null);
      } else {
        setValidationErrors(prev => ({
          ...prev,
          variants: [...prev.variants, response.data.message || 'Failed to update variant']
        }));
      }
    } catch (error: any) {
      setValidationErrors(prev => ({
        ...prev,
        variants: [...prev.variants, error.response?.data?.message || 'Error updating variant']
      }));
      console.error('Error updating variant:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteProductVariant = async (variantUid: string) => {
    if (!selectedProduct.uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.delete(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/variants/${variantUid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        setProductVariants(prev => prev.filter(v => v.uid !== variantUid));
      } else {
        console.error('Failed to delete variant:', response.data.message);
      }
    } catch (error) {
      console.error('Error deleting variant:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateInventory = async (data: { quantityAvailable: number, lowStockThreshold: number, backorderAllowed: boolean }) => {
    if (!selectedProduct.uid) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.put(
        `http://localhost:1337/api/seller/products/${selectedProduct.uid}/inventory`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        setSelectedProduct(prev => ({
          ...prev,
          quantityAvailable: data.quantityAvailable,
          lowStockThreshold: data.lowStockThreshold,
          backorderAllowed: data.backorderAllowed
        }));
        
        setSaveSuccess(true);
      } else {
        setSaveError(response.data.message || 'Failed to update inventory');
      }
    } catch (error: any) {
      setSaveError(error.response?.data?.message || 'Error updating inventory');
      console.error('Error updating inventory:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const bulkUpdatePrices = async () => {
    if (bulkActionSelection.length === 0) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.put(
        'http://localhost:1337/api/seller/products/bulk/prices',
        {
          productUids: bulkActionSelection,
          adjustment: {
            type: bulkPriceAdjustment.type,
            value: bulkPriceAdjustment.value,
            operation: bulkPriceAdjustment.operation
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        // Refresh product list
        fetchProducts();
        setShowBulkActionModal(false);
        setBulkActionSelection([]);
      } else {
        console.error('Failed to update prices:', response.data.message);
      }
    } catch (error) {
      console.error('Error updating prices:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const bulkUpdateStatus = async () => {
    if (bulkActionSelection.length === 0) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.put(
        'http://localhost:1337/api/seller/products/bulk/status',
        {
          productUids: bulkActionSelection,
          status: bulkStatusValue
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        // Refresh product list
        fetchProducts();
        setShowBulkActionModal(false);
        setBulkActionSelection([]);
      } else {
        console.error('Failed to update statuses:', response.data.message);
      }
    } catch (error) {
      console.error('Error updating statuses:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const exportProductsCsv = async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams();
      if (productFilters.status) params.append('status', productFilters.status);
      if (productFilters.category) params.append('category', productFilters.category);
      if (productFilters.search) params.append('search', productFilters.search);
      
      const response = await axios.get(
        `http://localhost:1337/api/seller/products/export?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting products:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const importProductsCsv = async () => {
    if (!importFile) return;
    
    try {
      setIsLoading(true);
      
      const formData = new FormData();
      formData.append('file', importFile);
      
      const response = await axios.post(
        'http://localhost:1337/api/seller/products/import',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        setImportResult({
          total: response.data.total || 0,
          success: response.data.success_count || 0,
          errors: response.data.errors || []
        });
        
        // Refresh product list
        fetchProducts();
      } else {
        console.error('Failed to import products:', response.data.message);
      }
    } catch (error) {
      console.error('Error importing products:', error);
    } finally {
      setIsLoading(false);
      setImportFile(null);
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };
  
  // Helper functions
  const handleSearch = () => {
    setProductFilters(prev => ({ ...prev, search: searchInput }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };
  
  const handleFilterChange = (filter: string, value: string | null) => {
    setProductFilters(prev => ({ ...prev, [filter]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };
  
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };
  
  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      currentPage: 1
    }));
  };
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setBulkActionSelection(products.map(p => p.uid));
    } else {
      setBulkActionSelection([]);
    }
  };
  
  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setBulkActionSelection(prev => [...prev, productId]);
    } else {
      setBulkActionSelection(prev => prev.filter(id => id !== productId));
    }
  };
  
  const handleInputChange = (field: string, value: any) => {
    setSelectedProduct(prev => {
      // Handle nested fields
      if (field.includes('.')) {
        const [section, subfield] = field.split('.');
        return {
          ...prev,
          [section]: {
            ...prev[section as keyof typeof prev],
            [subfield]: value
          }
        };
      }
      
      return {
        ...prev,
        [field]: value
      };
    });
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadProductImages(e.target.files);
      
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
    }
  };
  
  const transformProductDataForApi = () => {
    return {
      name: selectedProduct.name,
      brand: selectedProduct.brand,
      sku: selectedProduct.sku,
      upc: selectedProduct.upc,
      main_category_uid: selectedProduct.mainCategoryUid,
      subcategory_uid: selectedProduct.subcategoryUid,
      short_description: selectedProduct.shortDescription,
      long_description: selectedProduct.longDescription,
      base_price: selectedProduct.basePrice,
      cost: selectedProduct.cost,
      currency: selectedProduct.currency,
      quantity_available: selectedProduct.quantityAvailable,
      low_stock_threshold: selectedProduct.lowStockThreshold,
      backorder_allowed: selectedProduct.backorderAllowed,
      dimensions: {
        length: selectedProduct.dimensions.length,
        width: selectedProduct.dimensions.width,
        height: selectedProduct.dimensions.height,
        weight: selectedProduct.dimensions.weight,
        unit_of_measure: selectedProduct.dimensions.unitOfMeasure
      },
      shipping_details: {
        shipping_class: selectedProduct.shippingDetails.shippingClass,
        requires_special_handling: selectedProduct.shippingDetails.requiresSpecialHandling,
        restricted_locations: selectedProduct.shippingDetails.restrictedLocations
      },
      seo: {
        meta_title: selectedProduct.seo.metaTitle,
        meta_description: selectedProduct.seo.metaDescription,
        url_key: selectedProduct.seo.urlKey,
        search_keywords: selectedProduct.seo.searchKeywords
      },
      listing_status: selectedProduct.listingStatus,
      is_active: selectedProduct.isActive
    };
  };
  
  const validateProductForm = () => {
    const errors: {
      basicInfo: string[];
      description: string[];
      images: string[];
      pricing: string[];
      inventory: string[];
      shipping: string[];
      variants: string[];
      seo: string[];
    } = {
      basicInfo: [],
      description: [],
      images: [],
      pricing: [],
      inventory: [],
      shipping: [],
      variants: [],
      seo: []
    };
    
    // Basic Info validation
    if (!selectedProduct.name.trim()) {
      errors.basicInfo.push('Product name is required');
    }
    
    if (!selectedProduct.sku.trim()) {
      errors.basicInfo.push('SKU is required');
    }
    
    if (!selectedProduct.mainCategoryUid) {
      errors.basicInfo.push('Main category is required');
    }
    
    // Description validation
    if (!selectedProduct.shortDescription.trim()) {
      errors.description.push('Short description is required');
    }
    
    // Pricing validation
    if (selectedProduct.basePrice <= 0) {
      errors.pricing.push('Base price must be greater than zero');
    }
    
    // Inventory validation
    if (selectedProduct.quantityAvailable < 0) {
      errors.inventory.push('Quantity cannot be negative');
    }
    
    if (selectedProduct.lowStockThreshold < 0) {
      errors.inventory.push('Low stock threshold cannot be negative');
    }
    
    // Set validation errors
    setValidationErrors(errors);
    
    // Check if any section has errors
    return !Object.values(errors).some(section => section.length > 0);
  };
  
  const getInventoryStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-100 text-green-800';
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-800';
      case 'out_of_stock':
        return 'bg-red-100 text-red-800';
      case 'backorder':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
  };
  
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };
  
  // Component rendering
  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-8 md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:leading-9">
                {isEditMode 
                  ? (isNewProduct ? 'Create New Product' : 'Edit Product') 
                  : 'Product Management'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {isEditMode 
                  ? 'Create or update your product information' 
                  : 'Manage your products, inventory, and pricing'}
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              {isEditMode ? (
                <>
                  {!isNewProduct && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="ml-3 inline-flex items-center px-4 py-2 border border-red-600 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete
                    </button>
                  )}
                  <Link 
                    to="/seller/products"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </Link>
                  <button
                    type="button"
                    onClick={isNewProduct ? createProduct : updateProduct}
                    disabled={isLoading}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {isLoading ? 'Saving...' : 'Save Product'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setImportFile(null)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={exportProductsCsv}
                    disabled={isLoading}
                  >
                    Export CSV
                  </button>
                  <label
                    htmlFor="import-file"
                    className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    Import CSV
                    <input
                      id="import-file"
                      type="file"
                      className="hidden"
                      accept=".csv"
                      ref={importFileRef}
                      onChange={handleImportFileSelect}
                    />
                  </label>
                  <Link 
                    to="/seller/products/new"
                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Add New Product
                  </Link>
                </>
              )}
            </div>
          </div>
          
          {/* Success/Error messages */}
          {saveSuccess && (
            <div className="mb-4 rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    Product saved successfully
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {saveError && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    {saveError}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => setSaveError(null)}
                      className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Import file notification */}
          {importFile && (
            <div className="mb-4 rounded-md bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-800">
                      File selected: {importFile.name}
                    </p>
                  </div>
                </div>
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setImportFile(null)}
                    className="ml-3 inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={importProductsCsv}
                    className="ml-3 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Import Now
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Import result notification */}
          {importResult && (
            <div className="mb-4 rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Import Results</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Total products processed: {importResult.total}</p>
                    <p>Successfully imported: {importResult.success}</p>
                    {importResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold">Errors:</p>
                        <ul className="list-disc pl-5">
                          {importResult.errors.map((error, index) => (
                            <li key={index}>Row {error.row}: {error.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => setImportResult(null)}
                      className="inline-flex bg-blue-50 rounded-md p-1.5 text-blue-500 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Main content area */}
          {isEditMode ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {/* Product form sections navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex overflow-x-auto">
                  {[
                    { id: 'basicInfo', name: 'Basic Information' },
                    { id: 'description', name: 'Description' },
                    { id: 'images', name: 'Images' },
                    { id: 'pricing', name: 'Pricing' },
                    { id: 'inventory', name: 'Inventory' },
                    { id: 'shipping', name: 'Shipping' },
                    { id: 'variants', name: 'Variants' },
                    { id: 'seo', name: 'SEO' }
                  ].map(section => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`
                        whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm
                        ${activeSection === section.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        ${validationErrors[section.id as keyof typeof validationErrors].length > 0
                          ? 'text-red-600'
                          : ''}
                      `}
                    >
                      {section.name}
                      {validationErrors[section.id as keyof typeof validationErrors].length > 0 && (
                        <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                          {validationErrors[section.id as keyof typeof validationErrors].length}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Product form content */}
              <div className="p-6">
                {/* Basic Information */}
                {activeSection === 'basicInfo' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Basic Information</h3>
                    
                    {validationErrors.basicInfo.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.basicInfo.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <div className="sm:col-span-6">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Product Name <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="name"
                            name="name"
                            value={selectedProduct.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                          Brand
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="brand"
                            name="brand"
                            value={selectedProduct.brand}
                            onChange={(e) => handleInputChange('brand', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                          SKU <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="sku"
                            name="sku"
                            value={selectedProduct.sku}
                            onChange={(e) => handleInputChange('sku', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="upc" className="block text-sm font-medium text-gray-700">
                          UPC/EAN
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="upc"
                            name="upc"
                            value={selectedProduct.upc || ''}
                            onChange={(e) => handleInputChange('upc', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="listingStatus" className="block text-sm font-medium text-gray-700">
                          Status
                        </label>
                        <div className="mt-1">
                          <select
                            id="listingStatus"
                            name="listingStatus"
                            value={selectedProduct.listingStatus}
                            onChange={(e) => handleInputChange('listingStatus', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="mainCategoryUid" className="block text-sm font-medium text-gray-700">
                          Main Category <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <select
                            id="mainCategoryUid"
                            name="mainCategoryUid"
                            value={selectedProduct.mainCategoryUid || ''}
                            onChange={(e) => handleInputChange('mainCategoryUid', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          >
                            <option value="">Select a category</option>
                            {categories.map(category => (
                              <option key={category.uid} value={category.uid}>{category.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="subcategoryUid" className="block text-sm font-medium text-gray-700">
                          Subcategory
                        </label>
                        <div className="mt-1">
                          <select
                            id="subcategoryUid"
                            name="subcategoryUid"
                            value={selectedProduct.subcategoryUid || ''}
                            onChange={(e) => handleInputChange('subcategoryUid', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            disabled={!selectedProduct.mainCategoryUid}
                          >
                            <option value="">Select a subcategory</option>
                            {selectedProduct.mainCategoryUid && 
                              categories
                                .find(c => c.uid === selectedProduct.mainCategoryUid)
                                ?.subcategories?.map(subcat => (
                                  <option key={subcat.uid} value={subcat.uid}>{subcat.name}</option>
                                ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Description */}
                {activeSection === 'description' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Description</h3>
                    
                    {validationErrors.description.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.description.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-6">
                      <div>
                        <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700">
                          Short Description <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="shortDescription"
                            name="shortDescription"
                            rows={3}
                            value={selectedProduct.shortDescription}
                            onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Brief summary that appears in product listings (150-200 characters recommended)
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="longDescription" className="block text-sm font-medium text-gray-700">
                          Full Description
                        </label>
                        <div className="mt-1">
                          <Editor
                            apiKey="your-tinymce-api-key" // Replace with your TinyMCE API key
                            value={selectedProduct.longDescription}
                            init={{
                              height: 300,
                              menubar: false,
                              plugins: [
                                'advlist autolink lists link image charmap print preview anchor',
                                'searchreplace visualblocks code fullscreen',
                                'insertdatetime media table paste code help wordcount'
                              ],
                              toolbar:
                                'undo redo | formatselect | bold italic backcolor | \
                                alignleft aligncenter alignright alignjustify | \
                                bullist numlist outdent indent | removeformat | help'
                            }}
                            onEditorChange={(content) => handleInputChange('longDescription', content)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Detailed product description with formatting, lists, and other rich content
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Technical Specifications</h4>
                        
                        <div className="mt-2 overflow-hidden border border-gray-200 rounded-md">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Highlighted</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productSpecifications.map((spec) => (
                                <tr key={spec.uid}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{spec.specificationGroup}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{spec.name}</td>
                                  <td className="px-6 py-4 text-sm text-gray-900">{spec.value}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {spec.isHighlighted ? 'Yes' : 'No'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProductSpecifications(productSpecifications.filter(s => s.uid !== spec.uid));
                                      }}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              
                              {isAddingSpecification && (
                                <tr>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={newSpecification.specificationGroup}
                                      onChange={(e) => setNewSpecification({...newSpecification, specificationGroup: e.target.value})}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                      placeholder="Group"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={newSpecification.name}
                                      onChange={(e) => setNewSpecification({...newSpecification, name: e.target.value})}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                      placeholder="Name"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input
                                      type="text"
                                      value={newSpecification.value}
                                      onChange={(e) => setNewSpecification({...newSpecification, value: e.target.value})}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                      placeholder="Value"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={newSpecification.isHighlighted}
                                      onChange={(e) => setNewSpecification({...newSpecification, isHighlighted: e.target.checked})}
                                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (newSpecification.name && newSpecification.value) {
                                          setProductSpecifications([
                                            ...productSpecifications,
                                            {
                                              uid: `spec-${Date.now()}`,
                                              ...newSpecification,
                                              displayOrder: productSpecifications.length
                                            }
                                          ]);
                                          setNewSpecification({
                                            specificationGroup: '',
                                            name: '',
                                            value: '',
                                            isHighlighted: false
                                          });
                                          setIsAddingSpecification(false);
                                        }
                                      }}
                                      className="text-green-600 hover:text-green-900 mr-4"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsAddingSpecification(false)}
                                      className="text-gray-600 hover:text-gray-900"
                                    >
                                      Cancel
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        
                        {!isAddingSpecification && (
                          <button
                            type="button"
                            onClick={() => setIsAddingSpecification(true)}
                            className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Add Specification
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Images */}
                {activeSection === 'images' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Images</h3>
                    
                    {validationErrors.images.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.images.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-4">
                      <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-2">
                        Product Images
                      </label>
                      
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4h-12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                            >
                              <span>Upload images</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                multiple
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            PNG, JPG, GIF up to 5MB each
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {productImages.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Current Images</h4>
                        <p className="text-sm text-gray-500 mb-4">
                          Drag to reorder. The first image will be used as the primary product image.
                        </p>
                        
                        <DragDropContext onDragEnd={reorderProductImages}>
                          <Droppable droppableId="product-images" direction="horizontal">
                            {(provided) => (
                              <div
                                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                              >
                                {productImages.map((image, index) => (
                                  <Draggable key={image.uid} draggableId={image.uid} index={index}>
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className="relative group border border-gray-200 rounded-md overflow-hidden"
                                      >
                                        <img
                                          src={image.imageUrl}
                                          alt={image.altText || `Product image ${index + 1}`}
                                          className="h-40 w-full object-cover"
                                        />
                                        
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                                          <div className="hidden group-hover:flex space-x-2">
                                            <button
                                              type="button"
                                              onClick={() => setPrimaryImage(image.uid)}
                                              className={`p-1 rounded-full ${image.isPrimary ? 'bg-green-500 text-white' : 'bg-white text-gray-900'}`}
                                              title={image.isPrimary ? 'Primary Image' : 'Set as Primary'}
                                            >
                                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                              </svg>
                                            </button>
                                            
                                            <button
                                              type="button"
                                              onClick={() => deleteProductImage(image.uid)}
                                              className="p-1 rounded-full bg-white text-red-600"
                                              title="Delete Image"
                                            >
                                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                        
                                        {image.isPrimary && (
                                          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md">
                                            Primary
                                          </div>
                                        )}
                                        
                                        <div className="p-2 bg-white">
                                          <input
                                            type="text"
                                            value={image.altText || ''}
                                            onChange={(e) => {
                                              const updatedImages = [...productImages];
                                              updatedImages[index].altText = e.target.value;
                                              setProductImages(updatedImages);
                                            }}
                                            placeholder="Alt text"
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Pricing */}
                {activeSection === 'pricing' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Pricing</h3>
                    
                    {validationErrors.pricing.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.pricing.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <div className="sm:col-span-3">
                        <label htmlFor="basePrice" className="block text-sm font-medium text-gray-700">
                          Base Price <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="basePrice"
                            name="basePrice"
                            min="0"
                            step="0.01"
                            value={selectedProduct.basePrice}
                            onChange={(e) => handleInputChange('basePrice', parseFloat(e.target.value) || 0)}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">{selectedProduct.currency}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="cost" className="block text-sm font-medium text-gray-700">
                          Cost (Internal)
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="cost"
                            name="cost"
                            min="0"
                            step="0.01"
                            value={selectedProduct.cost || ''}
                            onChange={(e) => handleInputChange('cost', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">{selectedProduct.currency}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Your cost (not visible to customers)
                        </p>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                          Currency
                        </label>
                        <div className="mt-1">
                          <select
                            id="currency"
                            name="currency"
                            value={selectedProduct.currency}
                            onChange={(e) => handleInputChange('currency', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          >
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                          </select>
                        </div>
                      </div>
                      
                      {selectedProduct.cost && (
                        <div className="sm:col-span-3">
                          <label className="block text-sm font-medium text-gray-700">
                            Margin
                          </label>
                          <div className="mt-1 bg-gray-100 p-3 rounded-md">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900">Amount:</span>
                              <span className="font-medium text-gray-900">
                                {formatPrice(selectedProduct.basePrice - selectedProduct.cost, selectedProduct.currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-gray-900">Margin %:</span>
                              <span className="font-medium text-gray-900">
                                {selectedProduct.cost > 0 
                                  ? formatPercent((selectedProduct.basePrice - selectedProduct.cost) / selectedProduct.basePrice)
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-gray-900">Markup %:</span>
                              <span className="font-medium text-gray-900">
                                {selectedProduct.cost > 0 
                                  ? formatPercent((selectedProduct.basePrice - selectedProduct.cost) / selectedProduct.cost)
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Inventory */}
                {activeSection === 'inventory' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Inventory</h3>
                    
                    {validationErrors.inventory.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.inventory.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <div className="sm:col-span-3">
                        <label htmlFor="quantityAvailable" className="block text-sm font-medium text-gray-700">
                          Stock Quantity
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            id="quantityAvailable"
                            name="quantityAvailable"
                            min="0"
                            value={selectedProduct.quantityAvailable}
                            onChange={(e) => handleInputChange('quantityAvailable', parseInt(e.target.value) || 0)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-gray-700">
                          Low Stock Threshold
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            id="lowStockThreshold"
                            name="lowStockThreshold"
                            min="0"
                            value={selectedProduct.lowStockThreshold}
                            onChange={(e) => handleInputChange('lowStockThreshold', parseInt(e.target.value) || 0)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          You'll be notified when stock falls below this number
                        </p>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <div className="relative flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="backorderAllowed"
                              name="backorderAllowed"
                              type="checkbox"
                              checked={selectedProduct.backorderAllowed}
                              onChange={(e) => handleInputChange('backorderAllowed', e.target.checked)}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="backorderAllowed" className="font-medium text-gray-700">
                              Allow Backorders
                            </label>
                            <p className="text-gray-500">
                              If enabled, customers can purchase this product even when it's out of stock
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8">
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Quick Inventory Update</h4>
                      <div className="flex space-x-4 items-end">
                        <div>
                          <label htmlFor="quickStockUpdate" className="block text-sm font-medium text-gray-700">
                            New Stock Quantity
                          </label>
                          <input
                            type="number"
                            id="quickStockUpdate"
                            min="0"
                            value={selectedProduct.quantityAvailable}
                            onChange={(e) => handleInputChange('quantityAvailable', parseInt(e.target.value) || 0)}
                            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => updateInventory({
                            quantityAvailable: selectedProduct.quantityAvailable,
                            lowStockThreshold: selectedProduct.lowStockThreshold,
                            backorderAllowed: selectedProduct.backorderAllowed
                          })}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Update Inventory
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Shipping */}
                {activeSection === 'shipping' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Shipping</h3>
                    
                    {validationErrors.shipping.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.shipping.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <div className="sm:col-span-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Dimensions</h4>
                      </div>
                      
                      <div className="sm:col-span-3 sm:col-start-1">
                        <label htmlFor="dimensions.length" className="block text-sm font-medium text-gray-700">
                          Length
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            id="dimensions.length"
                            name="dimensions.length"
                            min="0"
                            step="0.01"
                            value={selectedProduct.dimensions.length || ''}
                            onChange={(e) => handleInputChange('dimensions.length', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="dimensions.width" className="block text-sm font-medium text-gray-700">
                          Width
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            id="dimensions.width"
                            name="dimensions.width"
                            min="0"
                            step="0.01"
                            value={selectedProduct.dimensions.width || ''}
                            onChange={(e) => handleInputChange('dimensions.width', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="dimensions.height" className="block text-sm font-medium text-gray-700">
                          Height
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            id="dimensions.height"
                            name="dimensions.height"
                            min="0"
                            step="0.01"
                            value={selectedProduct.dimensions.height || ''}
                            onChange={(e) => handleInputChange('dimensions.height', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="dimensions.weight" className="block text-sm font-medium text-gray-700">
                          Weight
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            id="dimensions.weight"
                            name="dimensions.weight"
                            min="0"
                            step="0.01"
                            value={selectedProduct.dimensions.weight || ''}
                            onChange={(e) => handleInputChange('dimensions.weight', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <label htmlFor="dimensions.unitOfMeasure" className="block text-sm font-medium text-gray-700">
                          Unit of Measure
                        </label>
                        <div className="mt-1">
                          <select
                            id="dimensions.unitOfMeasure"
                            name="dimensions.unitOfMeasure"
                            value={selectedProduct.dimensions.unitOfMeasure}
                            onChange={(e) => handleInputChange('dimensions.unitOfMeasure', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          >
                            <option value="inches">Inches (in) / Pounds (lbs)</option>
                            <option value="centimeters">Centimeters (cm) / Kilograms (kg)</option>
                            <option value="meters">Meters (m) / Kilograms (kg)</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 pt-4">Shipping Options</h4>
                      </div>
                      
                      <div className="sm:col-span-3">
                        <label htmlFor="shippingDetails.shippingClass" className="block text-sm font-medium text-gray-700">
                          Shipping Class
                        </label>
                        <div className="mt-1">
                          <select
                            id="shippingDetails.shippingClass"
                            name="shippingDetails.shippingClass"
                            value={selectedProduct.shippingDetails.shippingClass || ''}
                            onChange={(e) => handleInputChange('shippingDetails.shippingClass', e.target.value === '' ? null : e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          >
                            <option value="">No specific class</option>
                            <option value="standard">Standard</option>
                            <option value="oversize">Oversize</option>
                            <option value="heavy">Heavy</option>
                            <option value="fragile">Fragile</option>
                            <option value="hazardous">Hazardous Materials</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <div className="relative flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id="shippingDetails.requiresSpecialHandling"
                              name="shippingDetails.requiresSpecialHandling"
                              type="checkbox"
                              checked={selectedProduct.shippingDetails.requiresSpecialHandling}
                              onChange={(e) => handleInputChange('shippingDetails.requiresSpecialHandling', e.target.checked)}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="shippingDetails.requiresSpecialHandling" className="font-medium text-gray-700">
                              Requires Special Handling
                            </label>
                            <p className="text-gray-500">
                              Select this if the product needs special care during shipping (fragile, temperature sensitive, etc.)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Variants */}
                {activeSection === 'variants' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Variants</h3>
                    
                    {validationErrors.variants.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.variants.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="overflow-hidden border border-gray-200 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Value
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              SKU
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Price Difference
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Inventory
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {productVariants.map((variant) => (
                            <tr key={variant.uid}>
                              {isEditingVariant === variant.uid ? (
                                // Edit mode
                                <>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={variant.variantType}
                                      onChange={(e) => {
                                        const updatedVariants = productVariants.map(v => 
                                          v.uid === variant.uid ? { ...v, variantType: e.target.value } : v
                                        );
                                        setProductVariants(updatedVariants);
                                      }}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={variant.variantValue}
                                      onChange={(e) => {
                                        const updatedVariants = productVariants.map(v => 
                                          v.uid === variant.uid ? { ...v, variantValue: e.target.value } : v
                                        );
                                        setProductVariants(updatedVariants);
                                      }}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={variant.sku}
                                      onChange={(e) => {
                                        const updatedVariants = productVariants.map(v => 
                                          v.uid === variant.uid ? { ...v, sku: e.target.value } : v
                                        );
                                        setProductVariants(updatedVariants);
                                      }}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={variant.additionalPrice}
                                      onChange={(e) => {
                                        const updatedVariants = productVariants.map(v => 
                                          v.uid === variant.uid ? { ...v, additionalPrice: parseFloat(e.target.value) || 0 } : v
                                        );
                                        setProductVariants(updatedVariants);
                                      }}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="number"
                                      min="0"
                                      value={variant.quantityAvailable}
                                      onChange={(e) => {
                                        const updatedVariants = productVariants.map(v => 
                                          v.uid === variant.uid ? { ...v, quantityAvailable: parseInt(e.target.value) || 0 } : v
                                        );
                                        setProductVariants(updatedVariants);
                                      }}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button
                                      type="button"
                                      onClick={() => updateProductVariant(variant)}
                                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsEditingVariant(null)}
                                      className="text-gray-600 hover:text-gray-900"
                                    >
                                      Cancel
                                    </button>
                                  </td>
                                </>
                              ) : (
                                // View mode
                                <>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {variant.variantType}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {variant.variantValue}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {variant.sku}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {variant.additionalPrice > 0 ? `+${formatPrice(variant.additionalPrice, selectedProduct.currency)}` : 
                                      variant.additionalPrice < 0 ? formatPrice(variant.additionalPrice, selectedProduct.currency) : '-'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {variant.quantityAvailable}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button
                                      type="button"
                                      onClick={() => setIsEditingVariant(variant.uid)}
                                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteProductVariant(variant.uid)}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                          
                          {isAddingVariant && (
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="text"
                                  value={newVariant.variantType}
                                  onChange={(e) => setNewVariant({...newVariant, variantType: e.target.value})}
                                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Color, Size, etc."
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="text"
                                  value={newVariant.variantValue}
                                  onChange={(e) => setNewVariant({...newVariant, variantValue: e.target.value})}
                                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Red, Large, etc."
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="text"
                                  value={newVariant.sku}
                                  onChange={(e) => setNewVariant({...newVariant, sku: e.target.value})}
                                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="SKU"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newVariant.additionalPrice}
                                  onChange={(e) => setNewVariant({...newVariant, additionalPrice: parseFloat(e.target.value) || 0})}
                                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  value={newVariant.quantityAvailable}
                                  onChange={(e) => setNewVariant({...newVariant, quantityAvailable: parseInt(e.target.value) || 0})}
                                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                <button
                                  type="button"
                                  onClick={createProductVariant}
                                  className="text-green-600 hover:text-green-900 mr-4"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsAddingVariant(false)}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          )}
                          
                          {!isAddingVariant && (
                            <tr>
                              <td colSpan={6} className="px-6 py-4">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingVariant(true)}
                                  className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                  <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                  </svg>
                                  Add Variant
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* SEO */}
                {activeSection === 'seo' && (
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Search Engine Optimization</h3>
                    
                    {validationErrors.seo.length > 0 && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <ul className="list-disc pl-5">
                                {validationErrors.seo.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <div className="sm:col-span-6">
                        <label htmlFor="seo.metaTitle" className="block text-sm font-medium text-gray-700">
                          Meta Title
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="seo.metaTitle"
                            name="seo.metaTitle"
                            value={selectedProduct.seo.metaTitle}
                            onChange={(e) => handleInputChange('seo.metaTitle', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          The title that appears in search engine results (50-60 characters recommended)
                        </p>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <label htmlFor="seo.metaDescription" className="block text-sm font-medium text-gray-700">
                          Meta Description
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="seo.metaDescription"
                            name="seo.metaDescription"
                            rows={2}
                            value={selectedProduct.seo.metaDescription}
                            onChange={(e) => handleInputChange('seo.metaDescription', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          A short description that appears in search engine results (150-160 characters recommended)
                        </p>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <label htmlFor="seo.urlKey" className="block text-sm font-medium text-gray-700">
                          URL Key
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="seo.urlKey"
                            name="seo.urlKey"
                            value={selectedProduct.seo.urlKey}
                            onChange={(e) => handleInputChange('seo.urlKey', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          The URL-friendly version of the product name (no spaces, lowercase, hyphens instead of spaces)
                        </p>
                      </div>
                      
                      <div className="sm:col-span-6">
                        <label htmlFor="seo.searchKeywords" className="block text-sm font-medium text-gray-700">
                          Search Keywords
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            id="seo.searchKeywords"
                            name="seo.searchKeywords"
                            value={selectedProduct.seo.searchKeywords.join(', ')}
                            onChange={(e) => handleInputChange('seo.searchKeywords', e.target.value.split(',').map(kw => kw.trim()))}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Comma-separated list of keywords to help customers find your product
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {/* Filters and search */}
              <div className="bg-white px-4 py-5 border-b border-gray-200 sm:px-6">
                <div className="-ml-4 -mt-2 flex items-center justify-between flex-wrap sm:flex-nowrap">
                  <div className="ml-4 mt-2">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Product List</h3>
                  </div>
                  <div className="ml-4 mt-2 flex-shrink-0">
                    <div className="flex space-x-4">
                      {/* Search */}
                      <div className="flex flex-1">
                        <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                            placeholder="Search by name or SKU"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSearch();
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSearch}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Search
                        </button>
                      </div>
                      
                      {/* Filters */}
                      <div className="flex space-x-3">
                        <select
                          value={productFilters.status || ''}
                          onChange={(e) => handleFilterChange('status', e.target.value || null)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="">All Statuses</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="draft">Draft</option>
                        </select>
                        
                        <select
                          value={productFilters.category || ''}
                          onChange={(e) => handleFilterChange('category', e.target.value || null)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="">All Categories</option>
                          {categories.map((category) => (
                            <option key={category.uid} value={category.uid}>{category.name}</option>
                          ))}
                        </select>
                        
                        <select
                          value={productFilters.inventoryLevel || ''}
                          onChange={(e) => handleFilterChange('inventoryLevel', e.target.value || null)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="">All Inventory</option>
                          <option value="in_stock">In Stock</option>
                          <option value="low_stock">Low Stock</option>
                          <option value="out_of_stock">Out of Stock</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bulk action toolbar */}
              {bulkActionSelection.length > 0 && (
                <div className="bg-gray-50 px-4 py-3 sm:px-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-700">
                        {bulkActionSelection.length} products selected
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkActionType('status');
                          setShowBulkActionModal(true);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Change Status
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkActionType('price');
                          setShowBulkActionModal(true);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Update Prices
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkActionSelection([])}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Product list */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          checked={bulkActionSelection.length > 0 && bulkActionSelection.length === products.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Inventory
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.uid}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            checked={bulkActionSelection.includes(product.uid)}
                            onChange={(e) => handleSelectProduct(product.uid, e.target.checked)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {product.primaryImageUrl ? (
                                <img 
                                  className="h-10 w-10 rounded-sm object-cover"
                                  src={product.primaryImageUrl}
                                  alt={product.name}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-sm bg-gray-200 flex items-center justify-center">
                                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <Link 
                                to={`/seller/products/${product.uid}`}
                                className="text-sm font-medium text-gray-900 hover:text-indigo-600"
                              >
                                {product.name}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPrice(product.basePrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getInventoryStatusColor(product.inventoryStatus)}`}>
                            {product.inventoryStatus === 'in_stock' && 'In Stock'}
                            {product.inventoryStatus === 'low_stock' && 'Low Stock'}
                            {product.inventoryStatus === 'out_of_stock' && 'Out of Stock'}
                            {product.inventoryStatus === 'backorder' && 'Backorder'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(product.listingStatus)}`}>
                            {product.listingStatus === 'active' && 'Active'}
                            {product.listingStatus === 'inactive' && 'Inactive'}
                            {product.listingStatus === 'draft' && 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col">
                            <span>{product.totalViews} views</span>
                            <span>{formatPercent(product.conversionRate)} conversion</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link 
                            to={`/seller/products/${product.uid}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => duplicateProduct(product.uid)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Duplicate
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {products.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-500">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                          <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
                          <div className="mt-6">
                            <Link
                              to="/seller/products/new"
                              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                              Add Product
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {isLoading && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-500">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="mt-2">Loading products...</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {products.length > 0 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${pagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${pagination.currentPage === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(pagination.currentPage - 1) * pagination.limit + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)}
                        </span>{' '}
                        of <span className="font-medium">{pagination.totalItems}</span> products
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(pagination.currentPage - 1)}
                          disabled={pagination.currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${pagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {[...Array(pagination.totalPages)].map((_, i) => {
                          const pageNumber = i + 1;
                          
                          // Show current page, first, last, and pages around current
                          if (
                            pageNumber === 1 ||
                            pageNumber === pagination.totalPages ||
                            (pageNumber >= pagination.currentPage - 1 && pageNumber <= pagination.currentPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNumber}
                                onClick={() => handlePageChange(pageNumber)}
                                className={`relative inline-flex items-center px-4 py-2 border ${pageNumber === pagination.currentPage
                                  ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                  } text-sm font-medium`}
                              >
                                {pageNumber}
                              </button>
                            );
                          }
                          
                          // Show ellipsis for breaks in sequence
                          if (
                            (pageNumber === 2 && pagination.currentPage > 3) ||
                            (pageNumber === pagination.totalPages - 1 && pagination.currentPage < pagination.totalPages - 2)
                          ) {
                            return (
                              <span
                                key={pageNumber}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                              >
                                ...
                              </span>
                            );
                          }
                          
                          return null;
                        })}
                        
                        <button
                          onClick={() => handlePageChange(pagination.currentPage + 1)}
                          disabled={pagination.currentPage === pagination.totalPages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${pagination.currentPage === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Delete Product
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this product? This action cannot be undone.
                      All product data, including images, variants, and customer reviews will be permanently removed.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={deleteProduct}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk action modal */}
      {showBulkActionModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
                  <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {bulkActionType === 'price' ? 'Update Prices' : 'Change Status'}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {bulkActionType === 'price'
                        ? `You are about to update prices for ${bulkActionSelection.length} products.`
                        : `You are about to change the status of ${bulkActionSelection.length} products.`}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5">
                {bulkActionType === 'price' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="adjustment-type" className="block text-sm font-medium text-gray-700">
                        Adjustment Type
                      </label>
                      <select
                        id="adjustment-type"
                        name="adjustment-type"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={bulkPriceAdjustment.type}
                        onChange={(e) => setBulkPriceAdjustment({
                          ...bulkPriceAdjustment,
                          type: e.target.value as 'fixed' | 'percentage'
                        })}
                      >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="operation" className="block text-sm font-medium text-gray-700">
                        Operation
                      </label>
                      <select
                        id="operation"
                        name="operation"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={bulkPriceAdjustment.operation}
                        onChange={(e) => setBulkPriceAdjustment({
                          ...bulkPriceAdjustment,
                          operation: e.target.value as 'increase' | 'decrease' | 'set'
                        })}
                      >
                        <option value="increase">Increase by</option>
                        <option value="decrease">Decrease by</option>
                        {bulkPriceAdjustment.type === 'fixed' && (
                          <option value="set">Set to</option>
                        )}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="adjustment-value" className="block text-sm font-medium text-gray-700">
                        {bulkPriceAdjustment.type === 'percentage' ? 'Percentage' : 'Amount'}
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        {bulkPriceAdjustment.type === 'fixed' && (
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                        )}
                        <input
                          type="number"
                          name="adjustment-value"
                          id="adjustment-value"
                          min={0}
                          step={bulkPriceAdjustment.type === 'percentage' ? 0.01 : 0.01}
                          className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                            bulkPriceAdjustment.type === 'fixed' ? 'pl-7' : ''
                          }`}
                          placeholder={bulkPriceAdjustment.type === 'percentage' ? '10' : '5.99'}
                          value={bulkPriceAdjustment.value || ''}
                          onChange={(e) => setBulkPriceAdjustment({
                            ...bulkPriceAdjustment,
                            value: parseFloat(e.target.value) || 0
                          })}
                        />
                        {bulkPriceAdjustment.type === 'percentage' && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {bulkActionType === 'status' && (
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      New Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      value={bulkStatusValue}
                      onChange={(e) => setBulkStatusValue(e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={bulkActionType === 'price' ? bulkUpdatePrices : bulkUpdateStatus}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                  disabled={isLoading || (bulkActionType === 'price' && (!bulkPriceAdjustment.value || bulkPriceAdjustment.value <= 0))}
                >
                  {isLoading ? 'Processing...' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkActionModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
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

export default UV_ProductManagement;