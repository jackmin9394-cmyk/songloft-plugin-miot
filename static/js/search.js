/**
 * 搜索模块
 * 提供歌单面板筛选和主页面本地统一搜索。
 */

const { apiGet } = SongloftPlugin;
const LOCAL_SEARCH_DEBOUNCE_MS = 300;

let localSearchTimer = null;
let localSearchRequestSequence = 0;
let localSearchActions = {};

/**
 * 初始化歌单搜索（在歌单列表渲染完成后调用）
 */
export function initPlaylistSearch() {
    const input = document.getElementById('playlistSearchInput');
    if (!input) return;

    input.value = '';

    input.removeEventListener('input', handlePlaylistSearch);
    input.addEventListener('input', handlePlaylistSearch);
}

function handlePlaylistSearch() {
    const input = document.getElementById('playlistSearchInput');
    const keyword = (input.value || '').trim().toLowerCase();
    const items = document.querySelectorAll('#playlistSelectList .playlist-select-item');

    items.forEach(item => {
        if (!keyword) {
            item.style.display = '';
            return;
        }
        const name = (item.querySelector('.playlist-select-item-name')?.textContent || '').toLowerCase();
        item.style.display = name.includes(keyword) ? '' : 'none';
    });
}

/**
 * 初始化歌曲搜索（在歌曲列表渲染完成后调用）
 */
export function initSongSearch(actions = {}) {
    const bar = document.getElementById('songSearchBar');
    const input = document.getElementById('songSearchInput');
    if (!bar || !input) return;

    localSearchActions = { ...localSearchActions, ...actions };
    bar.style.display = 'flex';

    input.removeEventListener('input', handleSongSearch);
    input.addEventListener('input', handleSongSearch);

    if (!(input.value || '').trim()) {
        leaveLocalSearchMode();
    }
}

function handleSongSearch() {
    const input = document.getElementById('songSearchInput');
    if (!input) return;

    const keyword = (input.value || '').trim();
    localSearchRequestSequence++;
    const requestSequence = localSearchRequestSequence;

    if (localSearchTimer) {
        clearTimeout(localSearchTimer);
        localSearchTimer = null;
    }

    if (!keyword) {
        leaveLocalSearchMode();
        return;
    }

    enterLocalSearchMode('正在搜索本地音乐…');
    localSearchTimer = setTimeout(() => {
        localSearchTimer = null;
        runLocalSearch(keyword, requestSequence);
    }, LOCAL_SEARCH_DEBOUNCE_MS);
}

function enterLocalSearchMode(message) {
    const songList = document.getElementById('songList');
    const results = document.getElementById('localSearchResults');
    if (songList) songList.style.display = 'none';
    if (!results) return;

    results.style.display = 'block';
    clearSearchResults(results);
    const state = document.createElement('div');
    state.className = 'local-search-state loading';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    const text = document.createElement('span');
    text.textContent = message;
    state.appendChild(spinner);
    state.appendChild(text);
    results.appendChild(state);
}

function leaveLocalSearchMode() {
    localSearchRequestSequence++;
    if (localSearchTimer) {
        clearTimeout(localSearchTimer);
        localSearchTimer = null;
    }

    const songList = document.getElementById('songList');
    const results = document.getElementById('localSearchResults');
    if (results) {
        clearSearchResults(results);
        results.style.display = 'none';
    }
    if (songList) songList.style.display = '';
}

function runLocalSearch(keyword, requestSequence) {
    const input = document.getElementById('songSearchInput');
    const playlistSelect = document.getElementById('playlistSelect');
    let path = '/indexing/search?query=' + encodeURIComponent(keyword);
    if (playlistSelect && playlistSelect.value) {
        path += '&playlist_id=' + encodeURIComponent(playlistSelect.value);
    }

    apiGet(path).then(response => {
        if (!isCurrentSearch(keyword, requestSequence, input)) return;
        if (!response || !response.success || !response.data) {
            renderLocalSearchError(response?.error || response?.message || '本地搜索失败');
            return;
        }
        renderLocalSearchResults(response.data);
    }).catch(error => {
        if (!isCurrentSearch(keyword, requestSequence, input)) return;
        renderLocalSearchError(error?.message || '本地搜索失败');
    });
}

function isCurrentSearch(keyword, requestSequence, input) {
    return requestSequence === localSearchRequestSequence
        && !!input
        && (input.value || '').trim() === keyword;
}

function renderLocalSearchError(message) {
    const results = document.getElementById('localSearchResults');
    if (!results) return;
    clearSearchResults(results);

    const state = document.createElement('div');
    state.className = 'local-search-state error';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'error';
    const text = document.createElement('span');
    text.textContent = '搜索失败：' + message;
    state.appendChild(icon);
    state.appendChild(text);
    results.appendChild(state);
}

function renderLocalSearchResults(data) {
    const results = document.getElementById('localSearchResults');
    if (!results) return;
    clearSearchResults(results);

    const songs = Array.isArray(data.songs) ? data.songs : [];
    const playlists = Array.isArray(data.playlists) ? data.playlists : [];
    const artists = Array.isArray(data.artists) ? data.artists : [];
    const albums = Array.isArray(data.albums) ? data.albums : [];

    if (songs.length + playlists.length + artists.length + albums.length === 0) {
        const state = document.createElement('div');
        state.className = 'local-search-state empty';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = 'search_off';
        const text = document.createElement('span');
        text.textContent = '没有找到相关本地内容';
        state.appendChild(icon);
        state.appendChild(text);
        results.appendChild(state);
        return;
    }

    if (songs.length) results.appendChild(renderSongGroup(songs));
    if (playlists.length) results.appendChild(renderPlaylistGroup(playlists));
    if (artists.length) results.appendChild(renderArtistGroup(artists));
    if (albums.length) results.appendChild(renderAlbumGroup(albums));
}

