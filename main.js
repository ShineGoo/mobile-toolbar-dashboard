const {Plugin: Plugin, PluginSettingTab: PluginSettingTab, Setting: Setting, Modal: Modal, Notice: Notice, Platform: Platform, setIcon: setIcon, getIconIds: getIconIds, normalizePath: normalizePath} = require("obsidian");

const SCHEMA_VERSION = 5;

const STABLE_DEFAULTS = Object.freeze({
    layout: {
        mode: "vertical",
        verticalColumns: 2,
        verticalVisibleRows: 8,
        horizontalRows: 2,
        horizontalWidthMode: "editor",
        horizontalManualWidth: 560,
        buttonWidth: 42,
        buttonHeight: 42,
        iconSize: 23,
        rowGap: 4,
        columnGap: 4,
        panelPadding: 6
    },
    appearance: {
        panelOpacity: .86,
        borderRadius: 24,
        shadow: "medium",
        iconOpacity: 1,
        handleSize: 46,
        handleOpacity: .92,
        animation: "fast",
        scrollbar: "hidden"
    },
    behavior: {
        autoCollapse: "never",
        clickOutsideCollapse: false,
        keepOpenAfterCommand: true,
        rememberExpanded: true
    },
    position: {
        sideMode: "auto",
        side: "right",
        y: 180,
        edgeOffset: 8,
        topSafe: 84,
        bottomSafe: 16,
        rememberSide: true,
        rememberY: true
    },
    gesture: {
        handleLongPressMs: 350,
        commandLongPressMs: 600,
        tooltipDurationMs: 2200,
        haptic: "longpress"
    },
    backup: {
        directory: "MobileCommandCenter/backup"
    }
});

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function clamp(n, min, max) {
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
}

const NUMBER_RANGES = {
    layout: {
        verticalColumns: [ 1, 5 ],
        verticalVisibleRows: [ 3, 15 ],
        horizontalRows: [ 1, 5 ],
        horizontalManualWidth: [ 240, 900 ],
        buttonWidth: [ 30, 60 ],
        buttonHeight: [ 30, 60 ],
        iconSize: [ 16, 36 ],
        rowGap: [ 0, 16 ],
        columnGap: [ 0, 16 ],
        panelPadding: [ 0, 20 ]
    },
    appearance: {
        panelOpacity: [ .5, 1 ],
        borderRadius: [ 0, 32 ],
        iconOpacity: [ .5, 1 ],
        handleSize: [ 36, 64 ],
        handleOpacity: [ .4, 1 ]
    },
    position: {
        y: [ 0, 1e4 ],
        edgeOffset: [ 0, 30 ],
        topSafe: [ 84, 200 ],
        bottomSafe: [ 16, 160 ]
    },
    gesture: {
        handleLongPressMs: [ 250, 900 ],
        commandLongPressMs: [ 300, 1200 ],
        tooltipDurationMs: [ 500, 5e3 ]
    }
};

const ENUMS = {
    layout: {
        mode: [ "vertical", "horizontal" ],
        horizontalWidthMode: [ "editor", "screen", "manual" ]
    },
    appearance: {
        shadow: [ "off", "weak", "medium", "strong" ],
        animation: [ "off", "fast", "normal" ],
        scrollbar: [ "hidden", "auto", "always" ]
    },
    behavior: {
        autoCollapse: [ "never", "input", "after-command", "blur", "smart" ]
    },
    position: {
        sideMode: [ "auto", "left", "right" ],
        side: [ "left", "right" ]
    },
    gesture: {
        haptic: [ "off", "longpress", "all" ]
    }
};

function sanitizeSettings(raw) {
    const out = deepClone(STABLE_DEFAULTS);
    for (const [group, defaults] of Object.entries(STABLE_DEFAULTS)) {
        const source = raw?.[group];
        if (!source || typeof source !== "object" || Array.isArray(source)) continue;
        for (const [key, fallback] of Object.entries(defaults)) {
            const value = source[key], range = NUMBER_RANGES[group]?.[key], choices = ENUMS[group]?.[key];
            if (range) {
                if (typeof value === "number" && Number.isFinite(value)) out[group][key] = clamp(value, ...range);
            } else if (choices) {
                if (choices.includes(value)) out[group][key] = value;
            } else if (typeof value === typeof fallback) out[group][key] = value;
        }
    }
    for (const key of [ "verticalColumns", "verticalVisibleRows", "horizontalRows" ]) out.layout[key] = Math.round(out.layout[key]);
    return out;
}

function stamp(d = new Date) {
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

class CommandPickerModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.filter = "";
    }
    onOpen() {
        this.titleEl.setText("Add command");
        const {contentEl: contentEl} = this;
        contentEl.empty();
        contentEl.addClass("mtd-settings-modal");
        const search = contentEl.createEl("input", {
            cls: "mtd-picker-search",
            attr: {
                type: "search",
                placeholder: "Search command names or IDs..."
            }
        });
        const list = contentEl.createDiv("mtd-picker-list");
        const render = () => {
            list.empty();
            const existing = new Set(this.plugin.data.toolbar.commandIds || []);
            const commands = Object.values(this.app.commands?.commands || {}).filter(Boolean).filter(cmd => !existing.has(cmd.id)).filter(cmd => {
                const q = this.filter.trim().toLowerCase();
                if (!q) return true;
                return `${cmd.name || ""} ${cmd.id || ""}`.toLowerCase().includes(q);
            }).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, "en"));
            if (!commands.length) {
                list.createDiv({
                    cls: "mtd-picker-empty",
                    text: "No matching commands available to add."
                });
                return;
            }
            for (const cmd of commands.slice(0, 300)) {
                const row = list.createEl("button", {
                    cls: "mtd-picker-row"
                });
                const icon = row.createSpan("mtd-picker-row-icon");
                try {
                    if (cmd.icon) setIcon(icon, cmd.icon); else icon.setText("•");
                } catch (_) {
                    icon.setText("•");
                }
                const text = row.createDiv("mtd-picker-row-text");
                text.createDiv({
                    cls: "mtd-picker-row-name",
                    text: cmd.name || cmd.id
                });
                text.createDiv({
                    cls: "mtd-picker-row-id",
                    text: cmd.id
                });
                row.addEventListener("click", async () => {
                    this.plugin.data.toolbar.commandIds.push(cmd.id);
                    await this.plugin.savePluginData();
                    this.plugin.renderCommands();
                    this.plugin.refreshSettings();
                    new Notice(`Added: ${cmd.name || cmd.id}`);
                    this.close();
                });
            }
        };
        search.addEventListener("input", () => {
            this.filter = search.value || "";
            render();
        });
        render();
        setTimeout(() => search.focus(), 50);
    }
}

