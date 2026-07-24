/**
 * 搜索模块
 * 提供歌单筛选，以及仅负责展示和选择的统一搜索 UI。
 * 搜索、排序、去重和 Provider 调度均由后端 SearchService 完成。
 */

const apiGet = (...args) => globalThis.SongloftPlugin.apiGet(...args);
const SEARCH_DEBOUNCE_MS = 300;

let searchTimer = null;
let searchRequestSequence = 0;
let searchActions = {};
let searchControlsInitialized = false;
let downloaderAvailable = false;
const onlineSearchAvailable = true;
let currentResults = null;
let currentKeyword = '';
const currentFilters = {
    scope: 'all',
    type: 'all',
    source: 'all',
};

export function initPlaylistSearch() {
    const input = document.getElementById('playlistSearchInput');
    if (!input) return;

    input.value = '';
    input.removeEventListener('input', handlePlaylistSearch);
    input.addEventListener('input', handlePlaylistSearch);
}

function handlePlaylistSearch() {
    const input = document.getElementById('playlistSearchInput');
    const keyword = (input?.value || '').trim().toLowerCase();
    document.querySelectorAll('#playlistSelectList .playlist-select-item').forEach(item => {
        if (!keyword) {
            item.style.display = '';
            return;
        }
        const name = (item.querySelector('.playlist-select-item-name')?.textContent || '').toLowerCase();
        item.style.display = name.includes(keyword) ? '' : 'none';
    });
}

export function initSongSearch(actions = {}) {
    const shell = document.getElementById('unifiedSearchShell');
    const input = document.getElementById('songSearchInput');
    if (!shell || !input) return;

    searchActions = { ...searchActions, ...actions };
    shell.style.display = '';

    input.removeEventListener('input', handleSongSearch);
    input.addEventListener('input', handleSongSearch);
    input.removeEventListener('keydown', handleSearchKeydown);
    input.addEventListener('keydown', handleSearchKeydown);

    if (!searchControlsInitialized) {
        searchControlsInitialized = true;
        initUnifiedSearchControls();
        const onlineScope = document.getElementById('onlineSearchScope');
        const onlineType = document.getElementById('searchTypeOnlineOption');
        if (onlineScope) onlineScope.hidden = false;
        if (onlineType) onlineType.hidden = false;
        void refreshDownloaderCapability();
    }

    if (!(input.value || '').trim()) leaveSearchMode();
}

async function refreshDownloaderCapability() {
    try {
        const response = await apiGet('/search/capabilities');
        downloaderAvailable = response?.data?.downloader_available === true;
    } catch {
        downloaderAvailable = false;
    }
}

function handleSearchKeydown(event) {
    if (event.key !== 'Escape') return;
    const input = document.getElementById('songSearchInput');
    if (input) {
        input.value = '';
        input.blur();
    }
    currentResults = null;
    currentKeyword = '';
    leaveSearchMode();
}

