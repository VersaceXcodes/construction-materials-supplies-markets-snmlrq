import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize dotenv
dotenv.config();

// Setup Express app
const app = express();
const PORT = process.env.PORT || 1337;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Database configuration
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
  database: PGDATABASE || "neondb",
  username: PGUSER || "neondb_owner",
  password: PGPASSWORD || "npg_jAS3aITLC5DX",
  port: 5432,
  ssl: {
    require: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the storage directory
app.use('/storage', express.static(path.join(__dirname, 'storage')));

/* 
 * Authentication Middleware
 * This middleware validates the JWT token from the request headers
 * and attaches the decoded user to the request object
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET || 'constructmart_jwt_secret', (err, user) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }
      
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ success: false, message: 'Authentication token is required' });
  }
};

/* 
 * WebSocket Authentication Middleware
 * This middleware validates the JWT token from the socket handshake
 * and attaches the decoded user to the socket object
 */
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication token is required'));
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'constructmart_jwt_secret', (err, decoded) => {
    if (err) {
      return next(new Error('Invalid or expired token'));
    }
    
    socket.user = decoded;
    next();
  });
});

// ===== AUTH ROUTES =====

/**
 * User Registration Endpoint
 * Creates a new user account and returns the created user
 * For business accounts, also creates a company record
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      first_name, 
      last_name, 
      phone_number, 
      user_type, 
      company_details 
    } = req.body;
    
    // Validate required fields
    if (!email || !password || !first_name || !last_name || !user_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Check if user with email already exists
    const client = await pool.connect();
    try {
      const existingUser = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: 'User with this email already exists' 
        });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Generate verification token
      const verificationToken = uuidv4();
      
      let company_uid = null;
      
      // If user is a business user, create company first
      if ((user_type === 'professional_buyer' || user_type === 'vendor_admin') && company_details) {
        const { name, business_type, tax_id, industry, website } = company_details;
        
        if (!name || !business_type) {
          return res.status(400).json({ 
            success: false, 
            message: 'Company name and business type are required for business accounts' 
          });
        }
        
        const companyUid = `comp-${uuidv4().substring(0, 8)}`;
        
        // Create company
        await client.query(
          `INSERT INTO companies (
            uid, name, business_type, tax_id, website, industry, 
            verification_status, created_at, updated_at, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            companyUid,
            name,
            business_type,
            tax_id || null,
            website || null,
            industry || null,
            'pending',
            new Date(),
            new Date(),
            true
          ]
        );
        
        company_uid = companyUid;
      }
      
      // Create user
      const userUid = `user-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO users (
          uid, email, password_hash, first_name, last_name, phone_number, 
          user_type, created_at, updated_at, is_verified, verification_token, 
          is_active, company_uid, two_factor_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          userUid,
          email,
          hashedPassword,
          first_name,
          last_name,
          phone_number || null,
          user_type,
          new Date(),
          new Date(),
          false,
          verificationToken,
          true,
          company_uid,
          false
        ]
      );
      
      // TODO: Send verification email with token
      // For now, we'll just return the token in the response
      
      // Return user data without sensitive information
      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your email.',
        user: {
          uid: userUid,
          email,
          first_name,
          last_name,
          user_type,
          is_verified: false,
          created_at: new Date()
        },
        verification_token: verificationToken // In production, this would be sent via email
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
});

/**
 * Email Verification Endpoint
 * Verifies a user's email address using the verification token
 */
app.get('/api/auth/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification token is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Find user with the verification token
      const userResult = await client.query(
        'SELECT * FROM users WHERE verification_token = $1',
        [token]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Invalid verification token' 
        });
      }
      
      const user = userResult.rows[0];
      
      // Update user to verified status
      await client.query(
        'UPDATE users SET is_verified = $1, verification_token = NULL, updated_at = $2 WHERE uid = $3',
        [true, new Date(), user.uid]
      );
      
      res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now log in.'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during email verification' 
    });
  }
});

/**
 * User Login Endpoint
 * Authenticates a user and returns a JWT token
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, remember_me } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Find user with the email
      const userResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid email or password' 
        });
      }
      
      const user = userResult.rows[0];
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid email or password' 
        });
      }
      
      // Check if user is verified
      if (!user.is_verified) {
        return res.status(403).json({ 
          success: false, 
          message: 'Please verify your email before logging in' 
        });
      }
      
      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been deactivated' 
        });
      }
      
      // Update last login timestamp
      await client.query(
        'UPDATE users SET last_login = $1, updated_at = $2 WHERE uid = $3',
        [new Date(), new Date(), user.uid]
      );
      
      // Create JWT token
      // Set expiration based on remember_me flag
      const expiresIn = remember_me ? '7d' : '24h';
      
      const token = jwt.sign(
        { 
          uid: user.uid, 
          email: user.email,
          user_type: user.user_type,
          company_uid: user.company_uid
        },
        process.env.JWT_SECRET || 'constructmart_jwt_secret',
        { expiresIn }
      );
      
      res.status(200).json({
        success: true,
        token,
        user: {
          uid: user.uid,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          user_type: user.user_type,
          profile_picture_url: user.profile_picture_url,
          company_uid: user.company_uid,
          is_verified: user.is_verified
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

/**
 * Forgot Password Endpoint
 * Sends a password reset link to the user's email
 */
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Find user with the email
      const userResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      // We don't want to reveal if the email exists or not
      // So we always return a success message
      
      // If user exists, generate and store reset token
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const resetToken = uuidv4();
        
        // Store token in user record with expiration data
        // Note: In a real implementation, we'd have a separate table for reset tokens
        // with expiration timestamps, but for simplicity, we'll use an expiring JWT
        
        const token = jwt.sign(
          { uid: user.uid, email: user.email, purpose: 'password_reset' },
          process.env.JWT_SECRET || 'constructmart_jwt_secret',
          { expiresIn: '1h' }
        );
        
        // TODO: Send password reset email with token
        // For now, we'll just return the token in the response
      }
      
      // Return success regardless of whether email exists
      res.status(200).json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been sent.'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset request' 
    });
  }
});

/**
 * Reset Password Endpoint
 * Resets a user's password using a reset token
 */
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, new_password, confirm_password } = req.body;
    
    if (!token || !new_password || !confirm_password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token, new password, and confirmation are required' 
      });
    }
    
    if (new_password !== confirm_password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'constructmart_jwt_secret'
      );
      
      if (decoded.purpose !== 'password_reset') {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid reset token' 
        });
      }
      
      const client = await pool.connect();
      try {
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(new_password, salt);
        
        // Update user's password
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = $2 WHERE uid = $3',
          [hashedPassword, new Date(), decoded.uid]
        );
        
        res.status(200).json({
          success: true,
          message: 'Password has been reset successfully. You can now log in with your new password.'
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      // Token validation failed
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset' 
    });
  }
});

// ===== USER PROFILE ROUTES =====

/**
 * Get User Profile Endpoint
 * Returns the authenticated user's profile
 */
app.get('/api/users/profile', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    
    const client = await pool.connect();
    try {
      // Get user data
      const userResult = await client.query(
        'SELECT uid, email, first_name, last_name, phone_number, user_type, profile_picture_url, created_at, updated_at, last_login, is_verified, company_uid, communication_preferences FROM users WHERE uid = $1',
        [uid]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      const user = userResult.rows[0];
      
      // If user has a company, get company data
      let company = null;
      if (user.company_uid) {
        const companyResult = await client.query(
          'SELECT uid, name, business_type, tax_id, logo_url, description, website, industry, established_year, verification_status FROM companies WHERE uid = $1',
          [user.company_uid]
        );
        
        if (companyResult.rows.length > 0) {
          company = companyResult.rows[0];
        }
      }
      
      res.status(200).json({
        success: true,
        user: {
          ...user,
          company
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving user profile' 
    });
  }
});

/**
 * Update User Profile Endpoint
 * Updates the authenticated user's profile
 */
app.put('/api/users/profile', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { 
      first_name, 
      last_name, 
      phone_number, 
      profile_picture_url,
      communication_preferences
    } = req.body;
    
    const client = await pool.connect();
    try {
      // Update user data
      await client.query(
        `UPDATE users 
         SET first_name = COALESCE($1, first_name), 
             last_name = COALESCE($2, last_name), 
             phone_number = COALESCE($3, phone_number), 
             profile_picture_url = COALESCE($4, profile_picture_url),
             communication_preferences = COALESCE($5, communication_preferences),
             updated_at = $6
         WHERE uid = $7`,
        [
          first_name, 
          last_name, 
          phone_number, 
          profile_picture_url,
          communication_preferences ? JSON.stringify(communication_preferences) : null,
          new Date(),
          uid
        ]
      );
      
      // Get updated user data
      const userResult = await client.query(
        'SELECT uid, email, first_name, last_name, phone_number, user_type, profile_picture_url, created_at, updated_at, communication_preferences FROM users WHERE uid = $1',
        [uid]
      );
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: userResult.rows[0]
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating user profile' 
    });
  }
});

/**
 * Update Company Profile Endpoint
 * Updates the authenticated user's company profile
 */
app.put('/api/companies/profile', authenticateJWT, async (req, res) => {
  try {
    const { company_uid } = req.user;
    
    if (!company_uid) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have a company profile' 
      });
    }
    
    const { 
      name, 
      description, 
      logo_url, 
      website, 
      industry, 
      established_year 
    } = req.body;
    
    const client = await pool.connect();
    try {
      // Update company data
      await client.query(
        `UPDATE companies 
         SET name = COALESCE($1, name), 
             description = COALESCE($2, description), 
             logo_url = COALESCE($3, logo_url), 
             website = COALESCE($4, website),
             industry = COALESCE($5, industry),
             established_year = COALESCE($6, established_year),
             updated_at = $7
         WHERE uid = $8`,
        [
          name, 
          description, 
          logo_url, 
          website,
          industry,
          established_year,
          new Date(),
          company_uid
        ]
      );
      
      // Get updated company data
      const companyResult = await client.query(
        'SELECT uid, name, business_type, tax_id, logo_url, description, website, industry, established_year, verification_status FROM companies WHERE uid = $1',
        [company_uid]
      );
      
      res.status(200).json({
        success: true,
        message: 'Company profile updated successfully',
        company: companyResult.rows[0]
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating company profile' 
    });
  }
});

// ===== ADDRESS MANAGEMENT ROUTES =====

/**
 * Get User Addresses Endpoint
 * Returns all addresses for the authenticated user
 */
app.get('/api/users/addresses', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    
    const client = await pool.connect();
    try {
      // Get addresses
      let addressesResult;
      
      if (company_uid) {
        // Get both personal and company addresses
        addressesResult = await client.query(
          'SELECT * FROM addresses WHERE user_uid = $1 OR company_uid = $2 ORDER BY created_at DESC',
          [uid, company_uid]
        );
      } else {
        // Get only personal addresses
        addressesResult = await client.query(
          'SELECT * FROM addresses WHERE user_uid = $1 ORDER BY created_at DESC',
          [uid]
        );
      }
      
      res.status(200).json({
        success: true,
        addresses: addressesResult.rows
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving addresses' 
    });
  }
});

/**
 * Add New Address Endpoint
 * Adds a new address for the authenticated user
 */
