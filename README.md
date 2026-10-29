# TJ Viola website

Ready to upload to GitHub. This folder contains the complete static website, including the animated studio intro, original-music content, artist imagery, custom typography, and all local assets. No build step or installation is required.

## Upload and publish with GitHub Pages

1. Create or open your GitHub repository.
2. Choose **Add file → Upload files**. Upload the **contents** of this folder, including the entire `assets` folder. Keep `index.html` at the top level of the repository; do not upload the ZIP as the website.
3. Commit the uploaded files to `main` (or your chosen branch).
4. Open **Settings → Pages**.
5. Set **Source** to **Deploy from a branch**, select that branch and **/(root)**, then save.
6. Open the website URL shown by GitHub Pages when publication completes.

The included `.nojekyll` file tells GitHub Pages to serve static files directly. Keep it when uploading through Git. If hidden files are not shown in a browser upload, the visible website files are still sufficient for this site.

[GitHub’s publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Included design

The white TJ/VIOLA vector logo follows the supplied reference. TJ Forma is a custom renamed SIL OFL derivative of Gruppo, with reference-inspired capitals throughout the website. Font license and source notes are in `assets/TJ-Forma-OFL.txt` and `assets/TJ-Forma-SOURCE.txt`.

Visible electric neon light-blue contours with a bright tracing animation follow the logo’s letter shapes. Inline artist names receive a matching restrained neon treatment. The blue atmosphere, feathered image edges, level artwork, and fluid page sections remain in place. Reduced-motion preferences stop decorative travel.

## Loading station

- Left: Hammond B-3 with upper and lower manuals; Leslie cabinet at its left.
- MacBook Pro directly on top of the Leslie, facing the same direction, with an illustrative Logic session on its screen.
- Middle: Roland FANTOM 8 below Roland D-50.
- Right: Roland JUPITER-8 below Yamaha DX7.
- Black Roland AX-Synth upright at the carpet’s pictured upper-right corner, with its keys and panel facing the viewer.
- Traditional pale-blue and teal Persian-style rug under the complete setup.

The sweep maps **442 chromatic key positions**, including **181 black keys**, in this order: Hammond upper → Hammond lower → D-50 → FANTOM 8 → JUPITER-8 → DX7 → AX-Synth. The Hammond and middle keyboards move left to right. The lower-right JUPITER-8 moves from its pictured upper end downward toward the viewer. The upper-right DX7 then runs in the reverse direction, right to left. The final upright keytar runs top to bottom.

Only one key depresses and glows at a time. The blue light follows the actual key shape and changes size for smaller black keys. Unplayed keys are subtly gray; passed keys regain their natural finish. Replay resets the sequence. The percentage and horizontal bar follow rendered notes.

Desktop 3D rendering targets a 3840-pixel-wide drawing buffer; mobile uses a lighter setting. Artist image source sizes vary. The rug texture is native 1536 × 1024, with its generation prompt recorded in `image-generation.json`. Instrument references are recorded in `instrument-references.json`. The models and Logic display are custom visual interpretations.

## Files

- `index.html` — page structure and content.
- `style.css` — design, responsive layouts, typography, neon trails, and image masks.
- `app.js` — music previews, videos, navigation, and loading sequence.
- `keyboard.js` — animated 3D loading station.
- `atmosphere.js` — animated blue and teal background.
- `idle-scroll.js` — interruptible automatic scrolling after inactivity, without additional controls.
- `content.json` — music releases, videos, and artist links.
- `assets/` — photos, album artwork, fonts, textures, masks, and bundled Three.js.

Website assets use relative paths, so the site can run at the root of a domain or under a GitHub repository path.

## Preview on your computer

Open a terminal in this folder and run:

```sh
python3 -m http.server 5173
```

Then visit `http://localhost:5173`. Use a local server rather than double-clicking `index.html`, because the website loads JavaScript modules and JSON. If Node.js is installed, `npm run dev` starts the same server and `npm run check` checks the JavaScript syntax; `npm install` is not required.

## After your GitHub Pages URL is available

In `index.html`, update the `og:image` meta tag to the full public URL of `assets/artist-live.jpg` on your new website. This gives social-sharing services an absolute image URL. The exported copy currently uses the bundled image as a relative path and has no dependency on the original private host.

Music previews and Spotify/YouTube embeds need an internet connection and depend on those providers. Artist and media credits remain in the website’s **Credits & sources** dialog and `assets/image-sources.json`. Instagram links open the artist’s official profile; content is curated rather than automatically synchronized. This package does not change ownership or licensing of music, photos, artwork, fonts, or bundled libraries.

The percentage sits centered inside a slim rectangular horizontal loading bar. At 100%, after the final key has rendered, the instruments share one neon-blue completion pulse before the page opens. Reduced motion uses a static completion highlight. The MacBook screen remains luminous, with visible Logic-session detail.

Buttons and small playback/filter controls use translucent blue glass, crisp luminous rims, and sharp rectangular corners. The logos retain solid-white interiors, with the animated electric-blue outline outside the letters. The bright key face follows the exact physical key dimensions; surrounding light remains a soft falloff.

The ready intro lasts approximately five seconds, including a 750ms completion pulse and 350ms exit. It waits longer if assets are slow. The normal sweep follows available display frames; it does not guarantee a separate frame for all 442 notes in five seconds. A longer sequential mode remains available in the keyboard component. Time-paced progress is committed after the corresponding key renders.

Luminous blue/cyan ribbons, drifting light particles and slow layered waves animate both the page and loader, with gentle pointer/scroll response and a static reduced-motion setting.

The browser and sharing titles are uppercase. After ten seconds of inactivity on the ready page, automatic scrolling moves downward at 45% of the 100 px/s reference speed (45 px/s). Any interaction stops it and restarts the delay. It stops at the bottom without looping. Open dialogs, menus, Spotify embeds, editing/iframe focus, text selection, hidden or unfocused tabs, the intro, and reduced-motion preferences pause this behavior. No scroll controls are added.

Animated background gradients combine navy, royal blue, cobalt, azure and pale-ice highlights. Buttons retain angular shapes with translucent glass finishes and white labels.

The loading percentage is white on the empty track and changes to black exactly where the blue fill passes behind it. No text container or backing is added.

The page follows a continuous dark-to-light blue progression: midnight hero, deep royal music, cobalt video, azure artist story, ocean-blue interlude, cyan booking, and pale light-cyan After Hours. Adjacent section gradient endpoints match, while drifting color pools and a faint liquid-glass texture keep the boundaries fluid. The footer fades from the same pale cyan back into midnight. Dark navy text is used on the lighter sections; logos and glass-button labels retain their white bases.

The liquid-light background material was generated with the built-in image tool and saved at its native 1672 × 940, with a 1280 × 720 mobile derivative. It is composited at low opacity and gently drifts; no enlargement or native-4K claim is made for the source texture. The procedural canvas renders up to 3840 × 2160 on desktop when the display warrants it and uses a lighter mobile density. Prompt and provenance: background-image-generation.json.
