/* ==========================================================================
   AetherMind - Multi-Diagram & Folder Dashboard Gallery Logic
   ========================================================================== */

// --- Constants & Config ---
const DEFAULT_CANVAS_SIZE = 12000;
const INITIAL_COORDINATE = DEFAULT_CANVAS_SIZE / 2;

// Coggle-like vibrant color palette
const COLOR_PALETTE = [
  '#b845c4', // Purple
  '#4556c4', // Blue
  '#22c55e', // Green
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#ec4899'  // Pink
];

// --- Local Storage Database Schema Keys ---
const INDEX_KEY = 'aethermind_diagrams_index';
const FOLDERS_KEY = 'aethermind_folders_index';
const DATA_PREFIX = 'aethermind_diagram_data_';

// --- State Variables ---
let state = {
  // Database indexes
  diagrams: [],
  folders: [],
  
  // Active edit state
  activeDiagramId: null,
  nodes: {},
  rootId: null,
  selectedNodeId: null,
  history: [],
  redoHistory: [],
  
  // Canvas zoom/pan
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isEditing: false,
  
  // Dashboard navigation
  currentView: 'dashboard', // 'dashboard' or 'editor'
  currentFolderId: 'all',   // 'all', 'uncategorized', or folder ID
  searchQuery: '',
  
  // Modal tracking
  activeModalActionId: null
};

// Canvas element caching
let viewportEl = null;
let containerEl = null;
let svgEl = null;
let nodesContainerEl = null;

// Panning and Dragging variables
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };

let draggedNodeId = null;
let dragNodeStart = { x: 0, y: 0 };
let dragSubtreeStart = {}; // Subtree node coordinates cache for group dragging
let dragMouseStart = { x: 0, y: 0 };
let hasMovedDuringDrag = false;

let isResizingNodeId = null;
let resizeStartWidth = 0;
let resizeMouseStartX = 0;

// --- Initialize App ---
window.addEventListener('DOMContentLoaded', () => {
  // Cache DOM elements
  viewportEl = document.getElementById('canvas-viewport');
  containerEl = document.getElementById('canvas-container');
  svgEl = document.getElementById('connections-svg');
  nodesContainerEl = document.getElementById('nodes-container');

  // Initialize DB and folders
  initDatabase();

  // Setup Event Listeners
  setupCanvasEvents();
  setupKeyboardEvents();
  setupUIEvents();
  setupWindowResize();

  // Show appropriate view
  if (state.currentView === 'editor' && state.activeDiagramId) {
    openDiagram(state.activeDiagramId);
  } else {
    showDashboard();
  }
});

// --- Local-First Database Initialization ---

function initDatabase() {
  try {
    const rawIndex = localStorage.getItem(INDEX_KEY);
    const rawFolders = localStorage.getItem(FOLDERS_KEY);
    
    if (rawIndex) state.diagrams = JSON.parse(rawIndex);
    if (rawFolders) state.folders = JSON.parse(rawFolders);
    
    // Seed default database if empty
    if (state.diagrams.length === 0 && state.folders.length === 0) {
      seedDefaultDatabase();
    }

    // Auto-Deduplicate diagrams index by title to clean up any duplicate cards
    const uniqueDiagrams = [];
    const seenTitles = new Set();
    state.diagrams.forEach(d => {
      const cleanTitle = (d.title || '').trim().replace(/^(✨|🇨🇳)\s*/, '');
      if (!seenTitles.has(cleanTitle)) {
        seenTitles.add(cleanTitle);
        uniqueDiagrams.push(d);
      } else {
        localStorage.removeItem(DATA_PREFIX + d.id);
      }
    });
    if (uniqueDiagrams.length !== state.diagrams.length) {
      state.diagrams = uniqueDiagrams;
      saveIndexToStorage();
    }
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
}

// Helper to generate English Sample Showcase nodes
function generateSampleShowcaseNodes(rootId) {
  const nodes = {};
  nodes[rootId] = {
    id: rootId,
    text: '🚀 Welcome to AetherMind!',
    x: INITIAL_COORDINATE,
    y: INITIAL_COORDINATE,
    color: '#6366f1',
    parent: null,
    children: []
  };

  const mainBranches = [
    {
      title: '🎨 Vibrant Colors & Layout',
      color: '#b845c4',
      dx: -280,
      dy: -180,
      children: [
        { text: 'Auto-curving Coggle bezier lines', dx: -540, dy: -230 },
        { text: '8 Vibrant color swatches', dx: -540, dy: -180 },
        { text: 'Drag & drop branch positioning', dx: -540, dy: -130 }
      ]
    },
    {
      title: '⚡ Keyboard Shortcuts',
      color: '#3b82f6',
      dx: 280,
      dy: -180,
      children: [
        { text: 'Tab: Add child branch', dx: 520, dy: -230 },
        { text: 'Enter: Add sibling branch', dx: 520, dy: -180 },
        { text: 'Space / F2: Edit node text', dx: 520, dy: -130 },
        { text: 'Delete: Remove branch', dx: 520, dy: -80 }
      ]
    },
    {
      title: '🧠 Mind Mapping Tools',
      color: '#10b981',
      dx: 280,
      dy: 80,
      children: [
        { text: 'Inline text formatting', dx: 520, dy: 30 },
        { text: 'Collapsible branches (+ / -)', dx: 520, dy: 80 },
        { text: 'Auto-zoom & Smooth Pan', dx: 520, dy: 130 }
      ]
    },
    {
      title: '📁 Folder & Dashboard System',
      color: '#f59e0b',
      dx: -280,
      dy: 80,
      children: [
        { text: 'Organize diagrams into folders', dx: -540, dy: 30 },
        { text: 'Real-time search & filter bar', dx: -540, dy: 80 },
        { text: 'Instant visual card grid', dx: -540, dy: 130 }
      ]
    },
    {
      title: '💾 Export & 100% Privacy',
      color: '#ec4899',
      dx: 0,
      dy: 240,
      children: [
        { text: '100% Private (Saved locally in browser)', dx: -220, dy: 330 },
        { text: 'Export to PNG, SVG vector, or PDF', dx: 220, dy: 330 },
        { text: 'Share 1-click Zip package', dx: 0, dy: 380 }
      ]
    }
  ];

  mainBranches.forEach(b => {
    const bId = 'node_' + Math.random().toString(36).substr(2, 9);
    nodes[bId] = {
      id: bId,
      text: b.title,
      x: INITIAL_COORDINATE + b.dx,
      y: INITIAL_COORDINATE + b.dy,
      color: b.color,
      parent: rootId,
      children: []
    };
    nodes[rootId].children.push(bId);

    b.children.forEach(c => {
      const cId = 'node_' + Math.random().toString(36).substr(2, 9);
      nodes[cId] = {
        id: cId,
        text: c.text,
        x: INITIAL_COORDINATE + c.dx,
        y: INITIAL_COORDINATE + c.dy,
        color: b.color,
        parent: bId,
        children: []
      };
      nodes[bId].children.push(cId);
    });
  });

  return nodes;
}

// Helper to generate Chinese Sample Showcase nodes
function generateSampleZhShowcaseNodes(rootId) {
  const nodes = {};
  nodes[rootId] = {
    id: rootId,
    text: '🚀 欢迎使用 AetherMind 脑图！',
    x: INITIAL_COORDINATE,
    y: INITIAL_COORDINATE,
    color: '#6366f1',
    parent: null,
    children: []
  };

  const mainBranches = [
    {
      title: '🎨 丰富色彩与贝塞尔曲线',
      color: '#b845c4',
      dx: -280,
      dy: -180,
      children: [
        { text: 'Coggle 风格平滑自适应曲线', dx: -540, dy: -230 },
        { text: '8 种炫彩专属分支调色盘', dx: -540, dy: -180 },
        { text: '自由拖拽与节点位置调整', dx: -540, dy: -130 }
      ]
    },
    {
      title: '⚡ 高效键盘快捷键',
      color: '#3b82f6',
      dx: 280,
      dy: -180,
      children: [
        { text: 'Tab 键：添加子分支', dx: 520, dy: -230 },
        { text: 'Enter 键：添加同级分支', dx: 520, dy: -180 },
        { text: 'Space / F2 键：编辑节点文本', dx: 520, dy: -130 },
        { text: 'Delete 键：删除分支', dx: 520, dy: -80 }
      ]
    },
    {
      title: '🧠 智能脑图编辑工具',
      color: '#10b981',
      dx: 280,
      dy: 80,
      children: [
        { text: '行内文本格式化与排版', dx: 520, dy: 30 },
        { text: '分支折叠与展开 (+ / -)', dx: 520, dy: 80 },
        { text: '画布平滑缩放与一键居中', dx: 520, dy: 130 }
      ]
    },
    {
      title: '📁 文件夹与项目管理',
      color: '#f59e0b',
      dx: -280,
      dy: 80,
      children: [
        { text: '自定义文件夹多层分类', dx: -540, dy: 30 },
        { text: '实时关键字搜索与筛选', dx: -540, dy: 80 },
        { text: '可视化画廊卡片网格', dx: -540, dy: 130 }
      ]
    },
    {
      title: '💾 导出分享与 100% 隐私',
      color: '#ec4899',
      dx: 0,
      dy: 240,
      children: [
        { text: '100% 本地隐私保存（无需服务器）', dx: -220, dy: 330 },
        { text: '一键导出 PNG / SVG / PDF', dx: 220, dy: 330 },
        { text: '生成 1-Click 便携绿色 Zip 压缩包', dx: 0, dy: 380 }
      ]
    }
  ];

  mainBranches.forEach(b => {
    const bId = 'node_' + Math.random().toString(36).substr(2, 9);
    nodes[bId] = {
      id: bId,
      text: b.title,
      x: INITIAL_COORDINATE + b.dx,
      y: INITIAL_COORDINATE + b.dy,
      color: b.color,
      parent: rootId,
      children: []
    };
    nodes[rootId].children.push(bId);

    b.children.forEach(c => {
      const cId = 'node_' + Math.random().toString(36).substr(2, 9);
      nodes[cId] = {
        id: cId,
        text: c.text,
        x: INITIAL_COORDINATE + c.dx,
        y: INITIAL_COORDINATE + c.dy,
        color: b.color,
        parent: bId,
        children: []
      };
      nodes[bId].children.push(cId);
    });
  });

  return nodes;
}

function seedDefaultDatabase() {
  state.folders = [];

  // Seed English sample diagram
  const enDiagId = 'diag_sample_en';
  const enRootId = 'root_sample_en';
  const enNodes = generateSampleShowcaseNodes(enRootId);
  localStorage.setItem(DATA_PREFIX + enDiagId, JSON.stringify({
    rootId: enRootId,
    nodes: enNodes
  }));

  // Seed Chinese sample diagram
  const zhDiagId = 'diag_sample_zh';
  const zhRootId = 'root_sample_zh';
  const zhNodes = generateSampleZhShowcaseNodes(zhRootId);
  localStorage.setItem(DATA_PREFIX + zhDiagId, JSON.stringify({
    rootId: zhRootId,
    nodes: zhNodes
  }));

  // Append seed diagrams to index
  state.diagrams = [
    {
      id: enDiagId,
      title: '✨ AetherMind Feature Tour',
      folderId: null,
      lastModified: new Date().toISOString(),
      nodeCount: Object.keys(enNodes).length
    },
    {
      id: zhDiagId,
      title: '🇨🇳 AetherMind 功能展示导图',
      folderId: null,
      lastModified: new Date(Date.now() - 1000 * 60).toISOString(),
      nodeCount: Object.keys(zhNodes).length
    }
  ];

  // Save changes to localStorage
  saveIndexToStorage();
}

function saveIndexToStorage() {
  localStorage.setItem(INDEX_KEY, JSON.stringify(state.diagrams));
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(state.folders));
}