app.post('/api/users/addresses', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { 
      address_type, 
      name, 
      recipient_name, 
      street_address_1, 
      street_address_2, 
      city, 
      state_province, 
      postal_code, 
      country, 
      phone_number,
      is_default_shipping,
      is_default_billing,
      special_instructions,
      project_uid
    } = req.body;
    
    // Validate required fields
    if (!address_type || !recipient_name || !street_address_1 || !city || !state_province || !postal_code || !country) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required address fields' 
      });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // If setting as default, unset existing defaults
      if (is_default_shipping) {
        await client.query(
          'UPDATE addresses SET is_default_shipping = false WHERE user_uid = $1',
          [uid]
        );
        
        if (company_uid) {
          await client.query(
            'UPDATE addresses SET is_default_shipping = false WHERE company_uid = $1',
            [company_uid]
          );
        }
      }
      
      if (is_default_billing) {
        await client.query(
          'UPDATE addresses SET is_default_billing = false WHERE user_uid = $1',
          [uid]
        );
        
        if (company_uid) {
          await client.query(
            'UPDATE addresses SET is_default_billing = false WHERE company_uid = $1',
            [company_uid]
          );
        }
      }
      
      // Create the address
      const addressUid = `addr-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO addresses (
          uid, user_uid, company_uid, address_type, name, recipient_name, 
          street_address_1, street_address_2, city, state_province, 
          postal_code, country, phone_number, is_default_shipping, 
          is_default_billing, special_instructions, created_at, 
          updated_at, project_uid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          addressUid,
          uid,
          company_uid,
          address_type,
          name || null,
          recipient_name,
          street_address_1,
          street_address_2 || null,
          city,
          state_province,
          postal_code,
          country,
          phone_number || null,
          is_default_shipping || false,
          is_default_billing || false,
          special_instructions || null,
          new Date(),
          new Date(),
          project_uid || null
        ]
      );
      
      await client.query('COMMIT');
      
      // Get the newly created address
      const addressResult = await client.query(
        'SELECT * FROM addresses WHERE uid = $1',
        [addressUid]
      );
      
      res.status(201).json({
        success: true,
        message: 'Address added successfully',
        address: addressResult.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while adding address' 
    });
  }
});

/**
 * Update Address Endpoint
 * Updates an existing address
 */
app.put('/api/users/addresses/:address_uid', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { address_uid } = req.params;
    const { 
      address_type, 
      name, 
      recipient_name, 
      street_address_1, 
      street_address_2, 
      city, 
      state_province, 
      postal_code, 
      country, 
      phone_number,
      is_default_shipping,
      is_default_billing,
      special_instructions
    } = req.body;
    
    const client = await pool.connect();
    try {
      // Check if address belongs to user
      const addressResult = await client.query(
        'SELECT * FROM addresses WHERE uid = $1 AND (user_uid = $2 OR company_uid = $3)',
        [address_uid, uid, company_uid]
      );
      
      if (addressResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Address not found or you do not have permission to update it' 
        });
      }
      
      await client.query('BEGIN');
      
      // If setting as default, unset existing defaults
      if (is_default_shipping) {
        await client.query(
          'UPDATE addresses SET is_default_shipping = false WHERE user_uid = $1',
          [uid]
        );
        
        if (company_uid) {
          await client.query(
            'UPDATE addresses SET is_default_shipping = false WHERE company_uid = $1',
            [company_uid]
          );
        }
      }
      
      if (is_default_billing) {
        await client.query(
          'UPDATE addresses SET is_default_billing = false WHERE user_uid = $1',
          [uid]
        );
        
        if (company_uid) {
          await client.query(
            'UPDATE addresses SET is_default_billing = false WHERE company_uid = $1',
            [company_uid]
          );
        }
      }
      
      // Update the address
      await client.query(
        `UPDATE addresses 
         SET address_type = COALESCE($1, address_type),
             name = COALESCE($2, name),
             recipient_name = COALESCE($3, recipient_name),
             street_address_1 = COALESCE($4, street_address_1),
             street_address_2 = COALESCE($5, street_address_2),
             city = COALESCE($6, city),
             state_province = COALESCE($7, state_province),
             postal_code = COALESCE($8, postal_code),
             country = COALESCE($9, country),
             phone_number = COALESCE($10, phone_number),
             is_default_shipping = COALESCE($11, is_default_shipping),
             is_default_billing = COALESCE($12, is_default_billing),
             special_instructions = COALESCE($13, special_instructions),
             updated_at = $14
         WHERE uid = $15`,
        [
          address_type,
          name,
          recipient_name,
          street_address_1,
          street_address_2,
          city,
          state_province,
          postal_code,
          country,
          phone_number,
          is_default_shipping,
          is_default_billing,
          special_instructions,
          new Date(),
          address_uid
        ]
      );
      
      await client.query('COMMIT');
      
      // Get the updated address
      const updatedAddressResult = await client.query(
        'SELECT * FROM addresses WHERE uid = $1',
        [address_uid]
      );
      
      res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        address: updatedAddressResult.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating address' 
    });
  }
});

/**
 * Delete Address Endpoint
 * Deletes an address
 */
app.delete('/api/users/addresses/:address_uid', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { address_uid } = req.params;
    
    const client = await pool.connect();
    try {
      // Check if address belongs to user
      const addressResult = await client.query(
        'SELECT * FROM addresses WHERE uid = $1 AND (user_uid = $2 OR company_uid = $3)',
        [address_uid, uid, company_uid]
      );
      
      if (addressResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Address not found or you do not have permission to delete it' 
        });
      }
      
      // Delete the address
      await client.query(
        'DELETE FROM addresses WHERE uid = $1',
        [address_uid]
      );
      
      res.status(200).json({
        success: true,
        message: 'Address deleted successfully'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting address' 
    });
  }
});

// ===== PRODUCT ROUTES =====

/**
 * Get Products Endpoint
 * Returns a list of products with optional filtering
 */
app.get('/api/products', async (req, res) => {
  try {
    const { 
      category_uid, 
      subcategory_uid, 
      seller_uid, 
      search, 
      min_price, 
      max_price, 
      brand, 
      sort_by, 
      sort_order, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    let query = `
      SELECT p.*, 
             (SELECT COUNT(*) FROM reviews r WHERE r.product_uid = p.uid AND r.status = 'approved') as review_count,
             (SELECT COUNT(*) FROM product_images pi WHERE pi.product_uid = p.uid) as image_count,
             c.name as category_name,
             sc.name as subcategory_name,
             co.name as seller_name
      FROM products p
      LEFT JOIN categories c ON p.main_category_uid = c.uid
      LEFT JOIN categories sc ON p.subcategory_uid = sc.uid
      LEFT JOIN companies co ON p.seller_uid = co.uid
      WHERE p.is_active = true
    `;
    
    const queryParams = [];
    let paramCounter = 1;
    
    // Add filters
    if (category_uid) {
      query += ` AND p.main_category_uid = $${paramCounter++}`;
      queryParams.push(category_uid);
    }
    
    if (subcategory_uid) {
      query += ` AND p.subcategory_uid = $${paramCounter++}`;
      queryParams.push(subcategory_uid);
    }
    
    if (seller_uid) {
      query += ` AND p.seller_uid = $${paramCounter++}`;
      queryParams.push(seller_uid);
    }
    
    if (search) {
      query += ` AND (p.name ILIKE $${paramCounter++} OR p.short_description ILIKE $${paramCounter++} OR p.long_description ILIKE $${paramCounter++})`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (min_price) {
      query += ` AND p.base_price >= $${paramCounter++}`;
      queryParams.push(min_price);
    }
    
    if (max_price) {
      query += ` AND p.base_price <= $${paramCounter++}`;
      queryParams.push(max_price);
    }
    
    if (brand) {
      query += ` AND p.brand ILIKE $${paramCounter++}`;
      queryParams.push(`%${brand}%`);
    }
    
    // Add sorting
    if (sort_by) {
      const validSortColumns = ['name', 'base_price', 'created_at', 'average_rating', 'total_views'];
      const validSortOrders = ['asc', 'desc'];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = validSortOrders.includes(sort_order?.toLowerCase()) ? sort_order : 'desc';
      
      query += ` ORDER BY p.${sortColumn} ${sortDirection}`;
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
    queryParams.push(limit, offset);
    
    // Get count query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      WHERE p.is_active = true
    `;
    
    // Add the same filters to count query
    let countParamCounter = 1;
    const countParams = [];
    
    if (category_uid) {
      countQuery += ` AND p.main_category_uid = $${countParamCounter++}`;
      countParams.push(category_uid);
    }
    
    if (subcategory_uid) {
      countQuery += ` AND p.subcategory_uid = $${countParamCounter++}`;
      countParams.push(subcategory_uid);
    }
    
    if (seller_uid) {
      countQuery += ` AND p.seller_uid = $${countParamCounter++}`;
      countParams.push(seller_uid);
    }
    
    if (search) {
      countQuery += ` AND (p.name ILIKE $${countParamCounter++} OR p.short_description ILIKE $${countParamCounter++} OR p.long_description ILIKE $${countParamCounter++})`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (min_price) {
      countQuery += ` AND p.base_price >= $${countParamCounter++}`;
      countParams.push(min_price);
    }
    
    if (max_price) {
      countQuery += ` AND p.base_price <= $${countParamCounter++}`;
      countParams.push(max_price);
    }
    
    if (brand) {
      countQuery += ` AND p.brand ILIKE $${countParamCounter++}`;
      countParams.push(`%${brand}%`);
    }
    
    const client = await pool.connect();
    try {
      // Execute main query
      const productsResult = await client.query(query, queryParams);
      
      // Execute count query
      const countResult = await client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / limit);
      
      // For each product, get primary image
      const productsWithImages = await Promise.all(productsResult.rows.map(async (product) => {
        const imageResult = await client.query(
          'SELECT image_url FROM product_images WHERE product_uid = $1 AND is_primary = true LIMIT 1',
          [product.uid]
        );
        
        let primary_image_url = null;
        if (imageResult.rows.length > 0) {
          primary_image_url = imageResult.rows[0].image_url;
        } else {
          // If no primary image, get the first image
          const firstImageResult = await client.query(
            'SELECT image_url FROM product_images WHERE product_uid = $1 ORDER BY display_order ASC LIMIT 1',
            [product.uid]
          );
          
          if (firstImageResult.rows.length > 0) {
            primary_image_url = firstImageResult.rows[0].image_url;
          }
        }
        
        return {
          ...product,
          primary_image_url
        };
      }));
      
      res.status(200).json({
        success: true,
        products: productsWithImages,
        pagination: {
          total_items: totalCount,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit)
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving products' 
    });
  }
});

/**
 * Get Product Details Endpoint
 * Returns detailed information about a specific product
 */
