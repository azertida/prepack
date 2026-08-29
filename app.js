/* ==========================================
   PRÉPACK
   Deux natures : obligations (datées) et
   intentions (sans temporalité).
   ========================================== */

const STORAGE_TASKS = 'prepack-tasks';
const STORAGE_THEME = 'prepack-theme';
const SETASIDE_DAYS = 56;   // 8 semaines sans être touchée
const SAMPLE_SIZE = 3;      // intentions affichées par défaut

let tasks = [];
let theme = 'light';
let filters = { priority: 'all', tag: 'all', search: '' };
let intentionSample = [];       // ids des intentions actuellement affichées
let showAllIntentions = false;

// ==========================================
// INITIALISATION
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    loadTheme();
    loadTasks();
    migrateTasks();
    applySetAside();
    initEventListeners();
    registerServiceWorker();
    updateUI();
});

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .catch(err => console.log('Service Worker non enregistré :', err));
}

// ==========================================
// MIGRATION (anciennes données éventuelles)
// ==========================================

function migrateTasks() {
    let changed = false;

    tasks.forEach(task => {
        if (!task.type) {
            task.type = task.dueDate ? 'obligation' : 'intention';
            changed = true;
        }
        if (task.type === 'intention') {
            task.priority = null;
            task.dueDate = null;
        }
        if (!task.touchedAt) {
            task.touchedAt = task.updatedAt || task.createdAt || new Date().toISOString();
            changed = true;
        }
        if (typeof task.setAside !== 'boolean') {
            task.setAside = false;
            changed = true;
        }
    });

    if (changed) saveTasks();
}

// ==========================================
// MISE DE CÔTÉ AUTOMATIQUE
// ==========================================

function applySetAside() {
    const limit = Date.now() - SETASIDE_DAYS * 24 * 60 * 60 * 1000;
    let changed = false;

    tasks.forEach(task => {
        if (task.type !== 'intention') return;
        if (task.status === 'done' || task.setAside) return;

        if (new Date(task.touchedAt).getTime() < limit) {
            task.setAside = true;
            task.setAsideAt = new Date().toISOString();
            changed = true;
        }
    });

    if (changed) saveTasks();
}

function touch(task) {
    task.updatedAt = new Date().toISOString();
    task.touchedAt = task.updatedAt;
}

// ==========================================
// THÈME
// ==========================================

function loadTheme() {
    theme = localStorage.getItem(STORAGE_THEME) || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').checked = true;
    }
}

function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(STORAGE_THEME, theme);
}

// ==========================================
// ÉVÉNEMENTS
// ==========================================

function initEventListeners() {
    document.getElementById('themeToggle').addEventListener('change', toggleTheme);

    document.getElementById('toggleAddForm').addEventListener('click', function () {
        const section = document.getElementById('addTaskSection');
        if (section.style.display !== 'none') { closeForm(); } else { openForm(); }
    });
    document.getElementById('cancelAddForm').addEventListener('click', closeForm);
    document.getElementById('addTaskForm').addEventListener('submit', handleSubmitTask);

    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => setFormType(btn.dataset.type));
    });

    document.getElementById('filterPriority').addEventListener('change', e => {
        filters.priority = e.target.value; renderTasks();
    });
    document.getElementById('filterTag').addEventListener('change', e => {
        filters.tag = e.target.value; renderTasks();
    });
    document.getElementById('searchBox').addEventListener('input', e => {
        filters.search = e.target.value.trim(); renderTasks();
    });
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    document.getElementById('shuffleIntentions').addEventListener('click', shuffleIntentions);
    document.getElementById('toggleAllIntentions').addEventListener('click', () => {
        showAllIntentions = !showAllIntentions;
        document.getElementById('toggleAllIntentions').textContent =
            showAllIntentions ? '📕 Réduire' : '📖 Tout voir';
        renderTasks();
    });

    document.getElementById('completedHeader').addEventListener('click', () =>
        toggleSection('completedTasksList', '.completed-section'));
    document.getElementById('setAsideHeader').addEventListener('click', () =>
        toggleSection('setAsideList', '.setaside-section'));

    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('click', () =>
        document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('resetData').addEventListener('click', resetAllData);
}

