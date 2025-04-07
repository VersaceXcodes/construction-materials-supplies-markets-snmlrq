import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch, uiActions, logout, fetchCart } from '@/store/main';
import axios from 'axios';
import debounce from 'lodash.debounce';

interface Category {
  uid: string;
  name: string;
  icon?: string;
  subcategories: Array<{
    uid: string;
    name: string;
    productCount: number;
  }>;
  featured?: Array<{
    uid: string;
    name: string;
    imageUrl: string;
  }>;
}

const GV_MainNavigation: React.FC = () => {
  // Global state
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { summary: cartSummary } = useAppSelector((state) => state.cart);
  const { unreadCount: notificationsCount } = useAppSelector((state) => state.notifications);
  const { isMobileMenuOpen, viewportSize } = useAppSelector((state) => state.ui);

  // Local state
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<string | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownsRef = useRef<HTMLDivElement>(null);

  // Fetch categories on component mount
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/categories');
      if (response.data.success) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Debounced search suggestions
  const fetchSearchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchSuggestions([]);
        return;
      }

      try {
        const response = await axios.get(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
        if (response.data.success) {
          setSearchSuggestions(response.data.suggestions);
        }
      } catch (error) {
        console.error('Failed to fetch search suggestions:', error);
        setSearchSuggestions([]);
      }
    }, 300),
    []
  );

  // Update search suggestions when query changes
  useEffect(() => {
    fetchSearchSuggestions(searchQuery);
  }, [searchQuery, fetchSearchSuggestions]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current && 
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }

      if (
        categoryDropdownsRef.current && 
        !categoryDropdownsRef.current.contains(event.target as Node) &&
        !((event.target as HTMLElement).closest('.category-dropdown'))
      ) {
        setActiveCategoryDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    dispatch(uiActions.toggleMobileMenu());
  };

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setIsSearchFocused(false);
      if (isMobileMenuOpen) {
        dispatch(uiActions.setMobileMenuOpen(false));
      }
    }
  };

  // Handle search suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    navigate(`/search?q=${encodeURIComponent(suggestion)}`);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // Handle logout
  const handleLogout = async () => {
    await dispatch(logout());
    setIsUserDropdownOpen(false);
    navigate('/');
  };

  // Open cart sidebar
  const openCartSidebar = () => {
    dispatch(uiActions.openModal('cart'));
  };

  // Handle category dropdown toggle
  const toggleCategoryDropdown = (categoryUid: string) => {
    if (activeCategoryDropdown === categoryUid) {
      setActiveCategoryDropdown(null);
    } else {
      setActiveCategoryDropdown(categoryUid);
    }
  };

  return (
    <>
      {/* Main Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        {/* Optional promotional banner */}
        <div className="bg-blue-600 text-white text-center text-sm py-1 px-4">
          <p>Summer Sale! Use code SUMMER2023 for 15% off on all orders. <span className="underline cursor-pointer">Learn more</span></p>
        </div>

        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section - Left */}
            <div className="flex items-center flex-shrink-0">
              <Link to="/" className="flex items-center">
                <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                <span className="ml-2 text-xl font-bold text-gray-900">ConstructMart</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={openCartSidebar}
                className="p-2 mr-4 relative"
                aria-label="Cart"
              >
                <svg className="h-6 w-6 text-gray-700" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                {cartSummary.itemCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                    {cartSummary.itemCount}
                  </span>
                )}
              </button>
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <span className="sr-only">Open main menu</span>
                {/* Icon when menu is closed */}
                <svg
                  className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {/* Icon when menu is open */}
                <svg
                  className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Desktop Navigation - Center */}
            <div className="hidden md:flex md:items-center">
              <nav className="ml-6 flex space-x-4" ref={categoryDropdownsRef}>
                {categories.map((category) => (
                  <div key={category.uid} className="relative category-dropdown">
                    <button
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                      onClick={() => toggleCategoryDropdown(category.uid)}
                      aria-expanded={activeCategoryDropdown === category.uid}
                    >
                      {category.name}
                      <svg 
                        className={`ml-1 h-5 w-5 transform ${activeCategoryDropdown === category.uid ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Category Dropdown */}
                    {activeCategoryDropdown === category.uid && (
                      <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1" role="menu" aria-orientation="vertical">
                          {category.subcategories && category.subcategories.length > 0 ? (
                            category.subcategories.map((subcategory) => (
                              <Link
                                key={subcategory.uid}
                                to={`/categories/${subcategory.uid}`}
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                role="menuitem"
                                onClick={() => setActiveCategoryDropdown(null)}
                              >
                                {subcategory.name}
                                <span className="ml-2 text-xs text-gray-500">({subcategory.productCount})</span>
                              </Link>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">No subcategories</div>
                          )}
                        </div>

                        {/* Featured Items */}
                        {category.featured && category.featured.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase">Featured</h3>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {category.featured.map((item) => (
                                <Link
                                  key={item.uid}
                                  to={`/products/${item.uid}`}
                                  className="flex flex-col items-center hover:bg-gray-100 p-2 rounded"
                                  onClick={() => setActiveCategoryDropdown(null)}
                                >
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.name} 
                                    className="w-full h-16 object-cover rounded"
                                  />
                                  <span className="mt-1 text-xs text-center">{item.name}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>

            {/* Search Section - Center */}
            <div className="hidden md:flex flex-1 max-w-lg mx-4">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Search for products, brands, or categories..."
                    aria-label="Search"
                  />
                  <button
                    type="submit"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <span className="text-sm font-medium text-blue-600 hover:text-blue-500">Search</span>
                  </button>
                </div>

                {/* Search Suggestions Dropdown */}
                {isSearchFocused && searchQuery.length >= 2 && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-md shadow-lg">
                    <ul className="py-1 text-sm text-gray-700">
                      {searchSuggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </form>
            </div>

            {/* User Actions - Right */}
            <div className="hidden md:flex items-center">
              {/* Cart */}
              <button 
                onClick={openCartSidebar}
                className="p-2 relative text-gray-700 hover:text-blue-600"
                aria-label="Cart"
              >
                <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                {cartSummary.itemCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                    {cartSummary.itemCount}
                  </span>
                )}
              </button>

              {/* User Account */}
              <div className="ml-4 relative flex-shrink-0" ref={userDropdownRef}>
                {isAuthenticated ? (
                  <>
                    <button
                      className="flex items-center text-sm"
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      aria-expanded={isUserDropdownOpen}
                    >
                      <span className="sr-only">Open user menu</span>
                      {user?.profilePictureUrl ? (
                        <img
                          className="h-8 w-8 rounded-full"
                          src={user.profilePictureUrl}
                          alt=""
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </div>
                      )}
                      <div className="ml-2 hidden lg:flex flex-col items-start">
                        <span className="text-sm font-medium text-gray-700">{user?.firstName} {user?.lastName}</span>
                        <span className="text-xs text-gray-500">{user?.userType === 'vendor_admin' ? 'Seller' : user?.userType === 'professional_buyer' ? 'Pro Buyer' : 'Buyer'}</span>
                      </div>
                      <svg className="ml-1 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {/* User Dropdown Menu */}
                    {isUserDropdownOpen && (
                      <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                          <Link
                            to="/account/profile"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            Your Profile
                          </Link>
                          <Link
                            to="/account/orders"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            Orders
                          </Link>
                          <Link
                            to="/account/wishlists"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            Wishlists
                          </Link>
                          <Link
                            to="/messages"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            <div className="flex justify-between items-center">
                              <span>Messages</span>
                              {notificationsCount > 0 && (
                                <span className="inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-600 rounded-full">
                                  {notificationsCount}
                                </span>
                              )}
                            </div>
                          </Link>
                          
                          {user?.userType === 'vendor_admin' && (
                            <Link
                              to="/seller"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              role="menuitem"
                              onClick={() => setIsUserDropdownOpen(false)}
                            >
                              Seller Dashboard
                            </Link>
                          )}
                          
                          <button
                            onClick={handleLogout}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                          >
                            Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => dispatch(uiActions.openModal('authentication'))}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Sign In / Register
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Search - Shown below main navigation */}
          <div className="md:hidden py-3">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Search products..."
                  aria-label="Search"
                />
              </div>

              {/* Mobile Search Suggestions */}
              {isSearchFocused && searchQuery.length >= 2 && searchSuggestions.length > 0 && (
                <div className="absolute z-50 mt-2 w-full bg-white rounded-md shadow-lg left-0 right-0 mx-auto px-4">
                  <ul className="py-1 text-sm text-gray-700">
                    {searchSuggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden bg-white border-t border-gray-200`}
          id="mobile-menu"
        >
          <div className="max-h-[70vh] overflow-y-auto">
            {/* User Info (if authenticated) */}
            {isAuthenticated && (
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center">
                  {user?.profilePictureUrl ? (
                    <img
                      className="h-10 w-10 rounded-full"
                      src={user.profilePictureUrl}
                      alt=""
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                  )}
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">{user?.firstName} {user?.lastName}</div>
                    <div className="text-sm font-medium text-gray-500">{user?.email}</div>
                  </div>
                  {notificationsCount > 0 && (
                    <div className="ml-auto bg-red-600 flex items-center justify-center h-6 w-6 rounded-full">
                      <span className="text-xs font-medium text-white">{notificationsCount}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Categories */}
            <div className="border-b border-gray-200">
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Categories</h3>
              </div>
              <div className="px-2 pb-3 space-y-1">
                {isLoading ? (
                  <div className="px-2 py-3 text-sm text-gray-500">Loading categories...</div>
                ) : (
                  categories.map((category) => (
                    <div key={category.uid} className="py-1">
                      <button
                        className="w-full flex justify-between items-center px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                        onClick={() => toggleCategoryDropdown(category.uid)}
                      >
                        <span>{category.name}</span>
                        <svg
                          className={`ml-1 h-5 w-5 text-gray-400 transform ${activeCategoryDropdown === category.uid ? 'rotate-180' : ''}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {/* Mobile Subcategories */}
                      {activeCategoryDropdown === category.uid && category.subcategories && category.subcategories.length > 0 && (
                        <div className="mt-1 pl-4">
                          {category.subcategories.map((subcategory) => (
                            <Link
                              key={subcategory.uid}
                              to={`/categories/${subcategory.uid}`}
                              className="block px-3 py-2 text-base text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md"
                              onClick={() => {
                                setActiveCategoryDropdown(null);
                                dispatch(uiActions.setMobileMenuOpen(false));
                              }}
                            >
                              {subcategory.name}
                              <span className="ml-2 text-xs text-gray-500">({subcategory.productCount})</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mobile Navigation Links */}
            <div className="pt-4 pb-3 border-b border-gray-200">
              <div className="px-4 space-y-1">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/account/profile"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                      onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                    >
                      Your Profile
                    </Link>
                    <Link
                      to="/account/orders"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                      onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                    >
                      Orders
                    </Link>
                    <Link
                      to="/account/wishlists"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                      onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                    >
                      Wishlists
                    </Link>
                    <Link
                      to="/messages"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                      onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                    >
                      <div className="flex justify-between items-center">
                        <span>Messages</span>
                        {notificationsCount > 0 && (
                          <span className="inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-600 rounded-full">
                            {notificationsCount}
                          </span>
                        )}
                      </div>
                    </Link>
                    {user?.userType === 'vendor_admin' && (
                      <Link
                        to="/seller"
                        className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                        onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                      >
                        Seller Dashboard
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        handleLogout();
                        dispatch(uiActions.setMobileMenuOpen(false));
                      }}
                      className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      dispatch(uiActions.openModal('authentication'));
                      dispatch(uiActions.setMobileMenuOpen(false));
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Sign In / Register
                  </button>
                )}
              </div>
            </div>

            {/* Additional Links */}
            <div className="pt-4 pb-3">
              <div className="px-4 space-y-1">
                <Link
                  to="/help"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                  onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                >
                  Help Center
                </Link>
                <Link
                  to="/cart"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                  onClick={() => dispatch(uiActions.setMobileMenuOpen(false))}
                >
                  Shopping Cart
                  {cartSummary.itemCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-600 rounded-full">
                      {cartSummary.itemCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer to push content below fixed header */}
      <div className={`h-16 ${isMobileMenuOpen ? 'md:h-16' : 'h-28 md:h-16'}`}></div>
    </>
  );
};

export default GV_MainNavigation;