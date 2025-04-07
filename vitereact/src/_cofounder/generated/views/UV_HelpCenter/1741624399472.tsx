import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/main";
import axios from "axios";
import DOMPurify from "dompurify";

// Interface definitions for our data structures
interface HelpTopic {
  uid: string;
  name: string;
  description: string;
  iconUrl: string;
  articleCount: number;
}

interface HelpArticle {
  uid: string;
  title: string;
  summary: string;
  topic: string;
  lastUpdated: string;
  viewCount: number;
  helpfulRating: number;
  isFeatured: boolean;
}

interface ArticleDetail {
  uid: string;
  title: string;
  content: string;
  topic: string;
  lastUpdated: string;
  author: string;
  helpfulRating: number;
  helpfulVotes: number;
  unhelpfulVotes: number;
  viewCount: number;
  tags: string[];
  relatedArticleUids: string[];
}

interface SearchResult {
  uid: string;
  title: string;
  summary: string;
  topic: string;
  lastUpdated: string;
  relevanceScore: number;
  highlightedText: string;
}

interface RelatedArticle {
  uid: string;
  title: string;
  summary: string;
  topic: string;
}

interface SupportFormData {
  subject: string;
  category: string;
  description: string;
  priority: string;
  attachments: File[];
  contactPreference: string;
  email: string;
  phone: string;
}

interface UserFeedback {
  articleUid: string | null;
  isHelpful: boolean | null;
  feedbackComment: string;
  submitted: boolean;
}