function initUnifiedSearchControls() {
    const typeFilter = document.getElementById('searchTypeFilter');
    const sourceFilter = document.getElementById('searchSourceFilter');

    typeFilter?.addEventListener('change', () => {
        currentFilters.type = typeFilter.value || 'all';
        renderCurrentResults();
    });
    sourceFilter?.addEventListener('change', () => {
        currentFilters.source = sourceFilter.value || 'all';
        renderCurrentResults();
    });

    document.querySelectorAll('[data-search-scope]').forEach(chip => {
        chip.addEventListener('click', () => {
            currentFilters.scope = chip.dataset.searchScope || 'all';
            document.querySelectorAll('[data-search-scope]').forEach(item => {
                const active = item === chip;
                item.classList.toggle('active', active);
                item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            if (
                currentFilters.scope !== 'local'
                && onlineSearchAvailable
                && currentKeyword
                && currentResults?.online_status === 'not_requested'
            ) {
                scheduleSearch(currentKeyword);
                return;
            }
            renderCurrentResults();
        });
    });
}

function handleSongSearch() {
    const keyword = (document.getElementById('songSearchInput')?.value || '').trim();
    if (!keyword) {
        currentResults = null;
        currentKeyword = '';
        leaveSearchMode();
        return;
    }
    scheduleSearch(keyword);
}

function scheduleSearch(keyword) {
    searchRequestSequence++;
    const requestSequence = searchRequestSequence;
    if (searchTimer) clearTimeout(searchTimer);
    enterSearchMode('正在搜索…');
    searchTimer = setTimeout(() => {
        searchTimer = null;
        void runSearch(keyword, requestSequence);
    }, SEARCH_DEBOUNCE_MS);
}

function enterSearchMode(message) {
    const songList = document.getElementById('songList');
    const results = document.getElementById('localSearchResults');
    if (songList) songList.style.display = 'none';
    if (!results) return;

    results.style.display = 'block';
    clearSearchResults(results);
    const state = document.createElement('div');
    state.className = 'local-search-state loading';
    state.appendChild(createIcon('progress_activity', 'spinner'));
    const text = document.createElement('span');
    text.textContent = message;
    state.appendChild(text);
    results.appendChild(state);
}

function leaveSearchMode() {
    searchRequestSequence++;
    if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
    }
    const songList = document.getElementById('songList');
    const results = document.getElementById('localSearchResults');
    if (results) {
        clearSearchResults(results);
        results.style.display = 'none';
    }
    if (songList) songList.style.display = '';
}

export function buildUnifiedSearchPath(keyword, playlistId, includeOnline) {
    const params = new URLSearchParams({
        query: keyword,
        limit: '50',
        offset: '0',
        include_online: includeOnline ? '1' : '0',
    });
    if (playlistId) params.set('playlist_id', playlistId);
    return '/search?' + params.toString();
}

async function runSearch(keyword, requestSequence) {
    const input = document.getElementById('songSearchInput');
    const playlistId = String(
        searchActions.getCurrentPlaylistId?.()
        || document.getElementById('playlistSelect')?.value
        || ''
    ).trim();
    const includeOnline = onlineSearchAvailable && currentFilters.scope !== 'local';

    try {
        const response = await apiGet(buildUnifiedSearchPath(keyword, playlistId, includeOnline));
        if (!isCurrentSearch(keyword, requestSequence, input)) return;
        if (!response?.success || !response?.data) {
            renderSearchError(response?.error || response?.message || '搜索失败');
            return;
        }
        currentKeyword = keyword;
        currentResults = response.data;
        updateSourceOptions(currentResults);
        renderCurrentResults();
    } catch (error) {
        if (!isCurrentSearch(keyword, requestSequence, input)) return;
        renderSearchError(error?.message || '搜索失败');
    }
}

function isCurrentSearch(keyword, requestSequence, input) {
    return requestSequence === searchRequestSequence
        && !!input
        && (input.value || '').trim() === keyword;
}

function renderSearchError(message) {
    const results = document.getElementById('localSearchResults');
    if (!results) return;
    clearSearchResults(results);
    const state = document.createElement('div');
    state.className = 'local-search-state error';
    state.appendChild(createIcon('error'));
    const text = document.createElement('span');
    text.textContent = '搜索失败：' + message;
    state.appendChild(text);
    results.appendChild(state);
}

export function filterUnifiedSearchData(data, filters) {
    const scope = filters?.scope || 'all';
    const type = filters?.type || 'all';
    const source = filters?.source || 'all';
    const showLocal = scope !== 'online' && type !== 'online';
    const showOnline = scope !== 'local' && (type === 'all' || type === 'online');
    const localItems = key => (
        showLocal
        && (type === 'all' || type === key)
        && Array.isArray(data?.[key])
    ) ? data[key] : [];

    const online = showOnline && Array.isArray(data?.online)
        ? data.online.map(group => ({
            ...group,
            versions: Array.isArray(group?.versions)
                ? group.versions.filter(version => (
                    source === 'all' || version?.source_id === source
                ))
                : [],
        })).filter(group => group.versions.length > 0)
        : [];

    return {
        songs: localItems('songs'),
        playlists: localItems('playlists'),
        artists: localItems('artists'),
        albums: localItems('albums'),
        online,
    };
}

function updateSourceOptions(data) {
    const select = document.getElementById('searchSourceFilter');
    if (!select) return;

    const sources = new Map();
    (Array.isArray(data?.online) ? data.online : []).forEach(group => {
        (Array.isArray(group?.versions) ? group.versions : []).forEach(version => {
            const id = String(version?.source_id || '').trim();
            if (id && !sources.has(id)) {
                sources.set(id, String(version?.source_name || id));
            }
        });
    });

    const previous = currentFilters.source;
    select.innerHTML = '<option value="all">全部来源</option>';
    sources.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        select.appendChild(option);
    });
    currentFilters.source = previous !== 'all' && sources.has(previous) ? previous : 'all';
    select.value = currentFilters.source;
    select.hidden = !onlineSearchAvailable || sources.size < 2;
}