// ==========================================
// FORMULAIRE
// ==========================================

function setFormType(type) {
    document.getElementById('taskType').value = type;

    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    const obligationFields = document.getElementById('obligationFields');
    const hint = document.getElementById('typeHint');

    if (type === 'obligation') {
        obligationFields.style.display = 'block';
        hint.textContent = 'Une contrainte extérieure, avec une date réelle.';
    } else {
        obligationFields.style.display = 'none';
        hint.textContent = 'Quelque chose que vous voulez faire. Ni date, ni priorité : rien à rattraper.';
    }
}

function openForm(taskId = null) {
    const section = document.getElementById('addTaskSection');
    const toggleBtn = document.getElementById('toggleAddForm');

    section.style.display = 'block';
    toggleBtn.textContent = '❌ Fermer';

    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            setFormType(task.type);
            document.getElementById('formTitle').textContent = '✏️ Modifier';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            document.getElementById('taskDueDate').value = task.dueDate || '';
            document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';
            document.getElementById('editingTaskId').value = taskId;
            document.getElementById('submitBtn').textContent = '✅ Modifier';
        }
    } else {
        setFormType('obligation');
        document.getElementById('formTitle').textContent = '➕ Nouvelle entrée';
        document.getElementById('submitBtn').textContent = '✅ Ajouter';
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeForm() {
    const section = document.getElementById('addTaskSection');
    section.style.display = 'none';
    document.getElementById('toggleAddForm').textContent = '➕ Nouvelle entrée';
    document.getElementById('addTaskForm').reset();
    document.getElementById('editingTaskId').value = '';
    document.getElementById('formTitle').textContent = '➕ Nouvelle entrée';
    document.getElementById('submitBtn').textContent = '✅ Ajouter';
    setFormType('obligation');
}

function handleSubmitTask(e) {
    e.preventDefault();

    const type = document.getElementById('taskType').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const tagsInput = document.getElementById('taskTags').value.trim();
    const editingId = document.getElementById('editingTaskId').value;

    const isObligation = type === 'obligation';
    const priority = isObligation ? document.getElementById('taskPriority').value : null;
    const dueDate = isObligation ? (document.getElementById('taskDueDate').value || null) : null;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    if (editingId) {
        const task = tasks.find(t => t.id === Number(editingId));
        if (task) {
            task.type = type;
            task.title = title;
            task.description = description;
            task.priority = priority;
            task.dueDate = dueDate;
            task.tags = tags;
            task.setAside = false;
            touch(task);
        }
    } else {
        const now = new Date().toISOString();
        tasks.push({
            id: Date.now(),
            type: type,
            title: title,
            description: description,
            priority: priority,
            dueDate: dueDate,
            tags: tags,
            status: 'todo',
            setAside: false,
            createdAt: now,
            updatedAt: now,
            touchedAt: now,
            completedAt: null
        });
        if (type === 'intention') intentionSample = [];  // le nouvel élément peut apparaître
    }

    saveTasks();
    updateUI();
    closeForm();
    showToast(editingId ? '✅ Modifiée' : '✅ Enregistrée');
}

// ==========================================
// INTERFACE
// ==========================================

function updateUI() {
    updateHero();
    updateTagsFilter();
    renderTasks();
}

function startOfWeek() {
    const d = new Date();
    const offset = (d.getDay() + 6) % 7;   // lundi = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return d;
}

function startOfMonth() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d;
}

