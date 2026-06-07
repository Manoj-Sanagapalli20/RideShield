module.exports = {
  apps: [
    // Backend API Services
    {
      name: "dummyrapido-backend",
      script: "index.js",
      cwd: "Frontend/DummyRapido/backend",
      env: { MONGO_URI: process.env.RAPIDO_MONGO_URI }
    },
    {
      name: "auth-service",
      script: "index.js",
      cwd: "Backend/AuthService"
    },
    {
      name: "policy-service",
      script: "index.js",
      cwd: "Backend/PolicyService"
    },
    {
      name: "payment-service",
      script: "src/app.js",
      cwd: "Backend/PaymentService",
      env: { MONGO_URI: process.env.PAYMENT_MONGO_URI }
    },
    {
      name: "address-polling",
      script: "index.js",
      cwd: "Backend/AddressPolling"
    },
    {
      name: "main-service",
      script: "index.js",
      cwd: "Backend/MainService"
    },
    {
      name: "notification-service",
      script: "server.js",
      cwd: "Backend/NotificationService"
    },
    
    // ML Python Service
    {
      name: "ml-service",
      interpreter: "python3",
      script: "run.py",
      cwd: "Backend/ML-Service"
    },

    // Frontend Static Assets (served via PM2 built-in serve)
    {
      name: "user-dashboard",
      script: "serve",
      env: {
        PM2_SERVE_PATH: "Frontend/UserDashboard/reactjs/dist",
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: "true"
      }
    },
    {
      name: "dummyrapido-frontend",
      script: "serve",
      env: {
        PM2_SERVE_PATH: "Frontend/DummyRapido/frontend/dist",
        PM2_SERVE_PORT: 3001,
        PM2_SERVE_SPA: "true"
      }
    }
  ]
};
