import { createHash } from 'node:crypto';
import { promises as fs, watch as watchFs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const mediaDir = path.join(rootDir, 'media');
const musicDir = path.join(mediaDir, 'music');
const libraryDir = path.join(mediaDir, 'library');
const coverDir = path.join(libraryDir, 'covers');
const dataJsonPath = path.join(libraryDir, 'music-library.json');
const dataScriptPath = path.join(libraryDir, 'music-library.js');

const supportedExtensions = new Set([
  '.aac',
  '.flac',
  '.m4a',
  '.mp3',
  '.ogg',
  '.opus',
  '.wav',
  '.webm',
]);

const compareText = (left, right) =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });

const uniqueValues = (values) => {
  const flattened = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
  return [...new Set(flattened.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];
};

const toMediaRelativePath = (absolutePath) => path.relative(mediaDir, absolutePath).split(path.sep).join('/');

const fallbackTitleFromPath = (filePath) =>
  path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (value) => {
  const normalized = (value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || 'release';
};

const resolveYear = (common) => {
  if (Number.isInteger(common.year) && common.year > 0) {
    return common.year;
  }

  const dateCandidate = `${common.originaldate || ''} ${common.date || ''}`;
  const match = dateCandidate.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

const normaliseTrackNumber = (value) => {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Number(value);
};

const extensionFromMime = (mimeType) => {
  const normalized = (mimeType || '').toLowerCase();

  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  return null;
};

async function ensureStructure() {
  await fs.mkdir(musicDir, { recursive: true });
  await fs.mkdir(libraryDir, { recursive: true });
  await fs.mkdir(coverDir, { recursive: true });
}

async function collectAudioFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectAudioFiles(absolutePath)));
      continue;
    }

    if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function persistCover(picture, usedCoverFiles) {
  if (!picture?.data?.length) {
    return null;
  }

  const extension = extensionFromMime(picture.format);
  if (!extension) {
    return null;
  }

  const fileHash = createHash('sha1').update(picture.data).digest('hex');
  const fileName = `${fileHash}.${extension}`;
  const destination = path.join(coverDir, fileName);

  usedCoverFiles.add(fileName);

  try {
    await fs.access(destination);
  } catch {
    await fs.writeFile(destination, picture.data);
  }

  return `library/covers/${fileName}`;
}

async function cleanupUnusedCovers(usedCoverFiles) {
  const entries = await fs.readdir(coverDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && !usedCoverFiles.has(entry.name))
      .map((entry) => fs.unlink(path.join(coverDir, entry.name)))
  );
}

async function readTrack(filePath, usedCoverFiles) {
  const metadata = await parseFile(filePath, { duration: true, skipCovers: false });
  const stats = await fs.stat(filePath);
  const common = metadata.common || {};
  const format = metadata.format || {};

  const trackArtists = uniqueValues([common.artists || [], common.artist]);
  const albumArtists = uniqueValues([common.albumartists || [], common.albumartist, common.artist]);
  const genres = uniqueValues(common.genre || []);
  const year = resolveYear(common);
  const cover = await persistCover(Array.isArray(common.picture) ? common.picture[0] : null, usedCoverFiles);

  const relativePath = toMediaRelativePath(filePath);
  const title = common.title?.trim() || fallbackTitleFromPath(filePath);
  const album = common.album?.trim() || 'Singles & Unsorted';
  const albumArtist = albumArtists[0] || trackArtists[0] || 'Unknown artist';
  const artistLine = trackArtists.length ? trackArtists.join(', ') : albumArtist;
  const trackNumber = normaliseTrackNumber(common.track?.no);
  const diskNumber = normaliseTrackNumber(common.disk?.no);
  const durationSeconds = Number.isFinite(format.duration) ? Math.round(format.duration) : null;
  const id = createHash('sha1').update(relativePath).digest('hex').slice(0, 14);

  return {
    id,
    title,
    artists: trackArtists.length ? trackArtists : [albumArtist],
    artistLine,
    album,
    albumArtist,
    trackNumber,
    diskNumber,
    year,
    genres,
    genreLine: genres.join(', '),
    durationSeconds,
    path: relativePath,
    cover,
    fileName: path.basename(filePath),
    modifiedAt: stats.mtime.toISOString(),
  };
}

function sortTracks(left, right) {
  const diskA = left.diskNumber ?? Number.MAX_SAFE_INTEGER;
  const diskB = right.diskNumber ?? Number.MAX_SAFE_INTEGER;
  if (diskA !== diskB) return diskA - diskB;

  const trackA = left.trackNumber ?? Number.MAX_SAFE_INTEGER;
  const trackB = right.trackNumber ?? Number.MAX_SAFE_INTEGER;
  if (trackA !== trackB) return trackA - trackB;

  return compareText(left.title, right.title);
}