function updateHero() {
    const week = startOfWeek().getTime();
    const month = startOfMonth().getTime();

    const doneSince = since => tasks.filter(t =>
        t.completedAt && new Date(t.completedAt).getTime() >= since).length;

    document.getElementById('statWeek').textContent = doneSince(week);
    document.getElementById('statMonth').textContent = doneSince(month);

    // Sous-titre : la prochaine échéance, pas le nombre de choses en attente
    const today = todayISO();
    const dated = tasks
        .filter(t => t.type === 'obligation' && t.status !== 'done' && t.dueDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const subtitle = document.getElementById('heroSubtitle');

    if (tasks.length === 0) {
        subtitle.textContent = 'Rien pour l\'instant.';
    } else if (dated.length === 0) {
        subtitle.textContent = 'Aucune échéance en vue.';
    } else {
        const next = dated.find(t => t.dueDate >= today) || dated[0];
        if (next.dueDate === today) {
            subtitle.textContent = `📅 Aujourd'hui : ${next.title}`;
        } else if (next.dueDate < today) {
            subtitle.textContent = `📌 ${next.title} — échéance du ${formatDate(next.dueDate)}`;
        } else {
            subtitle.textContent = `📌 Prochaine échéance : ${next.title}, le ${formatDate(next.dueDate)}`;
        }
    }
}

function updateTagsFilter() {
    const allTags = new Set();
    tasks.forEach(task => (task.tags || []).forEach(tag => allTags.add(tag)));

    const filterTag = document.getElementById('filterTag');
    const current = filterTag.value;

    filterTag.innerHTML = '<option value="all">Tous les tags</option>';
    Array.from(allTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `🏷️ ${tag}`;
        filterTag.appendChild(option);
    });
    filterTag.value = current || 'all';
}

// ==========================================
// FILTRAGE
// ==========================================

function getFilteredTasks() {
    let filtered = [...tasks];

    if (filters.priority !== 'all') {
        filtered = filtered.filter(t => t.type === 'obligation' && t.priority === filters.priority);
    }
    if (filters.tag !== 'all') {
        filtered = filtered.filter(t => t.tags && t.tags.includes(filters.tag));
    }
    if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(s) ||
            (t.description && t.description.toLowerCase().includes(s)) ||
            (t.tags && t.tags.some(tag => tag.toLowerCase().includes(s)))
        );
    }
    return filtered;
}

function clearFilters() {
    filters = { priority: 'all', tag: 'all', search: '' };
    document.getElementById('filterPriority').value = 'all';
    document.getElementById('filterTag').value = 'all';
    document.getElementById('searchBox').value = '';
    renderTasks();
    showToast('🔄 Filtres réinitialisés');
}

// ==========================================
// AFFICHAGE DES LISTES
// ==========================================

function renderTasks() {
    const visible = getFilteredTasks();

    const obligations = visible
        .filter(t => t.type === 'obligation' && t.status !== 'done' && !t.setAside)
        .sort(sortObligations);

    const intentions = visible
        .filter(t => t.type === 'intention' && t.status !== 'done' && !t.setAside);

    const completed = visible
        .filter(t => t.status === 'done')
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    const setAside = visible.filter(t => t.setAside && t.status !== 'done');

    renderList(obligations, 'obligationsList', 'Aucune obligation en cours');
    document.getElementById('obligationsCount').textContent = obligations.length;

    renderIntentions(intentions);

    renderList(completed, 'completedTasksList', 'Aucune tâche terminée');
    document.getElementById('completedTasksCount').textContent = completed.length;

    renderList(setAside, 'setAsideList', 'Rien de mis de côté');
    document.getElementById('setAsideCount').textContent = setAside.length;
    document.getElementById('setAsideSection').style.display = setAside.length ? 'block' : 'none';
}

function sortObligations(a, b) {
    // D'abord les datées, par date croissante
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    const order = { high: 0, medium: 1, low: 2 };
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];

    return new Date(b.createdAt) - new Date(a.createdAt);
}

function renderList(list, containerId, emptyMessage) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }
    list.forEach(task => container.appendChild(createTaskCard(task)));
}

