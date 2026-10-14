# 🏋️ FitZone Gym – Membership Management System

> **Owner authentication development branch:** the uploaded nine-column Apps Script
> baseline and setup/rotation instructions are in [backend/OWNER_AUTH_SETUP.md](backend/OWNER_AUTH_SETUP.md).
> Login now requires Owner ID + Password and a matching POST-session backend.
> These changes have not been deployed; existing generated deployment assets below
> are older releases. Run `npm test`, `npm run typecheck`, `npm run lint`, and
> `npm run build` before review. Production behavior is not verified by mocked tests.

🔗 **Live Application**  
https://yellankikaushik.github.io/Gym-Membership/

---

## 🚀 Overview

**FitZone Gym – Membership Management System** is a full-stack, production-grade application designed to replace spreadsheet-based gym management with a clean, secure, and intelligent system.

The project focuses on:

- Admin efficiency  
- Membership expiry intelligence  
- Zero-cost serverless backend  
- Real-world business applicability  

This system is **not a demo toy** — it is architected like a lean SaaS product.

---

## 👤 Member Features (Public / Read-Only)

- Member lookup using **Member ID**
- View membership status (**Active / Expired**)
- Membership plans supported:
  - 3 Months
  - 6 Months
  - 1 Year
- Start date & expiry date
- Remaining days displayed
- Phone number masking for privacy
- No authentication required for members

---

## 🛠️ Admin Panel (Private & Secure)

- Password-protected admin login
- Add new members
- Edit existing members
- Renew memberships
- Delete members
- Status-based filtering:
  - All
  - Active
  - Expired
- Professional, responsive UI
- Zero direct database access for users

---

## 🔔 Core USP — Admin Expiry Alert Engine

This is the **key differentiator** of the project.

The system includes a **fully automated admin-only email alert engine** that proactively informs the gym owner about expiring memberships.

### ✅ What It Does

- Automatically checks membership expiry dates
- Sends alerts **only to the admin email**
- Triggers alerts when a membership:
  - Expires today
  - Expires tomorrow
  - Expires in 2 days
  - Is already expired
- Sends **one-time notification per member**
- No duplicate emails
- No third-party services

### ✅ Why This Matters

Admins don’t need to:

- Open spreadsheets
- Manually check expiry dates
- Remember renewals

**USP statement for demos:**

> “The system proactively informs the admin before revenue is lost.”

---

## 📧 Sample Email (Actual Format)

**Subject:**  
`Membership Expiry Alert | FitZone`

**Body:**
Membership Alerts | FitZone

Membership of below members is going to expire:

ID: GYM004
Name: Kaushik
Phone: 7878787878
Status: Expires today
Ends: 2026-01-22

ID: GYM005
Name: Rahul Kiran
Phone: 5656565656
Status: Expires in 2 days
Ends: 2026-01-24

With regards,
FitZone, Hyderabad


---

## ⏱️ How Email Automation Works

- Backend runs on **Google Apps Script**
- A **time-based trigger** executes daily
- Trigger calls:
checkMembershipExpiries()

- Script reads Google Sheets data
- Sends alert email if conditions match
- Marks rows as “notified” to avoid duplicate alerts

⚠️ **Backend code is intentionally not inside GitHub**  
It runs securely inside Google Apps Script and connects directly to Google Sheets.

---

## 🧱 System Architecture

React + TypeScript (Frontend)
↓
Google Apps Script (Backend API)
↓
Google Sheets (Database)
↓
Gmail Service (Admin Alerts)


This architecture is:

- Serverless  
- Cost-free  
- Secure  
- Scalable for small businesses  

---

## 🧑‍💻 Tech Stack

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- Framer Motion

### Backend
- Google Apps Script
- Google Sheets (Database)
- GmailApp (Email Engine)

### Deployment
- GitHub Pages (`/docs` folder)

---

## 📂 Project Structure

Gym-Membership/
├── src/
│ ├── pages/
│ ├── api/
│ └── config/
├── docs/ # GitHub Pages build output
├── public/
├── README.md
└── vite.config.ts


---

## 🎯 Why This Project Is Strong

- Solves a real business problem
- Zero paid services
- Clean frontend/backend separation
- Admin-first intelligence (USP)
- Excellent interview & demo project
- Shows system design thinking, not just UI

---

## 🔮 Future Enhancements

- SMS alerts to members
- Payment & billing history
- Analytics dashboard
- Multi-branch gym support
- Role-based access control

---

## 👨‍💼 Author

**Kaushik**  
India 🇮🇳

---

⭐ If this project helped or inspired you, consider starring the repository.