// --- View Toggling ---

function showDashboard() {
  state.currentView = 'dashboard';
  document.getElementById('dashboard-view').classList.remove('hide');
  document.getElementById('canvas-viewport').style.display = 'none';
  
  // Hide floating autosave status indicator on dashboard
  const statusEl = document.querySelector('.auto-save-status');
  if (statusEl) statusEl.style.display = 'none';
  
  // Hide active diagram title and undo/redo in editor bar
  document.getElementById('active-diagram-title').innerText = 'AetherMind';
  document.querySelector('.header-actions').style.opacity = '0';
  document.querySelector('.header-actions').style.pointerEvents = 'none';
  document.getElementById('btn-home-toggle').classList.add('hide');

  renderDashboard();
}

function showEditor() {
  state.currentView = 'editor';
  document.getElementById('dashboard-view').classList.add('hide');
  document.getElementById('canvas-viewport').style.display = 'block';
  
  // Show floating autosave status indicator in editor
  const statusEl = document.querySelector('.auto-save-status');
  if (statusEl) statusEl.style.display = 'flex';
  
  document.querySelector('.header-actions').style.opacity = '1';
  document.querySelector('.header-actions').style.pointerEvents = 'auto';
  document.getElementById('btn-home-toggle').classList.remove('hide');
  
  // Clear selected node toolbar
  selectNode(null);
}

// --- Dashboard Render Controllers ---

function renderDashboard() {
  renderSidebarFolders();
  renderDiagramsGrid();
}