function sortAlbums(left, right) {
  const artistComparison = compareText(left.artistLine, right.artistLine);
  if (artistComparison !== 0) return artistComparison;

  const yearA = left.year ?? Number.MAX_SAFE_INTEGER;
  const yearB = right.year ?? Number.MAX_SAFE_INTEGER;
  if (yearA !== yearB) return yearA - yearB;

  return compareText(left.title, right.title);
}

async function buildLibrary() {
  await ensureStructure();

  const audioFiles = await collectAudioFiles(musicDir);
  const albums = new Map();
  const usedCoverFiles = new Set();
  const warnings = [];

  for (const filePath of audioFiles) {
    try {
      const track = await readTrack(filePath, usedCoverFiles);
      const albumKey = `${slugify(track.album)}::${slugify(track.albumArtist)}::${track.year || 'unknown'}`;

      if (!albums.has(albumKey)) {
        albums.set(albumKey, {
          id: `${slugify(track.albumArtist)}-${slugify(track.album)}-${track.year || 'release'}`,
          title: track.album,
          artistLine: track.albumArtist,
          year: track.year,
          cover: track.cover,
          genres: [...track.genres],
          genreLine: track.genreLine,
          durationSeconds: 0,
          trackCount: 0,
          latestModifiedAt: track.modifiedAt,
          tracks: [],
        });
      }

      const album = albums.get(albumKey);
      album.trackCount += 1;
      album.durationSeconds += track.durationSeconds || 0;
      album.tracks.push(track);
      album.genres = uniqueValues([...album.genres, ...track.genres]);
      album.genreLine = album.genres.join(', ');

      if (!album.cover && track.cover) {
        album.cover = track.cover;
      }

      if (!album.year && track.year) {
        album.year = track.year;
      }

      if (track.modifiedAt > album.latestModifiedAt) {
        album.latestModifiedAt = track.modifiedAt;
      }
    } catch (error) {
      warnings.push(`${toMediaRelativePath(filePath)}: ${error.message}`);
    }
  }

  const sortedAlbums = [...albums.values()]
    .map((album) => ({
      ...album,
      tracks: album.tracks.sort(sortTracks),
    }))
    .sort(sortAlbums);

  const totalTracks = sortedAlbums.reduce((count, album) => count + album.trackCount, 0);
  const totalDurationSeconds = sortedAlbums.reduce((count, album) => count + album.durationSeconds, 0);

  await cleanupUnusedCovers(usedCoverFiles);

  return {
    generatedAt: new Date().toISOString(),
    sourceFolder: 'media/music',
    totals: {
      albums: sortedAlbums.length,
      tracks: totalTracks,
      durationSeconds: totalDurationSeconds,
    },
    warnings,
    albums: sortedAlbums,
  };
}

async function writeLibraryFiles(library) {
  const json = `${JSON.stringify(library, null, 2)}\n`;
  await fs.writeFile(dataJsonPath, json);
  await fs.writeFile(dataScriptPath, `window.__DONUT_MUSIC_LIBRARY__ = ${json};`);
}

async function buildOnce(reason) {
  console.log(`[music] Building library (${reason})...`);
  const library = await buildLibrary();
  await writeLibraryFiles(library);
  console.log(
    `[music] Synced ${library.totals.tracks} track${library.totals.tracks === 1 ? '' : 's'} across ${library.totals.albums} album${library.totals.albums === 1 ? '' : 's'}.`
  );

  if (library.warnings.length) {
    console.log('[music] Some files were skipped:');
    library.warnings.forEach((warning) => console.log(`  - ${warning}`));
  }
}

async function watchLibrary() {
  await buildOnce('initial sync');
  console.log('[music] Watching media/music for changes...');

  let debounceTimer = null;

  const watcher = watchFs(musicDir, { recursive: true }, (eventType, fileName) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      buildOnce(`${eventType}${fileName ? ` ${fileName}` : ''}`).catch((error) => {
        console.error(`[music] ${error.message}`);
      });
    }, 250);
  });

  process.on('SIGINT', () => {
    watcher.close();
    console.log('\n[music] Watch stopped.');
    process.exit(0);
  });
}

try {
  if (process.argv.includes('--watch')) {
    await watchLibrary();
  } else {
    await buildOnce('manual sync');
  }
} catch (error) {
  console.error(`[music] ${error.message}`);
  process.exit(1);
}
