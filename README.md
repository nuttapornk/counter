# Jump Rope Trainer | โปรแกรมฝึกกระโดดเชือก 🪢

A progressive web application (PWA) designed for jump rope training. It features customizable interval timers, a built-in metronome, and a ghost mode to help you track and improve your performance.

## 🌟 Features

- **Training Modes:**
  - 🟢 **Beginner:** 30s Work / 45s Rest / 10 Rounds (~12.5 mins)
  - 🟡 **Intermediate:** 45s Work / 30s Rest / 15 Rounds (~18.75 mins)
  - 🔴 **Professional:** 60s Work / 15s Rest / 20 Rounds (~25 mins)
  - ⚙️ **Custom:** Set your own work time, rest time, and rounds.
- **👻 Ghost Mode:** Compete against your previous session's statistics.
- **🎵 BPM Metronome:** Built-in metronome with adjustable BPM (60-200) to keep your jumping rhythm steady.
- **📊 Summary Screen:** Displays total time, estimated calories burned, completed rounds, and total work time.
- **📱 PWA Support:** Installable on mobile devices for offline use and native app-like experience.

## 🚀 How to Run Locally

You can run this project using any local web server. For example, using Python:

```bash
# Python 3
python -m http.server 8000

# or using Node.js / npx
npx serve .
```

Then open `http://localhost:8000` in your web browser.

## 🛠️ Technologies

- HTML5
- CSS3 (Custom Variables, Flexbox, Grid, Animations)
- Vanilla JavaScript
- Progressive Web App (PWA)