function renderSidebarFolders() {
  const foldersList = document.getElementById('folders-list');
  foldersList.innerHTML = '';

  // 1. Render static 'All Diagrams' folder entry
  const allItem = document.createElement('div');
  allItem.className = 'folder-item' + (state.currentFolderId === 'all' ? ' active' : '');
  allItem.innerHTML = `<span>All Diagrams</span>`;
  allItem.addEventListener('click', () => {
    state.currentFolderId = 'all';
    renderDashboard();
  });
  foldersList.appendChild(allItem);

  // 2. Render static 'Uncategorized' folder entry
  const uncatItem = document.createElement('div');
  uncatItem.className = 'folder-item' + (state.currentFolderId === 'uncategorized' ? ' active' : '');
  uncatItem.innerHTML = `<span>Uncategorized</span>`;
  uncatItem.addEventListener('click', () => {
    state.currentFolderId = 'uncategorized';
    renderDashboard();
  });
  foldersList.appendChild(uncatItem);

  // 3. Render database folders
  state.folders.forEach(folder => {
    const activeClass = state.currentFolderId === folder.id ? ' active' : '';
    
    const folderEl = document.createElement('div');
    folderEl.className = 'folder-item' + activeClass;
    folderEl.innerHTML = `
      <span>${escapeHtml(folder.name)}</span>
      <div class="folder-item-actions">
        <button class="btn-card-action btn-card-rename" title="Rename Folder" onclick="event.stopPropagation(); triggerRenameFolder('${folder.id}')" style="margin-right: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-card-action btn-card-delete" title="Delete Folder" onclick="event.stopPropagation(); triggerDeleteFolder('${folder.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
    
    folderEl.addEventListener('click', () => {
      state.currentFolderId = folder.id;
      renderDashboard();
    });
    
    foldersList.appendChild(folderEl);
  });
}

function generateThumbnailSvg(diagId) {
  try {
    const rawData = localStorage.getItem(DATA_PREFIX + diagId);
    if (!rawData) return getPlaceholderSvg();
    
    const parsed = JSON.parse(rawData);
    if (!parsed || !parsed.nodes || Object.keys(parsed.nodes).length === 0) {
      return getPlaceholderSvg();
    }
    
    const nodes = parsed.nodes;
    
    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    Object.values(nodes).forEach(n => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + 100);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + 40);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
      return getPlaceholderSvg();
    }
    
    const padding = Math.max(width, height) * 0.15 + 40;
    const vbX = minX - padding;
    const vbY = minY - padding;
    const vbW = width + padding * 2;
    const vbH = height + padding * 2;
    
    let svgContent = '';
    
    // 1. Draw connection lines
    Object.values(nodes).forEach(node => {
      if (node.parent && nodes[node.parent]) {
        const parent = nodes[node.parent];
        const px = parent.x + 50;
        const py = parent.y + 18;
        const cx = node.x + (node.x > parent.x ? 0 : 80);
        const cy = node.y + 18;
        
        const dx = Math.max(30, Math.abs(cx - px) * 0.4);
        const cp1x = px + (node.x > parent.x ? dx : -dx);
        const cp2x = cx + (node.x > parent.x ? -dx : dx);
        
        const strokeColor = node.color || '#6366f1';
        
        svgContent += `<path d="M ${px} ${py} C ${cp1x} ${py}, ${cp2x} ${cy}, ${cx} ${cy}" stroke="${strokeColor}" stroke-width="8" fill="none" opacity="0.8" stroke-linecap="round" />`;
      }
    });
    
    // 2. Draw node lines/boxes
    Object.values(nodes).forEach(node => {
      const color = node.color || '#6366f1';
      if (node.parent === null) {
        svgContent += `<rect x="${node.x}" y="${node.y}" width="100" height="36" rx="8" ry="8" fill="${color}" opacity="0.9" />`;
      } else {
        svgContent += `<line x1="${node.x}" y1="${node.y + 28}" x2="${node.x + 80}" y2="${node.y + 28}" stroke="${color}" stroke-width="12" stroke-linecap="round" opacity="0.9" />`;
      }
    });
    
    return `
      <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" class="diagram-thumbnail-svg">
        ${svgContent}
      </svg>
    `;
  } catch (err) {
    console.error("Failed to generate card thumbnail SVG:", err);
    return getPlaceholderSvg();
  }
}

function getPlaceholderSvg() {
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="diagram-thumbnail-svg placeholder-thumbnail">
      <circle cx="50" cy="50" r="8" fill="rgba(255,255,255,0.08)" />
      <line x1="50" y1="50" x2="30" y2="38" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
      <line x1="50" y1="50" x2="70" y2="38" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
      <line x1="50" y1="50" x2="50" y2="70" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
    </svg>
  `;
}

function renderDiagramsGrid() {
  const grid = document.getElementById('diagrams-grid');
  grid.innerHTML = '';

  // Filter diagrams based on active folder
  let filtered = state.diagrams;
  if (state.currentFolderId === 'uncategorized') {
    filtered = state.diagrams.filter(d => !d.folderId);
  } else if (state.currentFolderId !== 'all') {
    filtered = state.diagrams.filter(d => d.folderId === state.currentFolderId);
  }

  // Filter diagrams based on search query
  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(d => d.title.toLowerCase().includes(q));
  }

  // Header folder title label
  let folderTitleText = 'All Diagrams';
  if (state.currentFolderId === 'uncategorized') {
    folderTitleText = 'Uncategorized';
  } else if (state.currentFolderId !== 'all') {
    const activeFolder = state.folders.find(f => f.id === state.currentFolderId);
    if (activeFolder) folderTitleText = activeFolder.name;
  }
  document.getElementById('current-folder-title').innerText = folderTitleText;

  // Render cards
  filtered.forEach(diag => {
    const card = document.createElement('div');
    card.className = 'diagram-card';
    
    const formattedDate = new Date(diag.lastModified).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Find folder label name
    let folderBadge = '';
    if (diag.folderId) {
      const folder = state.folders.find(f => f.id === diag.folderId);
      if (folder) {
        folderBadge = `<div class="diagram-card-folder"><span style="color: #6bb343; font-weight:600;">📁 ${escapeHtml(folder.name)}</span></div>`;
      }
    }

    card.innerHTML = `
      <div class="diagram-card-preview">
        ${generateThumbnailSvg(diag.id)}
      </div>
      <div class="diagram-card-body">
        <div class="diagram-card-main">
          <div class="diagram-card-title">${escapeHtml(diag.title)}</div>
          <div class="diagram-card-date">Modified: ${formattedDate}</div>
          ${folderBadge}
      </div>
      <div class="diagram-card-actions">
        <button class="btn-card-action" title="Move to Folder" onclick="event.stopPropagation(); triggerMoveDiagram('${diag.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
        <button class="btn-card-action" title="Rename" onclick="event.stopPropagation(); triggerRenameDiagram('${diag.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="btn-card-action" title="Clone / Copy" onclick="event.stopPropagation(); cloneDiagram('${diag.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="btn-card-action" title="Download JSON" onclick="event.stopPropagation(); downloadDiagramJson('${diag.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-card-action btn-card-delete" title="Delete" onclick="event.stopPropagation(); deleteDiagram('${diag.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;

    card.addEventListener('click', () => {
      openDiagram(diag.id);
    });

    grid.appendChild(card);
  });

  // Empty state card
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.gridColumn = '1 / -1';
    empty.style.textAlign = 'center';
    empty.style.padding = '40px 0';
    empty.style.color = 'var(--text-muted)';
    empty.innerText = 'No diagrams found. Click "New Mindmap" to create one!';
    grid.appendChild(empty);
  }
}

// --- Diagrams Core Database CRUD ---

function createNewDiagram() {
  const diagId = 'diag_' + Math.random().toString(36).substr(2, 9);
  const rootId = 'root_' + Math.random().toString(36).substr(2, 9);
  
  // Default structure
  const initialNodes = {};
  initialNodes[rootId] = {
    id: rootId,
    text: 'Central Idea',
    x: INITIAL_COORDINATE,
    y: INITIAL_COORDINATE,
    color: '#6366f1',
    parent: null,
    children: []
  };

  // Save diagram data
  localStorage.setItem(DATA_PREFIX + diagId, JSON.stringify({
    rootId: rootId,
    nodes: initialNodes
  }));

  // Append diagram details to index
  const newDiag = {
    id: diagId,
    title: 'Untitled Mindmap',
    folderId: (state.currentFolderId !== 'all' && state.currentFolderId !== 'uncategorized') ? state.currentFolderId : null,
    lastModified: new Date().toISOString(),
    nodeCount: 1
  };
  
  state.diagrams.unshift(newDiag);
  saveIndexToStorage();

  // Load newly created diagram
  openDiagram(diagId);
}

function openDiagram(id) {
  const indexItem = state.diagrams.find(d => d.id === id);
  let rawData = localStorage.getItem(DATA_PREFIX + id);
  
  // Self-healing check: if index item exists but raw data is missing, create a default root node
  if (indexItem && !rawData) {
    const fallbackRootId = 'root_' + Math.random().toString(36).substr(2, 9);
    const fallbackNodes = {};
    fallbackNodes[fallbackRootId] = {
      id: fallbackRootId,
      text: indexItem.title || 'Central Idea',
      x: INITIAL_COORDINATE,
      y: INITIAL_COORDINATE,
      color: '#6366f1',
      parent: null,
      children: []
    };
    
    const fallbackData = {
      rootId: fallbackRootId,
      nodes: fallbackNodes
    };
    
    rawData = JSON.stringify(fallbackData);
    localStorage.setItem(DATA_PREFIX + id, rawData);
    console.warn(`Self-healed missing diagram data for ID: ${id}`);
  }

  if (!indexItem || !rawData) {
    alert("Mindmap data could not be loaded!");
    showDashboard();
    return;
  }

  try {
    const data = JSON.parse(rawData);
    state.activeDiagramId = id;
    state.nodes = data.nodes;
    state.rootId = data.rootId;
    state.selectedNodeId = null;
    
    // Reset undo history
    state.history = [JSON.stringify(state.nodes)];
    state.redoHistory = [];
    updateUndoRedoButtons();
    
    // Update heading UI
    document.getElementById('active-diagram-title').innerText = indexItem.title;
    
    showEditor();
    renderAll();
    
    // Center view on the root node
    setTimeout(() => {
      centerViewOnRoot();
    }, 50);
  } catch (err) {
    console.error("Open diagram failure:", err);
    alert("Corrupted mindmap data file.");
  }
}

function cloneDiagram(id) {
  const indexItem = state.diagrams.find(d => d.id === id);
  const rawData = localStorage.getItem(DATA_PREFIX + id);
  
  if (!indexItem || !rawData) return;

  const cloneId = 'diag_' + Math.random().toString(36).substr(2, 9);
  
  // Clone diagram data
  localStorage.setItem(DATA_PREFIX + cloneId, rawData);

  // Add to index list
  const cloneItem = {
    id: cloneId,
    title: indexItem.title + ' (Copy)',
    folderId: indexItem.folderId,
    lastModified: new Date().toISOString(),
    nodeCount: indexItem.nodeCount
  };

  state.diagrams.unshift(cloneItem);
  saveIndexToStorage();
  renderDashboard();
}

function deleteDiagram(id) {
  if (confirm("Are you sure you want to delete this diagram permanently?")) {
    state.diagrams = state.diagrams.filter(d => d.id !== id);
    localStorage.removeItem(DATA_PREFIX + id);
    saveIndexToStorage();
    renderDashboard();
  }
}

function renameDiagram(id, newTitle) {
  const diag = state.diagrams.find(d => d.id === id);
  if (diag && newTitle.trim() !== '') {
    diag.title = newTitle.trim();
    diag.lastModified = new Date().toISOString();
    saveIndexToStorage();
    renderDashboard();
    
    if (state.activeDiagramId === id) {
      document.getElementById('active-diagram-title').innerText = diag.title;
    }
  }
}

function moveDiagramFolder(id, folderId) {
  const diag = state.diagrams.find(d => d.id === id);
  if (diag) {
    diag.folderId = folderId === 'uncategorized' ? null : folderId;
    diag.lastModified = new Date().toISOString();
    saveIndexToStorage();
    renderDashboard();
  }
}

function downloadDiagramJson(id) {
  const indexItem = state.diagrams.find(d => d.id === id);
  const rawData = localStorage.getItem(DATA_PREFIX + id);
  if (!indexItem || !rawData) return;
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(rawData);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  
  const safeFilename = indexItem.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadAnchor.setAttribute("download", `mindmap_${safeFilename}.json`);
  
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// --- Folder CRUD ---

function createFolder(name) {
  if (name.trim() === '') return;
  
  const id = 'folder_' + Math.random().toString(36).substr(2, 9);
  const newFolder = {
    id: id,
    name: name.trim()
  };
  
  state.folders.push(newFolder);
  saveIndexToStorage();
  renderDashboard();
}

function triggerDeleteFolder(id) {
  const folder = state.folders.find(f => f.id === id);
  if (!folder) return;
  
  if (confirm(`Delete folder "${folder.name}"? Mindmaps inside will be kept as Uncategorized.`)) {
    // Keep mindmaps, clear folderId link
    state.diagrams.forEach(d => {
      if (d.folderId === id) d.folderId = null;
    });
    
    state.folders = state.folders.filter(f => f.id !== id);
    saveIndexToStorage();
    
    if (state.currentFolderId === id) {
      state.currentFolderId = 'all';
    }
    renderDashboard();
  }
}

function triggerRenameFolder(id) {
  const folder = state.folders.find(f => f.id === id);
  if (!folder) return;
  
  const newName = prompt("Rename folder to:", folder.name);
  if (newName !== null && newName.trim() !== "") {
    folder.name = newName.trim();
    saveIndexToStorage();
    renderDashboard();
  }
}

// --- Modals Controller Helpers ---

function showModal(modalId, actionId = null) {
  const modal = document.getElementById(modalId);
  if (modal) {
    state.activeModalActionId = actionId;
    modal.classList.remove('hide');
    
    // Focus default input inside modal
    const input = modal.querySelector('input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function hideModals() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(modal => {
    modal.classList.add('hide');
  });
  state.activeModalActionId = null;
}

function triggerRenameDiagram(id) {
  const diag = state.diagrams.find(d => d.id === id);
  if (diag) {
    showModal('modal-rename', id);
    document.getElementById('input-rename-title').value = diag.title;
    document.getElementById('input-rename-title').select();
  }
}

function triggerMoveDiagram(id) {
  const diag = state.diagrams.find(d => d.id === id);
  if (diag) {
    const select = document.getElementById('select-move-folder');
    select.innerHTML = '<option value="uncategorized">-- Uncategorized --</option>';
    
    state.folders.forEach(f => {
      const selectedStr = diag.folderId === f.id ? 'selected' : '';
      select.innerHTML += `<option value="${f.id}" ${selectedStr}>${escapeHtml(f.name)}</option>`;
    });
    
    showModal('modal-move', id);
  }
}

// --- Mindmap Active Autosave ---

function saveActiveDiagramState() {
  if (state.activeDiagramId) {
    const data = {
      rootId: state.rootId,
      nodes: state.nodes
    };
    
    // Save diagram data
    localStorage.setItem(DATA_PREFIX + state.activeDiagramId, JSON.stringify(data));
    
    // Update diagram count & modified metadata in index
    const indexItem = state.diagrams.find(d => d.id === state.activeDiagramId);
    if (indexItem) {
      // Keep diagram title in sync with the root node's text
      const rootNode = state.nodes[state.rootId];
      if (rootNode && rootNode.text && rootNode.text.trim() !== '') {
        indexItem.title = rootNode.text.trim();
        const headerTitleEl = document.getElementById('active-diagram-title');
        if (headerTitleEl) {
          headerTitleEl.innerText = indexItem.title;
        }
      }
      
      indexItem.nodeCount = Object.keys(state.nodes).length;
      indexItem.lastModified = new Date().toISOString();
      saveIndexToStorage();
    }
    
    // Trigger visual save status flash
    const dot = document.querySelector('.status-dot');
    if (dot) dot.style.backgroundColor = '#22c55e';
    const statusTextEl = document.getElementById('status-text');
    if (statusTextEl) statusTextEl.innerText = 'Auto-saved locally';
  }
}

// --- State Management Copy ---

function saveHistory() {
  const stateCopy = JSON.stringify(state.nodes);
  if (state.history.length === 0 || state.history[state.history.length - 1] !== stateCopy) {
    state.history.push(stateCopy);
    state.redoHistory = [];
    updateUndoRedoButtons();
  }
  
  saveActiveDiagramState();
}

function undo() {
  if (state.history.length > 1) {
    const current = state.history.pop();
    state.redoHistory.push(current);
    
    const previous = state.history[state.history.length - 1];
    state.nodes = JSON.parse(previous);
    
    if (state.selectedNodeId && !state.nodes[state.selectedNodeId]) {
      selectNode(null);
    }
    
    renderAll();
    updateUndoRedoButtons();
    saveActiveDiagramState();
  }
}

function redo() {
  if (state.redoHistory.length > 0) {
    const next = state.redoHistory.pop();
    state.history.push(next);
    
    state.nodes = JSON.parse(next);
    
    renderAll();
    updateUndoRedoButtons();
    saveActiveDiagramState();
  }
}

function updateUndoRedoButtons() {
  document.getElementById('btn-undo').disabled = state.history.length <= 1;
  document.getElementById('btn-redo').disabled = state.redoHistory.length === 0;
}

// --- Node CRUD Operations ---

function addNode(parentId) {
  if (state.isEditing) return;
  const parent = state.nodes[parentId];
  if (!parent) return;

  const childId = 'node_' + Math.random().toString(36).substr(2, 9);
  let childX = parent.x;
  let childY = parent.y;
  
  let side = 'right';
  if (parentId === state.rootId) {
    const leftCount = parent.children.filter(id => state.nodes[id] && state.nodes[id].x < parent.x).length;
    const rightCount = parent.children.length - leftCount;
    side = (rightCount <= leftCount) ? 'right' : 'left';
  } else {
    const root = state.nodes[state.rootId];
    side = (parent.x >= root.x) ? 'right' : 'left';
  }

  childX += (side === 'right') ? 200 : -200;
  const childCount = parent.children.length;
  const spread = 50;
  childY += (childCount * spread) - ((childCount - 1) * (spread / 2)) + (Math.random() * 10 - 5);

  let childColor = parent.color;
  if (parentId === state.rootId) {
    childColor = COLOR_PALETTE[childCount % COLOR_PALETTE.length];
  }

  state.nodes[childId] = {
    id: childId,
    text: 'New Branch',
    x: childX,
    y: childY,
    color: childColor,
    parent: parentId,
    children: []
  };
  
  parent.children.push(childId);
  selectNode(childId);
  saveHistory();
  renderAll();

  startEditingNode(childId);
}

function addSiblingNode(nodeId) {
  if (nodeId === state.rootId) return;
  const node = state.nodes[nodeId];
  if (!node || !node.parent) return;
  addNode(node.parent);
}

function deleteNode(nodeId) {
  if (nodeId === state.rootId) {
    alert("The root node cannot be deleted. You can clear the canvas to reset.");
    return;
  }
  const node = state.nodes[nodeId];
  if (!node) return;

  const nodesToDelete = [];
  function collectDescendants(id) {
    nodesToDelete.push(id);
    const n = state.nodes[id];
    if (n && n.children) {
      n.children.forEach(collectDescendants);
    }
  }
  collectDescendants(nodeId);

  const parentId = node.parent;
  if (parentId && state.nodes[parentId]) {
    state.nodes[parentId].children = state.nodes[parentId].children.filter(id => id !== nodeId);
  }

  nodesToDelete.forEach(id => {
    delete state.nodes[id];
  });

  selectNode(parentId && state.nodes[parentId] ? parentId : null);
  saveHistory();
  renderAll();
}

function updateNodeText(nodeId, newText) {
  const node = state.nodes[nodeId];
  if (node && node.text !== newText) {
    node.text = newText;
    saveHistory();
    renderAll();
  }
}

function changeNodeColor(nodeId, color) {
  const node = state.nodes[nodeId];
  if (!node) return;
  
  node.color = color;
  function cascadeColor(id, targetColor) {
    const child = state.nodes[id];
    if (!child) return;
    child.color = targetColor;
    if (child.children) {
      child.children.forEach(cid => cascadeColor(cid, targetColor));
    }
  }
  cascadeColor(nodeId, color);
  
  saveHistory();
  renderAll();
  positionToolbar();
}

// --- Canvas Navigation ---

function updateCanvasTransform() {
  containerEl.style.transform = `translate(${panX}px, ${panY}px) scale(${state.zoom})`;
  const gridBackground = document.getElementById('grid-background');
  gridBackground.style.backgroundPosition = `${panX}px ${panY}px`;
  gridBackground.style.backgroundSize = `${24 * state.zoom}px ${24 * state.zoom}px`;
}

function centerViewOnRoot() {
  const root = state.nodes[state.rootId];
  if (!root) return;

  const vpWidth = viewportEl.clientWidth;
  const vpHeight = viewportEl.clientHeight;

  state.zoom = 1.0;
  panX = vpWidth / 2 - root.x;
  panY = vpHeight / 2 - root.y;
  
  document.getElementById('zoom-level').innerText = '100%';
  updateCanvasTransform();
}

// Tree layout automatic centering and balance layout engine (Auto-Arrange)
function layoutTree() {
  const root = state.nodes[state.rootId];
  if (!root) return;
  
  // Push the current pre-arrange state to the undo history stack
  saveHistory();
  
  // Reset root to center coordinates
  root.x = INITIAL_COORDINATE;
  root.y = INITIAL_COORDINATE;
  
  const children = root.children.filter(id => state.nodes[id]);
  
  // Sort children by current y coordinate to preserve their vertical order (e.g. Module 1 to 4)
  children.sort((a, b) => {
    const nodeA = state.nodes[a];
    const nodeB = state.nodes[b];
    return (nodeA ? nodeA.y : 0) - (nodeB ? nodeB.y : 0);
  });
  
  const rightChildren = [];
  const leftChildren = [];
  
  // Check if all children are at the same horizontal line (unmoved/fresh map)
  const allSameX = children.every(id => Math.abs(state.nodes[id].x - root.x) < 5);
  
  if (allSameX && children.length > 0) {
    // For a brand new map, distribute them evenly 50/50
    children.forEach((childId, index) => {
      if (index % 2 === 0) {
        rightChildren.push(childId);
      } else {
        leftChildren.push(childId);
      }
    });
  } else {
    // Respect the user's manual placement (keep them on the side they were dragged to)
    children.forEach(childId => {
      const child = state.nodes[childId];
      if (child.x >= root.x) {
        rightChildren.push(childId);
      } else {
        leftChildren.push(childId);
      }
    });
  }
  
  // Curated spatial gaps
  const verticalGap = 24;
  const horizontalGap = 80;
  
  // Query actual rendered width/height from DOM to prevent overlapping text wrappers
  function getNodeDims(id) {
    const el = document.getElementById(id);
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
      return {
        width: el.offsetWidth,
        height: el.offsetHeight
      };
    }
    return { width: 140, height: 36 };
  }
  
  const heights = {};
  
  function computeHeights(id) {
    const node = state.nodes[id];
    if (!node) return 0;
    
    const dims = getNodeDims(id);
    const childrenIds = node.children.filter(cid => state.nodes[cid]);
    
    if (childrenIds.length === 0) {
      heights[id] = Math.max(dims.height, 36);
      return heights[id];
    }
    
    let subHeight = 0;
    childrenIds.forEach(cid => {
      subHeight += computeHeights(cid);
    });
    subHeight += (childrenIds.length - 1) * verticalGap;
    
    // Total vertical span is the maximum of the node's height, minimum 36px, or children sum
    heights[id] = Math.max(dims.height, 36, subHeight);
    return heights[id];
  }
  
  const rootDims = getNodeDims(root.id);
  
  // Compute subtree heights
  rightChildren.forEach(computeHeights);
  leftChildren.forEach(computeHeights);
  
  function positionNodes(id, startX, startY, dir) {
    const node = state.nodes[id];
    if (!node) return;
    
    const dims = getNodeDims(id);
    
    if (dir === 1) {
      // Right side: startX is the left-edge of the child node
      node.x = startX;
    } else {
      // Left side: startX is the right-edge of the child node, so shift left by its own width
      node.x = startX - dims.width;
    }
    node.y = startY - dims.height / 2;
    
    const childrenIds = node.children.filter(cid => state.nodes[cid]);
    if (childrenIds.length === 0) return;
    
    const totalHeight = childrenIds.reduce((sum, cid) => sum + (heights[cid] || 36), 0) + (childrenIds.length - 1) * verticalGap;
    let currentY = startY - totalHeight / 2;
    
    const nextStartX = (dir === 1) ? (node.x + dims.width + horizontalGap) : (node.x - horizontalGap);
    
    childrenIds.forEach(cid => {
      const childHeight = heights[cid] || 36;
      const childCenterY = currentY + childHeight / 2;
      positionNodes(cid, nextStartX, childCenterY, dir);
      currentY += childHeight + verticalGap;
    });
  }
  
  // Layout right side branches
  if (rightChildren.length > 0) {
    const totalRightHeight = rightChildren.reduce((sum, cid) => sum + (heights[cid] || 36), 0) + (rightChildren.length - 1) * verticalGap;
    let currentY = (root.y + rootDims.height / 2) - totalRightHeight / 2;
    const startX = root.x + rootDims.width + horizontalGap;
    
    rightChildren.forEach(cid => {
      const h = heights[cid] || 36;
      positionNodes(cid, startX, currentY + h / 2, 1);
      currentY += h + verticalGap;
    });
  }
  
  // Layout left side branches
  if (leftChildren.length > 0) {
    const totalLeftHeight = leftChildren.reduce((sum, cid) => sum + (heights[cid] || 36), 0) + (leftChildren.length - 1) * verticalGap;
    let currentY = (root.y + rootDims.height / 2) - totalLeftHeight / 2;
    const startX = root.x - horizontalGap;
    
    leftChildren.forEach(cid => {
      const h = heights[cid] || 36;
      positionNodes(cid, startX, currentY + h / 2, -1);
      currentY += h + verticalGap;
    });
  }
  
  // Save post-arrange state to history
  saveHistory();
  
  // Render updates with animated transition
  renderNodes();
  animateLayoutChange();
  
  // Center screen on root node
  centerViewOnRoot();
}

function animateLayoutChange() {
  containerEl.classList.add('layout-transition');
  
  const duration = 400;
  const start = performance.now();
  
  function step(timestamp) {
    const elapsed = timestamp - start;
    
    // Continuously redraw Bezier connections and position toolbar during CSS transitions
    renderConnections();
    positionToolbar();
    
    if (elapsed < duration) {
      requestAnimationFrame(step);
    } else {
      containerEl.classList.remove('layout-transition');
      renderConnections();
      positionToolbar();
    }
  }
  
  requestAnimationFrame(step);
}

function zoom(factor, mouseX, mouseY) {
  const oldZoom = state.zoom;
  let newZoom = oldZoom * factor;
  newZoom = Math.max(0.15, Math.min(newZoom, 3.0));
  
  if (newZoom === oldZoom) return;

  const mx = mouseX !== undefined ? mouseX : viewportEl.clientWidth / 2;
  const my = mouseY !== undefined ? mouseY : viewportEl.clientHeight / 2;

  const cx = (mx - panX) / oldZoom;
  const cy = (my - panY) / oldZoom;

  state.zoom = newZoom;
  panX = mx - cx * newZoom;
  panY = my - cy * newZoom;

  document.getElementById('zoom-level').innerText = Math.round(newZoom * 100) + '%';
  updateCanvasTransform();
  positionToolbar();
}

// --- Setup Panning & Dragging Events ---

function setupCanvasEvents() {
  viewportEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.node-wrapper') || e.target.closest('#node-toolbar') || e.target.closest('.glass-ui')) {
      return;
    }
    isPanning = true;
    viewportEl.style.cursor = 'grabbing';
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    panOffset.x = panX;
    panOffset.y = panY;
    selectNode(null);
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      panX = panOffset.x + dx;
      panY = panOffset.y + dy;
      updateCanvasTransform();
    }
    
    if (draggedNodeId) {
      const node = state.nodes[draggedNodeId];
      if (node) {
        hasMovedDuringDrag = true;
        const dx = (e.clientX - dragMouseStart.x) / state.zoom;
        const dy = (e.clientY - dragMouseStart.y) / state.zoom;
        
        // Translate coordinates for the entire subtree
        Object.keys(dragSubtreeStart).forEach(id => {
          const childNode = state.nodes[id];
          if (childNode) {
            childNode.x = dragSubtreeStart[id].x + dx;
            childNode.y = dragSubtreeStart[id].y + dy;
            
            const childEl = document.getElementById(id);
            if (childEl) {
              childEl.style.left = childNode.x + 'px';
              childEl.style.top = childNode.y + 'px';
            }
          }
        });
        
        renderConnections();
        positionToolbar();
      }
    }

    if (isResizingNodeId) {
      const node = state.nodes[isResizingNodeId];
      if (node) {
        const dx = (e.clientX - resizeMouseStartX) / state.zoom;
        const newWidth = Math.max(80, Math.min(resizeStartWidth + dx, 800));
        
        node.width = newWidth;
        
        const nodeEl = document.getElementById(isResizingNodeId);
        if (nodeEl) {
          const contentEl = nodeEl.querySelector('.node-content');
          contentEl.style.width = newWidth + 'px';
          contentEl.style.maxWidth = 'none';
        }
        
        renderConnections();
        positionToolbar();
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      viewportEl.style.cursor = 'grab';
    }
    if (draggedNodeId) {
      if (hasMovedDuringDrag) {
        saveHistory();
      }
      draggedNodeId = null;
    }
    if (isResizingNodeId) {
      saveHistory();
      isResizingNodeId = null;
    }
  });

  viewportEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = viewportEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    zoom(factor, mx, my);
  }, { passive: false });
}

// --- Setup Nodes and Connections Elements Rendering ---

function renderAll() {
  renderNodes();
  renderConnections();
  positionToolbar();
}

function renderNodes() {
  const existingIds = new Set();
  
  Object.values(state.nodes).forEach(node => {
    existingIds.add(node.id);
    let nodeEl = document.getElementById(node.id);
    
    if (!nodeEl) {
      nodeEl = document.createElement('div');
      nodeEl.id = node.id;
      nodeEl.className = 'node-wrapper';
      
      const contentEl = document.createElement('div');
      contentEl.className = 'node-content';
      nodeEl.appendChild(contentEl);
      
      // Append resize handle to the node wrapper
      const handleEl = document.createElement('div');
      handleEl.className = 'node-resize-handle';
      nodeEl.appendChild(handleEl);
      
      setupNodeEvents(nodeEl, node.id);
      nodesContainerEl.appendChild(nodeEl);
    }
    
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.style.setProperty('--branch-color', node.color);
    
    nodeEl.className = 'node-wrapper';
    if (node.id === state.rootId) {
      nodeEl.classList.add('root-node');
    }
    if (node.id === state.selectedNodeId) {
      nodeEl.classList.add('selected');
    }
    
    const contentEl = nodeEl.querySelector('.node-content');
    
    // Apply custom resizable width if set
    if (node.width) {
      contentEl.style.width = node.width + 'px';
      contentEl.style.maxWidth = 'none';
    } else {
      contentEl.style.width = '';
      contentEl.style.maxWidth = '';
    }
    
    if (!contentEl.querySelector('textarea')) {
      contentEl.textContent = node.text;
    }
  });
  
  const domNodes = nodesContainerEl.querySelectorAll('.node-wrapper');
  domNodes.forEach(el => {
    if (!existingIds.has(el.id)) {
      el.remove();
    }
  });
}

function renderConnections() {
  const paths = svgEl.querySelectorAll('path');
  paths.forEach(p => p.remove());

  Object.values(state.nodes).forEach(node => {
    if (node.parent && state.nodes[node.parent]) {
      const parent = state.nodes[node.parent];
      const parentEl = document.getElementById(parent.id);
      const childEl = document.getElementById(node.id);
      
      let pw = 120, ph = 30;
      let cw = 120, ch = 30;
      
      if (parentEl) {
        pw = parentEl.offsetWidth;
        ph = parentEl.offsetHeight;
      }
      if (childEl) {
        cw = childEl.offsetWidth;
        ch = childEl.offsetHeight;
      }

      let x1, y1, x2, y2;
      if (node.x > parent.x) {
        x1 = parent.x + pw;
        y1 = parent.y + ph / 2;
        x2 = node.x;
        y2 = node.y + ch / 2;
      } else {
        x1 = parent.x;
        y1 = parent.y + ph / 2;
        x2 = node.x + cw;
        y2 = node.y + ch / 2;
      }

      const dx = Math.max(80, Math.abs(x2 - x1) * 0.4);
      const cp1x = x1 + (node.x > parent.x ? dx : -dx);
      const cp1y = y1;
      const cp2x = x2 + (node.x > parent.x ? -dx : dx);
      const cp2y = y2;
      
      const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', node.color);
      
      let level = 1;
      let curr = node;
      while (curr.parent && state.nodes[curr.parent]) {
        level++;
        curr = state.nodes[curr.parent];
      }
      
      let strokeWidth = 5;
      if (level === 2) strokeWidth = 3.5;
      else if (level === 3) strokeWidth = 2.2;
      else if (level >= 4) strokeWidth = 1.4;
      
      path.setAttribute('stroke-width', strokeWidth);
      svgEl.appendChild(path);
    }
  });
}

function setupNodeEvents(nodeEl, nodeId) {
  nodeEl.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (state.isEditing) return;

    selectNode(nodeId);
    draggedNodeId = nodeId;
    const node = state.nodes[nodeId];
    dragNodeStart.x = node.x;
    dragNodeStart.y = node.y;
    dragMouseStart.x = e.clientX;
    dragMouseStart.y = e.clientY;
    hasMovedDuringDrag = false;
    
    // Recursively cache starting positions of the node and all its descendants
    dragSubtreeStart = {};
    function collectSubtreeStart(id) {
      const n = state.nodes[id];
      if (n) {
        dragSubtreeStart[id] = { x: n.x, y: n.y };
        if (n.children) {
          n.children.forEach(collectSubtreeStart);
        }
      }
    }
    collectSubtreeStart(nodeId);
  });

  // Bind mouse down drag to resize handle
  const handleEl = nodeEl.querySelector('.node-resize-handle');
  if (handleEl) {
    handleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (state.isEditing) return;
      
      selectNode(nodeId);
      isResizingNodeId = nodeId;
      const contentEl = nodeEl.querySelector('.node-content');
      resizeStartWidth = contentEl.offsetWidth;
      resizeMouseStartX = e.clientX;
    });
  }

  nodeEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditingNode(nodeId);
  });
}

function selectNode(nodeId) {
  if (state.selectedNodeId === nodeId) return;
  if (state.selectedNodeId) {
    const oldSel = document.getElementById(state.selectedNodeId);
    if (oldSel) oldSel.classList.remove('selected');
  }
  state.selectedNodeId = nodeId;
  if (nodeId) {
    const newSel = document.getElementById(nodeId);
    if (newSel) newSel.classList.add('selected');
  }
  positionToolbar();
}

// --- Text Inline Editing ---

function startEditingNode(nodeId) {
  if (state.isEditing) return;
  const nodeEl = document.getElementById(nodeId);
  if (!nodeEl) return;
  
  state.isEditing = true;
  const contentEl = nodeEl.querySelector('.node-content');
  const oldText = state.nodes[nodeId].text;
  
  document.getElementById('node-toolbar').classList.add('hide');
  contentEl.innerHTML = '';
  const textarea = document.createElement('textarea');
  textarea.className = 'node-textarea';
  textarea.value = oldText;
  contentEl.appendChild(textarea);
  
  function resizeTextarea() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
  
  textarea.addEventListener('input', resizeTextarea);
  textarea.focus();
  textarea.select();
  resizeTextarea();
  
  function finishEditing(isCancel = false) {
    if (!state.isEditing) return;
    state.isEditing = false;
    
    const newText = isCancel ? oldText : textarea.value.trim();
    contentEl.innerHTML = '';
    contentEl.textContent = newText || 'Branch';
    
    if (!isCancel && newText !== oldText) {
      updateNodeText(nodeId, newText || 'Branch');
    } else {
      renderAll();
    }
  }

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      finishEditing();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finishEditing(true);
    }
  });

  textarea.addEventListener('blur', () => {
    finishEditing();
  });
}

function positionToolbar() {
  const toolbar = document.getElementById('node-toolbar');
  if (!state.selectedNodeId || state.isEditing || state.currentView === 'dashboard') {
    toolbar.classList.add('hide');
    document.getElementById('palette-dropdown').classList.add('hide');
    return;
  }
  
  const node = state.nodes[state.selectedNodeId];
  const nodeEl = document.getElementById(state.selectedNodeId);
  if (!node || !nodeEl) {
    toolbar.classList.add('hide');
    return;
  }
  
  if (state.selectedNodeId === state.rootId) {
    document.getElementById('toolbar-delete').style.display = 'none';
  } else {
    document.getElementById('toolbar-delete').style.display = 'inline-flex';
  }

  const pw = nodeEl.offsetWidth;
  const screenX = (node.x + pw / 2) * state.zoom + panX;
  const screenY = node.y * state.zoom + panY;
  
  toolbar.style.left = screenX + 'px';
  toolbar.style.top = screenY + 'px';
  toolbar.classList.remove('hide');
}

// --- Keyboard Events ---

function setupKeyboardEvents() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // Ctrl + S -> Prevent default browser save page and show reminder toast
    if (e.ctrlKey && key === 's') {
      e.preventDefault();
      if (state.currentView === 'editor') {
        showAutosaveReminder();
      }
      return;
    }

    if (state.isEditing) return;
    
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    
    // Tab -> Add Child Node
    if (e.key === 'Tab') {
      e.preventDefault();
      if (state.selectedNodeId && state.currentView === 'editor') {
        addNode(state.selectedNodeId);
      }
    }
    
    // Enter -> Add Sibling Node
    if (e.key === 'Enter') {
      e.preventDefault();
      if (state.selectedNodeId && state.currentView === 'editor') {
        addSiblingNode(state.selectedNodeId);
      }
    }
    
    // F2 or Space -> Edit Node Text
    if (e.key === 'F2' || e.key === ' ') {
      e.preventDefault();
      if (state.selectedNodeId && state.currentView === 'editor') {
        startEditingNode(state.selectedNodeId);
      }
    }
    
    // Delete or Backspace -> Delete Node
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedNodeId && state.currentView === 'editor') {
        deleteNode(state.selectedNodeId);
      }
    }
    
    // Escape -> Deselect / Close Modals
    if (e.key === 'Escape') {
      if (state.activeModalActionId) {
        hideModals();
      } else {
        selectNode(null);
      }
    }
    
    // Undo / Redo
    if (e.ctrlKey && key === 'z') {
      e.preventDefault();
      if (state.currentView === 'editor') undo();
    }
    if (e.ctrlKey && key === 'y') {
      e.preventDefault();
      if (state.currentView === 'editor') redo();
    }
    
    // Auto-Arrange Layout (Alt+L)
    if (e.altKey && key === 'l') {
      e.preventDefault();
      if (state.currentView === 'editor') {
        layoutTree();
      }
    }
  });
}

function showAutosaveReminder() {
  if (document.getElementById('autosave-reminder-toast')) return;
  
  const toast = document.createElement('div');
  toast.id = 'autosave-reminder-toast';
  toast.className = 'glass-ui toast-notification';
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">🛡️</span>
      <span class="toast-text">Relax, we got you! AetherMind auto-saves on every breath 🧘‍♀️💨. Your mindmap is already safe and sound! 🛡️✨</span>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Transition slide down
  setTimeout(() => {
    toast.classList.add('show');
  }, 50);
  
  // Transition slide up and remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3500);
}

// --- UI Actions & Event Listeners ---

function setupUIEvents() {
  // Home/Dashboard Toggle Button
  document.getElementById('btn-home-toggle').addEventListener('click', showDashboard);

  // Undo & Redo buttons
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Zoom buttons
  document.getElementById('btn-zoom-in').addEventListener('click', () => zoom(1.2));
  document.getElementById('btn-zoom-out').addEventListener('click', () => zoom(1 / 1.2));
  document.getElementById('btn-zoom-reset').addEventListener('click', () => {
    centerViewOnRoot();
    renderAll();
  });
  
  // Auto-Arrange button
  document.getElementById('btn-layout').addEventListener('click', () => {
    if (state.currentView === 'editor') {
      layoutTree();
    }
  });

  // Dark/Light theme toggle
  document.getElementById('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
    saveThemePreference();
  });

  const savedTheme = localStorage.getItem('aethermind_theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  }

  // Floating Help Panel
  const helpPanel = document.getElementById('help-panel');
  document.getElementById('btn-help-trigger').addEventListener('click', () => {
    helpPanel.classList.toggle('hide');
  });
  document.getElementById('btn-help-close').addEventListener('click', () => {
    helpPanel.classList.add('hide');
  });

  // Editor toolbar events
  document.getElementById('toolbar-add-child').addEventListener('click', () => {
    if (state.selectedNodeId) addNode(state.selectedNodeId);
  });

  const paletteBtn = document.getElementById('toolbar-color');
  const paletteDropdown = document.getElementById('palette-dropdown');
  paletteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    paletteDropdown.classList.toggle('hide');
  });

  window.addEventListener('click', () => {
    paletteDropdown.classList.add('hide');
  });

  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(sw => {
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = sw.getAttribute('data-color');
      if (state.selectedNodeId && color) {
        changeNodeColor(state.selectedNodeId, color);
      }
      paletteDropdown.classList.add('hide');
    });
  });

  document.getElementById('toolbar-delete').addEventListener('click', () => {
    if (state.selectedNodeId) deleteNode(state.selectedNodeId);
  });

  // --- Local File Operations (Editor Header Toolbar Reorganization) ---

  // Import JSON Map file
  const fileInput = document.getElementById('file-input');
  document.getElementById('btn-header-import').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importJsonToActive(file);
      fileInput.value = '';
    }
  });

  // Export dropdown click toggler
  const exportTrigger = document.getElementById('btn-header-export-trigger');
  const exportDropdown = document.getElementById('export-dropdown');

  exportTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('hide');
  });

  // Auto-hide dropdown on clicking anywhere else
  window.addEventListener('click', () => {
    exportDropdown.classList.add('hide');
  });

  // Export actions bindings
  document.getElementById('btn-export-json-menu').addEventListener('click', () => {
    downloadDiagramJson(state.activeDiagramId);
  });

  document.getElementById('btn-export-png-menu').addEventListener('click', () => {
    exportToPng();
  });

  document.getElementById('btn-export-svg-menu').addEventListener('click', () => {
    exportToSvg();
  });

  document.getElementById('btn-export-pdf-menu').addEventListener('click', () => {
    exportToPdf();
  });

  // Reset Canvas Menu Option
  document.getElementById('btn-clear-menu').addEventListener('click', () => {
    if (confirm("Reset current mindmap canvas? This erases all branches.")) {
      const diag = state.diagrams.find(d => d.id === state.activeDiagramId);
      const rootId = 'root_' + Math.random().toString(36).substr(2, 9);
      
      state.nodes = {};
      state.rootId = rootId;
      state.nodes[rootId] = {
        id: rootId,
        text: diag ? diag.title : 'Central Idea',
        x: INITIAL_COORDINATE,
        y: INITIAL_COORDINATE,
        color: '#6366f1',
        parent: null,
        children: []
      };

      state.selectedNodeId = null;
      saveHistory();
      renderAll();
      centerViewOnRoot();
    }
  });

  // --- Dashboard Controls and Actions ---

  // Search input
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderDiagramsGrid();
  });

  // Create Diagram Button
  document.getElementById('btn-create-diagram').addEventListener('click', () => {
    createNewDiagram();
  });

  // Add Folder Button
  document.getElementById('btn-add-folder').addEventListener('click', () => {
    showModal('modal-folder');
  });

  // Import Diagram Button (Dashboard)
  const dbFileInput = document.getElementById('dashboard-file-input');
  document.getElementById('btn-dashboard-import').addEventListener('click', () => {
    dbFileInput.click();
  });

  dbFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importJsonToDashboard(file);
      dbFileInput.value = '';
    }
  });

  // --- Modals Dialog Event Submits ---

  // 1. Folder Modal
  document.getElementById('btn-folder-cancel').addEventListener('click', hideModals);
  document.getElementById('btn-folder-submit').addEventListener('click', () => {
    const name = document.getElementById('input-folder-name').value;
    createFolder(name);
    hideModals();
  });

  // 2. Rename Modal
  document.getElementById('btn-rename-cancel').addEventListener('click', hideModals);
  document.getElementById('btn-rename-submit').addEventListener('click', () => {
    const title = document.getElementById('input-rename-title').value;
    renameDiagram(state.activeModalActionId, title);
    hideModals();
  });

  // 3. Move Modal
  document.getElementById('btn-move-cancel').addEventListener('click', hideModals);
  document.getElementById('btn-move-submit').addEventListener('click', () => {
    const folderId = document.getElementById('select-move-folder').value;
    moveDiagramFolder(state.activeModalActionId, folderId);
    hideModals();
  });

  // Hide modals on background click
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) hideModals();
    });
  });
}

function saveThemePreference() {
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('aethermind_theme', isLight ? 'light' : 'dark');
}

function setupWindowResize() {
  window.addEventListener('resize', () => {
    positionToolbar();
  });
}

// --- Import Helpers ---

function importJsonToActive(file) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const importedData = JSON.parse(evt.target.result);
      let possibleRoots = [];
      let nodes = {};
      
      // Support raw nodes dictionary import or diagram data object wrapper import
      if (importedData.nodes) {
        nodes = importedData.nodes;
        possibleRoots = Object.values(nodes).filter(n => n.parent === null);
      } else {
        nodes = importedData;
        possibleRoots = Object.values(nodes).filter(n => n.parent === null);
      }
      
      if (possibleRoots.length > 0) {
        state.nodes = nodes;
        state.rootId = possibleRoots[0].id;
        state.selectedNodeId = null;
        
        saveHistory();
        renderAll();
        centerViewOnRoot();
      } else {
        alert("Invalid file format. Root node not found.");
      }
    } catch (err) {
      alert("Failed to parse JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function importJsonToDashboard(file) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const importedData = JSON.parse(evt.target.result);
      let nodes = {};
      let rootId = null;
      
      if (importedData.nodes && importedData.rootId) {
        nodes = importedData.nodes;
        rootId = importedData.rootId;
      } else {
        nodes = importedData;
        const roots = Object.values(nodes).filter(n => n.parent === null);
        if (roots.length > 0) rootId = roots[0].id;
      }
      
      if (rootId && nodes[rootId]) {
        const diagId = 'diag_' + Math.random().toString(36).substr(2, 9);
        
        // Save diagram contents
        localStorage.setItem(DATA_PREFIX + diagId, JSON.stringify({
          rootId: rootId,
          nodes: nodes
        }));

        // Add to dashboard index
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        const newDiag = {
          id: diagId,
          title: title,
          folderId: (state.currentFolderId !== 'all' && state.currentFolderId !== 'uncategorized') ? state.currentFolderId : null,
          lastModified: new Date().toISOString(),
          nodeCount: Object.keys(nodes).length
        };
        
        state.diagrams.unshift(newDiag);
        saveIndexToStorage();
        renderDashboard();
        alert(`Successfully imported "${newDiag.title}"!`);
      } else {
        alert("Could not load diagram. Empty nodes map.");
      }
    } catch (err) {
      alert("Failed to parse JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
}

// --- Render Standalone SVG / PNG / PDF Export Pipelines ---

function calculateBoundingBox() {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  Object.values(state.nodes).forEach(node => {
    const nodeEl = document.getElementById(node.id);
    const nw = nodeEl ? nodeEl.offsetWidth : 150;
    const nh = nodeEl ? nodeEl.offsetHeight : 40;
    
    if (node.x < minX) minX = node.x;
    if (node.x + nw > maxX) maxX = node.x + nw;
    if (node.y < minY) minY = node.y;
    if (node.y + nh > maxY) maxY = node.y + nh;
  });

  if (minX === Infinity) {
    minX = INITIAL_COORDINATE - 200;
    maxX = INITIAL_COORDINATE + 200;
    minY = INITIAL_COORDINATE - 200;
    maxY = INITIAL_COORDINATE + 200;
  }

  const padding = 100;
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + (padding * 2),
    height: (maxY - minY) + (padding * 2)
  };
}

function generateSvgString() {
  const bbox = calculateBoundingBox();
  const isLight = document.body.classList.contains('light-theme');
  
  const bgColor = isLight ? '#f8fafc' : '#0f1115';
  const textColor = isLight ? '#0f172a' : '#f3f4f6';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)';
  
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}" width="${bbox.width}" height="${bbox.height}">`;
  
  svgContent += `
    <defs>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Outfit:wght@600;700;800&amp;display=swap');
        .node-text {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          fill: ${textColor};
          line-height: 1.4;
        }
        .root-text {
          font-family: 'Outfit', sans-serif;
          font-size: 18px;
          font-weight: 700;
          fill: ${textColor};
        }
        .connection-line {
          fill: none;
          stroke-linecap: round;
        }
        .node-box {
          fill: ${isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(22, 26, 33, 0.9)'};
          stroke-width: 2px;
        }
      </style>
      <filter id="svg-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  `;

  svgContent += `<rect x="${bbox.x}" y="${bbox.y}" width="${bbox.width}" height="${bbox.height}" fill="${bgColor}" />`;
  
  for (let gx = Math.floor(bbox.x / 24) * 24; gx < bbox.x + bbox.width; gx += 24) {
    for (let gy = Math.floor(bbox.y / 24) * 24; gy < bbox.y + bbox.height; gy += 24) {
      svgContent += `<circle cx="${gx}" cy="${gy}" r="1" fill="${gridColor}" />`;
    }
  }

  Object.values(state.nodes).forEach(node => {
    if (node.parent && state.nodes[node.parent]) {
      const parent = state.nodes[node.parent];
      const parentEl = document.getElementById(parent.id);
      const childEl = document.getElementById(node.id);
      
      let pw = parentEl ? parentEl.offsetWidth : 120;
      let ph = parentEl ? parentEl.offsetHeight : 30;
      let cw = childEl ? childEl.offsetWidth : 120;
      let ch = childEl ? childEl.offsetHeight : 30;

      let x1, y1, x2, y2;
      if (node.x > parent.x) {
        x1 = parent.x + pw;
        y1 = parent.y + ph / 2;
        x2 = node.x;
        y2 = node.y + ch / 2;
      } else {
        x1 = parent.x;
        y1 = parent.y + ph / 2;
        x2 = node.x + cw;
        y2 = node.y + ch / 2;
      }

      const dx = Math.max(80, Math.abs(x2 - x1) * 0.4);
      const cp1x = x1 + (node.x > parent.x ? dx : -dx);
      const cp1y = y1;
      const cp2x = x2 + (node.x > parent.x ? -dx : dx);
      const cp2y = y2;
      
      let level = 1;
      let curr = node;
      while (curr.parent && state.nodes[curr.parent]) {
        level++;
        curr = state.nodes[curr.parent];
      }
      
      let strokeWidth = 5;
      if (level === 2) strokeWidth = 3.5;
      else if (level === 3) strokeWidth = 2.2;
      else if (level >= 4) strokeWidth = 1.4;

      svgContent += `<path class="connection-line" d="M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}" stroke="${node.color}" stroke-width="${strokeWidth}" />`;
    }
  });

  Object.values(state.nodes).forEach(node => {
    const nodeEl = document.getElementById(node.id);
    const nw = nodeEl ? nodeEl.offsetWidth : 150;
    const nh = nodeEl ? nodeEl.offsetHeight : 45;
    
    if (node.id === state.rootId) {
      svgContent += `
        <g transform="translate(${node.x}, ${node.y})">
          <rect x="0" y="0" width="${nw}" height="${nh}" rx="12" ry="12" class="node-box" stroke="${node.color}" />
          <text x="${nw/2}" y="${nh/2 + 6}" text-anchor="middle" class="root-text">${escapeSvgXml(node.text)}</text>
        </g>
      `;
    } else {
      svgContent += `
        <g transform="translate(${node.x}, ${node.y})">
          <line x1="0" y1="${nh - 2}" x2="${nw}" y2="${nh - 2}" stroke="${node.color}" stroke-width="3" />
          <text x="12" y="${nh/2 + 4}" class="node-text">${escapeSvgXml(node.text)}</text>
        </g>
      `;
    }
  });

  svgContent += '</svg>';
  return svgContent;
}

function escapeSvgXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function exportToSvg() {
  const svgStr = generateSvgString();
  const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  
  const indexItem = state.diagrams.find(d => d.id === state.activeDiagramId);
  const safeFilename = indexItem ? indexItem.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'mindmap';
  
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `mindmap_${safeFilename}.svg`);
  
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function exportToPng() {
  const svgStr = generateSvgString();
  const bbox = calculateBoundingBox();
  
  const canvas = document.createElement('canvas');
  canvas.width = bbox.width;
  canvas.height = bbox.height;
  const ctx = canvas.getContext('2d');
  
  const img = new Image();
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  img.onload = function() {
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    
    try {
      const imgUri = canvas.toDataURL('image/png');
      const indexItem = state.diagrams.find(d => d.id === state.activeDiagramId);
      const safeFilename = indexItem ? indexItem.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'mindmap';
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", imgUri);
      downloadAnchor.setAttribute("download", `mindmap_${safeFilename}.png`);
      
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("Browser blocked image download: " + err.message);
    }
  };
  
  img.src = url;
}

// Vector PDF Print Scaling Pipeline (via isolated hidden iframe)
function exportToPdf() {
  const svgStr = generateSvgString();
  const indexItem = state.diagrams.find(d => d.id === state.activeDiagramId);
  const title = indexItem ? indexItem.title : 'Mindmap';

  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>
        @page {
          margin: 15mm;
          size: landscape; /* Default to landscape for wide mindmaps */
        }
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #ffffff;
        }
        svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
    </head>
    <body>
      ${svgStr}
      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
            // Clean up the iframe after the print dialog is closed
            window.frameElement.remove();
          }, 350);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();
}

