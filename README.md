# DocCare — Advanced Doctor Appointment, Online Payment & Prescription Management System

A production-ready Full-Stack MERN (MongoDB, Express, React, Node.js) Healthcare Management Platform featuring appointment scheduling, Indian online payment gateway integration (Razorpay), cryptographic payment verification, digital medical prescription management with on-the-fly PDF streaming, role-based access control, and comprehensive administrative oversight.

---

## 🚀 Key Modules & Capabilities

### 1. Patient Portal
- **Discovery & Search**: Browse verified physicians, filter by clinical specialization and location, search by physician name.
- **Doctor Profiles**: Comprehensive credentials, qualifications, experience, consulting fees, and weekly schedule preview.
- **Dynamic Slot Booking**: Real-time consultation slot generation respecting doctor working hours, break periods, and existing bookings.
- **Online Payment**: Integrated Razorpay checkout with UPI, Card, and Net Banking simulation, instant payment receipt verification.
- **Consultation Dashboard**: Track upcoming and historical appointments, notes, cancellation tracking, and refund tracking.
- **Medical Prescriptions**: View digital prescriptions and download official clinic letterhead medical PDFs.

### 2. Physician (Doctor) Portal
- **Consultation Schedule Management**: Set working days, consultation hours, appointment slot duration (10–180 mins), and break intervals.
- **Verification Workflow**: Submit medical board licenses and credentials for administrative review and approval.
- **Consultation Management**: Review daily appointments, mark visits as completed with clinical notes.
- **Digital Prescription Pad**: Issue official digital prescriptions with clinical diagnoses, reported symptoms, structured medications (name, dosage, frequency, duration, instructions), advice, and follow-up review dates.
- **Prescription Archive**: Full history of issued prescriptions with clinical search by diagnosis.

### 3. Administrative Portal
- **Analytics & Oversight**: Real-time KPI dashboard displaying total registered users, patients, doctors, verified doctors, appointments, cancellations, and financial revenue.
- **Physician Verification Queue**: Review doctor credentials, approve verified practitioners, or reject with reason.
- **User Account Governance**: Search, paginate, and toggle account blocks for misbehaving patients or unverified doctors.
- **System Integrity Guard**: Self-lockout prevention ensuring admin accounts cannot be accidentally blocked.

### 4. Razorpay Online Payment Integration (Phase 7)
- **Indian Payment Gateway**: Full integration with Razorpay test mode (orders, payment capture, and automated refunds).
- **Zero-Trust Client Verification**: Payment confirmations from frontend are never trusted; payments require server-side HMAC-SHA256 signature verification.
- **Idempotency & Concurrency**: Strict prevention of duplicate payments and double bookings.
- **Automatic Refunds**: Appointment cancellations automatically process and record payment refunds in database state.

### 5. Digital Prescription & PDF Generation (Phase 8)
- **Structured Clinical Regimen**: Diagnosis, symptoms, medication table, general dietary/lifestyle advice, and follow-up dates.
- **PDFKit Binary Streaming**: Direct in-memory streaming of formatted clinic letterhead PDFs with zero disk clutter.
- **Privacy & Ownership Guards**: Strict tenant isolation preventing cross-patient and cross-doctor data leaks (`HTTP 403 Forbidden`).

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Redux Toolkit, React Router v7, Vite, Tailwind CSS, Axios |
| **Backend** | Node.js (ESM), Express.js 5, Mongoose 9 |
| **Database** | MongoDB (indexed collections for User, Appointment, Payment, Prescription) |
| **Security** | JWT (jsonwebtoken), Bcrypt.js (10 salt rounds), HMAC-SHA256 cryptography |
| **Payments** | Razorpay Node.js SDK (Orders, Verification, Refunds) |
| **Reporting & PDF** | PDFKit (Dynamic binary stream generation) |

---

## 📋 Environment Configuration

Copy the template file to set up environment variables:

```bash
cp backend/.env.example backend/.env
```

### Environment Variables Reference (`backend/.env`)

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection String
MONGO_URI=mongodb://127.0.0.1:27017/online_doctor_appointment

# Authentication Secrets
JWT_SECRET=super_secret_jwt_key_doctor_appointment_system_2026_dev
JWT_EXPIRES_IN=7d

# Razorpay Payment Gateway Credentials (Test Mode)
RAZORPAY_KEY_ID=rzp_test_DocCare2026
RAZORPAY_KEY_SECRET=DocCareRazorpaySecret2026

# Administrator Seed Account
ADMIN_EMAIL=admin@hospital.com
ADMIN_PASSWORD=Admin@123456
```

---

## ⚡ Installation & Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- MongoDB running locally or a MongoDB Atlas connection URI

### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 3. Seed Database

```bash
# Seed initial admin account
npm run seed:admin --prefix backend

# (Optional) Seed realistic verified doctors
npm run seed:doctors --prefix backend
```

### 4. Run Development Servers

```bash
# Start backend server (Port 5000)
npm run dev --prefix backend

# Start frontend development server (Vite - Port 5173)
npm run dev --prefix frontend
```

---

## 🔒 Security Architecture & Guardrails

1. **Password Protection**: Salted and hashed with Bcrypt (10 rounds). Plain text passwords are never persisted.
2. **Field-Level Projection Protection**: The `password` field has `select: false` on the User model; it is excluded from queries and API responses by default.
3. **Cryptographic Identity Verification**: All private routes require cryptographically valid JWT tokens; invalid or expired tokens return `HTTP 401 Unauthorized`.
4. **Role-Based Authorization (RBAC)**: Strict server-side route guards prevent role escalation. Patients cannot access doctor or admin endpoints (`HTTP 403 Forbidden`).
5. **Doctor Ownership Isolation**: Doctors can only prescribe medications and update statuses for their own assigned consultations.
6. **Patient Privacy Guard**: Medical prescriptions and appointment details can only be viewed or downloaded by the owning patient or the prescribing physician.
7. **Payment Signature Verification**: Razorpay checkout generates a server-side HMAC-SHA256 signature calculated from `orderId + "|" + paymentId` and the secret key. Tampered signatures are immediately rejected.
8. **Concurrency Control**: Unique compound indexing prevents simultaneous double-booking of identical doctor consultation slots.

---

## 🧪 Automated Testing & Verification

The project includes independent end-to-end regression and verification test suites:

```bash
# Run Master Security & System Audit (Phase 9)
node backend/src/utils/verifyPhase9FullSystem.js

# Run Digital Prescription Tests (Phase 8)
node backend/src/utils/testPhase8.js
node backend/src/utils/verifyPhase8.js

# Run Online Payment Tests (Phase 7)
node backend/src/utils/testPhase7.js
node backend/src/utils/verifyPhase7.js

# Run Appointment Booking Tests (Phase 6)
node backend/src/utils/verifyPhase6.js

# Run Full System 14-Area Verification (Phase 5)
node backend/src/utils/verifyAll14Areas.js

# Run Frontend Linting & Production Build
npm run lint --prefix frontend
npm run build --prefix frontend
```

---

## 📦 Production Deployment

### Building for Production
```bash
# Build frontend static bundle
npm run build --prefix frontend

# Set production environment variable in backend/.env:
# NODE_ENV=production

# Start unified server
npm start --prefix backend
```
In `production` mode, the Express server automatically serves the compiled React single-page application from `frontend/dist/` with catch-all routing and JSON 404 handlers for API routes.

---

## 📄 License & Attribution
DocCare Healthcare Telehealth System — Developed in 9 Progressive Modules. All test suites executed with fictional testing data only.

