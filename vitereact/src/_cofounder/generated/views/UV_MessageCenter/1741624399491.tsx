import React, { useState, useEffect, useRef, ChangeEvent, FormEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/main";
import axios from "axios";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

interface Conversation {
  threadUid: string;
  contactName: string;
  contactUid: string;
  contactType: string;
  lastMessagePreview: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  category: string | null;
  priority: 'normal' | 'high' | 'urgent';
  relatedToOrder: string | null;
  relatedToProduct: string | null;
}

interface MessageAttachment {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface Message {
  uid: string;
  senderUid: string;
  senderName: string;
  senderType: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachments: MessageAttachment[];
}

interface ContactInfo {
  uid: string;
  name: string;
  type: string;
  profilePictureUrl: string | null;
  company: string | null;
}

interface RelatedEntity {
  entityType: string | null;
  entityUid: string | null;
  entityName: string | null;
}

interface Thread {
  threadUid: string;
  contactInfo: ContactInfo;
  messages: Message[];
  relatedTo: RelatedEntity;
}

interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

interface MessageFilters {
  unreadOnly: boolean;
  dateRange: DateRange;
  category: string | null;
  priority: string | null;
  search: string | null;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  limit: number;
  totalItems: number;
}

interface NewMessageData {
  recipientUid: string | null;
  subject: string;
  content: string;
  relatedToOrderUid: string | null;
  relatedToProductUid: string | null;
}

interface AttachedFile {
  file: File;
  previewUrl: string | null;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'complete' | 'error';
  errorMessage: string | null;
}

interface Contact {
  uid: string;
  name: string;
  type: string;
  profilePictureUrl: string | null;
  company: string | null;
}

const UV_MessageCenter: React.FC = () => {
  // Get thread_uid from URL params
  const { thread_uid } = useParams<{ thread_uid?: string }>();
  const navigate = useNavigate();
  
  // Get auth info from global state
  const { isAuthenticated, user, token } = useAppSelector(state => state.auth);
  
  // Component state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messageFilters, setMessageFilters] = useState<MessageFilters>({
    unreadOnly: false,
    dateRange: {
      startDate: null,
      endDate: null
    },
    category: null,
    priority: null,
    search: null
  });
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    limit: 20,
    totalItems: 0
  });
  const [newMessageData, setNewMessageData] = useState<NewMessageData>({
    recipientUid: null,
    subject: "",
    content: "",
    relatedToOrderUid: null,
    relatedToProductUid: null
  });
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [contactSearchResults, setContactSearchResults] = useState<Contact[]>([]);
  
  // Search input state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showContactDropdown, setShowContactDropdown] = useState<boolean>(false);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Message container ref for auto-scrolling
  const messageContainerRef = useRef<HTMLDivElement>(null);
  
  // Socket ref
  const socketRef = useRef<Socket | null>(null);
  
  // Message input ref
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Fetch conversations on component mount and when filters change
  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    }
  }, [isAuthenticated, messageFilters]);
  
  // Fetch thread messages when thread_uid changes
  useEffect(() => {
    if (thread_uid && isAuthenticated) {
      fetchThreadMessages(thread_uid);
    }
  }, [thread_uid, isAuthenticated]);
  
  // Scroll to bottom of message container when messages change
  useEffect(() => {
    if (messageContainerRef.current && selectedThread?.messages.length) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [selectedThread?.messages]);
  
  // Set up WebSocket connection
  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket();
      
      // Clean up on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [isAuthenticated, token]);
  
  // Subscribe to thread messages when thread changes
  useEffect(() => {
    if (socketRef.current && selectedThread?.threadUid) {
      // Join thread room
      socketRef.current.emit('join_thread', { thread_uid: selectedThread.threadUid });
      
      // Mark messages as read
      if (selectedThread.messages.some(msg => !msg.isRead && msg.senderUid !== user?.uid)) {
        markThreadAsRead(selectedThread.threadUid);
      }
    }
  }, [selectedThread?.threadUid]);
  
  // Connect to WebSocket
  const connectSocket = () => {
    socketRef.current = io(`${API_URL}/ws`, {
      auth: {
        token
      }
    });
    
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    socketRef.current.on('message', (message: Message) => {
      // Handle incoming message
      if (selectedThread && message.senderUid !== user?.uid && 
          selectedThread.threadUid === thread_uid) {
        
        // Update selected thread with new message
        setSelectedThread(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            messages: [...prev.messages, message]
          };
        });
        
        // Mark thread as read since we're viewing it
        markThreadAsRead(selectedThread.threadUid);
      }
      
      // Update conversations list with new message preview
      updateConversationWithNewMessage(message);
    });
  };
  
  // Update conversation list when new message is received
  const updateConversationWithNewMessage = (message: Message) => {
    setConversations(prev => {
      const updatedConversations = [...prev];
      const conversationIndex = updatedConversations.findIndex(
        conv => conv.threadUid === thread_uid
      );
      
      if (conversationIndex !== -1) {
        const updatedConversation = {
          ...updatedConversations[conversationIndex],
          lastMessagePreview: message.content.substring(0, 50),
          lastMessageTimestamp: message.timestamp
        };
        
        // If message is from someone else and we're not viewing the thread, increment unread count
        if (message.senderUid !== user?.uid && thread_uid !== updatedConversation.threadUid) {
          updatedConversation.unreadCount++;
        }
        
        // Remove the conversation from its current position
        updatedConversations.splice(conversationIndex, 1);
        
        // Add it to the beginning of the array (most recent)
        updatedConversations.unshift(updatedConversation);
      }
      
      return updatedConversations;
    });
  };
  
  // Fetch conversations from the server
  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      
      // Build query params based on filters
      const params = new URLSearchParams();
      params.append('page', pagination.currentPage.toString());
      params.append('limit', pagination.limit.toString());
      
      if (messageFilters.unreadOnly) {
        params.append('unread_only', 'true');
      }
      
      if (messageFilters.dateRange.startDate) {
        params.append('start_date', messageFilters.dateRange.startDate);
      }
      
      if (messageFilters.dateRange.endDate) {
        params.append('end_date', messageFilters.dateRange.endDate);
      }
      
      if (messageFilters.category) {
        params.append('category', messageFilters.category);
      }
      
      if (messageFilters.priority) {
        params.append('priority', messageFilters.priority);
      }
      
      if (messageFilters.search) {
        params.append('search', messageFilters.search);
      }
      
      const response = await axios.get(`/api/messages/threads?${params.toString()}`);
      
      if (response.data.success) {
        setConversations(response.data.conversations);
        setPagination({
          currentPage: response.data.pagination.current_page,
          totalPages: response.data.pagination.total_pages,
          limit: response.data.pagination.limit,
          totalItems: response.data.pagination.total_items
        });
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch messages for a specific thread
  const fetchThreadMessages = async (threadUid: string) => {
    try {
      setIsLoading(true);
      
      const response = await axios.get(`/api/messages/threads/${threadUid}`);
      
      if (response.data.success) {
        setSelectedThread(response.data.thread);
        
        // If there are unread messages, mark them as read
        if (response.data.thread.messages.some((msg: Message) => 
            !msg.isRead && msg.senderUid !== user?.uid)) {
          markThreadAsRead(threadUid);
        }
      }
    } catch (error) {
      console.error('Error fetching thread messages:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send a message in an existing thread
  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedThread || !newMessageData.content.trim()) {
      return;
    }
    
    try {
      // Upload attachments first
      const uploadedAttachments: MessageAttachment[] = [];
      
      for (const file of attachedFiles) {
        if (file.uploadStatus !== 'complete') {
          const attachmentData = await uploadAttachment(file.file);
          if (attachmentData) {
            uploadedAttachments.push(attachmentData);
          }
        } else {
          // Already uploaded files
          const attachmentUrl = file.previewUrl;
          if (attachmentUrl) {
            uploadedAttachments.push({
              fileUrl: attachmentUrl,
              fileName: file.file.name,
              fileType: file.file.type,
              fileSize: file.file.size
            });
          }
        }
      }
      
      // Send message with attachments
      const messageData = {
        thread_uid: selectedThread.threadUid,
        recipient_uid: selectedThread.contactInfo.uid,
        message_content: newMessageData.content,
        attachments: uploadedAttachments
      };
      
      const response = await axios.post('/api/messages', messageData);
      
      if (response.data.success) {
        // Clear message input and attachments
        setNewMessageData(prev => ({
          ...prev,
          content: ""
        }));
        setAttachedFiles([]);
        
        // Focus the input field
        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
        
        // Optimistically update UI with new message
        const newMessage: Message = {
          uid: response.data.message_uid,
          senderUid: user?.uid || '',
          senderName: `${user?.firstName} ${user?.lastName}`,
          senderType: user?.userType || '',
          content: messageData.message_content,
          timestamp: new Date().toISOString(),
          isRead: true,
          attachments: uploadedAttachments
        };
        
        setSelectedThread(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...prev.messages, newMessage]
          };
        });
        
        // Update conversations list with new message preview
        updateConversationWithNewMessage(newMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  // Create a new thread
  const createNewThread = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!newMessageData.recipientUid || !newMessageData.subject || !newMessageData.content.trim()) {
      return;
    }
    
    try {
      // Upload attachments first
      const uploadedAttachments: MessageAttachment[] = [];
      
      for (const file of attachedFiles) {
        if (file.uploadStatus !== 'complete') {
          const attachmentData = await uploadAttachment(file.file);
          if (attachmentData) {
            uploadedAttachments.push(attachmentData);
          }
        } else {
          // Already uploaded files
          const attachmentUrl = file.previewUrl;
          if (attachmentUrl) {
            uploadedAttachments.push({
              fileUrl: attachmentUrl,
              fileName: file.file.name,
              fileType: file.file.type,
              fileSize: file.file.size
            });
          }
        }
      }
      
      // Create new thread
      const threadData = {
        recipient_uid: newMessageData.recipientUid,
        subject: newMessageData.subject,
        message_content: newMessageData.content,
        related_to_order_uid: newMessageData.relatedToOrderUid,
        related_to_product_uid: newMessageData.relatedToProductUid,
        attachments: uploadedAttachments
      };
      
      const response = await axios.post('/api/messages/threads', threadData);
      
      if (response.data.success) {
        // Navigate to the new thread
        navigate(`/messages/${response.data.thread_uid}`);
        
        // Reset compose state
        setIsComposing(false);
        setNewMessageData({
          recipientUid: null,
          subject: "",
          content: "",
          relatedToOrderUid: null,
          relatedToProductUid: null
        });
        setAttachedFiles([]);
        setContactSearchResults([]);
      }
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };
  
  // Upload an attachment
  const uploadAttachment = async (file: File): Promise<MessageAttachment | null> => {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Update file status
      updateFileStatus(file.name, 'uploading', 0);
      
      // Upload file
      const response = await axios.post('/api/messages/attachments', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          updateFileStatus(file.name, 'uploading', percentCompleted);
        }
      });
      
      if (response.data.success) {
        updateFileStatus(file.name, 'complete', 100);
        
        return {
          fileUrl: response.data.file_url,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      updateFileStatus(file.name, 'error', 0, 'Failed to upload file');
      return null;
    }
  };
  
  // Update file status in attachedFiles state
  const updateFileStatus = (
    fileName: string, 
    status: 'pending' | 'uploading' | 'complete' | 'error', 
    progress: number, 
    errorMessage?: string
  ) => {
    setAttachedFiles(prev => 
      prev.map(file => 
        file.file.name === fileName 
          ? { 
              ...file, 
              uploadStatus: status, 
              uploadProgress: progress,
              errorMessage: errorMessage || null
            } 
          : file
      )
    );
  };
  
  // Handle file selection
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    
    if (!files || files.length === 0) return;
    
    // Process each file
    const newFiles: AttachedFile[] = Array.from(files).map(file => {
      // Create object URL for preview
      const previewUrl = URL.createObjectURL(file);
      
      return {
        file,
        previewUrl,
        uploadProgress: 0,
        uploadStatus: 'pending',
        errorMessage: null
      };
    });
    
    // Add to attachedFiles state
    setAttachedFiles(prev => [...prev, ...newFiles]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Remove an attachment
  const removeAttachment = async (index: number) => {
    const fileToRemove = attachedFiles[index];
    
    // If file is already uploaded, send delete request
    if (fileToRemove.uploadStatus === 'complete' && fileToRemove.previewUrl) {
      try {
        const fileUrl = fileToRemove.previewUrl;
        const filePathMatch = fileUrl.match(/\/([^/]+)$/);
        
        if (filePathMatch && filePathMatch[1]) {
          const attachmentUid = filePathMatch[1];
          await axios.delete(`/api/messages/attachments/${attachmentUid}`);
        }
      } catch (error) {
        console.error('Error removing attachment from server:', error);
      }
    }
    
    // Remove from state
    setAttachedFiles(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    
    // Revoke object URL
    if (fileToRemove.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
  };
  
  // Mark thread as read
  const markThreadAsRead = async (threadUid: string) => {
    try {
      await axios.put(`/api/messages/threads/${threadUid}/read`);
      
      // Update conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv.threadUid === threadUid
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
      
      // Update selectedThread
      setSelectedThread(prev => {
        if (!prev || prev.threadUid !== threadUid) return prev;
        
        return {
          ...prev,
          messages: prev.messages.map(msg => ({
            ...msg,
            isRead: true
          }))
        };
      });
    } catch (error) {
      console.error('Error marking thread as read:', error);
    }
  };
  
  // Archive thread
  const archiveThread = async (threadUid: string) => {
    try {
      await axios.put(`/api/messages/threads/${threadUid}/archive`);
      
      // Remove from conversations list
      setConversations(prev => 
        prev.filter(conv => conv.threadUid !== threadUid)
      );
      
      // If this was the selected thread, clear selection
      if (selectedThread?.threadUid === threadUid) {
        setSelectedThread(null);
        navigate('/messages');
      }
    } catch (error) {
      console.error('Error archiving thread:', error);
    }
  };
  
  // Search contacts
  const searchContacts = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setContactSearchResults([]);
      setShowContactDropdown(false);
      return;
    }
    
    try {
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      
      if (response.data.success) {
        setContactSearchResults(response.data.users);
        setShowContactDropdown(true);
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
    }
  };
  
  // Handle contact search input change
  const handleContactSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    searchContacts(query);
  };
  
  // Select a contact from search results
  const selectContact = (contact: Contact) => {
    setNewMessageData(prev => ({
      ...prev,
      recipientUid: contact.uid
    }));
    setSearchTerm(contact.name);
    setShowContactDropdown(false);
  };
  
  // Handle filter changes
  const handleFilterChange = (filterName: keyof MessageFilters, value: any) => {
    setMessageFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };
  
  // Handle date filter changes
  const handleDateFilterChange = (dateType: 'startDate' | 'endDate', value: string | null) => {
    setMessageFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [dateType]: value
      }
    }));
  };
  
  // Format timestamp for message display
  const formatMessageTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'h:mm a');
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };
  
  // Format timestamp for conversation list
  const formatConversationTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };
  
  // Render attachment preview based on file type
  const renderAttachmentPreview = (attachment: MessageAttachment) => {
    const fileType = attachment.fileType.split('/')[0];
    
    switch (fileType) {
      case 'image':
        return (
          <div className="relative w-32 h-32 rounded overflow-hidden border border-gray-200">
            <img 
              src={attachment.fileUrl} 
              alt={attachment.fileName} 
              className="w-full h-full object-cover"
            />
          </div>
        );
      case 'application':
      case 'text':
        return (
          <div className="flex items-center gap-2 p-2 border rounded">
            <div className="bg-gray-100 p-2 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{attachment.fileName}</p>
              <p className="text-xs text-gray-500">
                {(attachment.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>
            <a 
              href={attachment.fileUrl} 
              download={attachment.fileName}
              className="text-blue-600 hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 p-2 border rounded">
            <div className="bg-gray-100 p-2 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{attachment.fileName}</p>
              <p className="text-xs text-gray-500">
                {(attachment.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>
            <a 
              href={attachment.fileUrl} 
              download={attachment.fileName}
              className="text-blue-600 hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          </div>
        );
    }
  };

  // Get contact initial for avatar
  const getContactInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Get priority badge color
  const getPriorityColor = (priority: 'normal' | 'high' | 'urgent') => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <>
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
            <button
              onClick={() => setIsComposing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Message
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="unreadOnly"
                  checked={messageFilters.unreadOnly}
                  onChange={e => handleFilterChange('unreadOnly', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="unreadOnly" className="text-sm text-gray-700">Unread only</label>
              </div>
              
              <div className="flex items-center gap-2">
                <label htmlFor="priorityFilter" className="text-sm text-gray-700">Priority:</label>
                <select
                  id="priorityFilter"
                  value={messageFilters.priority || ''}
                  onChange={e => handleFilterChange('priority', e.target.value || null)}
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label htmlFor="categoryFilter" className="text-sm text-gray-700">Category:</label>
                <select
                  id="categoryFilter"
                  value={messageFilters.category || ''}
                  onChange={e => handleFilterChange('category', e.target.value || null)}
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="order">Order</option>
                  <option value="product">Product</option>
                  <option value="support">Support</option>
                  <option value="general">General</option>
                </select>
              </div>
              
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={messageFilters.search || ''}
                  onChange={e => handleFilterChange('search', e.target.value || null)}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Conversations List */}
            <div className={`w-full md:w-1/3 bg-white rounded-lg shadow-sm overflow-hidden ${selectedThread && 'hidden md:block'}`}>
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Conversations</h2>
              </div>
              {isLoading && conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                  <p className="mt-2 text-gray-500">Loading conversations...</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-12 w-12 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  <p className="mt-2 text-gray-500">No conversations found</p>
                  <button
                    onClick={() => setIsComposing(true)}
                    className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Start a new conversation
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
                  {conversations.map(conversation => (
                    <li
                      key={conversation.threadUid}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedThread?.threadUid === conversation.threadUid ? 'bg-blue-50' : ''}`}
                      onClick={() => navigate(`/messages/${conversation.threadUid}`)}
                    >
                      <div className="px-4 py-4 flex items-start gap-3">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${conversation.unreadCount > 0 ? 'bg-blue-600' : 'bg-gray-500'}`}>
                          {getContactInitial(conversation.contactName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between mb-1">
                            <h3 className={`text-sm font-medium ${conversation.unreadCount > 0 ? 'text-black' : 'text-gray-900'}`}>
                              {conversation.contactName}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {formatConversationTimestamp(conversation.lastMessageTimestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {conversation.priority !== 'normal' && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(conversation.priority)}`}>
                                {conversation.priority}
                              </span>
                            )}
                            {conversation.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {conversation.category}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${conversation.unreadCount > 0 ? 'text-black' : 'text-gray-500'} truncate`}>
                            {conversation.lastMessagePreview}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {conversation.unreadCount} unread
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                    disabled={pagination.currentPage === 1}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Message Thread or Compose New Message */}
            <div className={`w-full md:w-2/3 bg-white rounded-lg shadow-sm overflow-hidden ${!selectedThread && !isComposing && 'hidden md:block'}`}>
              {isComposing ? (
                /* Compose New Message */
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">New Message</h2>
                    <button
                      onClick={() => {
                        setIsComposing(false);
                        setNewMessageData({
                          recipientUid: null,
                          subject: "",
                          content: "",
                          relatedToOrderUid: null,
                          relatedToProductUid: null
                        });
                        setAttachedFiles([]);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <form onSubmit={createNewThread} className="flex-1 flex flex-col">
                    <div className="p-4 space-y-4">
                      <div className="relative">
                        <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-1">
                          Recipient
                        </label>
                        <input
                          type="text"
                          id="recipient"
                          value={searchTerm}
                          onChange={handleContactSearchChange}
                          placeholder="Search for a user..."
                          className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        {showContactDropdown && contactSearchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md max-h-60 overflow-auto border border-gray-200">
                            <ul className="divide-y divide-gray-200">
                              {contactSearchResults.map((contact) => (
                                <li
                                  key={contact.uid}
                                  onClick={() => selectContact(contact)}
                                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-500 flex items-center justify-center text-white">
                                      {getContactInitial(contact.name)}
                                    </div>
                                    <div className="ml-3">
                                      <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                                      <p className="text-xs text-gray-500">{contact.type} {contact.company ? `at ${contact.company}` : ''}</p>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                          Subject
                        </label>
                        <input
                          type="text"
                          id="subject"
                          value={newMessageData.subject}
                          onChange={(e) => setNewMessageData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Enter subject..."
                          className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="relatedOrder" className="block text-sm font-medium text-gray-700 mb-1">
                          Related Order (Optional)
                        </label>
                        <input
                          type="text"
                          id="relatedOrder"
                          value={newMessageData.relatedToOrderUid || ''}
                          onChange={(e) => setNewMessageData(prev => ({ ...prev, relatedToOrderUid: e.target.value || null }))}
                          placeholder="Enter order ID..."
                          className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="relatedProduct" className="block text-sm font-medium text-gray-700 mb-1">
                          Related Product (Optional)
                        </label>
                        <input
                          type="text"
                          id="relatedProduct"
                          value={newMessageData.relatedToProductUid || ''}
                          onChange={(e) => setNewMessageData(prev => ({ ...prev, relatedToProductUid: e.target.value || null }))}
                          placeholder="Enter product ID..."
                          className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                          Message
                        </label>
                        <textarea
                          id="message"
                          value={newMessageData.content}
                          onChange={(e) => setNewMessageData(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Type your message here..."
                          rows={6}
                          className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      {/* Attachments */}
                      {attachedFiles.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Attachments
                          </label>
                          <div className="space-y-2">
                            {attachedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                                <div className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                  </svg>
                                  <span className="text-sm text-gray-700 truncate max-w-xs">{file.file.name}</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {file.uploadStatus === 'uploading' && (
                                    <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-blue-600 rounded-full" 
                                        style={{ width: `${file.uploadProgress}%` }}
                                      ></div>
                                    </div>
                                  )}
                                  
                                  {file.uploadStatus === 'error' && (
                                    <span className="text-xs text-red-600">{file.errorMessage}</span>
                                  )}
                                  
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-auto p-4 border-t border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id="file-upload"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                          multiple
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsComposing(false);
                            setNewMessageData({
                              recipientUid: null,
                              subject: "",
                              content: "",
                              relatedToOrderUid: null,
                              relatedToProductUid: null
                            });
                            setAttachedFiles([]);
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300"
                          disabled={!newMessageData.recipientUid || !newMessageData.subject || !newMessageData.content.trim()}
                        >
                          Send Message
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : selectedThread ? (
                /* Selected Thread */
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate('/messages')}
                          className="md:hidden text-gray-500 hover:text-gray-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                          </svg>
                        </button>
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-500 flex items-center justify-center text-white font-medium">
                          {getContactInitial(selectedThread.contactInfo.name)}
                        </div>
                        <div>
                          <h2 className="text-lg font-medium text-gray-900">{selectedThread.contactInfo.name}</h2>
                          <p className="text-sm text-gray-500">
                            {selectedThread.contactInfo.type} 
                            {selectedThread.contactInfo.company && ` at ${selectedThread.contactInfo.company}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => archiveThread(selectedThread.threadUid)}
                          className="text-gray-500 hover:text-gray-700"
                          title="Archive conversation"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Related info - order or product */}
                    {selectedThread.relatedTo.entityType && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-500">
                          Related to: 
                          {selectedThread.relatedTo.entityType === 'order' ? (
                            <Link 
                              to={`/account/orders/${selectedThread.relatedTo.entityUid}`}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              Order {selectedThread.relatedTo.entityName}
                            </Link>
                          ) : selectedThread.relatedTo.entityType === 'product' ? (
                            <Link 
                              to={`/products/${selectedThread.relatedTo.entityUid}`}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              Product {selectedThread.relatedTo.entityName}
                            </Link>
                          ) : (
                            <span className="ml-1">{selectedThread.relatedTo.entityType}</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Messages */}
                  <div 
                    ref={messageContainerRef}
                    className="flex-1 p-4 overflow-y-auto"
                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                  >
                    {selectedThread.messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                        </svg>
                        <p className="mt-2 text-gray-500">No messages yet</p>
                        <p className="text-sm text-gray-400">Start the conversation by typing a message below</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedThread.messages.map((message, index) => {
                          const isSender = message.senderUid === user?.uid;
                          const showDate = index === 0 || 
                            new Date(message.timestamp).toDateString() !== 
                            new Date(selectedThread.messages[index - 1].timestamp).toDateString();
                          
                          return (
                            <div key={message.uid}>
                              {showDate && (
                                <div className="flex justify-center my-4">
                                  <span className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
                                    {format(new Date(message.timestamp), 'MMMM d, yyyy')}
                                  </span>
                                </div>
                              )}
                              
                              <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-3/4 ${isSender ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'} rounded-lg px-4 py-2 shadow-sm`}>
                                  {!isSender && (
                                    <p className="text-xs text-gray-600 mb-1">{message.senderName}</p>
                                  )}
                                  <p className="whitespace-pre-wrap">{message.content}</p>
                                  
                                  {/* Attachments */}
                                  {message.attachments && message.attachments.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {message.attachments.map((attachment, i) => (
                                        <div key={i}>
                                          {renderAttachmentPreview(attachment)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <div className={`text-xs mt-1 ${isSender ? 'text-blue-200' : 'text-gray-500'} flex justify-between items-center`}>
                                    <span>{formatMessageTimestamp(message.timestamp)}</span>
                                    {isSender && (
                                      <span>
                                        {message.isRead ? (
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1 inline">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                          </svg>
                                        ) : (
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1 inline opacity-70">
                                            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Message input */}
                  <div className="p-4 border-t border-gray-200">
                    <form onSubmit={sendMessage} className="space-y-3">
                      <textarea
                        ref={messageInputRef}
                        value={newMessageData.content}
                        onChange={(e) => setNewMessageData(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Type your message here..."
                        className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        required
                      />
                      
                      {/* Attachments */}
                      {attachedFiles.length > 0 && (
                        <div className="space-y-2">
                          {attachedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                </svg>
                                <span className="text-sm text-gray-700 truncate max-w-xs">{file.file.name}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {file.uploadStatus === 'uploading' && (
                                  <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-600 rounded-full" 
                                      style={{ width: `${file.uploadProgress}%` }}
                                    ></div>
                                  </div>
                                )}
                                
                                {file.uploadStatus === 'error' && (
                                  <span className="text-xs text-red-600">{file.errorMessage}</span>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(index)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id="file-upload"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            multiple
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                            </svg>
                          </button>
                        </div>
                        
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300"
                          disabled={!newMessageData.content.trim()}
                        >
                          Send
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                /* No Thread Selected */
                <div className="flex flex-col items-center justify-center h-96">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No conversation selected</h3>
                  <p className="mt-1 text-gray-500">Select a conversation or start a new one</p>
                  <button
                    onClick={() => setIsComposing(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Start new conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_MessageCenter;