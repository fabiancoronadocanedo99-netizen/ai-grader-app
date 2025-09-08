# AI Grader Application

## Overview
This is a Next.js application that provides an AI-powered grading system for educational use. The application allows teachers to create classes and manage exams with automated grading capabilities.

## Project Architecture
- **Frontend Framework**: Next.js 15.5.2 with TypeScript
- **Styling**: Tailwind CSS with a neumorphism design system
- **Authentication & Database**: Supabase (PostgreSQL backend)
- **Deployment**: Configured for Replit autoscale deployment

## Key Features
- User authentication (login/logout)
- Class management dashboard
- Exam creation and management
- AI-powered grading system
- Responsive design with modern neumorphic UI

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard pages
│   │   ├── class/        # Class-specific pages
│   │   └── exam/         # Exam management
│   ├── login/            # Authentication pages
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   └── CreateClassModal.tsx
└── lib/                 # Utilities
    └── supabaseClient.ts # Supabase configuration
```

## Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous API key

## Database Schema
The application expects the following Supabase tables:
- `classes`: Stores class information (id, name, subject, grade_level, created_at)
- Additional tables for exams and grading (to be implemented)

## Recent Changes
- **2025-01-08**: Initial setup for Replit environment
  - Configured Next.js for proxy compatibility
  - Set up development workflow on port 5000
  - Fixed import paths and module resolution
  - Configured deployment for autoscale hosting

## Development Notes
- The application is configured to run on port 5000 for Replit compatibility
- Supabase credentials must be properly configured for authentication to work
- The neumorphic design uses custom CSS shadows for the visual effect