function renderIntentions(intentions) {
    const container = document.getElementById('intentionsList');
    const actions = document.getElementById('sampleActions');
    const countBadge = document.getElementById('intentionsCount');

    container.innerHTML = '';

    if (intentions.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune intention notée</p>';
        actions.style.display = 'none';
        countBadge.classList.add('hidden');
        return;
    }

    let shown;

    if (showAllIntentions || intentions.length <= SAMPLE_SIZE) {
        shown = intentions;
        countBadge.textContent = intentions.length;
        countBadge.classList.remove('hidden');
    } else {
        // Échantillon stable : on garde les mêmes tant que rien ne change
        const available = intentions.map(t => t.id);
        intentionSample = intentionSample.filter(id => available.includes(id));
        const rest = available.filter(id => !intentionSample.includes(id));
        while (intentionSample.length < SAMPLE_SIZE && rest.length) {
            intentionSample.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
        }
        shown = intentionSample.map(id => intentions.find(t => t.id === id)).filter(Boolean);
        countBadge.classList.add('hidden');   // pas de compteur : pas de dette affichée
    }

    shown.forEach(task => container.appendChild(createTaskCard(task)));
    actions.style.display = intentions.length > SAMPLE_SIZE ? 'flex' : 'none';
    document.getElementById('shuffleIntentions').style.display = showAllIntentions ? 'none' : 'inline-flex';
}

function shuffleIntentions() {
    intentionSample = [];
    renderTasks();
}

// ==========================================
// CARTE
// ==========================================

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.classList.add(task.type === 'obligation' ? `priority-${task.priority}` : 'type-intention');
    if (task.status === 'done') card.classList.add('completed');
    if (task.setAside) card.classList.add('set-aside');

    // Header
    const header = document.createElement('div');
    header.className = 'task-header';

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;
    header.appendChild(title);

    if (task.type === 'obligation') {
        const priority = document.createElement('div');
        priority.className = `task-priority ${task.priority}`;
        priority.textContent = { high: '🔴 Haute', medium: '🟡 Moyenne', low: '🟢 Basse' }[task.priority];
        header.appendChild(priority);
    }
    card.appendChild(header);

    // Description
    if (task.description) {
        const description = document.createElement('div');
        description.className = 'task-description';
        description.textContent = task.description;
        card.appendChild(description);
    }

    // Meta : uniquement pour les obligations (et la date de complétion)
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    let hasMeta = false;

    if (task.type === 'obligation' && task.dueDate && task.status !== 'done') {
        const badge = document.createElement('span');
        badge.className = 'task-due-date';
        const today = todayISO();

        if (task.dueDate < today) {
            badge.classList.add('overdue');
            badge.textContent = `⚠️ Échéance dépassée (${formatDate(task.dueDate)})`;
        } else if (task.dueDate === today) {
            badge.classList.add('today');
            badge.textContent = '📅 Aujourd\'hui';
        } else {
            badge.classList.add('upcoming');
            badge.textContent = `📅 ${formatDate(task.dueDate)}`;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'task-meta-item';
        wrapper.appendChild(badge);
        meta.appendChild(wrapper);
        hasMeta = true;
    }

    if (task.completedAt) {
        const done = document.createElement('div');
        done.className = 'task-meta-item';
        done.textContent = `✅ Terminé le ${formatDate(task.completedAt.split('T')[0])}`;
        meta.appendChild(done);
        hasMeta = true;
    }

    if (task.setAside && task.setAsideAt) {
        const aside = document.createElement('div');
        aside.className = 'task-meta-item';
        aside.textContent = `🗂️ Mise de côté le ${formatDate(task.setAsideAt.split('T')[0])}`;
        meta.appendChild(aside);
        hasMeta = true;
    }

    if (hasMeta) card.appendChild(meta);

    // Tags
    if (task.tags && task.tags.length) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'task-tags';
        task.tags.forEach(t => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = `🏷️ ${t}`;
            tagsDiv.appendChild(tag);
        });
        card.appendChild(tagsDiv);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'task-footer';

    if (!task.setAside) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'task-status';
        [
            { value: 'todo', label: '📝 À faire' },
            { value: 'inprogress', label: '⚙️ En cours' },
            { value: 'done', label: '✅ Terminé' }
        ].forEach(s => {
            const badge = document.createElement('span');
            badge.className = `status-badge ${s.value}`;
            if (task.status === s.value) badge.classList.add('active');
            badge.textContent = s.label;
            badge.onclick = () => changeTaskStatus(task.id, s.value);
            statusDiv.appendChild(badge);
        });
        footer.appendChild(statusDiv);
    }

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    if (task.setAside) {
        const restore = document.createElement('button');
        restore.className = 'btn btn-secondary btn-small';
        restore.textContent = '↩️ Reprendre';
        restore.onclick = () => restoreTask(task.id);
        actions.appendChild(restore);
    } else {
        const edit = document.createElement('button');
        edit.className = 'btn btn-secondary btn-small';
        edit.textContent = '✏️ Modifier';
        edit.onclick = () => openForm(task.id);
        actions.appendChild(edit);
    }

    const del = document.createElement('button');
    del.className = 'btn btn-danger btn-small';
    del.textContent = '🗑️ Supprimer';
    del.onclick = () => deleteTask(task.id);
    actions.appendChild(del);

    footer.appendChild(actions);
    card.appendChild(footer);

    return card;
}