app.get('/api/products/:product_uid', async (req, res) => {
  try {
    const { product_uid } = req.params;
    
    const client = await pool.connect();
    try {
      // Get product data
      const productResult = await client.query(
        `SELECT p.*, 
                c.name as category_name,
                sc.name as subcategory_name,
                co.name as seller_name,
                co.logo_url as seller_logo_url
         FROM products p
         LEFT JOIN categories c ON p.main_category_uid = c.uid
         LEFT JOIN categories sc ON p.subcategory_uid = sc.uid
         LEFT JOIN companies co ON p.seller_uid = co.uid
         WHERE p.uid = $1 AND p.is_active = true`,
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      const product = productResult.rows[0];
      
      // Get product images
      const imagesResult = await client.query(
        'SELECT * FROM product_images WHERE product_uid = $1 ORDER BY is_primary DESC, display_order ASC',
        [product_uid]
      );
      
      // Get product variants
      const variantsResult = await client.query(
        'SELECT * FROM product_variants WHERE product_uid = $1 AND is_active = true',
        [product_uid]
      );
      
      // Get product specifications
      const specificationsResult = await client.query(
        'SELECT * FROM product_specifications WHERE product_uid = $1 ORDER BY specification_group, display_order',
        [product_uid]
      );
      
      // Get approved reviews
      const reviewsResult = await client.query(
        `SELECT r.*, 
                u.first_name,
                u.last_name,
                u.profile_picture_url
         FROM reviews r
         JOIN users u ON r.user_uid = u.uid
         WHERE r.product_uid = $1 AND r.status = 'approved'
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [product_uid]
      );
      
      // Get review stats
      const reviewStatsResult = await client.query(
        `SELECT 
          COUNT(*) as total_reviews,
          COUNT(*) FILTER (WHERE rating = 5) as five_star,
          COUNT(*) FILTER (WHERE rating = 4) as four_star,
          COUNT(*) FILTER (WHERE rating = 3) as three_star,
          COUNT(*) FILTER (WHERE rating = 2) as two_star,
          COUNT(*) FILTER (WHERE rating = 1) as one_star,
          AVG(rating) as average_rating
         FROM reviews
         WHERE product_uid = $1 AND status = 'approved'`,
        [product_uid]
      );
      
      // Get published questions with answers
      const questionsResult = await client.query(
        `SELECT q.*,
                u.first_name as asker_first_name,
                u.last_name as asker_last_name
         FROM questions q
         JOIN users u ON q.user_uid = u.uid
         WHERE q.product_uid = $1 AND q.status = 'published'
         ORDER BY q.created_at DESC
         LIMIT 5`,
        [product_uid]
      );
      
      // For each question, get the answers
      const questions = await Promise.all(questionsResult.rows.map(async (question) => {
        const answersResult = await client.query(
          `SELECT a.*,
                  u.first_name as answerer_first_name,
                  u.last_name as answerer_last_name,
                  u.profile_picture_url as answerer_profile_picture
           FROM answers a
           JOIN users u ON a.user_uid = u.uid
           WHERE a.question_uid = $1 AND a.status = 'published'
           ORDER BY a.helpful_votes_count DESC, a.created_at ASC`,
          [question.uid]
        );
        
        return {
          ...question,
          answers: answersResult.rows
        };
      }));
      
      // Get related products (same category)
      const relatedProductsResult = await client.query(
        `SELECT p.uid, p.name, p.short_description, p.base_price, p.currency, p.average_rating,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url
         FROM products p
         WHERE p.main_category_uid = $1 AND p.uid != $2 AND p.is_active = true
         ORDER BY p.total_views DESC
         LIMIT 4`,
        [product.main_category_uid, product_uid]
      );
      
      // Increment product view count
      await client.query(
        'UPDATE products SET total_views = total_views + 1 WHERE uid = $1',
        [product_uid]
      );
      
      // Record view for analytics (if user is authenticated)
      const user_uid = req.headers.authorization ? jwt.decode(req.headers.authorization.split(' ')[1])?.uid : null;
      
      if (user_uid || req.headers['x-session-id']) {
        const session_uid = req.headers['x-session-id'] || `sess-${uuidv4().substring(0, 8)}`;
        const device_type = req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop';
        const source = req.headers.referer?.includes('search') ? 'search' : 'direct';
        
        await client.query(
          `INSERT INTO product_views (
            uid, product_uid, user_uid, session_uid, view_date, device_type, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `view-${uuidv4().substring(0, 8)}`,
            product_uid,
            user_uid,
            session_uid,
            new Date(),
            device_type,
            source
          ]
        );
      }
      
      res.status(200).json({
        success: true,
        product: {
          ...product,
          images: imagesResult.rows,
          variants: variantsResult.rows,
          specifications: specificationsResult.rows,
          reviews: reviewsResult.rows,
          review_stats: reviewStatsResult.rows[0],
          questions,
          related_products: relatedProductsResult.rows
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving product details' 
    });
  }
});

/**
 * Get Product Reviews Endpoint
 * Returns reviews for a specific product with pagination
 */
app.get('/api/products/:product_uid/reviews', async (req, res) => {
  try {
    const { product_uid } = req.params;
    const { 
      rating, 
      sort_by = 'created_at', 
      sort_order = 'desc', 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const client = await pool.connect();
    try {
      // Check if product exists
      const productResult = await client.query(
        'SELECT uid, name FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      let query = `
        SELECT r.*, 
               u.first_name,
               u.last_name,
               u.profile_picture_url
        FROM reviews r
        JOIN users u ON r.user_uid = u.uid
        WHERE r.product_uid = $1 AND r.status = 'approved'
      `;
      
      const queryParams = [product_uid];
      let paramCounter = 2;
      
      // Add filters
      if (rating) {
        query += ` AND r.rating = $${paramCounter++}`;
        queryParams.push(rating);
      }
      
      // Add sorting
      const validSortColumns = ['created_at', 'rating', 'helpful_votes_count'];
      const validSortOrders = ['asc', 'desc'];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = validSortOrders.includes(sort_order?.toLowerCase()) ? sort_order : 'desc';
      
      query += ` ORDER BY r.${sortColumn} ${sortDirection}`;
      
      // Add pagination
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
      queryParams.push(limit, offset);
      
      // Execute query
      const reviewsResult = await client.query(query, queryParams);
      
      // Get review images for each review
      const reviewsWithImages = await Promise.all(reviewsResult.rows.map(async (review) => {
        const imagesResult = await client.query(
          'SELECT * FROM review_images WHERE review_uid = $1',
          [review.uid]
        );
        
        return {
          ...review,
          images: imagesResult.rows
        };
      }));
      
      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM reviews
         WHERE product_uid = $1 AND status = 'approved'
         ${rating ? ' AND rating = $2' : ''}`,
        rating ? [product_uid, rating] : [product_uid]
      );
      
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.status(200).json({
        success: true,
        product_name: productResult.rows[0].name,
        reviews: reviewsWithImages,
        pagination: {
          total_items: totalCount,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit)
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving product reviews' 
    });
  }
});

/**
 * Submit Product Review Endpoint
 * Allows authenticated users to submit a review for a product they purchased
 */
app.post('/api/products/:product_uid/reviews', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { product_uid } = req.params;
    const { 
      rating, 
      title, 
      content,
      pros,
      cons,
      project_type,
      reviewer_type,
      order_item_uid
    } = req.body;
    
    // Validate required fields
    if (!rating || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating and review content are required' 
      });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating must be between 1 and 5' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Check if product exists
      const productResult = await client.query(
        'SELECT uid FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      // Check if user has already reviewed this product
      const existingReviewResult = await client.query(
        'SELECT uid FROM reviews WHERE product_uid = $1 AND user_uid = $2',
        [product_uid, uid]
      );
      
      if (existingReviewResult.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: 'You have already reviewed this product' 
        });
      }
      
      // Determine if this is a verified purchase
      let verified_purchase = false;
      
      if (order_item_uid) {
        // If order_item_uid is provided, check if it belongs to the user and is for this product
        const orderItemResult = await client.query(
          `SELECT oi.uid 
           FROM order_items oi
           JOIN orders o ON oi.order_uid = o.uid
           WHERE oi.uid = $1 AND o.buyer_uid = $2 AND oi.product_uid = $3`,
          [order_item_uid, uid, product_uid]
        );
        
        verified_purchase = orderItemResult.rows.length > 0;
      } else {
        // Otherwise, check if user has purchased this product in the past
        const purchaseResult = await client.query(
          `SELECT oi.uid 
           FROM order_items oi
           JOIN orders o ON oi.order_uid = o.uid
           WHERE o.buyer_uid = $1 AND oi.product_uid = $2 AND o.order_status IN ('delivered', 'completed')`,
          [uid, product_uid]
        );
        
        verified_purchase = purchaseResult.rows.length > 0;
      }
      
      // Create the review
      const reviewUid = `review-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO reviews (
          uid, product_uid, user_uid, order_item_uid, rating, title, content,
          pros, cons, verified_purchase, project_type, reviewer_type,
          helpful_votes_count, created_at, updated_at, is_approved, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          reviewUid,
          product_uid,
          uid,
          order_item_uid || null,
          rating,
          title || null,
          content,
          pros || null,
          cons || null,
          verified_purchase,
          project_type || null,
          reviewer_type || null,
          0,
          new Date(),
          new Date(),
          verified_purchase, // Auto-approve verified purchases
          verified_purchase ? 'approved' : 'pending'
        ]
      );
      
      // Update product average rating if review is approved
      if (verified_purchase) {
        await client.query(
          `UPDATE products 
           SET average_rating = (
             SELECT AVG(rating) 
             FROM reviews 
             WHERE product_uid = $1 AND status = 'approved'
           ),
           total_reviews = total_reviews + 1,
           updated_at = $2
           WHERE uid = $1`,
          [product_uid, new Date()]
        );
      }
      
      res.status(201).json({
        success: true,
        message: verified_purchase ? 
          'Thank you for your review! It has been published.' : 
          'Thank you for your review! It will be published after moderation.',
        review_uid: reviewUid,
        status: verified_purchase ? 'approved' : 'pending'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting review' 
    });
  }
});

/**
 * Get Product Questions Endpoint
 * Returns questions for a specific product with pagination
 */
app.get('/api/products/:product_uid/questions', async (req, res) => {
  try {
    const { product_uid } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const client = await pool.connect();
    try {
      // Check if product exists
      const productResult = await client.query(
        'SELECT uid, name FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      // Get questions with pagination
      const questionsResult = await client.query(
        `SELECT q.*,
                u.first_name as asker_first_name,
                u.last_name as asker_last_name
         FROM questions q
         JOIN users u ON q.user_uid = u.uid
         WHERE q.product_uid = $1 AND q.status = 'published'
         ORDER BY q.created_at DESC
         LIMIT $2 OFFSET $3`,
        [product_uid, limit, (page - 1) * limit]
      );
      
      // For each question, get the answers
      const questions = await Promise.all(questionsResult.rows.map(async (question) => {
        const answersResult = await client.query(
          `SELECT a.*,
                  u.first_name as answerer_first_name,
                  u.last_name as answerer_last_name,
                  u.profile_picture_url as answerer_profile_picture,
                  (SELECT business_type FROM companies WHERE uid = p.seller_uid) as seller_type
           FROM answers a
           JOIN users u ON a.user_uid = u.uid
           JOIN products p ON p.uid = $2
           WHERE a.question_uid = $1 AND a.status = 'published'
           ORDER BY a.is_seller DESC, a.helpful_votes_count DESC, a.created_at ASC`,
          [question.uid, product_uid]
        );
        
        return {
          ...question,
          answers: answersResult.rows
        };
      }));
      
      // Get total count of questions
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM questions
         WHERE product_uid = $1 AND status = 'published'`,
        [product_uid]
      );
      
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.status(200).json({
        success: true,
        product_name: productResult.rows[0].name,
        questions,
        pagination: {
          total_items: totalCount,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit)
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get product questions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving product questions' 
    });
  }
});

/**
 * Ask Product Question Endpoint
 * Allows authenticated users to ask a question about a product
 */
app.post('/api/products/:product_uid/questions', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { product_uid } = req.params;
    const { question_text } = req.body;
    
    // Validate required fields
    if (!question_text) {
      return res.status(400).json({ 
        success: false, 
        message: 'Question text is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Check if product exists
      const productResult = await client.query(
        'SELECT uid, name, seller_uid FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      // Create the question
      const questionUid = `question-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO questions (
          uid, product_uid, user_uid, question_text, created_at, updated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          questionUid,
          product_uid,
          uid,
          question_text,
          new Date(),
          new Date(),
          'pending' // Questions need moderation before publication
        ]
      );
      
      // Get seller info for notification
      const sellerUidResult = await client.query(
        `SELECT u.uid as seller_user_uid 
         FROM users u 
         WHERE u.company_uid = $1 AND u.user_type = 'vendor_admin'
         LIMIT 1`,
        [productResult.rows[0].seller_uid]
      );
      
      if (sellerUidResult.rows.length > 0) {
        // Create notification for seller
        const notificationUid = `notif-${uuidv4().substring(0, 8)}`;
        
        await client.query(
          `INSERT INTO notifications (
            uid, user_uid, notification_type, title, message, related_to, created_at, is_read
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            notificationUid,
            sellerUidResult.rows[0].seller_user_uid,
            'new_question',
            'New Product Question',
            `A customer has asked a question about ${productResult.rows[0].name}`,
            JSON.stringify({
              entity_type: 'question',
              entity_uid: questionUid,
              product_uid: product_uid
            }),
            new Date(),
            false
          ]
        );
        
        // Emit notification via WebSocket
        io.to(`user:${sellerUidResult.rows[0].seller_user_uid}`).emit('notification', {
          notification_uid: notificationUid,
          user_uid: sellerUidResult.rows[0].seller_user_uid,
          notification_type: 'new_question',
          title: 'New Product Question',
          message: `A customer has asked a question about ${productResult.rows[0].name}`,
          related_to: {
            entity_type: 'question',
            entity_uid: questionUid,
            product_uid: product_uid
          },
          created_at: new Date(),
          is_read: false
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Your question has been submitted and will be reviewed.',
        question_uid: questionUid
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting question' 
    });
  }
});

/**
 * Answer Product Question Endpoint
 * Allows authenticated users to answer a question about a product
 */
app.post('/api/products/:product_uid/questions/:question_uid/answers', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { product_uid, question_uid } = req.params;
    const { answer_text } = req.body;
    
    // Validate required fields
    if (!answer_text) {
      return res.status(400).json({ 
        success: false, 
        message: 'Answer text is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Check if product exists
      const productResult = await client.query(
        'SELECT uid, name, seller_uid FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      // Check if question exists and is published
      const questionResult = await client.query(
        'SELECT uid, user_uid FROM questions WHERE uid = $1 AND product_uid = $2 AND status = \'published\'',
        [question_uid, product_uid]
      );
      
      if (questionResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Question not found or not yet published' 
        });
      }
      
      // Determine if user is the seller
      const is_seller = company_uid === productResult.rows[0].seller_uid;
      
      // Create the answer
      const answerUid = `answer-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO answers (
          uid, question_uid, user_uid, is_seller, answer_text, created_at, updated_at, helpful_votes_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          answerUid,
          question_uid,
          uid,
          is_seller,
          answer_text,
          new Date(),
          new Date(),
          0,
          is_seller ? 'published' : 'pending' // Auto-approve seller answers
        ]
      );
      
      // Create notification for the question asker
      const notificationUid = `notif-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO notifications (
          uid, user_uid, notification_type, title, message, related_to, created_at, is_read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          notificationUid,
          questionResult.rows[0].user_uid,
          'new_answer',
          'Your Question Has Been Answered',
          `Someone has answered your question about ${productResult.rows[0].name}`,
          JSON.stringify({
            entity_type: 'answer',
            entity_uid: answerUid,
            question_uid: question_uid,
            product_uid: product_uid
          }),
          new Date(),
          false
        ]
      );
      
      // Emit notification via WebSocket
      io.to(`user:${questionResult.rows[0].user_uid}`).emit('notification', {
        notification_uid: notificationUid,
        user_uid: questionResult.rows[0].user_uid,
        notification_type: 'new_answer',
        title: 'Your Question Has Been Answered',
        message: `Someone has answered your question about ${productResult.rows[0].name}`,
        related_to: {
          entity_type: 'answer',
          entity_uid: answerUid,
          question_uid: question_uid,
          product_uid: product_uid
        },
        created_at: new Date(),
        is_read: false
      });
      
      res.status(201).json({
        success: true,
        message: is_seller ? 
          'Your answer has been published.' : 
          'Your answer has been submitted and will be reviewed.',
        answer_uid: answerUid,
        status: is_seller ? 'published' : 'pending'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting answer' 
    });
  }
});

