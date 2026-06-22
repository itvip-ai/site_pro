# QGROUP Catalog Application - Development Guide

This is a web application for managing an online product catalog with admin panel, user roles, and secure pricing.

## Project Structure
- `/src` - Backend application code
  - `/config` - Database and app configuration
  - `/models` - Database models
  - `/routes` - API routes
  - `/controllers` - Business logic
  - `/middleware` - Express middleware
  - `/utils` - Helper functions
- `/views` - EJS templates for frontend
- `/public` - Static assets (CSS, JS, images)
- `/scripts` - Utility scripts (import, seeding, migrations)
- `/data` - SQLite database (created at runtime)

## Key Features
- Public storefront with product catalog (search, filters by category)
- Role-based access (public, partner, manager, admin)
- Secure partner pricing (server-side validation)
- Admin panel for CRUD operations
- Image upload with WebP conversion
- Excel price file import with image extraction
- User management system
- Authentication with bcrypt & sessions

## Getting Started
1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Run `npm run seed` to create admin account
4. Run `npm run dev` to start development server
5. Access at http://localhost:3000

## Important Notes
- Partner prices are never sent to unauthenticated users
- All pricing authorization checks happen server-side
- Images are automatically converted to WebP format
- Database is SQLite by default (easy migration to PostgreSQL/MySQL)
