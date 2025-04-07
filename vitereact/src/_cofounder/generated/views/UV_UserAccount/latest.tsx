import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { useAppSelector } from "@/store/main";

const UV_UserAccount: React.FC = () => {
  // Get current location to determine active section from URL
  const location = useLocation();
  const currentPath = location.pathname;

  // Extract section from path or default to profile
  let initialSection = "profile";
  if (currentPath.includes("/account/addresses")) initialSection = "addresses";
  if (currentPath.includes("/account/payment-methods")) initialSection = "payment-methods";
  if (currentPath.includes("/account/communication-preferences")) initialSection = "communication-preferences";

  // State management
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [communicationPreferences, setCommunicationPreferences] = useState<any>({
    emailNotifications: {
      orders: true,
      promotions: true,
      productUpdates: true,
      accountAlerts: true
    },
    smsNotifications: {
      orders: false,
      promotions: false,
      accountAlerts: true
    },
    marketingPreferences: {
      email: true,
      sms: false,
      thirdParty: false
    }
  });
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPasswordForm, setShowPasswordForm] = useState<boolean>(false);
  const [showAddressForm, setShowAddressForm] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get auth state from Redux
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  // Helper function to show success message
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage("");
    setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  };

  // Helper function to show error message
  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage("");
    setTimeout(() => {
      setErrorMessage("");
    }, 5000);
  };

  // Fetch user profile data
  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/users/profile');
      
      if (response.data.success) {
        const userData = response.data.user;
        setUserProfile(userData);
        
        // Initialize form data with user information
        setFormData({
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          email: userData.email || "",
          phoneNumber: userData.phoneNumber || "",
        });
        
        // Set company profile if it exists
        if (userData.company) {
          setCompanyProfile(userData.company);
          // Add company data to form
          setFormData(prevFormData => ({
            ...prevFormData,
            companyName: userData.company.name || "",
            companyWebsite: userData.company.website || "",
            companyDescription: userData.company.description || "",
            companyIndustry: userData.company.industry || "",
            companyEstablishedYear: userData.company.establishedYear || "",
          }));
        }
        
        // Set communication preferences if available
        if (userData.communicationPreferences) {
          setCommunicationPreferences(userData.communicationPreferences);
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      showError("Failed to load your profile information. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user addresses
  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/users/addresses');
      
      if (response.data.success) {
        setAddresses(response.data.addresses);
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
      showError("Failed to load your addresses. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user payment methods
  const fetchPaymentMethods = async () => {
    try {
      setIsLoading(true);
      // Note: This endpoint is not explicitly defined in the server code
      // This is a placeholder that would need to be implemented on the backend
      const response = await axios.get('/api/users/payment-methods');
      
      if (response.data.success) {
        setPaymentMethods(response.data.paymentMethods);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      showError("Failed to load your payment methods. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle section change
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setFormErrors({});
    setSuccessMessage("");
    setErrorMessage("");
    
    // Reset form states
    setShowPasswordForm(false);
    setShowAddressForm(false);
    setEditingAddress(null);
    setShowPaymentForm(false);
    setEditingPayment(null);
    
    // Fetch section-specific data
    switch (section) {
      case "addresses":
        fetchAddresses();
        break;
      case "payment-methods":
        fetchPaymentMethods();
        break;
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ""
      });
    }
  };

  // Handle checkbox input changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    // Handle nested properties (for communication preferences)
    if (name.includes('.')) {
      const [section, subsection, setting] = name.split('.');
      setCommunicationPreferences({
        ...communicationPreferences,
        [section]: {
          ...communicationPreferences[section],
          [subsection]: {
            ...communicationPreferences[section][subsection],
            [setting]: checked
          }
        }
      });
    } else {
      // For simple checkboxes
      setFormData({
        ...formData,
        [name]: checked
      });
    }
  };

  // Validate profile form
  const validateProfileForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.firstName) errors.firstName = "First name is required";
    if (!formData.lastName) errors.lastName = "Last name is required";
    if (!formData.email) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = "Please enter a valid email address";
    
    // Company validation (if user is a business account)
    if (companyProfile) {
      if (!formData.companyName) errors.companyName = "Company name is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate password form
  const validatePasswordForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.currentPassword) {
      errors.currentPassword = "Current password is required";
    }
    
    if (!formData.newPassword) {
      errors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters";
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate address form
  const validateAddressForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.address_type) errors.address_type = "Address type is required";
    if (!formData.recipient_name) errors.recipient_name = "Recipient name is required";
    if (!formData.street_address_1) errors.street_address_1 = "Street address is required";
    if (!formData.city) errors.city = "City is required";
    if (!formData.state_province) errors.state_province = "State/Province is required";
    if (!formData.postal_code) errors.postal_code = "Postal code is required";
    if (!formData.country) errors.country = "Country is required";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate payment method form
  const validatePaymentForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.card_number) errors.card_number = "Card number is required";
    else if (!/^\d{16}$/.test(formData.card_number.replace(/\s/g, ''))) 
      errors.card_number = "Please enter a valid 16-digit card number";
    
    if (!formData.card_holder_name) errors.card_holder_name = "Cardholder name is required";
    if (!formData.expiry_date) errors.expiry_date = "Expiry date is required";
    else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(formData.expiry_date)) 
      errors.expiry_date = "Please use format MM/YY";
    
    if (!formData.cvv) errors.cvv = "Security code is required";
    else if (!/^\d{3,4}$/.test(formData.cvv)) errors.cvv = "Please enter a valid security code";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProfileForm()) return;
    
    try {
      setIsSaving(true);
      
      // Prepare data for API
      const profileData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber,
        profile_picture_url: userProfile?.profilePictureUrl
      };
      
      // Update user profile
      const response = await axios.put('/api/users/profile', profileData);
      
      // Update company profile if applicable
      if (companyProfile) {
        const companyData = {
          name: formData.companyName,
          description: formData.companyDescription,
          website: formData.companyWebsite,
          industry: formData.companyIndustry,
          established_year: formData.companyEstablishedYear ? parseInt(formData.companyEstablishedYear) : null
        };
        
        await axios.put('/api/companies/profile', companyData);
      }
      
      // Fetch updated profile data
      await fetchUserProfile();
      
      showSuccess("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      showError("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError("File size exceeds 5MB limit");
      return;
    }
    
    // Check file type
    if (!file.type.match('image.*')) {
      showError("Please select an image file");
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Create form data for file upload
      const formData = new FormData();
      formData.append('profile_picture', file);
      
      // Upload the file
      // Note: This endpoint is not explicitly defined in the server code
      // This is a placeholder that would need to be implemented on the backend
      const uploadResponse = await axios.post('/api/users/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (uploadResponse.data.success) {
        // Update profile with new image URL
        const profileData = {
          profile_picture_url: uploadResponse.data.image_url
        };
        
        await axios.put('/api/users/profile', profileData);
        
        // Refresh user profile
        await fetchUserProfile();
        
        showSuccess("Profile picture updated successfully");
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      showError("Failed to upload profile picture. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) return;
    
    try {
      setIsSaving(true);
      
      // Note: This endpoint is not explicitly defined in the server code
      // This is a placeholder that would need to be implemented on the backend
      const response = await axios.post('/api/users/change-password', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
        confirm_password: formData.confirmPassword
      });
      
      if (response.data.success) {
        // Reset password form
        setFormData({
          ...formData,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
        
        setShowPasswordForm(false);
        showSuccess("Password changed successfully");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setFormErrors({
          ...formErrors,
          currentPassword: "Current password is incorrect"
        });
      } else {
        showError("Failed to change password. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize address form for new address
  const initAddressForm = () => {
    setFormData({
      address_type: "home",
      name: "",
      recipient_name: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : "",
      street_address_1: "",
      street_address_2: "",
      city: "",
      state_province: "",
      postal_code: "",
      country: "USA",
      phone_number: userProfile?.phoneNumber || "",
      is_default_shipping: addresses.length === 0,
      is_default_billing: addresses.length === 0,
      special_instructions: ""
    });
    setShowAddressForm(true);
    setEditingAddress(null);
  };

  // Initialize address form for editing
  const initEditAddressForm = (address: any) => {
    setFormData({
      address_type: address.address_type,
      name: address.name || "",
      recipient_name: address.recipient_name,
      street_address_1: address.street_address_1,
      street_address_2: address.street_address_2 || "",
      city: address.city,
      state_province: address.state_province,
      postal_code: address.postal_code,
      country: address.country,
      phone_number: address.phone_number || "",
      is_default_shipping: address.is_default_shipping,
      is_default_billing: address.is_default_billing,
      special_instructions: address.special_instructions || ""
    });
    setShowAddressForm(true);
    setEditingAddress(address.uid);
  };

  // Handle address submission (add/edit)
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAddressForm()) return;
    
    try {
      setIsSaving(true);
      
      if (editingAddress) {
        // Update existing address
        const response = await axios.put(`/api/users/addresses/${editingAddress}`, formData);
        
        if (response.data.success) {
          showSuccess("Address updated successfully");
        }
      } else {
        // Add new address
        const response = await axios.post('/api/users/addresses', formData);
        
        if (response.data.success) {
          showSuccess("Address added successfully");
        }
      }
      
      // Refresh addresses
      await fetchAddresses();
      
      // Reset form
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (error) {
      console.error("Error saving address:", error);
      showError("Failed to save address. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle address deletion
  const handleDeleteAddress = async (addressUid: string) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.delete(`/api/users/addresses/${addressUid}`);
      
      if (response.data.success) {
        // Remove from local state
        setAddresses(addresses.filter(address => address.uid !== addressUid));
        showSuccess("Address deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting address:", error);
      showError("Failed to delete address. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle setting default address
  const handleSetDefaultAddress = async (addressUid: string, type: 'shipping' | 'billing') => {
    try {
      setIsLoading(true);
      
      const fieldName = type === 'shipping' ? 'is_default_shipping' : 'is_default_billing';
      
      const response = await axios.put(`/api/users/addresses/${addressUid}`, {
        [fieldName]: true
      });
      
      if (response.data.success) {
        // Update local state
        const updatedAddresses = addresses.map(address => ({
          ...address,
          [fieldName]: address.uid === addressUid
        }));
        
        setAddresses(updatedAddresses);
        showSuccess(`Default ${type} address updated successfully`);
      }
    } catch (error) {
      console.error(`Error setting default ${type} address:`, error);
      showError(`Failed to update default ${type} address. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize payment method form
  const initPaymentForm = () => {
    setFormData({
      payment_type: "credit_card",
      card_number: "",
      card_holder_name: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : "",
      expiry_date: "",
      cvv: "",
      is_default: paymentMethods.length === 0,
      billing_address_uid: ""
    });
    setShowPaymentForm(true);
    setEditingPayment(null);
  };

  // Initialize payment form for editing
  const initEditPaymentForm = (payment: any) => {
    setFormData({
      payment_type: payment.payment_type,
      card_number: payment.card_number,
      card_holder_name: payment.card_holder_name,
      expiry_date: payment.expiry_date,
      cvv: "",
      is_default: payment.is_default,
      billing_address_uid: payment.billing_address_uid
    });
    setShowPaymentForm(true);
    setEditingPayment(payment.uid);
  };

  // Handle payment method submission
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePaymentForm()) return;
    
    try {
      setIsSaving(true);
      
      // Note: These endpoints are not explicitly defined in the server code
      // These are placeholders that would need to be implemented on the backend
      if (editingPayment) {
        // Update existing payment method
        const response = await axios.put(`/api/users/payment-methods/${editingPayment}`, formData);
        
        if (response.data.success) {
          showSuccess("Payment method updated successfully");
        }
      } else {
        // Add new payment method
        const response = await axios.post('/api/users/payment-methods', formData);
        
        if (response.data.success) {
          showSuccess("Payment method added successfully");
        }
      }
      
      // Refresh payment methods
      await fetchPaymentMethods();
      
      // Reset form
      setShowPaymentForm(false);
      setEditingPayment(null);
    } catch (error) {
      console.error("Error saving payment method:", error);
      showError("Failed to save payment method. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle payment method deletion
  const handleDeletePayment = async (paymentUid: string) => {
    if (!window.confirm("Are you sure you want to delete this payment method?")) return;
    
    try {
      setIsLoading(true);
      
      // Note: This endpoint is not explicitly defined in the server code
      // This is a placeholder that would need to be implemented on the backend
      const response = await axios.delete(`/api/users/payment-methods/${paymentUid}`);
      
      if (response.data.success) {
        // Remove from local state
        setPaymentMethods(paymentMethods.filter(payment => payment.uid !== paymentUid));
        showSuccess("Payment method deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting payment method:", error);
      showError("Failed to delete payment method. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle setting default payment method
  const handleSetDefaultPayment = async (paymentUid: string) => {
    try {
      setIsLoading(true);
      
      // Note: This endpoint is not explicitly defined in the server code
      // This is a placeholder that would need to be implemented on the backend
      const response = await axios.put(`/api/users/payment-methods/${paymentUid}`, {
        is_default: true
      });
      
      if (response.data.success) {
        // Update local state
        const updatedPaymentMethods = paymentMethods.map(payment => ({
          ...payment,
          is_default: payment.uid === paymentUid
        }));
        
        setPaymentMethods(updatedPaymentMethods);
        showSuccess("Default payment method updated successfully");
      }
    } catch (error) {
      console.error("Error setting default payment method:", error);
      showError("Failed to update default payment method. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle communication preferences update
  const handleUpdateCommunicationPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      // Update user profile with communication preferences
      const response = await axios.put('/api/users/profile', {
        communication_preferences: communicationPreferences
      });
      
      if (response.data.success) {
        showSuccess("Communication preferences updated successfully");
      }
    } catch (error) {
      console.error("Error updating communication preferences:", error);
      showError("Failed to update communication preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch user profile on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserProfile();
    }
  }, [isAuthenticated]);

  // Fetch section data when active section changes
  useEffect(() => {
    if (isAuthenticated) {
      switch (activeSection) {
        case "addresses":
          fetchAddresses();
          break;
        case "payment-methods":
          fetchPaymentMethods();
          break;
      }
    }
  }, [activeSection, isAuthenticated]);

  // Format credit card number display
  const formatCardNumber = (cardNumber: string) => {
    if (!cardNumber) return "";
    // Show only last 4 digits
    return `•••• •••• •••• ${cardNumber.slice(-4)}`;
  };

  // Render card icon based on card number
  const getCardIcon = (cardNumber: string) => {
    // Very simple detection logic (in a real app would be more robust)
    const firstDigit = cardNumber.charAt(0);
    
    switch (firstDigit) {
      case "4":
        return "fab fa-cc-visa";
      case "5":
        return "fab fa-cc-mastercard";
      case "3":
        return "fab fa-cc-amex";
      case "6":
        return "fab fa-cc-discover";
      default:
        return "far fa-credit-card";
    }
  };

  // Return component JSX
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>
        
        {/* Success and Error Messages */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}
        
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="w-full md:w-1/4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => handleSectionChange("profile")}
                  className={`w-full text-left px-4 py-2 rounded-md ${
                    activeSection === "profile" 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-100"
                  }`}
                >
                  <i className="far fa-user mr-2"></i> Profile Information
                </button>
                
                <button
                  onClick={() => handleSectionChange("addresses")}
                  className={`w-full text-left px-4 py-2 rounded-md ${
                    activeSection === "addresses" 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-100"
                  }`}
                >
                  <i className="far fa-map mr-2"></i> Addresses
                </button>
                
                <button
                  onClick={() => handleSectionChange("payment-methods")}
                  className={`w-full text-left px-4 py-2 rounded-md ${
                    activeSection === "payment-methods" 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-100"
                  }`}
                >
                  <i className="far fa-credit-card mr-2"></i> Payment Methods
                </button>
                
                <button
                  onClick={() => handleSectionChange("communication-preferences")}
                  className={`w-full text-left px-4 py-2 rounded-md ${
                    activeSection === "communication-preferences" 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-100"
                  }`}
                >
                  <i className="far fa-bell mr-2"></i> Communication Preferences
                </button>
                
                <Link
                  to="/account/orders"
                  className="block px-4 py-2 rounded-md hover:bg-gray-100"
                >
                  <i className="far fa-clipboard mr-2"></i> Orders & Returns
                </Link>
                
                <Link
                  to="/account/wishlists"
                  className="block px-4 py-2 rounded-md hover:bg-gray-100"
                >
                  <i className="far fa-heart mr-2"></i> Wishlists & Saved Items
                </Link>
                
                {/* Conditional links based on user type */}
                {user?.userType === "professional_buyer" && (
                  <button
                    onClick={() => handleSectionChange("projects")}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeSection === "projects" 
                        ? "bg-blue-500 text-white" 
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <i className="far fa-building mr-2"></i> Projects & Teams
                  </button>
                )}
                
                {(user?.userType === "vendor_admin" || user?.userType === "seller") && (
                  <Link
                    to="/seller"
                    className="block px-4 py-2 rounded-md hover:bg-gray-100"
                  >
                    <i className="far fa-store mr-2"></i> Seller Dashboard
                  </Link>
                )}
              </nav>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="w-full md:w-3/4">
            <div className="bg-white rounded-lg shadow-md p-6">
              {isLoading && (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              )}
              
              {!isLoading && (
                <>
                  {/* Profile Information Section */}
                  {activeSection === "profile" && (
                    <div>
                      <h2 className="text-2xl font-semibold mb-6">Profile Information</h2>
                      
                      {/* Profile Picture */}
                      <div className="mb-8 flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                            {userProfile?.profilePictureUrl ? (
                              <img 
                                src={userProfile.profilePictureUrl} 
                                alt="Profile" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                <i className="fas fa-user text-3xl"></i>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 shadow-md hover:bg-blue-600"
                            aria-label="Upload profile picture"
                          >
                            <i className="fas fa-camera text-xs"></i>
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleProfilePictureUpload}
                          />
                        </div>
                        <div>
                          <h3 className="text-xl font-medium">
                            {userProfile?.firstName} {userProfile?.lastName}
                          </h3>
                          <p className="text-gray-600">{userProfile?.email}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Account Type: {userProfile?.userType === "professional_buyer" 
                              ? "Business Account" 
                              : userProfile?.userType === "vendor_admin" 
                                ? "Seller Account" 
                                : "Individual Account"
                            }
                          </p>
                          <p className="text-sm text-gray-500">
                            Member since {userProfile?.createdAt 
                              ? new Date(userProfile.createdAt).toLocaleDateString() 
                              : "N/A"
                            }
                          </p>
                        </div>
                      </div>
                      
                      {/* Profile Form */}
                      <form onSubmit={handleProfileUpdate}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                              First Name*
                            </label>
                            <input
                              type="text"
                              id="firstName"
                              name="firstName"
                              value={formData.firstName || ""}
                              onChange={handleInputChange}
                              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.firstName ? "border-red-500" : "border-gray-300"
                              }`}
                            />
                            {formErrors.firstName && (
                              <p className="mt-1 text-sm text-red-500">{formErrors.firstName}</p>
                            )}
                          </div>
                          
                          <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                              Last Name*
                            </label>
                            <input
                              type="text"
                              id="lastName"
                              name="lastName"
                              value={formData.lastName || ""}
                              onChange={handleInputChange}
                              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.lastName ? "border-red-500" : "border-gray-300"
                              }`}
                            />
                            {formErrors.lastName && (
                              <p className="mt-1 text-sm text-red-500">{formErrors.lastName}</p>
                            )}
                          </div>
                          
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                              Email Address*
                            </label>
                            <input
                              type="email"
                              id="email"
                              name="email"
                              value={formData.email || ""}
                              onChange={handleInputChange}
                              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.email ? "border-red-500" : "border-gray-300"
                              }`}
                              disabled={true} // Email shouldn't be changeable without verification
                            />
                            {formErrors.email && (
                              <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
                            )}
                          </div>
                          
                          <div>
                            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              id="phoneNumber"
                              name="phoneNumber"
                              value={formData.phoneNumber || ""}
                              onChange={handleInputChange}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="(123) 456-7890"
                            />
                          </div>
                        </div>
                        
                        {/* Company information (if applicable) */}
                        {companyProfile && (
                          <>
                            <h3 className="text-xl font-semibold mb-4 mt-8">Company Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              <div>
                                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                                  Company Name*
                                </label>
                                <input
                                  type="text"
                                  id="companyName"
                                  name="companyName"
                                  value={formData.companyName || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.companyName ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.companyName && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.companyName}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                                  Website
                                </label>
                                <input
                                  type="url"
                                  id="companyWebsite"
                                  name="companyWebsite"
                                  value={formData.companyWebsite || ""}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="https://example.com"
                                />
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="companyDescription" className="block text-sm font-medium text-gray-700 mb-1">
                                  Company Description
                                </label>
                                <textarea
                                  id="companyDescription"
                                  name="companyDescription"
                                  value={formData.companyDescription || ""}
                                  onChange={handleInputChange}
                                  rows={3}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                ></textarea>
                              </div>
                              
                              <div>
                                <label htmlFor="companyIndustry" className="block text-sm font-medium text-gray-700 mb-1">
                                  Industry
                                </label>
                                <select
                                  id="companyIndustry"
                                  name="companyIndustry"
                                  value={formData.companyIndustry || ""}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Industry</option>
                                  <option value="construction">Construction</option>
                                  <option value="architecture">Architecture</option>
                                  <option value="engineering">Engineering</option>
                                  <option value="interior_design">Interior Design</option>
                                  <option value="real_estate">Real Estate</option>
                                  <option value="manufacturing">Manufacturing</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              
                              <div>
                                <label htmlFor="companyEstablishedYear" className="block text-sm font-medium text-gray-700 mb-1">
                                  Year Established
                                </label>
                                <input
                                  type="number"
                                  id="companyEstablishedYear"
                                  name="companyEstablishedYear"
                                  value={formData.companyEstablishedYear || ""}
                                  onChange={handleInputChange}
                                  min="1900"
                                  max={new Date().getFullYear()}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </>
                        )}
                        
                        <div className="flex justify-between mt-8">
                          <button
                            type="button"
                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <i className="fas fa-key mr-2"></i>
                            Change Password
                          </button>
                          
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                              <>
                                <i className="fas fa-save mr-2"></i>
                                Save Changes
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                      
                      {/* Password Change Form */}
                      {showPasswordForm && (
                        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                          <h3 className="text-lg font-medium mb-4">Change Password</h3>
                          <form onSubmit={handlePasswordChange}>
                            <div className="space-y-4">
                              <div>
                                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                  Current Password*
                                </label>
                                <input
                                  type="password"
                                  id="currentPassword"
                                  name="currentPassword"
                                  value={formData.currentPassword || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.currentPassword ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.currentPassword && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.currentPassword}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                  New Password*
                                </label>
                                <input
                                  type="password"
                                  id="newPassword"
                                  name="newPassword"
                                  value={formData.newPassword || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.newPassword ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.newPassword && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.newPassword}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                  Confirm New Password*
                                </label>
                                <input
                                  type="password"
                                  id="confirmPassword"
                                  name="confirmPassword"
                                  value={formData.confirmPassword || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.confirmPassword ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.confirmPassword && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.confirmPassword}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-4 flex justify-end space-x-3">
                              <button
                                type="button"
                                onClick={() => setShowPasswordForm(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                Cancel
                              </button>
                              
                              <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                {isSaving ? "Updating..." : "Update Password"}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Addresses Section */}
                  {activeSection === "addresses" && (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold">My Addresses</h2>
                        <button
                          onClick={initAddressForm}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <i className="fas fa-plus mr-2"></i>
                          Add New Address
                        </button>
                      </div>
                      
                      {addresses.length === 0 ? (
                        <div className="bg-gray-50 p-6 text-center rounded-lg">
                          <i className="fas fa-map-marker-alt text-gray-400 text-4xl mb-3"></i>
                          <p className="text-gray-600">You don't have any saved addresses yet.</p>
                          <button
                            onClick={initAddressForm}
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <i className="fas fa-plus mr-2"></i>
                            Add an Address
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {addresses.map((address) => (
                            <div key={address.uid} className="border rounded-lg p-4 relative">
                              {/* Address Type Badge */}
                              <div className="absolute right-2 top-2 bg-gray-100 px-2 py-1 rounded text-xs font-medium text-gray-600">
                                {address.address_type === "home" ? "Home" : 
                                 address.address_type === "work" ? "Work" : 
                                 address.address_type === "jobsite" ? "Job Site" : "Other"}
                              </div>
                              
                              {/* Address Name */}
                              {address.name && (
                                <p className="text-sm font-medium text-gray-500 mb-1">{address.name}</p>
                              )}
                              
                              {/* Recipient */}
                              <p className="font-medium mb-1">{address.recipient_name}</p>
                              
                              {/* Address Details */}
                              <p className="text-gray-600 text-sm">
                                {address.street_address_1}
                                {address.street_address_2 && `, ${address.street_address_2}`}
                              </p>
                              <p className="text-gray-600 text-sm">
                                {address.city}, {address.state_province} {address.postal_code}
                              </p>
                              <p className="text-gray-600 text-sm mb-3">{address.country}</p>
                              
                              {/* Phone Number */}
                              {address.phone_number && (
                                <p className="text-gray-600 text-sm mb-3">
                                  <i className="fas fa-phone-alt mr-1 text-gray-400"></i> {address.phone_number}
                                </p>
                              )}
                              
                              {/* Default Address Tags */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                {address.is_default_shipping && (
                                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                    Default Shipping
                                  </span>
                                )}
                                
                                {address.is_default_billing && (
                                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                    Default Billing
                                  </span>
                                )}
                                
                                {address.special_instructions && (
                                  <div className="w-full mt-2">
                                    <p className="text-gray-500 text-xs font-medium">SPECIAL INSTRUCTIONS:</p>
                                    <p className="text-gray-600 text-xs italic">{address.special_instructions}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Address Actions */}
                              <div className="flex flex-wrap justify-between mt-4 pt-3 border-t border-gray-200">
                                <div className="space-x-1">
                                  <button
                                    onClick={() => handleSetDefaultAddress(address.uid, 'shipping')}
                                    disabled={address.is_default_shipping}
                                    className={`px-2 py-1 rounded text-xs ${
                                      address.is_default_shipping
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                    }`}
                                  >
                                    Set as Shipping
                                  </button>
                                  
                                  <button
                                    onClick={() => handleSetDefaultAddress(address.uid, 'billing')}
                                    disabled={address.is_default_billing}
                                    className={`px-2 py-1 rounded text-xs ${
                                      address.is_default_billing 
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-green-50 text-green-600 hover:bg-green-100"
                                    }`}
                                  >
                                    Set as Billing
                                  </button>
                                </div>
                                
                                <div className="space-x-1">
                                  <button
                                    onClick={() => initEditAddressForm(address)}
                                    className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  >
                                    <i className="fas fa-edit mr-1"></i>
                                    Edit
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDeleteAddress(address.uid)}
                                    className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100"
                                  >
                                    <i className="fas fa-trash-alt mr-1"></i>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Add/Edit Address Form */}
                      {showAddressForm && (
                        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                          <h3 className="text-lg font-medium mb-4">
                            {editingAddress ? "Edit Address" : "Add New Address"}
                          </h3>
                          <form onSubmit={handleAddressSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="address_type" className="block text-sm font-medium text-gray-700 mb-1">
                                  Address Type*
                                </label>
                                <select
                                  id="address_type"
                                  name="address_type"
                                  value={formData.address_type || "home"}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.address_type ? "border-red-500" : "border-gray-300"
                                  }`}
                                >
                                  <option value="home">Home</option>
                                  <option value="work">Work</option>
                                  {user?.userType === "professional_buyer" && (
                                    <option value="jobsite">Job Site</option>
                                  )}
                                  <option value="other">Other</option>
                                </select>
                                {formErrors.address_type && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.address_type}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                  Address Nickname (optional)
                                </label>
                                <input
                                  type="text"
                                  id="name"
                                  name="name"
                                  value={formData.name || ""}
                                  onChange={handleInputChange}
                                  placeholder="e.g., My Home, Downtown Office"
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="recipient_name" className="block text-sm font-medium text-gray-700 mb-1">
                                  Recipient Name*
                                </label>
                                <input
                                  type="text"
                                  id="recipient_name"
                                  name="recipient_name"
                                  value={formData.recipient_name || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.recipient_name ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.recipient_name && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.recipient_name}</p>
                                )}
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="street_address_1" className="block text-sm font-medium text-gray-700 mb-1">
                                  Street Address*
                                </label>
                                <input
                                  type="text"
                                  id="street_address_1"
                                  name="street_address_1"
                                  value={formData.street_address_1 || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.street_address_1 ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.street_address_1 && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.street_address_1}</p>
                                )}
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="street_address_2" className="block text-sm font-medium text-gray-700 mb-1">
                                  Apt, Suite, Unit (optional)
                                </label>
                                <input
                                  type="text"
                                  id="street_address_2"
                                  name="street_address_2"
                                  value={formData.street_address_2 || ""}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              
                              <div>
                                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                                  City*
                                </label>
                                <input
                                  type="text"
                                  id="city"
                                  name="city"
                                  value={formData.city || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.city ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.city && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.city}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="state_province" className="block text-sm font-medium text-gray-700 mb-1">
                                  State/Province*
                                </label>
                                <input
                                  type="text"
                                  id="state_province"
                                  name="state_province"
                                  value={formData.state_province || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.state_province ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.state_province && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.state_province}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-1">
                                  Postal/ZIP Code*
                                </label>
                                <input
                                  type="text"
                                  id="postal_code"
                                  name="postal_code"
                                  value={formData.postal_code || ""}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.postal_code ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.postal_code && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.postal_code}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                                  Country*
                                </label>
                                <select
                                  id="country"
                                  name="country"
                                  value={formData.country || "USA"}
                                  onChange={handleInputChange}
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.country ? "border-red-500" : "border-gray-300"
                                  }`}
                                >
                                  <option value="USA">United States</option>
                                  <option value="CAN">Canada</option>
                                  <option value="MEX">Mexico</option>
                                  {/* Add more countries as needed */}
                                </select>
                                {formErrors.country && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.country}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                                  Phone Number
                                </label>
                                <input
                                  type="tel"
                                  id="phone_number"
                                  name="phone_number"
                                  value={formData.phone_number || ""}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="(123) 456-7890"
                                />
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="special_instructions" className="block text-sm font-medium text-gray-700 mb-1">
                                  Special Delivery Instructions (optional)
                                </label>
                                <textarea
                                  id="special_instructions"
                                  name="special_instructions"
                                  value={formData.special_instructions || ""}
                                  onChange={handleInputChange}
                                  rows={3}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="E.g., Gate code, delivery hours, etc."
                                ></textarea>
                              </div>
                              
                              <div>
                                <div className="flex items-center">
                                  <input
                                    id="is_default_shipping"
                                    name="is_default_shipping"
                                    type="checkbox"
                                    checked={formData.is_default_shipping || false}
                                    onChange={handleCheckboxChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label htmlFor="is_default_shipping" className="ml-2 block text-sm text-gray-700">
                                    Set as default shipping address
                                  </label>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center">
                                  <input
                                    id="is_default_billing"
                                    name="is_default_billing"
                                    type="checkbox"
                                    checked={formData.is_default_billing || false}
                                    onChange={handleCheckboxChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label htmlFor="is_default_billing" className="ml-2 block text-sm text-gray-700">
                                    Set as default billing address
                                  </label>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end space-x-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddressForm(false);
                                  setEditingAddress(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                Cancel
                              </button>
                              
                              <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                {isSaving ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                  </>
                                ) : (
                                  <>Save Address</>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Payment Methods Section */}
                  {activeSection === "payment-methods" && (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold">Payment Methods</h2>
                        <button
                          onClick={initPaymentForm}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <i className="fas fa-plus mr-2"></i>
                          Add Payment Method
                        </button>
                      </div>
                      
                      {paymentMethods.length === 0 ? (
                        <div className="bg-gray-50 p-6 text-center rounded-lg">
                          <i className="fas fa-credit-card text-gray-400 text-4xl mb-3"></i>
                          <p className="text-gray-600">You don't have any saved payment methods yet.</p>
                          <button
                            onClick={initPaymentForm}
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <i className="fas fa-plus mr-2"></i>
                            Add Payment Method
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {paymentMethods.map((payment) => (
                            <div key={payment.uid} className="border rounded-lg p-4 relative">
                              {/* Card Type Icon */}
                              <div className="absolute right-2 top-2">
                                <i className={`${getCardIcon(payment.card_number)} text-gray-600 text-xl`}></i>
                              </div>
                              
                              {/* Card Holder Name */}
                              <p className="font-medium mb-1">{payment.card_holder_name}</p>
                              
                              {/* Card Number */}
                              <p className="text-gray-600 text-sm">
                                {formatCardNumber(payment.card_number)}
                              </p>
                              
                              {/* Expiry */}
                              <p className="text-gray-600 text-sm mb-3">
                                Expires: {payment.expiry_date}
                              </p>
                              
                              {/* Default Tag */}
                              {payment.is_default && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                  Default Payment Method
                                </span>
                              )}
                              
                              {/* Actions */}
                              <div className="flex justify-between mt-4 pt-3 border-t border-gray-200">
                                <button
                                  onClick={() => handleSetDefaultPayment(payment.uid)}
                                  disabled={payment.is_default}
                                  className={`px-3 py-1 rounded text-xs ${
                                    payment.is_default 
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                  }`}
                                >
                                  {payment.is_default ? "Default Method" : "Set as Default"}
                                </button>
                                
                                <div className="space-x-2">
                                  <button
                                    onClick={() => initEditPaymentForm(payment)}
                                    className="px-3 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  >
                                    <i className="fas fa-edit mr-1"></i>
                                    Edit
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDeletePayment(payment.uid)}
                                    className="px-3 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100"
                                  >
                                    <i className="fas fa-trash-alt mr-1"></i>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Add/Edit Payment Method Form */}
                      {showPaymentForm && (
                        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                          <h3 className="text-lg font-medium mb-4">
                            {editingPayment ? "Edit Payment Method" : "Add New Payment Method"}
                          </h3>
                          <form onSubmit={handlePaymentSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                <label htmlFor="payment_type" className="block text-sm font-medium text-gray-700 mb-1">
                                  Payment Type
                                </label>
                                <select
                                  id="payment_type"
                                  name="payment_type"
                                  value={formData.payment_type || "credit_card"}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="credit_card">Credit Card</option>
                                  <option value="debit_card">Debit Card</option>
                                </select>
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="card_number" className="block text-sm font-medium text-gray-700 mb-1">
                                  Card Number*
                                </label>
                                <input
                                  type="text"
                                  id="card_number"
                                  name="card_number"
                                  value={formData.card_number || ""}
                                  onChange={handleInputChange}
                                  placeholder="1234 5678 9012 3456"
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.card_number ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.card_number && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.card_number}</p>
                                )}
                              </div>
                              
                              <div className="md:col-span-2">
                                <label htmlFor="card_holder_name" className="block text-sm font-medium text-gray-700 mb-1">
                                  Cardholder Name*
                                </label>
                                <input
                                  type="text"
                                  id="card_holder_name"
                                  name="card_holder_name"
                                  value={formData.card_holder_name || ""}
                                  onChange={handleInputChange}
                                  placeholder="John Smith"
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.card_holder_name ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.card_holder_name && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.card_holder_name}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 mb-1">
                                  Expiry Date (MM/YY)*
                                </label>
                                <input
                                  type="text"
                                  id="expiry_date"
                                  name="expiry_date"
                                  value={formData.expiry_date || ""}
                                  onChange={handleInputChange}
                                  placeholder="MM/YY"
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.expiry_date ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.expiry_date && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.expiry_date}</p>
                                )}
                              </div>
                              
                              <div>
                                <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                                  Security Code (CVV)*
                                </label>
                                <input
                                  type="text"
                                  id="cvv"
                                  name="cvv"
                                  value={formData.cvv || ""}
                                  onChange={handleInputChange}
                                  placeholder="123"
                                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    formErrors.cvv ? "border-red-500" : "border-gray-300"
                                  }`}
                                />
                                {formErrors.cvv && (
                                  <p className="mt-1 text-sm text-red-500">{formErrors.cvv}</p>
                                )}
                              </div>
                              
                              {addresses.length > 0 && (
                                <div className="md:col-span-2">
                                  <label htmlFor="billing_address_uid" className="block text-sm font-medium text-gray-700 mb-1">
                                    Billing Address
                                  </label>
                                  <select
                                    id="billing_address_uid"
                                    name="billing_address_uid"
                                    value={formData.billing_address_uid || ""}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">Select a billing address</option>
                                    {addresses.map(address => (
                                      <option key={address.uid} value={address.uid}>
                                        {address.name ? `${address.name}: ` : ""}{address.street_address_1}, {address.city}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              
                              <div>
                                <div className="flex items-center">
                                  <input
                                    id="is_default"
                                    name="is_default"
                                    type="checkbox"
                                    checked={formData.is_default || false}
                                    onChange={handleCheckboxChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
                                    Set as default payment method
                                  </label>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end space-x-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPaymentForm(false);
                                  setEditingPayment(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                Cancel
                              </button>
                              
                              <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                {isSaving ? "Saving..." : "Save Payment Method"}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Communication Preferences Section */}
                  {activeSection === "communication-preferences" && (
                    <div>
                      <h2 className="text-2xl font-semibold mb-6">Communication Preferences</h2>
                      
                      <form onSubmit={handleUpdateCommunicationPreferences}>
                        <div className="space-y-6">
                          {/* Email Notifications */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  id="emailNotifications.orders"
                                  name="emailNotifications.orders"
                                  type="checkbox"
                                  checked={communicationPreferences.emailNotifications?.orders || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="emailNotifications.orders" className="ml-2 block text-sm text-gray-700">
                                  Order updates and shipping confirmations
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="emailNotifications.promotions"
                                  name="emailNotifications.promotions"
                                  type="checkbox"
                                  checked={communicationPreferences.emailNotifications?.promotions || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="emailNotifications.promotions" className="ml-2 block text-sm text-gray-700">
                                  Promotions, deals, and sales
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="emailNotifications.productUpdates"
                                  name="emailNotifications.productUpdates"
                                  type="checkbox"
                                  checked={communicationPreferences.emailNotifications?.productUpdates || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="emailNotifications.productUpdates" className="ml-2 block text-sm text-gray-700">
                                  Product updates and back-in-stock alerts
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="emailNotifications.accountAlerts"
                                  name="emailNotifications.accountAlerts"
                                  type="checkbox"
                                  checked={communicationPreferences.emailNotifications?.accountAlerts || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="emailNotifications.accountAlerts" className="ml-2 block text-sm text-gray-700">
                                  Account and security alerts
                                </label>
                              </div>
                            </div>
                          </div>
                          
                          {/* SMS Notifications */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-medium mb-4">SMS Notifications</h3>
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  id="smsNotifications.orders"
                                  name="smsNotifications.orders"
                                  type="checkbox"
                                  checked={communicationPreferences.smsNotifications?.orders || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="smsNotifications.orders" className="ml-2 block text-sm text-gray-700">
                                  Order and shipping updates via text message
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="smsNotifications.promotions"
                                  name="smsNotifications.promotions"
                                  type="checkbox"
                                  checked={communicationPreferences.smsNotifications?.promotions || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="smsNotifications.promotions" className="ml-2 block text-sm text-gray-700">
                                  Promotions and deals via text message
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="smsNotifications.accountAlerts"
                                  name="smsNotifications.accountAlerts"
                                  type="checkbox"
                                  checked={communicationPreferences.smsNotifications?.accountAlerts || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="smsNotifications.accountAlerts" className="ml-2 block text-sm text-gray-700">
                                  Account and security alerts via text message
                                </label>
                              </div>
                              
                              <p className="text-xs text-gray-500 mt-2">
                                Standard message and data rates may apply. You can opt out at any time.
                              </p>
                            </div>
                          </div>
                          
                          {/* Marketing Preferences */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-medium mb-4">Marketing Preferences</h3>
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  id="marketingPreferences.email"
                                  name="marketingPreferences.email"
                                  type="checkbox"
                                  checked={communicationPreferences.marketingPreferences?.email || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="marketingPreferences.email" className="ml-2 block text-sm text-gray-700">
                                  Receive marketing emails from ConstructMart
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="marketingPreferences.sms"
                                  name="marketingPreferences.sms"
                                  type="checkbox"
                                  checked={communicationPreferences.marketingPreferences?.sms || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="marketingPreferences.sms" className="ml-2 block text-sm text-gray-700">
                                  Receive marketing text messages from ConstructMart
                                </label>
                              </div>
                              
                              <div className="flex items-center">
                                <input
                                  id="marketingPreferences.thirdParty"
                                  name="marketingPreferences.thirdParty"
                                  type="checkbox"
                                  checked={communicationPreferences.marketingPreferences?.thirdParty || false}
                                  onChange={handleCheckboxChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="marketingPreferences.thirdParty" className="ml-2 block text-sm text-gray-700">
                                  Allow ConstructMart to share my information with trusted partners
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                              <>
                                <i className="fas fa-save mr-2"></i>
                                Save Preferences
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                  
                  {/* Projects & Teams Section (for Professional Buyers) */}
                  {activeSection === "projects" && user?.userType === "professional_buyer" && (
                    <div>
                      <h2 className="text-2xl font-semibold mb-6">Projects & Teams</h2>
                      <p className="text-gray-500 mb-4">Manage your construction projects and team permissions.</p>
                      
                      {/* Placeholder for Projects & Teams functionality */}
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-blue-700">
                          <i className="fas fa-info-circle mr-2"></i>
                          Projects & Teams functionality will be available in a future update. Stay tuned!
                        </p>
                      </div>
                      
                      {/* Projects & Teams content would go here */}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_UserAccount;