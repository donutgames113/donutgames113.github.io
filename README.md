did somebody say great website design?

## Music shelf

Everything for the song browser now lives under `media/` so it stays out of the way of the main site pages.

- `media/index.html` is the hidden music page.
- `media/music/` is where you drop your songs.
- `media/library/` is the generated library data and extracted cover art.

After adding or changing songs, run:

`npm run build:music`

If you want the library to rebuild itself while you edit the folder, run:

`npm run watch:music`
