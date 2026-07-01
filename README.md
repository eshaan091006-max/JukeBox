# 🕹️ JukeBox

**JukeBox** is a real-time, retro-styled music streaming application built with **Flutter** and **Supabase**. It features a pixel-perfect aesthetic inspired by 8-bit classics, combined with a modern music player experience.

---

## 🚀 Features

- **Retro Aesthetic:** Custom pixel font (**Nihonium**) and hand-crafted pixel icons.
- **Real-Time Streaming:** High-quality audio playback using `just_audio`.
- **Dynamic Search:** Search through the database for your favorite tracks with instant results.
- **Persistent Mini-Player:** Keep the music going while browsing other sections of the app.
- **Secure Auth:** User login and registration powered by **Supabase Auth**.
- **Browse & Discover:** Randomized discovery mode to find new sounds on the home screen.

---

## 🛠 Tech Stack

| Technology     | Use Case                                 |
| :------------- | :--------------------------------------- |
| **Flutter**    | Cross-platform mobile framework          |
| **Supabase**   | Backend, Database, & User Authentication |
| **Just Audio** | Professional audio playback engine       |
| **Nihonium**   | Custom pixel-art typography              |
| **Dotenv**     | Secure environment variable management   |

---

## ⚙️ Setup & Installation

### 1. Prerequisites

- Flutter SDK installed.
- A Supabase project created.

### 2. Environment Variables

Create a `.env` file in the root directory and add your Supabase credentials:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```