function renderCurrentResults() {
    if (!currentResults) return;
    renderSearchResults(currentResults, filterUnifiedSearchData(currentResults, currentFilters));
}

function renderSearchResults(data, filtered) {
    const results = document.getElementById('localSearchResults');
    if (!results) return;
    clearSearchResults(results);

    const total = filtered.songs.length
        + filtered.playlists.length
        + filtered.artists.length
        + filtered.albums.length
        + filtered.online.length;
    if (!total) {
        const state = document.createElement('div');
        state.className = 'local-search-state empty';
        state.appendChild(createIcon('search_off'));
        const text = document.createElement('span');
        text.textContent = getEmptyMessage(data);
        state.appendChild(text);
        results.appendChild(state);
        return;
    }

    if (filtered.songs.length) results.appendChild(renderSongGroup(filtered.songs));
    if (filtered.playlists.length) results.appendChild(renderPlaylistGroup(filtered.playlists));
    if (filtered.artists.length) results.appendChild(renderArtistGroup(filtered.artists));
    if (filtered.albums.length) results.appendChild(renderAlbumGroup(filtered.albums));
    if (filtered.online.length) results.appendChild(renderOnlineGroup(filtered.online));
    if (currentFilters.scope !== 'local' && data.online_status === 'partial') {
        results.appendChild(createOnlineStatus('部分在线来源暂时不可用，已显示可用结果'));
    } else if (currentFilters.scope !== 'local' && data.online_status === 'failed') {
        results.appendChild(createOnlineStatus('在线来源暂时不可用，本地搜索仍可正常使用'));
    }
}

function getEmptyMessage(data) {
    if (currentFilters.scope === 'online') return '未找到在线结果，来源可能暂时不可用';
    if (
        currentFilters.scope !== 'local'
        && ['no_result', 'partial', 'failed'].includes(data?.online_status)
    ) {
        return '未找到匹配内容，部分在线来源也可能暂时不可用';
    }
    return '没有找到相关本地内容';
}