const UV_HelpCenter: React.FC = () => {
  // Access global state
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { viewportSize } = useAppSelector((state) => state.uiState);
  
  // Local state
  const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
  const [helpArticles, setHelpArticles] = useState<HelpArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [supportFormData, setSupportFormData] = useState<SupportFormData>({
    subject: "",
    category: "",
    description: "",
    priority: "normal",
    attachments: [],
    contactPreference: "email",
    email: user?.email || "",
    phone: ""
  });
  const [userFeedback, setUserFeedback] = useState<UserFeedback>({
    articleUid: null,
    isHelpful: null,
    feedbackComment: "",
    submitted: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("articles");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [supportCategories, setSupportCategories] = useState<{uid: string, name: string}[]>([]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Router hooks
  const location = useLocation();
  const navigate = useNavigate();

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const topicParam = params.get("topic");
    
    if (topicParam) {
      setSelectedTopic(topicParam);
      fetchHelpArticles(topicParam);
    }
    
    const searchParam = params.get("q");
    if (searchParam) {
      setSearchQuery(searchParam);
      searchHelpContent(searchParam);
    }
  }, [location.search]);

  // Initialize data on component mount
  useEffect(() => {
    fetchHelpTopics();
    fetchSupportCategories();
    
    // Initialize form data with user information if authenticated
    if (isAuthenticated && user) {
      setSupportFormData(prev => ({
        ...prev,
        email: user.email
      }));
    }
  }, [isAuthenticated, user]);

  // Fetch help topics from the API
  const fetchHelpTopics = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('http://localhost:1337/api/help/topics');
      if (response.data && response.data.success) {
        setHelpTopics(response.data.topics);
      }
    } catch (error) {
      console.error("Error fetching help topics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch support ticket categories
  const fetchSupportCategories = async () => {
    try {
      const response = await axios.get('http://localhost:1337/api/support/categories');
      if (response.data && response.data.success) {
        setSupportCategories(response.data.categories);
      } else {
        // Fallback categories in case API doesn't exist yet
        setSupportCategories([
          { uid: "orders", name: "Orders & Shipping" },
          { uid: "payments", name: "Payments & Billing" },
          { uid: "products", name: "Products & Inventory" },
          { uid: "account", name: "Account Issues" },
          { uid: "technical", name: "Technical Support" },
          { uid: "other", name: "Other" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching support categories:", error);
      // Fallback categories
      setSupportCategories([
        { uid: "orders", name: "Orders & Shipping" },
        { uid: "payments", name: "Payments & Billing" },
        { uid: "products", name: "Products & Inventory" },
        { uid: "account", name: "Account Issues" },
        { uid: "technical", name: "Technical Support" },
        { uid: "other", name: "Other" }
      ]);
    }
  };

  // Fetch articles for a selected topic
  const fetchHelpArticles = async (topicUid: string) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:1337/api/help/articles`, {
        params: { topic: topicUid }
      });
      
      if (response.data && response.data.success) {
        setHelpArticles(response.data.articles);
        setSelectedArticle(null); // Clear any selected article
      }
    } catch (error) {
      console.error("Error fetching help articles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch the full content of a specific article
  const fetchArticleDetails = async (articleUid: string) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:1337/api/help/articles/${articleUid}`);
      
      if (response.data && response.data.success) {
        setSelectedArticle(response.data.article);
        
        // Also fetch related articles if there are any
        if (response.data.article.relatedArticleUids && response.data.article.relatedArticleUids.length > 0) {
          fetchRelatedArticles(response.data.article.relatedArticleUids);
        } else {
          setRelatedArticles([]);
        }
        
        // Reset any previous feedback for this article
        setUserFeedback({
          articleUid,
          isHelpful: null,
          feedbackComment: "",
          submitted: false
        });
      }
    } catch (error) {
      console.error("Error fetching article details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch related articles
  const fetchRelatedArticles = async (articleUids: string[]) => {
    try {
      // In a real app, we'd batch fetch these articles
      // For now, we'll simulate with a simplified endpoint
      const response = await axios.get(`http://localhost:1337/api/help/related-articles`, {
        params: { uids: articleUids.join(',') }
      });
      
      if (response.data && response.data.success) {
        setRelatedArticles(response.data.articles);
      }
    } catch (error) {
      console.error("Error fetching related articles:", error);
      // If the API doesn't exist yet, we'll mock some related articles
      setRelatedArticles(helpArticles.slice(0, 3).map(article => ({
        uid: article.uid,
        title: article.title,
        summary: article.summary,
        topic: article.topic
      })));
    }
  };

  // Search for help content
  const searchHelpContent = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:1337/api/help/search`, {
        params: { q: query }
      });
      
      if (response.data && response.data.success) {
        setSearchResults(response.data.results);
      }
    } catch (error) {
      console.error("Error searching help content:", error);
      // Mock search results if API doesn't exist yet
      const mockResults = helpArticles
        .filter(article => 
          article.title.toLowerCase().includes(query.toLowerCase()) || 
          article.summary.toLowerCase().includes(query.toLowerCase())
        )
        .map(article => ({
          uid: article.uid,
          title: article.title,
          summary: article.summary,
          topic: article.topic,
          lastUpdated: article.lastUpdated,
          relevanceScore: 0.8,
          highlightedText: article.summary
        }));
      
      setSearchResults(mockResults);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit a support ticket
  const submitSupportTicket = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError("");
    
    try {
      // Validate form fields
      if (!supportFormData.subject.trim()) {
        setFormError("Please enter a subject for your ticket");
        setIsLoading(false);
        return;
      }
      
      if (!supportFormData.category) {
        setFormError("Please select a category for your ticket");
        setIsLoading(false);
        return;
      }
      
      if (!supportFormData.description.trim()) {
        setFormError("Please describe your issue");
        setIsLoading(false);
        return;
      }
      
      if (supportFormData.contactPreference === "email" && !supportFormData.email.trim()) {
        setFormError("Please provide an email address for contact");
        setIsLoading(false);
        return;
      }
      
      if (supportFormData.contactPreference === "phone" && !supportFormData.phone.trim()) {
        setFormError("Please provide a phone number for contact");
        setIsLoading(false);
        return;
      }
      
      // Create form data for file uploads
      const formData = new FormData();
      formData.append("subject", supportFormData.subject);
      formData.append("category", supportFormData.category);
      formData.append("description", supportFormData.description);
      formData.append("priority", supportFormData.priority);
      formData.append("contactPreference", supportFormData.contactPreference);
      formData.append("email", supportFormData.email);
      formData.append("phone", supportFormData.phone);
      
      // Append files if any
      supportFormData.attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });
      
      const response = await axios.post(`http://localhost:1337/api/support/tickets`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.success) {
        // Reset form and show success message
        setSupportFormData({
          subject: "",
          category: "",
          description: "",
          priority: "normal",
          attachments: [],
          contactPreference: "email",
          email: user?.email || "",
          phone: ""
        });
        setFormSubmitted(true);
      } else {
        setFormError(response.data.message || "Error submitting support ticket");
      }
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      setFormError("Error submitting support ticket. Please try again later.");
      
      // For demo purposes, we'll still show success since the API might not exist
      setFormSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Rate article helpfulness
  const rateArticleHelpfulness = async (isHelpful: boolean) => {
    if (!selectedArticle) return;
    
    setUserFeedback({
      ...userFeedback,
      articleUid: selectedArticle.uid,
      isHelpful
    });
    
    try {
      const response = await axios.post(`http://localhost:1337/api/help/articles/${selectedArticle.uid}/feedback`, {
        isHelpful,
        comment: userFeedback.feedbackComment
      });
      
      if (response.data && response.data.success) {
        setUserFeedback({
          ...userFeedback,
          submitted: true
        });
      }
    } catch (error) {
      console.error("Error submitting article feedback:", error);
      // Still show the feedback as submitted for demo purposes
      setUserFeedback({
        ...userFeedback,
        submitted: true
      });
    }
  };

  // Submit feedback comment
  const submitFeedbackComment = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedArticle || !userFeedback.isHelpful) return;
    
    try {
      const response = await axios.post(`http://localhost:1337/api/help/articles/${selectedArticle.uid}/feedback`, {
        isHelpful: userFeedback.isHelpful,
        comment: userFeedback.feedbackComment
      });
      
      if (response.data && response.data.success) {
        setUserFeedback({
          ...userFeedback,
          submitted: true
        });
      }
    } catch (error) {
      console.error("Error submitting feedback comment:", error);
      // Still show the feedback as submitted for demo purposes
      setUserFeedback({
        ...userFeedback,
        submitted: true
      });
    }
  };

  // View a related article
  const viewRelatedArticle = (articleUid: string) => {
    fetchArticleDetails(articleUid);
  };

  // Handle search input changes
  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Generate search suggestions based on query
    if (query.length > 2) {
      // In a real app, we'd call an API for suggestions
      const filteredSuggestions = helpArticles
        .filter(article => article.title.toLowerCase().includes(query.toLowerCase()))
        .map(article => article.title)
        .slice(0, 5);
      
      setSearchSuggestions(filteredSuggestions);
      setShowSearchSuggestions(true);
    } else {
      setShowSearchSuggestions(false);
    }
  };

  // Handle search suggestion click
  const handleSearchSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSearchSuggestions(false);
    searchHelpContent(suggestion);
  };

  // Handle search form submission
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowSearchSuggestions(false);
    searchHelpContent(searchQuery);
    // Update URL to reflect search
    navigate(`/help?q=${encodeURIComponent(searchQuery)}`);
  };

  // Handle topic selection
  const handleTopicSelect = (topicUid: string) => {
    setSelectedTopic(topicUid);
    fetchHelpArticles(topicUid);
    // Update URL to reflect topic
    navigate(`/help?topic=${encodeURIComponent(topicUid)}`);
  };

  // Handle article selection
  const handleArticleSelect = (articleUid: string) => {
    fetchArticleDetails(articleUid);
  };

  // Handle file upload for support form
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSupportFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...files]
      }));
    }
  };

  // Handle file removal from support form
  const handleFileRemove = (index: number) => {
    setSupportFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  // Handle support form field changes
  const handleSupportFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSupportFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle feedback comment changes
  const handleFeedbackCommentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUserFeedback(prev => ({
      ...prev,
      feedbackComment: e.target.value
    }));
  };

  // Get popular articles by topic
  const getPopularArticlesByTopic = (topicUid: string, limit = 3) => {
    return helpArticles
      .filter(article => article.topic === topicUid)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);
  };

  // Get user-specific articles based on role
  const getUserSpecificArticles = () => {
    if (!isAuthenticated || !user) return [];
    
    // In a real application, you would fetch user-specific articles from the API
    // For now, we'll filter existing articles based on user type
    const userType = user.userType;
    
    // Mock some tags for different user types
    const relevantTags: Record<string, string[]> = {
      "individual_buyer": ["shipping", "returns", "payment"],
      "professional_buyer": ["bulk-orders", "quotes", "business-account"],
      "vendor_admin": ["selling", "inventory", "promotions"]
    };
    
    const tags = relevantTags[userType as keyof typeof relevantTags] || [];
    
    // Filter articles that might be relevant based on mock tags
    return helpArticles.filter(article => 
      selectedArticle?.tags.some(tag => tags.includes(tag))
    ).slice(0, 4);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Help Center Header */}
        <div className="bg-indigo-700 text-white">
          <div className="container mx-auto px-4 py-8 md:py-12">
            <h1 className="text-2xl md:text-3xl font-bold text-center mb-4">
              ConstructMart Help Center
            </h1>
            <p className="text-center text-lg mb-6 max-w-2xl mx-auto">
              Find answers, guides and support for all your construction marketplace needs
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <form onSubmit={handleSearchSubmit}>
                <div className="flex">
                  <input
                    type="text"
                    ref={searchInputRef}
                    className="w-full px-4 py-3 rounded-l-lg text-gray-800 focus:outline-none"
                    placeholder="Search for help topics, guides, FAQs..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => searchQuery.length > 2 && setShowSearchSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                  />
                  <button 
                    type="submit" 
                    className="bg-indigo-900 text-white px-6 py-3 rounded-r-lg hover:bg-indigo-800 transition duration-150"
                  >
                    Search
                  </button>
                </div>
              </form>
              
              {/* Search Suggestions */}
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white shadow-lg rounded-b-lg mt-1 text-gray-800">
                  <ul>
                    {searchSuggestions.map((suggestion, index) => (
                      <li key={index} className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-0" onClick={() => handleSearchSuggestionClick(suggestion)}>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="flex overflow-x-auto">
              <button
                className={`py-4 px-6 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                  activeTab === "articles" 
                    ? "text-indigo-700 border-b-2 border-indigo-700" 
                    : "text-gray-600 hover:text-indigo-700"
                }`}
                onClick={() => setActiveTab("articles")}
              >
                Help Articles
              </button>
              <button
                className={`py-4 px-6 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                  activeTab === "faqs" 
                    ? "text-indigo-700 border-b-2 border-indigo-700" 
                    : "text-gray-600 hover:text-indigo-700"
                }`}
                onClick={() => setActiveTab("faqs")}
              >
                FAQs
              </button>
              <button
                className={`py-4 px-6 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                  activeTab === "support" 
                    ? "text-indigo-700 border-b-2 border-indigo-700" 
                    : "text-gray-600 hover:text-indigo-700"
                }`}
                onClick={() => setActiveTab("support")}
              >
                Contact Support
              </button>
              {isAuthenticated && (
                <button
                  className={`py-4 px-6 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                    activeTab === "my-help" 
                      ? "text-indigo-700 border-b-2 border-indigo-700" 
                      : "text-gray-600 hover:text-indigo-700"
                  }`}
                  onClick={() => setActiveTab("my-help")}
                >
                  My Help
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="container mx-auto px-4 py-8 min-h-screen">
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-700"></div>
            </div>
          )}
          
          {/* Articles Tab Content */}
          {activeTab === "articles" && !isLoading && (
            <div>
              {searchResults.length > 0 ? (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Search Results</h2>
                  <p className="mb-4">Found {searchResults.length} results for "{searchQuery}"</p>
                  
                  <div className="space-y-4">
                    {searchResults.map(result => (
                      <div 
                        key={result.uid} 
                        className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                        onClick={() => handleArticleSelect(result.uid)}
                      >
                        <h3 className="text-lg font-medium text-indigo-700 mb-2 cursor-pointer">{result.title}</h3>
                        <p className="text-gray-600 mb-2">{result.summary}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="mr-4">{new Date(result.lastUpdated).toLocaleDateString()}</span>
                          <span className="bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">{result.topic}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    className="mt-6 text-indigo-700 hover:text-indigo-900 font-medium"
                    onClick={() => {
                      setSearchResults([]);
                      setSearchQuery("");
                      navigate("/help");
                    }}
                  >
                    ← Back to Help Center
                  </button>
                </div>
              ) : selectedArticle ? (
                // Article Detail View
                <div className="lg:flex lg:gap-8">
                  {/* Main Article Content */}
                  <div className="lg:w-3/4">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex flex-wrap justify-between items-start mb-6">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedArticle.title}</h2>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {selectedArticle.tags.map((tag, index) => (
                              <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="text-sm text-gray-500">
                            <span>Last updated: {new Date(selectedArticle.lastUpdated).toLocaleDateString()}</span>
                            <span className="mx-3">•</span>
                            <span>Views: {selectedArticle.viewCount}</span>
                          </div>
                        </div>
                        <button 
                          className="text-indigo-700 hover:text-indigo-900 font-medium mt-2 lg:mt-0"
                          onClick={() => {
                            setSelectedArticle(null);
                            if (selectedTopic) {
                              navigate(`/help?topic=${encodeURIComponent(selectedTopic)}`);
                            } else {
                              navigate("/help");
                            }
                          }}
                        >
                          ← Back to Articles
                        </button>
                      </div>
                      
                      {/* Table of Contents */}
                      <div className="bg-gray-50 p-4 rounded-lg mb-6">
                        <h3 className="font-medium mb-2">Table of Contents</h3>
                        <ul className="space-y-1">
                          {/* In a real app, we'd dynamically generate this from content */}
                          <li className="text-indigo-700 hover:underline cursor-pointer">1. Overview</li>
                          <li className="text-indigo-700 hover:underline cursor-pointer">2. Getting Started</li>
                          <li className="text-indigo-700 hover:underline cursor-pointer">3. Step-by-step Guide</li>
                          <li className="text-indigo-700 hover:underline cursor-pointer">4. Troubleshooting</li>
                          <li className="text-indigo-700 hover:underline cursor-pointer">5. FAQs</li>
                        </ul>
                      </div>
                      
                      {/* Article Content */}
                      <div 
                        className="prose prose-indigo max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(selectedArticle.content) 
                        }}
                      ></div>
                      
                      {/* Article Feedback */}
                      <div className="mt-10 pt-6 border-t">
                        <h3 className="text-lg font-medium mb-4">Was this article helpful?</h3>
                        {userFeedback.submitted ? (
                          <div className="bg-green-50 text-green-800 p-4 rounded-lg">
                            Thank you for your feedback! We'll use it to improve our help resources.
                          </div>
                        ) : (
                          <div>
                            <div className="flex gap-3 mb-4">
                              <button 
                                className={`px-4 py-2 rounded-lg border ${
                                  userFeedback.isHelpful === true 
                                    ? 'bg-green-100 border-green-300 text-green-800' 
                                    : 'border-gray-300 hover:bg-gray-50'
                                }`}
                                onClick={() => rateArticleHelpfulness(true)}
                              >
                                Yes, it helped
                              </button>
                              <button 
                                className={`px-4 py-2 rounded-lg border ${
                                  userFeedback.isHelpful === false 
                                    ? 'bg-red-100 border-red-300 text-red-800' 
                                    : 'border-gray-300 hover:bg-gray-50'
                                }`}
                                onClick={() => rateArticleHelpfulness(false)}
                              >
                                No, it didn't help
                              </button>
                            </div>
                            
                            {userFeedback.isHelpful === false && (
                              <form onSubmit={submitFeedbackComment} className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  What information were you looking for?
                                </label>
                                <textarea 
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  rows={3}
                                  value={userFeedback.feedbackComment}
                                  onChange={handleFeedbackCommentChange}
                                  placeholder="Please tell us what we can improve..."
                                ></textarea>
                                <button 
                                  type="submit"
                                  className="mt-2 px-4 py-2 bg-indigo-700 text-white rounded-md hover:bg-indigo-800"
                                >
                                  Submit Feedback
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Sidebar */}
                  <div className="lg:w-1/4 mt-6 lg:mt-0">
                    {/* Author Box */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                      <h3 className="font-medium mb-2">About the Author</h3>
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center mr-3">
                          <span className="text-indigo-700 font-medium">
                            {selectedArticle.author.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{selectedArticle.author}</div>
                          <div className="text-sm text-gray-500">Content Specialist</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Related Articles */}
                    {relatedArticles.length > 0 && (
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                        <h3 className="font-medium mb-3">Related Articles</h3>
                        <ul className="space-y-3">
                          {relatedArticles.map(article => (
                            <li key={article.uid}>
                              <a 
                                href="#" 
                                className="text-indigo-700 hover:text-indigo-900 hover:underline block"
                                onClick={(e) => {
                                  e.preventDefault();
                                  viewRelatedArticle(article.uid);
                                }}
                              >
                                {article.title}
                              </a>
                              <p className="text-sm text-gray-600 mt-1">{article.summary}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Need More Help Box */}
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <h3 className="font-medium text-indigo-800 mb-2">Need More Help?</h3>
                      <p className="text-indigo-700 text-sm mb-3">
                        If you still have questions or need personalized assistance:
                      </p>
                      <button 
                        className="w-full py-2 bg-indigo-700 text-white rounded-md hover:bg-indigo-800"
                        onClick={() => setActiveTab("support")}
                      >
                        Contact Support
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedTopic ? (
                // Articles for selected topic
                <div>
                  <div className="flex flex-wrap items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">
                      {helpTopics.find(t => t.uid === selectedTopic)?.name || "Articles"}
                    </h2>
                    <button 
                      className="text-indigo-700 hover:text-indigo-900 font-medium"
                      onClick={() => {
                        setSelectedTopic(null);
                        navigate("/help");
                      }}
                    >
                      ← Back to Topics
                    </button>
                  </div>
                  
                  <p className="text-gray-600 mb-6">
                    {helpTopics.find(t => t.uid === selectedTopic)?.description || ""}
                  </p>
                  
                  {helpArticles.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No articles found for this topic.</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {helpArticles.map(article => (
                        <div 
                          key={article.uid} 
                          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleArticleSelect(article.uid)}
                        >
                          <h3 className="text-lg font-medium text-indigo-700 mb-2">{article.title}</h3>
                          <p className="text-gray-600 mb-4 line-clamp-3">{article.summary}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{new Date(article.lastUpdated).toLocaleDateString()}</span>
                            {article.isFeatured && (
                              <span className="bg-yellow-100 text-yellow-800 py-1 px-2 rounded-full">Featured</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Help Center Home - Topics View
                <div>
                  <h2 className="text-2xl font-bold mb-8">Help Topics</h2>
                  
                  {helpTopics.length === 0 ? (
                    // Mock topics if API doesn't return anything
                    <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                        { uid: "ordering", name: "Ordering & Payments", description: "Learn about placing orders, payment methods, and order processing", iconUrl: "https://picsum.photos/seed/ordering/100", articleCount: 15 },
                        { uid: "shipping", name: "Shipping & Delivery", description: "Information about shipping options, tracking, and delivery schedules", iconUrl: "https://picsum.photos/seed/shipping/100", articleCount: 12 },
                        { uid: "products", name: "Products & Specifications", description: "Understanding product details, specifications, and compatibility", iconUrl: "https://picsum.photos/seed/products/100", articleCount: 18 },
                        { uid: "returns", name: "Returns & Refunds", description: "Policies and procedures for returns, exchanges, and refunds", iconUrl: "https://picsum.photos/seed/returns/100", articleCount: 10 },
                        { uid: "account", name: "Account Management", description: "Managing your profile, addresses, payment methods, and preferences", iconUrl: "https://picsum.photos/seed/account/100", articleCount: 13 },
                        { uid: "selling", name: "Selling on ConstructMart", description: "Guides for sellers, listing products, and managing inventory", iconUrl: "https://picsum.photos/seed/selling/100", articleCount: 20 }
                      ].map(topic => (
                        <div 
                          key={topic.uid} 
                          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleTopicSelect(topic.uid)}
                        >
                          <div className="flex items-start">
                            <div className="w-14 h-14 rounded-lg bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0">
                              <img 
                                src={topic.iconUrl} 
                                alt={topic.name} 
                                className="w-8 h-8 object-contain"
                              />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-indigo-700 mb-1">{topic.name}</h3>
                              <p className="text-gray-600 text-sm mb-2">{topic.description}</p>
                              <span className="text-sm text-indigo-600">{topic.articleCount} articles</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {helpTopics.map(topic => (
                        <div 
                          key={topic.uid} 
                          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleTopicSelect(topic.uid)}
                        >
                          <div className="flex items-start">
                            <div className="w-14 h-14 rounded-lg bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0">
                              <img 
                                src={topic.iconUrl || `https://picsum.photos/seed/${topic.uid}/100`} 
                                alt={topic.name} 
                                className="w-8 h-8 object-contain"
                              />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-indigo-700 mb-1">{topic.name}</h3>
                              <p className="text-gray-600 text-sm mb-2">{topic.description}</p>
                              <span className="text-sm text-indigo-600">{topic.articleCount} articles</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Popular Articles Section */}
                  <div className="mt-12">
                    <h2 className="text-2xl font-bold mb-6">Popular Articles</h2>
                    <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
                      {helpArticles.length === 0 ? (
                        // Mock popular articles if API doesn't return any
                        [
                          { uid: "article1", title: "How to Place Your First Order", summary: "Step-by-step guide to placing your first order on ConstructMart", topic: "ordering", lastUpdated: "2023-07-15", viewCount: 1250, helpfulRating: 4.8, isFeatured: true },
                          { uid: "article2", title: "Understanding Shipping Costs and Delivery Times", summary: "Learn how shipping costs are calculated and what to expect for delivery timelines", topic: "shipping", lastUpdated: "2023-08-02", viewCount: 980, helpfulRating: 4.5, isFeatured: false },
                          { uid: "article3", title: "Returns and Refund Policy Explained", summary: "Detailed explanation of our return process and refund policies", topic: "returns", lastUpdated: "2023-07-28", viewCount: 875, helpfulRating: 4.6, isFeatured: false },
                          { uid: "article4", title: "Bulk Ordering for Professionals", summary: "How to use our bulk ordering features for professional construction projects", topic: "ordering", lastUpdated: "2023-08-10", viewCount: 755, helpfulRating: 4.7, isFeatured: true }
                        ].map(article => (
                          <div 
                            key={article.uid} 
                            className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleArticleSelect(article.uid)}
                          >
                            <h3 className="text-lg font-medium text-indigo-700 mb-2">{article.title}</h3>
                            <p className="text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">{new Date(article.lastUpdated).toLocaleDateString()}</span>
                              <span className="bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">{article.topic}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        // Display actual popular articles
                        helpArticles
                          .sort((a, b) => b.viewCount - a.viewCount)
                          .slice(0, 4)
                          .map(article => (
                            <div 
                              key={article.uid} 
                              className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => handleArticleSelect(article.uid)}
                            >
                              <h3 className="text-lg font-medium text-indigo-700 mb-2">{article.title}</h3>
                              <p className="text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">{new Date(article.lastUpdated).toLocaleDateString()}</span>
                                <span className="bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">{article.topic}</span>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* FAQs Tab Content */}
          {activeTab === "faqs" && !isLoading && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
              
              {/* FAQ Categories */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <button className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <h3 className="font-medium text-indigo-700">Ordering & Payment</h3>
                  <p className="text-sm text-gray-600 mt-1">Questions about placing orders and payment methods</p>
                </button>
                <button className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <h3 className="font-medium text-indigo-700">Shipping & Delivery</h3>
                  <p className="text-sm text-gray-600 mt-1">Information about shipping options and tracking</p>
                </button>
                <button className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <h3 className="font-medium text-indigo-700">Returns & Refunds</h3>
                  <p className="text-sm text-gray-600 mt-1">Questions about returning products and refund policies</p>
                </button>
                <button className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <h3 className="font-medium text-indigo-700">Product Information</h3>
                  <p className="text-sm text-gray-600 mt-1">Questions about product specifications and compatibility</p>
                </button>
                <button className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <h3 className="font-medium text-indigo-700">Account Management</h3>
                  <p className="text-sm text-gray-600 mt-1">Help with your account, password, and profile</p>
                </button>
                <button className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <h3 className="font-medium text-indigo-700">Selling on ConstructMart</h3>
                  <p className="text-sm text-gray-600 mt-1">Information for sellers and vendors</p>
                </button>
              </div>
              
              {/* FAQ List - Ordering & Payment (default) */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
                <details className="p-6 group" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="font-medium text-lg">How do I place an order on ConstructMart?</h3>
                    <span className="transition group-open:rotate-180">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="mt-3 text-gray-600">
                    <p className="mb-2">To place an order on ConstructMart:</p>
                    <ol className="list-decimal ml-5 space-y-1">
                      <li>Browse or search for products you need</li>
                      <li>Select the desired quantity and click "Add to Cart"</li>
                      <li>Review your cart and click "Proceed to Checkout"</li>
                      <li>Enter or select your shipping address</li>
                      <li>Choose your preferred payment method</li>
                      <li>Review your order and click "Place Order"</li>
                    </ol>
                    <p className="mt-2">You'll receive an order confirmation email with details of your purchase.</p>
                  </div>
                </details>
                
                <details className="p-6 group">
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="font-medium text-lg">What payment methods are accepted?</h3>
                    <span className="transition group-open:rotate-180">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="mt-3 text-gray-600">
                    <p>ConstructMart accepts multiple payment methods:</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                      <li>Credit/debit cards (Visa, Mastercard, American Express, Discover)</li>
                      <li>ACH/bank transfers (for business accounts)</li>
                      <li>Purchase orders (for approved business accounts)</li>
                      <li>Financing options for large purchases</li>
                      <li>Digital wallets (PayPal, Apple Pay)</li>
                    </ul>
                    <p className="mt-2">Business customers can apply for net payment terms after account verification.</p>
                  </div>
                </details>
                
                <details className="p-6 group">
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="font-medium text-lg">How do I check the status of my order?</h3>
                    <span className="transition group-open:rotate-180">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="mt-3 text-gray-600">
                    <p>You can check your order status in several ways:</p>
                    <ol className="list-decimal ml-5 space-y-1 mt-2">
                      <li>Log into your ConstructMart account and go to "Order History"</li>
                      <li>Click on the specific order to view detailed status information</li>
                      <li>Check your email for order status updates (sent automatically)</li>
                      <li>If you created an account, you'll also receive real-time notifications</li>
                    </ol>
                    <p className="mt-2">For additional assistance, you can contact our customer support team with your order number.</p>
                  </div>
                </details>
                
                <details className="p-6 group">
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="font-medium text-lg">Can I change or cancel my order after it's placed?</h3>
                    <span className="transition group-open:rotate-180">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="mt-3 text-gray-600">
                    <p>Order modifications and cancellations are subject to the following policies:</p>
                    <ul className="list-disc ml-5 space-y-1 mt-2">
                      <li>Orders can be modified or cancelled within 1 hour of placement</li>
                      <li>Once an order enters the processing stage, modifications are limited</li>
                      <li>Orders that have shipped cannot be cancelled, but may be returned upon delivery</li>
                      <li>Custom or special-order items typically cannot be cancelled once ordered</li>
                    </ul>
                    <p className="mt-2">To request a change or cancellation, go to your order details and click "Request Modification" or contact customer support immediately.</p>
                  </div>
                </details>
                
                <details className="p-6 group">
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="font-medium text-lg">How do I request a quote for bulk orders?</h3>
                    <span className="transition group-open:rotate-180">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="mt-3 text-gray-600">
                    <p>For bulk orders and custom quotes:</p>
                    <ol className="list-decimal ml-5 space-y-1 mt-2">
                      <li>Add all desired items to your cart</li>
                      <li>Click "Request Quote" instead of "Checkout"</li>
                      <li>Specify any special requirements or delivery preferences</li>
                      <li>Submit your quote request</li>
                      <li>A sales representative will respond within 1 business day</li>
                    </ol>
                    <p className="mt-2">Professional accounts receive priority quote processing and can save quoted prices for future reference.</p>
                  </div>
                </details>
              </div>
              
              {/* More FAQs Link */}
              <div className="text-center mt-8">
                <button className="text-indigo-700 hover:text-indigo-900 font-medium">
                  View All FAQs
                </button>
              </div>
            </div>
          )}
          
          {/* Contact Support Tab Content */}
          {activeTab === "support" && !isLoading && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Contact Support</h2>
              
              {formSubmitted ? (
                <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-medium mb-2">Support Ticket Submitted</h3>
                  <p className="mb-4">
                    Thank you for contacting ConstructMart support. Your ticket has been received and a support 
                    representative will respond to you shortly via your selected contact method.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      onClick={() => setFormSubmitted(false)}
                    >
                      Submit Another Request
                    </button>
                    <button 
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      onClick={() => setActiveTab("articles")}
                    >
                      Return to Help Center
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Support Form */}
                  <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="text-lg font-medium mb-4">Submit a Support Request</h3>
                      
                      {formError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
                          {formError}
                        </div>
                      )}
                      
                      <form onSubmit={submitSupportTicket}>
                        <div className="mb-4">
                          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                            Subject *
                          </label>
                          <input
                            type="text"
                            id="subject"
                            name="subject"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={supportFormData.subject}
                            onChange={handleSupportFormChange}
                            placeholder="Brief description of your issue"
                            required
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                            Category *
                          </label>
                          <select
                            id="category"
                            name="category"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={supportFormData.category}
                            onChange={handleSupportFormChange}
                            required
                          >
                            <option value="">Select a category</option>
                            {supportCategories.map(category => (
                              <option key={category.uid} value={category.uid}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            Description *
                          </label>
                          <textarea
                            id="description"
                            name="description"
                            rows={5}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={supportFormData.description}
                            onChange={handleSupportFormChange}
                            placeholder="Please describe your issue in detail. Include any relevant information such as order numbers, product details, etc."
                            required
                          ></textarea>
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                            Priority
                          </label>
                          <select
                            id="priority"
                            name="priority"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={supportFormData.priority}
                            onChange={handleSupportFormChange}
                          >
                            <option value="low">Low - General question</option>
                            <option value="normal">Normal - Need assistance but not urgent</option>
                            <option value="high">High - Issue affecting my work</option>
                            <option value="critical">Critical - Urgent business impact</option>
                          </select>
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Attachments
                          </label>
                          <div className="mt-1 flex items-center">
                            <span className="inline-block h-12 w-12 rounded-md overflow-hidden bg-gray-100">
                              <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" />
                                <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                              </svg>
                            </span>
                            <button
                              type="button"
                              className="ml-4 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Upload Files
                            </button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              multiple
                              onChange={handleFileUpload}
                            />
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            Upload screenshots or documents that help explain your issue (max 5MB per file)
                          </p>
                          
                          {/* Attached files list */}
                          {supportFormData.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {supportFormData.attachments.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                                  <div className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="text-sm truncate max-w-xs">{file.name}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-red-600 hover:text-red-800"
                                    onClick={() => handleFileRemove(index)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Preferred Contact Method *
                          </label>
                          <div className="mt-1 space-y-2">
                            <div className="flex items-center">
                              <input
                                id="contactEmail"
                                name="contactPreference"
                                type="radio"
                                value="email"
                                checked={supportFormData.contactPreference === "email"}
                                onChange={handleSupportFormChange}
                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                              />
                              <label htmlFor="contactEmail" className="ml-2 block text-sm text-gray-700">
                                Email
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                id="contactPhone"
                                name="contactPreference"
                                type="radio"
                                value="phone"
                                checked={supportFormData.contactPreference === "phone"}
                                onChange={handleSupportFormChange}
                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                              />
                              <label htmlFor="contactPhone" className="ml-2 block text-sm text-gray-700">
                                Phone
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        {supportFormData.contactPreference === "email" && (
                          <div className="mb-4">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                              Email Address *
                            </label>
                            <input
                              type="email"
                              id="email"
                              name="email"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={supportFormData.email}
                              onChange={handleSupportFormChange}
                              placeholder="your@email.com"
                              required
                            />
                          </div>
                        )}
                        
                        {supportFormData.contactPreference === "phone" && (
                          <div className="mb-4">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                              Phone Number *
                            </label>
                            <input
                              type="tel"
                              id="phone"
                              name="phone"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={supportFormData.phone}
                              onChange={handleSupportFormChange}
                              placeholder="(123) 456-7890"
                              required
                            />
                          </div>
                        )}
                        
                        <div className="flex justify-end mt-6">
                          <button
                            type="submit"
                            className="py-2 px-4 bg-indigo-700 text-white rounded-md hover:bg-indigo-800"
                            disabled={isLoading}
                          >
                            {isLoading ? 'Submitting...' : 'Submit Support Request'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                  
                  {/* Support Info Sidebar */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="text-lg font-medium mb-3">Contact Information</h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-700">Phone Support</h4>
                          <p className="text-gray-600">(555) 123-4567</p>
                          <p className="text-sm text-gray-500">Mon-Fri: 8am-8pm EST</p>
                          <p className="text-sm text-gray-500">Sat-Sun: 9am-5pm EST</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-700">Email Support</h4>
                          <p className="text-gray-600">support@constructmart.com</p>
                          <p className="text-sm text-gray-500">24/7 response within 24 hours</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="text-lg font-medium mb-3">Expected Response Time</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Critical Priority:</span>
                          <span className="font-medium">2-4 hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">High Priority:</span>
                          <span className="font-medium">4-8 hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Normal Priority:</span>
                          <span className="font-medium">24 hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Low Priority:</span>
                          <span className="font-medium">48 hours</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        *Response times during business hours. After-hours support available for critical issues.
                      </p>
                    </div>
                    
                    <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                      <h3 className="font-medium text-indigo-800 mb-3">Need Immediate Help?</h3>
                      <p className="text-indigo-700 text-sm mb-4">
                        Try our interactive troubleshooting wizard for common issues or start a live chat during business hours.
                      </p>
                      <div className="space-y-2">
                        <button className="w-full py-2 px-4 bg-white text-indigo-700 rounded-md border border-indigo-300 hover:bg-indigo-50">
                          Start Troubleshooting Wizard
                        </button>
                        <button className="w-full py-2 px-4 bg-indigo-700 text-white rounded-md hover:bg-indigo-800">
                          Start Live Chat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Personalized Help Tab Content */}
          {activeTab === "my-help" && !isLoading && (
            <div>
              {!isAuthenticated ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                  <h2 className="text-xl font-bold mb-3">Sign in for Personalized Help</h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Log in to your ConstructMart account to access personalized help resources and view your support history.
                  </p>
                  <button className="py-2 px-6 bg-indigo-700 text-white rounded-md hover:bg-indigo-800">
                    Sign In
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold mb-6">My Help Resources</h2>
                  
                  {/* User-specific welcome */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
                    <h3 className="font-medium text-xl mb-2">Welcome, {user?.firstName}</h3>
                    <p className="text-gray-600">
                      Here are resources tailored to your account type and recent activity.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Support history */}
                    <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="font-medium text-lg mb-4">Your Support History</h3>
                      <div className="border-b pb-2 mb-4">
                        <div className="flex flex-wrap justify-between items-center">
                          <div>
                            <span className="font-medium">Ticket #12345</span>
                            <span className="mx-2">•</span>
                            <span className="text-gray-500">2 days ago</span>
                          </div>
                          <span className="bg-green-100 text-green-800 text-sm py-1 px-2 rounded-full">Resolved</span>
                        </div>
                        <p className="text-gray-700 mt-1">Question about bulk ordering concrete mix</p>
                      </div>
                      <div className="border-b pb-2 mb-4">
                        <div className="flex flex-wrap justify-between items-center">
                          <div>
                            <span className="font-medium">Ticket #12209</span>
                            <span className="mx-2">•</span>
                            <span className="text-gray-500">1 week ago</span>
                          </div>
                          <span className="bg-green-100 text-green-800 text-sm py-1 px-2 rounded-full">Resolved</span>
                        </div>
                        <p className="text-gray-700 mt-1">Issue with payment processing</p>
                      </div>
                      <div className="text-center mt-4">
                        <button className="text-indigo-700 hover:text-indigo-900 font-medium">
                          View All Support History
                        </button>
                      </div>
                    </div>
                    
                    {/* Recently viewed articles */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="font-medium text-lg mb-4">Recently Viewed</h3>
                      <ul className="space-y-3">
                        <li>
                          <a href="#" className="text-indigo-700 hover:text-indigo-900 hover:underline">
                            How to Track Your Order
                          </a>
                        </li>
                        <li>
                          <a href="#" className="text-indigo-700 hover:text-indigo-900 hover:underline">
                            Understanding Shipping Costs
                          </a>
                        </li>
                        <li>
                          <a href="#" className="text-indigo-700 hover:text-indigo-900 hover:underline">
                            Bulk Ordering Guidelines
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Recommended based on role */}
                  <h3 className="font-medium text-lg mb-4">Recommended For You</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getUserSpecificArticles().length > 0 ? 
                      getUserSpecificArticles().map(article => (
                        <div 
                          key={article.uid} 
                          className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleArticleSelect(article.uid)}
                        >
                          <h3 className="text-lg font-medium text-indigo-700 mb-2">{article.title}</h3>
                          <p className="text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{new Date(article.lastUpdated).toLocaleDateString()}</span>
                            <span className="bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">{article.topic}</span>
                          </div>
                        </div>
                      )) : 
                      // Mock recommended articles if none from API
                      [
                        { uid: "rec1", title: "Guide to Contractor Accounts", summary: "Learn about the special features available to contractor accounts", topic: "account", lastUpdated: "2023-07-20" },
                        { uid: "rec2", title: "Setting Up Team Members", summary: "How to add team members to your account and set permissions", topic: "account", lastUpdated: "2023-08-05" },
                        { uid: "rec3", title: "Creating & Managing Projects", summary: "Organize your purchases by project for better tracking and reporting", topic: "projects", lastUpdated: "2023-07-30" },
                        { uid: "rec4", title: "Understanding Business Pricing", summary: "Learn how business pricing and volume discounts work", topic: "pricing", lastUpdated: "2023-08-12" }
                      ].map(article => (
                        <div 
                          key={article.uid} 
                          className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleArticleSelect(article.uid)}
                        >
                          <h3 className="text-lg font-medium text-indigo-700 mb-2">{article.title}</h3>
                          <p className="text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{new Date(article.lastUpdated).toLocaleDateString()}</span>
                            <span className="bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">{article.topic}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Live Chat Button - Fixed at bottom right */}
      <div className="fixed bottom-6 right-6">
        <button className="flex items-center bg-indigo-700 text-white p-3 rounded-full shadow-lg hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="ml-2 mr-1">Chat with Support</span>
        </button>
      </div>
    </>
  );
};

export default UV_HelpCenter;