class IconPickerModal extends Modal {
    constructor(app, plugin, commandId) {
        super(app);
        this.plugin = plugin;
        this.commandId = commandId;
        this.filter = "";
    }
    onOpen() {
        this.titleEl.setText("Choose icon");
        const {contentEl: contentEl} = this;
        contentEl.empty();
        contentEl.addClass("mtd-settings-modal");
        const actions = contentEl.createDiv("mtd-icon-actions");
        const reset = actions.createEl("button", {
            text: "Restore default command icon"
        });
        reset.addEventListener("click", async () => {
            delete this.plugin.data.icons[this.commandId];
            await this.plugin.savePluginData();
            this.plugin.renderCommands();
            this.plugin.refreshSettings();
            this.close();
        });
        const search = contentEl.createEl("input", {
            cls: "mtd-picker-search",
            attr: {
                type: "search",
                placeholder: "Search Lucide icons, such as calendar or link..."
            }
        });
        const grid = contentEl.createDiv("mtd-icon-grid");
        const ids = (() => {
            try {
                return getIconIds();
            } catch (_) {
                return [];
            }
        })();
        const render = () => {
            grid.empty();
            const q = this.filter.trim().toLowerCase();
            const filtered = ids.filter(id => !q || id.toLowerCase().includes(q)).slice(0, 240);
            if (!filtered.length) {
                grid.createDiv({
                    cls: "mtd-picker-empty",
                    text: "No matching icons."
                });
                return;
            }
            for (const iconId of filtered) {
                const b = grid.createEl("button", {
                    cls: "mtd-icon-choice",
                    attr: {
                        "aria-label": iconId,
                        title: iconId
                    }
                });
                try {
                    setIcon(b, iconId);
                } catch (_) {
                    b.setText("•");
                }
                b.addEventListener("click", async () => {
                    this.plugin.data.icons[this.commandId] = iconId;
                    await this.plugin.savePluginData();
                    this.plugin.renderCommands();
                    this.plugin.refreshSettings();
                    this.close();
                });
            }
        };
        search.addEventListener("input", () => {
            this.filter = search.value || "";
            render();
        });
        render();
        setTimeout(() => search.focus(), 50);
    }
}

class BackupPickerModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    async onOpen() {
        this.titleEl.setText("Import configuration");
        const {contentEl: contentEl} = this;
        contentEl.empty();
        contentEl.addClass("mtd-settings-modal");
        contentEl.createEl("p", {
            text: "Select a backup file. A pre-import backup will be created first."
        });
        const dir = normalizePath(this.plugin.data.settings.backup.directory || STABLE_DEFAULTS.backup.directory);
        let files = [];
        try {
            if (await this.app.vault.adapter.exists(dir)) {
                const result = await this.app.vault.adapter.list(dir);
                files = (result.files || []).filter(f => f.toLowerCase().endsWith(".json")).sort().reverse();
            }
        } catch (e) {
            console.error("[MTD] list backups failed", e);
        }
        if (!files.length) {
            contentEl.createDiv({
                cls: "mtd-picker-empty",
                text: `No JSON backups in: ${dir}`
            });
            return;
        }
        const list = contentEl.createDiv("mtd-picker-list");
        for (const path of files) {
            const row = list.createEl("button", {
                cls: "mtd-picker-row"
            });
            const text = row.createDiv("mtd-picker-row-text");
            text.createDiv({
                cls: "mtd-picker-row-name",
                text: path.split("/").pop()
            });
            text.createDiv({
                cls: "mtd-picker-row-id",
                text: path
            });
            row.addEventListener("click", async () => {
                try {
                    await this.plugin.exportConfig("pre-import");
                    await this.plugin.importConfig(path);
                    new Notice("Configuration imported.");
                    this.close();
                } catch (e) {
                    console.error("[MTD] import failed", e);
                    new Notice(`Import failed: ${e?.message || e}`);
                }
            });
        }
    }
}

class ConfirmFactoryResetModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        this.titleEl.setText("Factory reset");
        const {contentEl: contentEl} = this;
        contentEl.empty();
        contentEl.createEl("p", {
            text: "This resets your layout, custom icons, command order, and behavior settings, then reloads the current Obsidian mobile toolbar commands."
        });
        contentEl.createEl("p", {
            text: "Export your configuration first. This action cannot be undone.",
            cls: "mtd-danger-text"
        });
        const actions = contentEl.createDiv("mtd-confirm-actions");
        const cancel = actions.createEl("button", {
            text: "Cancel"
        });
        const ok = actions.createEl("button", {
            text: "Confirm reset",
            cls: "mod-warning"
        });
        cancel.addEventListener("click", () => this.close());
        ok.addEventListener("click", async () => {
            await this.plugin.factoryReset();
            new Notice("Factory settings restored.");
            this.close();
        });
    }
}

class MobileToolbarDashboardSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let containerEl = this.containerEl;
        const page = containerEl;
        this.sectionState ||= {};
        containerEl.empty();
        containerEl.addClass("mtd-settings-page");
        containerEl.createEl("h2", {
            text: "Mobile Toolbar Dashboard"
        });
        containerEl.createEl("p", {
            cls: "mtd-settings-intro",
            text: "Expand a section to edit its settings. Changes apply immediately. Long-press the floating handle to drag it."
        });
        new Setting(page).setName("Recover floating handle").setDesc("Return the handle to a safe center-right position and collapse the panel.").addButton(b => b.setButtonText("Recover now").setCta().onClick(async () => {
            await this.plugin.resetHandlePosition(true);
        }));
        const s = this.plugin.data.settings;
        containerEl = this.section(page, "Dashboard layout");
        new Setting(containerEl).setName("Panel layout").setDesc("Use a vertical sidebar with vertical scrolling or a horizontal panel with horizontal scrolling.").addDropdown(d => d.addOption("vertical", "Vertical sidebar").addOption("horizontal", "Horizontal panel").setValue(s.layout.mode).onChange(async v => {
            s.layout.mode = v;
            await this.plugin.settingsChanged(true);
        }));
        new Setting(containerEl).setName("Vertical columns").setDesc("Buttons per row in the vertical sidebar. Default: 2 columns.").addSlider(x => x.setLimits(1, 5, 1).setDynamicTooltip().setValue(s.layout.verticalColumns).onChange(async v => {
            s.layout.verticalColumns = v;
            await this.plugin.settingsChanged(true);
        }));
        new Setting(containerEl).setName("Visible vertical rows").setDesc("Rows visible at once. Additional commands remain accessible by scrolling.").addSlider(x => x.setLimits(3, 15, 1).setDynamicTooltip().setValue(s.layout.verticalVisibleRows).onChange(async v => {
            s.layout.verticalVisibleRows = v;
            await this.plugin.settingsChanged(true);
        }));
        new Setting(containerEl).setName("Horizontal rows").setDesc("Rows in the horizontal panel. Scroll sideways for more commands.").addSlider(x => x.setLimits(1, 5, 1).setDynamicTooltip().setValue(s.layout.horizontalRows).onChange(async v => {
            s.layout.horizontalRows = v;
            await this.plugin.settingsChanged(true);
        }));
        new Setting(containerEl).setName("Horizontal panel width").setDesc("Follow the editor width, use available space, or set a manual width. Width is constrained to the viewport.").addDropdown(d => d.addOption("editor", "Follow editor").addOption("screen", "Available viewport").addOption("manual", "Manual (advanced)").setValue(s.layout.horizontalWidthMode).onChange(async v => {
            s.layout.horizontalWidthMode = v;
            await this.plugin.settingsChanged(true);
            this.display();
        }));
        if (s.layout.horizontalWidthMode === "manual") {
            new Setting(containerEl).setName("Manual panel width (advanced)").setDesc("Requested panel width. The actual width is limited to the available space.").addSlider(x => x.setLimits(240, 900, 10).setDynamicTooltip().setValue(s.layout.horizontalManualWidth).onChange(async v => {
                s.layout.horizontalManualWidth = v;
                await this.plugin.settingsChanged(true);
            }));
        }
        this.numberSlider(containerEl, "Button width", "Width of each command button.", s.layout, "buttonWidth", 30, 60, 1, " px");
        this.numberSlider(containerEl, "Button height", "Height of each command button.", s.layout, "buttonHeight", 30, 60, 1, " px");
        this.numberSlider(containerEl, "Icon size", "Icon size is independent of button size.", s.layout, "iconSize", 16, 36, 1, " px");
        this.numberSlider(containerEl, "Row spacing", "Vertical spacing between buttons.", s.layout, "rowGap", 0, 16, 1, " px");
        this.numberSlider(containerEl, "Column spacing", "Horizontal spacing between buttons.", s.layout, "columnGap", 0, 16, 1, " px");
        this.numberSlider(containerEl, "Panel padding", "Space between the panel edge and its contents.", s.layout, "panelPadding", 0, 20, 1, " px");
        containerEl = this.section(page, "Appearance");
        new Setting(containerEl).setName("Panel opacity").setDesc("50% to 100%. Default: 86%.").addSlider(x => x.setLimits(.5, 1, .02).setDynamicTooltip().setValue(s.appearance.panelOpacity).onChange(async v => {
            s.appearance.panelOpacity = v;
            await this.plugin.settingsChanged(false);
        }));
        this.numberSlider(containerEl, "Corner radius", "Panel corner radius.", s.appearance, "borderRadius", 0, 32, 1, " px");
        new Setting(containerEl).setName("Shadow").setDesc("Panel shadow strength.").addDropdown(d => d.addOption("off", "Off").addOption("weak", "Weak").addOption("medium", "Medium").addOption("strong", "Strong").setValue(s.appearance.shadow).onChange(async v => {
            s.appearance.shadow = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Icon opacity").setDesc("Usually kept at 100%.").addSlider(x => x.setLimits(.5, 1, .05).setDynamicTooltip().setValue(s.appearance.iconOpacity).onChange(async v => {
            s.appearance.iconOpacity = v;
            await this.plugin.settingsChanged(false);
        }));
        this.numberSlider(containerEl, "Handle size", "Size of the expand/collapse handle.", s.appearance, "handleSize", 36, 64, 1, " px");
        new Setting(containerEl).setName("Handle opacity").setDesc("Lower opacity to reduce visual obstruction.").addSlider(x => x.setLimits(.4, 1, .05).setDynamicTooltip().setValue(s.appearance.handleOpacity).onChange(async v => {
            s.appearance.handleOpacity = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Panel animation").setDesc("Disable to remove animation.").addDropdown(d => d.addOption("off", "Off").addOption("fast", "Fast").addOption("normal", "Normal").setValue(s.appearance.animation).onChange(async v => {
            s.appearance.animation = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Scrollbars").setDesc("Auto visibility depends on the system WebView.").addDropdown(d => d.addOption("hidden", "Hidden").addOption("auto", "Automatic").addOption("always", "Always visible").setValue(s.appearance.scrollbar).onChange(async v => {
            s.appearance.scrollbar = v;
            await this.plugin.settingsChanged(false);
        }));
        containerEl = this.section(page, "Expand and collapse");
        new Setting(containerEl).setName("Auto-collapse mode").setDesc("Keep the panel open by default for consecutive commands.").addDropdown(d => d.addOption("never", "Never").addOption("input", "When typing").addOption("after-command", "After a command").addOption("blur", "When leaving the editor").addOption("smart", "Smart (experimental)").setValue(s.behavior.autoCollapse).onChange(async v => {
            s.behavior.autoCollapse = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Collapse on outside click").setDesc("Collapse when clicking outside the dashboard.").addToggle(t => t.setValue(s.behavior.clickOutsideCollapse).onChange(async v => {
            s.behavior.clickOutsideCollapse = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Keep open after commands").setDesc("Useful when applying several formatting commands in sequence.").addToggle(t => t.setValue(s.behavior.keepOpenAfterCommand).onChange(async v => {
            s.behavior.keepOpenAfterCommand = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Remember expanded state").setDesc("When disabled, the panel starts collapsed on each load.").addToggle(t => t.setValue(s.behavior.rememberExpanded).onChange(async v => {
            s.behavior.rememberExpanded = v;
            await this.plugin.settingsChanged(false);
        }));
        containerEl = this.section(page, "Toolbar commands");
        new Setting(containerEl).setName("Add command").setDesc("Choose from commands currently registered in Obsidian.").addButton(b => b.setButtonText("Add command").setCta().onClick(() => new CommandPickerModal(this.app, this.plugin).open()));
        new Setting(containerEl).setName("Reload Obsidian mobile toolbar commands").setDesc("Replace this dashboard's command list with the current Obsidian mobile toolbar list.").addButton(b => b.setButtonText("Restore").onClick(async () => {
            await this.plugin.restoreToolbarFromObsidian();
            this.display();
        }));
        const cmdWrap = containerEl.createDiv("mtd-command-settings-list");
        const ids = this.plugin.data.toolbar.commandIds || [];
        if (!ids.length) cmdWrap.createDiv({
            cls: "mtd-picker-empty",
            text: "No commands yet. Select Add command above."
        });
        ids.forEach((id, index) => this.renderCommandSetting(cmdWrap, id, index));
        containerEl = this.section(page, "Position and gestures");
        new Setting(containerEl).setName("Docking mode").setDesc("Automatic left/right docking is the default.").addDropdown(d => d.addOption("auto", "Automatic left/right").addOption("left", "Fixed left").addOption("right", "Fixed right").setValue(s.position.sideMode).onChange(async v => {
            s.position.sideMode = v;
            await this.plugin.settingsChanged(false);
        }));
        this.numberSlider(containerEl, "Edge distance", "Distance between the handle and the viewport edge.", s.position, "edgeOffset", 0, 30, 1, " px");
        this.numberSlider(containerEl, "Vertical position (from viewport top)", "Move the handle vertically in CSS pixels. Its actual position is constrained to the safe area.", s.position, "y", 0, Math.max(200, Math.ceil(this.plugin.getViewport().height)), 1, " px");
        this.numberSlider(containerEl, "Top safety margin", "Reserved area at the top. Use Vertical position to move the handle directly.", s.position, "topSafe", 84, 200, 2, " px");
        this.numberSlider(containerEl, "Bottom safety margin", "Reserved area at the bottom. This moves the handle only when it would enter that area.", s.position, "bottomSafe", 16, 160, 2, " px");
        new Setting(containerEl).setName("Remember side").setDesc("When disabled, the next load uses the default side for the selected docking mode.").addToggle(t => t.setValue(s.position.rememberSide).onChange(async v => {
            s.position.rememberSide = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Remember vertical position").setDesc("When disabled, the next load restores the default vertical position. Dragging remains available.").addToggle(t => t.setValue(s.position.rememberY).onChange(async v => {
            s.position.rememberY = v;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Recover handle position").setDesc("Reset position and safety margins, move the handle to the safe center-right, and collapse the panel. Preserve commands and icons.").addButton(b => b.setButtonText("Recover now").setWarning().onClick(async () => {
            await this.plugin.resetHandlePosition(true);
            this.display();
        }));
        this.numberSlider(containerEl, "Handle long-press duration (advanced)", "Hold duration before dragging starts.", s.gesture, "handleLongPressMs", 250, 900, 50, " ms");
        this.numberSlider(containerEl, "Command long-press duration", "Hold a command button to show its name.", s.gesture, "commandLongPressMs", 300, 1200, 50, " ms");
        this.numberSlider(containerEl, "Tooltip duration", "How long a command tooltip remains visible.", s.gesture, "tooltipDurationMs", 500, 5e3, 100, " ms");
        new Setting(containerEl).setName("Haptic feedback").setDesc("Available when supported by the device WebView.").addDropdown(d => d.addOption("off", "Off").addOption("longpress", "Long press only").addOption("all", "Click and long press").setValue(s.gesture.haptic).onChange(async v => {
            s.gesture.haptic = v;
            await this.plugin.settingsChanged(false);
        }));
        containerEl = this.section(page, "Import, export, and reset");
        new Setting(containerEl).setName("Backup directory").setDesc("Path relative to the active vault. Uses the vault API.").addText(t => t.setPlaceholder(STABLE_DEFAULTS.backup.directory).setValue(s.backup.directory).onChange(async v => {
            s.backup.directory = v.trim() || STABLE_DEFAULTS.backup.directory;
            await this.plugin.settingsChanged(false);
        }));
        new Setting(containerEl).setName("Export all configuration").setDesc("Export layout, behavior, command order, custom icons, and compatibility metadata.").addButton(b => b.setButtonText("Export configuration").setCta().onClick(async () => {
            const path = await this.plugin.exportConfig("manual");
            new Notice(`Exported: ${path}`);
        }));
        new Setting(containerEl).setName("Import configuration").setDesc("Choose a JSON file from the backup directory. A pre-import backup is created first.").addButton(b => b.setButtonText("Import configuration").onClick(() => new BackupPickerModal(this.app, this.plugin).open()));
        new Setting(containerEl).setName("Restore all default settings").setDesc("Restore all settings while preserving command order and custom icons.").addButton(b => b.setButtonText("Restore all default settings").onClick(async () => {
            await this.plugin.restoreStableDefaults();
            this.display();
            new Notice("Default settings restored.");
        }));
        new Setting(containerEl).setName("Restore default layout").setDesc("Reset layout, appearance, and position. Preserve commands and collapse behavior.").addButton(b => b.setButtonText("Reset layout").onClick(async () => {
            await this.plugin.restoreLayoutDefaults();
            this.display();
        }));
        new Setting(containerEl).setName("Restore default behavior").setDesc("Reset collapse behavior, position, and gestures. Preserve commands, layout, and appearance.").addButton(b => b.setButtonText("Reset behavior").onClick(async () => {
            await this.plugin.restoreBehaviorDefaults();
            this.display();
        }));
        new Setting(containerEl).setName("Factory reset (destructive)").setDesc("Remove custom configuration and reload the current Obsidian mobile toolbar commands. Export a backup first.").addButton(b => b.setButtonText("Factory reset").setWarning().onClick(() => new ConfirmFactoryResetModal(this.app, this.plugin).open()));
        containerEl = this.section(page, "Advanced options");
        containerEl.createEl("p", {
            cls: "mtd-risk-note",
            text: "Advanced settings affect layout and gestures. Export a backup before performing a factory reset."
        });
    }
    section(containerEl, text) {
        const group = containerEl.createEl("details", {
            cls: "mtd-settings-group"
        });
        group.open = this.sectionState[text] ?? false;
        group.createEl("summary", {
            text: text
        });
        group.addEventListener("toggle", () => {
            this.sectionState[text] = group.open;
        });
        return group.createDiv("mtd-settings-group-content");
    }
    numberSlider(containerEl, name, desc, obj, key, min, max, step, suffix = "") {
        const setting = new Setting(containerEl).setName(name).setDesc(desc);
        let slider, input;
        const update = async raw => {
            if (raw === "" || !Number.isFinite(Number(raw))) {
                if (input) input.value = String(obj[key]);
                return;
            }
            const v = Math.round(clamp(Number(raw), min, max) / step) * step;
            obj[key] = v;
            slider?.setValue(v);
            if (input) input.value = String(v);
            await this.plugin.settingsChanged(false);
        };
        setting.addSlider(x => {
            slider = x;
            x.setLimits(min, max, step).setDynamicTooltip().setValue(obj[key]).onChange(update);
        });
        setting.addText(x => {
            input = x.inputEl;
            input.type = "number";
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.classList.add("mtd-number-input");
            input.setAttribute("aria-label", name);
            x.setValue(String(obj[key]));
            input.addEventListener("change", () => update(input.value));
        });
        if (suffix) setting.controlEl.createSpan({
            cls: "mtd-unit",
            text: suffix.trim()
        });
    }
    renderCommandSetting(parent, id, index) {
        const cmd = this.app.commands?.commands?.[id];
        const row = parent.createDiv("mtd-command-setting-row");
        const icon = row.createDiv("mtd-command-setting-icon");
        this.plugin.paintIcon(icon, id, cmd);
        const info = row.createDiv("mtd-command-setting-info");
        info.createDiv({
            cls: "mtd-command-setting-name",
            text: cmd?.name || `Unavailable command: ${id}`
        });
        info.createDiv({
            cls: "mtd-command-setting-id",
            text: id
        });
        const actions = row.createDiv("mtd-command-setting-actions");
        const up = actions.createEl("button", {
            attr: {
                title: "Move up",
                "aria-label": "Move up"
            }
        });
        setIcon(up, "arrow-up");
        up.disabled = index === 0;
        up.addEventListener("click", async () => {
            await this.plugin.moveCommand(index, -1);
            this.display();
        });
        const down = actions.createEl("button", {
            attr: {
                title: "Move down",
                "aria-label": "Move down"
            }
        });
        setIcon(down, "arrow-down");
        down.disabled = index === this.plugin.data.toolbar.commandIds.length - 1;
        down.addEventListener("click", async () => {
            await this.plugin.moveCommand(index, 1);
            this.display();
        });
        const iconBtn = actions.createEl("button", {
            attr: {
                title: "Change icon",
                "aria-label": "Change icon"
            }
        });
        setIcon(iconBtn, "palette");
        iconBtn.addEventListener("click", () => new IconPickerModal(this.app, this.plugin, id).open());
        const del = actions.createEl("button", {
            attr: {
                title: "Remove",
                "aria-label": "Remove"
            }
        });
        setIcon(del, "trash-2");
        del.addEventListener("click", async () => {
            await this.plugin.removeCommand(id);
            this.display();
        });
    }
}

