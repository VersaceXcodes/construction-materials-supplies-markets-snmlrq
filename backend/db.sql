-- Create tables for ConstructMart database

-- 1. Companies table
CREATE TABLE companies (
    uid VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('buyer', 'seller', 'both')),
    tax_id VARCHAR(50),
    logo_url VARCHAR(255),
    description TEXT,
    website VARCHAR(255),
    industry VARCHAR(100),
    established_year INTEGER,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_documents JSONB,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Users table
CREATE TABLE users (
    uid VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20),
    user_type VARCHAR(30) NOT NULL DEFAULT 'individual_buyer' CHECK (user_type IN ('individual_buyer', 'professional_buyer', 'procurement_team', 'vendor_admin', 'inventory_manager', 'order_fulfillment', 'system_admin', 'customer_support')),
    profile_picture_url VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    last_login TIMESTAMP,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    company_uid VARCHAR(50) REFERENCES companies(uid),
    communication_preferences JSONB,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. Categories table
CREATE TABLE categories (
    uid VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_uid VARCHAR(50) REFERENCES categories(uid),
    description TEXT,
    image_url VARCHAR(255),
    display_order INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    attributes JSONB
);

-- 4. Products table
CREATE TABLE products (
    uid VARCHAR(50) PRIMARY KEY,
    seller_uid VARCHAR(50) NOT NULL REFERENCES companies(uid),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    main_category_uid VARCHAR(50) NOT NULL REFERENCES categories(uid),
    subcategory_uid VARCHAR(50) REFERENCES categories(uid),
    brand VARCHAR(100),
    manufacturer VARCHAR(100),
    short_description VARCHAR(500) NOT NULL,
    long_description TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    quantity_available INTEGER NOT NULL DEFAULT 0,
    unit_of_measure VARCHAR(30) NOT NULL,
    weight NUMERIC(10, 2),
    dimensions JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    technical_specifications JSONB,
    warranty_information TEXT,
    certification_details TEXT,
    minimum_order_quantity INTEGER NOT NULL DEFAULT 1,
    lead_time_days INTEGER,
    special_shipping_requirements TEXT,
    return_policy TEXT,
    meta_title VARCHAR(200),
    meta_description VARCHAR(500),
    average_rating NUMERIC(3, 2),
    total_reviews INTEGER NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_views INTEGER NOT NULL DEFAULT 0
);

-- 5. Product Variants table
CREATE TABLE product_variants (
    uid VARCHAR(50) PRIMARY KEY,
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    variant_type VARCHAR(50) NOT NULL,
    variant_value VARCHAR(100) NOT NULL,
    additional_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sku_extension VARCHAR(50),
    quantity_available INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    image_url VARCHAR(255)
);

-- 6. Product Images table
CREATE TABLE product_images (
    uid VARCHAR(50) PRIMARY KEY,
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    variant_uid VARCHAR(50) REFERENCES product_variants(uid),
    image_url VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL
);

-- 7. Product Specifications table
CREATE TABLE product_specifications (
    uid VARCHAR(50) PRIMARY KEY,
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    specification_name VARCHAR(100) NOT NULL,
    specification_value VARCHAR(255) NOT NULL,
    specification_unit VARCHAR(50),
    specification_group VARCHAR(100),
    display_order INTEGER,
    is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
    is_comparable BOOLEAN NOT NULL DEFAULT FALSE
);

-- 8. Projects table
CREATE TABLE projects (
    uid VARCHAR(50) PRIMARY KEY,
    company_uid VARCHAR(50) NOT NULL REFERENCES companies(uid),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    budget NUMERIC(14, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
    created_by VARCHAR(50) NOT NULL REFERENCES users(uid),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    location VARCHAR(255),
    project_code VARCHAR(50)
);

-- 9. Project Members table
CREATE TABLE project_members (
    uid VARCHAR(50) PRIMARY KEY,
    project_uid VARCHAR(50) NOT NULL REFERENCES projects(uid),
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    role VARCHAR(30) NOT NULL CHECK (role IN ('manager', 'team_member', 'viewer')),
    created_at TIMESTAMP NOT NULL
);

-- 10. Addresses table
CREATE TABLE addresses (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) REFERENCES users(uid),
    company_uid VARCHAR(50) REFERENCES companies(uid),
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('shipping', 'billing', 'both')),
    name VARCHAR(100),
    recipient_name VARCHAR(100) NOT NULL,
    street_address_1 VARCHAR(255) NOT NULL,
    street_address_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
    special_instructions TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    project_uid VARCHAR(50) REFERENCES projects(uid)
);

-- 11. Payment Methods table
CREATE TABLE payment_methods (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) REFERENCES users(uid),
    company_uid VARCHAR(50) REFERENCES companies(uid),
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('credit_card', 'bank_account', 'purchase_order')),
    provider VARCHAR(50),
    account_number_last_four VARCHAR(4),
    cardholder_name VARCHAR(100),
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    billing_address_uid VARCHAR(50) REFERENCES addresses(uid),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    payment_token VARCHAR(255)
);

-- 12. Shopping Carts table
CREATE TABLE shopping_carts (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    company_uid VARCHAR(50) REFERENCES companies(uid),
    name VARCHAR(100),
    project_uid VARCHAR(50) REFERENCES projects(uid),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT
);

-- 13. Cart Items table
CREATE TABLE cart_items (
    uid VARCHAR(50) PRIMARY KEY,
    cart_uid VARCHAR(50) NOT NULL REFERENCES shopping_carts(uid),
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    variant_uid VARCHAR(50) REFERENCES product_variants(uid),
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at TIMESTAMP NOT NULL,
    price_snapshot NUMERIC(10, 2) NOT NULL,
    is_saved_for_later BOOLEAN NOT NULL DEFAULT FALSE
);

-- 14. Wishlists table
CREATE TABLE wishlists (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 15. Wishlist Items table
CREATE TABLE wishlist_items (
    uid VARCHAR(50) PRIMARY KEY,
    wishlist_uid VARCHAR(50) NOT NULL REFERENCES wishlists(uid),
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    variant_uid VARCHAR(50) REFERENCES product_variants(uid),
    added_at TIMESTAMP NOT NULL,
    notes TEXT
);

-- 16. Quote Requests table
CREATE TABLE quote_requests (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    company_uid VARCHAR(50) REFERENCES companies(uid),
    project_uid VARCHAR(50) REFERENCES projects(uid),
    request_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'quoted', 'accepted', 'rejected', 'expired')),
    requested_delivery_date TIMESTAMP,
    special_requirements TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    expiration_date TIMESTAMP,
    notes TEXT
);

-- 17. Quote Items table
CREATE TABLE quote_items (
    uid VARCHAR(50) PRIMARY KEY,
    quote_uid VARCHAR(50) NOT NULL REFERENCES quote_requests(uid),
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    variant_uid VARCHAR(50) REFERENCES product_variants(uid),
    quantity INTEGER NOT NULL,
    requested_unit_price NUMERIC(10, 2),
    quoted_unit_price NUMERIC(10, 2),
    notes TEXT
);

-- 18. Orders table
CREATE TABLE orders (
    uid VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    company_uid VARCHAR(50) REFERENCES companies(uid),
    project_uid VARCHAR(50) REFERENCES projects(uid),
    order_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
    order_date TIMESTAMP NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    shipping_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'paid', 'refunded', 'partially_refunded')),
    shipping_address_uid VARCHAR(50) NOT NULL REFERENCES addresses(uid),
    billing_address_uid VARCHAR(50) NOT NULL REFERENCES addresses(uid),
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(100),
    estimated_delivery_date TIMESTAMP,
    actual_delivery_date TIMESTAMP,
    special_instructions TEXT,
    is_gift BOOLEAN NOT NULL DEFAULT FALSE,
    gift_message TEXT,
    converted_from_quote_uid VARCHAR(50) REFERENCES quote_requests(uid),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    notes TEXT
);

-- 19. Order Items table
CREATE TABLE order_items (
    uid VARCHAR(50) PRIMARY KEY,
    order_uid VARCHAR(50) NOT NULL REFERENCES orders(uid),
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    variant_uid VARCHAR(50) REFERENCES product_variants(uid),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'shipped', 'delivered', 'returned')),
    tracking_number VARCHAR(100),
    return_requested BOOLEAN NOT NULL DEFAULT FALSE,
    return_reason TEXT,
    return_status VARCHAR(20) CHECK (return_status IN ('requested', 'approved', 'received', 'refunded', 'rejected')),
    return_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 20. Reviews table
