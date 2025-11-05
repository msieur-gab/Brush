# 🦷 Brush Battle

A gamified toothbrushing application that uses MediaPipe hand tracking to make brushing teeth fun for kids!

## 🎮 Overview

Brush Battle turns the daily chore of toothbrushing into an exciting game. Kids hold their toothbrush in front of the phone camera (mounted on the bathroom mirror), and creatures appear from different sides of the screen. By brushing in the correct direction towards the creatures, they destroy them and earn points!

## ✨ Features

- **🎯 Motion Detection**: Uses MediaPipe Hands to track toothbrush movements
- **👾 Direction-Based Gameplay**: Creatures must be destroyed by brushing in the correct direction
- **⏱️ Timed Sessions**: Ensures kids brush for the recommended duration (default: 2 minutes)
- **👤 Multi-Profile Support**: Create profiles for multiple kids with individual stats
- **📊 Progress Tracking**: Tracks scores, sessions, and brushing streaks
- **🏆 Achievements**: Earn badges for various accomplishments
- **💾 Local Storage**: All data stored locally using Dexie.js (IndexedDB)
- **📱 Mobile-First**: Optimized for phone browsers and can be used offline

## 🛠️ Technology Stack

- **MediaPipe Hands**: Hand tracking and motion detection
- **Dexie.js**: Local database for profiles and scoring
- **Vanilla JavaScript**: No frameworks, pure JS
- **Web Components**: Custom elements for modular architecture
- **Semantic HTML5**: Accessible markup
- **CSS3**: Modern styling with animations and gradients

## 🚀 Getting Started

### Option 1: GitHub Pages (Recommended)

1. Enable GitHub Pages for this repository
2. Set the source to the main/master branch
3. Access the app at: `https://[your-username].github.io/Brush/`

### Option 2: Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/[your-username]/Brush.git
   cd Brush
   ```

2. Start a local server:
   ```bash
   # Using Python 3
   python3 -m http.server 8000

   # Using Python 2
   python -m SimpleHTTPServer 8000

   # Using Node.js (if you have http-server installed)
   npx http-server -p 8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## 📱 Setup Instructions

### Mounting Your Phone

1. **Get a phone mount** or use a simple DIY solution:
   - Suction cup mount
   - Phone holder with adhesive
   - DIY: Use tape or a rubber band to secure phone to mirror

2. **Position the phone** so the front camera faces you at toothbrush level

3. **Ensure good lighting** - bathroom lights should be on for best tracking

### First Time Use

1. **Create a Profile**:
   - Tap "Add Profile"
   - Enter child's name
   - Choose an avatar
   - Tap "Create"

2. **Grant Camera Permission**:
   - Browser will request camera access
   - Allow camera access for the app to work

3. **Start Playing**:
   - Select a profile
   - Position yourself in front of camera
   - Hold toothbrush in hand
   - Wait for 3-2-1 countdown
   - Start brushing!

## 🎯 How to Play

1. **Creatures appear** from different edges of the screen (top, bottom, left, right)

2. **Check the arrow** above each creature showing the required brush direction:
   - ↑ Brush upward
   - ↓ Brush downward
   - ← Brush left
   - → Brush right

3. **Brush towards the creature** in the correct direction to destroy it

4. **Earn points** for each creature destroyed:
   - 🦠 Germs: 10 points
   - 🐛 Bugs: 15 points
   - 🕷️ Spiders: 20 points
   - 🐌 Snails: 12 points
   - 🦟 Mosquitos: 25 points

5. **Complete the timer** (default: 2 minutes) to finish the session

6. **View your results** and track your progress!

## ⚙️ Settings

Access settings by tapping the ⚙️ button on the profile screen:

- **Brushing Duration**: Adjust required brushing time (1-5 minutes)
- **Clear All Data**: Reset all profiles and history (use with caution!)

## 📊 Features Breakdown

### Profile Management
- Create unlimited profiles
- Each profile tracks individual stats
- Delete profiles with all associated data
- View recent sessions and overall statistics

