const TokenTintPicker = (() => {
    const SCRIPT_NAME = "Token Tint Picker";
    const SHOW_SUCCESS_MESSAGES = false;

    const SWATCH_SIZE = 12;
    const SWATCH_MARGIN = 1;

    const PALETTE = [
        ["#222222", "#444444", "#666666", "#888888", "#aaaaaa", "#cccccc", "#ffffff"],
        ["#990000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#00a2e8"],
        ["#3c78d8", "#0000ff", "#9900ff", "#ff00ff", "#f4cccc", "#d9ead3", "#d0e0e3"],
        ["#fce5cd", "#fff2cc", "#d9ead3", "#cfe2f3", "#d9d2e9", "#ead1dc", "#f6b26b"],
        ["#b6d7a8", "#a2c4c9", "#9fc5e8", "#b4a7d6", "#d5a6bd", "#ea9999", "#ffe599"],
        ["#93c47d", "#76a5af", "#6fa8dc", "#8e7cc3", "#c27ba0", "#e06666", "#ffd966"],
        ["#6aa84f", "#45818e", "#3d85c6", "#674ea7", "#a64d79", "#cc0000", "#ff0000"],
        ["#e69138", "#f1c232", "#93c47d", "#6fa8dc", "#8e7cc3", "#c27ba0", "#cc0000"],
        ["#b45f06", "#bf9000", "#38761d", "#134f5c", "#0b5394", "#351c75", "#741b47"],
        ["#274e13", "#0c343d", "#073763", "#1c4587", "#20124d", "#4c1130", "#ffffff"]
    ];

    const NAMED_COLORS = {
    red: "#ff0000",
    darkred: "#990000",
    orange: "#ff9900",
    yellow: "#ffff00",
    green: "#00ff00",
    darkgreen: "#38761d",
    blue: "#0000ff",
    lightblue: "#00a2e8",
    cyan: "#00ffff",
    purple: "#9900ff",
    pink: "#ff00ff",
    brown: "#b45f06",
    black: "#222222",
    grey: "#888888",
    gray: "#888888",
    white: "#ffffff",

    clear: "transparent",
    transparent: "transparent"
    };

    const initState = () => {
        state.TokenTintPicker = state.TokenTintPicker || {};
        state.TokenTintPicker.savedSelections = state.TokenTintPicker.savedSelections || {};
    };

    const getPlayerName = (msg) => {
        const player = getObj("player", msg.playerid);
        return player ? player.get("_displayname") : msg.who;
    };

    const compactHtml = (html) => html.replace(/\s+/g, " ").trim();

    const whisper = (msg, html) => {
        const name = getPlayerName(msg);
        sendChat(SCRIPT_NAME, `/w "${name}" ${compactHtml(html)}`);
    };

    const info = (msg, text) => {
        if (SHOW_SUCCESS_MESSAGES) {
            whisper(msg, text);
        }
    };

    const normalizeColor = (raw) => {
        if (!raw) return null;

        const value = raw.trim().toLowerCase();

        if (NAMED_COLORS[value]) {
            return NAMED_COLORS[value];
        }

        if (/^#[0-9a-f]{6}$/.test(value)) {
            return value;
        }

        if (/^[0-9a-f]{6}$/.test(value)) {
            return `#${value}`;
        }

        return null;
    };

    const getSelectedTokenIds = (msg) => {
        if (!msg.selected) return [];

        return msg.selected
            .filter(sel => sel._type === "graphic")
            .map(sel => sel._id);
    };

    const saveSelection = (msg) => {
        const ids = getSelectedTokenIds(msg);
        state.TokenTintPicker.savedSelections[msg.playerid] = ids;
        return ids;
    };

    const getSavedSelection = (msg) => {
        return state.TokenTintPicker.savedSelections[msg.playerid] || [];
    };

    const applyTint = (ids, color) => {
        let changed = 0;

        ids.forEach(id => {
            const token = getObj("graphic", id);
            if (!token) return;

            token.set("tint_color", color);
            changed++;
        });

        return changed;
    };

    const colorButton = (color) => {
        const commandColor = color.replace("#", "");

        const style = [
            "display:inline-block",
            `width:${SWATCH_SIZE}px`,
            `height:${SWATCH_SIZE}px`,
            "padding:0",
            `margin:${SWATCH_MARGIN}px`,
            "border:1px solid #111",
            `background-color:${color}`,
            "text-decoration:none",
            "font-size:0",
            `line-height:${SWATCH_SIZE}px`,
            "vertical-align:top"
        ].join(";");

        return `<a href="!tint-pick ${commandColor}" title="${color}" style="${style}">&nbsp;</a>`;
    };

    const renderMenu = (selectedCount) => {
        const rows = PALETTE.map(row => {
            return `<div style="line-height:0;white-space:nowrap;">${row.map(colorButton).join("")}</div>`;
        }).join("");

        return `
            <div style="display:inline-block;border:1px solid #333;background:#1f1f1f;padding:6px 6px 8px 6px;border-radius:4px;font-size:11px;color:#ddd;">
                <div style="font-weight:bold;margin-bottom:4px;color:#fff;text-align:center;">Token Tint</div>
                <div style="display:inline-block;">${rows}</div>
                <div style="margin-top:10px;text-align:center;">
                    <a href="!tint-pick clear" style="display:inline-block;padding:2px 6px;border:1px solid #555;background:#333;color:#fff;text-decoration:none;border-radius:3px;">Clear</a>
                </div>
                <div style="margin-top:6px;color:#aaa;text-align:center;font-size:10px;">Selected tokens: ${selectedCount}</div>
            </div>
        `;
    };

    const showMenu = (msg) => {
        const ids = saveSelection(msg);

        if (ids.length === 0) {
            whisper(msg, `<div style="color:#f66;">Select one or more tokens first, then run <code>!tint-menu</code>.</div>`);
            return;
        }

        whisper(msg, renderMenu(ids.length));
    };

    const handleDirectTint = (msg, args) => {
        const color = normalizeColor(args[1]);

        if (!color) {
            whisper(msg, `Usage:<br><code>!tint #ff0000</code><br><code>!tint clear</code><br><code>!tint-menu</code><br><code>!tm</code>`);
            return;
        }

        const ids = getSelectedTokenIds(msg);

        if (ids.length === 0) {
            whisper(msg, `Select one or more tokens first.`);
            return;
        }

        const changed = applyTint(ids, color);
        info(msg, `Changed tint on ${changed} token(s).`);
    };

    const handlePick = (msg, args) => {
        const color = normalizeColor(args[1]);

        if (!color) {
            whisper(msg, `Invalid tint color.`);
            return;
        }

        const ids = getSavedSelection(msg);

        if (ids.length === 0) {
            whisper(msg, `No saved token selection found. Select one or more tokens and run <code>!tint-menu</code> again.`);
            return;
        }

        const changed = applyTint(ids, color);
        info(msg, `Changed tint on ${changed} token(s).`);
    };

    const handleInput = (msg) => {
        if (msg.type !== "api") return;

        initState();

        const args = msg.content.trim().split(/\s+/);
        const command = args[0];

        if (command === "!tint-menu" || command === "!tm") {
            showMenu(msg);
            return;
        }

        if (command === "!tint") {
            handleDirectTint(msg, args);
            return;
        }

        if (command === "!tint-pick") {
            handlePick(msg, args);
            return;
        }
    };

    on("chat:message", handleInput);
})();