// ==========================================
// ACTIONS
// ==========================================

function changeTaskStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = newStatus;
    task.completedAt = newStatus === 'done' ? new Date().toISOString() : null;
    task.setAside = false;
    touch(task);

    saveTasks();
    updateUI();
    showToast({ todo: '📝 À faire', inprogress: '⚙️ En cours', done: '✅ Terminé' }[newStatus]);
}

function restoreTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.setAside = false;
    task.setAsideAt = null;
    touch(task);

    saveTasks();
    updateUI();
    showToast('↩️ Reprise');
}

function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!confirm(`Supprimer « ${task.title} » ?`)) return;

    tasks = tasks.filter(t => t.id !== taskId);
    intentionSample = intentionSample.filter(id => id !== taskId);
    saveTasks();
    updateUI();
    showToast('🗑️ Supprimée');
}

function toggleSection(listId, sectionSelector) {
    const list = document.getElementById(listId);
    const section = document.querySelector(sectionSelector);

    if (list.style.display === 'none') {
        list.style.display = 'block';
        section.classList.add('expanded');
    } else {
        list.style.display = 'none';
        section.classList.remove('expanded');
    }
}

// ==========================================
// DONNÉES : export / import / reset
// ==========================================

function exportData() {
    const payload = JSON.stringify({ app: 'prepack', version: 2, exportedAt: new Date().toISOString(), tasks }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prepack-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('⬇️ Export généré');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            const imported = Array.isArray(parsed) ? parsed : parsed.tasks;
            if (!Array.isArray(imported)) throw new Error('Format inattendu');
            if (!confirm(`Remplacer le contenu actuel par ${imported.length} entrée(s) ?`)) return;

            tasks = imported;
            migrateTasks();
            applySetAside();
            saveTasks();
            intentionSample = [];
            updateUI();
            showToast('⬆️ Import terminé');
        } catch (err) {
            alert('Fichier illisible : ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function resetAllData() {
    if (!confirm('⚠️ Effacer toutes les entrées ?')) return;
    tasks = [];
    intentionSample = [];
    localStorage.removeItem(STORAGE_TASKS);
    updateUI();
    showToast('✅ Tout est effacé');
}

// ==========================================
// PERSISTANCE
// ==========================================

function saveTasks() {
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem(STORAGE_TASKS);
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) tasks = parsed;
    } catch (err) {
        console.error('Données illisibles :', err);
    }
}

// ==========================================
// UTILITAIRES
// ==========================================

function todayISO() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Animations du toast
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideDown {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to   { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
`;
document.head.appendChild(toastStyle);