// ===== SHOPPING CART ROUTES =====

/**
 * Get User's Cart Endpoint
 * Returns the authenticated user's active shopping cart
 */
app.get('/api/cart', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    
    const client = await pool.connect();
    try {
      // Get user's active cart
      let cartResult;
      
      if (company_uid) {
        cartResult = await client.query(
          'SELECT * FROM shopping_carts WHERE user_uid = $1 AND company_uid = $2 AND is_active = true ORDER BY last_activity DESC LIMIT 1',
          [uid, company_uid]
        );
      } else {
        cartResult = await client.query(
          'SELECT * FROM shopping_carts WHERE user_uid = $1 AND is_active = true ORDER BY last_activity DESC LIMIT 1',
          [uid]
        );
      }
      
      // If no active cart, create one
      let cart;
      
      if (cartResult.rows.length === 0) {
        const cartUid = `cart-${uuidv4().substring(0, 8)}`;
        
        await client.query(
          `INSERT INTO shopping_carts (
            uid, user_uid, company_uid, created_at, updated_at, last_activity, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            cartUid,
            uid,
            company_uid,
            new Date(),
            new Date(),
            new Date(),
            true
          ]
        );
        
        cart = {
          uid: cartUid,
          user_uid: uid,
          company_uid,
          created_at: new Date(),
          updated_at: new Date(),
          last_activity: new Date(),
          is_active: true,
          name: null,
          project_uid: null,
          notes: null
        };
      } else {
        cart = cartResult.rows[0];
      }
      
      // Get cart items
      const cartItemsResult = await client.query(
        `SELECT ci.*, 
                p.name as product_name, 
                p.short_description, 
                p.base_price as current_price,
                p.unit_of_measure,
                p.quantity_available,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url,
                pv.variant_type,
                pv.variant_value,
                pv.additional_price,
                pv.quantity_available as variant_quantity_available
         FROM cart_items ci
         JOIN products p ON ci.product_uid = p.uid
         LEFT JOIN product_variants pv ON ci.variant_uid = pv.uid
         WHERE ci.cart_uid = $1
         ORDER BY ci.added_at DESC`,
        [cart.uid]
      );
      
      // Calculate totals
      let subtotal = 0;
      let itemCount = 0;
      
      cartItemsResult.rows.forEach(item => {
        if (!item.is_saved_for_later) {
          subtotal += item.price_snapshot * item.quantity;
          itemCount += item.quantity;
        }
      });
      
      res.status(200).json({
        success: true,
        cart: {
          ...cart,
          items: cartItemsResult.rows,
          subtotal,
          item_count: itemCount
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving cart' 
    });
  }
});

/**
 * Add Item to Cart Endpoint
 * Adds a product to the authenticated user's shopping cart
 */
app.post('/api/cart/items', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { product_uid, variant_uid, quantity = 1 } = req.body;
    
    // Validate required fields
    if (!product_uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product UID is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if product exists
      const productResult = await client.query(
        'SELECT uid, name, base_price, quantity_available FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      const product = productResult.rows[0];
      
      // Check variant if provided
      let variant = null;
      let finalPrice = product.base_price;
      
      if (variant_uid) {
        const variantResult = await client.query(
          'SELECT * FROM product_variants WHERE uid = $1 AND product_uid = $2 AND is_active = true',
          [variant_uid, product_uid]
        );
        
        if (variantResult.rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: 'Product variant not found' 
          });
        }
        
        variant = variantResult.rows[0];
        finalPrice += variant.additional_price;
        
        // Check variant inventory
        if (variant.quantity_available < quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Only ${variant.quantity_available} units available for this variant` 
          });
        }
      } else {
        // Check product inventory
        if (product.quantity_available < quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Only ${product.quantity_available} units available` 
          });
        }
      }
      
      // Get user's active cart or create one
      let cartResult = await client.query(
        'SELECT * FROM shopping_carts WHERE user_uid = $1 AND is_active = true ORDER BY last_activity DESC LIMIT 1',
        [uid]
      );
      
      let cart;
      
      if (cartResult.rows.length === 0) {
        const cartUid = `cart-${uuidv4().substring(0, 8)}`;
        
        await client.query(
          `INSERT INTO shopping_carts (
            uid, user_uid, company_uid, created_at, updated_at, last_activity, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            cartUid,
            uid,
            company_uid,
            new Date(),
            new Date(),
            new Date(),
            true
          ]
        );
        
        cart = { uid: cartUid };
      } else {
        cart = cartResult.rows[0];
        
        // Update last activity
        await client.query(
          'UPDATE shopping_carts SET last_activity = $1, updated_at = $2 WHERE uid = $3',
          [new Date(), new Date(), cart.uid]
        );
      }
      
      // Check if item already exists in cart
      const existingItemResult = await client.query(
        'SELECT * FROM cart_items WHERE cart_uid = $1 AND product_uid = $2 AND variant_uid IS NOT DISTINCT FROM $3 AND is_saved_for_later = false',
        [cart.uid, product_uid, variant_uid]
      );
      
      let cartItem;
      
      if (existingItemResult.rows.length > 0) {
        // Update existing item
        const existingItem = existingItemResult.rows[0];
        const newQuantity = existingItem.quantity + quantity;
        
        // Check if new quantity exceeds available stock
        if (variant) {
          if (newQuantity > variant.quantity_available) {
            return res.status(400).json({ 
              success: false, 
              message: `Cannot add ${quantity} more units. Only ${variant.quantity_available - existingItem.quantity} additional units available for this variant` 
            });
          }
        } else {
          if (newQuantity > product.quantity_available) {
            return res.status(400).json({ 
              success: false, 
              message: `Cannot add ${quantity} more units. Only ${product.quantity_available - existingItem.quantity} additional units available` 
            });
          }
        }
        
        await client.query(
          'UPDATE cart_items SET quantity = $1, price_snapshot = $2 WHERE uid = $3',
          [newQuantity, finalPrice, existingItem.uid]
        );
        
        cartItem = {
          ...existingItem,
          quantity: newQuantity,
          price_snapshot: finalPrice
        };
      } else {
        // Create new cart item
        const cartItemUid = `cartitem-${uuidv4().substring(0, 8)}`;
        
        await client.query(
          `INSERT INTO cart_items (
            uid, cart_uid, product_uid, variant_uid, quantity, added_at, price_snapshot, is_saved_for_later
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            cartItemUid,
            cart.uid,
            product_uid,
            variant_uid,
            quantity,
            new Date(),
            finalPrice,
            false
          ]
        );
        
        cartItem = {
          uid: cartItemUid,
          cart_uid: cart.uid,
          product_uid,
          variant_uid,
          quantity,
          added_at: new Date(),
          price_snapshot: finalPrice,
          is_saved_for_later: false
        };
      }
      
      await client.query('COMMIT');
      
      // Get updated cart details
      const updatedCartResult = await client.query(
        `SELECT ci.*, 
                p.name as product_name, 
                p.short_description, 
                p.base_price as current_price,
                p.unit_of_measure,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url,
                pv.variant_type,
                pv.variant_value,
                pv.additional_price
         FROM cart_items ci
         JOIN products p ON ci.product_uid = p.uid
         LEFT JOIN product_variants pv ON ci.variant_uid = pv.uid
         WHERE ci.uid = $1`,
        [cartItem.uid]
      );
      
      // Calculate updated cart totals
      const cartItemsResult = await client.query(
        `SELECT ci.price_snapshot, ci.quantity, ci.is_saved_for_later
         FROM cart_items ci
         WHERE ci.cart_uid = $1`,
        [cart.uid]
      );
      
      let subtotal = 0;
      let itemCount = 0;
      
      cartItemsResult.rows.forEach(item => {
        if (!item.is_saved_for_later) {
          subtotal += item.price_snapshot * item.quantity;
          itemCount += item.quantity;
        }
      });
      
      // Emit cart update via WebSocket
      io.to(`user:${uid}`).emit('cart_update', {
        cart_uid: cart.uid,
        update_type: existingItemResult.rows.length > 0 ? 'quantity_changed' : 'item_added',
        item_uid: cartItem.uid,
        product_uid,
        product_name: product.name,
        variant_uid,
        variant_info: variant ? `${variant.variant_type}: ${variant.variant_value}` : null,
        previous_quantity: existingItemResult.rows.length > 0 ? existingItemResult.rows[0].quantity : 0,
        new_quantity: cartItem.quantity,
        cart_total: subtotal,
        item_count: itemCount,
        updated_at: new Date()
      });
      
      res.status(200).json({
        success: true,
        message: existingItemResult.rows.length > 0 ? 'Cart item quantity updated' : 'Item added to cart',
        cart_item: updatedCartResult.rows[0],
        cart_summary: {
          subtotal,
          item_count: itemCount
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while adding item to cart' 
    });
  }
});

/**
 * Update Cart Item Endpoint
 * Updates the quantity of an item in the cart
 */
app.put('/api/cart/items/:item_uid', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { item_uid } = req.params;
    const { quantity, is_saved_for_later } = req.body;
    
    if (quantity === undefined && is_saved_for_later === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either quantity or saved status must be provided' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Check if item exists and belongs to user
      const itemResult = await client.query(
        `SELECT ci.*, c.uid as cart_uid
         FROM cart_items ci
         JOIN shopping_carts c ON ci.cart_uid = c.uid
         WHERE ci.uid = $1 AND c.user_uid = $2`,
        [item_uid, uid]
      );
      
      if (itemResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cart item not found or does not belong to you' 
        });
      }
      
      const cartItem = itemResult.rows[0];
      
      // If updating quantity, check inventory
      if (quantity !== undefined && quantity > 0) {
        // Get product and variant info
        const productResult = await client.query(
          'SELECT uid, name, quantity_available FROM products WHERE uid = $1',
          [cartItem.product_uid]
        );
        
        const product = productResult.rows[0];
        
        let variant = null;
        
        if (cartItem.variant_uid) {
          const variantResult = await client.query(
            'SELECT * FROM product_variants WHERE uid = $1',
            [cartItem.variant_uid]
          );
          
          variant = variantResult.rows[0];
          
          // Check variant inventory
          if (variant.quantity_available < quantity) {
            return res.status(400).json({ 
              success: false, 
              message: `Only ${variant.quantity_available} units available for this variant` 
            });
          }
        } else {
          // Check product inventory
          if (product.quantity_available < quantity) {
            return res.status(400).json({ 
              success: false, 
              message: `Only ${product.quantity_available} units available` 
            });
          }
        }
        
        // Update quantity
        await client.query(
          'UPDATE cart_items SET quantity = $1 WHERE uid = $2',
          [quantity, item_uid]
        );
      }
      
      // If updating saved status
      if (is_saved_for_later !== undefined) {
        await client.query(
          'UPDATE cart_items SET is_saved_for_later = $1 WHERE uid = $2',
          [is_saved_for_later, item_uid]
        );
      }
      
      // Update cart last activity
      await client.query(
        'UPDATE shopping_carts SET last_activity = $1, updated_at = $2 WHERE uid = $3',
        [new Date(), new Date(), cartItem.cart_uid]
      );
      
      // Get updated cart details
      const updatedItemResult = await client.query(
        `SELECT ci.*, 
                p.name as product_name, 
                p.short_description, 
                p.base_price as current_price,
                p.unit_of_measure,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url,
                pv.variant_type,
                pv.variant_value,
                pv.additional_price
         FROM cart_items ci
         JOIN products p ON ci.product_uid = p.uid
         LEFT JOIN product_variants pv ON ci.variant_uid = pv.uid
         WHERE ci.uid = $1`,
        [item_uid]
      );
      
      // Calculate updated cart totals
      const cartItemsResult = await client.query(
        `SELECT ci.price_snapshot, ci.quantity, ci.is_saved_for_later
         FROM cart_items ci
         WHERE ci.cart_uid = $1`,
        [cartItem.cart_uid]
      );
      
      let subtotal = 0;
      let itemCount = 0;
      
      cartItemsResult.rows.forEach(item => {
        if (!item.is_saved_for_later) {
          subtotal += item.price_snapshot * item.quantity;
          itemCount += item.quantity;
        }
      });
      
      // Get product and variant details for the WebSocket event
      const productNameResult = await client.query(
        'SELECT name FROM products WHERE uid = $1',
        [cartItem.product_uid]
      );
      
      let variantInfo = null;
      if (cartItem.variant_uid) {
        const variantResult = await client.query(
          'SELECT variant_type, variant_value FROM product_variants WHERE uid = $1',
          [cartItem.variant_uid]
        );
        
        if (variantResult.rows.length > 0) {
          variantInfo = `${variantResult.rows[0].variant_type}: ${variantResult.rows[0].variant_value}`;
        }
      }
      
      // Emit cart update via WebSocket
      io.to(`user:${uid}`).emit('cart_update', {
        cart_uid: cartItem.cart_uid,
        update_type: quantity !== undefined ? 'quantity_changed' : 'moved_to_saved',
        item_uid: cartItem.uid,
        product_uid: cartItem.product_uid,
        product_name: productNameResult.rows[0].name,
        variant_uid: cartItem.variant_uid,
        variant_info: variantInfo,
        previous_quantity: cartItem.quantity,
        new_quantity: quantity !== undefined ? quantity : cartItem.quantity,
        cart_total: subtotal,
        item_count: itemCount,
        updated_at: new Date()
      });
      
      res.status(200).json({
        success: true,
        message: 'Cart item updated',
        cart_item: updatedItemResult.rows[0],
        cart_summary: {
          subtotal,
          item_count: itemCount
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating cart item' 
    });
  }
});

/**
 * Remove Cart Item Endpoint
 * Removes an item from the cart
 */
app.delete('/api/cart/items/:item_uid', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { item_uid } = req.params;
    
    const client = await pool.connect();
    try {
      // Check if item exists and belongs to user
      const itemResult = await client.query(
        `SELECT ci.*, c.uid as cart_uid, p.name as product_name
         FROM cart_items ci
         JOIN shopping_carts c ON ci.cart_uid = c.uid
         JOIN products p ON ci.product_uid = p.uid
         WHERE ci.uid = $1 AND c.user_uid = $2`,
        [item_uid, uid]
      );
      
      if (itemResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cart item not found or does not belong to you' 
        });
      }
      
      const cartItem = itemResult.rows[0];
      
      // Get variant info if needed
      let variantInfo = null;
      if (cartItem.variant_uid) {
        const variantResult = await client.query(
          'SELECT variant_type, variant_value FROM product_variants WHERE uid = $1',
          [cartItem.variant_uid]
        );
        
        if (variantResult.rows.length > 0) {
          variantInfo = `${variantResult.rows[0].variant_type}: ${variantResult.rows[0].variant_value}`;
        }
      }
      
      // Remove the item
      await client.query(
        'DELETE FROM cart_items WHERE uid = $1',
        [item_uid]
      );
      
      // Update cart last activity
      await client.query(
        'UPDATE shopping_carts SET last_activity = $1, updated_at = $2 WHERE uid = $3',
        [new Date(), new Date(), cartItem.cart_uid]
      );
      
      // Calculate updated cart totals
      const cartItemsResult = await client.query(
        `SELECT ci.price_snapshot, ci.quantity, ci.is_saved_for_later
         FROM cart_items ci
         WHERE ci.cart_uid = $1`,
        [cartItem.cart_uid]
      );
      
      let subtotal = 0;
      let itemCount = 0;
      
      cartItemsResult.rows.forEach(item => {
        if (!item.is_saved_for_later) {
          subtotal += item.price_snapshot * item.quantity;
          itemCount += item.quantity;
        }
      });
      
      // Emit cart update via WebSocket
      io.to(`user:${uid}`).emit('cart_update', {
        cart_uid: cartItem.cart_uid,
        update_type: 'item_removed',
        item_uid: cartItem.uid,
        product_uid: cartItem.product_uid,
        product_name: cartItem.product_name,
        variant_uid: cartItem.variant_uid,
        variant_info: variantInfo,
        previous_quantity: cartItem.quantity,
        new_quantity: 0,
        cart_total: subtotal,
        item_count: itemCount,
        updated_at: new Date()
      });
      
      res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        cart_summary: {
          subtotal,
          item_count: itemCount
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while removing cart item' 
    });
  }
});

// ===== WISHLIST ROUTES =====

/**
 * Get User's Wishlists Endpoint
 * Returns all wishlists for the authenticated user
 */
app.get('/api/wishlists', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    
    const client = await pool.connect();
    try {
      // Get user's wishlists
      const wishlistsResult = await client.query(
        `SELECT w.*, 
                (SELECT COUNT(*) FROM wishlist_items wi WHERE wi.wishlist_uid = w.uid) as item_count
         FROM wishlists w
         WHERE w.user_uid = $1
         ORDER BY w.created_at DESC`,
        [uid]
      );
      
      res.status(200).json({
        success: true,
        wishlists: wishlistsResult.rows
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get wishlists error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving wishlists' 
    });
  }
});

/**
 * Create Wishlist Endpoint
 * Creates a new wishlist for the authenticated user
 */
app.post('/api/wishlists', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { name, description, is_public = false } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wishlist name is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Create wishlist
      const wishlistUid = `wish-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO wishlists (
          uid, user_uid, name, description, is_public, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          wishlistUid,
          uid,
          name,
          description || null,
          is_public,
          new Date(),
          new Date()
        ]
      );
      
      // Get the newly created wishlist
      const wishlistResult = await client.query(
        'SELECT * FROM wishlists WHERE uid = $1',
        [wishlistUid]
      );
      
      res.status(201).json({
        success: true,
        message: 'Wishlist created successfully',
        wishlist: wishlistResult.rows[0]
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create wishlist error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating wishlist' 
    });
  }
});

