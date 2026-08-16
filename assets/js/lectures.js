/* lectures.js — منطق عرض المحاضرات بالنافذة المنبثقة الفاخرة والتوقيت 12 ساعة */

(function () {
    'use strict';

    const modal     = document.getElementById('lectureModal');
    const modalTitle= document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    let lectures = [];

    /* ─── تحويل الوقت إلى توقيت 12 ساعة تلقائياً (12-hour format) ─── */
    function formatTime12Str(timeStr) {
        if (!timeStr) return '';
        return timeStr.replace(/\b(\d{1,2}):(\d{2})\b/g, (match, hStr, mStr) => {
            let h = parseInt(hStr, 10);
            const ampm = h >= 12 ? 'م' : 'ص';
            if (h > 12) h -= 12;
            else if (h === 0) h = 12;
            const hFormatted = h < 10 ? '0' + h : '' + h;
            return `${hFormatted}:${mStr} ${ampm}`;
        });
    }

    function escapeHTML(str) {
        if (!str) return '';
        if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ─── رسم بطاقة محاضرة فاخرة مع استغلال ممتاذ للمساحة ─── */
    function renderCard(lec) {
        const div = document.createElement('div');
        div.className = 'lecture-card';
        div.setAttribute('role', 'button');
        div.setAttribute('tabindex', '0');

        const formattedTime = formatTime12Str(lec.time);

        div.innerHTML = `
            <div class="lecture-card-top-bar">
                ${lec.speakerImg 
                    ? `<img src="${lec.speakerImg}" alt="${escapeHTML(lec.speaker)}" class="speaker-avatar-img" loading="lazy" decoding="async">` 
                    : '<div class="lecture-card-icon"><i class="bi bi-mic-fill"></i></div>'}
                <div class="lecture-card-header-info">
                    <div class="lecture-card-title">${escapeHTML(lec.title)}</div>
                    <div class="lecture-speaker-name"><i class="bi bi-person-fill me-1"></i>المحاضر: ${escapeHTML(lec.speaker)}</div>
                </div>
            </div>
            
            <div class="lecture-card-meta">
                <span class="meta-chip"><i class="bi bi-clock-fill me-1"></i>${formattedTime}</span>
                <span class="meta-chip"><i class="bi bi-geo-alt-fill me-1"></i>${escapeHTML(lec.place)}</span>
            </div>
            
            ${lec.summary ? `<p class="lecture-card-summary">${escapeHTML(lec.summary)}</p>` : ''}
            
            <div class="lecture-card-btn">
                <span>عرض الأهداف والمحتوى</span>
                <i class="bi bi-chevron-left"></i>
            </div>
        `;

        const open = () => openModal(lec);
        div.addEventListener('click', open);
        div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
        return div;
    }

    /* ─── رسم جميع المحاضرات لكل يوم ─── */
    function renderAll() {
        [1, 2].forEach(day => {
            const panel = document.getElementById(`panel-day-${day}`);
            if (!panel) return;
            panel.innerHTML = '';

            const dayLectures = lectures.filter(l => l.day === day);
            if (dayLectures.length === 0) {
                if (window.YC && YC.renderEmptyState) {
                    YC.renderEmptyState(panel, `سيتم إضافة محاضرات اليوم ${day === 1 ? 'الأول' : 'الثاني'} قريباً`);
                } else {
                    panel.innerHTML = `<div class="text-center p-4 text-muted">سيتم إضافة محاضرات اليوم ${day} قريباً</div>`;
                }
                return;
            }

            dayLectures.forEach(lec => panel.appendChild(renderCard(lec)));
        });
    }

    /* ─── فتح النافذة المنبثقة الفاخرة المنسقة (Modal) ─── */
    function openModal(lec) {
        if (!modal) return;
        if (modalTitle) modalTitle.textContent = lec.title;

        const formattedTime = formatTime12Str(lec.time);

        const goalsHtml = (lec.goals || []).map(g => `
            <div style="background:rgba(34,197,94,0.12); border-right:4px solid #22c55e; border-radius:10px; padding:10px 14px; margin-bottom:8px; font-weight:700; color:#f0fdf4; font-size:0.88rem; display:flex; align-items:center; gap:8px;">
                <span style="color:#22c55e; font-size:1.1rem;">🎯</span> <span>${escapeHTML(g)}</span>
            </div>
        `).join('');

        const questions = Array.isArray(lec.questions) ? lec.questions : [];
        const questionsHtml = questions.length ? questions.map((q, i) => `
            <div class="lecture-question-item" style="background:rgba(183,139,50,.08);border:1px solid rgba(229,200,120,.2);border-radius:14px;padding:12px 14px;margin-bottom:8px;">
                <div style="font-weight:900;color:#e5c878;margin-bottom:4px;">س${i+1}. ${escapeHTML(q.question || '')}</div>
                <div style="font-size:.76rem;color:#a99c89;">النقاط: ${Number(q.points || 0)}</div>
            </div>`).join('') : `
            <div style="background:rgba(183,139,50,.06);border:1px dashed rgba(229,200,120,.2);border-radius:14px;padding:14px;color:#bfb29f;font-size:.82rem;">أسئلة المحاضرة ستُضاف هنا، وستدخل نقاط الإجابات ضمن تقييم الفريق لليوم.</div>`;

        const keyHtml = (lec.keyTakeaways || []).map(k => `
            <div class="concept-badge-card"><span style="color:#00e5ff; font-size:1.1rem;">✨</span> <span>${escapeHTML(k)}</span></div>
        `).join('');

        if (modalBody) {
            modalBody.innerHTML = `
                <div class="text-center mb-3 p-3" style="background:rgba(15,23,42,0.8); border-radius:16px; border:1px solid rgba(251,191,36,0.3);">
                    ${lec.speakerImg ? `<img src="${lec.speakerImg}" alt="${escapeHTML(lec.speaker)}" style="width:115px; height:115px; border-radius:50%; object-fit:cover; border:3.5px solid #fbbf24; box-shadow:0 0 25px rgba(251,191,36,0.6); margin-bottom:10px;">` : ''}
                    <h5 style="font-weight:900; color:#fbbf24; margin:0 0 4px;">${escapeHTML(lec.speaker)}</h5>
                    <div style="font-size:0.84rem; color:#cbd5e1;">دراسة كتابية وروحية متميزة للمؤتمر</div>
                </div>

                <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
                    <span class="meta-chip" style="font-size:0.88rem; padding:0.45rem 1rem;"><i class="bi bi-clock-fill me-1"></i>${formattedTime}</span>
                    <span class="meta-chip" style="font-size:0.88rem; padding:0.45rem 1rem;"><i class="bi bi-geo-alt-fill me-1"></i>${escapeHTML(lec.place)}</span>
                </div>

                ${lec.summary ? `<div class="mb-4" style="color:#cbd5e1; font-size:0.94rem; line-height:1.65; background:rgba(15,23,42,0.6); border-radius:14px; padding:12px 16px; border:1px solid rgba(255,255,255,0.08);">${escapeHTML(lec.summary)}</div>` : ''}

                ${goalsHtml ? `
                <div class="mb-4">
                    <div style="font-size:0.92rem; font-weight:900; color:#86efac; margin-bottom:10px;"><i class="bi bi-bullseye me-1"></i>أهداف المحاضرة الأساسية:</div>
                    <div>${goalsHtml}</div>
                </div>` : ''}

                <div class="mb-4">
                    <div style="font-size:.92rem;font-weight:900;color:#e5c878;margin-bottom:10px;"><i class="bi bi-patch-question-fill me-1"></i>أسئلة المحاضرة ودرجات الفريق</div>
                    ${questionsHtml}
                </div>

                ${keyHtml ? `
                <div>
                    <div style="font-size:0.92rem; font-weight:900; color:#00e5ff; margin-bottom:10px;"><i class="bi bi-bookmarks-fill me-1"></i>المفاهيم والنقاط الرئيسية:</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">${keyHtml}</div>
                </div>` : ''}
            `;
        }

        if (window.bootstrap && bootstrap.Modal) {
            modal.removeAttribute('aria-hidden');
            const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    /* ─── تهيئة الصفحة والتبويب ─── */
    function initTabs() {
        document.querySelectorAll('.day-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = Number(e.target.getAttribute('data-day'));
                document.querySelectorAll('.day-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));

                e.target.classList.add('active');
                const panel = document.getElementById(`panel-day-${day}`);
                if (panel) panel.classList.add('active');
            });
        });
    }

    const DEFAULT_LECTURES = [
        { id:'d1-l1', day:1, title:'المحاضرة الأولى', speaker:'القمص منسي عزيز', speakerImg:'../assets/img/fr-mansi-aziz.jpg', time:'12:00 - 13:00', place:'القاعة الرئيسية', summary:'المحاضرة الروحية الأولى في مؤتمر ميلادا عجيبًا.', goals:[], keyTakeaways:[], notesEnabled:true, questions:[] },
        { id:'d2-l1', day:2, title:'المحاضرة الثانية', speaker:'القمص موريس حمدي', speakerImg:'../assets/img/fr-morris-hamdy.jpg', time:'11:30 - 12:30', place:'القاعة الرئيسية', summary:'المحاضرة الروحية الثانية في مؤتمر ميلادا عجيبًا.', goals:[], keyTakeaways:[], notesEnabled:true, questions:[] }
    ];

    function getSourceLectures() {
        if (window.lectures && Array.isArray(window.lectures) && window.lectures.length > 0) {
            return window.lectures;
        }
        return DEFAULT_LECTURES;
    }

    function checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id');
        const targetDay = params.get('day');

        if (targetId) {
            const found = lectures.find(l => l.id === targetId);
            if (found) {
                const dayBtn = document.querySelector(`.day-tab[data-day="${found.day}"]`);
                if (dayBtn) {
                    document.querySelectorAll('.day-tab').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
                    dayBtn.classList.add('active');
                    const panel = document.getElementById(`panel-day-${found.day}`);
                    if (panel) panel.classList.add('active');
                }
                setTimeout(() => openModal(found), 150);
                return;
            }
        }
        if (targetDay) {
            const dayBtn = document.querySelector(`.day-tab[data-day="${targetDay}"]`);
            if (dayBtn) {
                document.querySelectorAll('.day-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
                dayBtn.classList.add('active');
                const panel = document.getElementById(`panel-day-${targetDay}`);
                if (panel) panel.classList.add('active');
            }
        }
    }

    function init() {
        initTabs();

        if (window.DataService && typeof DataService.loadConference === 'function') {
            DataService.loadConference().then(data => {
                if (data && Array.isArray(data.lectures) && data.lectures.length > 0) {
                    lectures = data.lectures;
                } else {
                    lectures = getSourceLectures();
                }
                renderAll();
                checkUrlParams();
            }).catch(() => {
                lectures = getSourceLectures();
                renderAll();
                checkUrlParams();
            });
        } else {
            lectures = getSourceLectures();
            renderAll();
            checkUrlParams();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
