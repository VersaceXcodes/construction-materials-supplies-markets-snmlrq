import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "@/store/main";
import axios from "axios";

// Define types for our component
interface Address {
  uid: string;
  address_type: string;
  name: string;
  recipient_name: string;
  street_address_1: string;
  street_address_2?: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  phone_number?: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  special_instructions?: string;
  project_uid?: string;
}

interface ShippingMethod {
  uid: string;
  name: string;
  description: string;
  transit_time: string;
  cost: number;
  service_level: string;
}

interface PaymentMethod {
  uid: string;
  type: string;
  name: string;
  last_four?: string;
  expiry_month?: number;
  expiry_year?: number;
  is_default: boolean;
}

// Checkout component
const UV_Checkout: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  
  // Get cart and auth state from global store
  const { isAuthenticated, user, token } = useAppSelector((state) => state.auth);
  const { items, summary } = useAppSelector((state) => state.cart);
  
  // Local state
  const [checkoutStep, setCheckoutStep] = useState<'shipping' | 'payment' | 'review' | 'confirmation'>('shipping');
  const [cartSummary, setCartSummary] = useState({
    subtotal: summary.subtotal || 0,
    taxAmount: summary.taxAmount || 0,
    shippingAmount: summary.shippingAmount || 0,
    discountAmount: summary.discountAmount || 0,
    totalAmount: summary.totalAmount || 0,
    currency: summary.currency || "USD",
    itemCount: summary.itemCount || 0
  });
  
  const [availableAddresses, setAvailableAddresses] = useState<Address[]>([]);
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<Address | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<Address | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [errors, setErrors] = useState<{
    shipping?: string[];
    payment?: string[];
    general?: string[];
  }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  
  // Form states for new address
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressFormData, setNewAddressFormData] = useState<Partial<Address>>({
    address_type: 'residential',
    name: '',
    recipient_name: '',
    street_address_1: '',
    street_address_2: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: 'US',
    phone_number: '',
    special_instructions: ''
  });
  
  // For payment form
  const [newPaymentFormVisible, setNewPaymentFormVisible] = useState(false);
  const [newPaymentData, setNewPaymentData] = useState({
    card_number: '',
    name_on_card: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    save_for_future: true
  });
  
  // For billing same as shipping
  const [billingIsSameAsShipping, setBillingIsSameAsShipping] = useState(true);
  
  // For professional buyers
  const [projectUid, setProjectUid] = useState<string | null>(null);
  const [costCode, setCostCode] = useState('');
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  
  // For order confirmation
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  
  // Function to fetch checkout data on initialization
  const fetchCheckoutData = async () => {
    setIsProcessing(true);
    try {
      // Check if we have a specific cart_uid from URL
      const cartUid = searchParams.get('cart_uid');
      
      // If the user isn't authenticated, redirect to login
      if (!isAuthenticated || !token) {
        navigate('/', { state: { from: '/checkout', showAuthModal: true } });
        return;
      }
      
      if (items.length === 0) {
        navigate('/cart');
        return;
      }
      
      // Set cart summary from global state
      setCartSummary({
        subtotal: summary.subtotal,
        taxAmount: summary.taxAmount,
        shippingAmount: summary.shippingAmount,
        discountAmount: summary.discountAmount,
        totalAmount: summary.totalAmount,
        currency: summary.currency,
        itemCount: summary.itemCount
      });
      
      // Fetch user addresses
      await fetchUserAddresses();
      
      // For professional buyers, fetch available projects
      if (user?.userType === 'professional_buyer' && user?.companyUid) {
        try {
          const projectsResponse = await axios.get('/api/projects', {
            params: { company_uid: user.companyUid }
          });
          
          if (projectsResponse.data.success) {
            setAvailableProjects(projectsResponse.data.projects || []);
          }
        } catch (error) {
          console.error('Error fetching projects:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching checkout data:', error);
      setErrors(prev => ({
        ...prev,
        general: ['Failed to load checkout data. Please try again.']
      }));
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to fetch user's saved addresses
  const fetchUserAddresses = async () => {
    try {
      const response = await axios.get('/api/users/addresses');
      
      if (response.data.success) {
        setAvailableAddresses(response.data.addresses);
        
        // Set default shipping address if available
        const defaultShipping = response.data.addresses.find((address: Address) => address.is_default_shipping);
        if (defaultShipping) {
          setSelectedShippingAddress(defaultShipping);
          await fetchShippingMethods(defaultShipping.uid);
        } else if (response.data.addresses.length > 0) {
          setSelectedShippingAddress(response.data.addresses[0]);
          await fetchShippingMethods(response.data.addresses[0].uid);
        }
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setErrors(prev => ({
        ...prev,
        shipping: [...(prev.shipping || []), 'Failed to load your addresses. Please try again.']
      }));
    }
  };
  
  // Function to fetch shipping methods based on selected address
  const fetchShippingMethods = async (addressUid: string) => {
    try {
      const response = await axios.get('/api/shipping/methods', {
        params: { address_uid: addressUid }
      });
      
      if (response.data.success) {
        setShippingMethods(response.data.shipping_methods);
        // Select the first shipping method by default
        if (response.data.shipping_methods.length > 0) {
          setSelectedShippingMethod(response.data.shipping_methods[0]);
          // Calculate costs with this method
          await calculateShipping(addressUid, response.data.shipping_methods[0].uid);
        }
      }
    } catch (error) {
      console.error('Error fetching shipping methods:', error);
      setErrors(prev => ({
        ...prev,
        shipping: [...(prev.shipping || []), 'Failed to load shipping methods. Please try again.']
      }));
    }
  };
  
  // Function to fetch user's saved payment methods
  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get('/api/users/payment-methods');
      
      if (response.data.success) {
        setPaymentMethods(response.data.payment_methods);
        
        // Set default payment method if available
        const defaultPayment = response.data.payment_methods.find((method: PaymentMethod) => method.is_default);
        if (defaultPayment) {
          setSelectedPaymentMethod(defaultPayment);
        } else if (response.data.payment_methods.length > 0) {
          setSelectedPaymentMethod(response.data.payment_methods[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setErrors(prev => ({
        ...prev,
        payment: [...(prev.payment || []), 'Failed to load your payment methods. Please try again.']
      }));
    }
  };
  
  // Function to validate shipping information
  const validateShippingInfo = () => {
    const newErrors: string[] = [];
    
    if (!selectedShippingAddress) {
      newErrors.push('Please select a shipping address.');
    }
    
    if (!selectedShippingMethod) {
      newErrors.push('Please select a shipping method.');
    }
    
    if (newErrors.length > 0) {
      setErrors(prev => ({ ...prev, shipping: newErrors }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, shipping: undefined }));
    return true;
  };
  
  // Function to validate payment information
  const validatePaymentInfo = () => {
    const newErrors: string[] = [];
    
    if (!selectedPaymentMethod && !newPaymentFormVisible) {
      newErrors.push('Please select a payment method.');
    }
    
    if (newPaymentFormVisible) {
      // Validate card details if new payment form is visible
      if (!newPaymentData.card_number || newPaymentData.card_number.replace(/\s/g, '').length < 15) {
        newErrors.push('Please enter a valid card number.');
      }
      
      if (!newPaymentData.name_on_card) {
        newErrors.push('Please enter the name on card.');
      }
      
      if (!newPaymentData.expiry_month || !newPaymentData.expiry_year) {
        newErrors.push('Please enter a valid expiration date.');
      }
      
      if (!newPaymentData.cvv || newPaymentData.cvv.length < 3) {
        newErrors.push('Please enter a valid CVV code.');
      }
    }
    
    if (!selectedBillingAddress) {
      newErrors.push('Please select a billing address.');
    }
    
    if (newErrors.length > 0) {
      setErrors(prev => ({ ...prev, payment: newErrors }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, payment: undefined }));
    return true;
  };
  
  // Function to validate order review
  const validateOrderReview = () => {
    const newErrors: string[] = [];
    
    if (!termsAccepted) {
      newErrors.push('Please accept the terms and conditions to place your order.');
    }
    
    if (newErrors.length > 0) {
      setErrors(prev => ({ ...prev, general: newErrors }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, general: undefined }));
    return true;
  };
  
  // Function to save a new address
  const saveNewAddress = async () => {
    try {
      setIsProcessing(true);
      
      // Validate form
      const requiredFields = ['name', 'recipient_name', 'street_address_1', 'city', 'state_province', 'postal_code', 'country'];
      const missingFields = requiredFields.filter(field => !newAddressFormData[field as keyof typeof newAddressFormData]);
      
      if (missingFields.length > 0) {
        setErrors(prev => ({
          ...prev,
          shipping: ['Please fill out all required address fields.']
        }));
        setIsProcessing(false);
        return;
      }
      
      const response = await axios.post('/api/users/addresses', newAddressFormData);
      
      if (response.data.success) {
        // Add new address to availableAddresses
        const newAddress = response.data.address;
        setAvailableAddresses(prev => [...prev, newAddress]);
        
        // Select the new address
        setSelectedShippingAddress(newAddress);
        
        // Close the form
        setShowNewAddressForm(false);
        
        // Reset form data
        setNewAddressFormData({
          address_type: 'residential',
          name: '',
          recipient_name: '',
          street_address_1: '',
          street_address_2: '',
          city: '',
          state_province: '',
          postal_code: '',
          country: 'US',
          phone_number: '',
          special_instructions: ''
        });
        
        // Fetch shipping methods for this address
        await fetchShippingMethods(newAddress.uid);
      }
    } catch (error) {
      console.error('Error saving address:', error);
      setErrors(prev => ({
        ...prev,
        shipping: [...(prev.shipping || []), 'Failed to save your address. Please try again.']
      }));
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to save a new payment method
  const saveNewPaymentMethod = async () => {
    try {
      setIsProcessing(true);
      
      // In a real implementation, we would use a secure tokenization service
      // Here we're simulating the API call
      const response = await axios.post('/api/users/payment-methods', {
        type: 'credit_card',
        card_number: newPaymentData.card_number.replace(/\s/g, ''),
        name_on_card: newPaymentData.name_on_card,
        expiry_month: newPaymentData.expiry_month,
        expiry_year: newPaymentData.expiry_year,
        cvv: newPaymentData.cvv,
        save_for_future: newPaymentData.save_for_future
      });
      
      if (response.data.success) {
        // Add new payment method to available methods
        const newPaymentMethod = response.data.payment_method;
        setPaymentMethods(prev => [...prev, newPaymentMethod]);
        
        // Select the new payment method
        setSelectedPaymentMethod(newPaymentMethod);
        
        // Close the form
        setNewPaymentFormVisible(false);
        
        // Reset form data
        setNewPaymentData({
          card_number: '',
          name_on_card: '',
          expiry_month: '',
          expiry_year: '',
          cvv: '',
          save_for_future: true
        });
      }
    } catch (error) {
      console.error('Error saving payment method:', error);
      setErrors(prev => ({
        ...prev,
        payment: [...(prev.payment || []), 'Failed to save your payment method. Please try again.']
      }));
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to calculate taxes based on shipping address
  const calculateTaxes = async (addressUid: string) => {
    try {
      const response = await axios.post('/api/checkout/calculate-taxes', {
        address_uid: addressUid,
        items: items.map(item => ({
          product_uid: item.productUid,
          variant_uid: item.variantUid,
          quantity: item.quantity,
          price: item.priceSnapshot
        }))
      });
      
      if (response.data.success) {
        setCartSummary(prev => ({
          ...prev,
          taxAmount: response.data.tax_amount,
          totalAmount: prev.subtotal + response.data.tax_amount + prev.shippingAmount - prev.discountAmount
        }));
      }
    } catch (error) {
      console.error('Error calculating taxes:', error);
      // Use a default tax rate (e.g., 8%)
      const estimatedTax = cartSummary.subtotal * 0.08;
      setCartSummary(prev => ({
        ...prev,
        taxAmount: estimatedTax,
        totalAmount: prev.subtotal + estimatedTax + prev.shippingAmount - prev.discountAmount
      }));
    }
  };
  
  // Function to calculate shipping costs
  const calculateShipping = async (addressUid: string, shippingMethodUid: string) => {
    try {
      const response = await axios.post('/api/checkout/calculate-shipping', {
        address_uid: addressUid,
        shipping_method_uid: shippingMethodUid,
        items: items.map(item => ({
          product_uid: item.productUid,
          variant_uid: item.variantUid,
          quantity: item.quantity
        }))
      });
      
      if (response.data.success) {
        setCartSummary(prev => ({
          ...prev,
          shippingAmount: response.data.shipping_amount,
          totalAmount: prev.subtotal + prev.taxAmount + response.data.shipping_amount - prev.discountAmount
        }));
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      // Use the default shipping cost from the selected method
      if (selectedShippingMethod) {
        setCartSummary(prev => ({
          ...prev,
          shippingAmount: selectedShippingMethod.cost,
          totalAmount: prev.subtotal + prev.taxAmount + selectedShippingMethod.cost - prev.discountAmount
        }));
      }
    }
  };
  
  // Function to process payment
  const processPayment = async () => {
    // In a real implementation, we would use a secure payment processor
    // Here we're simulating a successful payment
    try {
      setIsProcessing(true);
      
      const paymentData = {
        payment_method: selectedPaymentMethod ? 'saved' : 'new',
        payment_method_uid: selectedPaymentMethod?.uid,
        // Only include card details for new payment methods
        card_details: !selectedPaymentMethod ? {
          card_number: newPaymentData.card_number.replace(/\s/g, ''),
          name: newPaymentData.name_on_card,
          expiry_month: newPaymentData.expiry_month,
          expiry_year: newPaymentData.expiry_year,
          cvv: newPaymentData.cvv
        } : undefined,
        amount: cartSummary.totalAmount,
        currency: cartSummary.currency
      };
      
      // Simulate API call
      // In a real implementation, this would be a call to a payment processor
      const response = await new Promise<any>(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            transaction_id: `txn-${Date.now()}`,
            status: 'approved'
          });
        }, 1500);
      });
      
      return response;
    } catch (error) {
      console.error('Payment processing error:', error);
      throw new Error('Payment processing failed. Please try again.');
    }
  };
  
  // Function to place order
  const placeOrder = async () => {
    try {
      setIsProcessing(true);
      
      // Validate order review
      if (!validateOrderReview()) {
        setIsProcessing(false);
        return;
      }
      
      // Process payment
      const paymentResult = await processPayment();
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.message || 'Payment processing failed');
      }
      
      // Create order
      const orderData = {
        shipping_address_uid: selectedShippingAddress?.uid,
        billing_address_uid: selectedBillingAddress?.uid,
        payment_method: selectedPaymentMethod ? selectedPaymentMethod.type : 'credit_card',
        shipping_method: selectedShippingMethod?.uid,
        special_instructions: orderNotes,
        project_uid: projectUid,
        is_gift: isGift,
        gift_message: isGift ? giftMessage : undefined,
        transaction_id: paymentResult.transaction_id
      };
      
      const response = await axios.post('/api/orders', orderData);
      
      if (response.data.success) {
        setCompletedOrder(response.data.order);
        setCheckoutStep('confirmation');
        await handleOrderSuccess(response.data.order);
      } else {
        throw new Error(response.data.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      setErrors(prev => ({
        ...prev,
        general: [...(prev.general || []), error instanceof Error ? error.message : 'Failed to place your order. Please try again.']
      }));
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to handle successful order creation
  const handleOrderSuccess = async (order: any) => {
    // Clear cart (in a real implementation, this would be done via the API)
    // dispatch(cartActions.clearCart());
    
    // For this implementation, we'll just show the confirmation page
    setCompletedOrder(order);
    
    // Navigate to confirmation step
    setCheckoutStep('confirmation');
  };
  
  // Handler for shipping address change
  const handleShippingAddressChange = async (addressUid: string) => {
    const address = availableAddresses.find(addr => addr.uid === addressUid);
    if (address) {
      setSelectedShippingAddress(address);
      
      // If billing same as shipping, update billing address
      if (billingIsSameAsShipping) {
        setSelectedBillingAddress(address);
      }
      
      // Fetch shipping methods for this address
      await fetchShippingMethods(addressUid);
      
      // Calculate taxes for this address
      await calculateTaxes(addressUid);
    }
  };
  
  // Handler for shipping method change
  const handleShippingMethodChange = async (methodUid: string) => {
    const method = shippingMethods.find(m => m.uid === methodUid);
    if (method && selectedShippingAddress) {
      setSelectedShippingMethod(method);
      
      // Calculate shipping costs
      await calculateShipping(selectedShippingAddress.uid, methodUid);
    }
  };
  
  // Handler for payment method change
  const handlePaymentMethodChange = (methodUid: string) => {
    const method = paymentMethods.find(m => m.uid === methodUid);
    if (method) {
      setSelectedPaymentMethod(method);
      setNewPaymentFormVisible(false);
    }
  };
  
  // Handler for billing address change
  const handleBillingAddressChange = (addressUid: string) => {
    const address = availableAddresses.find(addr => addr.uid === addressUid);
    if (address) {
      setSelectedBillingAddress(address);
      setBillingIsSameAsShipping(false);
    }
  };
  
  // Handler for "billing same as shipping" toggle
  const handleBillingSameAsShipping = (isSame: boolean) => {
    setBillingIsSameAsShipping(isSame);
    if (isSame && selectedShippingAddress) {
      setSelectedBillingAddress(selectedShippingAddress);
    } else {
      // Find default billing address or first address
      const defaultBilling = availableAddresses.find(addr => addr.is_default_billing);
      setSelectedBillingAddress(defaultBilling || availableAddresses[0] || null);
    }
  };
  
  // Handler for new payment form toggle
  const handleNewPaymentToggle = () => {
    setNewPaymentFormVisible(prev => !prev);
    if (!newPaymentFormVisible) {
      setSelectedPaymentMethod(null);
    }
  };
  
  // Handler for new address form toggle
  const handleNewAddressToggle = () => {
    setShowNewAddressForm(prev => !prev);
  };
  
  // Handler for navigating to next step
  const handleNextStep = () => {
    if (checkoutStep === 'shipping') {
      if (validateShippingInfo()) {
        setCheckoutStep('payment');
        
        // Set billing address to shipping address by default
        if (billingIsSameAsShipping && selectedShippingAddress) {
          setSelectedBillingAddress(selectedShippingAddress);
        }
        
        // Fetch payment methods
        fetchPaymentMethods();
      }
    } else if (checkoutStep === 'payment') {
      if (validatePaymentInfo()) {
        setCheckoutStep('review');
      }
    }
  };
  
  // Handler for navigating to previous step
  const handlePreviousStep = () => {
    if (checkoutStep === 'payment') {
      setCheckoutStep('shipping');
    } else if (checkoutStep === 'review') {
      setCheckoutStep('payment');
    }
  };
  
  // Initialize checkout data on component mount
  useEffect(() => {
    fetchCheckoutData();
  }, []);
  
  // Format credit card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };
  
  // Format card expiry date
  const formatExpiryDate = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    
    if (cleanValue.length >= 3) {
      const month = cleanValue.substring(0, 2);
      const year = cleanValue.substring(2);
      
      setNewPaymentData(prev => ({
        ...prev,
        expiry_month: month,
        expiry_year: `20${year}`
      }));
    }
  };
  
  return (
    <>
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto py-8 px-4 md:px-6">
          {/* Page Title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-2">Complete your purchase securely</p>
          </div>
          
          {/* Checkout Progress */}
          <div className="mb-8">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
              <div className={`flex flex-col items-center ${checkoutStep === 'shipping' ? 'text-blue-600' : checkoutStep === 'payment' || checkoutStep === 'review' || checkoutStep === 'confirmation' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${checkoutStep === 'shipping' ? 'bg-blue-100 border-2 border-blue-600' : checkoutStep === 'payment' || checkoutStep === 'review' || checkoutStep === 'confirmation' ? 'bg-green-100 border-2 border-green-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                  {checkoutStep === 'payment' || checkoutStep === 'review' || checkoutStep === 'confirmation' ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  ) : (
                    <span>1</span>
                  )}
                </div>
                <span className="text-sm mt-2 font-medium">Shipping</span>
              </div>
              
              <div className="flex-1 h-0.5 mx-2 bg-gray-200"></div>
              
              <div className={`flex flex-col items-center ${checkoutStep === 'payment' ? 'text-blue-600' : checkoutStep === 'review' || checkoutStep === 'confirmation' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${checkoutStep === 'payment' ? 'bg-blue-100 border-2 border-blue-600' : checkoutStep === 'review' || checkoutStep === 'confirmation' ? 'bg-green-100 border-2 border-green-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                  {checkoutStep === 'review' || checkoutStep === 'confirmation' ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  ) : (
                    <span>2</span>
                  )}
                </div>
                <span className="text-sm mt-2 font-medium">Payment</span>
              </div>
              
              <div className="flex-1 h-0.5 mx-2 bg-gray-200"></div>
              
              <div className={`flex flex-col items-center ${checkoutStep === 'review' ? 'text-blue-600' : checkoutStep === 'confirmation' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${checkoutStep === 'review' ? 'bg-blue-100 border-2 border-blue-600' : checkoutStep === 'confirmation' ? 'bg-green-100 border-2 border-green-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                  {checkoutStep === 'confirmation' ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  ) : (
                    <span>3</span>
                  )}
                </div>
                <span className="text-sm mt-2 font-medium">Review</span>
              </div>
              
              <div className="flex-1 h-0.5 mx-2 bg-gray-200"></div>
              
              <div className={`flex flex-col items-center ${checkoutStep === 'confirmation' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${checkoutStep === 'confirmation' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                  <span>4</span>
                </div>
                <span className="text-sm mt-2 font-medium">Confirmation</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main content area */}
            <div className="flex-1">
              {/* Shipping Step */}
              {checkoutStep === 'shipping' && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-4">Shipping Information</h2>
                    
                    {/* Error Messages */}
                    {errors.shipping && errors.shipping.length > 0 && (
                      <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                        <p className="font-bold">Please correct the following errors:</p>
                        <ul className="list-disc ml-5">
                          {errors.shipping.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Address Selection */}
                    {!showNewAddressForm && (
                      <div className="mb-6">
                        <label className="block text-gray-700 font-medium mb-2">Select a shipping address</label>
                        {availableAddresses.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableAddresses.map(address => (
                              <div
                                key={address.uid}
                                className={`border rounded-md p-4 cursor-pointer transition-colors ${selectedShippingAddress?.uid === address.uid ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                                onClick={() => handleShippingAddressChange(address.uid)}
                              >
                                <div className="flex justify-between">
                                  <p className="font-medium">{address.name || 'Unnamed Address'}</p>
                                  {address.is_default_shipping && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Default</span>
                                  )}
                                </div>
                                <p className="text-gray-600">{address.recipient_name}</p>
                                <p className="text-gray-600">{address.street_address_1}</p>
                                {address.street_address_2 && <p className="text-gray-600">{address.street_address_2}</p>}
                                <p className="text-gray-600">{address.city}, {address.state_province} {address.postal_code}</p>
                                <p className="text-gray-600">{address.country}</p>
                                <p className="text-gray-600">{address.phone_number}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600">You don't have any saved addresses.</p>
                        )}
                        
                        <button 
                          type="button" 
                          className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                          onClick={handleNewAddressToggle}
                        >
                          + Add a new address
                        </button>
                      </div>
                    )}
                    
                    {/* New Address Form */}
                    {showNewAddressForm && (
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium">Add a New Address</h3>
                          <button 
                            type="button" 
                            className="text-gray-600 hover:text-gray-800"
                            onClick={handleNewAddressToggle}
                          >
                            Cancel
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">
                              Address Name <span className="text-gray-500">(e.g. "Home", "Office")</span>
                            </label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.name}
                              onChange={e => setNewAddressFormData({...newAddressFormData, name: e.target.value})}
                              placeholder="Address Name"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Recipient Name*</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.recipient_name}
                              onChange={e => setNewAddressFormData({...newAddressFormData, recipient_name: e.target.value})}
                              placeholder="Full Name"
                              required
                            />
                          </div>
                          
                          <div className="md:col-span-2">
                            <label className="block text-gray-700 text-sm font-medium mb-1">Address Line 1*</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.street_address_1}
                              onChange={e => setNewAddressFormData({...newAddressFormData, street_address_1: e.target.value})}
                              placeholder="Street address, P.O. box, company name"
                              required
                            />
                          </div>
                          
                          <div className="md:col-span-2">
                            <label className="block text-gray-700 text-sm font-medium mb-1">Address Line 2</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.street_address_2}
                              onChange={e => setNewAddressFormData({...newAddressFormData, street_address_2: e.target.value})}
                              placeholder="Apartment, suite, unit, building, floor, etc."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">City*</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.city}
                              onChange={e => setNewAddressFormData({...newAddressFormData, city: e.target.value})}
                              placeholder="City"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">State/Province*</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.state_province}
                              onChange={e => setNewAddressFormData({...newAddressFormData, state_province: e.target.value})}
                              placeholder="State/Province"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Postal Code*</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.postal_code}
                              onChange={e => setNewAddressFormData({...newAddressFormData, postal_code: e.target.value})}
                              placeholder="Postal Code"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Country*</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.country}
                              onChange={e => setNewAddressFormData({...newAddressFormData, country: e.target.value})}
                              required
                            >
                              <option value="US">United States</option>
                              <option value="CA">Canada</option>
                              <option value="GB">United Kingdom</option>
                              <option value="AU">Australia</option>
                              {/* Add more countries as needed */}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Phone Number</label>
                            <input
                              type="tel"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.phone_number}
                              onChange={e => setNewAddressFormData({...newAddressFormData, phone_number: e.target.value})}
                              placeholder="Phone Number"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Address Type</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.address_type}
                              onChange={e => setNewAddressFormData({...newAddressFormData, address_type: e.target.value})}
                            >
                              <option value="residential">Residential</option>
                              <option value="commercial">Commercial</option>
                              <option value="jobsite">Job Site</option>
                            </select>
                          </div>
                          
                          <div className="md:col-span-2">
                            <label className="block text-gray-700 text-sm font-medium mb-1">Special Instructions</label>
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={newAddressFormData.special_instructions}
                              onChange={e => setNewAddressFormData({...newAddressFormData, special_instructions: e.target.value})}
                              placeholder="Delivery instructions, access codes, etc."
                              rows={3}
                            ></textarea>
                          </div>
                          
                          {/* Project selection for professional buyers */}
                          {user?.userType === 'professional_buyer' && availableProjects.length > 0 && (
                            <div className="md:col-span-2">
                              <label className="block text-gray-700 text-sm font-medium mb-1">Associate with Project</label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={newAddressFormData.project_uid || ''}
                                onChange={e => setNewAddressFormData({...newAddressFormData, project_uid: e.target.value})}
                              >
                                <option value="">None</option>
                                {availableProjects.map(project => (
                                  <option key={project.uid} value={project.uid}>{project.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            onClick={saveNewAddress}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Saving...' : 'Save Address'}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Shipping Method Selection */}
                    {selectedShippingAddress && (
                      <div className="mb-6">
                        <h3 className="font-medium text-lg mb-2">Shipping Method</h3>
                        
                        {shippingMethods.length > 0 ? (
                          <div className="space-y-3">
                            {shippingMethods.map(method => (
                              <div
                                key={method.uid}
                                className={`border rounded-md p-4 cursor-pointer transition-colors ${selectedShippingMethod?.uid === method.uid ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                                onClick={() => handleShippingMethodChange(method.uid)}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium">{method.name}</p>
                                    <p className="text-gray-600 text-sm">{method.description}</p>
                                    <p className="text-gray-600 text-sm">Estimated delivery: {method.transit_time}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">${method.cost.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600">Please select a shipping address to view available shipping methods.</p>
                        )}
                      </div>
                    )}
                    
                    {/* Order Notes */}
                    <div className="mb-6">
                      <h3 className="font-medium text-lg mb-2">Delivery Instructions</h3>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        placeholder="Add any special instructions for delivery"
                        rows={3}
                      ></textarea>
                    </div>
                    
                    {/* Gift Options */}
                    <div className="mb-6">
                      <div className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id="is-gift"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={isGift}
                          onChange={e => setIsGift(e.target.checked)}
                        />
                        <label htmlFor="is-gift" className="ml-2 block text-gray-700 font-medium">
                          This is a gift
                        </label>
                      </div>
                      
                      {isGift && (
                        <div className="mt-2">
                          <label className="block text-gray-700 text-sm font-medium mb-1">Gift Message</label>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={giftMessage}
                            onChange={e => setGiftMessage(e.target.value)}
                            placeholder="Add a gift message"
                            rows={3}
                            maxLength={200}
                          ></textarea>
                          <p className="text-xs text-gray-500 mt-1">{giftMessage.length}/200 characters</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Project Assignment for Professional Buyers */}
                    {user?.userType === 'professional_buyer' && availableProjects.length > 0 && (
                      <div className="mb-6">
                        <h3 className="font-medium text-lg mb-2">Project Assignment</h3>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={projectUid || ''}
                          onChange={e => setProjectUid(e.target.value || null)}
                        >
                          <option value="">No Project</option>
                          {availableProjects.map(project => (
                            <option key={project.uid} value={project.uid}>{project.name}</option>
                          ))}
                        </select>
                        
                        {projectUid && (
                          <div className="mt-3">
                            <label className="block text-gray-700 text-sm font-medium mb-1">Cost Code (Optional)</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={costCode}
                              onChange={e => setCostCode(e.target.value)}
                              placeholder="Enter cost code for accounting"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Payment Step */}
              {checkoutStep === 'payment' && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-4">Payment Information</h2>
                    
                    {/* Error Messages */}
                    {errors.payment && errors.payment.length > 0 && (
                      <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                        <p className="font-bold">Please correct the following errors:</p>
                        <ul className="list-disc ml-5">
                          {errors.payment.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Payment Method Selection */}
                    <div className="mb-6">
                      <h3 className="font-medium text-lg mb-3">Select a Payment Method</h3>
                      
                      {/* Saved Payment Methods */}
                      {paymentMethods.length > 0 && !newPaymentFormVisible && (
                        <div className="space-y-3 mb-4">
                          {paymentMethods.map(method => (
                            <div
                              key={method.uid}
                              className={`border rounded-md p-4 cursor-pointer transition-colors ${selectedPaymentMethod?.uid === method.uid ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                              onClick={() => handlePaymentMethodChange(method.uid)}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="flex items-center">
                                    {method.type === 'credit_card' ? (
                                      <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                                      </svg>
                                    ) : method.type === 'bank_account' ? (
                                      <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
                                      </svg>
                                    ) : (
                                      <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                                      </svg>
                                    )}
                                    <p className="font-medium">{method.name}</p>
                                  </div>
                                  {method.type === 'credit_card' && method.last_four && (
                                    <p className="text-gray-600 text-sm">•••• •••• •••• {method.last_four}</p>
                                  )}
                                  {method.type === 'credit_card' && method.expiry_month && method.expiry_year && (
                                    <p className="text-gray-600 text-sm">Expires {method.expiry_month}/{method.expiry_year.toString().slice(-2)}</p>
                                  )}
                                </div>
                                {method.is_default && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Default</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* New Credit Card Form */}
                      {newPaymentFormVisible ? (
                        <div className="border rounded-md p-4 mb-4">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-medium">New Credit Card</h4>
                            <button 
                              type="button" 
                              className="text-gray-600 hover:text-gray-800"
                              onClick={handleNewPaymentToggle}
                            >
                              Cancel
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-gray-700 text-sm font-medium mb-1">Card Number*</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={newPaymentData.card_number}
                                  onChange={e => setNewPaymentData({...newPaymentData, card_number: formatCardNumber(e.target.value)})}
                                  placeholder="1234 5678 9012 3456"
                                  maxLength={19}
                                  required
                                />
                                <svg className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                                </svg>
                              </div>
                            </div>
                            
                            <div className="md:col-span-2">
                              <label className="block text-gray-700 text-sm font-medium mb-1">Name on Card*</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={newPaymentData.name_on_card}
                                onChange={e => setNewPaymentData({...newPaymentData, name_on_card: e.target.value})}
                                placeholder="Name as it appears on card"
                                required
                              />
                            </div>
                            
                            <div>
                              <label className="block text-gray-700 text-sm font-medium mb-1">Expiration Date*</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="MM/YY"
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 4) {
                                    const month = value.slice(0, 2);
                                    const year = value.slice(2);
                                    
                                    setNewPaymentData({
                                      ...newPaymentData,
                                      expiry_month: month,
                                      expiry_year: year.length === 2 ? `20${year}` : ''
                                    });
                                    
                                    e.target.value = value.length > 2 ? `${month}/${year}` : month;
                                  }
                                }}
                                maxLength={5}
                                required
                              />
                            </div>
                            
                            <div>
                              <label className="block text-gray-700 text-sm font-medium mb-1">CVV*</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={newPaymentData.cvv}
                                  onChange={e => setNewPaymentData({...newPaymentData, cvv: e.target.value.replace(/\D/g, '')})}
                                  placeholder="123"
                                  maxLength={4}
                                  required
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            <div className="md:col-span-2">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id="save-card"
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  checked={newPaymentData.save_for_future}
                                  onChange={e => setNewPaymentData({...newPaymentData, save_for_future: e.target.checked})}
                                />
                                <label htmlFor="save-card" className="ml-2 block text-gray-700 text-sm">
                                  Save this card for future purchases
                                </label>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center text-sm text-gray-600">
                            <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                            </svg>
                            Your payment information is securely encrypted
                          </div>
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          onClick={handleNewPaymentToggle}
                        >
                          + Add a new credit card
                        </button>
                      )}
                      
                      {/* Business Payment Options for Professional Buyers */}
                      {user?.userType === 'professional_buyer' && (
                        <div className="mt-6">
                          <h4 className="font-medium text-md mb-2">Business Payment Options</h4>
                          <div className="space-y-3">
                            <div
                              className={`border rounded-md p-4 cursor-pointer transition-colors ${selectedPaymentMethod?.type === 'purchase_order' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                              onClick={() => setSelectedPaymentMethod({ uid: 'po-payment', type: 'purchase_order', name: 'Purchase Order', is_default: false })}
                            >
                              <div className="flex items-center">
                                <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span className="font-medium">Purchase Order</span>
                              </div>
                            </div>
                            
                            <div
                              className={`border rounded-md p-4 cursor-pointer transition-colors ${selectedPaymentMethod?.type === 'bank_transfer' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                              onClick={() => setSelectedPaymentMethod({ uid: 'bank-transfer', type: 'bank_transfer', name: 'ACH/Bank Transfer', is_default: false })}
                            >
                              <div className="flex items-center">
                                <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
                                </svg>
                                <span className="font-medium">ACH/Bank Transfer</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Billing Address */}
                    <div className="mb-6">
                      <h3 className="font-medium text-lg mb-3">Billing Address</h3>
                      
                      <div className="mb-4">
                        <div className="flex items-center mb-3">
                          <input
                            type="checkbox"
                            id="billing-same-shipping"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            checked={billingIsSameAsShipping}
                            onChange={e => handleBillingSameAsShipping(e.target.checked)}
                          />
                          <label htmlFor="billing-same-shipping" className="ml-2 block text-gray-700">
                            Same as shipping address
                          </label>
                        </div>
                      </div>
                      
                      {!billingIsSameAsShipping && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {availableAddresses.map(address => (
                            <div
                              key={`billing-${address.uid}`}
                              className={`border rounded-md p-4 cursor-pointer transition-colors ${selectedBillingAddress?.uid === address.uid ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                              onClick={() => handleBillingAddressChange(address.uid)}
                            >
                              <div className="flex justify-between">
                                <p className="font-medium">{address.name || 'Unnamed Address'}</p>
                                {address.is_default_billing && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Default</span>
                                )}
                              </div>
                              <p className="text-gray-600">{address.recipient_name}</p>
                              <p className="text-gray-600">{address.street_address_1}</p>
                              {address.street_address_2 && <p className="text-gray-600">{address.street_address_2}</p>}
                              <p className="text-gray-600">{address.city}, {address.state_province} {address.postal_code}</p>
                              <p className="text-gray-600">{address.country}</p>
                              <p className="text-gray-600">{address.phone_number}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Review Step */}
              {checkoutStep === 'review' && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-4">Review Your Order</h2>
                    
                    {/* Error Messages */}
                    {errors.general && errors.general.length > 0 && (
                      <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                        <ul className="list-disc ml-5">
                          {errors.general.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Order Items */}
                    <div className="mb-6">
                      <h3 className="font-medium text-lg mb-3">Items</h3>
                      <div className="border rounded-md divide-y">
                        {items.map(item => (
                          <div key={item.uid} className="flex p-4">
                            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                              {item.primaryImageUrl ? (
                                <img
                                  src={item.primaryImageUrl}
                                  alt={item.productName}
                                  className="h-full w-full object-cover object-center"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
                                  No image
                                </div>
                              )}
                            </div>
                            
                            <div className="ml-4 flex flex-1 flex-col">
                              <div>
                                <div className="flex justify-between">
                                  <h4 className="font-medium text-gray-900">{item.productName}</h4>
                                  <p className="ml-4 text-right font-medium text-gray-900">
                                    ${(item.priceSnapshot * item.quantity).toFixed(2)}
                                  </p>
                                </div>
                                {item.variantInfo && (
                                  <p className="mt-1 text-sm text-gray-500">{item.variantInfo}</p>
                                )}
                              </div>
                              <div className="flex flex-1 items-end justify-between text-sm">
                                <p className="text-gray-500">Qty {item.quantity}</p>
                                <p className="text-gray-500">Price: ${item.priceSnapshot.toFixed(2)} each</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Shipping Information */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-lg">Shipping Information</h3>
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:text-blue-800"
                          onClick={() => setCheckoutStep('shipping')}
                        >
                          Edit
                        </button>
                      </div>
                      
                      <div className="border rounded-md p-4">
                        {selectedShippingAddress && (
                          <div className="mb-3">
                            <p className="font-medium">{selectedShippingAddress.recipient_name}</p>
                            <p className="text-gray-600">{selectedShippingAddress.street_address_1}</p>
                            {selectedShippingAddress.street_address_2 && (
                              <p className="text-gray-600">{selectedShippingAddress.street_address_2}</p>
                            )}
                            <p className="text-gray-600">
                              {selectedShippingAddress.city}, {selectedShippingAddress.state_province} {selectedShippingAddress.postal_code}
                            </p>
                            <p className="text-gray-600">{selectedShippingAddress.country}</p>
                            <p className="text-gray-600">{selectedShippingAddress.phone_number}</p>
                          </div>
                        )}
                        
                        {selectedShippingMethod && (
                          <div className="mb-2">
                            <p className="text-gray-700"><span className="font-medium">Shipping Method:</span> {selectedShippingMethod.name}</p>
                            <p className="text-gray-600 text-sm">Estimated delivery: {selectedShippingMethod.transit_time}</p>
                          </div>
                        )}
                        
                        {orderNotes && (
                          <div className="mt-2">
                            <p className="font-medium">Delivery Instructions:</p>
                            <p className="text-gray-600">{orderNotes}</p>
                          </div>
                        )}
                        
                        {isGift && (
                          <div className="mt-2">
                            <p className="font-medium">Gift Message:</p>
                            <p className="text-gray-600 italic">"{giftMessage}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Payment Information */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-lg">Payment Information</h3>
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:text-blue-800"
                          onClick={() => setCheckoutStep('payment')}
                        >
                          Edit
                        </button>
                      </div>
                      
                      <div className="border rounded-md p-4">
                        {selectedPaymentMethod && (
                          <div className="mb-3">
                            <div className="flex items-center">
                              {selectedPaymentMethod.type === 'credit_card' ? (
                                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                                </svg>
                              ) : selectedPaymentMethod.type === 'bank_transfer' ? (
                                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
                                </svg>
                              ) : selectedPaymentMethod.type === 'purchase_order' ? (
                                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                                </svg>
                              )}
                              <p className="font-medium">{selectedPaymentMethod.name}</p>
                            </div>
                            {selectedPaymentMethod.type === 'credit_card' && selectedPaymentMethod.last_four && (
                              <p className="text-gray-600 text-sm ml-7">•••• •••• •••• {selectedPaymentMethod.last_four}</p>
                            )}
                            {selectedPaymentMethod.type === 'purchase_order' && (
                              <p className="text-gray-600 text-sm ml-7">A purchase order form will be sent with your invoice</p>
                            )}
                          </div>
                        )}
                        
                        {selectedBillingAddress && (
                          <div>
                            <p className="font-medium">Billing Address:</p>
                            <p className="text-gray-600">{selectedBillingAddress.recipient_name}</p>
                            <p className="text-gray-600">{selectedBillingAddress.street_address_1}</p>
                            {selectedBillingAddress.street_address_2 && (
                              <p className="text-gray-600">{selectedBillingAddress.street_address_2}</p>
                            )}
                            <p className="text-gray-600">
                              {selectedBillingAddress.city}, {selectedBillingAddress.state_province} {selectedBillingAddress.postal_code}
                            </p>
                            <p className="text-gray-600">{selectedBillingAddress.country}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Project Information (for Professional Buyers) */}
                    {user?.userType === 'professional_buyer' && projectUid && (
                      <div className="mb-6">
                        <h3 className="font-medium text-lg mb-3">Project Information</h3>
                        <div className="border rounded-md p-4">
                          <p className="text-gray-700">
                            <span className="font-medium">Project:</span> {availableProjects.find(p => p.uid === projectUid)?.name || 'Unknown Project'}
                          </p>
                          {costCode && (
                            <p className="text-gray-700">
                              <span className="font-medium">Cost Code:</span> {costCode}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Terms and Conditions */}
                    <div className="mb-6">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          id="terms"
                          className="h-4 w-4 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={termsAccepted}
                          onChange={e => setTermsAccepted(e.target.checked)}
                        />
                        <label htmlFor="terms" className="ml-2 block text-gray-700 text-sm">
                          I agree to the <Link to="/help?topic=terms" className="text-blue-600 hover:text-blue-800">Terms and Conditions</Link> and <Link to="/help?topic=privacy" className="text-blue-600 hover:text-blue-800">Privacy Policy</Link>. I also acknowledge that by clicking "Place Order", I am agreeing to make payment for this purchase.
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Confirmation Step */}
              {checkoutStep === 'confirmation' && completedOrder && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                  <div className="p-6">
                    <div className="flex flex-col items-center text-center mb-6">
                      <div className="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
                        <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900">Order Confirmed!</h2>
                      <p className="text-gray-600 mt-1">Thank you for your purchase.</p>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="font-medium text-lg mb-2">Order Details</h3>
                      <div className="border rounded-md p-4">
                        <p className="text-gray-700 mb-2">
                          <span className="font-medium">Order Number:</span> {completedOrder.order_number}
                        </p>
                        <p className="text-gray-700 mb-2">
                          <span className="font-medium">Date:</span> {new Date().toLocaleDateString()}
                        </p>
                        <p className="text-gray-700 mb-2">
                          <span className="font-medium">Total Amount:</span> ${completedOrder.total_amount.toFixed(2)}
                        </p>
                        <p className="text-gray-700">
                          <span className="font-medium">Estimated Delivery:</span> {selectedShippingMethod?.transit_time || '5-7 business days'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center space-y-4">
                      <Link
                        to={`/account/orders/${completedOrder.uid}`}
                        className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        View Order Details
                      </Link>
                      
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => window.print()}
                      >
                        Print Receipt
                      </button>
                      
                      <Link
                        to="/"
                        className="text-gray-600 hover:text-gray-800"
                      >
                        Continue Shopping
                      </Link>
                    </div>
                    
                    {/* For guest users, show account creation prompt */}
                    {!isAuthenticated && (
                      <div className="mt-8 p-4 bg-blue-50 rounded-md">
                        <h3 className="font-medium text-lg mb-2">Create an Account</h3>
                        <p className="text-gray-700 mb-3">
                          Create an account to track your orders and enjoy a faster checkout experience next time.
                        </p>
                        <button
                          type="button"
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          onClick={() => {
                            // Navigate back to home and show auth modal
                            navigate('/', { state: { showAuthModal: true } });
                          }}
                        >
                          Create Account
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Navigation Buttons */}
              {checkoutStep !== 'confirmation' && (
                <div className="flex justify-between mt-6">
                  {checkoutStep !== 'shipping' ? (
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={handlePreviousStep}
                    >
                      Back
                    </button>
                  ) : (
                    <Link
                      to="/cart"
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Return to Cart
                    </Link>
                  )}
                  
                  {checkoutStep === 'review' ? (
                    <button
                      type="button"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center"
                      onClick={placeOrder}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>Place Order</>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={handleNextStep}
                    >
                      Next
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Order Summary Sidebar */}
            <div className="lg:w-1/3">
              <div className="bg-white rounded-lg shadow-md overflow-hidden sticky top-8">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                  
                  <div className="mb-4">
                    <div className="text-gray-600 mb-2">{cartSummary.itemCount} {cartSummary.itemCount === 1 ? 'item' : 'items'}</div>
                    
                    {/* Mobile view - show/hide items toggle */}
                    <div className="lg:hidden mb-3">
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                        onClick={() => document.getElementById('mobile-cart-items')?.classList.toggle('hidden')}
                      >
                        <span>Show/hide items</span>
                        <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Cart Items - Always visible on desktop, toggleable on mobile */}
                    <div id="mobile-cart-items" className="hidden lg:block space-y-3 mb-4 max-h-64 overflow-y-auto">
                      {items.map(item => (
                        <div key={`summary-${item.uid}`} className="flex">
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                            {item.primaryImageUrl ? (
                              <img
                                src={item.primaryImageUrl}
                                alt={item.productName}
                                className="h-full w-full object-cover object-center"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-3 flex flex-1 flex-col">
                            <div>
                              <div className="flex justify-between text-sm font-medium text-gray-900">
                                <h3 className="truncate max-w-[120px]">{item.productName}</h3>
                                <p className="ml-1">${(item.priceSnapshot * item.quantity).toFixed(2)}</p>
                              </div>
                              {item.variantInfo && (
                                <p className="mt-1 text-xs text-gray-500">{item.variantInfo}</p>
                              )}
                            </div>
                            <div className="flex flex-1 items-end justify-between text-xs text-gray-500">
                              <p>Qty {item.quantity}</p>
                              <p>${item.priceSnapshot.toFixed(2)} each</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>${cartSummary.subtotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span>${cartSummary.shippingAmount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-gray-600">
                      <span>Tax</span>
                      <span>${cartSummary.taxAmount.toFixed(2)}</span>
                    </div>
                    
                    {cartSummary.discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-${cartSummary.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-200 mt-4 pt-4">
                    <div className="flex justify-between font-medium text-lg">
                      <span>Total</span>
                      <span>${cartSummary.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* Security and Guarantees */}
                  <div className="mt-6 space-y-3 text-sm text-gray-600">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                      </svg>
                      <span>Secure checkout</span>
                    </div>
                    
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                      </svg>
                      <span>Satisfaction guaranteed</span>
                    </div>
                    
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      <span>Need help? <Link to="/help" className="text-blue-600 hover:text-blue-800">Contact support</Link></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Checkout;