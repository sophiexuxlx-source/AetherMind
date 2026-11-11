# AetherMind - User Manual & Guide

AetherMind is a premium, local-first, Coggle-like mindmapping application that runs completely offline on your computer. It features folder-based categorization, interactive Bezier curve branches, dynamic color customization, undo/redo history, and high-quality local saving and exports (JSON, PNG, SVG, and PDF).

---

## 🚀 Getting Started

AetherMind requires zero installation, zero build steps, and no server configuration:

1. **Extract the Project**: Unzip `AetherMind` to any folder on your computer.
2. **Launch**: Double-click **`index.html`** to run the app immediately in Chrome, Edge, Safari, or Firefox.
3. *(Optional)* If you prefer running through a local developer server, run `python -m http.server 8000` or `npx serve` in the directory, then visit `http://localhost:8000`.

---

## 🗂️ The Home Dashboard

When you launch AetherMind, you start at the **Home Dashboard**, which serves as your central diagram manager.

### 1. Sidebar Folders
On the left side of the screen is your **FOLDERS** panel, which allows you to organize your mindmaps into custom categories.
* **Filter by Folder**: Click any folder name in the sidebar to show only the mindmaps stored in that folder.
* **All Diagrams**: Click this to view all your mindmaps in a single grid.
* **Uncategorized**: Click this to view diagrams that have not been assigned to a folder.
* **Create Folder**: Click the **"+ New Folder"** button at the bottom of the sidebar, type a name, and press **Create**.
* **Delete Folder**: Hover over a folder on the sidebar and click the `X` icon. Deleting a folder does *not* delete your mindmaps; they are simply moved to **Uncategorized**.

### 2. Diagram Grid & Search
The main area of the dashboard displays your mindmaps as interactive cards:
* **Search**: Use the search box at the top left to filter mindmaps by title in real-time.
* **New Mindmap**: Click the green **"New Mindmap"** button to create a fresh mindmap and jump straight into the editor.
* **Open a Map**: Click anywhere on a diagram card to open it in the editor.

### 3. Diagram Card Actions
Hovering over a diagram card reveals five action icons in the top-right corner:
1. **📁 Move to Folder**: Assign the diagram to a specific folder.
2. **✏️ Rename**: Open a dialog to rename your diagram.
3. **📄 Clone (Copy)**: Duplicate the diagram, creating an identical copy named `[Title] (Copy)`.
4. **📥 Download JSON**: Save a backup of the diagram directly to your local hard drive.
5. **🗑️ Delete**: Permanently delete the mindmap from your local browser database.

---

## 🎨 The Mindmap Editor

Inside the editor, you can build, arrange, and style your mindmaps.

### 1. Navigating the Canvas
* **Pan**: Click and drag on the empty grid background to move around the infinite canvas.
* **Zoom**: Roll your mouse wheel over the canvas. Zooming automatically centers on your mouse cursor.
* **Recenter**: Click the **"Center View"** button in the header bar to reset zoom to 100% and center on the root node.
* **Auto-Arrange Layout**: Click the **"Auto-Arrange"** button in the header (or press **`Alt` + `L`**) to automatically align, clean up, and balance all branches symmetrically, preventing overlaps. You can press **`Ctrl` + `Z`** to instantly undo this layout change if needed!

### 2. Creating and Editing Branches
AetherMind is built for rapid, keyboard-driven mindmapping:
* **Add a Child Branch**: Select a node, then press **`Tab`** (or click the `+` button in the floating toolbar). A new branch will slide out, automatically focused in edit mode.
* **Add a Sibling Branch**: Select a node, then press **`Enter`**. This creates a new node attached to the same parent.
* **Edit Node Text**: Double-click any node (or select it and press **`Space`** or **`F2`**). Type your text and press **`Ctrl + Enter`** to save (or click outside the node). Press **`Enter`** alone to insert a new line. Press **`Escape`** to cancel.
* **Adjust Node Width (Resize)**: Hover over any node or select it to reveal a subtle vertical handle on its right edge. Click and drag this handle left or right to adjust the node's width. This allows you to fit long text on a single line or control exactly how your text wraps!
* **Delete a Node**: Select a node and press **`Delete`** or **`Backspace`** (or click the trash icon on the floating toolbar). Deleting a node recursively deletes all of its children.

### 3. Branch Coloring
* Select a node and click the **🎨 color picker** icon in the floating toolbar.
* Select a color from the palette.
* The chosen color will style the node's underline and connection curve, and will **automatically cascade down** to all child branches unless they are overridden individually.

---

## 💾 Saving & Exporting

### 1. Auto-Save (Continuous Safety)
Every single change you make is instantly saved to your browser's local database (`localStorage`). If you accidentally refresh, close the tab, or shut down your computer, your diagrams will be fully restored when you re-open the app.

### 2. Save Map (.json)
To back up your work or share it with others:
* Click **"Save Map (.json)"** in the left sidebar. This downloads a `.json` text file containing your nodes, positions, and branch colors.
* To load a saved file, click **"Load Map (.json)"** or simply **drag-and-drop** the `.json` file from your desktop directly onto the editor grid.
* You can also use **"Import Diagram"** on the home dashboard to add files directly to your gallery.

### 3. Image Exports (PNG & SVG)
* Click **"PNG"** to download a standard image file of your mindmap, perfect for slides, documents, or sharing.
* Click **"SVG"** to download a vector image. SVGs are scalable without losing quality, making them ideal for high-definition print layouts.

### 4. PDF Vector Document Export
* Click the **"PDF"** button in the editor panel.
* A print preview window will pop up. AetherMind automatically hides all sidebars, headers, and UI controls, centering and scaling the mindmap to fit the page.
* Select **"Save as PDF"** as the Destination and choose **Save** to generate a vector-quality, print-ready PDF!

---

## 🛠️ Offline Safety & Privacy

* **100% Local-First**: All diagram editing, processing, and data storage execute entirely inside your local browser. Mindmaps are saved securely in your browser's private database (`localStorage`) and never leave your machine.
* **Complete Privacy**: AetherMind contains zero telemetry, no tracking scripts, no cloud database, and requires no account. Clean typography automatically falls back to your OS system fonts when working completely offline.
* **Self-Healing Recovery**: If a diagram index ever loses its data due to an import interruption, the app automatically repairs it and creates a default root node to prevent crashing.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE). Feel free to use, customize, and share it!