CREATE TABLE reviews (
    uid VARCHAR(50) PRIMARY KEY,
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    order_item_uid VARCHAR(50) REFERENCES order_items(uid),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT NOT NULL,
    pros TEXT,
    cons TEXT,
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    project_type VARCHAR(100),
    reviewer_type VARCHAR(50),
    helpful_votes_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 21. Review Images table
CREATE TABLE review_images (
    uid VARCHAR(50) PRIMARY KEY,
    review_uid VARCHAR(50) NOT NULL REFERENCES reviews(uid),
    image_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- 22. Questions table
CREATE TABLE questions (
    uid VARCHAR(50) PRIMARY KEY,
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    question_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected'))
);

-- 23. Answers table
CREATE TABLE answers (
    uid VARCHAR(50) PRIMARY KEY,
    question_uid VARCHAR(50) NOT NULL REFERENCES questions(uid),
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    is_seller BOOLEAN NOT NULL DEFAULT FALSE,
    answer_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    helpful_votes_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected'))
);

-- 24. Messages table
CREATE TABLE messages (
    uid VARCHAR(50) PRIMARY KEY,
    thread_uid VARCHAR(50) NOT NULL,
    sender_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    recipient_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    related_to_order_uid VARCHAR(50) REFERENCES orders(uid),
    related_to_product_uid VARCHAR(50) REFERENCES products(uid),
    subject VARCHAR(255),
    message_content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    category VARCHAR(20) CHECK (category IN ('inquiry', 'order', 'return', 'support', 'other'))
);

-- 25. Message Attachments table
CREATE TABLE message_attachments (
    uid VARCHAR(50) PRIMARY KEY,
    message_uid VARCHAR(50) NOT NULL REFERENCES messages(uid),
    file_url VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- 26. Support Tickets table
CREATE TABLE support_tickets (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('account', 'order', 'product', 'payment', 'technical', 'other')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')),
    assigned_to VARCHAR(50) REFERENCES users(uid),
    related_order_uid VARCHAR(50) REFERENCES orders(uid),
    related_product_uid VARCHAR(50) REFERENCES products(uid),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5)
);

-- 27. Ticket Responses table
CREATE TABLE ticket_responses (
    uid VARCHAR(50) PRIMARY KEY,
    ticket_uid VARCHAR(50) NOT NULL REFERENCES support_tickets(uid),
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    is_staff BOOLEAN NOT NULL,
    response_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE
);

-- 28. Promotions table
CREATE TABLE promotions (
    uid VARCHAR(50) PRIMARY KEY,
    seller_uid VARCHAR(50) NOT NULL REFERENCES companies(uid),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    promotion_type VARCHAR(30) NOT NULL CHECK (promotion_type IN ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y')),
    discount_value NUMERIC(10, 2) NOT NULL,
    minimum_purchase_amount NUMERIC(10, 2),
    coupon_code VARCHAR(50),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    applies_to_product_uids JSONB,
    applies_to_categories JSONB,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    terms_and_conditions TEXT
);

-- 29. Seller Settings table
CREATE TABLE seller_settings (
    uid VARCHAR(50) PRIMARY KEY,
    company_uid VARCHAR(50) NOT NULL REFERENCES companies(uid),
    accepted_payment_methods JSONB,
    default_shipping_options JSONB,
    return_policy TEXT,
    store_policies TEXT,
    service_areas JSONB,
    minimum_order_value NUMERIC(10, 2),
    free_shipping_threshold NUMERIC(10, 2),
    auto_accept_orders BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 30. Product Views table
CREATE TABLE product_views (
    uid VARCHAR(50) PRIMARY KEY,
    product_uid VARCHAR(50) NOT NULL REFERENCES products(uid),
    user_uid VARCHAR(50) REFERENCES users(uid),
    session_uid VARCHAR(50) NOT NULL,
    view_date TIMESTAMP NOT NULL,
    device_type VARCHAR(50),
    source VARCHAR(100)
);

-- 31. Search Logs table
CREATE TABLE search_logs (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) REFERENCES users(uid),
    session_uid VARCHAR(50) NOT NULL,
    search_query VARCHAR(255) NOT NULL,
    filters_applied JSONB,
    results_count INTEGER NOT NULL,
    search_date TIMESTAMP NOT NULL,
    conversion BOOLEAN NOT NULL DEFAULT FALSE
);

-- 32. Notifications table
CREATE TABLE notifications (
    uid VARCHAR(50) PRIMARY KEY,
    user_uid VARCHAR(50) NOT NULL REFERENCES users(uid),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_to JSONB,
    created_at TIMESTAMP NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP
);

-- Now, let's seed the database with example data

-- Seed companies
INSERT INTO companies (uid, name, business_type, tax_id, logo_url, description, website, industry, established_year, verification_status, created_at, updated_at, is_active)
VALUES 
('comp-1', 'BuildRight Construction', 'both', '123456789', 'https://picsum.photos/seed/buildright/200/200', 'Full service construction company specializing in residential and commercial projects.', 'www.buildright.com', 'Construction', 2005, 'verified', NOW(), NOW(), TRUE),
('comp-2', 'MegaMaterials Inc.', 'seller', '987654321', 'https://picsum.photos/seed/megamaterials/200/200', 'Leading supplier of construction materials with nationwide distribution.', 'www.megamaterials.com', 'Building Materials', 1998, 'verified', NOW(), NOW(), TRUE),
('comp-3', 'HomeReno Solutions', 'buyer', '456789123', 'https://picsum.photos/seed/homereno/200/200', 'Home renovation specialist focused on kitchen and bathroom remodeling.', 'www.homerenopros.com', 'Home Improvement', 2015, 'verified', NOW(), NOW(), TRUE),
('comp-4', 'Concrete Masters', 'seller', '789123456', 'https://picsum.photos/seed/concretemaster/200/200', 'Specialized concrete products and solutions for all construction needs.', 'www.concretemasters.com', 'Concrete Products', 2001, 'verified', NOW(), NOW(), TRUE),
('comp-5', 'Green Building Supplies', 'seller', '321654987', 'https://picsum.photos/seed/greenbuild/200/200', 'Eco-friendly and sustainable building materials for conscientious construction.', 'www.greenbuildingsupplies.com', 'Sustainable Construction', 2010, 'verified', NOW(), NOW(), TRUE);

-- Seed users
INSERT INTO users (uid, email, password_hash, first_name, last_name, phone_number, user_type, profile_picture_url, created_at, updated_at, last_login, is_verified, is_active, company_uid, two_factor_enabled)
VALUES 
('user-1', 'john.smith@buildright.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIeZQjuY6Zb', 'John', 'Smith', '555-123-4567', 'vendor_admin', 'https://picsum.photos/seed/johnsmith/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, 'comp-1', FALSE),
('user-2', 'lisa.jones@megamaterials.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIeeQjuY6Zb', 'Lisa', 'Jones', '555-987-6543', 'vendor_admin', 'https://picsum.photos/seed/lisajones/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, 'comp-2', TRUE),
('user-3', 'mike.roberts@homerenopros.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIeeZQjdY6Zb', 'Mike', 'Roberts', '555-456-7890', 'professional_buyer', 'https://picsum.photos/seed/mikeroberts/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, 'comp-3', FALSE),
('user-4', 'sarah.williams@concretemasters.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIeeZQgdY8Zb', 'Sarah', 'Williams', '555-789-0123', 'inventory_manager', 'https://picsum.photos/seed/sarahwilliams/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, 'comp-4', FALSE),
('user-5', 'david.brown@greenbuildingsupplies.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIteZQgdY8Zb', 'David', 'Brown', '555-234-5678', 'inventory_manager', 'https://picsum.photos/seed/davidbrown/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, 'comp-5', FALSE),
('user-6', 'emily.carter@email.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIteZUgdY8Zb', 'Emily', 'Carter', '555-345-6789', 'individual_buyer', 'https://picsum.photos/seed/emilycarter/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, NULL, FALSE),
('user-7', 'robert.miller@buildright.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIteZUfdY8Zb', 'Robert', 'Miller', '555-456-7890', 'order_fulfillment', 'https://picsum.photos/seed/robertmiller/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, 'comp-1', FALSE),
('user-8', 'jessica.davis@constructmart.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIteZUfdY9Zb', 'Jessica', 'Davis', '555-567-8901', 'system_admin', 'https://picsum.photos/seed/jessicadavis/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, NULL, TRUE),
('user-9', 'thomas.wilson@constructmart.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIteZUfdY0Zb', 'Thomas', 'Wilson', '555-678-9012', 'customer_support', 'https://picsum.photos/seed/thomaswilson/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, NULL, FALSE),
('user-10', 'olivia.martinez@email.com', '$2a$10$VdQn0bJZa8dS49NKiK0Gz.wYnIteZUfdY1Zb', 'Olivia', 'Martinez', '555-789-0123', 'individual_buyer', 'https://picsum.photos/seed/oliviamartinez/200/200', NOW(), NOW(), NOW(), TRUE, TRUE, NULL, FALSE);

-- Seed categories
INSERT INTO categories (uid, name, parent_uid, description, image_url, display_order, is_active)
VALUES 
('cat-1', 'Building Materials', NULL, 'Core materials for construction projects', 'https://picsum.photos/seed/buildingmaterials/300/200', 1, TRUE),
('cat-2', 'Lumber', 'cat-1', 'Wood and timber products for construction', 'https://picsum.photos/seed/lumber/300/200', 1, TRUE),
('cat-3', 'Plywood', 'cat-2', 'Engineered wood panels made from wood veneers', 'https://picsum.photos/seed/plywood/300/200', 1, TRUE),
('cat-4', 'Concrete', 'cat-1', 'Concrete mixes and related products', 'https://picsum.photos/seed/concrete/300/200', 2, TRUE),
('cat-5', 'Ready-Mix Concrete', 'cat-4', 'Pre-mixed concrete ready for delivery', 'https://picsum.photos/seed/readymix/300/200', 1, TRUE),
('cat-6', 'Concrete Mix', 'cat-4', 'DIY concrete mix products', 'https://picsum.photos/seed/concretemix/300/200', 2, TRUE),
('cat-7', 'Tools', NULL, 'Hand and power tools for construction', 'https://picsum.photos/seed/tools/300/200', 2, TRUE),
('cat-8', 'Power Tools', 'cat-7', 'Electric and battery-powered construction tools', 'https://picsum.photos/seed/powertools/300/200', 1, TRUE),
('cat-9', 'Hand Tools', 'cat-7', 'Manual tools for construction and carpentry', 'https://picsum.photos/seed/handtools/300/200', 2, TRUE),
('cat-10', 'Plumbing', NULL, 'Pipes, fixtures, and plumbing supplies', 'https://picsum.photos/seed/plumbing/300/200', 3, TRUE),
('cat-11', 'Pipes & Fittings', 'cat-10', 'Plumbing pipes and connection fittings', 'https://picsum.photos/seed/pipes/300/200', 1, TRUE),
('cat-12', 'Plumbing Fixtures', 'cat-10', 'Sinks, faucets, and other plumbing fixtures', 'https://picsum.photos/seed/fixtures/300/200', 2, TRUE),
('cat-13', 'Electrical', NULL, 'Electrical supplies and components', 'https://picsum.photos/seed/electrical/300/200', 4, TRUE),
('cat-14', 'Wiring & Cables', 'cat-13', 'Electrical wires and cables', 'https://picsum.photos/seed/wiring/300/200', 1, TRUE),
('cat-15', 'Switches & Outlets', 'cat-13', 'Electrical switches, outlets, and plates', 'https://picsum.photos/seed/switches/300/200', 2, TRUE);

-- Seed products
INSERT INTO products (uid, seller_uid, name, sku, main_category_uid, subcategory_uid, brand, manufacturer, short_description, long_description, base_price, currency, quantity_available, unit_of_measure, weight, dimensions, is_active, is_featured, created_at, updated_at, technical_specifications, minimum_order_quantity, lead_time_days)
VALUES 
('prod-1', 'comp-2', 'Premium Plywood Sheet 4x8', 'PLY-4X8-P', 'cat-1', 'cat-3', 'WoodPro', 'WoodPro Manufacturing', 'High-quality 4x8 plywood sheet for general construction', 'Our premium plywood sheets are ideal for a variety of construction applications. Made from high-quality wood veneers with minimal voids and excellent structural integrity.', 42.99, 'USD', 250, 'sheet', 32.5, '{"length": 96, "width": 48, "thickness": 0.75, "unit": "inches"}', TRUE, TRUE, NOW(), NOW(), '{"grade": "BC", "material": "pine", "finish": "sanded", "core": "veneer", "moisture_resistance": "standard"}', 1, 2),
('prod-2', 'comp-2', 'Pressure Treated 2x4x8', 'PT-2X4X8', 'cat-1', 'cat-2', 'TimberGuard', 'MegaMaterials Inc.', 'Pressure treated 2x4x8 lumber for outdoor construction', 'This pressure treated lumber is perfect for decks, fences, and other outdoor structures. Treated to resist rot, decay, and insect damage.', 8.99, 'USD', 500, 'piece', 12.8, '{"length": 96, "width": 3.5, "thickness": 1.5, "unit": "inches"}', TRUE, FALSE, NOW(), NOW(), '{"treatment_type": "ACQ", "wood_species": "southern yellow pine", "grade": "#2", "moisture_content": "19%"}', 1, 1),
('prod-3', 'comp-4', 'Quick-Set Concrete Mix 60lb', 'QSCM-60', 'cat-4', 'cat-6', 'ConcreteQuick', 'Concrete Masters', 'Fast-setting concrete mix in 60lb bag', 'Our quick-setting concrete mix sets in just 30 minutes. Perfect for posts, footings, and small slabs where time is critical.', 6.99, 'USD', 800, 'bag', 60, '{"length": 16, "width": 12, "thickness": 4, "unit": "inches"}', TRUE, TRUE, NOW(), NOW(), '{"setting_time": "30 minutes", "compressive_strength": "4000 psi", "application_thickness": "minimum 2 inches", "coverage": "0.5 cubic feet per bag"}', 1, 0),
('prod-4', 'comp-4', 'High-Strength Concrete 80lb', 'HSCM-80', 'cat-4', 'cat-6', 'UltraStrength', 'Concrete Masters', 'High-strength concrete mix for structural applications', 'This high-strength concrete mix is engineered for demanding structural applications where exceptional compressive strength is required.', 7.99, 'USD', 600, 'bag', 80, '{"length": 18, "width": 14, "thickness": 5, "unit": "inches"}', TRUE, FALSE, NOW(), NOW(), '{"setting_time": "24 hours", "compressive_strength": "6000 psi", "application_thickness": "minimum 2 inches", "coverage": "0.6 cubic feet per bag"}', 1, 0),
('prod-5', 'comp-5', 'Eco-Friendly Bamboo Flooring', 'ECO-BF-NAT', 'cat-1', 'cat-2', 'GreenStep', 'Green Building Supplies', 'Sustainable bamboo flooring with natural finish', 'Our eco-friendly bamboo flooring is a sustainable alternative to hardwood. Durable, beautiful, and harvested from rapidly renewable bamboo sources.', 4.59, 'USD', 1200, 'sq_ft', 2.2, '{"length": 72, "width": 5, "thickness": 0.5, "unit": "inches"}', TRUE, TRUE, NOW(), NOW(), '{"janka_hardness": "1380", "installation_method": "floating, nail-down, or glue", "finish": "UV-cured polyurethane", "warranty": "25 years residential"}', 100, 5),
('prod-6', 'comp-2', 'Cordless Drill 20V', 'TOOL-CD20', 'cat-7', 'cat-8', 'PowerPro', 'PowerTools Inc.', '20V cordless drill with lithium-ion battery', 'Professional-grade 20V cordless drill with high-torque motor, 2-speed gearbox, and long-lasting lithium-ion battery.', 129.99, 'USD', 75, 'unit', 3.5, '{"length": 10, "width": 3, "height": 8, "unit": "inches"}', TRUE, FALSE, NOW(), NOW(), '{"voltage": "20V", "chuck_size": "1/2 inch", "torque": "500 in-lbs", "speed": "0-450/0-1500 RPM", "battery_capacity": "2.0Ah"}', 1, 3),
('prod-7', 'comp-2', 'PVC Pipe 4-inch x 10ft', 'PVC-4X10', 'cat-10', 'cat-11', 'FlowMaster', 'Pipe Systems Inc.', '4-inch diameter PVC pipe, 10 ft length', 'Schedule 40 PVC pipe for residential and commercial plumbing applications. Corrosion resistant and easy to install.', 21.99, 'USD', 150, 'length', 8.4, '{"length": 120, "diameter": 4, "unit": "inches"}', TRUE, FALSE, NOW(), NOW(), '{"schedule": "40", "pressure_rating": "260 psi", "temperature_rating": "140°F", "material": "PVC", "color": "white"}', 1, 1),
('prod-8', 'comp-5', 'LED Shop Light Fixture', 'LIGHT-LED-SHOP', 'cat-13', 'cat-14', 'BrightPro', 'Eco Lighting Solutions', 'Energy-efficient LED shop light fixture', 'High-output LED shop light fixture that provides bright, energy-efficient illumination for workshops, garages, and utility spaces.', 49.99, 'USD', 60, 'unit', 5.2, '{"length": 48, "width": 5, "height": 2.5, "unit": "inches"}', TRUE, TRUE, NOW(), NOW(), '{"lumens": "4000", "color_temperature": "5000K", "wattage": "40W", "life_hours": "50000", "mounting": "ceiling or suspended"}', 1, 2),
('prod-9', 'comp-4', 'Concrete Sealer 1-Gallon', 'CS-1GAL', 'cat-4', 'cat-6', 'SealTight', 'Concrete Masters', 'Premium concrete sealer, 1-gallon container', 'Professional-grade concrete sealer that protects against water damage, stains, and UV exposure. Ideal for driveways, patios, and walkways.', 28.99, 'USD', 120, 'gallon', 8.7, '{"height": 10, "diameter": 7, "unit": "inches"}', TRUE, FALSE, NOW(), NOW(), '{"coverage": "250-300 sq ft per gallon", "dry_time": "2 hours", "recoat_time": "4 hours", "finish": "semi-gloss", "indoor_outdoor": "both"}', 1, 0),
('prod-10', 'comp-5', 'Recycled Glass Countertop', 'RGC-CUSTOM', 'cat-1', 'cat-3', 'EcoSurfaces', 'Green Building Supplies', 'Custom recycled glass countertop', 'Beautiful, durable countertops made from recycled glass embedded in concrete. Eco-friendly alternative to traditional countertop materials.', 68.99, 'USD', 200, 'sq_ft', 12.5, '{"thickness": 1.5, "width": 25.5, "unit": "inches"}', TRUE, TRUE, NOW(), NOW(), '{"materials": "80% recycled glass", "finish": "polished", "edge_options": "eased, beveled, bullnose", "heat_resistance": "up to 535°F", "stain_resistance": "excellent"}', 15, 14);

-- Seed product variants
INSERT INTO product_variants (uid, product_uid, variant_type, variant_value, additional_price, sku_extension, quantity_available, is_active, image_url)
VALUES 
('var-1', 'prod-1', 'thickness', '0.5 inch', -5.00, 'THN', 75, TRUE, 'https://picsum.photos/seed/plywood-thin/300/300'),
('var-2', 'prod-1', 'thickness', '0.75 inch', 0.00, 'STD', 100, TRUE, 'https://picsum.photos/seed/plywood-std/300/300'),
('var-3', 'prod-1', 'thickness', '1 inch', 8.00, 'THK', 75, TRUE, 'https://picsum.photos/seed/plywood-thick/300/300'),
('var-4', 'prod-3', 'size', '25lb bag', -3.00, 'SM', 200, TRUE, 'https://picsum.photos/seed/concrete-small/300/300'),
('var-5', 'prod-3', 'size', '60lb bag', 0.00, 'MD', 400, TRUE, 'https://picsum.photos/seed/concrete-medium/300/300'),
('var-6', 'prod-3', 'size', '90lb bag', 4.00, 'LG', 200, TRUE, 'https://picsum.photos/seed/concrete-large/300/300'),
('var-7', 'prod-5', 'color', 'Natural', 0.00, 'NAT', 400, TRUE, 'https://picsum.photos/seed/bamboo-natural/300/300'),
('var-8', 'prod-5', 'color', 'Carbonized', 0.50, 'CAR', 400, TRUE, 'https://picsum.photos/seed/bamboo-carbonized/300/300'),
('var-9', 'prod-5', 'color', 'Tiger Stripe', 1.00, 'TIG', 400, TRUE, 'https://picsum.photos/seed/bamboo-tiger/300/300'),
('var-10', 'prod-6', 'kit', 'Drill Only', 0.00, 'BASIC', 25, TRUE, 'https://picsum.photos/seed/drill-only/300/300'),
('var-11', 'prod-6', 'kit', 'Drill + 1 Battery', 49.99, 'PLUS', 25, TRUE, 'https://picsum.photos/seed/drill-plus/300/300'),
('var-12', 'prod-6', 'kit', 'Drill + 2 Batteries & Charger', 89.99, 'PRO', 25, TRUE, 'https://picsum.photos/seed/drill-pro/300/300');

-- Seed product images
INSERT INTO product_images (uid, product_uid, variant_uid, image_url, display_order, is_primary, created_at)
VALUES 
('img-1', 'prod-1', NULL, 'https://picsum.photos/seed/plywood1/800/600', 1, TRUE, NOW()),
('img-2', 'prod-1', NULL, 'https://picsum.photos/seed/plywood2/800/600', 2, FALSE, NOW()),
('img-3', 'prod-1', NULL, 'https://picsum.photos/seed/plywood3/800/600', 3, FALSE, NOW()),
('img-4', 'prod-1', 'var-1', 'https://picsum.photos/seed/plywoodthin1/800/600', 1, TRUE, NOW()),
('img-5', 'prod-1', 'var-2', 'https://picsum.photos/seed/plywoodstd1/800/600', 1, TRUE, NOW()),
('img-6', 'prod-1', 'var-3', 'https://picsum.photos/seed/plywoodthick1/800/600', 1, TRUE, NOW()),
('img-7', 'prod-2', NULL, 'https://picsum.photos/seed/lumber1/800/600', 1, TRUE, NOW()),
('img-8', 'prod-2', NULL, 'https://picsum.photos/seed/lumber2/800/600', 2, FALSE, NOW()),
('img-9', 'prod-3', NULL, 'https://picsum.photos/seed/concrete1/800/600', 1, TRUE, NOW()),
('img-10', 'prod-3', NULL, 'https://picsum.photos/seed/concrete2/800/600', 2, FALSE, NOW()),
('img-11', 'prod-3', 'var-4', 'https://picsum.photos/seed/concretesmall1/800/600', 1, TRUE, NOW()),
('img-12', 'prod-3', 'var-5', 'https://picsum.photos/seed/concretemedium1/800/600', 1, TRUE, NOW()),
('img-13', 'prod-3', 'var-6', 'https://picsum.photos/seed/concretelarge1/800/600', 1, TRUE, NOW()),
('img-14', 'prod-4', NULL, 'https://picsum.photos/seed/highstrength1/800/600', 1, TRUE, NOW()),
('img-15', 'prod-4', NULL, 'https://picsum.photos/seed/highstrength2/800/600', 2, FALSE, NOW());

-- Seed product specifications
INSERT INTO product_specifications (uid, product_uid, specification_name, specification_value, specification_unit, specification_group, display_order, is_filterable, is_comparable)
VALUES 
('spec-1', 'prod-1', 'Thickness', '0.75', 'inches', 'Dimensions', 1, TRUE, TRUE),
('spec-2', 'prod-1', 'Width', '48', 'inches', 'Dimensions', 2, TRUE, TRUE),
('spec-3', 'prod-1', 'Length', '96', 'inches', 'Dimensions', 3, TRUE, TRUE),
('spec-4', 'prod-1', 'Grade', 'BC', NULL, 'Quality', 4, TRUE, TRUE),
('spec-5', 'prod-1', 'Type', 'Structural', NULL, 'Classification', 5, TRUE, TRUE),
('spec-6', 'prod-2', 'Dimensions', '2 x 4 x 8', 'feet', 'Dimensions', 1, TRUE, TRUE),
('spec-7', 'prod-2', 'Treatment', 'Pressure Treated', NULL, 'Protection', 2, TRUE, TRUE),
('spec-8', 'prod-2', 'Wood Type', 'Pine', NULL, 'Material', 3, TRUE, TRUE),
('spec-9', 'prod-2', 'Grade', '#2', NULL, 'Quality', 4, TRUE, TRUE),
('spec-10', 'prod-3', 'Weight', '60', 'lbs', 'Packaging', 1, TRUE, TRUE),
('spec-11', 'prod-3', 'Setting Time', '30', 'minutes', 'Performance', 2, TRUE, TRUE),
('spec-12', 'prod-3', 'Coverage', '0.5', 'cubic feet', 'Usage', 3, TRUE, TRUE),
('spec-13', 'prod-3', 'Compressive Strength', '4000', 'psi', 'Performance', 4, TRUE, TRUE),
('spec-14', 'prod-4', 'Weight', '80', 'lbs', 'Packaging', 1, TRUE, TRUE),
('spec-15', 'prod-4', 'Compressive Strength', '6000', 'psi', 'Performance', 2, TRUE, TRUE);

-- Seed Projects
INSERT INTO projects (uid, company_uid, name, description, start_date, end_date, budget, status, created_by, created_at, updated_at, location, project_code)
VALUES 
('proj-1', 'comp-1', 'Riverside Apartment Complex', 'Construction of 3-building apartment complex with 60 units', NOW() - INTERVAL '30 days', NOW() + INTERVAL '300 days', 12500000.00, 'active', 'user-1', NOW() - INTERVAL '45 days', NOW(), 'Riverside, CA', 'BRC-2023-001'),
('proj-2', 'comp-3', 'Mountain View Residence Remodel', 'Complete renovation of 4500 sq ft residential property', NOW() - INTERVAL '15 days', NOW() + INTERVAL '90 days', 350000.00, 'active', 'user-3', NOW() - INTERVAL '20 days', NOW(), 'Mountain View, CA', 'MVR-2023-042'),
('proj-3', 'comp-1', 'Oakdale Commercial Center', 'Development of 5-store commercial retail center', NOW() + INTERVAL '15 days', NOW() + INTERVAL '200 days', 2800000.00, 'planning', 'user-1', NOW() - INTERVAL '10 days', NOW(), 'Oakdale, MN', 'OCC-2023-007'),
('proj-4', 'comp-3', 'Sunset Hills Kitchen Renovation', 'High-end kitchen renovation with custom cabinetry', NOW() - INTERVAL '60 days', NOW() + INTERVAL '10 days', 85000.00, 'active', 'user-3', NOW() - INTERVAL '75 days', NOW(), 'San Francisco, CA', 'SHK-2023-115'),
('proj-5', 'comp-1', 'Downtown Public Library', 'Construction of new 35,000 sq ft public library', NOW() + INTERVAL '45 days', NOW() + INTERVAL '500 days', 7500000.00, 'planning', 'user-1', NOW() - INTERVAL '5 days', NOW(), 'Portland, OR', 'DPL-2024-003');

-- Seed Project Members
INSERT INTO project_members (uid, project_uid, user_uid, role, created_at)
VALUES 
('projmem-1', 'proj-1', 'user-1', 'manager', NOW() - INTERVAL '45 days'),
('projmem-2', 'proj-1', 'user-7', 'team_member', NOW() - INTERVAL '44 days'),
('projmem-3', 'proj-2', 'user-3', 'manager', NOW() - INTERVAL '20 days'),
('projmem-4', 'proj-3', 'user-1', 'manager', NOW() - INTERVAL '10 days'),
('projmem-5', 'proj-3', 'user-7', 'team_member', NOW() - INTERVAL '9 days'),
('projmem-6', 'proj-4', 'user-3', 'manager', NOW() - INTERVAL '75 days'),
('projmem-7', 'proj-5', 'user-1', 'manager', NOW() - INTERVAL '5 days'),
('projmem-8', 'proj-5', 'user-7', 'team_member', NOW() - INTERVAL '4 days');

-- Seed Addresses
INSERT INTO addresses (uid, user_uid, company_uid, address_type, name, recipient_name, street_address_1, street_address_2, city, state_province, postal_code, country, phone_number, is_default_shipping, is_default_billing, created_at, updated_at, latitude, longitude, project_uid)
VALUES 
('addr-1', 'user-1', 'comp-1', 'both', 'BuildRight HQ', 'John Smith', '123 Construction Ave', 'Suite 400', 'Sacramento', 'CA', '95814', 'USA', '555-123-4567', TRUE, TRUE, NOW(), NOW(), 38.5816, -121.4944, NULL),
('addr-2', 'user-2', 'comp-2', 'both', 'MegaMaterials Main Office', 'Lisa Jones', '456 Industry Blvd', 'Building 7', 'Oakland', 'CA', '94612', 'USA', '555-987-6543', TRUE, TRUE, NOW(), NOW(), 37.8044, -122.2712, NULL),
('addr-3', 'user-3', 'comp-3', 'both', 'HomeReno Headquarters', 'Mike Roberts', '789 Renovation Dr', NULL, 'San Jose', 'CA', '95113', 'USA', '555-456-7890', TRUE, TRUE, NOW(), NOW(), 37.3382, -121.8863, NULL),
('addr-4', 'user-6', NULL, 'shipping', 'Home', 'Emily Carter', '321 Residential St', 'Apt 505', 'San Francisco', 'CA', '94107', 'USA', '555-345-6789', TRUE, FALSE, NOW(), NOW(), 37.7749, -122.4194, NULL),
('addr-5', 'user-6', NULL, 'billing', 'Billing Address', 'Emily Carter', '321 Residential St', 'Apt 505', 'San Francisco', 'CA', '94107', 'USA', '555-345-6789', FALSE, TRUE, NOW(), NOW(), 37.7749, -122.4194, NULL),
('addr-6', 'user-10', NULL, 'both', 'Home', 'Olivia Martinez', '567 Main Street', 'Unit 3B', 'Los Angeles', 'CA', '90012', 'USA', '555-789-0123', TRUE, TRUE, NOW(), NOW(), 34.0522, -118.2437, NULL),
('addr-7', NULL, NULL, 'shipping', 'Riverside Project Site', 'John Smith', '777 Riverside Ave', NULL, 'Riverside', 'CA', '92501', 'USA', '555-123-4567', FALSE, FALSE, NOW(), NOW(), 33.9806, -117.3755, 'proj-1'),
('addr-8', NULL, NULL, 'shipping', 'Mountain View Residence', 'Mike Roberts', '888 Mountain View Rd', NULL, 'Mountain View', 'CA', '94043', 'USA', '555-456-7890', FALSE, FALSE, NOW(), NOW(), 37.3861, -122.0839, 'proj-2'),
('addr-9', NULL, NULL, 'shipping', 'Oakdale Site', 'John Smith', '999 Commerce Pkwy', NULL, 'Oakdale', 'MN', '55128', 'USA', '555-123-4567', FALSE, FALSE, NOW(), NOW(), 44.9630, -92.9649, 'proj-3'),
('addr-10', NULL, NULL, 'shipping', 'Sunset Hills Property', 'Mike Roberts', '1234 Sunset Hills Blvd', NULL, 'San Francisco', 'CA', '94122', 'USA', '555-456-7890', FALSE, FALSE, NOW(), NOW(), 37.7536, -122.4811, 'proj-4');

-- Seed Payment Methods
INSERT INTO payment_methods (uid, user_uid, company_uid, payment_type, provider, account_number_last_four, cardholder_name, expiry_month, expiry_year, is_default, billing_address_uid, created_at, updated_at, payment_token)
VALUES 
('pay-1', 'user-1', 'comp-1', 'credit_card', 'Visa', '4321', 'John Smith', 12, 2025, TRUE, 'addr-1', NOW(), NOW(), 'tok_visa_12345'),
('pay-2', 'user-2', 'comp-2', 'credit_card', 'Mastercard', '8765', 'Lisa Jones', 10, 2024, TRUE, 'addr-2', NOW(), NOW(), 'tok_mastercard_67890'),
('pay-3', 'user-3', 'comp-3', 'purchase_order', NULL, NULL, NULL, NULL, NULL, TRUE, 'addr-3', NOW(), NOW(), 'po_12345'),
('pay-4', 'user-6', NULL, 'credit_card', 'Visa', '2468', 'Emily Carter', 3, 2026, TRUE, 'addr-5', NOW(), NOW(), 'tok_visa_13579'),
('pay-5', 'user-10', NULL, 'credit_card', 'American Express', '1357', 'Olivia Martinez', 7, 2025, TRUE, 'addr-6', NOW(), NOW(), 'tok_amex_24680');

-- Seed Shopping Carts
INSERT INTO shopping_carts (uid, user_uid, company_uid, name, project_uid, created_at, updated_at, last_activity, is_active, notes)
VALUES 
('cart-1', 'user-6', NULL, NULL, NULL, NOW() - INTERVAL '3 days', NOW(), NOW(), TRUE, NULL),
('cart-2', 'user-10', NULL, NULL, NULL, NOW() - INTERVAL '1 day', NOW(), NOW(), TRUE, NULL),
('cart-3', 'user-3', 'comp-3', 'Mountain View Project Materials', 'proj-2', NOW() - INTERVAL '5 days', NOW(), NOW(), TRUE, 'Items needed for kitchen remodel'),
('cart-4', 'user-1', 'comp-1', 'Riverside Project Initial Order', 'proj-1', NOW() - INTERVAL '10 days', NOW(), NOW(), TRUE, 'Foundation materials'),
('cart-5', 'user-3', 'comp-3', 'Sunset Hills Kitchen Materials', 'proj-4', NOW() - INTERVAL '20 days', NOW(), NOW() - INTERVAL '15 days', TRUE, 'Custom cabinetry and fixtures');

-- Seed Cart Items
INSERT INTO cart_items (uid, cart_uid, product_uid, variant_uid, quantity, added_at, price_snapshot, is_saved_for_later)
VALUES 
('cartitem-1', 'cart-1', 'prod-6', 'var-11', 1, NOW() - INTERVAL '3 days', 179.98, FALSE),
('cartitem-2', 'cart-1', 'prod-8', NULL, 2, NOW() - INTERVAL '3 days', 49.99, FALSE),
('cartitem-3', 'cart-2', 'prod-5', 'var-7', 150, NOW() - INTERVAL '1 day', 4.59, FALSE),
('cartitem-4', 'cart-2', 'prod-3', 'var-4', 2, NOW() - INTERVAL '1 day', 3.99, FALSE),
('cartitem-5', 'cart-3', 'prod-10', NULL, 30, NOW() - INTERVAL '5 days', 68.99, FALSE),
('cartitem-6', 'cart-3', 'prod-7', NULL, 5, NOW() - INTERVAL '5 days', 21.99, FALSE),
('cartitem-7', 'cart-4', 'prod-3', 'var-6', 100, NOW() - INTERVAL '10 days', 10.99, FALSE),
('cartitem-8', 'cart-4', 'prod-4', NULL, 50, NOW() - INTERVAL '10 days', 7.99, FALSE),
('cartitem-9', 'cart-5', 'prod-10', NULL, 25, NOW() - INTERVAL '20 days', 68.99, TRUE),
('cartitem-10', 'cart-5', 'prod-8', NULL, 4, NOW() - INTERVAL '20 days', 49.99, FALSE);

-- Seed Wishlists
INSERT INTO wishlists (uid, user_uid, name, description, is_public, created_at, updated_at)
VALUES 
('wish-1', 'user-6', 'Home Improvement', 'Items for bathroom renovation', FALSE, NOW() - INTERVAL '60 days', NOW()),
('wish-2', 'user-10', 'Dream Kitchen', 'Products for future kitchen remodel', TRUE, NOW() - INTERVAL '45 days', NOW()),
('wish-3', 'user-3', 'Tools to Buy', 'New tools needed for the business', FALSE, NOW() - INTERVAL '30 days', NOW()),
('wish-4', 'user-6', 'Outdoor Project', 'Items for backyard deck', FALSE, NOW() - INTERVAL '14 days', NOW()),
('wish-5', 'user-10', 'Flooring Ideas', 'Flooring options to consider', TRUE, NOW() - INTERVAL '7 days', NOW());

-- Seed Wishlist Items
INSERT INTO wishlist_items (uid, wishlist_uid, product_uid, variant_uid, added_at, notes)
VALUES 
('wishitem-1', 'wish-1', 'prod-9', NULL, NOW() - INTERVAL '60 days', 'For sealing bathroom floor'),
('wishitem-2', 'wish-1', 'prod-7', NULL, NOW() - INTERVAL '59 days', 'For shower remodel'),
('wishitem-3', 'wish-2', 'prod-10', NULL, NOW() - INTERVAL '45 days', 'Love this eco-friendly option'),
('wishitem-4', 'wish-2', 'prod-8', NULL, NOW() - INTERVAL '44 days', 'Need good lighting'),
('wishitem-5', 'wish-3', 'prod-6', 'var-12', NOW() - INTERVAL '30 days', 'To replace old drill'),
('wishitem-6', 'wish-4', 'prod-2', NULL, NOW() - INTERVAL '14 days', 'For deck frame'),
('wishitem-7', 'wish-4', 'prod-9', NULL, NOW() - INTERVAL '13 days', 'For protecting the wood'),
('wishitem-8', 'wish-5', 'prod-5', 'var-7', NOW() - INTERVAL '7 days', 'Nice natural color option'),
('wishitem-9', 'wish-5', 'prod-5', 'var-8', NOW() - INTERVAL '7 days', 'Rich dark option'),
('wishitem-10', 'wish-5', 'prod-5', 'var-9', NOW() - INTERVAL '6 days', 'Interesting pattern');

-- Seed Quote Requests
INSERT INTO quote_requests (uid, user_uid, company_uid, project_uid, request_number, status, requested_delivery_date, special_requirements, created_at, updated_at, expiration_date, notes)
VALUES 
('quote-1', 'user-3', 'comp-3', 'proj-2', 'QR-2023-1001', 'quoted', NOW() + INTERVAL '15 days', 'Need delivery to site rather than office', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() + INTERVAL '2 days', 'Priority quote for kitchen materials'),
('quote-2', 'user-1', 'comp-1', 'proj-1', 'QR-2023-1002', 'pending', NOW() + INTERVAL '30 days', 'Flexible delivery window of 3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '7 days', 'Large volume lumber order'),
('quote-3', 'user-3', 'comp-3', 'proj-4', 'QR-2023-1003', 'accepted', NOW() + INTERVAL '10 days', 'Delivery must be before 10 AM', NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days', 'Approved and converted to order'),
('quote-4', 'user-6', NULL, NULL, 'QR-2023-1004', 'in_review', NOW() + INTERVAL '21 days', NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', 'DIY bathroom project materials'),
('quote-5', 'user-1', 'comp-1', 'proj-5', 'QR-2023-1005', 'in_review', NOW() + INTERVAL '60 days', 'Confirm all materials meet LEED certification requirements', NOW() - INTERVAL '1 day', NOW(), NOW() + INTERVAL '7 days', 'Initial materials for library project');

-- Seed Quote Items
INSERT INTO quote_items (uid, quote_uid, product_uid, variant_uid, quantity, requested_unit_price, quoted_unit_price, notes)
VALUES 
('quoteitem-1', 'quote-1', 'prod-10', NULL, 50, 65.00, 62.50, 'Bulk discount requested'),
('quoteitem-2', 'quote-1', 'prod-5', 'var-8', 250, 4.25, 4.15, 'Need exact color match'),
('quoteitem-3', 'quote-2', 'prod-1', 'var-3', 200, 40.00, NULL, 'Requesting volume discount'),
('quoteitem-4', 'quote-2', 'prod-2', NULL, 500, 8.50, NULL, 'Need high quality grade'),
('quoteitem-5', 'quote-3', 'prod-10', NULL, 35, 65.00, 63.00, 'For custom island countertop'),
('quoteitem-6', 'quote-3', 'prod-8', NULL, 8, 48.00, 46.00, 'Under-cabinet installation'),
('quoteitem-7', 'quote-4', 'prod-7', NULL, 10, 20.00, NULL, 'For bathroom renovation'),
('quoteitem-8', 'quote-4', 'prod-9', NULL, 3, 27.50, NULL, 'For sealing new tile'),
('quoteitem-9', 'quote-5', 'prod-4', NULL, 1000, 7.00, NULL, 'Foundation work'),
('quoteitem-10', 'quote-5', 'prod-1', 'var-2', 500, 41.00, NULL, 'Structural elements');

-- Seed Orders
INSERT INTO orders (uid, order_number, buyer_uid, company_uid, project_uid, order_status, order_date, total_amount, subtotal, tax_amount, shipping_amount, discount_amount, currency, payment_method, payment_status, shipping_address_uid, billing_address_uid, shipping_method, tracking_number, estimated_delivery_date, created_at, updated_at, notes, converted_from_quote_uid)
VALUES 
('order-1', 'ORD-2023-5001', 'user-6', NULL, NULL, 'delivered', NOW() - INTERVAL '45 days', 329.96, 299.96, 30.00, 0.00, 0.00, 'USD', 'credit_card', 'paid', 'addr-4', 'addr-5', 'Ground', 'TRK4394859485', NOW() - INTERVAL '42 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '42 days', 'Customer requested doorstep delivery', NULL),
('order-2', 'ORD-2023-5002', 'user-10', NULL, NULL, 'shipped', NOW() - INTERVAL '5 days', 718.50, 653.50, 65.00, 0.00, 0.00, 'USD', 'credit_card', 'paid', 'addr-6', 'addr-6', 'Express', 'TRK9384759284', NOW() + INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NULL, NULL),
('order-3', 'ORD-2023-5003', 'user-3', 'comp-3', 'proj-4', 'delivered', NOW() - INTERVAL '60 days', 2838.00, 2580.00, 258.00, 0.00, 0.00, 'USD', 'purchase_order', 'paid', 'addr-10', 'addr-3', 'Freight', 'TRK8273645901', NOW() - INTERVAL '55 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days', 'Business hours delivery only', 'quote-3'),
('order-4', 'ORD-2023-5004', 'user-1', 'comp-1', 'proj-1', 'processing', NOW() - INTERVAL '1 day', 1598.00, 1453.00, 145.00, 0.00, 0.00, 'USD', 'credit_card', 'authorized', 'addr-7', 'addr-1', 'Freight', NULL, NOW() + INTERVAL '5 days', NOW() - INTERVAL '1 day', NOW(), 'Call before delivery', NULL),
('order-5', 'ORD-2023-5005', 'user-3', 'comp-3', 'proj-2', 'pending', NOW(), 4099.50, 3726.82, 372.68, 0.00, 0.00, 'USD', 'purchase_order', 'pending', 'addr-8', 'addr-3', 'Freight', NULL, NOW() + INTERVAL '7 days', NOW(), NOW(), 'Materials for kitchen cabinets', NULL);

-- Seed Order Items
INSERT INTO order_items (uid, order_uid, product_uid, variant_uid, quantity, unit_price, subtotal, tax_amount, discount_amount, status, created_at, updated_at)
VALUES 
('orderitem-1', 'order-1', 'prod-6', 'var-11', 1, 179.98, 179.98, 18.00, 0.00, 'delivered', NOW() - INTERVAL '45 days', NOW() - INTERVAL '42 days'),
('orderitem-2', 'order-1', 'prod-8', NULL, 2, 49.99, 99.98, 10.00, 0.00, 'delivered', NOW() - INTERVAL '45 days', NOW() - INTERVAL '42 days'),
('orderitem-3', 'order-2', 'prod-5', 'var-7', 150, 4.09, 613.50, 61.00, 0.00, 'shipped', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
('orderitem-4', 'order-2', 'prod-3', 'var-4', 2, 3.99, 7.98, 0.80, 0.00, 'shipped', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
('orderitem-5', 'order-3', 'prod-10', NULL, 35, 63.00, 2205.00, 220.50, 0.00, 'delivered', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days'),
('orderitem-6', 'order-3', 'prod-8', NULL, 8, 46.00, 368.00, 36.80, 0.00, 'delivered', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days'),
('orderitem-7', 'order-4', 'prod-3', 'var-6', 100, 10.99, 1099.00, 109.90, 0.00, 'processing', NOW() - INTERVAL '1 day', NOW()),
('orderitem-8', 'order-4', 'prod-4', NULL, 50, 7.08, 354.00, 35.40, 0.00, 'processing', NOW() - INTERVAL '1 day', NOW()),
('orderitem-9', 'order-5', 'prod-10', NULL, 50, 62.50, 3125.00, 312.50, 0.00, 'processing', NOW(), NOW()),
('orderitem-10', 'order-5', 'prod-5', 'var-8', 150, 4.01, 601.82, 60.18, 0.00, 'processing', NOW(), NOW());

-- Seed Reviews
INSERT INTO reviews (uid, product_uid, user_uid, order_item_uid, rating, title, content, pros, cons, verified_purchase, project_type, reviewer_type, helpful_votes_count, created_at, updated_at, is_approved, status)
VALUES 
('review-1', 'prod-6', 'user-6', 'orderitem-1', 5, 'Excellent Drill!', 'This drill exceeded my expectations. Great battery life and plenty of power for home projects.', 'Long battery life, powerful motor, comfortable grip', 'A bit heavy for extended use', TRUE, 'Home Renovation', 'DIY Homeowner', 12, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', TRUE, 'approved'),
('review-2', 'prod-8', 'user-6', 'orderitem-2', 4, 'Good Light Fixture', 'These lights are very bright and easy to install. Only giving 4 stars because one had a slight defect.', 'Very bright, easy installation, energy efficient', 'One fixture had a small defect', TRUE, 'Garage Update', 'DIY Homeowner', 5, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', TRUE, 'approved'),
('review-3', 'prod-10', 'user-3', 'orderitem-5', 5, 'Beautiful Countertops', 'The recycled glass countertops look absolutely beautiful in our client''s kitchen. The color depth and pattern are stunning.', 'Eco-friendly, uniquely beautiful, durable', 'Requires professional installation', TRUE, 'Kitchen Remodel', 'Professional Contractor', 18, NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days', TRUE, 'approved'),
('review-4', 'prod-5', 'user-10', 'orderitem-3', 3, 'Decent Flooring', 'The bamboo flooring looks nice, but it scratches more easily than I expected.', 'Beautiful appearance, eco-friendly', 'Scratches easily, some planks had inconsistent coloring', TRUE, 'Living Room Flooring', 'DIY Homeowner', 7, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', FALSE, 'pending'),
('review-5', 'prod-3', 'user-1', 'orderitem-7', 5, 'Perfect For Our Project', 'This concrete mix sets quickly and provides a strong foundation. We've used it on multiple construction projects.', 'Quick setting, consistent mix, strong final product', 'None', TRUE, 'Commercial Construction', 'Professional Builder', 3, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', TRUE, 'approved');

-- Seed Review Images
INSERT INTO review_images (uid, review_uid, image_url, created_at)
VALUES 
('reviewimg-1', 'review-1', 'https://picsum.photos/seed/review1img1/800/600', NOW() - INTERVAL '40 days'),
('reviewimg-2', 'review-1', 'https://picsum.photos/seed/review1img2/800/600', NOW() - INTERVAL '40 days'),
('reviewimg-3', 'review-3', 'https://picsum.photos/seed/review3img1/800/600', NOW() - INTERVAL '50 days'),
('reviewimg-4', 'review-3', 'https://picsum.photos/seed/review3img2/800/600', NOW() - INTERVAL '50 days'),
('reviewimg-5', 'review-3', 'https://picsum.photos/seed/review3img3/800/600', NOW() - INTERVAL '50 days'),
('reviewimg-6', 'review-4', 'https://picsum.photos/seed/review4img1/800/600', NOW() - INTERVAL '2 days'),
('reviewimg-7', 'review-5', 'https://picsum.photos/seed/review5img1/800/600', NOW() - INTERVAL '30 days');

-- Seed Questions
INSERT INTO questions (uid, product_uid, user_uid, question_text, created_at, updated_at, status)
VALUES 
('question-1', 'prod-6', 'user-10', 'Does this drill come with a carrying case?', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', 'published'),
('question-2', 'prod-5', 'user-6', 'Is this flooring suitable for installation over radiant heating?', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', 'published'),
('question-3', 'prod-10', 'user-10', 'What is the maximum size you can make these countertops without seams?', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 'published'),
('question-4', 'prod-3', 'user-6', 'How long does this concrete take to fully cure?', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', 'published'),
('question-5', 'prod-8', 'user-3', 'Are replacement bulbs available for this fixture?', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 'pending');

-- Seed Answers
INSERT INTO answers (uid, question_uid, user_uid, is_seller, answer_text, created_at, updated_at, helpful_votes_count, status)
VALUES 
('answer-1', 'question-1', 'user-2', TRUE, 'The basic version (Drill Only) does not include a case. The Pro Kit version comes with a heavy-duty carrying case.', NOW() - INTERVAL '59 days', NOW() - INTERVAL '59 days', 8, 'published'),
('answer-2', 'question-1', 'user-6', FALSE, 'I bought the Pro Kit and it came with a nice case that holds the drill, charger, and both batteries.', NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days', 5, 'published'),
('answer-3', 'question-2', 'user-5', TRUE, 'Yes, our bamboo flooring is approved for installation over radiant heating systems. We recommend keeping the system temperature below 85°F (29°C).', NOW() - INTERVAL '44 days', NOW() - INTERVAL '44 days', 6, 'published'),
('answer-4', 'question-3', 'user-5', TRUE, 'Our standard maximum size without seams is 10 feet by 5 feet (120" x 60"). For larger installations, we create nearly invisible seams.', NOW() - INTERVAL '29 days', NOW() - INTERVAL '29 days', 3, 'published'),
('answer-5', 'question-4', 'user-4', TRUE, 'The concrete sets in 30 minutes but requires 24-48 hours to reach 70% of its full strength. For heavy loads, allow 7 days for complete curing.', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', 4, 'published');

-- Seed Messages
INSERT INTO messages (uid, thread_uid, sender_uid, recipient_uid, related_to_order_uid, related_to_product_uid, subject, message_content, created_at, is_read, read_at, has_attachments, category)
VALUES 
('msg-1', 'thread-1', 'user-6', 'user-2', NULL, 'prod-6', 'Question about Cordless Drill', 'Hello, I''m interested in your 20V cordless drill. Does it come with a warranty?', NOW() - INTERVAL '70 days', TRUE, NOW() - INTERVAL '69 days', FALSE, 'inquiry'),
('msg-2', 'thread-1', 'user-2', 'user-6', NULL, 'prod-6', 'RE: Question about Cordless Drill', 'Yes, all our power tools come with a 3-year manufacturer warranty. Let me know if you have any other questions!', NOW() - INTERVAL '69 days', TRUE, NOW() - INTERVAL '68 days', FALSE, 'inquiry'),
('msg-3', 'thread-2', 'user-10', 'user-2', 'order-2', NULL, 'Shipping Delay?', 'I ordered bamboo flooring last week. The tracking hasn''t updated in 2 days. Is there a delay?', NOW() - INTERVAL '3 days', TRUE, NOW() - INTERVAL '3 days', FALSE, 'order'),
('msg-4', 'thread-2', 'user-2', 'user-10', 'order-2', NULL, 'RE: Shipping Delay?', 'I apologize for the delay. There was a weather issue affecting shipments. Your order is back on track and should arrive tomorrow.', NOW() - INTERVAL '3 days', TRUE, NOW() - INTERVAL '2 days', FALSE, 'order'),
('msg-5', 'thread-3', 'user-3', 'user-5', NULL, 'prod-10', 'Custom Order Possibility', 'We''re working on a large commercial project. Can you provide countertops in a custom blue shade to match our design theme?', NOW() - INTERVAL '25 days', TRUE, NOW() - INTERVAL '24 days', FALSE, 'inquiry'),
('msg-6', 'thread-3', 'user-5', 'user-3', NULL, 'prod-10', 'RE: Custom Order Possibility', 'Yes, we can create custom color blends. I''ve attached some blue shade options we''ve done previously. We would need at least 3 weeks lead time for custom work.', NOW() - INTERVAL '24 days', TRUE, NOW() - INTERVAL '23 days', TRUE, 'inquiry'),
('msg-7', 'thread-4', 'user-1', 'user-4', 'order-4', NULL, 'Delivery Schedule', 'Could you provide a more specific delivery time for our concrete order? We need to coordinate the pour with our subcontractors.', NOW() - INTERVAL '1 day', TRUE, NOW() - INTERVAL '1 day', FALSE, 'order'),
('msg-8', 'thread-4', 'user-4', 'user-1', 'order-4', NULL, 'RE: Delivery Schedule', 'We''ve scheduled your delivery for this Friday between 7am-10am. Our driver will call 30 minutes before arrival.', NOW() - INTERVAL '12 hours', FALSE, NULL, FALSE, 'order'),
('msg-9', 'thread-5', 'user-6', 'user-9', NULL, NULL, 'Account Question', 'I''m having trouble updating my payment information. Can you help?', NOW() - INTERVAL '5 days', TRUE, NOW() - INTERVAL '5 days', FALSE, 'support'),
('msg-10', 'thread-5', 'user-9', 'user-6', NULL, NULL, 'RE: Account Question', 'I''d be happy to help. For security, please confirm the last 4 digits of the card you currently have on file.', NOW() - INTERVAL '5 days', TRUE, NOW() - INTERVAL '4 days', FALSE, 'support');

-- Seed Message Attachments
INSERT INTO message_attachments (uid, message_uid, file_url, file_name, file_type, file_size, created_at)
VALUES 
('msgatt-1', 'msg-6', 'https://picsum.photos/seed/bluesample1/800/600', 'blue_sample_1.jpg', 'image/jpeg', 256000, NOW() - INTERVAL '24 days'),
('msgatt-2', 'msg-6', 'https://picsum.photos/seed/bluesample2/800/600', 'blue_sample_2.jpg', 'image/jpeg', 275000, NOW() - INTERVAL '24 days'),
('msgatt-3', 'msg-6', 'https://picsum.photos/seed/bluesample3/800/600', 'blue_sample_3.jpg', 'image/jpeg', 262000, NOW() - INTERVAL '24 days');

-- Seed Support Tickets
INSERT INTO support_tickets (uid, user_uid, ticket_number, subject, description, category, priority, status, assigned_to, related_order_uid, related_product_uid, created_at, updated_at, resolved_at, satisfaction_rating)
VALUES 
('ticket-1', 'user-6', 'TIK-2023-10001', 'Damaged Item Received', 'One of the LED shop lights arrived with a cracked diffuser.', 'product', 'medium', 'resolved', 'user-9', 'order-1', 'prod-8', NOW() - INTERVAL '39 days', NOW() - INTERVAL '37 days', NOW() - INTERVAL '37 days', 5),
('ticket-2', 'user-10', 'TIK-2023-10002', 'Wrong Product Received', 'I ordered natural bamboo flooring but received carbonized.', 'order', 'high', 'in_progress', 'user-9', 'order-2', 'prod-5', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NULL, NULL),
('ticket-3', 'user-3', 'TIK-2023-10003', 'Billing Discrepancy', 'Our company was charged twice for the same order.', 'payment', 'high', 'waiting_for_customer', 'user-9', 'order-3', NULL, NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days', NULL, NULL),
('ticket-4', 'user-6', 'TIK-2023-10004', 'Website Technical Issue', 'I can''t upload project photos to my profile.', 'technical', 'low', 'open', NULL, NULL, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NULL, NULL),
('ticket-5', 'user-1', 'TIK-2023-10005', 'Special Delivery Request', 'Need to change delivery address for recent order.', 'order', 'medium', 'closed', 'user-9', 'order-4', NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 4);

-- Seed Ticket Responses
INSERT INTO ticket_responses (uid, ticket_uid, user_uid, is_staff, response_text, created_at, has_attachments)
VALUES 
('ticketresp-1', 'ticket-1', 'user-9', TRUE, 'I''m sorry to hear about the damaged light. We''ll send a replacement right away. No need to return the damaged item.', NOW() - INTERVAL '38 days', FALSE),
('ticketresp-2', 'ticket-1', 'user-6', FALSE, 'Thank you! That''s excellent service.', NOW() - INTERVAL '38 days', FALSE),
('ticketresp-3', 'ticket-1', 'user-9', TRUE, 'You''re welcome! Your replacement has been shipped with tracking number TRK3847569234. It should arrive in 2 business days.', NOW() - INTERVAL '37 days', FALSE),
('ticketresp-4', 'ticket-2', 'user-9', TRUE, 'I apologize for the mix-up. I''ve checked our warehouse and confirmed we have the natural bamboo in stock. We''ll arrange for the correct flooring to be delivered and schedule a pickup for the wrong items.', NOW() - INTERVAL '3 days', FALSE),
('ticketresp-5', 'ticket-2', 'user-10', FALSE, 'Thank you. When can I expect the correct items to arrive? I have installers scheduled for next week.', NOW() - INTERVAL '3 days', FALSE),
('ticketresp-6', 'ticket-2', 'user-9', TRUE, 'We''ll expedite the shipping. You should have the correct flooring by Monday, which should work with your installation schedule.', NOW() - INTERVAL '2 days', FALSE),
('ticketresp-7', 'ticket-3', 'user-9', TRUE, 'I''ve reviewed your account and found the duplicate charge. I''ve initiated a refund for the second charge, which should appear on your account in 3-5 business days. Could you please confirm when you see the refund?', NOW() - INTERVAL '14 days', FALSE),
('ticketresp-8', 'ticket-3', 'user-3', FALSE, 'Thank you for finding the issue. I''ll watch for the refund and let you know when it appears.', NOW() - INTERVAL '14 days', FALSE),
('ticketresp-9', 'ticket-3', 'user-9', TRUE, 'Following up - have you seen the refund appear in your account yet?', NOW() - INTERVAL '12 days', FALSE),
('ticketresp-10', 'ticket-5', 'user-9', TRUE, 'I''ve updated the delivery address for your order. The driver will deliver to the new location as requested.', NOW() - INTERVAL '1 day', FALSE);

-- Seed Promotions
INSERT INTO promotions (uid, seller_uid, name, description, promotion_type, discount_value, minimum_purchase_amount, coupon_code, start_date, end_date, is_active, usage_limit, usage_count, applies_to_product_uids, created_at, updated_at, terms_and_conditions)
VALUES 
('promo-1', 'comp-2', 'Summer Tool Sale', '15% off all power tools', 'percentage', 15.00, 100.00, 'SUMMER15', NOW() - INTERVAL '30 days', NOW() + INTERVAL '15 days', TRUE, 500, 213, '["prod-6"]', NOW() - INTERVAL '35 days', NOW(), 'Cannot be combined with other offers. Valid on select products only.'),
('promo-2', 'comp-4', 'Concrete Special', 'Buy 10 bags, get 1 free', 'buy_x_get_y', 1.00, NULL, 'CONCRETE10', NOW() - INTERVAL '60 days', NOW() + INTERVAL '30 days', TRUE, NULL, 45, '["prod-3", "prod-4", "prod-9"]', NOW() - INTERVAL '65 days', NOW(), 'Free item must be of equal or lesser value. Limit one free bag per order.'),
('promo-3', 'comp-5', 'Eco-Friendly Discount', '$50 off orders over $500', 'fixed_amount', 50.00, 500.00, 'GREEN500', NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days', TRUE, 200, 27, NULL, NOW() - INTERVAL '15 days', NOW(), 'Valid on all eco-friendly products. One use per customer.'),
('promo-4', 'comp-2', 'Free Shipping Promo', 'Free shipping on orders over $250', 'free_shipping', 0.00, 250.00, 'SHIPFREE', NOW() - INTERVAL '45 days', NOW() + INTERVAL '45 days', TRUE, NULL, 156, NULL, NOW() - INTERVAL '50 days', NOW(), 'Valid for ground shipping within 100 miles of our warehouse locations.'),
('promo-5', 'comp-4', 'Contractor Discount', '10% off for licensed contractors', 'percentage', 10.00, NULL, 'PROBUILD', NOW() - INTERVAL '90 days', NOW() + INTERVAL '275 days', TRUE, NULL, 78, NULL, NOW() - INTERVAL '95 days', NOW(), 'Must provide valid contractor license number at checkout. Verification required.');

-- Seed Seller Settings
INSERT INTO seller_settings (uid, company_uid, accepted_payment_methods, default_shipping_options, return_policy, store_policies, service_areas, minimum_order_value, free_shipping_threshold, auto_accept_orders, created_at, updated_at)
VALUES 
('sellset-1', 'comp-2', '["credit_card", "purchase_order", "bank_account"]', '[{"name": "Standard Ground", "price": 15.00, "days": 3}, {"name": "Express", "price": 35.00, "days": 1}]', 'Returns accepted within 30 days of purchase. Items must be unused and in original packaging.', 'Orders placed before 2pm EST ship same day. We reserve the right to refuse service.', '["California", "Oregon", "Washington", "Nevada", "Arizona"]', 25.00, 250.00, TRUE, NOW() - INTERVAL '365 days', NOW() - INTERVAL '30 days'),
('sellset-2', 'comp-4', '["credit_card", "purchase_order"]', '[{"name": "Local Delivery", "price": 50.00, "days": 1}, {"name": "Standard Freight", "price": 150.00, "days": 5}]', 'Custom products are non-returnable. Other products may be returned within 15 days, subject to a 20% restocking fee.', 'Large orders may require partial prepayment. Special orders require a non-refundable deposit.', '["California", "Nevada", "Arizona"]', 100.00, 1000.00, FALSE, NOW() - INTERVAL '450 days', NOW() - INTERVAL '60 days'),
('sellset-3', 'comp-5', '["credit_card", "bank_account"]', '[{"name": "Standard Ground", "price": 10.00, "days": 5}, {"name": "White Glove Delivery", "price": 100.00, "days": 7}]', 'All products have a 60-day satisfaction guarantee. Return shipping is the responsibility of the customer.', 'All products are certified eco-friendly. We donate 1% of all sales to environmental initiatives.', '["All US States"]', 50.00, 300.00, TRUE, NOW() - INTERVAL '300 days', NOW() - INTERVAL '45 days'),
('sellset-4', 'comp-1', '["credit_card", "purchase_order", "bank_account"]', '[{"name": "Standard Delivery", "price": 75.00, "days": 3}, {"name": "Same-Day Delivery", "price": 150.00, "days": 0}]', 'Claims for damaged materials must be made within 48 hours of delivery. Returns subject to inspection.', 'We guarantee to meet or beat any competitor''s written quote. Price matching available at manager''s discretion.', '["California"]', 200.00, 2000.00, FALSE, NOW() - INTERVAL '500 days', NOW() - INTERVAL '15 days');

-- Seed Product Views
INSERT INTO product_views (uid, product_uid, user_uid, session_uid, view_date, device_type, source)
VALUES 
('view-1', 'prod-1', 'user-6', 'sess-12345', NOW() - INTERVAL '65 days', 'desktop', 'direct'),
('view-2', 'prod-6', 'user-6', 'sess-12345', NOW() - INTERVAL '65 days', 'desktop', 'search'),
('view-3', 'prod-8', 'user-6', 'sess-12345', NOW() - INTERVAL '65 days', 'desktop', 'category'),
('view-4', 'prod-6', 'user-6', 'sess-12345', NOW() - INTERVAL '64 days', 'desktop', 'direct'),
('view-5', 'prod-6', 'user-6', 'sess-12345', NOW() - INTERVAL '63 days', 'desktop', 'direct'),
('view-6', 'prod-5', 'user-10', 'sess-67890', NOW() - INTERVAL '20 days', 'mobile', 'search'),
('view-7', 'prod-5', 'user-10', 'sess-67890', NOW() - INTERVAL '19 days', 'mobile', 'direct'),
('view-8', 'prod-3', 'user-10', 'sess-67890', NOW() - INTERVAL '19 days', 'mobile', 'category'),
('view-9', 'prod-10', 'user-3', 'sess-24680', NOW() - INTERVAL '70 days', 'tablet', 'search'),
('view-10', 'prod-10', 'user-3', 'sess-24680', NOW() - INTERVAL '69 days', 'desktop', 'direct'),
('view-11', 'prod-8', 'user-3', 'sess-24680', NOW() - INTERVAL '69 days', 'desktop', 'related'),
('view-12', 'prod-3', 'user-1', 'sess-13579', NOW() - INTERVAL '15 days', 'desktop', 'category'),
('view-13', 'prod-4', 'user-1', 'sess-13579', NOW() - INTERVAL '15 days', 'desktop', 'related'),
('view-14', 'prod-3', 'user-1', 'sess-13579', NOW() - INTERVAL '12 days', 'desktop', 'direct'),
('view-15', 'prod-1', NULL, 'sess-98765', NOW() - INTERVAL '10 days', 'mobile', 'search'),
('view-16', 'prod-6', NULL, 'sess-98765', NOW() - INTERVAL '10 days', 'mobile', 'category'),
('view-17', 'prod-10', NULL, 'sess-45678', NOW() - INTERVAL '5 days', 'desktop', 'social'),
('view-18', 'prod-5', NULL, 'sess-45678', NOW() - INTERVAL '5 days', 'desktop', 'related'),
('view-19', 'prod-2', NULL, 'sess-45678', NOW() - INTERVAL '5 days', 'desktop', 'category'),
('view-20', 'prod-9', NULL, 'sess-45678', NOW() - INTERVAL '5 days', 'desktop', 'search');

-- Seed Search Logs
INSERT INTO search_logs (uid, user_uid, session_uid, search_query, filters_applied, results_count, search_date, conversion)
VALUES 
('search-1', 'user-6', 'sess-12345', 'cordless drill', '{"category": "tools", "price_range": {"min": 0, "max": 200}}', 12, NOW() - INTERVAL '65 days', TRUE),
('search-2', 'user-6', 'sess-12345', 'led light', '{"category": "electrical"}', 23, NOW() - INTERVAL '65 days', TRUE),
('search-3', 'user-10', 'sess-67890', 'bamboo flooring', '{"category": "building_materials", "eco_friendly": true}', 5, NOW() - INTERVAL '20 days', TRUE),
('search-4', 'user-10', 'sess-67890', 'concrete mix', '{"weight": "25lb"}', 8, NOW() - INTERVAL '19 days', TRUE),
('search-5', 'user-3', 'sess-24680', 'recycled countertop', '{"category": "building_materials", "eco_friendly": true}', 3, NOW() - INTERVAL '70 days', TRUE),
('search-6', 'user-1', 'sess-13579', 'concrete mix bulk', '{"category": "concrete"}', 15, NOW() - INTERVAL '15 days', TRUE),
('search-7', NULL, 'sess-98765', 'pressure treated lumber', '{"category": "lumber"}', 28, NOW() - INTERVAL '10 days', FALSE),
('search-8', NULL, 'sess-98765', 'power tools', '{"brand": "PowerPro"}', 35, NOW() - INTERVAL '10 days', FALSE),
('search-9', NULL, 'sess-45678', 'eco friendly building materials', '{"category": "building_materials"}', 42, NOW() - INTERVAL '5 days', FALSE),
('search-10', NULL, 'sess-45678', 'concrete sealer', '{"category": "concrete"}', 7, NOW() - INTERVAL '5 days', TRUE);

-- Seed Notifications
INSERT INTO notifications (uid, user_uid, notification_type, title, message, related_to, created_at, is_read, read_at)
VALUES 
('notif-1', 'user-6', 'order_status', 'Order Shipped', 'Your order #ORD-2023-5001 has been shipped! Track your package with tracking number TRK4394859485.', '{"order_uid": "order-1"}', NOW() - INTERVAL '44 days', TRUE, NOW() - INTERVAL '44 days'),
('notif-2', 'user-6', 'order_status', 'Order Delivered', 'Your order #ORD-2023-5001 has been delivered! Enjoy your new products.', '{"order_uid": "order-1"}', NOW() - INTERVAL '42 days', TRUE, NOW() - INTERVAL '42 days'),
('notif-3', 'user-10', 'order_status', 'Order Confirmed', 'Thank you for your order #ORD-2023-5002! Your payment has been received.', '{"order_uid": "order-2"}', NOW() - INTERVAL '5 days', TRUE, NOW() - INTERVAL '5 days'),
('notif-4', 'user-10', 'order_status', 'Order Shipped', 'Your order #ORD-2023-5002 has been shipped! Track your package with tracking number TRK9384759284.', '{"order_uid": "order-2"}', NOW() - INTERVAL '2 days', TRUE, NOW() - INTERVAL '2 days'),
('notif-5', 'user-3', 'order_status', 'Order Confirmed', 'Thank you for your order #ORD-2023-5003! Your payment has been received.', '{"order_uid": "order-3"}', NOW() - INTERVAL '60 days', TRUE, NOW() - INTERVAL '60 days'),
('notif-6', 'user-3', 'order_status', 'Order Shipped', 'Your order #ORD-2023-5003 has been shipped! Track your package with tracking number TRK8273645901.', '{"order_uid": "order-3"}', NOW() - INTERVAL '58 days', TRUE, NOW() - INTERVAL '58 days'),
('notif-7', 'user-3', 'order_status', 'Order Delivered', 'Your order #ORD-2023-5003 has been delivered! Enjoy your new products.', '{"order_uid": "order-3"}', NOW() - INTERVAL '55 days', TRUE, NOW() - INTERVAL '55 days'),
('notif-8', 'user-1', 'order_status', 'Order Confirmed', 'Thank you for your order #ORD-2023-5004! Your payment has been authorized.', '{"order_uid": "order-4"}', NOW() - INTERVAL '1 day', TRUE, NOW() - INTERVAL '1 day'),
('notif-9', 'user-1', 'message', 'New Message', 'You have received a new message about your order delivery schedule.', '{"message_uid": "msg-8", "thread_uid": "thread-4"}', NOW() - INTERVAL '12 hours', FALSE, NULL),
('notif-10', 'user-3', 'order_status', 'Order Confirmed', 'Thank you for your order #ORD-2023-5005! We''re processing your purchase order.', '{"order_uid": "order-5"}', NOW(), FALSE, NULL);