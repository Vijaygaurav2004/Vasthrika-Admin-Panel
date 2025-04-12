# Vasthrika Admin

Admin dashboard for managing Vasthrika's products, categories, and orders.

## Features

- Authentication with Google Sign-In
- Product management (CRUD operations)
- Category management
- Order tracking
- Responsive design
- Dark mode support

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Firebase (Auth, Firestore, Storage)
- NextAuth.js
- shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project
- Google Cloud project with OAuth 2.0 credentials

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/vasthrika-admin.git
   cd vasthrika-admin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables file:
   ```bash
   cp .env.local.example .env.local
   ```

4. Update the environment variables in `.env.local` with your:
   - Firebase configuration
   - Firebase Admin credentials
   - Google OAuth credentials
   - NextAuth secret
   - Admin email addresses

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
vasthrika-admin/
├── app/                    # Next.js app directory
│   ├── (admin)/           # Admin routes (protected)
│   ├── api/               # API routes
│   └── login/            # Authentication pages
├── components/            # React components
├── lib/                   # Utility functions and configurations
└── public/               # Static assets
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
