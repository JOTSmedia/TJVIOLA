# TJ Viola website

Ready to upload to GitHub. This folder contains the complete static website, including the latest top-to-bottom keytar loading sequence, Hammond organ, Roland keyboards, music content, imagery, fonts, and animations. No build step or installation is required.

## Upload and publish with GitHub Pages

1. Create or open your GitHub repository.
2. Choose **Add file → Upload files**. Upload the **contents** of this folder, including the entire `assets` folder. Keep `index.html` at the top level of the repository; do not upload the ZIP as the website.
3. Commit the uploaded files to `main` (or your chosen branch).
4. Open **Settings → Pages**.
5. Set **Source** to **Deploy from a branch**, select that branch and **/(root)**, then save.
6. Open the website URL shown by GitHub Pages when publication completes.

The included `.nojekyll` file tells GitHub Pages to serve the static files directly. Keep it when uploading through Git. If hidden files are not shown in a browser upload, the visible website files are still sufficient for this site.

[GitHub's publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Files

- `index.html` — page structure and content.
- `style.css` — design, responsive layouts, and image masks.
- `app.js` — music previews, videos, navigation, and loading sequence.
- `keyboard.js` — animated 3D loading station.
- `atmosphere.js` — animated blue background.
- `content.json` — music releases, videos, and artist links.
- `assets/` — photos, album artwork, fonts, textures, masks, and bundled Three.js.

All website assets use relative paths, so the site can run at the root of a domain or under a GitHub repository path.

## Preview on your computer

Open a terminal in this folder and run:

```sh
python3 -m http.server 5173
```

Then visit `http://localhost:5173`. Use a local server rather than double-clicking `index.html`, because the website loads JavaScript modules and JSON. If Node.js is installed, `npm run dev` starts the same server and `npm run check` checks the JavaScript syntax; `npm install` is not required.

## After your GitHub Pages URL is available

In `index.html`, update the `og:image` meta tag to the full public URL of `assets/artist-live.jpg` on your new website. This gives social sharing services an absolute image URL. The exported copy currently uses the bundled image as a relative path and has no dependency on the original private host.

Music previews and Spotify/YouTube embeds need an internet connection and depend on those providers. Artist and media credits remain in the website's **Credits & sources** dialog and `assets/image-sources.json`. Instagram links open the artist's official profile; content is curated rather than automatically synchronized. This package does not change ownership or licensing of music, photos, artwork, fonts, or bundled libraries.