/**
 * Get Wishlist Details Endpoint
 * Returns details of a specific wishlist
 */
app.get('/api/wishlists/:wishlist_uid', async (req, res) => {
  try {
    const { wishlist_uid } = req.params;
    
    // Check if user is authenticated
    const user_uid = req.headers.authorization ? 
      jwt.verify(
        req.headers.authorization.split(' ')[1], 
        process.env.JWT_SECRET || 'constructmart_jwt_secret'
      ).uid : null;
    
    const client = await pool.connect();
    try {
      // Get wishlist details
      const wishlistResult = await client.query(
        'SELECT * FROM wishlists WHERE uid = $1',
        [wishlist_uid]
      );
      
      if (wishlistResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Wishlist not found' 
        });
      }
      
      const wishlist = wishlistResult.rows[0];
      
      // If wishlist is not public and user is not the owner
      if (!wishlist.is_public && wishlist.user_uid !== user_uid) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to view this wishlist' 
        });
      }
      
      // Get wishlist items
      const wishlistItemsResult = await client.query(
        `SELECT wi.*, 
                p.name as product_name, 
                p.short_description, 
                p.base_price,
                p.currency,
                p.quantity_available > 0 as in_stock,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url,
                pv.variant_type,
                pv.variant_value,
                pv.additional_price,
                pv.quantity_available > 0 as variant_in_stock
         FROM wishlist_items wi
         JOIN products p ON wi.product_uid = p.uid
         LEFT JOIN product_variants pv ON wi.variant_uid = pv.uid
         WHERE wi.wishlist_uid = $1
         ORDER BY wi.added_at DESC`,
        [wishlist_uid]
      );
      
      // Get wishlist owner info
      const ownerResult = await client.query(
        'SELECT first_name, last_name, profile_picture_url FROM users WHERE uid = $1',
        [wishlist.user_uid]
      );
      
      res.status(200).json({
        success: true,
        wishlist: {
          ...wishlist,
          items: wishlistItemsResult.rows,
          owner: ownerResult.rows[0]
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get wishlist details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving wishlist details' 
    });
  }
});

/**
 * Add Item to Wishlist Endpoint
 * Adds a product to a wishlist
 */