// --- Sample Showcase Diagram Generator ---
function createSampleShowcaseDiagram() {
  const existing = state.diagrams.find(d => (d.title || '').includes('Welcome to AetherMind') || (d.title || '').includes('Feature Tour'));
  if (existing) {
    openDiagram(existing.id);
    return;
  }

  const diagId = 'diag_sample_showcase_' + Date.now();
  const rootId = 'root_showcase_' + Date.now();
  const nodes = generateSampleShowcaseNodes(rootId);

  localStorage.setItem(DATA_PREFIX + diagId, JSON.stringify({
    rootId: rootId,
    nodes: nodes
  }));

  const sampleDiag = {
    id: diagId,
    title: '✨ AetherMind Feature Tour',
    folderId: null,
    lastModified: new Date().toISOString(),
    nodeCount: Object.keys(nodes).length
  };

  state.diagrams.unshift(sampleDiag);
  saveIndexToStorage();

  openDiagram(diagId);
  setTimeout(() => {
    layoutTree();
    centerViewOnRoot();
  }, 100);
}

// --- Chinese Sample Showcase Diagram Generator ---
function createSampleZhShowcaseDiagram() {
  const existing = state.diagrams.find(d => (d.title || '').includes('欢迎使用 AetherMind') || (d.title || '').includes('功能展示'));
  if (existing) {
    openDiagram(existing.id);
    return;
  }

  const diagId = 'diag_sample_zh_showcase_' + Date.now();
  const rootId = 'root_zh_showcase_' + Date.now();
  const nodes = generateSampleZhShowcaseNodes(rootId);

  localStorage.setItem(DATA_PREFIX + diagId, JSON.stringify({
    rootId: rootId,
    nodes: nodes
  }));

  const sampleDiag = {
    id: diagId,
    title: '🇨🇳 AetherMind 功能展示导图',
    folderId: null,
    lastModified: new Date().toISOString(),
    nodeCount: Object.keys(nodes).length
  };

  state.diagrams.unshift(sampleDiag);
  saveIndexToStorage();

  openDiagram(diagId);
  setTimeout(() => {
    layoutTree();
    centerViewOnRoot();
  }, 100);
}

// Bind Sample Diagram button listeners on DOM content loaded
window.addEventListener('DOMContentLoaded', () => {
  const btnSample = document.getElementById('btn-sample-diagram');
  if (btnSample) {
    btnSample.addEventListener('click', createSampleShowcaseDiagram);
  }
  const btnSampleZh = document.getElementById('btn-sample-zh-diagram');
  if (btnSampleZh) {
    btnSampleZh.addEventListener('click', createSampleZhShowcaseDiagram);
  }
});


