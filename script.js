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
    const elCountdown = document.getElementById('countdown');
    const elProgressFill = document.getElementById('progressFill');

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

    // Логика перенаправления
    let timeLeft = 5;
    const targetChannel = "https://max.ru/join/wm1il1om-Sp_vehqDQtY7SdftryQ-kXYo-twYEm4-8Y"; // Целевой канал
    
    // Активация тактильного отклика при загрузке (если поддерживается)
    if (webApp?.HapticFeedback) {
        try {
            webApp.HapticFeedback.notificationOccurred('success');
        } catch (e) {
            console.log("HapticFeedback error", e);
        }
    }

    // Анимация прогресс-бара 100% к 0%
    elProgressFill.style.transition = 'width 1s linear';
    elProgressFill.style.width = '100%';

    const timer = setInterval(() => {
        timeLeft -= 1;
        elCountdown.textContent = timeLeft;
        
        // Обновление прогресс бара
        const percent = (timeLeft / 5) * 100;
        elProgressFill.style.width = `${percent}%`;

        // Тактильный фидбэк на каждую секунду
        if (webApp?.HapticFeedback && timeLeft > 0) {
            try {
                webApp.HapticFeedback.impactOccurred('light');
            } catch(e) {}
        }

        if (timeLeft <= 0) {
            clearInterval(timer);
            // Перенаправление с использованием MAX Bridge API
            if (webApp && typeof webApp.openMaxLink === 'function') {
                webApp.openMaxLink(targetChannel);
            } else {
                // Фолбэк для тестов вне приложения
                window.location.href = targetChannel;
            }
        }
    }, 1000);
});
