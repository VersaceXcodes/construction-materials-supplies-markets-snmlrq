import React, { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector, login, authActions, uiActions } from "@/store/main";
import axios from "axios";

// Password strength criteria
const STRENGTH_CRITERIA = {
  weak: /^.{6,}$/,                                 // At least 6 characters
  medium: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, // At least 8 chars with lowercase, uppercase, and numbers
  strong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{10,}$/, // 10+ chars with lowercase, uppercase, numbers, and special chars
  "very-strong": /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{12,}$/ // 12+ chars with lowercase, uppercase, numbers, and special chars
};

const GV_AuthenticationModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Global state
  const authLoading = useAppSelector((state) => state.auth.loading);
  const authError = useAppSelector((state) => state.auth.error);
  
  // Local state
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginFormData, setLoginFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });
  const [registrationFormData, setRegistrationFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    userType: "individual_buyer" as "individual_buyer" | "professional_buyer" | "vendor_admin",
    companyDetails: {
      name: "",
      businessType: "",
      taxId: "",
      industry: "",
      website: ""
    },
    termsAccepted: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | 'very-strong'>('weak');
  const [showPassword, setShowPassword] = useState({
    login: false,
    register: false
  });
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState("");
  const [resetPasswordStatus, setResetPasswordStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Close modal when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeModal();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update error message when auth error changes
  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
      setSubmissionStatus('error');
    }
  }, [authError]);

  // Reset form errors when switching tabs
  useEffect(() => {
    setFormErrors({});
    setErrorMessage(null);
  }, [activeTab]);

  // Calculate password strength
  useEffect(() => {
    if (registrationFormData.password) {
      if (STRENGTH_CRITERIA["very-strong"].test(registrationFormData.password)) {
        setPasswordStrength('very-strong');
      } else if (STRENGTH_CRITERIA.strong.test(registrationFormData.password)) {
        setPasswordStrength('strong');
      } else if (STRENGTH_CRITERIA.medium.test(registrationFormData.password)) {
        setPasswordStrength('medium');
      } else if (STRENGTH_CRITERIA.weak.test(registrationFormData.password)) {
        setPasswordStrength('weak');
      }
    } else {
      setPasswordStrength('weak');
    }
  }, [registrationFormData.password]);

  // Handle tab switching
  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setErrorMessage(null);
    setFormErrors({});
    setSubmissionStatus('idle');
  };

  // Update login form fields
  const updateLoginField = (field: string, value: string | boolean) => {
    setLoginFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear specific field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Update registration form fields
  const updateRegistrationField = (field: string, value: string | boolean) => {
    if (field.includes('.')) {
      // Handle nested fields (company details)
      const [parent, child] = field.split('.');
      setRegistrationFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev] as Record<string, any>,
          [child]: value
        }
      }));
    } else {
      setRegistrationFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Clear specific field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate login form
  const validateLoginForm = () => {
    const errors: Record<string, string> = {};
    
    if (!loginFormData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(loginFormData.email)) {
      errors.email = "Email is invalid";
    }
    
    if (!loginFormData.password) {
      errors.password = "Password is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate registration form
  const validateRegistrationForm = () => {
    const errors: Record<string, string> = {};
    
    // Email validation
    if (!registrationFormData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(registrationFormData.email)) {
      errors.email = "Email is invalid";
    }
    
    // Password validation
    if (!registrationFormData.password) {
      errors.password = "Password is required";
    } else if (registrationFormData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    // Password confirmation
    if (registrationFormData.password !== registrationFormData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    
    // Name validation
    if (!registrationFormData.firstName) {
      errors.firstName = "First name is required";
    }
    
    if (!registrationFormData.lastName) {
      errors.lastName = "Last name is required";
    }
    
    // Terms acceptance
    if (!registrationFormData.termsAccepted) {
      errors.termsAccepted = "You must accept the terms of service";
    }
    
    // Company validation for business accounts
    if (registrationFormData.userType !== "individual_buyer") {
      if (!registrationFormData.companyDetails.name) {
        errors["companyDetails.name"] = "Company name is required";
      }
      
      if (!registrationFormData.companyDetails.businessType) {
        errors["companyDetails.businessType"] = "Business type is required";
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateLoginForm()) {
      return;
    }
    
    setSubmissionStatus('submitting');
    setErrorMessage(null);
    
    try {
      // Use the login thunk from redux store
      const resultAction = await dispatch(login({
        email: loginFormData.email,
        password: loginFormData.password,
        remember_me: loginFormData.rememberMe
      }));
      
      if (login.fulfilled.match(resultAction)) {
        setSubmissionStatus('success');
        // Close modal after successful login
        closeModal();
      } else {
        setSubmissionStatus('error');
        if (resultAction.payload) {
          setErrorMessage((resultAction.payload as any).message || "Login failed");
        } else {
          setErrorMessage(resultAction.error.message || "Login failed");
        }
      }
    } catch (error) {
      setSubmissionStatus('error');
      setErrorMessage("An unexpected error occurred");
      console.error("Login error:", error);
    }
  };

  // Handle registration form submission
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRegistrationForm()) {
      return;
    }
    
    setSubmissionStatus('submitting');
    setErrorMessage(null);
    
    try {
      // Prepare registration payload
      const registrationPayload = {
        email: registrationFormData.email,
        password: registrationFormData.password,
        first_name: registrationFormData.firstName,
        last_name: registrationFormData.lastName,
        phone_number: registrationFormData.phoneNumber || undefined,
        user_type: registrationFormData.userType,
        company_details: registrationFormData.userType !== "individual_buyer" ? {
          name: registrationFormData.companyDetails.name,
          business_type: registrationFormData.companyDetails.businessType,
          tax_id: registrationFormData.companyDetails.taxId || undefined,
          industry: registrationFormData.companyDetails.industry || undefined,
          website: registrationFormData.companyDetails.website || undefined
        } : undefined
      };
      
      // Call registration API
      const response = await axios.post('http://localhost:1337/api/auth/register', registrationPayload);
      
      setSubmissionStatus('success');
      
      // For demonstration purposes, automatically log in the user after registration
      // In a real production app, you might want to show a verification message instead
      if (response.data.success) {
        // Show success message and then close modal
        dispatch(uiActions.openModal('registration-success'));
        setTimeout(() => {
          closeModal();
        }, 3000);
      }
    } catch (error) {
      setSubmissionStatus('error');
      if (axios.isAxiosError(error) && error.response) {
        setErrorMessage(error.response.data.message || "Registration failed");
      } else {
        setErrorMessage("An unexpected error occurred");
      }
      console.error("Registration error:", error);
    }
  };

  // Handle password reset request
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetPasswordEmail) {
      setFormErrors({ resetEmail: "Email is required" });
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(resetPasswordEmail)) {
      setFormErrors({ resetEmail: "Email is invalid" });
      return;
    }
    
    setResetPasswordStatus('submitting');
    setResetPasswordError(null);
    
    try {
      // Call forgot password API
      const response = await axios.post('http://localhost:1337/api/auth/forgot-password', {
        email: resetPasswordEmail
      });
      
      setResetPasswordStatus('success');
      
      // After successful request, go back to login after a delay
      setTimeout(() => {
        setShowResetPasswordForm(false);
        setResetPasswordEmail("");
        setResetPasswordStatus('idle');
      }, 3000);
    } catch (error) {
      setResetPasswordStatus('error');
      if (axios.isAxiosError(error) && error.response) {
        setResetPasswordError(error.response.data.message || "Password reset request failed");
      } else {
        setResetPasswordError("An unexpected error occurred");
      }
      console.error("Password reset error:", error);
    }
  };

  // Close the modal
  const closeModal = () => {
    dispatch(uiActions.closeModal('authentication'));
  };

  // Get strength meter label and color
  const getStrengthMeterLabel = () => {
    switch (passwordStrength) {
      case 'weak':
        return { label: "Weak", color: "bg-red-500" };
      case 'medium':
        return { label: "Medium", color: "bg-yellow-500" };
      case 'strong':
        return { label: "Strong", color: "bg-green-500" };
      case 'very-strong':
        return { label: "Very Strong", color: "bg-green-700" };
      default:
        return { label: "Weak", color: "bg-red-500" };
    }
  };

  // Calculate strength meter width
  const getStrengthMeterWidth = () => {
    switch (passwordStrength) {
      case 'weak':
        return "w-1/4";
      case 'medium':
        return "w-2/4";
      case 'strong':
        return "w-3/4";
      case 'very-strong':
        return "w-full";
      default:
        return "w-1/4";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-fadeIn"
        style={{ maxWidth: "500px" }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-800">
            {showResetPasswordForm 
              ? "Reset Password" 
              : activeTab === 'login' 
                ? "Sign In" 
                : "Create an Account"}
          </h2>
          <button 
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Password Reset Form */}
          {showResetPasswordForm ? (
            <form onSubmit={handleRequestPasswordReset}>
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Enter your email address and we'll send you instructions to reset your password.
                </p>
                <div className="mb-2">
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.resetEmail ? "border-red-500" : "border-gray-300"
                    }`}
                    value={resetPasswordEmail}
                    onChange={(e) => {
                      setResetPasswordEmail(e.target.value);
                      if (formErrors.resetEmail) {
                        const newErrors = { ...formErrors };
                        delete newErrors.resetEmail;
                        setFormErrors(newErrors);
                      }
                    }}
                  />
                  {formErrors.resetEmail && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.resetEmail}</p>
                  )}
                </div>
                
                {resetPasswordError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{resetPasswordError}</p>
                  </div>
                )}
                
                {resetPasswordStatus === 'success' && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">
                      If the email exists in our system, password reset instructions have been sent.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
                  onClick={() => setShowResetPasswordForm(false)}
                  disabled={resetPasswordStatus === 'submitting'}
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    resetPasswordStatus === 'submitting' ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                  disabled={resetPasswordStatus === 'submitting'}
                >
                  {resetPasswordStatus === 'submitting' ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b mb-4">
                <button
                  className={`flex-1 pb-2 text-center ${
                    activeTab === 'login'
                      ? "border-b-2 border-blue-500 text-blue-600 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => switchTab('login')}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 pb-2 text-center ${
                    activeTab === 'register'
                      ? "border-b-2 border-blue-500 text-blue-600 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => switchTab('register')}
                >
                  Register
                </button>
              </div>
              
              {/* Error Message */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </div>
              )}
              
              {/* Login Form */}
              {activeTab === 'login' && (
                <form onSubmit={handleLogin}>
                  {/* Email Field */}
                  <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.email ? "border-red-500" : "border-gray-300"
                      }`}
                      value={loginFormData.email}
                      onChange={(e) => updateLoginField("email", e.target.value)}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>
                  
                  {/* Password Field */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <button
                        type="button"
                        className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                        onClick={() => setShowResetPasswordForm(true)}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword.login ? "text" : "password"}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          formErrors.password ? "border-red-500" : "border-gray-300"
                        }`}
                        value={loginFormData.password}
                        onChange={(e) => updateLoginField("password", e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 focus:outline-none"
                        onClick={() => setShowPassword(prev => ({ ...prev, login: !prev.login }))}
                      >
                        {showPassword.login ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                    {formErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                    )}
                  </div>
                  
                  {/* Remember Me Checkbox */}
                  <div className="mb-6">
                    <div className="flex items-center">
                      <input
                        id="rememberMe"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={loginFormData.rememberMe}
                        onChange={(e) => updateLoginField("rememberMe", e.target.checked)}
                      />
                      <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                        Remember me
                      </label>
                    </div>
                  </div>
                  
                  {/* Sign In Button */}
                  <button
                    type="submit"
                    className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      submissionStatus === 'submitting' ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                    disabled={submissionStatus === 'submitting'}
                  >
                    {submissionStatus === 'submitting' ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing In...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                  
                  {/* Social Login */}
                  <div className="mt-6">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </form>
              )}
              
              {/* Registration Form */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegistration}>
                  {/* Email Field */}
                  <div className="mb-4">
                    <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.email ? "border-red-500" : "border-gray-300"
                      }`}
                      value={registrationFormData.email}
                      onChange={(e) => updateRegistrationField("email", e.target.value)}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>
                  
                  {/* Password Field */}
                  <div className="mb-4">
                    <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showPassword.register ? "text" : "password"}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          formErrors.password ? "border-red-500" : "border-gray-300"
                        }`}
                        value={registrationFormData.password}
                        onChange={(e) => updateRegistrationField("password", e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 focus:outline-none"
                        onClick={() => setShowPassword(prev => ({ ...prev, register: !prev.register }))}
                      >
                        {showPassword.register ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                    {formErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                    )}
                    
                    {/* Password Strength Meter */}
                    {registrationFormData.password && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${getStrengthMeterColor()} ${getStrengthMeterWidth()}`}></div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Password strength: <span className="font-medium">{getStrengthMeterLabel().label}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Confirm Password Field */}
                  <div className="mb-4">
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.confirmPassword ? "border-red-500" : "border-gray-300"
                      }`}
                      value={registrationFormData.confirmPassword}
                      onChange={(e) => updateRegistrationField("confirmPassword", e.target.value)}
                    />
                    {formErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          formErrors.firstName ? "border-red-500" : "border-gray-300"
                        }`}
                        value={registrationFormData.firstName}
                        onChange={(e) => updateRegistrationField("firstName", e.target.value)}
                      />
                      {formErrors.firstName && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          formErrors.lastName ? "border-red-500" : "border-gray-300"
                        }`}
                        value={registrationFormData.lastName}
                        onChange={(e) => updateRegistrationField("lastName", e.target.value)}
                      />
                      {formErrors.lastName && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Phone Number */}
                  <div className="mb-4">
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      id="phoneNumber"
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={registrationFormData.phoneNumber}
                      onChange={(e) => updateRegistrationField("phoneNumber", e.target.value)}
                    />
                  </div>
                  
                  {/* User Type Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      I am a: <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          id="individual_buyer"
                          name="userType"
                          type="radio"
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          value="individual_buyer"
                          checked={registrationFormData.userType === "individual_buyer"}
                          onChange={() => updateRegistrationField("userType", "individual_buyer")}
                        />
                        <label htmlFor="individual_buyer" className="ml-2 block text-sm text-gray-700">
                          Individual Buyer (Personal use)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="professional_buyer"
                          name="userType"
                          type="radio"
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          value="professional_buyer"
                          checked={registrationFormData.userType === "professional_buyer"}
                          onChange={() => updateRegistrationField("userType", "professional_buyer")}
                        />
                        <label htmlFor="professional_buyer" className="ml-2 block text-sm text-gray-700">
                          Professional Buyer (Business use)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="vendor_admin"
                          name="userType"
                          type="radio"
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          value="vendor_admin"
                          checked={registrationFormData.userType === "vendor_admin"}
                          onChange={() => updateRegistrationField("userType", "vendor_admin")}
                        />
                        <label htmlFor="vendor_admin" className="ml-2 block text-sm text-gray-700">
                          Seller (I want to sell products)
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Company Details (conditional) */}
                  {registrationFormData.userType !== "individual_buyer" && (
                    <div className="bg-gray-50 p-4 rounded-md mb-4 border border-gray-200">
                      <h3 className="text-md font-medium text-gray-700 mb-3">Company Information</h3>
                      
                      {/* Company Name */}
                      <div className="mb-3">
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                          Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="companyName"
                          type="text"
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors["companyDetails.name"] ? "border-red-500" : "border-gray-300"
                          }`}
                          value={registrationFormData.companyDetails.name}
                          onChange={(e) => updateRegistrationField("companyDetails.name", e.target.value)}
                        />
                        {formErrors["companyDetails.name"] && (
                          <p className="mt-1 text-sm text-red-600">{formErrors["companyDetails.name"]}</p>
                        )}
                      </div>
                      
                      {/* Business Type */}
                      <div className="mb-3">
                        <label htmlFor="businessType" className="block text-sm font-medium text-gray-700 mb-1">
                          Business Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="businessType"
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors["companyDetails.businessType"] ? "border-red-500" : "border-gray-300"
                          }`}
                          value={registrationFormData.companyDetails.businessType}
                          onChange={(e) => updateRegistrationField("companyDetails.businessType", e.target.value)}
                        >
                          <option value="">Select Business Type</option>
                          <option value="corporation">Corporation</option>
                          <option value="llc">Limited Liability Company (LLC)</option>
                          <option value="partnership">Partnership</option>
                          <option value="sole_proprietorship">Sole Proprietorship</option>
                          <option value="other">Other</option>
                        </select>
                        {formErrors["companyDetails.businessType"] && (
                          <p className="mt-1 text-sm text-red-600">{formErrors["companyDetails.businessType"]}</p>
                        )}
                      </div>
                      
                      {/* Tax ID */}
                      <div className="mb-3">
                        <label htmlFor="taxId" className="block text-sm font-medium text-gray-700 mb-1">
                          Tax ID / EIN
                        </label>
                        <input
                          id="taxId"
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={registrationFormData.companyDetails.taxId}
                          onChange={(e) => updateRegistrationField("companyDetails.taxId", e.target.value)}
                        />
                      </div>
                      
                      {/* Industry */}
                      <div className="mb-3">
                        <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                          Industry
                        </label>
                        <select
                          id="industry"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={registrationFormData.companyDetails.industry}
                          onChange={(e) => updateRegistrationField("companyDetails.industry", e.target.value)}
                        >
                          <option value="">Select Industry</option>
                          <option value="residential_construction">Residential Construction</option>
                          <option value="commercial_construction">Commercial Construction</option>
                          <option value="renovation">Renovation & Remodeling</option>
                          <option value="industrial_construction">Industrial Construction</option>
                          <option value="infrastructure">Infrastructure & Civil Engineering</option>
                          <option value="specialty_trade">Specialty Trade Contractors</option>
                          <option value="interior_design">Interior Design</option>
                          <option value="architecture">Architecture</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      
                      {/* Website */}
                      <div>
                        <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                          Company Website
                        </label>
                        <input
                          id="website"
                          type="url"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://example.com"
                          value={registrationFormData.companyDetails.website}
                          onChange={(e) => updateRegistrationField("companyDetails.website", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Terms Acceptance */}
                  <div className="mb-6">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="terms"
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          checked={registrationFormData.termsAccepted}
                          onChange={(e) => updateRegistrationField("termsAccepted", e.target.checked)}
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="terms" className={`font-medium ${formErrors.termsAccepted ? "text-red-600" : "text-gray-700"}`}>
                          I accept the <a href="#" className="text-blue-600 hover:text-blue-800">Terms of Service</a> and <a href="#" className="text-blue-600 hover:text-blue-800">Privacy Policy</a>
                        </label>
                        {formErrors.termsAccepted && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.termsAccepted}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Register Button */}
                  <button
                    type="submit"
                    className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      submissionStatus === 'submitting' ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                    disabled={submissionStatus === 'submitting'}
                  >
                    {submissionStatus === 'submitting' ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Account...
                      </span>
                    ) : (
                      "Create Account"
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Helper function to get strength meter color
  function getStrengthMeterColor() {
    switch (passwordStrength) {
      case 'weak':
        return "bg-red-500";
      case 'medium':
        return "bg-yellow-500";
      case 'strong':
        return "bg-green-500";
      case 'very-strong':
        return "bg-green-700";
      default:
        return "bg-red-500";
    }
  }
};

export default GV_AuthenticationModal;