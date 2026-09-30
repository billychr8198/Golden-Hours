# Golden Hours ✈ Golden State Airlines Flight 14-CA

A 3D focus timer that flies you across California. Every **60 minutes of focus** lands Flight 14-CA at the next of **30 Golden State destinations**, and your flight attendant hands you its postcard. After 30 hours you've seen them all.

Built with plain HTML, CSS and JavaScript plus [three.js](https://threejs.org) (r149, included). There is no build step, and every image and sound is in this folder.

## Features
- Pomodoro timer with **Focus / Short break / Long break** tabs. The default is **60 / 10 / 40**, with a long break every 4 sessions, and you can edit all of it in Settings.
- **Stays accurate when the tab is minimized.** The timer runs from the real clock (the end time), ticks from a Web Worker, and queues the alarm on the Web Audio clock the moment you press Start.
- Alarm sounds you can choose and repeat, a volume slider, an optional cabin-hum background sound, and desktop notifications.
- A task list with estimated and completed pomodoros, plus a projected finish time.
- A 3D map of California with a plane that flies to each new destination and 30 vintage-poster postcards.
- An optional read-aloud flight attendant, using your browser's built-in voice.
- A logbook with hours, streak, a 7-day chart and arrivals.
- A finale with a reflection and a downloadable certificate.
- Progress is saved in your browser. Settings → Export/Import lets you back it up or move it to another device.
- Keyboard: **Space** starts or pauses the timer.

## Publish on GitHub Pages
1. Create a new repository on GitHub, for example `golden-hours`.
2. Upload **the contents of this folder** (`index.html`, `css/`, `js/`, `assets/`, `.nojekyll`, `README.md`) to the root of the repository:
   - Click **Add file → Upload files**.
   - Drag everything in, including the folders.
   - Commit.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/golden-hours/`.

> Tip: `.nojekyll` is a hidden file. If your file picker hides it, it's optional; the site works without it.

## Run it locally
Double-clicking `index.html` works. For full audio and certificate downloads, serve the folder instead:

```bash
cd golden-hours
python -m http.server 8000
# open http://localhost:8000
```

## Files
```
index.html            page markup
css/style.css         all styling
js/app.js             timer, tasks, progress, dialogs, narration, finale
js/world.js           three.js 3D California, plane, pins and camera
js/posters.js         30 hand-built SVG travel posters
js/audio.js           Web Audio engine (scheduled alarm, cabin hum)
js/sound-synth.js     sound recipes (fallback if WAV files can't load)
js/data.js            the flight attendant's narration for all 30 stops
js/vendor/three.min.js  three.js r149 (MIT licence included)
assets/img/           logo, emblem, favicon, app icon
assets/audio/         cabin-chime, arrival-chime, boarding-bell, jet-flyby, fanfare (WAV)
```

All sounds were synthesized for this project, and the posters are original SVG artwork.
