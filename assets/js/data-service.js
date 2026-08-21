/* =====================================================
   data-service.js — مؤتمر الشباب 2026
   يعمل على: GitHub Pages ✅ | Netlify ✅ | Vercel ✅ | محلياً ✅

   يقوم بالتوصيل المباشر مع Google Sheets بصفته مصدر الحقيقة الأساسي.
   ===================================================== */

(function () {
'use strict';

// حارس: منع خطأ إعادة التعريف عند تحميل الملف مرتين (bfcache / Vercel navigation)
if (typeof window.DataService !== 'undefined') return;

class DataService {
    static cachedData     = null;
    static loadPromise    = null;
    static lastFetchTime  = 0;
    static TTL_MS         = 30000; // كاش 30 ثانية
    static GAS_TOKEN_KEY  = 'yc_gas_token';
    static PROXY_URL      = '/_api/gas';

    /* ──────────────────────────────────────────────────────────
       كشف البيئة
       ────────────────────────────────────────────────────────── */

    // المنصات التي لا تدعم Serverless Functions — تستخدم Direct URL إلى GAS
    static _isGitHubPages() {
        const h = window.location.hostname;
        return h.includes('github.io') ||
               h.includes('raw.githubusercontent.com') ||
               h === 'localhost' ||
               h === '127.0.0.1' ||
               h === '';  // فتح الملف مباشرة بدون سيرفر
    }

    // المنصات التي تدعم Serverless Proxy — تستخدم /_api/gas
    static _hasProxy() {
        const h = window.location.hostname;
        return h.includes('vercel.app') ||
               h.includes('netlify.app') ||
               h.endsWith('.vercel.app') ||
               h.endsWith('.netlify.app') ||
               // Custom domains على Vercel/Netlify
               (!h.includes('github.io') && !h.includes('localhost') && h !== '127.0.0.1' && h !== '');
    }

    static getApiUrl() {
        // على GitHub Pages: لا يوجد Proxy — نستخدم Direct URL
        if (this._isGitHubPages()) {
            return (window.YC_CONFIG && window.YC_CONFIG.DIRECT_GAS_URL) || '';
        }
        // على Vercel / Netlify / Custom Domain: نستخدم الـ Proxy دائماً
        // الـ Proxy يُضيف GAS_URL و GAS_TOKEN من Environment Variables على السيرفر
        return this.PROXY_URL;
    }

    static shouldUseDirectUrl() { return this._isGitHubPages(); }
    static getGasUrl()          { return this.getApiUrl(); }
    static setGasUrl()          { /* لم يعد يُستخدم */ }

    static getGasToken() {
        // التوكن لا يُخزَّن في الـ Client بعد الآن لأسباب أمنية
        // على Netlify: يُحقَّن تلقائياً من gas-proxy.js على السيرفر
        // على GitHub Pages: يُرسَّل الطلب بدون توكن (GAS يتحقق من Origin)
        return localStorage.getItem(this.GAS_TOKEN_KEY) || '';
    }
    static setGasToken(token) {
        if (token) localStorage.setItem(this.GAS_TOKEN_KEY, token.trim());
        else        localStorage.removeItem(this.GAS_TOKEN_KEY);
    }


    static invalidateCache() {
        this.cachedData    = null;
        this.loadPromise   = null;
        this.lastFetchTime = 0;
        try { sessionStorage.removeItem('static_conference_data'); } catch(e) {}
    }

    /* ──────────────────────────────────────────────────────────
       جلب البنية الثابتة فواً بدون انتظار Google Sheets (للصفحات السريعة مثل البرنامج)
       ────────────────────────────────────────────────────────── */
    static async loadStructure() {
        if (this.cachedData) return this.cachedData;
        if (!this.structPromise) {
            this.structPromise = this._loadLocalJSON().catch(err => {
                this.structPromise = null;
                throw err;
            });
        }
        return this.structPromise;
    }

    /* ──────────────────────────────────────────────────────────
       تحميل بيانات المؤتمر — مع كاش 30 ثانية
       ملاحظة: المصدر الوحيد للمشتركين هو Google Sheets.
       conference-data.json يُستخدم فقط للبنية (أتوبيسات، غرف، برنامج، مجموعات).
       ────────────────────────────────────────────────────────── */
    static async loadConference(forceRefresh = false) {
        const now = Date.now();
        const cacheExpired = (now - this.lastFetchTime) > this.TTL_MS;

        if (this.cachedData && !forceRefresh && !cacheExpired) {
            return this.cachedData;
        }

        if (this.loadPromise && !forceRefresh) return this.loadPromise;

        this.loadPromise = this._loadFromGAS().catch(err => {
            console.error('DataService.loadConference:', err);
            this.loadPromise = null;
            throw err;
        });
        return this.loadPromise;
    }

    static async _loadFromGAS() {
        // دائماً نجلب البنية الثابتة من conference-data.json (أتوبيسات، غرف، جدول، مجموعات)
        // لكن بدون مشتركين — سيأتون من GAS حصراً
        const structData = await this._loadLocalJSON();
        if (!structData) throw new Error('تعذّر تحميل ملف بيانات المؤتمر الأساسي');

        // إفراغ المشتركين من البنية المحلية — GAS هو المصدر الوحيد
        structData.participants = [];

        const directUrl = (window.YC_CONFIG && window.YC_CONFIG.DIRECT_GAS_URL) || '';
        let gasLoaded   = false;
        let gasError    = null;

        // 1. محاولة الجلب من الـ Proxy (Vercel/Netlify) أولاً
        if (!this._isGitHubPages()) {
            try {
                const liveData = await this._fetchGASParticipants(this.PROXY_URL);
                if (liveData && Array.isArray(liveData)) {
                    console.log(`✅ جلب ${liveData.length} مشترك من Google Sheets عبر Proxy`);
                    this._mergeGASIntoConference(structData, liveData);
                    gasLoaded = true;
                }
            } catch (err) {
                gasError = err;
                console.warn('DataService: فشل الـ Proxy →', err.message);
            }
        }

        // 2. على GitHub Pages أو عند فشل الـ Proxy: جرّب Direct URL
        if (!gasLoaded && directUrl) {
            try {
                console.log('🔄 محاولة Direct URL...');
                const fallbackData = await this._fetchGASParticipants(directUrl);
                if (fallbackData && Array.isArray(fallbackData)) {
                    console.log(`✅ جلب ${fallbackData.length} مشترك (Direct URL)`);
                    this._mergeGASIntoConference(structData, fallbackData);
                    gasLoaded = true;
                    gasError  = null;
                }
            } catch (fallbackErr) {
                console.warn('DataService: فشل Direct URL أيضاً →', fallbackErr.message);
                if (!gasError) gasError = fallbackErr;
            }
        }

        // 3. إذا فشل الاتصال بـ GAS تماماً
        if (!gasLoaded) {
            structData._gasError     = gasError ? gasError.message : 'تعذّر الاتصال بـ Google Sheets';
            structData._gasConnected = false;
            console.error('❌ DataService: تعذّر جلب البيانات من Google Sheets:', gasError);
        } else {
            structData._gasConnected = true;
            structData._gasError     = null;
        }

        this._normalizeParticipants(structData);
        this.cachedData       = structData;
        this.lastFetchTime    = Date.now();
        this.loadPromise      = null;
        window.conferenceData = structData;
        return structData;
    }

    static async _fetchGASParticipants(url) {
        const targetUrl = url || this.getApiUrl();
        if (!targetUrl) return null;

        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 20000);

        try {
            // نستخدم text/plain للرابط المباشر لتفادي الـ CORS Preflight، و application/json للـ Proxy
            const isDirect = targetUrl.includes('script.google.com');
            const res = await fetch(targetUrl, {
                method  : 'POST',
                mode    : 'cors',
                redirect: 'follow',
                signal  : ctrl.signal,
                headers : { 'Content-Type': isDirect ? 'text/plain;charset=utf-8' : 'application/json' },
                body    : JSON.stringify({ action: 'getAll' })
            });
            clearTimeout(tid);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            if (json.status === 'success' && Array.isArray(json.data)) {
                return json.data;
            }
            console.warn('DataService._fetchGASParticipants: GAS responded but data missing:', json);
            return null;
        } catch (err) {
            clearTimeout(tid);
            throw err;
        }
    }

    static async fetchGroupScores() {
        const apiUrl = this.getApiUrl();
        if (!apiUrl) return [];

        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 15000);

        try {
            const isDirect = apiUrl.includes('script.google.com');
            const res = await fetch(apiUrl, {
                method  : 'POST',
                mode    : 'cors',
                redirect: 'follow',
                signal  : ctrl.signal,
                headers : { 'Content-Type': isDirect ? 'text/plain;charset=utf-8' : 'application/json' },
                body    : JSON.stringify({ action: 'getGroupScores' })
            });
            clearTimeout(tid);
            if (!res.ok) return [];
            const json = await res.json().catch(() => null);
            if (json && json.status === 'success' && Array.isArray(json.data)) {
                return json.data;
            }
            return [];
        } catch (e) {
            clearTimeout(tid);
            console.warn('DataService.fetchGroupScores failed:', e);
            return [];
        }
    }

    static async sendToGAS(payload) {
        const proxyUrl = this.PROXY_URL;  // /_api/gas
        const directUrl = (window.YC_CONFIG && window.YC_CONFIG.DIRECT_GAS_URL) || '';

        // نُزيل التوكن من الـ payload — الـ Proxy يُضيفه من السيرفر
        // على GitHub Pages فقط: لا توكن (GAS يتحقق من Origin)
        const { token: _removed, ...cleanPayload } = payload;
        const body = JSON.stringify(cleanPayload);

        this.invalidateCache();

        // 1. على Vercel / Netlify: نستخدم الـ Proxy دائماً
        if (!this._isGitHubPages()) {
            try {
                const res = await fetch(proxyUrl, {
                    method : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body   : body
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const result = await res.json().catch(() => ({ status: 'success' }));
                return { status: 'success', ...result };
            } catch (err) {
                console.error('DataService.sendToGAS Proxy failed:', err);
                return { status: 'error', message: err.toString() };
            }
        }

        // 2. على GitHub Pages / localhost: Direct URL مع cors للكتابة
        if (!directUrl) {
            return { status: 'error', message: 'لا يوجد رابط GAS مضبوط' };
        }
        try {
            const res = await fetch(directUrl, {
                method  : 'POST',
                mode    : 'cors',
                redirect: 'follow',
                // text/plain لتجنب CORS Preflight (OPTIONS request) مع GAS
                headers : { 'Content-Type': 'text/plain;charset=utf-8' },
                body    : body
            });
            const result = await res.json().catch(() => ({ status: 'success' }));
            return { status: 'success', ...result };
        } catch (err) {
            console.error('DataService.sendToGAS Direct URL failed:', err);
            return { status: 'error', message: err.toString() };
        }
    }

    /* ──────────────────────────────────────────────────────────
       دوال التعديل الحي
       ────────────────────────────────────────────────────────── */
    static async assignSeat(name, busNumber, seatNumber) {
        const busStr = busNumber ? `أتوبيس ${busNumber}` : '';
        return this.sendToGAS({
            action: 'assignSeat',
            name: name,
            bus: busStr,
            seat: String(seatNumber || '')
        });
    }

    static async assignRoom(name, roomId) {
        const roomStr = roomId ? String(roomId).replace(/^r/, '') : '';
        return this.sendToGAS({
            action: 'assignRoom',
            name: name,
            room: roomStr
        });
    }

    static async unassignSeat(name) {
        return this.sendToGAS({ action: 'unassignSeat', name });
    }

    static async unassignRoom(name) {
        return this.sendToGAS({ action: 'unassignRoom', name });
    }

    static async updateField(name, field, value) {
        return this.sendToGAS({ action: 'updateField', name, field, value });
    }

    /* ── نقاط المجموعات ── */
    static async updateGroupDayScore(group, day, cat, points, dayTotal, grandTotal) {
        return this.sendToGAS({
            action: 'updateGroupDayScore',
            group, day: String(day), category: cat,
            points: Number(points||0), dayTotal: Number(dayTotal||0), grandTotal: Number(grandTotal||0)
        });
    }

    static async updatePartyScore(group, points, grandTotal) {
        return this.sendToGAS({
            action: 'updatePartyScore',
            group, points: Number(points||0), grandTotal: Number(grandTotal||0)
        });
    }

    static async getGroupScores() {
        return this.sendToGAS({ action: 'getGroupScores' });
    }

    static async refresh() {
        this.invalidateCache();
        return this.loadConference(true);
    }

    static async submitFeedback(name, feedback, nextTrip) {
        const payload = {
            action  : 'addFeedback',
            name    : name     || 'زائر',
            feedback: feedback || '',
            nextTrip: nextTrip || ''
        };
        try {
            const localFeedbacks = JSON.parse(localStorage.getItem('yc2_user_feedbacks') || '[]');
            localFeedbacks.push({ ...payload, date: new Date().toISOString() });
            localStorage.setItem('yc2_user_feedbacks', JSON.stringify(localFeedbacks));
        } catch(e) {}
        return await this.sendToGAS(payload);
    }

    static async _loadLocalJSON() {
        // يجلب فقط البنية الثابتة (أتوبيسات، غرف، برنامج، مجموعات) — بدون مشتركين
        // نستخدم timestamp مُقرَّب لـ 5 دقائق لتمكين كاش المتصفح وتجنب طلب شبكة في كل تحميل
        const prefix    = location.pathname.includes('/pages/') ? '../' : '';
        const url       = prefix + 'assets/data/conference-data.json';
        const cacheKey  = Math.floor(Date.now() / (5 * 60 * 1000)); // يتغير كل 5 دقائق
        const res       = await fetch(`${url}?v=${cacheKey}`);
        if (!res.ok) throw new Error('فشل جلب ملف البيانات: ' + res.status);
        const data = await res.json();
        // تفريغ المشتركين المحليين — Google Sheets هو المصدر الوحيد للمشتركين
        data.participants = [];
        return JSON.parse(JSON.stringify(data));
    }


    // _mergeLocalDraft — تم إزالتها. Google Sheets هو المصدر الوحيد للبيانات.
    // يتم مسح أي مسودات محلية قديمة عند التشغيل لمنع تلوث البيانات.
    static clearLocalDraft() {
        try {
            localStorage.removeItem('conference_db_draft');
            sessionStorage.removeItem('static_conference_data');
        } catch(e) {}
    }

    static _mergeGASIntoConference(confData, gasItems) {
        if (!confData.participants) confData.participants = [];

        const pMap = new Map();
        confData.participants.forEach(p => {
            if (p.name) pMap.set(p.name.trim().toLowerCase(), p);
        });

        const groupNameToId = new Map([
            ['مارجرجس', 'g1'], ['القلب', 'g1'], ['مجموعة 1', 'g1'], ['g1', 'g1'],
            ['مريم العذراء', 'g2'], ['الفكر', 'g2'], ['مجموعة 2', 'g2'], ['g2', 'g2'],
            ['الشهيده مارينا', 'g3'], ['الشهيدة مارينا', 'g3'], ['الارادة', 'g3'], ['الإرادة', 'g3'], ['مجموعة 3', 'g3'], ['g3', 'g3'],
            ['البابا كيرلس', 'g4'], ['الراحة', 'g4'], ['الطريق', 'g4'], ['مجموعة 4', 'g4'], ['g4', 'g4']
        ]);
        const groupIdToName = new Map([
            ['g1', 'مارجرجس'],
            ['g2', 'مريم العذراء'],
            ['g3', 'الشهيده مارينا'],
            ['g4', 'البابا كيرلس']
        ]);

        if (Array.isArray(confData.groups)) {
            confData.groups.forEach(g => {
                const normName = groupIdToName.get(g.id) || g.name;
                g.name = normName;
                groupNameToId.set(g.name.trim().toLowerCase(), g.id);
                groupNameToId.set(g.id.trim().toLowerCase(), g.id);
            });
        }

        confData.participants = [];
        const newMap = new Map();

        gasItems.forEach(item => {
            if (!item.name) return;
            const key  = item.name.trim().toLowerCase();
            const base = pMap.get(key) || {};

            const rawGroup = (item.group || base.group || base.groupId || '').trim();
            const matchedId = rawGroup ? (groupNameToId.get(rawGroup.toLowerCase()) || base.groupId || null) : null;
            const matchedName = matchedId ? (groupIdToName.get(matchedId) || rawGroup) : '';

            const p    = {
                id      : base.id || ('gas-' + Math.random().toString(36).substr(2, 9)),
                name    : item.name.trim(),
                group   : matchedName,
                groupId : matchedId,
                // لا نقاط فردية — النقاط تُدار في ورقة GroupPoints منفصلة
                gender  : item.gender || base.gender || '',
                feedback: item.feedback || base.feedback || '',
                nextTrip: item.nextTrip || base.nextTrip || '',
                lastEdit: item.lastEdit || ''
            };

            if (typeof item.room !== 'undefined') {
                if (item.room && String(item.room).trim() !== '') {
                    const d  = String(item.room).match(/\d+/);
                    p.room   = d ? d[0] : String(item.room).trim();
                    p.roomId = 'r' + p.room;
                } else {
                    p.room   = '';
                    p.roomId = null;
                }
            } else if (base.roomId) {
                p.roomId = base.roomId;
                p.room   = String(base.roomId).replace(/^r/, '');
            }

            if (typeof item.bus !== 'undefined') {
                if (item.bus && String(item.bus).trim() !== '') {
                    const b     = String(item.bus).match(/\d+/);
                    p.busNumber = b ? parseInt(b[0]) : null;
                    p.bus       = p.busNumber ? ('أتوبيس ' + p.busNumber) : String(item.bus).trim();
                } else {
                    p.bus       = '';
                    p.busNumber = null;
                }
            } else if (base.busNumber) {
                p.busNumber = base.busNumber;
                p.bus       = 'أتوبيس ' + base.busNumber;
            }

            if (typeof item.seat !== 'undefined') {
                if (item.seat && String(item.seat).trim() !== '') {
                    const s      = parseInt(item.seat);
                    p.seatNumber = !isNaN(s) ? s : null;
                    p.seat       = String(item.seat).trim();
                } else {
                    p.seat       = '';
                    p.seatNumber = null;
                }
            } else if (base.seatNumber) {
                p.seatNumber = base.seatNumber;
                p.seat       = String(base.seatNumber);
            }

            if (!newMap.has(key)) {
                confData.participants.push(p);
                newMap.set(key, p);
            }
        });
    }

    static _normalizeParticipants(dataCopy) {
        if (!Array.isArray(dataCopy.participants)) return;

        const groupIdToName = new Map([
            ['g1', 'مارجرجس'],
            ['g2', 'مريم العذراء'],
            ['g3', 'الشهيده مارينا'],
            ['g4', 'البابا كيرلس']
        ]);
        const groupNameToId = new Map([
            ['مارجرجس', 'g1'], ['القلب', 'g1'], ['مجموعة 1', 'g1'], ['g1', 'g1'],
            ['مريم العذراء', 'g2'], ['الفكر', 'g2'], ['مجموعة 2', 'g2'], ['g2', 'g2'],
            ['الشهيده مارينا', 'g3'], ['الشهيدة مارينا', 'g3'], ['الارادة', 'g3'], ['الإرادة', 'g3'], ['مجموعة 3', 'g3'], ['g3', 'g3'],
            ['البابا كيرلس', 'g4'], ['الراحة', 'g4'], ['الطريق', 'g4'], ['مجموعة 4', 'g4'], ['g4', 'g4']
        ]);

        if (Array.isArray(dataCopy.groups)) {
            dataCopy.groups.forEach(g => {
                if (groupIdToName.has(g.id)) g.name = groupIdToName.get(g.id);
                else if (groupNameToId.has(g.name)) g.id = groupNameToId.get(g.name);
            });
        }

        dataCopy.participants.forEach(p => {
            const rawGroup = (p.group || p.groupId || '').trim();
            if (rawGroup) {
                const matchedId = groupNameToId.get(rawGroup.toLowerCase()) || p.groupId || null;
                p.groupId = matchedId || null;
                p.group   = matchedId ? (groupIdToName.get(matchedId) || p.group) : '';
            } else {
                p.groupId = null;
                p.group   = '';
            }
            if (!p.roomId && p.room) {
                const d = String(p.room).match(/\d+/);
                p.roomId = d ? 'r' + d[0] : String(p.room);
            }
            if (!p.room && p.roomId) p.room = String(p.roomId).replace(/^r/, '');
            if (!p.busNumber && p.bus) {
                const b = String(p.bus).match(/\d+/);
                if (b) p.busNumber = parseInt(b[0]);
            }
            if (!p.bus && p.busNumber) p.bus = 'أتوبيس ' + p.busNumber;
            if (!p.seatNumber && p.seat) {
                const s = parseInt(p.seat);
                if (!isNaN(s)) p.seatNumber = s;
            }
            if (!p.seat && p.seatNumber) p.seat = String(p.seatNumber);
        });
    }

    static async getParticipants() { return (await this.loadConference()).participants || []; }
    static async getRooms()        { return (await this.loadConference()).rooms        || []; }
    static async getBuses()        { return (await this.loadConference()).buses        || []; }
    static async getGroups()       { return (await this.loadConference()).groups       || []; }
    static async getMeta()         { return (await this.loadConference()).meta         || {}; }

    static mergeGASItemsIntoConference(confData, gasItems) { this._mergeGASIntoConference(confData, gasItems); }
    static async fetchFromGAS(url) { return this._fetchGASParticipants(url); }
}

// مسح المسودات المحلية القديمة فوراً عند تحميل الملف
// Google Sheets هو المصدر الوحيد — لا توجد بيانات محلية للمشتركين
DataService.clearLocalDraft();

window.DataService = DataService;

})(); // نهاية الغلاف الواقي