module.exports = class MobileToolbarDashboard extends Plugin {
    async onload() {
        const saved = await this.loadData() || {};
        this.data = await this.normalizeData(saved);
        await this.savePluginData();
        this.root = null;
        this.handle = null;
        this.panel = null;
        this.grid = null;
        this.tooltip = null;
        this.tooltipTimer = null;
        this.dragTimer = null;
        this.dragging = false;
        this.pointerDown = false;
        this.moved = false;
        this.settingTab = new MobileToolbarDashboardSettingTab(this.app, this);
        this.addSettingTab(this.settingTab);
        this.addCommand({
            id: "open-settings",
            name: "Open settings",
            callback: () => this.openSettings()
        });
        this.addCommand({
            id: "toggle-dashboard",
            name: "Toggle dashboard",
            callback: () => this.toggleExpanded()
        });
        this.addCommand({
            id: "emergency-collapse",
            name: "Collapse dashboard",
            callback: () => this.collapse()
        });
        this.addCommand({
            id: "reset-handle-position",
            name: "Recover handle position",
            callback: () => this.resetHandlePosition(true)
        });
        this.addCommand({
            id: "restore-stable-defaults",
            name: "Restore default settings",
            callback: async () => {
                await this.restoreStableDefaults();
                new Notice("Default settings restored.");
            }
        });
        this.addCommand({
            id: "export-config",
            name: "Export configuration",
            callback: async () => {
                const p = await this.exportConfig("command");
                new Notice(`Exported: ${p}`);
            }
        });
        this.addCommand({
            id: "import-config",
            name: "Import configuration",
            callback: () => new BackupPickerModal(this.app, this).open()
        });
        this.registerDomEvent(document, "pointerdown", e => this.handleOutsidePointer(e), true);
        this.registerDomEvent(document, "beforeinput", e => this.handleBeforeInput(e), true);
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.handleLeafChange()));
        this.app.workspace.onLayoutReady(() => {
            if (!Platform.isMobile) return;
            if (this.unloaded) return;
            try {
                this.initUI();
            } catch (e) {
                this.root?.remove();
                document.body.classList.remove("mtd-ready");
                console.error("[MTD] UI startup failed", e);
                new Notice(`Dashboard initialization failed: ${e?.message || e}`);
            }
        });
    }
    onunload() {
        this.unloaded = true;
        this.clearCommandBindings?.();
        clearTimeout(this.dragTimer);
        clearTimeout(this.tooltipTimer);
        if (this.root) this.root.remove();
        document.body.classList.remove("mtd-ready", "mtd-expanded", "mtd-collapsed", "mtd-left", "mtd-right", "mtd-layout-vertical", "mtd-layout-horizontal");
    }
    async normalizeData(saved) {
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
        const sourceSchema = Number.isFinite(Number(saved?.schemaVersion)) ? Number(saved.schemaVersion) : 0;
        const oldExpanded = typeof saved.expanded === "boolean" ? saved.expanded : false;
        const oldSide = saved.side === "left" ? "left" : "right";
        const oldY = Number.isFinite(saved.y) ? saved.y : STABLE_DEFAULTS.position.y;
        let commandIds = saved?.toolbar?.commandIds;
        if (!Array.isArray(commandIds)) commandIds = this.getObsidianToolbarCommandIds();
        const settings = sanitizeSettings(saved.settings);
        if (saved.side && !saved.settings?.position?.side) settings.position.side = oldSide;
        if (Number.isFinite(saved.y) && !Number.isFinite(saved.settings?.position?.y)) settings.position.y = oldY;
        if (!settings.position.rememberY) settings.position.y = STABLE_DEFAULTS.position.y;
        if (!settings.position.rememberSide) settings.position.side = STABLE_DEFAULTS.position.side;
        let expanded = settings.behavior.rememberExpanded ? typeof saved?.runtime?.expanded === "boolean" ? saved.runtime.expanded : oldExpanded : false;
        const positionRescuePending = sourceSchema < SCHEMA_VERSION || saved?.runtime?.positionRescuePending === true;
        if (positionRescuePending) expanded = false;
        return {
            schemaVersion: SCHEMA_VERSION,
            settings: settings,
            toolbar: {
                commandIds: [ ...new Set(commandIds.filter(id => typeof id === "string" && id)) ]
            },
            icons: saved.icons && typeof saved.icons === "object" ? saved.icons : {},
            runtime: {
                expanded: expanded,
                positionRescuePending: positionRescuePending
            }
        };
    }
    savePluginData() {
        const snapshot = deepClone(this.data);
        this.saveQueue = (this.saveQueue || Promise.resolve()).catch(() => {}).then(() => this.saveData(snapshot));
        return this.saveQueue.catch(e => {
            console.error("[MTD] save failed", e);
            new Notice("Could not save configuration. Check storage and try again.");
            throw e;
        });
    }
    getObsidianToolbarCommandIds() {
        try {
            const ids = this.app.vault.getConfig("mobileToolbarCommands");
            return Array.isArray(ids) ? [ ...ids ] : [];
        } catch (_) {
            return [];
        }
    }
    getCommanderIconMap() {
        const map = new Map;
        try {
            const cmdr = this.app.plugins?.plugins?.cmdr;
            const items = cmdr?.settings?.advancedToolbar?.mappedIcons || [];
            for (const item of items) if (item?.commandID && item?.iconID) map.set(item.commandID, item.iconID);
        } catch (_) {}
        return map;
    }
    getIconId(commandId, cmd) {
        return this.data.icons?.[commandId] || this.getCommanderIconMap().get(commandId) || cmd?.icon || null;
    }
    paintIcon(el, commandId, cmd) {
        el.empty?.();
        while (el.firstChild) el.removeChild(el.firstChild);
        const iconId = this.getIconId(commandId, cmd);
        if (iconId) {
            try {
                setIcon(el, iconId);
                return;
            } catch (_) {}
        }
        el.textContent = "•";
    }
    initUI() {
        document.querySelector(".mtd-root")?.remove();
        const root = document.createElement("div");
        root.className = "mtd-root";
        const handle = document.createElement("button");
        handle.className = "mtd-handle";
        handle.type = "button";
        handle.setAttribute("aria-label", "Mobile Toolbar Dashboard");
        handle.textContent = "▦";
        const panel = document.createElement("div");
        panel.className = "mtd-panel";
        const grid = document.createElement("div");
        grid.className = "mtd-command-grid";
        panel.appendChild(grid);
        const tooltip = document.createElement("div");
        tooltip.className = "mtd-tooltip";
        root.append(handle, panel, tooltip);
        document.body.appendChild(root);
        this.root = root;
        this.handle = handle;
        this.panel = panel;
        this.grid = grid;
        this.tooltip = tooltip;
        this.bindHandle();
        this.renderCommands();
        const rescued = this.applyStartupRescue();
        this.applyState();
        document.body.classList.add("mtd-ready");
        if (rescued) this.savePluginData().catch(e => console.error("[MTD] startup rescue save failed", e));
        this.registerDomEvent(window, "resize", () => this.applyPosition());
        if (window.visualViewport) {
            const f = () => this.applyPosition();
            window.visualViewport.addEventListener("resize", f);
            window.visualViewport.addEventListener("scroll", f);
            this.register(() => {
                window.visualViewport?.removeEventListener("resize", f);
                window.visualViewport?.removeEventListener("scroll", f);
            });
        }
        this.registerEvent(this.app.workspace.on("layout-change", () => {
            if (this.isExpanded()) this.renderCommands();
            this.applyPosition();
        }));
    }
    isExpanded() {
        return !!this.data.runtime.expanded;
    }
    async toggleExpanded() {
        this.data.runtime.expanded = !this.data.runtime.expanded;
        if (this.data.runtime.expanded) this.renderCommands();
        this.applyState();
        if (this.data.settings.behavior.rememberExpanded) await this.savePluginData();
    }
    async collapse() {
        if (!this.isExpanded()) return;
        this.data.runtime.expanded = false;
        this.applyState();
        if (this.data.settings.behavior.rememberExpanded) await this.savePluginData();
    }
    renderCommands() {
        if (!this.grid) return;
        this.clearCommandBindings();
        this.grid.replaceChildren();
        const ids = this.data.toolbar.commandIds || [];
        if (!ids.length) {
            const e = document.createElement("div");
            e.className = "mtd-empty";
            e.textContent = "No commands configured. Add commands in the plugin settings.";
            this.grid.appendChild(e);
            return;
        }
        for (const id of ids) {
            const cmd = this.app.commands?.commands?.[id];
            const b = document.createElement("button");
            b.type = "button";
            b.className = "mtd-command-button";
            b.dataset.commandId = id;
            const name = cmd?.name || `Unavailable command: ${id}`;
            b.setAttribute("aria-label", name);
            b.setAttribute("title", name);
            this.paintIcon(b, id, cmd);
            if (!cmd) {
                b.classList.add("is-disabled");
                b.disabled = true;
            } else this.bindCommandButton(b, id, name);
            this.grid.appendChild(b);
        }
    }
    clearCommandBindings() {
        for (const f of this.commandCleanups || []) f();
        this.commandCleanups = [];
    }
    bindCommandButton(button, commandId, commandName) {
        const bind = (el, name, fn) => {
            el.addEventListener(name, fn);
            this.commandCleanups.push(() => el.removeEventListener(name, fn));
        };
        let longPressed = false, timer = null, sx = 0, sy = 0, moved = false;
        this.commandCleanups.push(() => clearTimeout(timer));
        bind(button, "pointerdown", e => {
            longPressed = false;
            moved = false;
            sx = e.clientX;
            sy = e.clientY;
            clearTimeout(timer);
            timer = setTimeout(() => {
                longPressed = true;
                this.haptic("longpress");
                this.showTooltip(commandName, button);
            }, this.data.settings.gesture.commandLongPressMs);
        });
        bind(button, "pointermove", e => {
            if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) {
                moved = true;
                clearTimeout(timer);
            }
        });
        const cancel = () => clearTimeout(timer);
        bind(button, "pointerup", cancel);
        bind(button, "pointercancel", () => {
            clearTimeout(timer);
            longPressed = false;
        });
        bind(button, "click", async e => {
            if (longPressed || moved) {
                e.preventDefault();
                e.stopPropagation();
                longPressed = false;
                return;
            }
            this.hideTooltip();
            this.haptic("click");
            this.app.commands.executeCommandById(commandId);
            const mode = this.data.settings.behavior.autoCollapse;
            if (mode === "after-command" || !this.data.settings.behavior.keepOpenAfterCommand) await this.collapse();
        });
    }
    showTooltip(text, anchor) {
        if (!this.tooltip) return;
        clearTimeout(this.tooltipTimer);
        this.tooltip.textContent = text;
        this.tooltip.classList.add("is-visible");
        requestAnimationFrame(() => {
            const r = anchor.getBoundingClientRect(), t = this.tooltip.getBoundingClientRect(), gap = 10;
            let left = this.data.settings.position.side === "right" ? r.left - t.width - gap : r.right + gap;
            left = Math.max(8, Math.min(window.innerWidth - t.width - 8, left));
            let top = r.top + (r.height - t.height) / 2;
            top = Math.max(8, Math.min(window.innerHeight - t.height - 8, top));
            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;
        });
        this.tooltipTimer = setTimeout(() => this.hideTooltip(), this.data.settings.gesture.tooltipDurationMs);
    }
    hideTooltip() {
        clearTimeout(this.tooltipTimer);
        this.tooltip?.classList.remove("is-visible");
    }
    bindHandle() {
        const h = this.handle;
        this.registerDomEvent(h, "pointerdown", e => {
            if (this.pointerDown || e.button !== undefined && e.button !== 0) return;
            e.preventDefault();
            this.pointerDown = true;
            this.activePointer = e.pointerId;
            this.moved = false;
            this.dragging = false;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.grabY = e.clientY - h.getBoundingClientRect().top;
            try {
                h.setPointerCapture(e.pointerId);
            } catch (_) {}
            clearTimeout(this.dragTimer);
            this.dragTimer = setTimeout(() => {
                if (!this.pointerDown) return;
                this.dragging = true;
                h.classList.add("mtd-dragging");
                this.haptic("longpress");
            }, this.data.settings.gesture.handleLongPressMs);
        });
        this.registerDomEvent(h, "pointermove", e => {
            if (!this.pointerDown || e.pointerId !== this.activePointer) return;
            if (Math.abs(e.clientX - this.startX) > 6 || Math.abs(e.clientY - this.startY) > 6) this.moved = true;
            if (!this.dragging) return;
            const p = this.data.settings.position, vp = this.getViewport(), bounds = this.getSafeYBounds();
            p.y = clamp(e.clientY - this.grabY, bounds.minY, bounds.maxY) - vp.top;
            if (p.sideMode === "auto") p.side = e.clientX < vp.left + vp.width / 2 ? "left" : "right";
            this.applyState();
        });
        const finish = async (e, cancelled = false) => {
            if (!this.pointerDown || e.pointerId !== this.activePointer) return;
            clearTimeout(this.dragTimer);
            this.pointerDown = false;
            const dragged = this.dragging;
            this.dragging = false;
            h.classList.remove("mtd-dragging");
            try {
                h.releasePointerCapture(e.pointerId);
            } catch (_) {}
            if (dragged) {
                await this.savePluginData();
                this.refreshSettings();
            } else if (!cancelled && !this.moved) await this.toggleExpanded();
        };
        this.registerDomEvent(h, "pointerup", e => finish(e));
        this.registerDomEvent(h, "pointercancel", e => finish(e, true));
        this.registerDomEvent(h, "lostpointercapture", e => finish(e, true));
        this.registerDomEvent(h, "click", e => {
            if (e.detail === 0 && !this.pointerDown) this.toggleExpanded();
        });
    }
    getViewport() {
        const v = window.visualViewport;
        return {
            width: v?.width || window.innerWidth,
            height: v?.height || window.innerHeight,
            left: v?.offsetLeft || 0,
            top: v?.offsetTop || 0
        };
    }
    getSafeYBounds() {
        const s = this.data.settings, vp = this.getViewport(), hs = s.appearance.handleSize;
        const css = this.root ? getComputedStyle(this.root) : null;
        const safeTop = parseFloat(css?.getPropertyValue("--mtd-safe-top")) || 0;
        const safeBottom = parseFloat(css?.getPropertyValue("--mtd-safe-bottom")) || 0;
        let minY = vp.top + Math.max(s.position.topSafe, 84, safeTop + 12);
        let maxY = vp.top + vp.height - Math.max(s.position.bottomSafe, 16, safeBottom + 8) - hs;
        if (maxY < minY) {
            minY = maxY = vp.top + Math.max(0, (vp.height - hs) / 2);
        }
        return {
            minY: minY,
            maxY: maxY
        };
    }
    getSafeCenterY() {
        const {minY: minY, maxY: maxY} = this.getSafeYBounds();
        return Math.round((minY + maxY) / 2) - this.getViewport().top;
    }
    applyStartupRescue() {
        if (!this.data.runtime.positionRescuePending) return false;
        const p = this.data.settings.position, vp = this.getViewport(), {minY: minY, maxY: maxY} = this.getSafeYBounds();
        if (!Number.isFinite(p.y) || p.y + vp.top < minY || p.y + vp.top > maxY) p.y = this.getSafeCenterY();
        this.data.runtime.expanded = false;
        this.data.runtime.positionRescuePending = false;
        return true;
    }
    getEditorRect() {
        const candidates = [ ".workspace-leaf.mod-active .markdown-source-view", ".workspace-leaf.mod-active .view-content", ".markdown-source-view.mod-cm6" ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el) {
                const r = el.getBoundingClientRect();
                if (r.width > 100 && r.height > 100) return r;
            }
        }
        return null;
    }
    resolvedSide() {
        const p = this.data.settings.position;
        if (p.sideMode === "left" || p.sideMode === "right") return p.sideMode;
        return p.side === "left" ? "left" : "right";
    }
    applyPosition() {
        if (!this.handle || !this.panel) return;
        const s = this.data.settings, vp = this.getViewport(), side = this.resolvedSide(), hs = s.appearance.handleSize;
        const {minY: minY, maxY: maxY} = this.getSafeYBounds();
        const y = clamp(vp.top + s.position.y, minY, maxY);
        const edge = clamp(s.position.edgeOffset, 0, Math.max(0, (vp.width - hs) / 2));
        const x = side === "left" ? vp.left + edge : vp.left + vp.width - edge - hs;
        const set = (el, key, value) => el.style.setProperty(key, value, "important");
        set(this.handle, "top", `${y}px`);
        set(this.handle, "left", `${x}px`);
        set(this.handle, "right", "auto");
        set(this.handle, "bottom", "auto");
        const l = s.layout, pad = l.panelPadding * 2;
        const availableW = Math.max(1, vp.width - edge - hs - 16);
        const maxCols = Math.max(1, Math.floor((availableW - pad + l.columnGap) / (l.buttonWidth + l.columnGap)));
        const cols = Math.min(l.verticalColumns, maxCols);
        this.root.style.setProperty("--mtd-vertical-cols", String(cols));
        let width, height;
        if (l.mode === "vertical") {
            width = Math.min(availableW, cols * l.buttonWidth + (cols - 1) * l.columnGap + pad);
            height = l.verticalVisibleRows * l.buttonHeight + (l.verticalVisibleRows - 1) * l.rowGap + pad;
        } else {
            const editor = l.horizontalWidthMode === "editor" ? this.getEditorRect() : null;
            width = l.horizontalWidthMode === "manual" ? l.horizontalManualWidth : editor ? editor.width - 16 : availableW;
            width = clamp(width, 1, availableW);
            height = l.horizontalRows * l.buttonHeight + (l.horizontalRows - 1) * l.rowGap + pad;
        }
        height = Math.min(height, Math.max(1, maxY + hs - minY));
        const top = clamp(y + hs / 2 - height / 2, minY, Math.max(minY, maxY + hs - height));
        const left = clamp(side === "left" ? x + hs + 8 : x - 8 - width, vp.left + 4, vp.left + vp.width - width - 4);
        for (const [key, value] of Object.entries({
            width: `${width}px`,
            height: `${height}px`,
            top: `${top}px`,
            left: `${left}px`,
            right: "auto",
            bottom: "auto"
        })) set(this.panel, key, value);
        this.handle.setAttribute("aria-expanded", String(this.isExpanded()));
    }
    applyCssVars() {
        if (!this.root) return;
        const s = this.data.settings;
        const r = this.root.style;
        r.setProperty("--mtd-button-w", `${s.layout.buttonWidth}px`);
        r.setProperty("--mtd-button-h", `${s.layout.buttonHeight}px`);
        r.setProperty("--mtd-icon-size", `${s.layout.iconSize}px`);
        r.setProperty("--mtd-row-gap", `${s.layout.rowGap}px`);
        r.setProperty("--mtd-col-gap", `${s.layout.columnGap}px`);
        r.setProperty("--mtd-panel-padding", `${s.layout.panelPadding}px`);
        r.setProperty("--mtd-panel-opacity", String(s.appearance.panelOpacity));
        r.setProperty("--mtd-radius", `${s.appearance.borderRadius}px`);
        r.setProperty("--mtd-icon-opacity", String(s.appearance.iconOpacity));
        r.setProperty("--mtd-handle-size", `${s.appearance.handleSize}px`);
        r.setProperty("--mtd-handle-opacity", String(s.appearance.handleOpacity));
        r.setProperty("--mtd-vertical-cols", String(s.layout.verticalColumns));
        r.setProperty("--mtd-horizontal-rows", String(s.layout.horizontalRows));
        this.root.dataset.shadow = s.appearance.shadow;
        this.root.dataset.animation = s.appearance.animation;
        this.root.dataset.scrollbar = s.appearance.scrollbar;
    }
    applyState() {
        if (!this.root) return;
        const body = document.body, side = this.resolvedSide(), mode = this.data.settings.layout.mode;
        body.classList.toggle("mtd-expanded", this.isExpanded());
        body.classList.toggle("mtd-collapsed", !this.isExpanded());
        body.classList.toggle("mtd-left", side === "left");
        body.classList.toggle("mtd-right", side === "right");
        body.classList.toggle("mtd-layout-vertical", mode === "vertical");
        body.classList.toggle("mtd-layout-horizontal", mode === "horizontal");
        this.applyCssVars();
        this.applyPosition();
    }
    async settingsChanged(rerender = false) {
        if (rerender) this.renderCommands();
        this.applyState();
        await this.savePluginData();
    }
    refreshSettings() {
        try {
            this.settingTab.display();
        } catch (_) {}
    }
    handleBeforeInput(e) {
        if (!this.isExpanded()) return;
        const mode = this.data.settings.behavior.autoCollapse;
        if (mode !== "input" && mode !== "smart") return;
        const t = e.target;
        if (t && (t.closest?.(".markdown-source-view") || t.closest?.(".cm-editor"))) this.collapse();
    }
    handleLeafChange() {
        if (!this.isExpanded()) return;
        const mode = this.data.settings.behavior.autoCollapse;
        if (mode !== "blur" && mode !== "smart") return;
        const view = this.app.workspace.getActiveViewOfType?.(require("obsidian").MarkdownView);
        if (!view) this.collapse();
    }
    handleOutsidePointer(e) {
        if (!this.isExpanded() || !this.data.settings.behavior.clickOutsideCollapse) return;
        if (this.root?.contains(e.target)) return;
        this.collapse();
    }
    haptic(kind) {
        const mode = this.data.settings.gesture.haptic;
        if (mode === "off") return;
        if (kind === "click" && mode !== "all") return;
        try {
            navigator.vibrate?.(kind === "longpress" ? 18 : 8);
        } catch (_) {}
    }
    async openSettings() {
        await this.collapse();
        try {
            this.app.setting.open();
            this.app.setting.openTabById(this.manifest.id);
        } catch (e) {
            console.error("[MTD] open settings failed", e);
            new Notice("Could not open settings. Open Settings, then Community plugins, then Mobile Toolbar Dashboard.");
        }
    }
    async resetHandlePosition(showNotice = false) {
        const p = this.data.settings.position;
        p.edgeOffset = STABLE_DEFAULTS.position.edgeOffset;
        p.topSafe = STABLE_DEFAULTS.position.topSafe;
        p.bottomSafe = STABLE_DEFAULTS.position.bottomSafe;
        p.sideMode = "auto";
        p.side = "right";
        p.y = this.getSafeCenterY();
        this.data.runtime.expanded = false;
        this.data.runtime.positionRescuePending = false;
        this.applyState();
        this.refreshSettings();
        await this.savePluginData();
        if (showNotice) new Notice("Handle moved to the safe center-right position. Panel collapsed.");
    }
    async moveCommand(index, delta) {
        const a = this.data.toolbar.commandIds;
        const j = index + delta;
        if (j < 0 || j >= a.length) return;
        [a[index], a[j]] = [ a[j], a[index] ];
        await this.savePluginData();
        this.renderCommands();
    }
    async removeCommand(id) {
        this.data.toolbar.commandIds = this.data.toolbar.commandIds.filter(x => x !== id);
        delete this.data.icons[id];
        await this.savePluginData();
        this.renderCommands();
    }
    async restoreToolbarFromObsidian() {
        this.data.toolbar.commandIds = this.getObsidianToolbarCommandIds();
        await this.savePluginData();
        this.renderCommands();
        new Notice("Obsidian mobile toolbar commands restored.");
    }
    async finishReset() {
        this.data.runtime.expanded = false;
        this.data.runtime.positionRescuePending = false;
        this.renderCommands();
        this.applyState();
        this.refreshSettings();
        await this.savePluginData();
    }
    async restoreStableDefaults() {
        this.data.settings = deepClone(STABLE_DEFAULTS);
        await this.finishReset();
    }
    async restoreLayoutDefaults() {
        for (const key of [ "layout", "appearance", "position" ]) this.data.settings[key] = deepClone(STABLE_DEFAULTS[key]);
        await this.finishReset();
    }
    async restoreBehaviorDefaults() {
        for (const key of [ "behavior", "position", "gesture" ]) this.data.settings[key] = deepClone(STABLE_DEFAULTS[key]);
        await this.finishReset();
    }
    async factoryReset() {
        this.data = {
            schemaVersion: SCHEMA_VERSION,
            settings: deepClone(STABLE_DEFAULTS),
            toolbar: {
                commandIds: this.getObsidianToolbarCommandIds()
            },
            icons: {},
            runtime: {
                expanded: false,
                positionRescuePending: false
            }
        };
        await this.finishReset();
    }
    async ensureDir(path) {
        const adapter = this.app.vault.adapter;
        const parts = normalizePath(path).split("/").filter(Boolean);
        let cur = "";
        for (const part of parts) {
            cur = cur ? `${cur}/${part}` : part;
            if (!await adapter.exists(cur)) await adapter.mkdir(cur);
        }
    }
    async exportConfig(reason = "manual") {
        const dir = normalizePath(this.data.settings.backup.directory || STABLE_DEFAULTS.backup.directory);
        await this.ensureDir(dir);
        const path = normalizePath(`${dir}/mobile-toolbar-dashboard-${reason}-${stamp()}.json`);
        const payload = {
            plugin: "mobile-toolbar-dashboard",
            schemaVersion: SCHEMA_VERSION,
            pluginVersion: this.manifest.version,
            exportedAt: (new Date).toISOString(),
            data: this.data
        };
        await this.app.vault.adapter.write(path, JSON.stringify(payload, null, 2));
        return path;
    }
    async importConfig(path) {
        const raw = await this.app.vault.adapter.read(normalizePath(path));
        const obj = JSON.parse(raw);
        if (!obj || obj.plugin !== "mobile-toolbar-dashboard" || !obj.data) throw new Error("Invalid Mobile Toolbar Dashboard configuration file.");
        this.data = await this.normalizeData(obj.data);
        this.applyStartupRescue();
        this.renderCommands();
        this.applyState();
        this.refreshSettings();
        await this.savePluginData();
    }
};