app.post('/api/wishlists/:wishlist_uid/items', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { wishlist_uid } = req.params;
    const { product_uid, variant_uid, notes } = req.body;
    
    // Validate required fields
    if (!product_uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product UID is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Check if wishlist exists and belongs to user
      const wishlistResult = await client.query(
        'SELECT * FROM wishlists WHERE uid = $1 AND user_uid = $2',
        [wishlist_uid, uid]
      );
      
      if (wishlistResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Wishlist not found or does not belong to you' 
        });
      }
      
      // Check if product exists
      const productResult = await client.query(
        'SELECT * FROM products WHERE uid = $1 AND is_active = true',
        [product_uid]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }
      
      // Check if variant exists if provided
      if (variant_uid) {
        const variantResult = await client.query(
          'SELECT * FROM product_variants WHERE uid = $1 AND product_uid = $2 AND is_active = true',
          [variant_uid, product_uid]
        );
        
        if (variantResult.rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: 'Product variant not found' 
          });
        }
      }
      
      // Check if item already exists in wishlist
      const existingItemResult = await client.query(
        'SELECT * FROM wishlist_items WHERE wishlist_uid = $1 AND product_uid = $2 AND variant_uid IS NOT DISTINCT FROM $3',
        [wishlist_uid, product_uid, variant_uid]
      );
      
      if (existingItemResult.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: 'This item is already in your wishlist' 
        });
      }
      
      // Add item to wishlist
      const wishlistItemUid = `wishitem-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO wishlist_items (
          uid, wishlist_uid, product_uid, variant_uid, added_at, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          wishlistItemUid,
          wishlist_uid,
          product_uid,
          variant_uid,
          new Date(),
          notes || null
        ]
      );
      
      // Update wishlist updated_at timestamp
      await client.query(
        'UPDATE wishlists SET updated_at = $1 WHERE uid = $2',
        [new Date(), wishlist_uid]
      );
      
      // Get the newly added item with product details
      const itemResult = await client.query(
        `SELECT wi.*, 
                p.name as product_name, 
                p.short_description, 
                p.base_price,
                p.currency,
                p.quantity_available > 0 as in_stock,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url,
                pv.variant_type,
                pv.variant_value,
                pv.additional_price,
                pv.quantity_available > 0 as variant_in_stock
         FROM wishlist_items wi
         JOIN products p ON wi.product_uid = p.uid
         LEFT JOIN product_variants pv ON wi.variant_uid = pv.uid
         WHERE wi.uid = $1`,
        [wishlistItemUid]
      );
      
      // Emit wishlist update via WebSocket
      io.to(`user:${uid}`).emit('wishlist_update', {
        wishlist_uid,
        wishlist_name: wishlistResult.rows[0].name,
        update_type: 'item_added',
        item_uid: wishlistItemUid,
        product_uid,
        product_name: productResult.rows[0].name,
        variant_uid,
        variant_info: itemResult.rows[0].variant_type ? 
          `${itemResult.rows[0].variant_type}: ${itemResult.rows[0].variant_value}` : null,
        in_stock: itemResult.rows[0].in_stock,
        updated_at: new Date()
      });
      
      res.status(201).json({
        success: true,
        message: 'Item added to wishlist',
        wishlist_item: itemResult.rows[0]
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while adding item to wishlist' 
    });
  }
});

/**
 * Remove Wishlist Item Endpoint
 * Removes an item from a wishlist
 */
app.delete('/api/wishlists/:wishlist_uid/items/:item_uid', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    const { wishlist_uid, item_uid } = req.params;
    
    const client = await pool.connect();
    try {
      // Check if wishlist exists and belongs to user
      const wishlistResult = await client.query(
        'SELECT * FROM wishlists WHERE uid = $1 AND user_uid = $2',
        [wishlist_uid, uid]
      );
      
      if (wishlistResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Wishlist not found or does not belong to you' 
        });
      }
      
      // Check if item exists
      const itemResult = await client.query(
        `SELECT wi.*, p.name as product_name, pv.variant_type, pv.variant_value
         FROM wishlist_items wi
         JOIN products p ON wi.product_uid = p.uid
         LEFT JOIN product_variants pv ON wi.variant_uid = pv.uid
         WHERE wi.uid = $1 AND wi.wishlist_uid = $2`,
        [item_uid, wishlist_uid]
      );
      
      if (itemResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Wishlist item not found' 
        });
      }
      
      const item = itemResult.rows[0];
      
      // Remove item from wishlist
      await client.query(
        'DELETE FROM wishlist_items WHERE uid = $1',
        [item_uid]
      );
      
      // Update wishlist updated_at timestamp
      await client.query(
        'UPDATE wishlists SET updated_at = $1 WHERE uid = $2',
        [new Date(), wishlist_uid]
      );
      
      // Emit wishlist update via WebSocket
      io.to(`user:${uid}`).emit('wishlist_update', {
        wishlist_uid,
        wishlist_name: wishlistResult.rows[0].name,
        update_type: 'item_removed',
        item_uid,
        product_uid: item.product_uid,
        product_name: item.product_name,
        variant_uid: item.variant_uid,
        variant_info: item.variant_type ? 
          `${item.variant_type}: ${item.variant_value}` : null,
        updated_at: new Date()
      });
      
      res.status(200).json({
        success: true,
        message: 'Item removed from wishlist'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Remove wishlist item error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while removing item from wishlist' 
    });
  }
});

// ===== ORDER ROUTES =====

/**
 * Create Order Endpoint
 * Creates a new order from the cart
 */
app.post('/api/orders', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { 
      shipping_address_uid, 
      billing_address_uid, 
      payment_method, 
      shipping_method,
      special_instructions,
      project_uid,
      is_gift,
      gift_message,
      cart_uid
    } = req.body;
    
    // Validate required fields
    if (!shipping_address_uid || !billing_address_uid || !payment_method) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shipping address, billing address, and payment method are required' 
      });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get user's active cart
      let cartResult;
      
      if (cart_uid) {
        cartResult = await client.query(
          'SELECT * FROM shopping_carts WHERE uid = $1 AND user_uid = $2',
          [cart_uid, uid]
        );
      } else {
        cartResult = await client.query(
          'SELECT * FROM shopping_carts WHERE user_uid = $1 AND is_active = true ORDER BY last_activity DESC LIMIT 1',
          [uid]
        );
      }
      
      if (cartResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'No active cart found' 
        });
      }
      
      const cart = cartResult.rows[0];
      
      // Get cart items (not saved for later)
      const cartItemsResult = await client.query(
        `SELECT ci.*, 
                p.name as product_name,
                p.seller_uid,
                p.quantity_available,
                pv.quantity_available as variant_quantity_available
         FROM cart_items ci
         JOIN products p ON ci.product_uid = p.uid
         LEFT JOIN product_variants pv ON ci.variant_uid = pv.uid
         WHERE ci.cart_uid = $1 AND ci.is_saved_for_later = false`,
        [cart.uid]
      );
      
      if (cartItemsResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cart is empty' 
        });
      }
      
      // Check inventory for all items
      for (const item of cartItemsResult.rows) {
        if (item.variant_uid) {
          if (item.variant_quantity_available < item.quantity) {
            return res.status(400).json({ 
              success: false, 
              message: `Only ${item.variant_quantity_available} units of ${item.product_name} (${item.variant_uid}) are available` 
            });
          }
        } else {
          if (item.quantity_available < item.quantity) {
            return res.status(400).json({ 
              success: false, 
              message: `Only ${item.quantity_available} units of ${item.product_name} are available` 
            });
          }
        }
      }
      
      // Verify shipping address
      const shippingAddressResult = await client.query(
        'SELECT * FROM addresses WHERE uid = $1 AND (user_uid = $2 OR company_uid = $3)',
        [shipping_address_uid, uid, company_uid]
      );
      
      if (shippingAddressResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid shipping address' 
        });
      }
      
      // Verify billing address
      const billingAddressResult = await client.query(
        'SELECT * FROM addresses WHERE uid = $1 AND (user_uid = $2 OR company_uid = $3)',
        [billing_address_uid, uid, company_uid]
      );
      
      if (billingAddressResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid billing address' 
        });
      }
      
      // Verify project if provided
      if (project_uid) {
        const projectResult = await client.query(
          'SELECT * FROM projects WHERE uid = $1 AND company_uid = $2',
          [project_uid, company_uid]
        );
        
        if (projectResult.rows.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid project' 
          });
        }
      }
      
      // Calculate totals
      let subtotal = 0;
      let tax_amount = 0;
      let shipping_amount = 0;
      
      cartItemsResult.rows.forEach(item => {
        subtotal += item.price_snapshot * item.quantity;
      });
      
      // Simple tax calculation (in reality, this would be more complex)
      tax_amount = subtotal * 0.1; // 10% tax
      
      // Simple shipping calculation (in reality, this would depend on shipping method, location, etc.)
      shipping_amount = 15.00;
      
      const total_amount = subtotal + tax_amount + shipping_amount;
      
      // Create order
      const orderUid = `order-${uuidv4().substring(0, 8)}`;
      const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      await client.query(
        `INSERT INTO orders (
          uid, order_number, buyer_uid, company_uid, project_uid, 
          order_status, order_date, total_amount, subtotal, 
          tax_amount, shipping_amount, discount_amount, currency, 
          payment_method, payment_status, shipping_address_uid, 
          billing_address_uid, shipping_method, special_instructions, 
          is_gift, gift_message, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          orderUid,
          orderNumber,
          uid,
          company_uid,
          project_uid || null,
          'pending',
          new Date(),
          total_amount,
          subtotal,
          tax_amount,
          shipping_amount,
          0, // discount_amount
          'USD', // currency
          payment_method,
          'pending', // payment_status
          shipping_address_uid,
          billing_address_uid,
          shipping_method || 'Standard',
          special_instructions || null,
          is_gift || false,
          gift_message || null,
          new Date(),
          new Date()
        ]
      );
      
      // Create order items
      for (const item of cartItemsResult.rows) {
        const orderItemUid = `orderitem-${uuidv4().substring(0, 8)}`;
        const itemSubtotal = item.price_snapshot * item.quantity;
        const itemTax = itemSubtotal * 0.1; // 10% tax
        
        await client.query(
          `INSERT INTO order_items (
            uid, order_uid, product_uid, variant_uid, quantity, 
            unit_price, subtotal, tax_amount, discount_amount, 
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            orderItemUid,
            orderUid,
            item.product_uid,
            item.variant_uid,
            item.quantity,
            item.price_snapshot,
            itemSubtotal,
            itemTax,
            0, // discount_amount
            'processing',
            new Date(),
            new Date()
          ]
        );
        
        // Update product inventory
        if (item.variant_uid) {
          await client.query(
            'UPDATE product_variants SET quantity_available = quantity_available - $1 WHERE uid = $2',
            [item.quantity, item.variant_uid]
          );
        } else {
          await client.query(
            'UPDATE products SET quantity_available = quantity_available - $1 WHERE uid = $2',
            [item.quantity, item.product_uid]
          );
        }
        
        // Update product total_orders count
        await client.query(
          'UPDATE products SET total_orders = total_orders + 1 WHERE uid = $1',
          [item.product_uid]
        );
        
        // Create notification for seller
        const notificationUid = `notif-${uuidv4().substring(0, 8)}`;
        
        // Get seller admin user
        const sellerAdminResult = await client.query(
          'SELECT uid FROM users WHERE company_uid = $1 AND user_type = \'vendor_admin\' LIMIT 1',
          [item.seller_uid]
        );
        
        if (sellerAdminResult.rows.length > 0) {
          const sellerUid = sellerAdminResult.rows[0].uid;
          
          await client.query(
            `INSERT INTO notifications (
              uid, user_uid, notification_type, title, message, related_to, created_at, is_read
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              notificationUid,
              sellerUid,
              'new_order',
              'New Order Received',
              `You have received a new order (#${orderNumber}) for ${item.product_name}`,
              JSON.stringify({
                entity_type: 'order',
                entity_uid: orderUid,
                product_uid: item.product_uid
              }),
              new Date(),
              false
            ]
          );
          
          // Emit seller order notification via WebSocket
          io.to(`user:${sellerUid}`).emit('seller_order_notification', {
            company_uid: item.seller_uid,
            order_uid: orderUid,
            order_number: orderNumber,
            buyer_uid: uid,
            buyer_name: `${req.user.first_name} ${req.user.last_name}`,
            order_total: total_amount,
            currency: 'USD',
            item_count: cartItemsResult.rows.length,
            requires_attention: true,
            created_at: new Date(),
            payment_status: 'pending'
          });
        }
      }
      
      // Clear cart
      await client.query(
        'DELETE FROM cart_items WHERE cart_uid = $1 AND is_saved_for_later = false',
        [cart.uid]
      );
      
      // Create notification for buyer
      const buyerNotificationUid = `notif-${uuidv4().substring(0, 8)}`;
      
      await client.query(
        `INSERT INTO notifications (
          uid, user_uid, notification_type, title, message, related_to, created_at, is_read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          buyerNotificationUid,
          uid,
          'order_status',
          'Order Confirmed',
          `Your order #${orderNumber} has been confirmed and is being processed.`,
          JSON.stringify({
            entity_type: 'order',
            entity_uid: orderUid
          }),
          new Date(),
          false
        ]
      );
      
      // Emit order status update via WebSocket
      io.to(`user:${uid}`).emit('order_status_update', {
        order_uid: orderUid,
        order_number: orderNumber,
        previous_status: null,
        new_status: 'pending',
        updated_at: new Date(),
        updated_by: 'system',
        note: 'Order created successfully'
      });
      
      // Emit notification via WebSocket
      io.to(`user:${uid}`).emit('notification', {
        notification_uid: buyerNotificationUid,
        user_uid: uid,
        notification_type: 'order_status',
        title: 'Order Confirmed',
        message: `Your order #${orderNumber} has been confirmed and is being processed.`,
        related_to: {
          entity_type: 'order',
          entity_uid: orderUid
        },
        created_at: new Date(),
        is_read: false
      });
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        order: {
          uid: orderUid,
          order_number: orderNumber,
          total_amount,
          subtotal,
          tax_amount,
          shipping_amount,
          status: 'pending',
          created_at: new Date()
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating order' 
    });
  }
});

/**
 * Get User's Orders Endpoint
 * Returns all orders for the authenticated user
 */
