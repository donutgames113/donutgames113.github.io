(function () {
  const library = window.__DONUT_MUSIC_LIBRARY__;
  const albumsContainer = document.getElementById('music-albums');
  const feedback = document.getElementById('music-feedback');
  const summary = document.getElementById('music-summary');
  const searchInput = document.getElementById('music-search');
  const audio = document.getElementById('music-audio');
  const player = document.getElementById('music-player');
  const playerCover = document.getElementById('music-player-cover');
  const playerStatus = document.getElementById('music-player-status');
  const playerTitle = document.getElementById('music-player-title');
  const playerMeta = document.getElementById('music-player-meta');
  const playerSource = document.getElementById('music-player-source');

  if (!albumsContainer || !feedback || !summary || !searchInput || !audio || !player || !playerCover) {
    return;
  }

  let activeTrackId = null;

  const createMonogram = (value) => {
    const parts = String(value || 'Donut')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '');

    return (parts.join('') || 'DN').slice(0, 2);
  };

  const encodeRelativePath = (relativePath) =>
    String(relativePath || '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

  const formatShortDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '--:--';
    }

    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const formatLibraryDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '0 min';
    }

    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
  };

  const formatGeneratedAt = (value) => {
    if (!value) {
      return 'Not built yet';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  };

  const setFeedback = (message, state) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.dataset.state = state || 'info';
  };

  const clearFeedback = () => {
    feedback.hidden = true;
    delete feedback.dataset.state;
  };

  const renderCover = (coverPath, label, className) => {
    const cover = document.createElement('div');
    cover.className = className;

    if (coverPath) {
      const image = document.createElement('img');
      image.src = encodeRelativePath(coverPath);
      image.alt = `${label} cover art`;
      cover.appendChild(image);
      return cover;
    }

    cover.classList.add('is-placeholder');
    const initials = document.createElement('span');
    initials.textContent = createMonogram(label);
    cover.appendChild(initials);
    return cover;
  };

  const updateSummary = () => {
    const totals = library?.totals || { albums: 0, tracks: 0, durationSeconds: 0 };
    const pills = [
      `${totals.albums} album${totals.albums === 1 ? '' : 's'}`,
      `${totals.tracks} track${totals.tracks === 1 ? '' : 's'}`,
      formatLibraryDuration(totals.durationSeconds),
      `Updated ${formatGeneratedAt(library?.generatedAt)}`,
    ];

    summary.replaceChildren(
      ...pills.map((label) => {
        const item = document.createElement('span');
        item.className = 'media-chip';
        item.textContent = label;
        return item;
      })
    );
  };

  const updateActiveTrackStyles = () => {
    const buttons = albumsContainer.querySelectorAll('.track-button');
    buttons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.trackId === activeTrackId);
    });
  };

  const setPlayer = (track, album) => {
    activeTrackId = track.id;
    player.classList.remove('is-idle');
    playerStatus.textContent = 'Now playing';
    playerTitle.textContent = track.title;

    const metadata = [track.artistLine, album.title, track.year].filter(Boolean).join(' - ');
    playerMeta.textContent = metadata || album.artistLine;
    playerSource.textContent =
      [
        track.trackNumber ? `Track ${String(track.trackNumber).padStart(2, '0')}` : null,
        formatShortDuration(track.durationSeconds),
        track.genreLine || null,
      ]
        .filter(Boolean)
        .join(' - ') || 'Playing from the library';

    playerCover.replaceChildren(renderCover(track.cover || album.cover, album.title, 'player-art'));
    audio.src = encodeRelativePath(track.path);
    audio.load();
    audio.play().catch(function () {
      /* Browsers may require another click before playback starts. */
    });

    updateActiveTrackStyles();
    clearFeedback();
  };

  const matchesQuery = (album, track, tokens) => {
    const haystack = [
      album.title,
      album.artistLine,
      album.genreLine,
      album.year,
      track.title,
      track.artistLine,
      track.genreLine,
      track.fileName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  };

  const filterAlbums = (query) => {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (!tokens.length) {
      return library.albums;
    }

    return library.albums
      .map((album) => {
        const albumHaystack = [album.title, album.artistLine, album.genreLine, album.year]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (tokens.every((token) => albumHaystack.includes(token))) {
          return album;
        }

        const matchingTracks = album.tracks.filter((track) => matchesQuery(album, track, tokens));
        return matchingTracks.length ? { ...album, tracks: matchingTracks } : null;
      })
      .filter(Boolean);
  };

  const renderAlbums = (query) => {
    albumsContainer.replaceChildren();

    const filteredAlbums = filterAlbums(query);

    if (!filteredAlbums.length) {
      setFeedback('Nothing matched that search. Try another album, artist, track, or year.', 'empty');
      return;
    }

    clearFeedback();

    const fragment = document.createDocumentFragment();

    filteredAlbums.forEach((album) => {
      const albumCard = document.createElement('article');
      albumCard.className = 'album-card';

      const sidebar = document.createElement('div');
      sidebar.className = 'album-sidebar';
      sidebar.appendChild(renderCover(album.cover, album.title, 'album-cover'));

      const albumInfo = document.createElement('div');
      albumInfo.className = 'album-meta';

      const kicker = document.createElement('p');
      kicker.className = 'album-kicker';
      kicker.textContent = 'Album';

      const title = document.createElement('h2');
      title.textContent = album.title;

      const details = document.createElement('div');
      details.className = 'album-details';
      [album.artistLine, album.year, `${album.trackCount} tracks`, formatLibraryDuration(album.durationSeconds)]
        .filter(Boolean)
        .forEach((itemText) => {
          const item = document.createElement('span');
          item.textContent = itemText;
          details.appendChild(item);
        });

      albumInfo.appendChild(kicker);
      albumInfo.appendChild(title);
      albumInfo.appendChild(details);

      if (album.genreLine) {
        const tags = document.createElement('div');
        tags.className = 'album-tags';

        album.genreLine.split(',').forEach((genre) => {
          const trimmed = genre.trim();
          if (!trimmed) {
            return;
          }

          const tag = document.createElement('span');
          tag.className = 'album-tag';
          tag.textContent = trimmed;
          tags.appendChild(tag);
        });

        if (tags.childNodes.length) {
          albumInfo.appendChild(tags);
        }
      }

      const trackList = document.createElement('ol');
      trackList.className = 'track-list';

      album.tracks.forEach((track) => {
        const item = document.createElement('li');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'track-button';
        button.dataset.trackId = track.id;
        button.addEventListener('click', () => setPlayer(track, album));

        const number = document.createElement('span');
        number.className = 'track-number';
        number.textContent = track.trackNumber ? String(track.trackNumber).padStart(2, '0') : '->';

        const main = document.createElement('span');
        main.className = 'track-main';

        const trackTitle = document.createElement('span');
        trackTitle.className = 'track-title';
        trackTitle.textContent = track.title;

        const meta = document.createElement('span');
        meta.className = 'track-meta';
        meta.textContent = [track.artistLine, track.genreLine].filter(Boolean).join(' - ') || album.artistLine || 'Audio track';

        const duration = document.createElement('span');
        duration.className = 'track-duration';
        duration.textContent = formatShortDuration(track.durationSeconds);

        main.appendChild(trackTitle);
        main.appendChild(meta);
        button.appendChild(number);
        button.appendChild(main);
        button.appendChild(duration);
        item.appendChild(button);
        trackList.appendChild(item);
      });

      const content = document.createElement('div');
      content.className = 'album-content';
      content.appendChild(albumInfo);
      content.appendChild(trackList);

      albumCard.appendChild(sidebar);
      albumCard.appendChild(content);
      fragment.appendChild(albumCard);
    });

    albumsContainer.appendChild(fragment);
    updateActiveTrackStyles();
  };

  audio.addEventListener('error', () => {
    setFeedback('That track could not be played in this browser right now.', 'error');
  });

  searchInput.addEventListener('input', function (event) {
    renderAlbums(event.target.value || '');
  });

  if (!library || !Array.isArray(library.albums)) {
    setFeedback('The listening room is unavailable right now.', 'error');
    return;
  }

  updateSummary();

  if (!library.albums.length) {
    setFeedback('No releases are live in the listening room yet.', 'empty');
    return;
  }

  clearFeedback();
  renderAlbums('');
})();
