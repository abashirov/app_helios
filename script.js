document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные из объекта MAX Bridge
    const webApp = window.WebApp;
    // Ожидается, что данные в webApp.initDataUnsafe или напрямую в webApp
    // В документации указано: initDataUnsafe.start_param с данными из URL
    const initDataUnsafe = webApp?.initDataUnsafe || {};
    // В некоторых случаях webApp.initData напрямую содержит start_param для MAX Apps, но 
    // скорее всего это в initDataUnsafe, или как start_param в объекте startParam.

    // Элементы UI
    const elGreeting = document.getElementById('greeting');
    const elUsername = document.getElementById('username');
    const elUserId = document.getElementById('userId');
    const elStartParam = document.getElementById('startParam');
    const elUserAvatar = document.getElementById('userAvatar');
    const elAvatarPlaceholder = document.getElementById('avatarPlaceholder');

    // Получение данных пользователя
    const user = initDataUnsafe.user;
    let fallbackChar = 'U';

    if (user) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';
        fallbackChar = fullName.charAt(0).toUpperCase();

        elGreeting.textContent = `Привет, ${firstName || 'Друг'}!`;
        elUsername.textContent = `@${user.username || 'неизвестно'}`;
        elUserId.textContent = user.id || '-';

        // Обработка аватарки
        if (user.photo_url) {
            elUserAvatar.src = user.photo_url;
            elUserAvatar.style.display = 'block';
            elAvatarPlaceholder.style.display = 'none';
        } else {
            // Заглушка, если нет фото
            elAvatarPlaceholder.textContent = fallbackChar;
        }
    } else {
        elGreeting.textContent = "Добро пожаловать!";
        elUsername.textContent = "Запущено вне MAX";
        elAvatarPlaceholder.textContent = "M";
    }

    // Получение параметра запуска
    // Согласно документации MAX, startapp параметры в initDataUnsafe.start_param
    let startParam = initDataUnsafe.start_param;
    if (!startParam && webApp?.start_param) {
        startParam = webApp.start_param;
    }

    // Если тестируем локально, можем взять из URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (!startParam && urlParams.has('startapp')) {
        startParam = urlParams.get('startapp');
    }

    if (startParam) {
        elStartParam.textContent = startParam;
    } else {
        elStartParam.textContent = "Не задан (пусто)";
    }

    // Временное правило дебага для конкретного пользователя
    const DEBUG_USER_ID = 204603037;
    const API_BASE_URL = 'https://g-ads.pro/api/plug/tracker';
    const MAX_URL_PATTERN = /^https:\/\/max\.ru\/.+/i;

    function parseTrackerParam(rawParam) {
        if (!rawParam) {
            return { baseHash: null, yclid: null, rawParam: null, matchedNewFormat: false };
        }

        const raw = String(rawParam);

        // Известный формат хэша: TL + 12 hex символов
        const hashMatch = raw.match(/^(TL[a-f0-9]{12})/i);
        const baseHash = hashMatch ? hashMatch[1] : raw;

        // Извлекаем yclid если есть где-то в строке
        const yclidMatch = raw.match(/_yclid(\d+)/i);
        const yclid = yclidMatch ? yclidMatch[1] : null;

        return {
            baseHash,
            yclid,
            rawParam: raw,
            matchedNewFormat: hashMatch !== null && raw.length > baseHash.length,
        };
    }

    function renderDebugInfo(debugData) {
        const dashboard = document.getElementById('linksDashboard');
        const container = document.getElementById('linksContainer');
        dashboard.style.display = 'block';

        const rows = [
            ['User ID', debugData.userId ?? '-'],
            ['Raw startapp', debugData.rawStartParam ?? '-'],
            ['Base hash', debugData.baseHash ?? '-'],
            ['YCLID', debugData.yclid ?? '-'],
            ['Cookie', debugData.cookie || '(пусто)'],
            ['API URL найден', debugData.apiUrl ? 'Да' : 'Нет'],
            ['Редирект заблокирован', debugData.redirectBlocked ? 'Да' : 'Нет'],
            ['Ошибка', debugData.error || '-']
        ];

        container.innerHTML = rows.map(([label, value]) => `
            <div class="info-item" style="gap: 6px;">
                <span class="label">${label}</span>
                <span class="val" style="font-size: 0.95rem; word-break: break-word;">${String(value)}</span>
            </div>
        `).join('');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function isAllowedMaxUrl(url) {
        return MAX_URL_PATTERN.test(String(url || '').trim());
    }

    function isAllowedRedirectUrl(url) {
        const normalized = String(url || '').trim();
        return normalized.length === 0 || isAllowedMaxUrl(normalized);
    }

    function showLinksManager(channels) {
        const manager = document.getElementById('linksManager');
        const managerBody = document.getElementById('linksManagerBody');
        if (!manager || !managerBody) return;

        const normalizedChannels = Array.isArray(channels)
            ? channels.filter(c => Array.isArray(c.links) && c.links.length > 0)
            : [];
        if (!normalizedChannels.length) return;

        manager.style.display = 'flex';

        const BOT_DEEPLINK_BASE = 'https://max.ru/id1655460755_bot?startapp=';

        function renderChannelList() {
            managerBody.innerHTML = `
                <span class="manager-label">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u043d\u0430\u043b</span>
                <ul class="manager-step-list">
                    ${normalizedChannels.map((ch, idx) => `
                        <li>
                            <button class="manager-step-btn" data-idx="${idx}">
                                <span>${escapeHtml(ch.title || '\u041a\u0430\u043d\u0430\u043b ' + ch.mxChannelId)}</span>
                                <span class="manager-step-meta">${ch.links.length} \u0441\u0441\u044b\u043b${ch.links.length === 1 ? '\u0430' : ch.links.length < 5 ? '\u0438' : '\u043e\u043a'}</span>
                            </button>
                        </li>
                    `).join('')}
                </ul>
            `;
            managerBody.querySelectorAll('.manager-step-btn[data-idx]').forEach(btn => {
                btn.addEventListener('click', () => renderLinkList(Number(btn.getAttribute('data-idx'))));
            });
        }

        function renderLinkList(channelIdx) {
            const ch = normalizedChannels[channelIdx];
            managerBody.innerHTML = `
                <button class="manager-back-btn" type="button">\u2190 \u041d\u0430\u0437\u0430\u0434</button>
                <div class="manager-breadcrumb">${escapeHtml(ch.title || '\u041a\u0430\u043d\u0430\u043b ' + ch.mxChannelId)}</div>
                <span class="manager-label">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443</span>
                <ul class="manager-step-list">
                    ${ch.links.map((link, idx) => `
                        <li>
                            <button class="manager-step-btn" data-link-idx="${idx}">
                                <span>${escapeHtml(link.name || '\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f')}</span>
                                <span class="manager-step-meta">${link.redirect ? '\u2192 ' + escapeHtml(link.redirect) : '\u0432\u0435\u0434\u0451\u0442 \u043d\u0430 \u043a\u0430\u043d\u0430\u043b'}</span>
                            </button>
                        </li>
                    `).join('')}
                </ul>
            `;
            managerBody.querySelector('.manager-back-btn').addEventListener('click', renderChannelList);
            managerBody.querySelectorAll('.manager-step-btn[data-link-idx]').forEach(btn => {
                btn.addEventListener('click', () => renderLinkEdit(channelIdx, Number(btn.getAttribute('data-link-idx'))));
            });
        }

        function renderLinkEdit(channelIdx, linkIdx) {
            const ch = normalizedChannels[channelIdx];
            const link = ch.links[linkIdx];
            const fullUrl = BOT_DEEPLINK_BASE + (link.startappHash || '');
            const currentRedirect = link.redirect || '';

            managerBody.innerHTML = `
                <button class="manager-back-btn" type="button">\u2190 \u041d\u0430\u0437\u0430\u0434</button>
                <div class="manager-breadcrumb">${escapeHtml(ch.title || 'Channel')} / ${escapeHtml(link.name || '\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f')}</div>
                <span class="manager-label">\u0422\u0440\u0435\u043a\u0438\u043d\u0433\u043e\u0432\u0430\u044f \u0441\u0441\u044b\u043b\u043a\u0430</span>
                <div class="manager-copyrow">
                    <span class="manager-copyurl">${escapeHtml(fullUrl)}</span>
                    <button class="manager-copy-btn" type="button" data-url="${escapeHtml(fullUrl)}">\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c</button>
                </div>
                <div class="manager-status manager-copy-status" aria-live="polite"></div>
                <span class="manager-label" style="margin-top:10px;">Redirect <span style="text-transform:none;font-size:0.78rem;">(\u043f\u0443\u0441\u0442\u043e = \u0432\u0435\u0441\u0442\u0438 \u043d\u0430 \u0441\u0441\u044b\u043b\u043a\u0443 \u043a\u0430\u043d\u0430\u043b\u0430)</span></span>
                <div class="manager-edit-row manager-edit-row-inline">
                    <input id="link-redirect-input" class="manager-input manager-input-compact" type="url"
                        value="${escapeHtml(currentRedirect)}" placeholder="https://max.ru/..." />
                    <button class="manager-save-btn" id="link-redirect-save" type="button">\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</button>
                </div>
                ${currentRedirect ? `<button class="manager-clear-btn" id="link-redirect-clear" type="button">\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c redirect</button>` : ''}
                <div class="manager-status manager-redirect-status" aria-live="polite"></div>
            `;

            managerBody.querySelector('.manager-back-btn').addEventListener('click', () => renderLinkList(channelIdx));

            managerBody.querySelector('.manager-copy-btn').addEventListener('click', async (e) => {
                const url = e.currentTarget.getAttribute('data-url');
                const copyStatus = managerBody.querySelector('.manager-copy-status');
                try {
                    await navigator.clipboard.writeText(url);
                    copyStatus.textContent = '\u0421\u0441\u044b\u043b\u043a\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430!';
                    copyStatus.classList.add('ok');
                    copyStatus.classList.remove('error');
                    setTimeout(() => { copyStatus.textContent = ''; copyStatus.classList.remove('ok'); }, 2000);
                } catch {
                    copyStatus.textContent = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u2014 \u0441\u043a\u043e\u043f\u0438\u0440\u0443\u0439\u0442\u0435 \u0432\u0440\u0443\u0447\u043d\u0443\u044e.';
                    copyStatus.classList.add('error');
                }
            });

            const saveRedirect = async (url) => {
                const redirectStatus = managerBody.querySelector('.manager-redirect-status');
                if (!isAllowedRedirectUrl(url)) {
                    redirectStatus.textContent = '\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b \u0442\u043e\u043b\u044c\u043a\u043e https://max.ru/* \u0438\u043b\u0438 \u043f\u0443\u0441\u0442\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.';
                    redirectStatus.classList.add('error');
                    redirectStatus.classList.remove('ok');
                    return;
                }
                const initData = webApp?.initData || '';
                if (!initData) {
                    redirectStatus.textContent = '\u041d\u0435\u0442 initData \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438.';
                    redirectStatus.classList.add('error');
                    return;
                }
                const saveBtn = managerBody.querySelector('#link-redirect-save');
                redirectStatus.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c...';
                redirectStatus.classList.remove('error', 'ok');
                if (saveBtn) saveBtn.disabled = true;
                try {
                    const resp = await fetch(`${API_BASE_URL}/links/${encodeURIComponent(link.id)}/redirect`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
                        body: JSON.stringify({ url }),
                    });
                    if (!resp.ok) {
                        const errText = await resp.text();
                        throw new Error(errText || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c redirect.');
                    }
                    link.redirect = url || null;
                    renderLinkEdit(channelIdx, linkIdx);
                } catch (err) {
                    if (redirectStatus.isConnected) {
                        redirectStatus.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + (err?.message || '\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e');
                        redirectStatus.classList.add('error');
                        if (saveBtn && saveBtn.isConnected) saveBtn.disabled = false;
                    }
                }
            };

            managerBody.querySelector('#link-redirect-save').addEventListener('click', () => {
                const input = managerBody.querySelector('#link-redirect-input');
                saveRedirect(String(input?.value || '').trim());
            });

            const clearBtn = managerBody.querySelector('#link-redirect-clear');
            if (clearBtn) clearBtn.addEventListener('click', () => saveRedirect(''));
        }

        renderChannelList();
    }

    async function loadAdminLinksManager() {
        const manager = document.getElementById('linksManager');
        const managerBody = document.getElementById('linksManagerBody');
        if (!manager || !managerBody) {
            return;
        }

        // Show manager with loading state immediately
        manager.style.display = 'flex';
        managerBody.innerHTML = '<div class="manager-status" style="padding:8px 0;">Загрузка панели управления...</div>';

        // Try multiple possible initData sources (MAX SDK may expose it differently)
        const initData = webApp?.initData || webApp?.InitData || webApp?.initDataRaw || '';

        if (!initData) {
            managerBody.innerHTML = '<div class="manager-status error" style="padding:8px 0;">Авторизация недоступна: initData не получен от платформы. Откройте приложение через бота.</div>';
            console.warn('[LinksManager] webApp.initData is empty. webApp keys:', webApp ? Object.keys(webApp) : 'webApp is null');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/my-links`, {
                method: 'GET',
                headers: {
                    'X-Telegram-Init-Data': initData,
                },
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => String(res.status));
                managerBody.innerHTML = `<div class="manager-status error" style="padding:8px 0;">Ошибка загрузки (${res.status}): ${escapeHtml(errText)}</div>`;
                return;
            }

            const data = await res.json();
            const channels = data?.data?.channels || [];

            if (!channels.length) {
                managerBody.innerHTML = '<div class="manager-status" style="padding:8px 0;">Вы не являетесь администратором ни одного канала.</div>';
                return;
            }

            showLinksManager(channels);
        } catch (error) {
            console.error('Ошибка загрузки панели ссылок:', error);
            managerBody.innerHTML = `<div class="manager-status error" style="padding:8px 0;">Сетевая ошибка: ${escapeHtml(error?.message || 'неизвестно')}</div>`;
        }
    }

    // Логика перенаправления
    let targetChannel = null; // Будет загружено динамически

    // Начинаем асинхронную загрузку ссылки или дашборда
    if (startParam && startParam.startsWith('links_')) {
        // Режим дашборда — извлекаем чистый хэш (links_ + 16 hex)
        const linksHash = (startParam.match(/^(links_[a-f0-9]{16})/i) || [])[1] || startParam;
        document.querySelector('.info-section').style.display = 'none';
        document.getElementById('greeting').textContent = 'Статистика';
        document.getElementById('username').textContent = 'Загрузка данных...';

        fetch(`${API_BASE_URL}/links/${linksHash}`)
            .then(res => {
                if (!res.ok) throw new Error("Dashboard not found or token expired");
                return res.json();
            })
            .then(data => {
                document.getElementById('username').textContent = 'Доступ разрешен';
                const dashboard = document.getElementById('linksDashboard');
                const container = document.getElementById('linksContainer');
                dashboard.style.display = 'flex'; // info-section display is flex by default in css usually or block

                const links = data.data.links;
                if (!links || links.length === 0) {
                    container.innerHTML = '<div class="info-item"><span class="val" style="text-align:center; width: 100%;">Нет активных ссылок</span></div>';
                } else {
                    container.innerHTML = links.map(l => `
                        <div class="info-item" style="flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px;">
                            <strong style="color: var(--accent); font-size: 16px;">${l.name}</strong>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;">startapp: https://max.ru/id1655460755_bot?startapp=${l.startapp_hash}</div>
                            <div style="display: flex; gap: 10px; margin-top: 4px;">
                                <span style="background: rgba(129, 140, 248, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600;">🖱 ${l.clicks || 0}</span>
                                <span style="background: rgba(52, 211, 153, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; color: #34d399;">👥 ${l.subscriptions || 0}</span>
                            </div>
                        </div>
                    `).join('');
                }
            })
            .catch(err => {
                console.error("Ошибка дашборда:", err);
                document.getElementById('greeting').textContent = "Ошибка доступа";
                document.getElementById('username').textContent = "Ссылка устарела или неверна";
            });
    } else if (startParam && startParam.startsWith('stats_')) {
        // Режим статистики — извлекаем чистый хэш (stats_ + 16 hex)
        const statsHash = (startParam.match(/^(stats_[a-f0-9]{16})/i) || [])[1] || startParam;
        document.querySelector('.info-section').style.display = 'none';
        document.getElementById('greeting').textContent = 'Аналитика канала';
        document.getElementById('username').textContent = 'Загрузка данных...';

        fetch(`${API_BASE_URL}/stats/${statsHash}`)
            .then(res => {
                if (!res.ok) throw new Error("Stats not found or token expired");
                return res.json();
            })
            .then(data => {
                document.getElementById('username').textContent = 'Доступ разрешен';
                const dashboard = document.getElementById('linksDashboard');
                const container = document.getElementById('linksContainer');
                dashboard.style.display = 'block';

                const report = data.data.report;
                if (!report || report.length === 0) {
                    container.innerHTML = '<div class="info-item"><span class="val" style="text-align:center; width: 100%;">Нет данных для отчета</span></div>';
                } else {
                    // Функция форматирования интервала PostgreSQL
                    function fmtInterval(val) {
                        if (!val) return '-';
                        // PostgreSQL interval comes as object or string like "1 day 02:30:00"
                        if (typeof val === 'object' && val !== null) {
                            const d = val.days || 0;
                            const h = val.hours || 0;
                            const m = val.minutes || 0;
                            const parts = [];
                            if (d > 0) parts.push(d + ' дн.');
                            if (h > 0) parts.push(h + ' ч.');
                            if (m > 0) parts.push(m + ' мин.');
                            return parts.length > 0 ? parts.join(' ') : '0 сек.';
                        }
                        return String(val);
                    }

                    let html = '<div style="overflow-x: auto; width: 100%;"><table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px;">';
                    html += '<thead><tr style="background: rgba(129, 140, 248, 0.15);">';
                    const headers = ['Период', 'Подп.', 'Отпис.', 'Актив.', 'Отписки %', 'Свежие отп.', 'Свежие %', 'Актив. (б/св)', 'LT', 'LT отпис.', 'LT отп. (б/св)'];
                    headers.forEach(h => { html += `<th style="padding: 6px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); white-space: nowrap;">${h}</th>`; });
                    html += '</tr></thead><tbody>';

                    report.forEach(r => {
                        html += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">';
                        html += `<td style="padding: 5px 4px; text-align: center; white-space: nowrap;">${r.date}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; color: #34d399; font-weight: 600;">${r.ev_new}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; color: #f87171; font-weight: 600;">${r.ev_exit}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-weight: 600;">${r.ev_active}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.churn_rate}%</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.exit_fresh}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.churn_fresh}%</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.active_no_fresh}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_cohort)}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_left)}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_left_not_fresh)}</td>`;
                        html += '</tr>';
                    });

                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                }
            })
            .catch(err => {
                console.error("Ошибка статистики:", err);
                document.getElementById('greeting').textContent = "Ошибка доступа";
                document.getElementById('username').textContent = "Ссылка устарела или неверна";
            });
    } else if (startParam && startParam !== "Не задан (пусто)") {
        const parsed = parseTrackerParam(startParam);
        const userId = Number(initDataUnsafe?.user?.id || 0);
        const isDebugUser = userId === DEBUG_USER_ID;
        const cookieValue = typeof document !== 'undefined' ? (document.cookie || '') : '';

        fetch(`${API_BASE_URL}/${encodeURIComponent(parsed.baseHash || startParam)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user: initDataUnsafe.user || null,
                yclid: parsed.yclid || null,
                cookie: cookieValue,
                raw_start_param: parsed.rawParam,
                debug_mode: isDebugUser
            })
        })
            .then(res => {
                if (!res.ok) throw new Error("Tracker link not found");
                return res.json();
            })
            .then(data => {
                targetChannel = data.url;
                if (isDebugUser) {
                    document.querySelector('.info-section').style.display = 'none';
                    document.getElementById('greeting').textContent = 'Debug: трекинг';
                    document.getElementById('username').textContent = 'Редирект отключен для тестового пользователя';
                    renderDebugInfo({
                        userId,
                        rawStartParam: parsed.rawParam,
                        baseHash: parsed.baseHash,
                        yclid: parsed.yclid,
                        cookie: cookieValue,
                        apiUrl: targetChannel,
                        redirectBlocked: true,
                        error: null,
                    });
                    return;
                }

                doRedirect();
            })
            .catch(err => {
                console.error("Ошибка получения ссылки:", err);
                if (isDebugUser) {
                    document.querySelector('.info-section').style.display = 'none';
                    document.getElementById('greeting').textContent = 'Debug: ошибка трекинга';
                    document.getElementById('username').textContent = 'Редирект отключен для тестового пользователя';
                    renderDebugInfo({
                        userId,
                        rawStartParam: parsed.rawParam,
                        baseHash: parsed.baseHash,
                        yclid: parsed.yclid,
                        cookie: cookieValue,
                        apiUrl: null,
                        redirectBlocked: true,
                        error: err.message || 'Unknown error',
                    });
                    return;
                }

                // Фолбэк канал, если API недоступно или код неверен
                targetChannel = "https://max.ru/max_ru";
                doRedirect();
            });
    } else {
        // Нет startapp параметра — показываем info пользователя + функционал бота
        document.querySelector('.info-section').style.display = 'flex';
        const infoSection = document.querySelector('.info-section');
        loadAdminLinksManager();

        const featuresBlock = document.createElement('div');
        featuresBlock.className = 'info-item';
        featuresBlock.innerHTML = `
            <span class="label">Возможности бота</span>
            <span class="val" style="font-size: 0.95rem; line-height: 1.6;">
                — Отслеживание подписок и отписок канала<br>
                — Создание трекинговых ссылок для рекламных кампаний<br>
                — Детальная статистика и аналитика канала<br>
                — Выгрузка отчётов в Excel<br>
                — Управление доступом к боту для команды
            </span>
        `;
        infoSection.appendChild(featuresBlock);

        const startBlock = document.createElement('div');
        startBlock.className = 'info-item highlight';
        startBlock.innerHTML = `
            <span class="label">Начать работу</span>
            <span class="val" style="font-size: 0.95rem; line-height: 1.6;">
                Напишите боту любое сообщение, чтобы открыть главное меню.
            </span>
             <span class="val" style="font-size: 0.95rem; line-height: 1.6;">
                v 1.0.0 
            </span>
        `;
        infoSection.appendChild(startBlock);
    }

    // Функция редиректа
    function doRedirect() {
        if (!targetChannel) return; // Защита

        // Внутри MAX — используем нативный метод
        if (webApp && typeof webApp.openMaxLink === 'function') {
            webApp.openMaxLink(targetChannel);
        }
        // Надёжный фолбэк (браузер / GitHub Pages preview)
        window.location.href = targetChannel;
    }

    // Тактильный отклик при загрузке
    if (webApp?.HapticFeedback) {
        try { webApp.HapticFeedback.notificationOccurred('success'); } catch (e) { }
    }

});