app.get('/api/orders', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid } = req.user;
    const { status, page = 1, limit = 10 } = req.query;
    
    const client = await pool.connect();
    try {
      let query = `
        SELECT o.*, 
               (SELECT COUNT(*) FROM order_items oi WHERE oi.order_uid = o.uid) as item_count,
               (SELECT json_agg(json_build_object(
                 'uid', oi.uid,
                 'product_uid', oi.product_uid,
                 'product_name', p.name,
                 'quantity', oi.quantity,
                 'unit_price', oi.unit_price,
                 'subtotal', oi.subtotal,
                 'status', oi.status,
                 'primary_image_url', (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1)
               ))
               FROM order_items oi
               JOIN products p ON oi.product_uid = p.uid
               WHERE oi.order_uid = o.uid) as items
        FROM orders o
        WHERE o.buyer_uid = $1
      `;
      
      const queryParams = [uid];
      let paramCounter = 2;
      
      if (company_uid) {
        query += ` AND o.company_uid = $${paramCounter++}`;
        queryParams.push(company_uid);
      }
      
      if (status) {
        query += ` AND o.order_status = $${paramCounter++}`;
        queryParams.push(status);
      }
      
      query += ` ORDER BY o.order_date DESC`;
      
      // Add pagination
      query += ` LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
      queryParams.push(limit, (page - 1) * limit);
      
      const ordersResult = await client.query(query, queryParams);
      
      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM orders o
        WHERE o.buyer_uid = $1
      `;
      
      const countParams = [uid];
      let countParamCounter = 2;
      
      if (company_uid) {
        countQuery += ` AND o.company_uid = $${countParamCounter++}`;
        countParams.push(company_uid);
      }
      
      if (status) {
        countQuery += ` AND o.order_status = $${countParamCounter++}`;
        countParams.push(status);
      }
      
      const countResult = await client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.status(200).json({
        success: true,
        orders: ordersResult.rows,
        pagination: {
          total_items: totalCount,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit)
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving orders' 
    });
  }
});

/**
 * Get Order Details Endpoint
 * Returns details of a specific order
 */
app.get('/api/orders/:order_uid', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid, user_type } = req.user;
    const { order_uid } = req.params;
    
    const client = await pool.connect();
    try {
      // Get order details
      const orderResult = await client.query(
        `SELECT o.*, 
                sa.recipient_name as shipping_recipient,
                sa.street_address_1 as shipping_street_address_1,
                sa.street_address_2 as shipping_street_address_2,
                sa.city as shipping_city,
                sa.state_province as shipping_state,
                sa.postal_code as shipping_postal_code,
                sa.country as shipping_country,
                ba.recipient_name as billing_recipient,
                ba.street_address_1 as billing_street_address_1,
                ba.street_address_2 as billing_street_address_2,
                ba.city as billing_city,
                ba.state_province as billing_state,
                ba.postal_code as billing_postal_code,
                ba.country as billing_country,
                p.name as project_name
         FROM orders o
         JOIN addresses sa ON o.shipping_address_uid = sa.uid
         JOIN addresses ba ON o.billing_address_uid = ba.uid
         LEFT JOIN projects p ON o.project_uid = p.uid
         WHERE o.uid = $1`,
        [order_uid]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }
      
      const order = orderResult.rows[0];
      
      // Check authorization
      const isBuyer = order.buyer_uid === uid;
      const isSeller = false; // Will be set to true below if user is a seller of any items
      const isAdmin = user_type === 'system_admin' || user_type === 'customer_support';
      
      if (!isBuyer && !isAdmin) {
        // Check if user is a seller of any items in the order
        const sellerCheckResult = await client.query(
          `SELECT DISTINCT p.seller_uid 
           FROM order_items oi
           JOIN products p ON oi.product_uid = p.uid
           WHERE oi.order_uid = $1 AND p.seller_uid = $2`,
          [order_uid, company_uid]
        );
        
        if (sellerCheckResult.rows.length === 0) {
          return res.status(403).json({ 
            success: false, 
            message: 'You do not have permission to view this order' 
          });
        }
        
        // Set isSeller flag
        isSeller = true;
      }
      
      // Get order items
      const orderItemsResult = await client.query(
        `SELECT oi.*, 
                p.name as product_name,
                p.short_description,
                p.seller_uid,
                p.currency,
                co.name as seller_name,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url,
                pv.variant_type,
                pv.variant_value
         FROM order_items oi
         JOIN products p ON oi.product_uid = p.uid
         JOIN companies co ON p.seller_uid = co.uid
         LEFT JOIN product_variants pv ON oi.variant_uid = pv.uid
         WHERE oi.order_uid = $1
         ORDER BY oi.created_at`,
        [order_uid]
      );
      
      // If user is a seller, filter items to only show their products
      let orderItems = orderItemsResult.rows;
      if (isSeller && !isAdmin) {
        orderItems = orderItems.filter(item => item.seller_uid === company_uid);
      }
      
      // Get status history
      // In a real implementation, we would have a separate table for order status history
      // For now, we'll just return the current status
      const statusHistory = [
        {
          status: order.order_status,
          timestamp: order.updated_at,
          note: 'Current status'
        },
        {
          status: 'pending',
          timestamp: order.created_at,
          note: 'Order created'
        }
      ];
      
      res.status(200).json({
        success: true,
        order: {
          ...order,
          items: orderItems,
          status_history: statusHistory,
          user_role: isAdmin ? 'admin' : (isSeller ? 'seller' : 'buyer')
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving order details' 
    });
  }
});

/**
 * Update Order Status Endpoint
 * Updates the status of an order (for sellers and admins)
 */