### Game Mechanics
- Real-time hand tracking using MediaPipe
- Direction-based collision detection
- Particle effects for visual feedback
- Dynamic creature spawning
- Smooth animations and transitions

### Statistics Tracking
- Total score across all sessions
- Creatures destroyed count
- Brushing streaks (consecutive days)
- Session history
- Best scores

### Achievements
- 🎮 First Game
- ⭐ High Scorer (500+ points)
- 🌟 Score Master (1000+ points)
- 🎯 Sharp Shooter (25+ creatures)
- 👾 Creature Hunter (50+ creatures)
- 📅 3 Day Streak
- 🔥 Week Warrior (7 day streak)
- ⏱️ Time Master (completed full duration)
- 🏅 Regular (5+ sessions)
- 🎖️ Veteran (10+ sessions)

## 📱 Browser Compatibility

### Recommended Browsers
- **Chrome/Chromium** (Desktop & Mobile): ✅ Full support
- **Edge** (Desktop & Mobile): ✅ Full support
- **Safari** (iOS 14.5+): ✅ Full support
- **Firefox**: ⚠️ Limited MediaPipe support

### Requirements
- Modern browser with WebRTC support
- Camera access
- JavaScript enabled
- IndexedDB support

## 🔒 Privacy & Data

- **All data stored locally** on your device using IndexedDB
- **No server communication** - works completely offline after initial load
- **No tracking or analytics**
- **Camera feed is not recorded** - only used for real-time hand tracking
- **Data persists** between sessions until manually cleared

## 🎨 Customization

The app is built with customization in mind:

### Adding New Creatures
Edit `js/game-engine.js` and modify the `creatureTypes` array:

```javascript
this.creatureTypes = [
  { emoji: '🦠', points: 10, speed: 1.5, size: 40, color: '#FF6B6B' },
  // Add your own creatures here!
];
```

### Changing Colors
Edit CSS variables in `css/styles.css`:

```css
:root {
  --primary-color: #4A90E2;
  --secondary-color: #50E3C2;
  /* Modify colors here */
}
```

### Adjusting Game Difficulty
Edit `js/game-engine.js`:

```javascript
this.maxCreatures = 8;        // Max creatures on screen
this.spawnInterval = 2000;    // Spawn rate in milliseconds
```

## 🐛 Troubleshooting

### Camera Not Working
- Check browser permissions
- Ensure HTTPS connection (required for camera access)
- Try refreshing the page
- Check if another app is using the camera

### Hand Not Detected
- Improve lighting in the room
- Move closer to the camera
- Hold hand steadily in view
- Ensure toothbrush/hand is clearly visible

### Performance Issues
- Close other browser tabs
- Reduce screen brightness
- Lower required duration in settings
- Try Chrome/Edge for better performance

### Data Lost
- Data is stored in browser's IndexedDB
- Clearing browser data will delete profiles
- Use "Export" feature (future enhancement) to backup

## 🚧 Future Enhancements

Ideas for future development:
- [ ] Sound effects and music
- [ ] More creature types and boss battles
- [ ] Power-ups and special abilities
- [ ] Multiplayer/competitive mode
- [ ] Data export/import
- [ ] Custom themes and avatars
- [ ] Parent dashboard
- [ ] Reminder notifications
- [ ] Tutorial mode
- [ ] Accessibility improvements

## 📄 License

MIT License - Feel free to use and modify for your own purposes!

## 🙏 Acknowledgments

- **MediaPipe** by Google for amazing hand tracking
- **Dexie.js** for simple IndexedDB wrapper
- Parents everywhere trying to make brushing fun!

## 💡 Tips for Best Experience

1. **Mount phone securely** - shaky camera affects tracking
2. **Good lighting is crucial** - turn on all bathroom lights
3. **Start with shorter durations** for younger kids
4. **Celebrate achievements** - check stats together
5. **Make it routine** - same time every day
6. **Let kids customize** - they choose their profile avatar
7. **Track streaks** - encourage daily brushing

## 🤝 Contributing

Found a bug or have an idea? Feel free to:
- Open an issue
- Submit a pull request
- Share your feedback

---

Made with ❤️ for happy, healthy smiles! 🦷✨