function createGroup(title) {
    const section = document.createElement('section');
    section.className = 'local-search-group';
    const heading = document.createElement('h2');
    heading.className = 'local-search-group-title';
    heading.textContent = title;
    const list = document.createElement('div');
    list.className = 'local-search-group-list';
    section.appendChild(heading);
    section.appendChild(list);
    return { section, list };
}

function createResultCover(url, alt, fallbackIcon = 'music_note') {
    const wrap = document.createElement('span');
    wrap.className = 'local-search-cover';
    const image = document.createElement('img');
    image.alt = alt || '';
    const placeholder = document.createElement('span');
    placeholder.className = 'material-symbols-outlined local-search-cover-placeholder';
    placeholder.textContent = fallbackIcon;
    wrap.appendChild(image);
    wrap.appendChild(placeholder);

    if (url && typeof localSearchActions.loadCover === 'function') {
        requestAnimationFrame(() => {
            if (image.isConnected) localSearchActions.loadCover(image, url);
        });
    }
    return wrap;
}

function createResultText(title, subtitle) {
    const content = document.createElement('span');
    content.className = 'local-search-row-content';
    const titleEl = document.createElement('span');
    titleEl.className = 'local-search-row-title';
    titleEl.textContent = title || '';
    const subtitleEl = document.createElement('span');
    subtitleEl.className = 'local-search-row-subtitle';
    subtitleEl.textContent = subtitle || '';
    content.appendChild(titleEl);
    if (subtitle) content.appendChild(subtitleEl);
    return content;
}

function renderSongGroup(songs) {
    const group = createGroup('歌曲');
    songs.forEach(song => {
        const playable = song.playlist_id !== null
            && song.song_index !== null
            && Number(song.playlist_id) > 0
            && Number(song.song_index) >= 0
            && Number.isFinite(Number(song.playlist_id))
            && Number.isFinite(Number(song.song_index));
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'local-search-row local-search-song-row';
        row.disabled = !playable;
        row.dataset.songId = String(song.id || '');
        row.appendChild(createResultCover(song.cover_url, song.title));

        const subtitle = [song.artist, song.album].filter(Boolean).join(' · ')
            || '未知艺术家';
        row.appendChild(createResultText(song.title || '未知歌曲', subtitle));

        const trailing = document.createElement('span');
        trailing.className = 'local-search-row-trailing';
        if (song.duration > 0) {
            const duration = document.createElement('span');
            duration.className = 'local-search-duration';
            duration.textContent = formatSearchDuration(song.duration);
            trailing.appendChild(duration);
        }
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = playable ? 'play_arrow' : 'info';
        trailing.appendChild(icon);
        row.appendChild(trailing);

        if (playable && typeof localSearchActions.playSong === 'function') {
            row.addEventListener('click', () => {
                Promise.resolve(localSearchActions.playSong(song)).then(success => {
                    if (!success) return;
                    document.querySelectorAll('.local-search-song-row.active').forEach(item => item.classList.remove('active'));
                    row.classList.add('active');
                });
            });
        } else {
            row.title = '该歌曲当前没有可复用的歌单播放位置';
        }
        group.list.appendChild(row);
    });
    return group.section;
}

function renderPlaylistGroup(playlists) {
    const group = createGroup('歌单');
    playlists.forEach(playlist => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'local-search-row';
        row.appendChild(createResultCover(playlist.cover_url, playlist.name, 'queue_music'));
        row.appendChild(createResultText(playlist.name || '未命名歌单', `${Number(playlist.song_count) || 0} 首歌曲`));
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined local-search-row-arrow';
        icon.textContent = 'chevron_right';
        row.appendChild(icon);
        row.addEventListener('click', () => {
            if (typeof localSearchActions.selectPlaylist !== 'function') return;
            const input = document.getElementById('songSearchInput');
            if (input) input.value = '';
            leaveLocalSearchMode();
            localSearchActions.selectPlaylist(playlist.id, playlist.name, playlist.song_count);
        });
        group.list.appendChild(row);
    });
    return group.section;
}

function renderArtistGroup(artists) {
    const group = createGroup('歌手');
    artists.forEach(artist => {
        const row = document.createElement('div');
        row.className = 'local-search-row local-search-info-row';
        row.appendChild(createResultCover('', artist.name, 'person'));
        const details = `${Number(artist.song_count) || 0} 首歌曲 · ${Number(artist.album_count) || 0} 张专辑`;
        row.appendChild(createResultText(artist.name || '未知歌手', details));
        group.list.appendChild(row);
    });
    return group.section;
}

function renderAlbumGroup(albums) {
    const group = createGroup('专辑');
    albums.forEach(album => {
        const row = document.createElement('div');
        row.className = 'local-search-row local-search-info-row';
        row.appendChild(createResultCover(album.cover_url, album.name, 'album'));
        const details = [album.artist, `${Number(album.song_count) || 0} 首歌曲`].filter(Boolean).join(' · ');
        row.appendChild(createResultText(album.name || '未知专辑', details));
        group.list.appendChild(row);
    });
    return group.section;
}

function formatSearchDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;
    return minutes + ':' + (remaining < 10 ? '0' : '') + remaining;
}

function clearSearchResults(results) {
    if (typeof localSearchActions.cancelCovers === 'function') {
        localSearchActions.cancelCovers(results);
    }
    results.innerHTML = '';
}