app.put('/api/orders/:order_uid/status', authenticateJWT, async (req, res) => {
  try {
    const { uid, company_uid, user_type } = req.user;
    const { order_uid } = req.params;
    const { 
      status, 
      tracking_number, 
      shipping_method, 
      estimated_delivery_date,
      note
    } = req.body;
    
    // Validate required fields
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is required' 
      });
    }
    
    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Get order
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE uid = $1',
        [order_uid]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }
      
      const order = orderResult.rows[0];
      
      // Check authorization
      const isAdmin = user_type === 'system_admin' || user_type === 'customer_support';
      let isSeller = false;
      
      if (!isAdmin) {
        // Check if user is a seller of any items in the order
        const sellerCheckResult = await client.query(
          `SELECT DISTINCT p.seller_uid 
           FROM order_items oi
           JOIN products p ON oi.product_uid = p.uid
           WHERE oi.order_uid = $1 AND p.seller_uid = $2`,
          [order_uid, company_uid]
        );
        
        isSeller = sellerCheckResult.rows.length > 0;
        
        if (!isSeller) {
          return res.status(403).json({ 
            success: false, 
            message: 'You do not have permission to update this order' 
          });
        }
      }
      
      // Proceed with update
      await client.query('BEGIN');
      
      const previousStatus = order.order_status;
      
      // Update the order
      await client.query(
        `UPDATE orders 
         SET order_status = $1, 
             tracking_number = COALESCE($2, tracking_number), 
             shipping_method = COALESCE($3, shipping_method), 
             estimated_delivery_date = COALESCE($4, estimated_delivery_date),
             updated_at = $5
         WHERE uid = $6`,
        [
          status,
          tracking_number,
          shipping_method,
          estimated_delivery_date,
          new Date(),
          order_uid
        ]
      );
      
      // If status is shipped, update all order items to shipped
      if (status === 'shipped') {
        if (isSeller) {
          // If seller, only update their items
          await client.query(
            `UPDATE order_items oi
             SET status = 'shipped', updated_at = $1
             FROM products p
             WHERE oi.product_uid = p.uid
             AND oi.order_uid = $2
             AND p.seller_uid = $3`,
            [new Date(), order_uid, company_uid]
          );
        } else {
          // If admin, update all items
          await client.query(
            `UPDATE order_items
             SET status = 'shipped', updated_at = $1
             WHERE order_uid = $2`,
            [new Date(), order_uid]
          );
        }
      }
      
      // If status is delivered, update all order items to delivered
      if (status === 'delivered') {
        if (isSeller) {
          // If seller, only update their items
          await client.query(
            `UPDATE order_items oi
             SET status = 'delivered', updated_at = $1
             FROM products p
             WHERE oi.product_uid = p.uid
             AND oi.order_uid = $2
             AND p.seller_uid = $3`,
            [new Date(), order_uid, company_uid]
          );
        } else {
          // If admin, update all items
          await client.query(
            `UPDATE order_items
             SET status = 'delivered', updated_at = $1
             WHERE order_uid = $2`,
            [new Date(), order_uid]
          );
        }
        
        // Update actual delivery date
        await client.query(
          `UPDATE orders
           SET actual_delivery_date = $1
           WHERE uid = $2`,
          [new Date(), order_uid]
        );
      }
      
      // Create notification for buyer
      const notificationUid = `notif-${uuidv4().substring(0, 8)}`;
      
      let notificationTitle = '';
      let notificationMessage = '';
      
      switch (status) {
        case 'processing':
          notificationTitle = 'Order Processing';
          notificationMessage = `Your order #${order.order_number} is now being processed.`;
          break;
        case 'shipped':
          notificationTitle = 'Order Shipped';
          notificationMessage = `Your order #${order.order_number} has been shipped! ${tracking_number ? `Track your package with tracking number ${tracking_number}.` : ''}`;
          break;
        case 'delivered':
          notificationTitle = 'Order Delivered';
          notificationMessage = `Your order #${order.order_number} has been delivered! Enjoy your new products.`;
          break;
        case 'cancelled':
          notificationTitle = 'Order Cancelled';
          notificationMessage = `Your order #${order.order_number} has been cancelled.`;
          break;
        default:
          notificationTitle = 'Order Status Updated';
          notificationMessage = `Your order #${order.order_number} status has been updated to ${status}.`;
      }
      
      await client.query(
        `INSERT INTO notifications (
          uid, user_uid, notification_type, title, message, related_to, created_at, is_read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          notificationUid,
          order.buyer_uid,
          'order_status',
          notificationTitle,
          notificationMessage,
          JSON.stringify({
            entity_type: 'order',
            entity_uid: order_uid
          }),
          new Date(),
          false
        ]
      );
      
      await client.query('COMMIT');
      
      // Emit order status update via WebSocket
      io.to(`user:${order.buyer_uid}`).emit('order_status_update', {
        order_uid,
        order_number: order.order_number,
        previous_status: previousStatus,
        new_status: status,
        updated_at: new Date(),
        updated_by: company_uid ? 'seller' : 'admin',
        note: note || '',
        tracking_number,
        estimated_delivery: estimated_delivery_date
      });
      
      // Emit notification via WebSocket
      io.to(`user:${order.buyer_uid}`).emit('notification', {
        notification_uid: notificationUid,
        user_uid: order.buyer_uid,
        notification_type: 'order_status',
        title: notificationTitle,
        message: notificationMessage,
        related_to: {
          entity_type: 'order',
          entity_uid: order_uid
        },
        created_at: new Date(),
        is_read: false
      });
      
      // If status is shipped, emit delivery update
      if (status === 'shipped' && tracking_number) {
        io.to(`order:${order_uid}`).emit('delivery_update', {
          order_uid,
          order_number: order.order_number,
          update_type: 'shipped',
          tracking_number,
          carrier: shipping_method,
          estimated_delivery: estimated_delivery_date,
          notes: note || 'Your order has been shipped!',
          updated_at: new Date()
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        order: {
          uid: order_uid,
          status,
          previous_status: previousStatus,
          tracking_number: tracking_number || order.tracking_number,
          shipping_method: shipping_method || order.shipping_method,
          estimated_delivery_date: estimated_delivery_date || order.estimated_delivery_date,
          updated_at: new Date()
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating order status' 
    });
  }
});

// ===== CATEGORY ROUTES =====

/**
 * Get Categories Endpoint
 * Returns all active categories, optionally filtered by parent
 */
app.get('/api/categories', async (req, res) => {
  try {
    const { parent_uid } = req.query;
    
    const client = await pool.connect();
    try {
      let query;
      let queryParams = [];
      
      if (parent_uid) {
        // Get categories with specific parent
        query = `
          SELECT c.*, 
                 (SELECT COUNT(*) FROM categories WHERE parent_uid = c.uid) as subcategory_count,
                 (SELECT COUNT(*) FROM products WHERE main_category_uid = c.uid OR subcategory_uid = c.uid) as product_count
          FROM categories c
          WHERE c.parent_uid = $1 AND c.is_active = true
          ORDER BY c.display_order, c.name
        `;
        queryParams = [parent_uid];
      } else {
        // Get top-level categories (no parent)
        query = `
          SELECT c.*, 
                 (SELECT COUNT(*) FROM categories WHERE parent_uid = c.uid) as subcategory_count,
                 (SELECT COUNT(*) FROM products WHERE main_category_uid = c.uid OR subcategory_uid = c.uid) as product_count
          FROM categories c
          WHERE c.parent_uid IS NULL AND c.is_active = true
          ORDER BY c.display_order, c.name
        `;
      }
      
      const categoriesResult = await client.query(query, queryParams);
      
      res.status(200).json({
        success: true,
        categories: categoriesResult.rows
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving categories' 
    });
  }
});

/**
 * Get Category Details Endpoint
 * Returns details of a specific category including subcategories
 */
app.get('/api/categories/:category_uid', async (req, res) => {
  try {
    const { category_uid } = req.params;
    
    const client = await pool.connect();
    try {
      // Get category details
      const categoryResult = await client.query(
        `SELECT c.*, 
                p.name as parent_name,
                p.uid as parent_uid,
                (SELECT COUNT(*) FROM products WHERE main_category_uid = c.uid OR subcategory_uid = c.uid) as product_count
         FROM categories c
         LEFT JOIN categories p ON c.parent_uid = p.uid
         WHERE c.uid = $1 AND c.is_active = true`,
        [category_uid]
      );
      
      if (categoryResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Category not found' 
        });
      }
      
      const category = categoryResult.rows[0];
      
      // Get subcategories
      const subcategoriesResult = await client.query(
        `SELECT c.*, 
                (SELECT COUNT(*) FROM products WHERE main_category_uid = c.uid OR subcategory_uid = c.uid) as product_count
         FROM categories c
         WHERE c.parent_uid = $1 AND c.is_active = true
         ORDER BY c.display_order, c.name`,
        [category_uid]
      );
      
      // Get popular products in this category
      const popularProductsResult = await client.query(
        `SELECT p.uid, p.name, p.short_description, p.base_price, p.currency, p.average_rating,
                (SELECT image_url FROM product_images WHERE product_uid = p.uid AND is_primary = true LIMIT 1) as primary_image_url
         FROM products p
         WHERE (p.main_category_uid = $1 OR p.subcategory_uid = $1) AND p.is_active = true
         ORDER BY p.total_views DESC
         LIMIT 6`,
        [category_uid]
      );
      
      res.status(200).json({
        success: true,
        category: {
          ...category,
          subcategories: subcategoriesResult.rows,
          popular_products: popularProductsResult.rows
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get category details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while retrieving category details' 
    });
  }
});

// ===== SEARCH ROUTES =====

/**
 * Search Products Endpoint
 * Searches for products based on the provided query
 */
app.get('/api/search', async (req, res) => {
  try {
    const { 
      q, 
      category_uid, 
      min_price, 
      max_price, 
      brand, 
      sort_by, 
      sort_order, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Validate required fields
    if (!q) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    const client = await pool.connect();
    try {
      // Log search query
      const sessionId = req.headers['x-session-id'] || `sess-${uuidv4().substring(0, 8)}`;
      const user_uid = req.headers.authorization ? 
        jwt.verify(
          req.headers.authorization.split(' ')[1], 
          process.env.JWT_SECRET || 'constructmart_jwt_secret'
        ).uid : null;
      
      const searchUid = `search-${uuidv4().substring(0, 8)}`;
      
      // Build search query
      let query = `
        SELECT p.*, 
               (SELECT COUNT(*) FROM reviews r WHERE r.product_uid = p.uid AND r.status = 'approved') as review_count,
               (SELECT COUNT(*) FROM product_images pi WHERE pi.product_uid = p.uid) as image_count,
               c.name as category_name,
               sc.name as subcategory_name,
               co.name as seller_name
        FROM products p
        LEFT JOIN categories c ON p.main_category_uid = c.uid
        LEFT JOIN categories sc ON p.subcategory_uid = sc.uid
        LEFT JOIN companies co ON p.seller_uid = co.uid
        WHERE p.is_active = true AND (
          p.name ILIKE $1 OR 
          p.short_description ILIKE $1 OR 
          p.long_description ILIKE $1 OR
          p.brand ILIKE $1 OR
          p.manufacturer ILIKE $1
        )
      `;
      
      const queryParams = [`%${q}%`];
      let paramCounter = 2;
      
      // Add filters
      if (category_uid) {
        query += ` AND (p.main_category_uid = $${paramCounter++} OR p.subcategory_uid = $${paramCounter++})`;
        queryParams.push(category_uid, category_uid);
      }
      
      if (min_price) {
        query += ` AND p.base_price >= $${paramCounter++}`;
        queryParams.push(min_price);
      }
      
      if (max_price) {
        query += ` AND p.base_price <= $${paramCounter++}`;
        queryParams.push(max_price);
      }
      
      if (brand) {
        query += ` AND p.brand ILIKE $${paramCounter++}`;
        queryParams.push(`%${brand}%`);
      }
      
      // Add sorting
      if (sort_by) {
        const validSortColumns = ['name', 'base_price', 'created_at', 'average_rating', 'total_views'];
        const validSortOrders = ['asc', 'desc'];
        
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
        const sortDirection = validSortOrders.includes(sort_order?.toLowerCase()) ? sort_order : 'desc';
        
        query += ` ORDER BY p.${sortColumn} ${sortDirection}`;
      } else {
        // Default sorting - relevance (not implemented here, would need full-text search)
        query += ` ORDER BY p.total_views DESC`;
      }
      
      // Add pagination
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
      queryParams.push(limit, offset);
      
      // Get count query for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.is_active = true AND (
          p.name ILIKE $1 OR 
          p.short_description ILIKE $1 OR 
          p.long_description ILIKE $1 OR
          p.brand ILIKE $1 OR
          p.manufacturer ILIKE $1
        )
      `;
      
      const countParams = [`%${q}%`];
      let countParamCounter = 2;
      
      if (category_uid) {
        countQuery += ` AND (p.main_category_uid = $${countParamCounter++} OR p.subcategory_uid = $${countParamCounter++})`;
        countParams.push(category_uid, category_uid);
      }
      
      if (min_price) {
        countQuery += ` AND p.base_price >= $${countParamCounter++}`;
        countParams.push(min_price);
      }
      
      if (max_price) {
        countQuery += ` AND p.base_price <= $${countParamCounter++}`;
        countParams.push(max_price);
      }
      
      if (brand) {
        countQuery += ` AND p.brand ILIKE $${countParamCounter++}`;
        countParams.push(`%${brand}%`);
      }
      
      // Execute queries
      const productsResult = await client.query(query, queryParams);
      const countResult = await client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / limit);
      
      // Log search
      await client.query(
        `INSERT INTO search_logs (
          uid, user_uid, session_uid, search_query, filters_applied, results_count, search_date, conversion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          searchUid,
          user_uid,
          sessionId,
          q,
          JSON.stringify({
            category_uid,
            min_price,
            max_price,
            brand,
            sort_by,
            sort_order
          }),
          totalCount,
          new Date(),
          false // Will be updated to true if user makes a purchase
        ]
      );
      
      // For each product, get primary image
      const productsWithImages = await Promise.all(productsResult.rows.map(async (product) => {
        const imageResult = await client.query(
          'SELECT image_url FROM product_images WHERE product_uid = $1 AND is_primary = true LIMIT 1',
          [product.uid]
        );
        
        let primary_image_url = null;
        if (imageResult.rows.length > 0) {
          primary_image_url = imageResult.rows[0].image_url;
        } else {
          // If no primary image, get the first image
          const firstImageResult = await client.query(
            'SELECT image_url FROM product_images WHERE product_uid = $1 ORDER BY display_order ASC LIMIT 1',
            [product.uid]
          );
          
          if (firstImageResult.rows.length > 0) {
            primary_image_url = firstImageResult.rows[0].image_url;
          }
        }
        
        return {
          ...product,
          primary_image_url
        };
      }));
      
      res.status(200).json({
        success: true,
        session_id: sessionId,
        query: q,
        filters: {
          category_uid,
          min_price,
          max_price,
          brand
        },
        products: productsWithImages,
        pagination: {
          total_items: totalCount,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit)
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while searching products' 
    });
  }
});

// ===== REAL-TIME SOCKET.IO ROUTES =====

// Handle socket connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Join user-specific room if authenticated
  if (socket.user) {
    const { uid } = socket.user;
    socket.join(`user:${uid}`);
    console.log(`User ${uid} joined their room`);
  }
  
  // Handle joining order-specific room
  socket.on('join_order', (data) => {
    const { order_uid } = data;
    
    // Verify user has access to this order
    if (socket.user) {
      const { uid, company_uid, user_type } = socket.user;
      
      // For simplicity, we'll just join the room
      // In a real implementation, we would verify the user has access to this order
      socket.join(`order:${order_uid}`);
      console.log(`User ${uid} joined order room: ${order_uid}`);
    }
  });
  
  // Handle joining product-specific room
  socket.on('join_product', (data) => {
    const { product_uid } = data;
    socket.join(`product:${product_uid}`);
    console.log(`Client joined product room: ${product_uid}`);
  });
  
  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { thread_uid, recipient_uid, message_content, subject, related_to_order_uid, related_to_product_uid } = data;
      
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      
      const { uid } = socket.user;
      
      if (!thread_uid || !recipient_uid || !message_content) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }
      
      const client = await pool.connect();
      try {
        // Create message
        const messageUid = `msg-${uuidv4().substring(0, 8)}`;
        
        await client.query(
          `INSERT INTO messages (
            uid, thread_uid, sender_uid, recipient_uid, related_to_order_uid, 
            related_to_product_uid, subject, message_content, created_at, is_read
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            messageUid,
            thread_uid,
            uid,
            recipient_uid,
            related_to_order_uid || null,
            related_to_product_uid || null,
            subject || null,
            message_content,
            new Date(),
            false
          ]
        );
        
        // Get sender details
        const senderResult = await client.query(
          'SELECT first_name, last_name, profile_picture_url, user_type FROM users WHERE uid = $1',
          [uid]
        );
        
        const sender = senderResult.rows[0];
        
        // Create notification for recipient
        const notificationUid = `notif-${uuidv4().substring(0, 8)}`;
        
        await client.query(
          `INSERT INTO notifications (
            uid, user_uid, notification_type, title, message, related_to, created_at, is_read
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            notificationUid,
            recipient_uid,
            'new_message',
            'New Message',
            `You have a new message from ${sender.first_name} ${sender.last_name}`,
            JSON.stringify({
              entity_type: 'message',
              entity_uid: messageUid,
              thread_uid
            }),
            new Date(),
            false
          ]
        );
        
        // Prepare message data for emitting
        const messageData = {
          message_uid: messageUid,
          thread_uid,
          sender_uid: uid,
          sender_name: `${sender.first_name} ${sender.last_name}`,
          sender_type: sender.user_type,
          recipient_uid,
          subject,
          message_content,
          created_at: new Date(),
          is_read: false,
          related_to_order_uid,
          related_to_product_uid,
          has_attachments: false
        };
        
        // Emit to both sender and recipient
        io.to(`user:${uid}`).emit('message', messageData);
        io.to(`user:${recipient_uid}`).emit('message', messageData);
        
        // Emit notification to recipient
        io.to(`user:${recipient_uid}`).emit('notification', {
          notification_uid: notificationUid,
          user_uid: recipient_uid,
          notification_type: 'new_message',
          title: 'New Message',
          message: `You have a new message from ${sender.first_name} ${sender.last_name}`,
          related_to: {
            entity_type: 'message',
            entity_uid: messageUid,
            thread_uid
          },
          created_at: new Date(),
          is_read: false
        });
        
        // Acknowledge successful send
        socket.emit('message_sent', { message_uid: messageUid });
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });
  
  // Handle mark notification as read
  socket.on('mark_notification_read', async (data) => {
    try {
      const { notification_uid } = data;
      
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      
      const { uid } = socket.user;
      
      const client = await pool.connect();
      try {
        // Verify notification belongs to user
        const notificationResult = await client.query(
          'SELECT uid FROM notifications WHERE uid = $1 AND user_uid = $2',
          [notification_uid, uid]
        );
        
        if (notificationResult.rows.length === 0) {
          socket.emit('error', { message: 'Notification not found' });
          return;
        }
        
        // Mark as read
        await client.query(
          'UPDATE notifications SET is_read = true, read_at = $1 WHERE uid = $2',
          [new Date(), notification_uid]
        );
        
        // Acknowledge
        socket.emit('notification_marked_read', { notification_uid });
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Mark notification read error:', error);
      socket.emit('error', { message: 'Error marking notification as read' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`ConstructMart server running on port ${PORT}`);
});