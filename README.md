# 🚀 CareerTrack — Opportunity Tracker

A full stack web application built for engineering students to track internships, hackathons, and placement opportunities — with smart deadline reminders so you never miss an application window. 📌

## 💡 Why I Built This

During internship season, opportunities get shared in WhatsApp groups constantly. It's easy to lose track of deadlines and miss out on applying. CareerTrack solves this by letting students log opportunities, mark whether they intend to apply, and get reminded before deadlines pass. ⏰

## ✨ Features

- 🔐 **JWT Authentication** — secure signup/login so each user manages their own personal opportunity list.
- ✅❌ **Smart Apply Intent (Yes/No)** — every opportunity defaults to "Yes" (want to apply). Status tracking only activates for opportunities marked Yes; switching to "No" instantly cancels all reminders.
- 📊 **Status Tracking** — Pending, Applied, Interview, Offer, Rejected — visible only for opportunities you're actually pursuing.
- 🔔 **Deadline Reminders** — browser notifications triggered 24 hours and 2-3 hours before a deadline, automatically cancelled if marked No.
- 📈 **Dashboard** — real-time stats on total opportunities, status breakdown, and upcoming deadlines highlighted as they get close.
- 🔍 **Filters & Search** — filter by status or apply intent, search by company name, sort by deadline.

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Auth:** JWT (JSON Web Tokens)

## 📁 Project Structure

\`\`\`
job-tracker/
├── config/
├── middleware/
├── models/
├── public/
├── routes/
├── server.js
└── package.json
\`\`\`

## 🔮 Future Improvements

- 🌐 Deploy to a live hosting platform
- 📱 Make the UI fully responsive
- 📧 Add email/WhatsApp reminders for users who aren't on the site

## 👩‍💻 Author

**Mitakshi**