function createOnlineStatus(message) {
    const status = document.createElement('div');
    status.className = 'online-search-status';
    status.textContent = message;
    return status;
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

function createIcon(name, className = '') {
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined' + (className ? ' ' + className : '');
    icon.textContent = name;
    return icon;
}

function createResultCover(url, alt, fallbackIcon = 'music_note') {
    const wrap = document.createElement('span');
    wrap.className = 'local-search-cover';
    const image = document.createElement('img');
    image.alt = alt || '';
    const placeholder = createIcon(fallbackIcon, 'local-search-cover-placeholder');
    wrap.appendChild(image);
    wrap.appendChild(placeholder);

    if (url && typeof searchActions.loadCover === 'function') {
        requestAnimationFrame(() => {
            if (image.isConnected) searchActions.loadCover(image, url);
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
        const playlistId = Number(song.playlist_id);
        const songIndex = Number(song.song_index);
        const playable = Number.isFinite(playlistId) && playlistId > 0
            && Number.isFinite(songIndex) && songIndex >= 0;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'local-search-row local-search-song-row';
        row.disabled = !playable;
        row.appendChild(createResultCover(song.cover_url, song.title));
        row.appendChild(createResultText(
            song.title || '未知歌曲',
            [song.artist, song.album].filter(Boolean).join(' · ') || '未知艺术家'
        ));
        const trailing = document.createElement('span');
        trailing.className = 'local-search-row-trailing';
        if (song.duration > 0) {
            const duration = document.createElement('span');
            duration.className = 'local-search-duration';
            duration.textContent = formatDuration(song.duration);
            trailing.appendChild(duration);
        }
        trailing.appendChild(createIcon(playable ? 'play_arrow' : 'info'));
        row.appendChild(trailing);
        if (playable && typeof searchActions.playSong === 'function') {
            row.addEventListener('click', () => {
                Promise.resolve(searchActions.playSong(song)).then(success => {
                    if (!success) return;
                    document.querySelectorAll('.local-search-song-row.active')
                        .forEach(item => item.classList.remove('active'));
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
        row.appendChild(createResultText(
            playlist.name || '未命名歌单',
            `${Number(playlist.song_count) || 0} 首歌曲`
        ));
        row.appendChild(createIcon('chevron_right', 'local-search-row-arrow'));
        row.addEventListener('click', () => {
            if (typeof searchActions.selectPlaylist !== 'function') return;
            const input = document.getElementById('songSearchInput');
            if (input) input.value = '';
            currentResults = null;
            currentKeyword = '';
            leaveSearchMode();
            searchActions.selectPlaylist(playlist.id, playlist.name, playlist.song_count);
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
        row.appendChild(createResultText(
            artist.name || '未知歌手',
            `${Number(artist.song_count) || 0} 首歌曲 · ${Number(artist.album_count) || 0} 张专辑`
        ));
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
        row.appendChild(createResultText(
            album.name || '未知专辑',
            [album.artist, `${Number(album.song_count) || 0} 首歌曲`].filter(Boolean).join(' · ')
        ));
        group.list.appendChild(row);
    });
    return group.section;
}

function renderOnlineGroup(groups) {
    const section = createGroup('在线结果');
    groups.forEach(resultGroup => {
        const versions = Array.isArray(resultGroup.versions) ? resultGroup.versions : [];
        const row = document.createElement('article');
        row.className = 'online-search-group-row' + (versions.length === 1 ? ' single-version' : '');
        const header = document.createElement('div');
        header.className = 'online-search-group-header';
        header.appendChild(createResultCover(resultGroup.cover_url, resultGroup.title));
        header.appendChild(createResultText(
            resultGroup.title || '未知歌曲',
            [resultGroup.artist, resultGroup.album].filter(Boolean).join(' · ') || '未知艺术家'
        ));
        const count = document.createElement('span');
        count.className = 'online-search-version-count';
        count.textContent = versions.length + ' 个来源';
        header.appendChild(count);
        if (versions.length > 1) {
            const expand = document.createElement('button');
            expand.type = 'button';
            expand.className = 'online-search-expand';
            expand.setAttribute('aria-label', '展开来源版本');
            expand.setAttribute('aria-expanded', 'false');
            expand.appendChild(createIcon('expand_more'));
            expand.addEventListener('click', () => {
                const expanded = row.classList.toggle('expanded');
                expand.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                expand.firstElementChild.textContent = expanded ? 'expand_less' : 'expand_more';
            });
            header.appendChild(expand);
        }
        row.appendChild(header);

        const versionList = document.createElement('div');
        versionList.className = 'online-search-versions';
        versions.forEach(version => versionList.appendChild(renderOnlineVersion(version, resultGroup)));
        row.appendChild(versionList);
        section.list.appendChild(row);
    });
    return section.section;
}

function renderOnlineVersion(version, resultGroup) {
    const row = document.createElement('div');
    row.className = 'online-search-version';
    const source = document.createElement('span');
    source.className = 'online-search-source-badge';
    source.textContent = version.source_name || version.source_id || '在线来源';
    row.appendChild(source);

    const details = [
        version.title && version.title !== resultGroup.title
            ? version.title
            : '',
        version.duration > 0 ? formatDuration(version.duration) : '',
    ].filter(Boolean).join(' · ');
    if (details) {
        const meta = document.createElement('span');
        meta.className = 'online-search-version-meta';
        meta.textContent = details;
        row.appendChild(meta);
    }

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'online-search-play';
    play.setAttribute('aria-label', `播放 ${version.source_name || '在线'} 版本`);
    play.appendChild(createIcon('play_arrow'));
    play.disabled = typeof searchActions.playOnline !== 'function';
    play.addEventListener('click', () => {
        if (typeof searchActions.playOnline !== 'function') return;
        play.disabled = true;
        Promise.resolve(searchActions.playOnline(version.candidate_id)).then(success => {
            if (!success) return;
            document.querySelectorAll('.online-search-version.active')
                .forEach(item => item.classList.remove('active'));
            row.classList.add('active');
        }).finally(() => {
            play.disabled = false;
        });
    });
    row.appendChild(play);
    if (downloaderAvailable && typeof searchActions.downloadOnline === 'function') {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'online-search-download';
        download.setAttribute('aria-label', `下载 ${version.source_name || '在线'} 版本`);
        download.appendChild(createIcon('download'));
        download.addEventListener('click', () => {
            download.disabled = true;
            Promise.resolve(searchActions.downloadOnline(version.candidate_id))
                .finally(() => { download.disabled = false; });
        });
        row.appendChild(download);
    }
    return row;
}

function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;
    return minutes + ':' + (remaining < 10 ? '0' : '') + remaining;
}

function clearSearchResults(results) {
    if (typeof searchActions.cancelCovers === 'function') {
        searchActions.cancelCovers(results);
    }
    results.innerHTML = '';
}
