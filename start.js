const { spawn } = require("child_process");
const path = require("path");

const services = [
  {
    name: "dummyrapido-backend",
    cwd: "Frontend/DummyRapido/backend",
    command: "node",
    args: ["index.js"]
  },
  {
    name: "auth-service",
    cwd: "Backend/AuthService",
    command: "node",
    args: ["index.js"]
  },
  {
    name: "policy-service",
    cwd: "Backend/PolicyService",
    command: "node",
    args: ["index.js"]
  },
  {
    name: "payment-service",
    cwd: "Backend/PaymentService",
    command: "node",
    args: ["src/app.js"]
  },
  {
    name: "address-polling",
    cwd: "Backend/AddressPolling",
    command: "node",
    args: ["index.js"]
  },
  {
    name: "main-service",
    cwd: "Backend/MainService",
    command: "node",
    args: ["index.js"]
  },
  {
    name: "notification-service",
    cwd: "Backend/NotificationService",
    command: "node",
    args: ["server.js"]
  },
  {
    name: "ml-service",
    cwd: "Backend/ML-Service",
    command: "python",
    args: ["run.py"]
  },
  {
    name: "user-dashboard",
    cwd: "Frontend/UserDashboard/reactjs",
    command: "npm",
    args: ["run", "dev"]
  },
  {
    name: "dummyrapido-frontend",
    cwd: "Frontend/DummyRapido/frontend",
    command: "npm",
    args: ["run", "dev"]
  },
  {
    name: "admin-dashboard",
    cwd: "Frontend/AdminDashboard",
    command: "npm",
    args: ["run", "dev"]
  }
];

const children = [];

console.log("🚀 Starting all RideShield services in dev mode...");

services.forEach((service) => {
  const absoluteCwd = path.resolve(__dirname, service.cwd);
  
  const child = spawn(service.command, service.args, {
    cwd: absoluteCwd,
    shell: true,
    env: { ...process.env }
  });

  children.push({ proc: child, name: service.name });

  child.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach(line => {
      if (line) console.log(`[${service.name}] ${line}`);
    });
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach(line => {
      if (line) console.error(`[${service.name}] [ERR] ${line}`);
    });
  });

  child.on("close", (code) => {
    console.log(`[${service.name}] Process exited with code ${code}`);
  });
});

// Graceful shutdown on Ctrl+C
const shutdown = () => {
  console.log("\n🛑 Shutting down all services gracefully...");
  children.forEach(({ proc, name }) => {
    if (proc.pid) {
      console.log(`Killing ${name} (PID: ${proc.pid})...`);
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", proc.pid, "/f", "/t"]);
      } else {
        proc.kill("SIGINT");
      }
    }
  });
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
