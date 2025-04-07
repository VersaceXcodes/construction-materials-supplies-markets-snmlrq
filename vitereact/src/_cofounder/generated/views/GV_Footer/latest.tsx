import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const GV_Footer: React.FC = () => {
  // State for category links
  const [footerCategories, setFooterCategories] = useState<Array<{ uid: string; name: string }>>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState<boolean>(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // State for newsletter form
  const [newsletterEmail, setNewsletterEmail] = useState<string>("");
  const [newsletterConsent, setNewsletterConsent] = useState<boolean>(false);
  const [newsletterSubmissionStatus, setNewsletterSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  // State for mobile accordion
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Fetch categories on component mount
  useEffect(() => {
    fetchFooterCategories();
  }, []);

  // Function to fetch main categories for the footer
  const fetchFooterCategories = async () => {
    setIsCategoriesLoading(true);
    setCategoriesError(null);
    
    try {
      const response = await axios.get('http://localhost:1337/api/categories', {
        params: { limit: 6 } // Limit to top 6 categories
      });
      
      if (response.data && response.data.success) {
        setFooterCategories(response.data.categories);
      } else {
        setCategoriesError("Failed to load categories");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      setCategoriesError("An error occurred while loading categories");
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  // Function to validate email
  const validateEmailAddress = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Function to handle newsletter form submission
  const submitNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setNewsletterError(null);
    
    // Validate email
    if (!validateEmailAddress(newsletterEmail)) {
      setNewsletterError("Please enter a valid email address");
      return;
    }
    
    // Validate consent
    if (!newsletterConsent) {
      setNewsletterError("Please consent to receive marketing communications");
      return;
    }
    
    setNewsletterSubmissionStatus('submitting');
    
    try {
      // The backend provided doesn't have a specific newsletter endpoint
      // In a real implementation, this would make a request to a marketing API
      // For demonstration, we'll simulate a successful submission after a delay
      
      // Simulated API call with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Successful submission
      setNewsletterSubmissionStatus('success');
      resetNewsletterForm();
      
      // Reset to idle after showing success message
      setTimeout(() => {
        setNewsletterSubmissionStatus('idle');
      }, 5000);
      
    } catch (error) {
      console.error("Newsletter submission error:", error);
      setNewsletterSubmissionStatus('error');
      setNewsletterError("Failed to submit. Please try again later.");
    }
  };

  // Function to reset the newsletter form
  const resetNewsletterForm = () => {
    setNewsletterEmail("");
    setNewsletterConsent(false);
  };

  // Function to toggle accordion sections on mobile
  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // Current year for copyright
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="bg-gray-800 text-white pt-12 pb-6">
        {/* Main Footer Content */}
        <div className="container mx-auto px-4">
          {/* Desktop Layout - Grid */}
          <div className="hidden md:grid md:grid-cols-12 gap-8">
            {/* Company Information */}
            <div className="col-span-12 md:col-span-3 mb-8 md:mb-0">
              <div className="flex items-center mb-4">
                <span className="text-2xl font-bold text-orange-500">ConstructMart</span>
              </div>
              <p className="text-gray-300 mb-4">
                Your trusted marketplace for quality construction materials and supplies. 
                Building a better future, one project at a time.
              </p>
              <div className="flex space-x-4 mt-6">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* About Links */}
            <div className="col-span-12 md:col-span-2 mb-8 md:mb-0">
              <h3 className="text-lg font-semibold mb-4 text-orange-500">About</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/about" className="text-gray-300 hover:text-white transition-colors">About Us</Link>
                </li>
                <li>
                  <Link to="/careers" className="text-gray-300 hover:text-white transition-colors">Careers</Link>
                </li>
                <li>
                  <Link to="/press" className="text-gray-300 hover:text-white transition-colors">Press</Link>
                </li>
                <li>
                  <Link to="/blog" className="text-gray-300 hover:text-white transition-colors">Blog</Link>
                </li>
                <li>
                  <Link to="/partners" className="text-gray-300 hover:text-white transition-colors">Partners</Link>
                </li>
              </ul>
            </div>

            {/* Support Links */}
            <div className="col-span-12 md:col-span-2 mb-8 md:mb-0">
              <h3 className="text-lg font-semibold mb-4 text-orange-500">Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/help" className="text-gray-300 hover:text-white transition-colors">Help Center</Link>
                </li>
                <li>
                  <Link to="/contact" className="text-gray-300 hover:text-white transition-colors">Contact Us</Link>
                </li>
                <li>
                  <Link to="/help#faqs" className="text-gray-300 hover:text-white transition-colors">FAQs</Link>
                </li>
                <li>
                  <Link to="/shipping" className="text-gray-300 hover:text-white transition-colors">Shipping Info</Link>
                </li>
                <li>
                  <Link to="/returns" className="text-gray-300 hover:text-white transition-colors">Returns & Refunds</Link>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div className="col-span-12 md:col-span-2 mb-8 md:mb-0">
              <h3 className="text-lg font-semibold mb-4 text-orange-500">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/terms" className="text-gray-300 hover:text-white transition-colors">Terms of Service</Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/cookies" className="text-gray-300 hover:text-white transition-colors">Cookie Policy</Link>
                </li>
                <li>
                  <Link to="/accessibility" className="text-gray-300 hover:text-white transition-colors">Accessibility</Link>
                </li>
              </ul>
            </div>

            {/* Categories */}
            <div className="col-span-12 md:col-span-3 mb-8 md:mb-0">
              <h3 className="text-lg font-semibold mb-4 text-orange-500">Categories</h3>
              {isCategoriesLoading ? (
                <p className="text-gray-300">Loading categories...</p>
              ) : categoriesError ? (
                <p className="text-red-400">{categoriesError}</p>
              ) : (
                <ul className="space-y-2">
                  {footerCategories.map(category => (
                    <li key={category.uid}>
                      <Link to={`/categories/${category.uid}`} className="text-gray-300 hover:text-white transition-colors">
                        {category.name}
                      </Link>
                    </li>
                  ))}
                  {footerCategories.length === 0 && (
                    <li className="text-gray-300">No categories found</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Mobile Accordion Layout */}
          <div className="md:hidden">
            {/* Company Information */}
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl font-bold text-orange-500">ConstructMart</span>
              </div>
              <p className="text-gray-300 mb-4">
                Your trusted marketplace for quality construction materials and supplies. 
                Building a better future, one project at a time.
              </p>
            </div>

            {/* About Section */}
            <div className="border-t border-gray-700 py-4">
              <button 
                onClick={() => toggleSection('about')}
                className="flex justify-between items-center w-full text-left"
                aria-expanded={expandedSection === 'about'}
              >
                <h3 className="text-lg font-semibold text-orange-500">About</h3>
                <svg className={`w-5 h-5 transition-transform ${expandedSection === 'about' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`mt-3 space-y-2 ${expandedSection === 'about' ? 'block' : 'hidden'}`}>
                <Link to="/about" className="block text-gray-300 hover:text-white">About Us</Link>
                <Link to="/careers" className="block text-gray-300 hover:text-white">Careers</Link>
                <Link to="/press" className="block text-gray-300 hover:text-white">Press</Link>
                <Link to="/blog" className="block text-gray-300 hover:text-white">Blog</Link>
                <Link to="/partners" className="block text-gray-300 hover:text-white">Partners</Link>
              </div>
            </div>

            {/* Support Section */}
            <div className="border-t border-gray-700 py-4">
              <button 
                onClick={() => toggleSection('support')}
                className="flex justify-between items-center w-full text-left"
                aria-expanded={expandedSection === 'support'}
              >
                <h3 className="text-lg font-semibold text-orange-500">Support</h3>
                <svg className={`w-5 h-5 transition-transform ${expandedSection === 'support' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`mt-3 space-y-2 ${expandedSection === 'support' ? 'block' : 'hidden'}`}>
                <Link to="/help" className="block text-gray-300 hover:text-white">Help Center</Link>
                <Link to="/contact" className="block text-gray-300 hover:text-white">Contact Us</Link>
                <Link to="/help#faqs" className="block text-gray-300 hover:text-white">FAQs</Link>
                <Link to="/shipping" className="block text-gray-300 hover:text-white">Shipping Info</Link>
                <Link to="/returns" className="block text-gray-300 hover:text-white">Returns & Refunds</Link>
              </div>
            </div>

            {/* Legal Section */}
            <div className="border-t border-gray-700 py-4">
              <button 
                onClick={() => toggleSection('legal')}
                className="flex justify-between items-center w-full text-left"
                aria-expanded={expandedSection === 'legal'}
              >
                <h3 className="text-lg font-semibold text-orange-500">Legal</h3>
                <svg className={`w-5 h-5 transition-transform ${expandedSection === 'legal' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`mt-3 space-y-2 ${expandedSection === 'legal' ? 'block' : 'hidden'}`}>
                <Link to="/terms" className="block text-gray-300 hover:text-white">Terms of Service</Link>
                <Link to="/privacy" className="block text-gray-300 hover:text-white">Privacy Policy</Link>
                <Link to="/cookies" className="block text-gray-300 hover:text-white">Cookie Policy</Link>
                <Link to="/accessibility" className="block text-gray-300 hover:text-white">Accessibility</Link>
              </div>
            </div>

            {/* Categories Section */}
            <div className="border-t border-gray-700 py-4">
              <button 
                onClick={() => toggleSection('categories')}
                className="flex justify-between items-center w-full text-left"
                aria-expanded={expandedSection === 'categories'}
              >
                <h3 className="text-lg font-semibold text-orange-500">Categories</h3>
                <svg className={`w-5 h-5 transition-transform ${expandedSection === 'categories' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`mt-3 space-y-2 ${expandedSection === 'categories' ? 'block' : 'hidden'}`}>
                {isCategoriesLoading ? (
                  <p className="text-gray-300">Loading categories...</p>
                ) : categoriesError ? (
                  <p className="text-red-400">{categoriesError}</p>
                ) : (
                  <>
                    {footerCategories.map(category => (
                      <Link 
                        key={category.uid} 
                        to={`/categories/${category.uid}`} 
                        className="block text-gray-300 hover:text-white"
                      >
                        {category.name}
                      </Link>
                    ))}
                    {footerCategories.length === 0 && (
                      <p className="text-gray-300">No categories found</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Newsletter Subscription - Shown on all screen sizes */}
          <div className="border-t border-gray-700 pt-8 mt-8">
            <div className="max-w-md mx-auto md:mx-0">
              <h3 className="text-lg font-semibold mb-4 text-orange-500">Stay Updated</h3>
              <p className="text-gray-300 mb-4">
                Subscribe to our newsletter for the latest products, deals, and industry news.
              </p>
              
              {newsletterSubmissionStatus === 'success' ? (
                <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded mb-4">
                  <p>Thank you for subscribing! You'll receive our next newsletter soon.</p>
                </div>
              ) : (
                <form onSubmit={submitNewsletterSignup} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="sr-only">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      placeholder="Your email address"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  
                  {newsletterError && (
                    <div className="text-red-400 text-sm">
                      {newsletterError}
                    </div>
                  )}
                  
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="consent"
                        type="checkbox"
                        checked={newsletterConsent}
                        onChange={(e) => setNewsletterConsent(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="consent" className="text-gray-300">
                        I agree to receive marketing communications from ConstructMart
                      </label>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={newsletterSubmissionStatus === 'submitting'}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:bg-orange-400 disabled:cursor-not-allowed"
                  >
                    {newsletterSubmissionStatus === 'submitting' ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Trust Badges and Copyright */}
        <div className="border-t border-gray-700 mt-12 pt-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              {/* Trust Badges */}
              <div className="mb-6 md:mb-0 flex flex-wrap justify-center md:justify-start gap-4">
                <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">SSL Secure</span>
                <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">PCI Compliant</span>
                <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">Verified Business</span>
              </div>
              
              {/* Language Selector */}
              <div className="mb-6 md:mb-0">
                <select 
                  className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  defaultValue="en"
                  aria-label="Select language"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
            
            {/* Copyright */}
            <div className="mt-8 text-center text-gray-400 text-sm">
              <p>&copy; {currentYear} ConstructMart. All rights reserved.</p>
              <p className="mt-2">
                ConstructMart is committed to supporting the construction industry with quality materials and exceptional service.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;